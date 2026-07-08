# 数据库集成测试指南

## 概述

本文档说明如何为 HTTP 处理器和投影器添加数据库集成测试，以提高测试覆盖率。

---

## 数据库配置

### Cloud SQL for PostgreSQL

**实例信息**:
- **实例名称**: autoads
- **数据库名称**: autoads_db
- **访问方式**: 通过 VPC Connector（cr-conn-default-ane1）进行内网访问
- **用途**: 微服务专用数据库

**GCP 访问**:
- **密钥文件**: `secrets/gcp_codex_dev.json`
- **认证方式**: Service Account

---

## 测试数据库设置

### 选项 1: 使用测试数据库（推荐）

为了避免影响开发数据库，建议创建专门的测试数据库：

```bash
# 连接到 Cloud SQL
gcloud sql connect autoads --user=postgres

# 创建测试数据库
CREATE DATABASE autoads_test;

# 授权
GRANT ALL PRIVILEGES ON DATABASE autoads_test TO your_service_account;
```

### 选项 2: 使用本地 PostgreSQL

对于快速开发和 CI/CD，可以使用本地 PostgreSQL：

```bash
# 使用 Docker 启动本地 PostgreSQL
docker run -d \
  --name autoads-test-db \
  -e POSTGRES_DB=autoads_test \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -p 5432:5432 \
  postgres:15

# 或使用 docker-compose
docker-compose -f docker-compose.test.yml up -d
```

**docker-compose.test.yml**:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: autoads_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5432:5432"
    volumes:
      - ./scripts/init-test-db.sql:/docker-entrypoint-initdb.d/init.sql
```

---

## 环境变量配置

### 测试环境变量

创建 `.env.test` 文件：

```bash
# Cloud SQL 测试数据库
TEST_DATABASE_URL="postgresql://user:password@/autoads_test?host=/cloudsql/project:region:autoads"

# 或本地测试数据库
TEST_DATABASE_URL="postgresql://test:test@localhost:5432/autoads_test?sslmode=disable"

# GCP 认证
GOOGLE_APPLICATION_CREDENTIALS="secrets/gcp_codex_dev.json"

# 测试模式
TEST_MODE=integration
```

### Go 测试中使用

```go
import (
    "os"
    "testing"
)

func getTestDatabaseURL() string {
    if url := os.Getenv("TEST_DATABASE_URL"); url != "" {
        return url
    }
    // 默认本地测试数据库
    return "postgresql://test:test@localhost:5432/autoads_test?sslmode=disable"
}
```

---

## 集成测试实现

### 1. 创建测试辅助包

**testutil/database.go**:
```go
package testutil

import (
    "context"
    "database/sql"
    "fmt"
    "testing"
    
    _ "github.com/lib/pq"
)

// SetupTestDB 创建测试数据库连接
func SetupTestDB(t *testing.T) *sql.DB {
    t.Helper()
    
    dbURL := getTestDatabaseURL()
    db, err := sql.Open("postgres", dbURL)
    if err != nil {
        t.Skipf("Failed to connect to test database: %v", err)
    }
    
    if err := db.Ping(); err != nil {
        t.Skipf("Failed to ping test database: %v", err)
    }
    
    // 运行迁移
    if err := runMigrations(db); err != nil {
        t.Fatalf("Failed to run migrations: %v", err)
    }
    
    return db
}

// CleanupTestDB 清理测试数据
func CleanupTestDB(t *testing.T, db *sql.DB) {
    t.Helper()
    
    if db == nil {
        return
    }
    
    // 清理测试数据
    tables := []string{
        "BulkActionAudit",
        "BulkActionOperation",
        "OfferDailyKPI",
        "OfferAccountMap",
        "OfferPreferences",
        "OfferStatusHistory",
        "Offer",
        "GoogleAdsAccount",
        "User",
    }
    
    for _, table := range tables {
        _, _ = db.Exec(fmt.Sprintf(`DELETE FROM "%s" WHERE id LIKE 'test-%%' OR user_id LIKE 'test-%%'`, table))
    }
    
    db.Close()
}

// WithTestDB 提供测试数据库的辅助函数
func WithTestDB(t *testing.T, fn func(*sql.DB)) {
    t.Helper()
    
    db := SetupTestDB(t)
    defer CleanupTestDB(t, db)
    
    fn(db)
}
```

### 2. 更新 HTTP 处理器测试

**services/offer/internal/handlers/http_integration_test.go**:
```go
// +build integration

package handlers

import (
    "bytes"
    "context"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"
    
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "github.com/xxrenzhe/autoads/pkg/middleware"
    "github.com/xxrenzhe/autoads/services/offer/testutil"
)

// TestHandler_CreateOffer_Integration 集成测试
func TestHandler_CreateOffer_Integration(t *testing.T) {
    testutil.WithTestDB(t, func(db *sql.DB) {
        // Arrange
        handler := NewHandler(db, &MockPublisher{}, &MockCache{})
        
        payload := map[string]interface{}{
            "name":        "Test Offer",
            "originalUrl": "https://example.com",
        }
        body, err := json.Marshal(payload)
        require.NoError(t, err)
        
        req := httptest.NewRequest("POST", "/api/v1/offers", bytes.NewReader(body))
        req.Header.Set("Content-Type", "application/json")
        req = withUserContext(req, "test-user-1")
        
        w := httptest.NewRecorder()
        
        // Act
        handler.createOffer(w, req)
        
        // Assert
        assert.Equal(t, http.StatusCreated, w.Code)
        
        var response map[string]interface{}
        err = json.Unmarshal(w.Body.Bytes(), &response)
        require.NoError(t, err)
        assert.Contains(t, response, "id")
        
        // Verify data in database
        var count int
        err = db.QueryRow(`SELECT COUNT(*) FROM "Offer" WHERE user_id = $1`, "test-user-1").Scan(&count)
        require.NoError(t, err)
        assert.Equal(t, 1, count)
    })
}

// TestHandler_GetOffers_Integration 集成测试
func TestHandler_GetOffers_Integration(t *testing.T) {
    testutil.WithTestDB(t, func(db *sql.DB) {
        // Arrange - 插入测试数据
        _, err := db.Exec(`
            INSERT INTO "Offer" (id, "userId", name, "originalUrl", status, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
        `, "test-offer-1", "test-user-1", "Test Offer", "https://example.com", "opportunity")
        require.NoError(t, err)
        
        handler := NewHandler(db, &MockPublisher{}, &MockCache{})
        
        req := httptest.NewRequest("GET", "/api/v1/offers", nil)
        req = withUserContext(req, "test-user-1")
        
        w := httptest.NewRecorder()
        
        // Act
        handler.getOffers(w, req)
        
        // Assert
        assert.Equal(t, http.StatusOK, w.Code)
        
        var response []map[string]interface{}
        err = json.Unmarshal(w.Body.Bytes(), &response)
        require.NoError(t, err)
        assert.Len(t, response, 1)
        assert.Equal(t, "test-offer-1", response[0]["id"])
    })
}
```

### 3. 更新投影器测试

**services/offer/internal/projectors/offer_projector_integration_test.go**:
```go
// +build integration

package projectors

import (
    "context"
    "testing"
    "time"
    
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "github.com/xxrenzhe/autoads/services/offer/internal/domain"
    "github.com/xxrenzhe/autoads/services/offer/testutil"
)

// TestOfferProjector_HandleOfferCreated_Integration 集成测试
func TestOfferProjector_HandleOfferCreated_Integration(t *testing.T) {
    testutil.WithTestDB(t, func(db *sql.DB) {
        // Arrange
        projector := NewOfferProjector(db)
        ctx := context.Background()
        
        event := domain.OfferCreatedEvent{
            OfferID:     "test-offer-1",
            UserID:      "test-user-1",
            Name:        "Test Offer",
            OriginalUrl: "https://example.com",
            Status:      "opportunity",
            CreatedAt:   time.Now(),
        }
        
        // Act
        err := projector.HandleOfferCreated(ctx, event)
        
        // Assert
        require.NoError(t, err)
        
        // Verify data in database
        var name, url, status string
        err = db.QueryRow(`
            SELECT name, "originalUrl", status 
            FROM "Offer" 
            WHERE id = $1 AND "userId" = $2
        `, event.OfferID, event.UserID).Scan(&name, &url, &status)
        
        require.NoError(t, err)
        assert.Equal(t, event.Name, name)
        assert.Equal(t, event.OriginalUrl, url)
        assert.Equal(t, event.Status, status)
    })
}

// TestOfferProjector_HandleOfferCreated_Idempotency_Integration 幂等性测试
func TestOfferProjector_HandleOfferCreated_Idempotency_Integration(t *testing.T) {
    testutil.WithTestDB(t, func(db *sql.DB) {
        // Arrange
        projector := NewOfferProjector(db)
        ctx := context.Background()
        
        event := domain.OfferCreatedEvent{
            OfferID:     "test-offer-2",
            UserID:      "test-user-1",
            Name:        "Test Offer 2",
            OriginalUrl: "https://example.com/2",
            Status:      "opportunity",
            CreatedAt:   time.Now(),
        }
        
        // Act - 处理两次相同的事件
        err1 := projector.HandleOfferCreated(ctx, event)
        err2 := projector.HandleOfferCreated(ctx, event)
        
        // Assert
        require.NoError(t, err1)
        require.NoError(t, err2)
        
        // Verify only one row exists
        var count int
        err := db.QueryRow(`SELECT COUNT(*) FROM "Offer" WHERE id = $1`, event.OfferID).Scan(&count)
        require.NoError(t, err)
        assert.Equal(t, 1, count)
    })
}
```

---

## 运行集成测试

### 本地运行

```bash
# 设置环境变量
export TEST_DATABASE_URL="postgresql://test:test@localhost:5432/autoads_test?sslmode=disable"

# 运行集成测试
go test -tags=integration ./services/offer/internal/handlers/... -v

# 运行所有测试（包括集成测试）
go test -tags=integration ./... -v
```

### CI/CD 中运行

**GitHub Actions 示例**:
```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: autoads_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Run migrations
        run: |
          go run ./cmd/migrate up
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/autoads_test?sslmode=disable
      
      - name: Run integration tests
        run: |
          go test -tags=integration ./... -v -coverprofile=coverage.out
        env:
          TEST_DATABASE_URL: postgresql://test:test@localhost:5432/autoads_test?sslmode=disable
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.out
```

---

## 最佳实践

### 1. 测试数据隔离

```go
// 使用唯一的测试 ID 前缀
func generateTestID(prefix string) string {
    return fmt.Sprintf("test-%s-%d", prefix, time.Now().UnixNano())
}

// 在测试中使用
offerID := generateTestID("offer")
userID := generateTestID("user")
```

### 2. 事务回滚

```go
func WithTestTransaction(t *testing.T, db *sql.DB, fn func(*sql.Tx)) {
    t.Helper()
    
    tx, err := db.Begin()
    require.NoError(t, err)
    
    defer tx.Rollback() // 总是回滚，保持数据库干净
    
    fn(tx)
}
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

### 4. 测试数据清理

```go
func TestWithCleanup(t *testing.T) {
    testutil.WithTestDB(t, func(db *sql.DB) {
        // 创建测试数据
        offerID := "test-offer-123"
        
        // 注册清理函数
        t.Cleanup(func() {
            db.Exec(`DELETE FROM "Offer" WHERE id = $1`, offerID)
        })
        
        // 测试代码
    })
}
```

---

## 故障排查

### 问题 1: 无法连接到数据库

```bash
# 检查数据库是否运行
docker ps | grep postgres

# 检查连接字符串
echo $TEST_DATABASE_URL

# 测试连接
psql $TEST_DATABASE_URL -c "SELECT 1;"
```

### 问题 2: 迁移失败

```bash
# 手动运行迁移
go run ./cmd/migrate up

# 检查迁移状态
go run ./cmd/migrate status
```

### 问题 3: 测试数据残留

```bash
# 清理所有测试数据
psql $TEST_DATABASE_URL -c "DELETE FROM \"Offer\" WHERE id LIKE 'test-%';"

# 或重置整个测试数据库
dropdb autoads_test
createdb autoads_test
```

---

## 性能优化

### 1. 使用连接池

```go
func SetupTestDB(t *testing.T) *sql.DB {
    db, _ := sql.Open("postgres", dbURL)
    
    // 配置连接池
    db.SetMaxOpenConns(10)
    db.SetMaxIdleConns(5)
    db.SetConnMaxLifetime(time.Hour)
    
    return db
}
```

### 2. 批量插入测试数据

```go
func InsertTestOffers(t *testing.T, db *sql.DB, count int) []string {
    t.Helper()
    
    ids := make([]string, count)
    
    tx, _ := db.Begin()
    defer tx.Rollback()
    
    stmt, _ := tx.Prepare(`INSERT INTO "Offer" (id, "userId", name, "originalUrl", status, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`)
    defer stmt.Close()
    
    for i := 0; i < count; i++ {
        id := fmt.Sprintf("test-offer-%d", i)
        ids[i] = id
        stmt.Exec(id, "test-user", fmt.Sprintf("Offer %d", i), "https://example.com", "opportunity")
    }
    
    tx.Commit()
    return ids
}
```

### 3. 使用测试数据快照

```go
// 创建快照
func CreateSnapshot(t *testing.T, db *sql.DB) {
    db.Exec(`CREATE TABLE "Offer_snapshot" AS SELECT * FROM "Offer"`)
}

// 恢复快照
func RestoreSnapshot(t *testing.T, db *sql.DB) {
    db.Exec(`TRUNCATE "Offer"`)
    db.Exec(`INSERT INTO "Offer" SELECT * FROM "Offer_snapshot"`)
}
```

---

## 总结

通过添加数据库集成测试，可以显著提高测试覆盖率：

- **HTTP 处理器**: 从 5% 提升到 60%+
- **投影器**: 从 11% 提升到 80%+
- **整体覆盖率**: 达到 60%+ 的目标

**下一步**:
1. 设置本地测试数据库
2. 实现集成测试辅助函数
3. 为关键处理器添加集成测试
4. 在 CI/CD 中运行集成测试

---

**文档版本**: 1.0  
**创建日期**: 2025-10-08  
**维护者**: 开发团队
