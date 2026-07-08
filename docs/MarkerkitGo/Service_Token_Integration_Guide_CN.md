# 服务 Token 集成指南

## 概述

本文档说明如何将各个微服务与 Billing 服务集成，实现 Token 扣费功能和服务级别的使用跟踪。

**日期**: 2025-10-07
**版本**: 1.0

---

## 快速开始

### 1. 添加 Billing 客户端依赖

Billing 客户端已经创建在 `pkg/billing/client.go`，所有服务可以直接使用。

### 2. 集成步骤（3 步完成）

#### 步骤 1: 在 main.go 中初始化客户端

```go
import "github.com/xxrenzhe/autoads/pkg/billing"

// 在 main 函数中
billingClient := billing.NewClientFromEnv()
```

#### 步骤 2: 将客户端传递给 Handler

```go
// 在 Handler 结构体中添加字段
type Handler struct {
    DB            *sql.DB
    BillingClient *billing.Client
}

// 在 main.go 中设置
h := handlers.NewHandler(db, publisher)
h.BillingClient = billingClient
```

#### 步骤 3: 在业务逻辑中调用扣费

```go
// 在需要扣费的地方
if h.BillingClient != nil {
    _, err := h.BillingClient.ConsumeTokens(r.Context(), userID, billing.ConsumeTokensRequest{
        Amount:  10,
        Service: "offer",           // 服务名称
        Action:  "create_offer",    // 操作类型
        Reason:  "Create offer: XXX",
    })
    if err != nil {
        if billing.IsInsufficientTokens(err) {
            // 处理余额不足错误
            errors.Write(w, r, http.StatusPaymentRequired, "INSUFFICIENT_TOKENS",
                "Insufficient tokens", map[string]string{"error": err.Error()})
            return
        }
        log.Printf("Token charging failed: %v", err)
        // 根据业务需求决定是否继续
    }
}
```

---

## Offer 服务集成示例

### 文件修改清单

1. ✅ `services/offer/main.go` - 添加客户端初始化
2. ✅ `services/offer/internal/handlers/http.go` - 添加 Token 扣费逻辑
3. ✅ `services/billing/internal/domain/plans.go` - 添加 Offer 服务的 Token 规则

### 代码变更详情

#### 1. main.go 变更

```go
import (
    "github.com/xxrenzhe/autoads/pkg/billing"
)

func main() {
    // ... 现有代码 ...

    // 初始化 Billing 客户端
    billingClient := billing.NewClientFromEnv()

    h := handlers.NewHandler(db, &events.LoggingMiddleware{Next: publisherPub})
    h.BillingClient = billingClient

    // ... 其余代码 ...
}
```

#### 2. http.go Handler 结构体变更

```go
import "github.com/xxrenzhe/autoads/pkg/billing"

type Handler struct {
    DB            *sql.DB
    Publisher     events.Publisher
    BillingClient *billing.Client  // 新增
}
```

#### 3. createOffer 函数变更

```go
func (h *Handler) createOffer(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(string)
    // ... 验证和解析请求 ...

    // Token 扣费: 创建 Offer 需要消耗 10 个 Token
    if h.BillingClient != nil {
        _, err := h.BillingClient.ConsumeTokens(r.Context(), userID, billing.ConsumeTokensRequest{
            Amount:  10, // OfferCreateCost from billing domain
            Service: "offer",
            Action:  "create_offer",
            Reason:  fmt.Sprintf("Create offer: %s", req.Name),
        })
        if err != nil {
            if billing.IsInsufficientTokens(err) {
                errors.Write(w, r, http.StatusPaymentRequired, "INSUFFICIENT_TOKENS",
                    "Insufficient tokens to create offer", map[string]string{"error": err.Error()})
                return
            }
            log.Printf("Failed to charge tokens for offer creation: %v", err)
        }
    }

    // ... 继续创建 Offer 的业务逻辑 ...
}
```

---

## Token 消耗规则

### 当前定义（`services/billing/internal/domain/plans.go`）

```go
const (
    // Siterank service
    SiterankCachedQueryCost    = 1
    SiterankRealtimeQueryCost  = 5
    SiterankAIEvaluationCost   = 10

    // Batchopen service
    BatchopenHTTPCost          = 1
    BatchopenPuppeteerCost     = 2

    // Adscenter service
    AdscenterAIComplianceCost  = 25

    // Offer service
    OfferCreateCost            = 10  // 创建新 Offer
    OfferEvaluationCost        = 15  // AI 评估 Offer

    // Workflow service
    WorkflowStartCost          = 5

    // Rewards
    OnboardingStepReward       = 200
    DailyCheckInReward         = 10
)
```

---

## 环境变量配置

### Billing 客户端配置

在服务的部署配置中添加以下环境变量：

```yaml
# Cloud Run 部署示例
env:
  - name: BILLING_SERVICE_URL
    value: "http://billing:8080"
  - name: SERVICE_TOKEN
    valueFrom:
      secretKeyRef:
        name: service-tokens
        key: service-token
```

### 说明

- `BILLING_SERVICE_URL`: Billing 服务的内部地址
  - 默认值: `http://billing:8080`
  - 在 Kubernetes/Cloud Run 中通常使用服务名

- `SERVICE_TOKEN`: 服务间认证 Token
  - 用于服务间 API 调用的身份验证
  - 通过 `X-Service-Token` header 传递

---

## Siterank 服务集成（待实现）

### 需要集成的操作

1. **缓存查询** - `SiterankCachedQueryCost = 1`
   - 文件: `services/siterank/internal/handlers/http.go`
   - 函数: 查询缓存结果的端点

2. **实时查询** - `SiterankRealtimeQueryCost = 5`
   - 文件: `services/siterank/internal/handlers/http.go`
   - 函数: 执行实时排名检查的端点

3. **AI 评估** - `SiterankAIEvaluationCost = 10`
   - 文件: `services/siterank/internal/handlers/http.go`
   - 函数: AI 评分端点

### 集成模板

```go
// 在 Siterank Handler 中
if h.BillingClient != nil {
    _, err := h.BillingClient.ConsumeTokens(r.Context(), userID, billing.ConsumeTokensRequest{
        Amount:  1, // 或 5, 10 取决于操作类型
        Service: "siterank",
        Action:  "cached_query", // 或 "realtime_query", "ai_evaluation"
        Reason:  fmt.Sprintf("Siterank check for: %s", domain),
    })
    if err != nil {
        if billing.IsInsufficientTokens(err) {
            // 返回 402 Payment Required
        }
        log.Printf("Token charging failed: %v", err)
    }
}
```

---

## Adscenter 服务集成（待实现）

### 需要集成的操作

1. **AI 合规检查** - `AdscenterAIComplianceCost = 25`
   - 文件: `services/adscenter/internal/handlers/http.go`
   - 函数: 广告合规性检查端点

### 集成模板

```go
// 在 Adscenter Handler 中
if h.BillingClient != nil {
    _, err := h.BillingClient.ConsumeTokens(r.Context(), userID, billing.ConsumeTokensRequest{
        Amount:  25,
        Service: "adscenter",
        Action:  "ai_compliance_check",
        Reason:  fmt.Sprintf("Compliance check for ad: %s", adID),
    })
    if err != nil {
        if billing.IsInsufficientTokens(err) {
            errors.Write(w, r, http.StatusPaymentRequired, "INSUFFICIENT_TOKENS",
                "Insufficient tokens for compliance check", nil)
            return
        }
        log.Printf("Token charging failed: %v", err)
    }
}
```

---

## 错误处理

### 1. 余额不足错误

```go
if billing.IsInsufficientTokens(err) {
    // 返回 402 Payment Required 状态码
    errors.Write(w, r, http.StatusPaymentRequired, "INSUFFICIENT_TOKENS",
        "You don't have enough tokens to perform this action",
        map[string]string{
            "required": "10",
            "error": err.Error(),
        })
    return
}
```

### 2. Billing 服务不可用

```go
if err != nil && !billing.IsInsufficientTokens(err) {
    // 记录错误但不阻止业务（可选）
    log.Printf("Token charging failed: %v", err)

    // 或者返回 503 Service Unavailable（推荐）
    errors.Write(w, r, http.StatusServiceUnavailable, "BILLING_UNAVAILABLE",
        "Token billing service temporarily unavailable", nil)
    return
}
```

### 3. 优雅降级

对于非关键路径，可以选择在 Billing 服务不可用时继续处理：

```go
if h.BillingClient != nil {
    _, err := h.BillingClient.ConsumeTokens(...)
    if err != nil {
        log.Printf("Token charging failed (non-critical): %v", err)
        // 继续处理业务逻辑
    }
}
```

---

## 测试

### 单元测试

```go
func TestCreateOffer_InsufficientTokens(t *testing.T) {
    // Mock BillingClient 返回余额不足错误
    mockClient := &mockBillingClient{
        consumeFunc: func(ctx context.Context, userID string, req billing.ConsumeTokensRequest) (*billing.ConsumeTokensResponse, error) {
            return nil, &billing.InsufficientTokensError{
                Message: "Insufficient tokens",
                Details: map[string]interface{}{
                    "required": 10,
                    "available": 5,
                },
            }
        },
    }

    handler := &Handler{
        DB:            db,
        BillingClient: mockClient,
    }

    // 发送创建 Offer 请求
    resp := httptest.NewRecorder()
    req := httptest.NewRequest("POST", "/api/v1/offers", body)

    handler.createOffer(resp, req)

    // 验证返回 402 Payment Required
    assert.Equal(t, http.StatusPaymentRequired, resp.Code)
}
```

### 集成测试

```bash
# 1. 创建测试用户并充值 Token
curl -X POST http://localhost:8080/api/v1/tokens/test-user/topup \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "description": "Test topup"}'

# 2. 调用需要 Token 的服务
curl -X POST http://localhost:8081/api/v1/offers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Test Offer", "originalUrl": "https://example.com"}'

# 3. 验证 Token 被正确扣除
curl http://localhost:8080/api/v1/tokens/test-user/balance

# 4. 检查服务级别的使用统计
curl "http://localhost:8080/api/v1/tokens/test-user/usage?startDate=2025-01-01T00:00:00Z&endDate=2025-12-31T23:59:59Z"
```

---

## 监控和日志

### 日志记录

每个服务应记录 Token 扣费事件：

```go
log.Printf("[Token] User=%s Service=%s Action=%s Amount=%d Status=%s",
    userID, "offer", "create_offer", 10, "success")
```

### 监控指标

建议添加以下 Prometheus 指标：

```go
var (
    tokenChargeTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "token_charge_total",
            Help: "Total number of token charges",
        },
        []string{"service", "action", "status"},
    )

    tokenChargeAmount = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "token_charge_amount",
            Help: "Amount of tokens charged",
            Buckets: []float64{1, 5, 10, 25, 50, 100},
        },
        []string{"service", "action"},
    )
)
```

---

## 部署清单

### 1. Offer 服务 (✅ 已完成)

- [x] 添加 Billing 客户端初始化
- [x] 在 createOffer 中添加 Token 扣费
- [x] 添加 Token 消耗规则定义
- [x] 更新环境变量配置
- [ ] 部署到开发环境测试
- [ ] 部署到生产环境

### 2. Siterank 服务 (⏸️ 待实现)

- [ ] 添加 Billing 客户端初始化
- [ ] 在查询端点添加 Token 扣费
- [ ] 区分缓存/实时/AI 查询的不同费用
- [ ] 更新环境变量配置
- [ ] 测试和部署

### 3. Adscenter 服务 (⏸️ 待实现)

- [ ] 添加 Billing 客户端初始化
- [ ] 在 AI 合规检查端点添加 Token 扣费
- [ ] 更新环境变量配置
- [ ] 测试和部署

---

## 常见问题

### Q1: Billing 服务不可用时会怎样？

**A**: 取决于你的错误处理策略：
- **严格模式**: 返回 503 错误，阻止操作
- **宽松模式**: 记录错误日志，继续处理业务（不推荐用于生产）

### Q2: 如何避免重复扣费？

**A**: Billing 服务支持幂等性：
```go
// 使用 X-Idempotency-Key header
req.Header.Set("X-Idempotency-Key", "offer-"+offerID)
```

### Q3: 如何处理部分失败的场景？

**A**: 使用 Reserve-Consume 两阶段模式：
```go
// 1. Reserve tokens
reservation, err := client.ReserveTokens(...)

// 2. 执行业务逻辑
result, err := businessLogic()

// 3a. 成功 - Consume reservation
if err == nil {
    client.ConsumeReservation(reservation.ID)
}

// 3b. 失败 - Release reservation
if err != nil {
    client.ReleaseReservation(reservation.ID)
}
```

### Q4: 如何测试 Token 集成？

**A**: 参考上面的"测试"章节，使用：
- 单元测试: Mock BillingClient
- 集成测试: 使用真实的 Billing 服务
- 端到端测试: 完整用户流程

---

## 下一步

1. ✅ **Offer 服务集成** - 已完成
2. ⏸️ **Siterank 服务集成** - 进行中
3. ⏸️ **Adscenter 服务集成** - 待开始
4. ⏸️ **端到端测试** - 待开始
5. ⏸️ **生产环境部署** - 待开始

---

**文档版本**: 1.0
**最后更新**: 2025-10-07
**状态**: Offer 服务集成完成，其他服务待集成
