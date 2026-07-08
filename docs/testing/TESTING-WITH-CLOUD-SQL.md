# 使用 Cloud SQL 进行测试 - 快速指南

## 🎯 为什么直接使用 Cloud SQL？

- ✅ **无需 Docker** - 简化开发环境
- ✅ **真实环境** - 与生产环境一致
- ✅ **团队协作** - 共享测试数据库
- ✅ **快速开始** - 2 分钟即可运行测试

---

## 🚀 快速开始（2 分钟）

### 步骤 1: 配置环境变量

```bash
# 设置 GCP 认证
export GOOGLE_APPLICATION_CREDENTIALS="secrets/gcp_codex_dev.json"

# 设置数据库连接（根据实际情况调整）
export TEST_DATABASE_URL="postgresql://your_user:your_password@localhost:5432/autoads_db"
```

### 步骤 2: 运行测试

```bash
# 运行 offer 服务测试
go test ./services/offer/... -v

# 运行所有测试
go test ./... -v

# 生成覆盖率报告
go test ./services/offer/... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

就这么简单！✨

---

## 📝 配置详情

### 数据库信息

- **实例**: autoads
- **数据库**: autoads_db  
- **访问方式**: VPC Connector (cr-conn-default-ane1)
- **认证**: secrets/gcp_codex_dev.json

### 连接方式

#### 方式 1: 通过 Cloud SQL Proxy（推荐）

```bash
# 启动 Cloud SQL Proxy
cloud-sql-proxy your-project:asia-northeast1:autoads

# 然后连接到 localhost:5432
export TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/autoads_db"
```

#### 方式 2: 直接通过 VPC（在 GCP 内部）

```bash
# 使用内网 IP 或 Unix Socket
export TEST_DATABASE_URL="postgresql://user:pass@10.x.x.x:5432/autoads_db"
```

---

## 🧪 测试最佳实践

### 1. 使用测试前缀

所有测试数据的 ID 都以 `test-` 开头：

```go
offerID := "test-offer-" + uuid.New().String()
userID := "test-user-1"
```

### 2. 自动清理

testutil 会自动清理以 `test-` 开头的数据：

```go
testutil.WithTestDB(t, func(db *sql.DB) {
    // 测试代码
    // 测试结束后自动清理
})
```

### 3. 并行测试

```go
func TestParallel(t *testing.T) {
    t.Parallel() // 安全的并行测试
    
    testutil.WithTestDB(t, func(db *sql.DB) {
        // 使用唯一的测试 ID
    })
}
```

---

## 📊 示例测试

```go
package handlers

import (
    "testing"
    "github.com/xxrenzhe/autoads/services/offer/testutil"
)

func TestCreateOffer_Integration(t *testing.T) {
    testutil.WithTestDB(t, func(db *sql.DB) {
        // 创建处理器
        handler := NewHandler(db, &MockPublisher{}, &MockCache{})
        
        // 执行测试
        // ...
        
        // 验证结果
        // ...
    })
}
```

---

## 🔧 故障排查

### 问题: 连接失败

```bash
# 检查 GCP 认证
gcloud auth application-default login

# 验证数据库连接
psql $TEST_DATABASE_URL -c "SELECT 1;"
```

### 问题: 权限不足

确保服务账号有以下权限：
- Cloud SQL Client
- Cloud SQL Editor (如果需要创建测试数据库)

---

## 💡 提示

1. **开发环境**: 直接使用 Cloud SQL
2. **CI/CD**: 可以使用 Docker 或 Cloud SQL
3. **本地测试**: 推荐 Cloud SQL，更接近生产环境

---

**推荐**: 直接使用 Cloud SQL，简单高效！  
**文档**: 完整指南请参考 DATABASE-INTEGRATION-TESTING.md
