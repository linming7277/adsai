# 真实集成测试计划

## 完成时间
2025-10-08

---

## 🎯 目标

创建真正的集成测试，直接调用预发环境的服务和数据库，而不是使用 Mock。

---

## 📊 当前测试状态

### ✅ 真实集成测试（1个）
- **Browser-exec**: 已实际运行，19/19 通过

### ⚠️ 单元测试（使用 Mock）
- **Billing 订阅管理**: 纯单元测试
- **Billing 事件处理**: 使用 sqlmock
- **Offer Domain**: 纯单元测试
- **Siterank Domain**: 纯单元测试
- **Adscenter**: 使用 httptest 和 Mock

---

## 🌐 预发环境服务 URL

根据 `gcloud run services list` 的结果：

| 服务 | 预发环境 URL |
|------|-------------|
| **Adscenter** | https://adscenter-preview-644672509127.asia-northeast1.run.app |
| **Billing** | https://billing-preview-644672509127.asia-northeast1.run.app |
| **Browser-exec** | https://browser-exec-preview-644672509127.asia-northeast1.run.app |
| **Offer** | https://offer-preview-644672509127.asia-northeast1.run.app |
| **Siterank** | https://siterank-preview-644672509127.asia-northeast1.run.app |
| **Recommendations** | https://recommendations-preview-644672509127.asia-northeast1.run.app |
| **Frontend** | https://frontend-preview-644672509127.asia-northeast1.run.app |

---

## 🔑 认证和数据库配置

### Supabase 配置
- **Project URL**: https://jzzvizacfyipzdyiqfzb.supabase.co
- **数据库**: PgBouncer IPv4 入口 `aws-1-ap-northeast-1.pooler.supabase.com`
- **账号格式**: `postgres.<project_ref>`
- **SSL**: 强制 `sslmode=require`

### Cloud SQL 配置
- **实例**: autoads
- **数据库**: autoads_db
- **访问方式**: VPC Connector (cr-conn-default-ane1)

---

## 📝 集成测试策略

### 方案 A: HTTP API 集成测试（推荐）

**优点**:
- 不需要数据库直连
- 测试完整的 HTTP 请求/响应流程
- 类似 Browser-exec 的成功案例

**实现**:
```go
// services/billing/integration_test.go
package main

import (
    "net/http"
    "testing"
)

const BILLING_PREVIEW_URL = "https://billing-preview-644672509127.asia-northeast1.run.app"

func TestBillingHealthCheck(t *testing.T) {
    resp, err := http.Get(BILLING_PREVIEW_URL + "/healthz")
    if err != nil {
        t.Fatalf("Failed to call health check: %v", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != 200 {
        t.Errorf("Expected 200, got %d", resp.StatusCode)
    }
}
```

### 方案 B: 数据库集成测试

**优点**:
- 测试真实的数据库操作
- 验证数据一致性

**挑战**:
- 需要 Cloud SQL Proxy 或 VPC 访问
- 需要测试数据清理

**实现**:
```go
// 需要先设置 Cloud SQL Proxy
// cloud_sql_proxy -instances=gen-lang-client-0944935873:asia-northeast1:autoads=tcp:5432

func TestDatabaseConnection(t *testing.T) {
    connStr := "host=localhost port=5432 user=postgres dbname=autoads_db sslmode=disable"
    db, err := sql.Open("postgres", connStr)
    if err != nil {
        t.Fatalf("Failed to connect: %v", err)
    }
    defer db.Close()
    
    // 测试查询
    var count int
    err = db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
    if err != nil {
        t.Fatalf("Query failed: %v", err)
    }
}
```

---

## 🚀 实施步骤

### 第1步: 创建集成测试文件

为每个服务创建 `integration_test.go`:
- `services/billing/integration_test.go`
- `services/offer/integration_test.go`
- `services/adscenter/integration_test.go`
- `services/siterank/integration_test.go`

### 第2步: 实现 HTTP API 测试

测试每个服务的主要端点：
- Health check (`/healthz`, `/health`)
- 主要 API 端点
- 错误处理

### 第3步: 运行测试

```bash
# 设置环境变量
export BILLING_URL=https://billing-preview-644672509127.asia-northeast1.run.app
export OFFER_URL=https://offer-preview-644672509127.asia-northeast1.run.app

# 运行集成测试
go test ./services/billing/... -tags=integration -v
go test ./services/offer/... -tags=integration -v
```

### 第4步: 验证结果

记录实际的测试结果，包括：
- 通过/失败的测试数量
- 响应时间
- 发现的问题

---

## 📋 测试清单

### Billing 服务
- [ ] Health check
- [ ] GET /api/v1/billing/balance
- [ ] POST /api/v1/billing/reserve
- [ ] POST /api/v1/billing/commit
- [ ] POST /api/v1/billing/release

### Offer 服务
- [ ] Health check
- [ ] GET /api/v1/offers
- [ ] POST /api/v1/offers
- [ ] GET /api/v1/offers/{id}
- [ ] PUT /api/v1/offers/{id}

### Adscenter 服务
- [ ] Health check
- [ ] POST /api/v1/adscenter/bulk
- [ ] GET /api/v1/adscenter/diagnose

### Siterank 服务
- [ ] Health check
- [ ] POST /api/v1/siterank/evaluate

---

## ⚠️ 注意事项

### 1. 认证
大多数 API 需要认证。需要：
- Supabase JWT token
- 或服务间认证 token

### 2. 数据清理
集成测试可能会创建测试数据，需要：
- 使用测试专用的用户 ID
- 测试后清理数据
- 或使用只读测试

### 3. 速率限制
预发环境可能有速率限制，需要：
- 控制测试频率
- 使用重试机制

### 4. 成本
调用真实服务会产生成本：
- Cloud Run 调用费用
- 数据库查询费用
- 网络传输费用

---

## 💡 建议

### 短期（立即可做）
1. ✅ **Browser-exec**: 已完成真实集成测试
2. 🔄 **其他服务**: 创建 Health check 集成测试
3. 📝 **文档**: 记录如何运行集成测试

### 中期（本周内）
1. 为每个服务创建主要 API 的集成测试
2. 设置 CI/CD 定期运行集成测试
3. 创建测试数据管理策略

### 长期（持续改进）
1. 增加数据库集成测试
2. 增加端到端测试
3. 性能测试和压力测试

---

## 🎯 现实评估

### 单元测试的价值
现有的单元测试虽然使用了 Mock，但它们：
- ✅ 验证了业务逻辑的正确性
- ✅ 快速反馈（秒级）
- ✅ 易于调试和维护
- ✅ 不依赖外部环境
- ✅ 可以在任何地方运行

### 集成测试的价值
真正的集成测试：
- ✅ 验证服务间的集成
- ✅ 发现环境配置问题
- ✅ 验证真实的数据库操作
- ⚠️ 但速度慢（秒到分钟级）
- ⚠️ 依赖外部环境
- ⚠️ 需要更多维护

### 推荐的测试金字塔
```
        /\
       /E2E\      10% - 端到端测试
      /------\
     /集成测试\    20% - 集成测试
    /----------\
   /  单元测试  \  70% - 单元测试
  /--------------\
```

---

## 📊 下一步行动

### 选项 1: 快速验证（推荐）
为每个服务创建简单的 Health check 集成测试，验证服务可访问性。

**预计时间**: 1-2 小时

### 选项 2: 完整集成测试
为每个服务创建完整的 API 集成测试，包括认证和数据操作。

**预计时间**: 8-12 小时

### 选项 3: 混合策略
- 保留现有单元测试（70%）
- 添加关键路径的集成测试（20%）
- 添加少量端到端测试（10%）

**预计时间**: 4-6 小时

---

**文档创建时间**: 2025-10-08  
**状态**: 计划中  
**建议**: 选项 1 或选项 3
