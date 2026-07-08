# 数据库适配器统一迁移指南

## 📋 概述

本文档提供将各服务从现有的混合数据库适配器迁移到统一PGX兼容适配器的详细指南。

### 🎯 迁移目标

1. **解决类型兼容性问题** - 统一pgx和sql类型接口
2. **统一数据库访问模式** - 所有服务使用相同的适配器接口
3. **简化维护工作** - 减少重复的适配器代码
4. **提升性能** - 充分利用pgx连接池的优势

---

## 🔄 当前问题分析

### 1. 类型兼容性问题

**问题现状**:
- `pgxpool.Pool` 无法转换为 `*sql.DB`
- `pgx.Rows` 与 `sql.Rows` 接口不兼容
- `pgx.Tx` 与 `sql.Tx` 接口不兼容
- `pgconn.CommandTag` 与 `sql.Result` 接口不兼容

**影响的服务**:
- `billing` - 同时使用pgxpool.Pool和sql.DB
- `console` - 有多个适配器实现
- `adscenter` - 混合使用不同类型
- 其他服务的兼容性问题

### 2. 接口不统一问题

**现有模式**:
```go
// 每个服务都有自己的适配器实现
services/billing/internal/storage/adapter.go
services/console/internal/storage/adapter.go
services/console/internal/storage/adapter_unified.go
services/useractivity/internal/storage/adapter.go
```

**问题**:
- 维护成本高
- 接口不一致
- 功能重复实现

---

## ✅ 解决方案：PGX兼容适配器

### 1. 核心设计

```go
// 新的统一适配器
type PGXCompatibleAdapter struct {
    config        Config
    cloudSQLPool  *pgxpool.Pool
    supabaseDB   *sql.DB
    mode         AdapterMode
}
```

### 2. 类型包装器

为解决pgx和sql类型不兼容问题，创建了包装器：

```go
// PGXRowsWrapper - 包装pgx.Rows为sql.Rows接口
type PGXRowsWrapper struct {
    rows *pgxpool.Rows
}

// PGXRowWrapper - 包装pgx.Row为sql.Row接口
type PGXRowWrapper struct {
    row *pgxpool.Row
}

// PGXResultWrapper - 包装pgconn.CommandTag为sql.Result接口
type PGXResultWrapper struct {
    commandTag pgconn.CommandTag
}

// PGXTxWrapper - 包装pgx.Tx为sql.Tx接口
type PGXTxWrapper struct {
    tx *pgxpool.Tx
}
```

### 3. 统一接口

新的适配器提供标准的sql.*接口：

```go
func (a *PGXCompatibleAdapter) Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
func (a *PGXCompatibleAdapter) QueryRow(ctx context.Context, query string, args ...interface{}) *sql.Row
func (a *PGXCompatibleAdapter) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
func (a *PGXCompatibleAdapter) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error)
```

---

## 📋 分步迁移指南

### Phase 1: 更新pkg/database导出

#### 1.1 更新adapter.go

```bash
# 在pkg/database/adapter.go中添加新的导出
echo 'exporting PGX-compatible adapter...' >> pkg/database/adapter.go

# 添加到文件末尾
cat >> pkg/database/adapter.go << 'EOF'

// === PGX兼容适配器导出 ===

// 为了向后兼容，同时提供新旧两种适配器
// NewPGXCompatibleAdapter - 新的PGX兼容适配器（推荐）
// GetAdapterForService - 原有的适配器（向后兼容）
// GetPGXCompatibleAdapterForService - 新的PGX兼容适配器工厂

// 推荐使用新的PGX兼容适配器以获得更好的性能和类型安全性
EOF
```

#### 1.2 创建新的工厂函数

```go
// 在pkg/database/adapter.go中添加
func GetPGXCompatibleAdapterForService(serviceName string) (*PGXCompatibleAdapter, error) {
    // 检��环境变量
    usePGXCompatible := os.Getenv("USE_PGX_COMPATIBLE_ADAPTER")

    if usePGXCompatible == "true" || usePGXCompatible == "1" {
        return database.GetPGXCompatibleAdapterForService(serviceName)
    }

    // 默认返回原有适配器（向后兼容）
    return GetAdapterForService(serviceName)
}
```

### Phase 2: 服务级迁移

#### 2.1 迁移步骤

对于每个服务，按以下步骤迁移：

**Step 1: 更新适配器创建**
```go
// 替换原有适配器创建
// 原代码：
adapter, err := database.GetAdapterForService("billing")

// 新代码：
adapter, err := database.GetPGXCompatibleAdapterForService("billing")
```

**Step 2: 更新处理函数签名**
```go
// 原代码：
func (h *Handler) SomeMethod(db *sql.DB) {
    // 使用sql.DB
}

// 新代码：
func (h *Handler) SomeMethod(adapter database.DatabaseAdapter) {
    // 使用统一的DatabaseAdapter接口
    rows, err := adapter.Query(ctx, query, args...)
}
```

**Step 3: 更新数据库操作**
```go
// 原代码：
rows, err := db.QueryContext(ctx, query, args...)

// 新代码：
rows, err := adapter.Query(ctx, query, args...)
```

#### 2.2 具体服务迁移示例

**Billing Service迁移**:
```go
// 文件：services/billing/internal/storage/adapter_pgx.go
package storage

import (
    "database/sql"
    "github.com/linming7277/adsai/pkg/database"
)

type PGXAdapter struct {
    adapter database.DatabaseAdapter
}

func NewPGXAdapter() (*PGXAdapter, error) {
    adapter, err := database.GetPGXCompatibleAdapterForService("billing")
    if err != nil {
        return nil, err
    }

    return &PGXAdapter{
        adapter: adapter,
    }, nil
}

// 方法保持一致
func (a *PGXAdapter) Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
    return a.adapter.Query(ctx, query, args...)
}

// ... 其他方法类似实现
```

### Phase 3: 配置和部署

#### 3.1 环境变量配置

```bash
# 设置启用新的PGX兼容适配器
export USE_PGX_COMPATIBLE_ADAPTER=true

# 原有的数据库配置保持不变
export DATABASE_URL="postgresql://..."
export NEXT_PUBLIC_SUPABASE_URL="https://..."
```

#### 3.2 渐进式迁移策略

**阶段1: 并行迁移**
- 新服务使用PGX兼容适配器
- 原有服务保持原有适配器
- 通过环境变量控制使用哪种适配器

**阶段2: 逐步切换**
- 验证PGX兼容适配器稳定性
- 逐步切换更多服务到新适配器

**阶段3: 完全迁移**
- 所有服务切换到PGX兼容适配器
- 移除旧的适配器实现

---

## 🧪 测试验证

### 1. 单元测试

```go
// 测试适配器创建
func TestAdapterCreation(t *testing.T) {
    adapter, err := database.GetPGXCompatibleAdapterForService("test-service")
    assert.NoError(t, err)
    assert.NotNil(t, adapter)
}

// 测试查询操作
func TestQueryOperations(t *testing.T) {
    adapter, _ := database.GetPGXCompatibleAdapterForService("test-service")

    rows, err := adapter.Query(context.Background(), "SELECT 1", nil)
    assert.NoError(t, err)
    defer rows.Close()

    // 测试Rows包装器
    var result int
    assert.NoError(t, rows.Scan(&result))
    assert.Equal(t, 1, result)
}
```

### 2. 集成测试

```go
// 在实际服务环境中测试
func TestServiceIntegration(t *testing.T) {
    // 测试完整的数据库操作流程
    // 包括查询、事务、写入等操作
}
```

---

## 📊 迁移检查清单

### 服务迁移检查表

| 服务名 | 适配器更新 | 处理函数更新 | 测试完成 | 状态 |
|--------|-----------|-----------|---------|------|
| billing | ☐ | ☐ | ☐ | 待开始 |
| console | ☐ | ☐ | ☐ | 待开始 |
| useractivity | ☐ | ☐ | ☐ | 待开始 |
| offer | ☐ | ☐ | ☐ | 待开始 |
| adscenter | ☐ | ☐ | ☐ | 待开始 |
| siterank | ☐ | ☐ | ☐ | 待开始 |
| batchopen | ☐ | ☐ | ☐ | 待开始 |
| recommendations | ☐ | ☐ | ☐ | 待开始 |

### 文件更新检查表

- [ ] `pkg/database/pgx_compatible_adapter.go` 创建完成
- [ ] `pkg/database/adapter.go` 导出更新完成
- [ ] 环境变量配置文档更新完成
- [ ] 测试用例编写完成
- [ ] CI/CD流程更新完成

---

## ⚠️ 注意事项

### 1. 向后兼容性

- 保留原有适配器实现确保向后兼容
- 通过环境变量控制使用哪种适配器
- 逐步迁移，避免一次性切换风险

### 2. 性能考虑

- PGX兼容适配器提供更好的连接池管理
- 包装器开销很小，对性能影响有限
- 建议在生产环境中充分测试

### 3. 错误处理

- 包装器保持原有错误传递机制
- 适当的日志记录帮助调试
- 保持与现有错误处理模式一致

---

## 🚀 部署建议

### 1. 分阶段部署

1. **开发环境**: 首先在开发环境测试
2. **测试环境**: 然后在测试环境验证
3. **预发环境**: 接着在预发环境测试
4. **生产环境**: 最后在生产环境部署

### 2. 回滚计划

- 保留原有适配器代码作为回滚选项
- 通过环境变量快速切换回原有实现
- 监控关键指标确保稳定性

### 3. 监控指标

- 数据库连接池状态
- 查询响应时间
- 错误率和类型
- 事务成功率

---

## 📚 参考资源

### 相关文档

- [DATABASE_ARCHITECTURE_CURRENT.md](./DATABASE_ARCHITECTURE_CURRENT.md)
- [pkg/database/adapter.go](../../pkg/database/adapter.go)
- [pkg/database/pgx_compatible_adapter.go](../../pkg/database/pgx_compatible_adapter.go)

### 最佳实践

- 使用参数化查询避免SQL注入
- 合理使用事务避免长时间锁定
- 及时关闭数据库连接和Rows
- 定期监控和优化连接池配置

---

**文档版本**: v1.0
**创建日期**: 2025-01-22
**维护者**: 数据库团队
**审核者**: 架构团队