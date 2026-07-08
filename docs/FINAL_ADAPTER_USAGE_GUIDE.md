# FinalAdapter 统一数据访问层使用指南

## 概述

**FinalAdapter** 是AdsAI项目的统一数据访问层，为所有微服务提供标准化的数据库操作接口。

### 设计原则

1. **高性能优先** - 直接使用pgxpool，最小化类型转换开销
2. **向后兼容** - 提供sql.*接口，便于现有代码迁移
3. **生产级特性** - 内置重试、断路器、监控等企业级功能
4. **简单易用** - 统一的创建和配置方式
5. **精简设计** - 避免过度抽象，保持接口简洁

## 架构层次

```
┌────────────────────────────────────────────────────���────────────┐
│                  微服务层 (Microservices)                │
│     billing.go, user.go, offer.go, console.go...       │
├─────────────────────────────────────────────────────────────────┤
│              FinalAdapter (统一数据访问层)              │
│  ┌─ 核心功能 ─┬─ 增强特性 ─┬─ 性能优化             │
│  │ pgxpool    │ 重试机制   │ 批量操作                          │
│  │ sql.*兼容   │ 断路器      │ 连接池统计                         │
│  │ 类型包装器 │ 错误分类    │ 健康监控                           │
│  └────────────┴─────────────┴─────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│               Cloud SQL (数据库层)                       │
└─────────────────────────────────────────────────────────────────┘
```

## 基础使用方法

### 1. 服务初始化

```go
package main

import (
    "context"
    "log"

    "github.com/linming7277/adsai/pkg/database"
)

func main() {
    // 方式1：直接使用FinalAdapter（推荐）
    adapter, err := database.GetFinalAdapterForService("your-service")
    if err != nil {
        log.Fatal("Failed to create adapter:", err)
    }
    defer adapter.Close()

    // 方式2：使用ServiceAdapter（集成验证功能）
    serviceAdapter, err := database.NewForService("your-service")
    if err != nil {
        log.Fatal("Failed to create service adapter:", err)
    }
    defer serviceAdapter.Close()

    // 启动服务...
    startService(serviceAdapter)
}
```

### 2. 标准数据库操作

#### 使用FinalAdapter直接

```go
type UserService struct {
    adapter *database.FinalAdapter
}

func NewUserService() *UserService {
    adapter, _ := database.GetFinalAdapterForService("user")
    return &UserService{adapter: adapter}
}

// 高性能操作（推荐）
func (s *UserService) GetUserHighPerf(ctx context.Context, userID string) (*User, error) {
    var user User
    row := s.adapter.QueryRowPGX(ctx,
        "SELECT id, email, name, created_at FROM user.users WHERE id = $1",
        userID)
    err := row.Scan(&user.ID, &user.Email, &user.Name, &user.CreatedAt)
    return &user, err
}

// 向后兼容操作
func (s *UserService) GetUserCompat(ctx context.Context, userID string) (*User, error) {
    var user User
    err := s.adapter.QueryRow(ctx,
        "SELECT id, email, name, created_at FROM user.users WHERE id = $1",
        userID).Scan(&user.ID, &user.Email, &user.Name, &user.CreatedAt)
    return &user, err
}

// 执行更新操作
func (s *UserService) UpdateUser(ctx context.Context, user *User) error {
    _, err := s.adapter.ExecPGX(ctx,
        "UPDATE user.users SET name = $1, updated_at = NOW() WHERE id = $2",
        user.Name, user.ID)
    return err
}
```

#### 使用ServiceAdapter（推荐）

```go
type UserService struct {
    adapter *database.ServiceAdapter
}

func NewUserService() *UserService {
    adapter, _ := database.NewForService("user")
    return &UserService{adapter: adapter}
}

// 集成验证功能的操作
func (s *UserService) CreateUserWithValidation(ctx context.Context, user *User) error {
    // 验证并自动修复用户三层数据
    status, err := s.adapter.ValidateAndEnsureUser(ctx, user.ID, user.Email, user.Name, "")
    if err != nil {
        return fmt.Errorf("user validation failed: %w", err)
    }

    if status.Status != "complete" {
        return fmt.Errorf("user data incomplete: %s", status.Status)
    }

    // 高性能创建用户
    _, err = s.adapter.ExecPGX(ctx,
        "INSERT INTO user.users (id, email, name, created_at) VALUES ($1, $2, $3, NOW())",
        user.ID, user.Email, user.Name)
    return err
}

// 验证令牌和用户完整性
func (s *UserService) HandleAuthenticatedRequest(ctx context.Context, token string) (*User, error) {
    // 验证JWT令牌
    claims, err := s.adapter.VerifyToken(ctx, token)
    if err != nil {
        return nil, fmt.Errorf("invalid token: %w", err)
    }

    // 验证用户三层数据
    status, err := s.adapter.ValidateUser(ctx, claims.UserID)
    if err != nil {
        return nil, fmt.Errorf("user validation failed: %w", err)
    }

    if status.Status != "complete" {
        return nil, fmt.Errorf("user data incomplete: %s", status.Status)
    }

    // 获取用户数据
    var user User
    row := s.adapter.QueryRowPGX(ctx,
        "SELECT * FROM user.users WHERE id = $1", claims.UserID)
    err = row.Scan(&user.ID, &user.Email, &user.Name, &user.CreatedAt)
    return &user, err
}
```

### 3. 事务管理

```go
func (s *UserService) CreateUserWithProfile(ctx context.Context, user *User, profile *Profile) error {
    // 高性能事务
    tx, err := s.adapter.BeginTx(ctx, nil)
    if err != nil {
        return fmt.Errorf("failed to begin transaction: %w", err)
    }
    defer tx.Rollback()

    // 操作1：插入用户
    _, err = tx.Exec(ctx, `
        INSERT INTO user.users (id, email, name, created_at)
        VALUES ($1, $2, $3, NOW())`,
        user.ID, user.Email, user.Name)
    if err != nil {
        return fmt.Errorf("failed to insert user: %w", err)
    }

    // 操作2：插入用户资料
    _, err = tx.Exec(ctx, `
        INSERT INTO user.profiles (user_id, bio, avatar_url)
        VALUES ($1, $2, $3)`,
        user.ID, profile.Bio, profile.AvatarURL)
    if err != nil {
        return fmt.Errorf("failed to insert profile: %w", err)
    }

    // 提交事务
    if err := tx.Commit(); err != nil {
        return fmt.Errorf("failed to commit transaction: %w", err)
    }

    return nil
}

// 只读事务
func (s *UserService) GetUserReadonlyStats(ctx context.Context, userID string) (*UserStats, error) {
    tx, err := s.adapter.BeginTxReadOnly(ctx)
    if err != nil {
        return nil, fmt.Errorf("failed to begin read-only transaction: %w", err)
    }
    defer tx.Rollback() // 显式回滚只读事务

    var stats UserStats
    err := tx.QueryRowContext(ctx, `
        SELECT COUNT(*) as total_activities,
               MAX(created_at) as last_activity
        FROM user.activities
        WHERE user_id = $1`, userID).Scan(&stats.TotalActivities, &stats.LastActivity)

    return &stats, err
}
```

### 4. 批量操作

```go
func (s *UserService) BatchCreateUsers(ctx context.Context, users []*User) error {
    if len(users) == 0 {
        return nil
    }

    // 构建批量操作
    queries := make([]string, len(users))
    args := make([][]interface{}, len(users))

    for i, user := range users {
        queries[i] = `
            INSERT INTO user.users (id, email, name, created_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email,
                name = EXCLUDED.name,
                updated_at = NOW()`

        args[i] = []interface{}{user.ID, user.Email, user.Name}
    }

    // 高性能批量执行
    results, err := s.adapter.ExecBatchPGX(ctx, queries, args)
    if err != nil {
        return fmt.Errorf("batch insert failed: %w", err)
    }

    // 检查结果
    for i, result := range results {
        if result.RowsAffected() == 0 {
            log.Printf("Warning: User %s may not have been inserted", users[i].ID)
        }
    }

    return nil
}
```

### 5. 错误处理和重试

```go
func (s *UserService) CreateUserWithRetry(ctx context.Context, user *User) error {
    // 使用默认重试配置
    retryConfig := database.DefaultRetryConfig()

    // 自定义重试配置
    customRetry := database.RetryConfig{
        MaxRetries: 5,
        BaseDelay:  50 * time.Millisecond,
        MaxDelay:   2 * time.Second,
        Multiplier: 1.5,
    }

    // 执行带重试的操作
    _, err := s.adapter.ExecuteWithRetry(ctx,
        "INSERT INTO user.users (id, email, name, created_at) VALUES ($1, $2, $3, NOW())",
        []interface{}{user.ID, user.Email, user.Name},
        customRetry)

    if err != nil {
        return fmt.Errorf("failed to create user after retries: %w", err)
    }

    return nil
}
```

### 6. 监控和指标

```go
func (s *UserService) MonitorAdapterHealth(ctx context.Context) error {
    // 获取连接池统计
    stats := s.adapter.GetConnectionStats()
    log.Printf("Connection stats: %+v", stats)

    // 获取性能指标
    metrics := s.adapter.GetPerformanceMetrics()
    log.Printf("Performance metrics: %+v", metrics)

    // 健康检查
    if err := s.adapter.MonitorConnectionHealth(ctx); err != nil {
        return fmt.Errorf("connection health check failed: %w", err)
    }

    // 检查连接池使用率
    if utilization, ok := stats["connection_utilization_percent"].(float64); ok {
        if utilization > 0.8 {
            log.Printf("WARNING: High connection pool utilization: %.2f%%", utilization)
        }
    }

    return nil
}

// 定期监控
func (s *UserService) StartPeriodicMonitoring() {
    ticker := time.NewTicker(30 * time.Second)
    go func() {
        for {
            select {
            case <-ticker.C:
                s.MonitorAdapterHealth(context.Background())
            }
        }
    }()
}
```

## 环境配置

### 环境变量

```bash
# 启用FinalAdapter（推荐）
export USE_FINAL_DATABASE_ADAPTER=true

# 数据库连接
export DATABASE_URL="postgres://user:password@host:5432/dbname"

# 可选：只读副本
export DATABASE_READ_URL="postgres://user:password@replica:5432/dbname"

# 连接池配置
export DB_MAX_CONNECTIONS=20

# 性能优化
export USE_PGX_DIRECT_QUERIES=true

# 监控
export ENABLE_DB_METRICS=true
```

### 服务配置文件

```go
// config/database.go
package config

import "time"

type DatabaseConfig struct {
    MaxConnections    int           `env:"DB_MAX_CONNECTIONS" envDefault:"20"`
    ConnectionTimeout time.Duration `env:"DB_CONNECTION_TIMEOUT" envDefault:"30s"`
    QueryTimeout     time.Duration `env:"DB_QUERY_TIMEOUT" envDefault:"10s"`
    EnableMetrics    bool          `env:"ENABLE_DB_METRICS" envDefault:"true"`
    UsePGXDirect    bool          `env:"USE_PGX_DIRECT_QUERIES" envDefault:"true"`
}
```

## 最佳实践

### 1. 性能优化

```go
// ✅ 使用高性能PGX接口
rows, err := adapter.QueryPGX(ctx, query, args...)

// ❌ 避免使用兼容接口（除非必要）
rows, err := adapter.Query(ctx, query, args...) // 有类型转换开销

// ✅ 批量操作
results, err := adapter.ExecBatchPGX(ctx, queries, args)

// ✅ 只读事务
tx, err := adapter.BeginTxReadOnly(ctx)
```

### 2. 错误处理

```go
// ✅ 使用FinalAdapter的内置重试
result, err := adapter.ExecuteWithRetry(ctx, query, args, retryConfig)

// ✅ 区分错误类型
if err != nil {
    switch {
    case strings.Contains(err.Error(), "duplicate"):
        // 处理重复键错误
    case strings.Contains(err.Error(), "connection"):
        // 处理连接错误
    default:
        // 处理其他错误
    }
}
```

### 3. 资源管理

```go
// ✅ 延迟关闭（defer）
adapter, _ := database.GetFinalAdapterForService("myservice")
defer adapter.Close()

// ✅ 使用上下文取消
ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
defer cancel()

// ✅ 监控连接池状态
stats := adapter.GetConnectionStats()
if utilization > 0.9 {
    // 考虑降级或限流
}
```

### 4. 测试策略

```go
// 单元测试示例
func TestUserService(t *testing.T) {
    // 使用测试数据库
    adapter, err := database.GetFinalAdapterForService("test-service")
    require.NoError(t, err)
    defer adapter.Close()

    service := NewUserService(adapter)

    // 测试用例...
    user, err := service.GetUserHighPerf(context.Background(), "test-id")
    assert.NoError(t, err)
    assert.Equal(t, "test-id", user.ID)
}
```

## 迁移指南

### 从现有适配器迁移

```go
// 旧代码（多适配器模式）
type OldService struct {
    dualAdapter *DualDatabaseAdapter
}

func (s *OldService) GetUser(id string) (*User, error) {
    return s.dualAdapter.GetUserFromGCP(id)
}

// 新代码（FinalAdapter模式）
type NewService struct {
    adapter *database.FinalAdapter
}

func (s *NewService) GetUser(id string) (*User, error) {
    var user User
    err := s.adapter.QueryRowPGX(context.Background(),
        "SELECT * FROM users WHERE id = $1", id).Scan(&user)
    return &user, err
}
```

### 迁移检查清单

- [ ] 更新服务初始化代码
- [ ] 替换数据库操作调用
- [ ] 更新错误处理逻辑
- [ ] 添加监控和指标
- [ ] 配置环境变量
- [ ] 编写单元测试
- [ ] 性能测试验证

## 故障排除

### 常见问题

1. **连接池耗尽**
   ```go
   // 检查连接池统计
   stats := adapter.GetConnectionStats()
   // 增加连接池大小或优化查询
   ```

2. **查询超时**
   ```go
   // 设置合适的查询超时
   ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
   defer cancel()
   ```

3. **性能问题**
   ```go
   // 启用PGX直接查询模式
   export USE_PGX_DIRECT_QUERIES=true
   // 使用性能分析
   ```

### 调试技巧

```go
// 启用详细日志
export DATABASE_LOG_LEVEL=debug

// 获取详细的适配器信息
log.Printf("Adapter mode: %v", adapter.GetMode())
log.Printf("Connection pool stats: %+v", adapter.GetConnectionStats())
```

## 总结

FinalAdapter为AdsAI项目提供了：

1. **统一的数据访问接口** - 所有服务使用相同的数据库访问模式
2. **高性能优化** - 直接pgxpool访问，最小化开销
3. **企业级特性** - 重试、断路器、监控、批量操作
4. **向后兼容性** - 支持现有sql.*代码的平滑迁移
5. **生产就绪** - 经过优化和测试的稳定接口

通过FinalAdapter，AdsAI实现了数据访问层的统一，简化了开发复杂性，同时保持了高性能和可维护性。