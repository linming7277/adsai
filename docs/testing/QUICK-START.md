# 数据库集成测试快速入门

## 🚀 快速开始（5 分钟）

### 1. 启动测试数据库

```bash
# 启动测试数据库（PostgreSQL + Redis）
./scripts/start-test-db.sh
```

这将启动：
- PostgreSQL 15 on port 5433
- Redis 7 on port 6380
- 自动初始化测试数据库和表结构

### 2. 设置环境变量

```bash
# 导出测试数据库 URL
export TEST_DATABASE_URL='postgresql://test:test@localhost:5433/autoads_test?sslmode=disable'
```

或者创建 `.env.test` 文件（已提供）。

### 3. 运行集成测试

```bash
# 运行 offer 服务的集成测试
go test ./services/offer/internal/handlers/... -v

# 运行 offer 投影器的集成测试
go test ./services/offer/internal/projectors/... -v

# 运行所有集成测试
go test ./services/offer/... -v
```

### 4. 停止测试数据库

```bash
# 停止测试数据库
./scripts/stop-test-db.sh

# 停止并删除所有数据
docker-compose -f docker-compose.test.yml down -v
```

---

## 📝 编写集成测试

### 示例 1: HTTP 处理器集成测试

```go
package handlers

import (
    "testing"
    "github.com/xxrenzhe/autoads/services/offer/testutil"
)

func TestHandler_CreateOffer_Integration(t *testing.T) {
    // 使用 testutil.WithTestDB 自动管理数据库连接和清理
    testutil.WithTestDB(t, func(db *sql.DB) {
        // 创建处理器
        handler := NewHandler(db, &MockPublisher{}, &MockCache{})
        
        // 创建测试请求
        req := httptest.NewRequest("POST", "/api/v1/offers", body)
        req = withUserContext(req, "test-user-1")
        w := httptest.NewRecorder()
        
        // 执行请求
        handler.createOffer(w, req)
        
        // 验证响应
        assert.Equal(t, http.StatusCreated, w.Code)
        
        // 验证数据库中的数据
        var count int
        db.QueryRow(`SELECT COUNT(*) FROM "Offer" WHERE user_id = $1`, "test-user-1").Scan(&count)
        assert.Equal(t, 1, count)
    })
}
```

### 示例 2: 投影器集成测试

```go
package projectors

import (
    "testing"
    "github.com/xxrenzhe/autoads/services/offer/testutil"
)

func TestOfferProjector_HandleOfferCreated_Integration(t *testing.T) {
    testutil.WithTestDB(t, func(db *sql.DB) {
        // 创建投影器
        projector := NewOfferProjector(db)
        
        // 创建测试事件
        event := domain.OfferCreatedEvent{
            OfferID:     "test-offer-1",
            UserID:      "test-user-1",
            Name:        "Test Offer",
            OriginalUrl: "https://example.com",
            Status:      "opportunity",
            CreatedAt:   time.Now(),
        }
        
        // 处理事件
        err := projector.HandleOfferCreated(ctx, event)
        assert.NoError(t, err)
        
        // 验证数据库中的数据
        var name string
        db.QueryRow(`SELECT name FROM "Offer" WHERE id = $1`, event.OfferID).Scan(&name)
        assert.Equal(t, event.Name, name)
    })
}
```

---

## 🔧 故障排查

### 问题 1: 端口已被占用

```bash
# 检查端口占用
lsof -i :5433
lsof -i :6380

# 停止占用端口的进程或修改 docker-compose.test.yml 中的端口
```

### 问题 2: Docker 未运行

```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
```

### 问题 3: 数据库连接失败

```bash
# 查看数据库日志
docker-compose -f docker-compose.test.yml logs postgres

# 重启数据库
docker-compose -f docker-compose.test.yml restart postgres
```

### 问题 4: 测试数据残留

```bash
# 清理所有测试数据
docker-compose -f docker-compose.test.yml down -v
./scripts/start-test-db.sh
```

---

## 📊 查看测试覆盖率

```bash
# 生成覆盖率报告
go test ./services/offer/... -coverprofile=coverage.out -covermode=atomic

# 查看覆盖率
go tool cover -func=coverage.out

# 生成 HTML 报告
go tool cover -html=coverage.out -o coverage.html
open coverage.html
```

---

## 🎯 最佳实践

### 1. 使用唯一的测试 ID

```go
// 使用时间戳生成唯一 ID
offerID := fmt.Sprintf("test-offer-%d", time.Now().UnixNano())
```

### 2. 清理测试数据

```go
// testutil.WithTestDB 会自动清理以 "test-" 开头的数据
// 确保所有测试 ID 都以 "test-" 开头
```

### 3. 并行测试

```go
func TestParallel(t *testing.T) {
    t.Parallel() // 允许并行运行
    
    testutil.WithTestDB(t, func(db *sql.DB) {
        // 测试代码
    })
}
```

### 4. 使用事务回滚

```go
func TestWithTransaction(t *testing.T) {
    testutil.WithTestDB(t, func(db *sql.DB) {
        tx, _ := db.Begin()
        defer tx.Rollback() // 总是回滚
        
        // 测试代码使用 tx 而不是 db
    })
}
```

---

## 📚 更多资源

- [完整的数据库集成测试指南](./DATABASE-INTEGRATION-TESTING.md)
- [测试最佳实践](./TESTING-BEST-PRACTICES.md)
- [CI/CD 集成](./CI-CD-INTEGRATION.md)

---

**更新时间**: 2025-10-08  
**维护者**: 开发团队
