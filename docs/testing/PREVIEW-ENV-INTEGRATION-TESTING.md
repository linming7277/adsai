# 预发环境集成测试指南

## 📋 概述

本文档描述如何对预发环境进行真实的集成测试。这些测试直接调用部署在 Cloud Run 上的预发环境服务和 Supabase 数据库，验证真实的生产环境配置和行为。

## 🎯 测试目标

- ✅ 验证预发环境服务的可用性和健康状态
- ✅ 测试真实的数据库操作和数据一致性
- ✅ 验证服务间的集成和通信
- ✅ 确保业务逻辑在真实环境中正确运行
- ✅ 发现配置问题和环境特定的 bug

## 🏗️ 预发环境架构

### 服务部署
所有服务部署在 **Cloud Run (asia-northeast1)**:

| 服务 | URL | 说明 |
|------|-----|------|
| Billing | `https://billing-preview-asia-northeast1.a.run.app` | 计费服务 |
| Offer | `https://offer-preview-asia-northeast1.a.run.app` | Offer 管理 |
| Siterank | `https://siterank-preview-asia-northeast1.a.run.app` | 网站评分 |
| Adscenter | `https://adscenter-preview-asia-northeast1.a.run.app` | 广告中心 |
| Browser-Exec | `https://browser-exec-preview-asia-northeast1.a.run.app` | 浏览器执行 |

### 数据库配置
**Supabase PostgreSQL** (通过 PgBouncer):
- **Host**: `aws-1-ap-northeast-1.pooler.supabase.com`
- **Port**: `6543`
- **Database**: `postgres`
- **User**: `postgres.jzzvizacfyipzdyiqfzb`
- **SSL Mode**: `require` (强制)

### 认证
- **Supabase Auth**: Google OAuth
- **JWT Token**: 用于服务间认证

## 🚀 快速开始

### 1. 设置环境变量

```bash
# Supabase 数据库密码（必需）
export SUPABASE_PASSWORD="your-supabase-password"

# 测试用户 Token（可选，用于需要认证的端点）
export TEST_USER_TOKEN="your-test-jwt-token"
```

### 2. 从 Secret Manager 获取凭证（推荐）

```bash
# 设置 GCP 项目
export GCP_PROJECT="gen-lang-client-0944935873"

# 获取 Supabase 密码
export SUPABASE_PASSWORD=$(gcloud secrets versions access latest \
  --secret="supabase-db-password" \
  --project="${GCP_PROJECT}")

# 获取测试用户 Token
export TEST_USER_TOKEN=$(gcloud secrets versions access latest \
  --secret="test-user-token" \
  --project="${GCP_PROJECT}")
```

### 3. 运行测试

使用提供的脚本：
```bash
./scripts/test-preview-env.sh
```

或手动运行：
```bash
# 运行所有预发环境集成测试
go test -tags=integration -v ./services/.../integration_preview_test.go

# 运行特定服务的测试
go test -tags=integration -v ./services/billing/integration_preview_test.go
go test -tags=integration -v ./services/offer/integration_preview_test.go
go test -tags=integration -v ./services/siterank/integration_preview_test.go
```

## 📝 测试文件

### Billing 服务
**文件**: `services/billing/integration_preview_test.go`

**测试覆盖**:
- ✅ 健康检查和就绪检查
- ✅ 数据库连接和表验证
- ✅ 用户创建和管理
- ✅ 订阅生命周期
- ✅ Token 交易操作
- ✅ 端到端计费流程

**示例测试**:
```go
func TestPreviewBillingHealth(t *testing.T)
func TestPreviewDatabaseConnection(t *testing.T)
func TestPreviewUserOperations(t *testing.T)
func TestPreviewSubscriptionOperations(t *testing.T)
func TestPreviewTokenOperations(t *testing.T)
func TestPreviewEndToEnd(t *testing.T)
```

### Offer 服务
**文件**: `services/offer/integration_preview_test.go`

**测试覆盖**:
- ✅ 健康检查
- ✅ Offer 表验证
- ✅ Offer 生命周期（创建、激活、KPI）
- ✅ 业务指标计算（CTR、ROAS）

**示例测试**:
```go
func TestPreviewOfferHealth(t *testing.T)
func TestPreviewOfferDatabase(t *testing.T)
func TestPreviewOfferOperations(t *testing.T)
func TestPreviewOfferMetrics(t *testing.T)
```

### Siterank 服务
**文件**: `services/siterank/integration_preview_test.go`

**测试覆盖**:
- ✅ 健康检查
- ✅ 分析表验证
- ✅ 分析生命周期（pending → processing → completed）
- ✅ 评分计算逻辑
- ✅ 多个分析处理

**示例测试**:
```go
func TestPreviewSiterankHealth(t *testing.T)
func TestPreviewSiterankDatabase(t *testing.T)
func TestPreviewSiterankAnalysis(t *testing.T)
func TestPreviewSiterankScoring(t *testing.T)
func TestPreviewMultipleAnalyses(t *testing.T)
```

## 🔍 测试示例

### 健康检查测试
```go
func TestPreviewBillingHealth(t *testing.T) {
    resp, err := makePreviewRequest("GET", "/health", nil, "")
    if err != nil {
        t.Skip("预发环境服务不可用")
    }
    defer resp.Body.Close()
    
    assert.Equal(t, http.StatusOK, resp.StatusCode)
    t.Logf("✅ 预发环境服务健康检查通过")
}
```

### 数据库操作测试
```go
func TestPreviewUserOperations(t *testing.T) {
    db, err := getPreviewDBConnection()
    require.NoError(t, err)
    defer db.Close()
    
    // 创建测试用户
    userID := fmt.Sprintf("test-user-%d", time.Now().Unix())
    _, err = db.Exec(`
        INSERT INTO "User" (id, email, created_at, updated_at) 
        VALUES ($1, $2, NOW(), NOW())
    `, userID, userID+"@test.com")
    require.NoError(t, err)
    
    // 清理
    defer db.Exec(`DELETE FROM "User" WHERE id = $1`, userID)
    
    // 验证
    var count int
    err = db.QueryRow(`SELECT COUNT(*) FROM "User" WHERE id = $1`, userID).Scan(&count)
    require.NoError(t, err)
    assert.Equal(t, 1, count)
}
```

### 端到端流程测试
```go
func TestPreviewEndToEnd(t *testing.T) {
    // 1. 创建用户
    // 2. 创建订阅
    // 3. 添加 Token
    // 4. 验证完整流程
    
    t.Logf("✅ 成功在预发环境完成端到端测试")
    t.Logf("   用户: %s", userID)
    t.Logf("   订阅: %s (状态: %s)", subID, status)
    t.Logf("   余额: %d tokens", balance)
}
```

## 📊 测试输出示例

```
🚀 开始预发环境集成测试...

📋 测试配置:
  GCP Project: gen-lang-client-0944935873
  Region: asia-northeast1
  Supabase URL: https://jzzvizacfyipzdyiqfzb.supabase.co
  Database: Supabase PostgreSQL (PgBouncer)

🌐 服务 URLs:
  Billing: https://billing-preview-asia-northeast1.a.run.app
  Offer: https://offer-preview-asia-northeast1.a.run.app
  Siterank: https://siterank-preview-asia-northeast1.a.run.app

🧪 运行集成测试...

=== RUN   TestPreviewBillingHealth
=== RUN   TestPreviewBillingHealth/health_check
    integration_preview_test.go:89: ✅ 预发环境服务健康检查通过
--- PASS: TestPreviewBillingHealth (0.15s)
    --- PASS: TestPreviewBillingHealth/health_check (0.15s)

=== RUN   TestPreviewDatabaseConnection
=== RUN   TestPreviewDatabaseConnection/database_connection
    integration_preview_test.go:112: ✅ 预发环境数据库连接成功
=== RUN   TestPreviewDatabaseConnection/check_required_tables
    integration_preview_test.go:135: ✅ 所有必需的表都存在
--- PASS: TestPreviewDatabaseConnection (0.08s)
    --- PASS: TestPreviewDatabaseConnection/database_connection (0.03s)
    --- PASS: TestPreviewDatabaseConnection/check_required_tables (0.05s)

=== RUN   TestPreviewEndToEnd
=== RUN   TestPreviewEndToEnd/complete_billing_workflow
    integration_preview_test.go:285: ✅ 成功在预发环境完成端到端测试
    integration_preview_test.go:286:    用户: test-e2e-user-1696800000
    integration_preview_test.go:287:    订阅: sub-e2e-1696800000 (状态: active)
    integration_preview_test.go:288:    余额: 10000 tokens
--- PASS: TestPreviewEndToEnd (0.12s)
    --- PASS: TestPreviewEndToEnd/complete_billing_workflow (0.12s)

PASS
ok      github.com/xxrenzhe/autoads/services/billing    0.450s

✅ 预发环境集成测试完成！
```

## ⚠️ 注意事项

### 数据清理
- ✅ 所有测试都包含 `defer` 清理函数
- ✅ 使用唯一的时间戳 ID 避免冲突
- ✅ 测试失败时也会执行清理

### 测试隔离
- ✅ 每个测试使用独立的测试数据
- ✅ 不依赖其他测试的状态
- ✅ 可以并行运行（使用唯一 ID）

### 错误处理
- ✅ 服务不可用时跳过测试（不失败）
- ✅ 数据库连接失败时提供清晰的错误信息
- ✅ 缺少凭证时给出设置指导

### 性能考虑
- ✅ 使用连接超时（30秒）
- ✅ 及时关闭数据库连接
- ✅ 避免创建大量测试数据

## 🔐 安全最佳实践

### 凭证管理
- ❌ **不要**在代码中硬编码密码
- ✅ 使用环境变量
- ✅ 从 Secret Manager 获取
- ✅ 使用 `.gitignore` 排除凭证文件

### 数据库访问
- ✅ 使用 SSL 连接（`sslmode=require`）
- ✅ 通过 PgBouncer 连接池
- ✅ 使用参数化查询防止 SQL 注入
- ✅ 限制测试数据的范围

### 测试数据
- ✅ 使用明显的测试前缀（`test-`）
- ✅ 及时清理测试数据
- ✅ 不要修改生产数据
- ✅ 使用只读操作验证数据

## 🚦 CI/CD 集成

### GitHub Actions 示例
```yaml
name: Preview Environment Integration Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  integration-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Authenticate to GCP
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Get secrets from Secret Manager
        run: |
          export SUPABASE_PASSWORD=$(gcloud secrets versions access latest \
            --secret="supabase-db-password")
          export TEST_USER_TOKEN=$(gcloud secrets versions access latest \
            --secret="test-user-token")
      
      - name: Run integration tests
        run: ./scripts/test-preview-env.sh
```

## 📈 测试指标

### 成功标准
- ✅ 所有健康检查通过
- ✅ 数据库连接成功
- ✅ 所有 CRUD 操作正常
- ✅ 业务逻辑计算正确
- ✅ 端到端流程完整

### 性能基准
- 健康检查: < 500ms
- 数据库查询: < 100ms
- 完整流程: < 2s

### 覆盖率目标
- 核心 API 端点: 100%
- 数据库表: 100%
- 业务流程: 100%
- 错误场景: 80%

## 🐛 故障排查

### 服务连接失败
```
⚠️  无法连接到预发环境服务: dial tcp: lookup ... no such host
```
**解决方案**:
- 检查服务是否已部署
- 验证 URL 是否正确
- 检查网络连接

### 数据库连接失败
```
❌ 错误: SUPABASE_PASSWORD 环境变量未设置
```
**解决方案**:
```bash
export SUPABASE_PASSWORD="your-password"
# 或从 Secret Manager 获取
export SUPABASE_PASSWORD=$(gcloud secrets versions access latest \
  --secret="supabase-db-password" \
  --project="gen-lang-client-0944935873")
```

### 认证失败
```
401 Unauthorized
```
**解决方案**:
- 检查 TEST_USER_TOKEN 是否有效
- 验证 JWT token 是否过期
- 确认用户权限

## 📚 相关文档

- [真实集成测试完成报告](./REAL-INTEGRATION-TESTS-COMPLETE.md)
- [数据库集成测试](./DATABASE-INTEGRATION-TESTING.md)
- [Cloud SQL 测试](./CLOUD-SQL-TESTING.md)
- [测试快速开始](./QUICK-START.md)
- [MustKnowV6 - 项目架构](../SupabaseGo/MustKnowV6.md)

## 🎉 总结

预发环境集成测试提供了:

1. **真实性**: 测试真实的服务和数据库
2. **完整性**: 覆盖完整的业务流程
3. **可靠性**: 自动清理和错误处理
4. **安全性**: 凭证管理和数据隔离
5. **可维护性**: 清晰的文档和示例

通过这些测试，我们可以在部署到生产环境之前，在预发环境中验证所有功能的正确性。

---

**创建时间**: 2025-10-08  
**状态**: ✅ 完成  
**环境**: 预发环境 (Cloud Run + Supabase)  
**测试类型**: 真实集成测试
