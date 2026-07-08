# Token Rules Integration Guide

**日期**: 2025-10-07
**状态**: Implementation Guide
**优先级**: P0

---

## 📋 概述

本文档说明如何在各服务中集成 Token Rules 自动扣费功能。

### 已完成组件

✅ **Token 扣费基础设施**:
1. `pkg/billing/token_client.go` - 通用 Token 客户端
2. `services/billing/internal/handlers/token_reservation.go` - Token 预扣/确认端点
3. Billing 服务新增 5 个端点

### 待集成服务

⏸️ **需要集成的服务**:
1. Offer 服务 - `create_offer` 操作
2. Siterank 服务 - `rank_check` 操作
3. Adscenter 服务 - `create_campaign` 操作

---

## 🏗️ 架构设计

### Token 扣费流程

```
1. 用户请求 → Service API (e.g., POST /api/v1/offers)
   ↓
2. Token 中间件检查规则
   ├─ 查询 token_rules 表
   ├─ 检查用户余额
   ↓
3. 预扣 Token (Reserve)
   ├─ 调用 Billing API: POST /api/v1/users/{userId}/tokens/reserve
   ├─ 返回 reservationID
   ↓
4. 执行业务逻辑
   ├─ 创建 Offer / 检查 Siterank / 创建 Campaign
   ↓
5. 根据结果确认或释放
   ├─ 成功 → POST /api/v1/tokens/reservations/{reservationId}/consume
   └─ 失败 → POST /api/v1/tokens/reservations/{reservationId}/release
```

### Token 扣费保证

- **原子性**: 使用预扣机制（2-phase commit）
- **一致性**: 业务失败自动释放 Token
- **隔离性**: 预扣期间 Token 不可用
- **持久性**: 所有操作记录到 TokenTransaction 表

---

## 🔧 实施方案

### 方案 1: 使用 Token 中间件 (推荐)

**优点**:
- 自动化，无需手动编码
- 统一处理，减少错误
- 易于维护

**缺点**:
- 需要重构现有 handler

**实现步骤**:

#### Step 1: 导入 Token 客户端

```go
import (
    "github.com/xxrenzhe/autoads/pkg/billing"
)
```

#### Step 2: 初始化 Token 中间件

```go
// 在 main.go 或 handler.go 中
billingURL := os.Getenv("BILLING_SERVICE_URL")
if billingURL == "" {
    billingURL = "http://billing:8080"
}

tokenMiddleware := billing.NewTokenMiddleware(billingURL, "offer")
```

#### Step 3: 应用中间件到端点

```go
// 在 RegisterRoutes 中
mux.Handle("/api/v1/offers",
    authMiddleware(
        tokenMiddleware.ChargeTokens("create_offer",
            http.HandlerFunc(h.createOffer)
        )
    )
)
```

**完整示例** (Offer 服务):

```go
// services/offer/main.go

import (
    "github.com/xxrenzhe/autoads/pkg/billing"
    "github.com/xxrenzhe/autoads/pkg/middleware"
)

func main() {
    // ... 数据库初始化 ...

    handler := handlers.NewHandler(db)

    // 初始化 Token 中间件
    billingURL := os.Getenv("BILLING_SERVICE_URL")
    if billingURL == "" {
        billingURL = "http://billing:8080"
    }
    tokenMw := billing.NewTokenMiddleware(billingURL, "offer")

    // 注册路由
    mux := http.NewServeMux()
    authMw := middleware.AuthMiddleware

    // 应用 Token 扣费中间件
    mux.Handle("/api/v1/offers",
        authMw(
            tokenMw.ChargeTokens("create_offer",
                http.HandlerFunc(handler.createOffer)
            )
        )
    )

    // 其他路由...
    http.ListenAndServe(":8080", mux)
}
```

---

### 方案 2: 手动集成 (细粒度控制)

**优点**:
- 完全控制扣费逻辑
- 可自定义错误处理
- 适合复杂业务流程

**缺点**:
- 代码重复
- 容易出错

**实现步骤**:

#### Step 1: 创建 Token 客户端实例

```go
// 在 Handler struct 中添加
type Handler struct {
    DB          *pgxpool.Pool
    TokenClient *billing.TokenClient
}

func NewHandler(db *pgxpool.Pool, billingURL string) *Handler {
    return &Handler{
        DB:          db,
        TokenClient: billing.NewTokenClient(billingURL),
    }
}
```

#### Step 2: 在业务逻辑中集成

```go
func (h *Handler) createOffer(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    userID := getUserIDFromContext(ctx)

    // ... 参数验证 ...

    // 1. 获取 Token 规则
    rule, err := h.TokenClient.GetTokenRule(ctx, "offer", "create_offer")
    if err != nil {
        // 规则不存在，继续执行（向后兼容）
        if strings.Contains(err.Error(), "not found") {
            // 继续原有逻辑
            h.createOfferLogic(w, r, req)
            return
        }
        http.Error(w, "Failed to get token rule", 500)
        return
    }

    // 2. 检查余额
    balance, err := h.TokenClient.GetUserBalance(ctx, userID)
    if err != nil {
        http.Error(w, "Failed to check balance", 500)
        return
    }

    if balance.Available < rule.CostPerUnit {
        http.Error(w, "Insufficient tokens", 402)
        return
    }

    // 3. 预扣 Token
    reservation, err := h.TokenClient.ReserveTokens(ctx, userID, rule.CostPerUnit, "Create offer")
    if err != nil {
        if err == billing.ErrInsufficientTokens {
            http.Error(w, "Insufficient tokens", 402)
            return
        }
        http.Error(w, "Failed to reserve tokens", 500)
        return
    }

    // 4. 执行业务逻辑
    offer, err := h.createOfferLogic(ctx, userID, req)
    if err != nil {
        // 业务失败，释放 Token
        go h.TokenClient.ReleaseReservation(context.Background(), reservation.ReservationID)
        http.Error(w, err.Error(), 500)
        return
    }

    // 5. 业务成功，确认扣费
    go h.TokenClient.ConsumeReservation(context.Background(), reservation.ReservationID)

    // 返回结果
    writeJSON(w, http.StatusCreated, offer)
}

// 业务逻辑提取为独立函数
func (h *Handler) createOfferLogic(ctx context.Context, userID string, req CreateOfferRequest) (*Offer, error) {
    // 原有的创建 Offer 逻辑
    // ...
    return offer, nil
}
```

---

## 📝 各服务集成清单

### 1. Offer 服务

**文件**: `services/offer/internal/handlers/http.go`

**需要集成的端点**:
- `POST /api/v1/offers` - 创建 Offer
- Token Rule: `service='offer', action='create_offer', cost=10`

**当前代码位置**: `http.go:1290` (`func createOffer`)

**集成代码** (方案 1 - 中间件):

```go
// services/offer/main.go
func main() {
    // ... (database setup) ...

    handler := handlers.NewHandler(db)

    // Token middleware setup
    billingURL := os.Getenv("BILLING_SERVICE_URL")
    tokenMw := billing.NewTokenMiddleware(billingURL, "offer")

    mux := http.NewServeMux()
    authMw := middleware.AuthMiddleware

    // 健康检查（不扣费）
    mux.HandleFunc("/healthz", handler.healthz)

    // Offers 端点（扣费）
    mux.Handle("/api/v1/offers",
        authMw(
            tokenMw.ChargeTokens("create_offer",
                http.HandlerFunc(handler.offersHandler)
            )
        )
    )

    // 其他端点...
    // ...

    log.Println("Offer service listening on :8080")
    http.ListenAndServe(":8080", mux)
}
```

**测试验证**:

```bash
# 1. 查看当前余额
curl -X GET http://billing:8080/api/v1/users/user-123/tokens/balance

# 2. 创建 Offer（会扣除 10 tokens）
curl -X POST http://offer:8080/api/v1/offers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Offer",
    "originalUrl": "https://example.com",
    "country": "US"
  }'

# 3. 验证扣费
curl -X GET http://billing:8080/api/v1/users/user-123/tokens/balance
# Available 应该减少 10

# 4. 查看 Token 交易记录
curl -X GET http://billing:8080/api/v1/billing/tokens/transactions \
  -H "Authorization: Bearer $TOKEN"
```

---

### 2. Siterank 服务

**文件**: `services/siterank/internal/handlers/http.go`

**需要集成的端点**:
- `POST /api/v1/siterank/check` - 检查单个域名
- `POST /api/v1/siterank/batch` - 批量检查
- Token Rule: `service='siterank', action='rank_check', cost=1`

**集成代码**:

```go
// services/siterank/main.go
func main() {
    // ... setup ...

    billingURL := os.Getenv("BILLING_SERVICE_URL")
    tokenMw := billing.NewTokenMiddleware(billingURL, "siterank")

    mux := http.NewServeMux()
    authMw := middleware.AuthMiddleware

    // 单个检查（扣 1 token）
    mux.Handle("/api/v1/siterank/check",
        authMw(
            tokenMw.ChargeTokens("rank_check",
                http.HandlerFunc(handler.checkDomain)
            )
        )
    )

    // 批量检查（需要特殊处理）
    // 方案 A: 按数量扣费（如 10 个域名 = 10 tokens）
    // 方案 B: 使用批量规则（batch_check = 50 tokens for up to 100 domains）
    mux.Handle("/api/v1/siterank/batch",
        authMw(
            http.HandlerFunc(handler.batchCheckWithTokens)
        )
    )

    http.ListenAndServe(":8080", mux)
}

// 批量检查的手动集成示例
func (h *Handler) batchCheckWithTokens(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    userID := getUserIDFromContext(ctx)

    var req struct {
        Domains []string `json:"domains"`
    }
    json.NewDecoder(r.Body).Decode(&req)

    // 根据域名数量计算 cost
    domainCount := len(req.Domains)
    cost := domainCount // 1 token per domain

    // 或者使用批量规则
    if domainCount <= 100 {
        rule, _ := h.TokenClient.GetTokenRule(ctx, "siterank", "batch_check")
        if rule != nil {
            cost = rule.CostPerUnit // 50 tokens
        }
    }

    // 预扣
    reservation, err := h.TokenClient.ReserveTokens(ctx, userID, cost, fmt.Sprintf("Batch check %d domains", domainCount))
    if err != nil {
        http.Error(w, "Insufficient tokens", 402)
        return
    }

    // 执行批量检查
    results, err := h.batchCheckLogic(ctx, req.Domains)
    if err != nil {
        go h.TokenClient.ReleaseReservation(context.Background(), reservation.ReservationID)
        http.Error(w, err.Error(), 500)
        return
    }

    // 确认扣费
    go h.TokenClient.ConsumeReservation(context.Background(), reservation.ReservationID)

    writeJSON(w, http.StatusOK, results)
}
```

---

### 3. Adscenter 服务

**文件**: `services/adscenter/internal/handlers/http.go`

**需要集成的端点**:
- `POST /api/v1/adscenter/campaigns` - 创建广告活动
- `POST /api/v1/adscenter/accounts` - 关联广告账户
- Token Rules:
  - `service='adscenter', action='create_campaign', cost=5`
  - `service='adscenter', action='link_account', cost=3`

**集成代码**:

```go
// services/adscenter/main.go
func main() {
    // ... setup ...

    billingURL := os.Getenv("BILLING_SERVICE_URL")
    tokenMw := billing.NewTokenMiddleware(billingURL, "adscenter")

    mux := http.NewServeMux()
    authMw := middleware.AuthMiddleware

    // 创建 Campaign（扣 5 tokens）
    mux.Handle("/api/v1/adscenter/campaigns",
        authMw(
            tokenMw.ChargeTokens("create_campaign",
                http.HandlerFunc(handler.createCampaign)
            )
        )
    )

    // 关联账户（扣 3 tokens）
    mux.Handle("/api/v1/adscenter/accounts",
        authMw(
            tokenMw.ChargeTokens("link_account",
                http.HandlerFunc(handler.linkAccount)
            )
        )
    )

    http.ListenAndServe(":8080", mux)
}
```

---

## 🧪 测试指南

### 1. 单元测试

```go
// services/offer/internal/handlers/offer_test.go
package handlers

import (
    "testing"
    "net/http/httptest"
    "github.com/xxrenzhe/autoads/pkg/billing"
)

func TestCreateOfferWithTokens(t *testing.T) {
    // Mock Billing service
    mockBilling := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if strings.Contains(r.URL.Path, "/reserve") {
            w.WriteHeader(http.StatusCreated)
            json.NewEncoder(w).Encode(map[string]interface{}{
                "reservationId": "res-123",
                "amount": 10,
            })
            return
        }
        // ... other mocks ...
    }))
    defer mockBilling.Close()

    // Test handler
    handler := NewHandler(db, mockBilling.URL)

    req := httptest.NewRequest("POST", "/api/v1/offers", body)
    rr := httptest.NewRecorder()

    handler.createOffer(rr, req)

    // Assertions
    assert.Equal(t, http.StatusCreated, rr.Code)
}
```

### 2. 集成测试

```bash
#!/bin/bash
# test_token_integration.sh

# 1. 设置测试用户
USER_ID="test-user-123"
BILLING_URL="http://localhost:8080"
OFFER_URL="http://localhost:8081"

# 2. 给用户充值 Token
curl -X POST "$BILLING_URL/api/v1/users/$USER_ID/tokens/topup" \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "reason": "Test topup"}'

# 3. 查看余额
BALANCE=$(curl -s "$BILLING_URL/api/v1/users/$USER_ID/tokens/balance" | jq .available)
echo "Initial balance: $BALANCE"

# 4. 创建 Offer（应扣除 10 tokens）
curl -X POST "$OFFER_URL/api/v1/offers" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Offer",
    "originalUrl": "https://example.com",
    "country": "US"
  }'

# 5. 验证余额减少
NEW_BALANCE=$(curl -s "$BILLING_URL/api/v1/users/$USER_ID/tokens/balance" | jq .available)
echo "New balance: $NEW_BALANCE"

EXPECTED=$((BALANCE - 10))
if [ "$NEW_BALANCE" -eq "$EXPECTED" ]; then
    echo "✅ Token deduction successful!"
else
    echo "❌ Token deduction failed. Expected $EXPECTED, got $NEW_BALANCE"
    exit 1
fi
```

### 3. 负面测试（余额不足）

```bash
# 1. 创建用户，余额为 5
curl -X POST "$BILLING_URL/api/v1/users/$USER_ID/tokens/topup" \
  -d '{"amount": 5}'

# 2. 尝试创建 Offer（需要 10 tokens）
RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/response.json \
  -X POST "$OFFER_URL/api/v1/offers" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{"name": "Test", "originalUrl": "https://example.com", "country": "US"}')

# 3. 验证返回 402 Payment Required
if [ "$RESPONSE" -eq 402 ]; then
    echo "✅ Insufficient tokens error handled correctly!"
else
    echo "❌ Expected 402, got $RESPONSE"
    exit 1
fi

# 4. 验证余额未变化（预扣失败）
BALANCE_AFTER=$(curl -s "$BILLING_URL/api/v1/users/$USER_ID/tokens/balance" | jq .available)
if [ "$BALANCE_AFTER" -eq 5 ]; then
    echo "✅ Balance unchanged after failed reservation!"
else
    echo "❌ Balance incorrectly changed"
    exit 1
fi
```

---

## 📊 监控和日志

### 1. Token 扣费日志

在 Token 中间件中添加日志：

```go
func (tm *TokenMiddleware) ChargeTokens(actionType string, next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // ... (扣费逻辑) ...

        // 记录扣费日志
        log.Printf("[TOKEN] user=%s service=%s action=%s cost=%d reservation=%s",
            userID, tm.ServiceName, actionType, rule.CostPerUnit, reservation.ReservationID)

        next.ServeHTTP(rw, r)

        if rw.statusCode >= 200 && rw.statusCode < 300 {
            log.Printf("[TOKEN] consumed: user=%s reservation=%s", userID, reservation.ReservationID)
        } else {
            log.Printf("[TOKEN] released: user=%s reservation=%s status=%d", userID, reservation.ReservationID, rw.statusCode)
        }
    })
}
```

### 2. Prometheus Metrics

```go
import "github.com/prometheus/client_golang/prometheus"

var (
    tokenReservations = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "token_reservations_total",
            Help: "Total number of token reservations",
        },
        []string{"service", "action", "status"},
    )

    tokenConsumptions = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "token_consumptions_total",
            Help: "Total number of token consumptions",
        },
        []string{"service", "action"},
    )
)

func init() {
    prometheus.MustRegister(tokenReservations)
    prometheus.MustRegister(tokenConsumptions)
}

// 在中间件中记录指标
tokenReservations.WithLabelValues(tm.ServiceName, actionType, "success").Inc()
```

---

## 🚀 部署清单

### 1. 环境变量配置

**所有服务需要添加**:

```yaml
# services/offer/cloudbuild.yaml
env:
  - name: BILLING_SERVICE_URL
    value: "http://billing:8080"

# services/siterank/cloudbuild.yaml
env:
  - name: BILLING_SERVICE_URL
    value: "http://billing:8080"

# services/adscenter/cloudbuild.yaml
env:
  - name: BILLING_SERVICE_URL
    value: "http://billing:8080"
```

### 2. 数据库迁移

确保已执行 Token Rules 迁移：

```bash
cd services/billing
./scripts/migrate.sh up
```

验证 token_rules 表存在并有数据：

```sql
SELECT * FROM token_rules WHERE active = true;
```

### 3. 部署顺序

1. **Billing 服务** (先部署，提供 Token API)
2. **Offer 服务** (依赖 Billing)
3. **Siterank 服务** (依赖 Billing)
4. **Adscenter 服务** (依赖 Billing)

### 4. 健康检查

部署后验证：

```bash
# 1. Billing Token API 可用
curl http://billing:8080/api/v1/users/test/tokens/balance

# 2. Offer 服务可以创建（但会提示余额不足）
curl -X POST http://offer:8080/api/v1/offers \
  -H "Authorization: Bearer $TOKEN" \
  -d '{...}'
# 期望: 402 Payment Required

# 3. 充值后可以成功创建
curl -X POST http://billing:8080/api/v1/users/test/tokens/topup \
  -d '{"amount": 100}'

curl -X POST http://offer:8080/api/v1/offers \
  -H "Authorization: Bearer $TOKEN" \
  -d '{...}'
# 期望: 201 Created
```

---

## 📋 实施检查清单

### Offer 服务
- [ ] 导入 `pkg/billing` 包
- [ ] 初始化 Token 中间件
- [ ] 应用到 `/api/v1/offers` POST 端点
- [ ] 添加 `BILLING_SERVICE_URL` 环境变量
- [ ] 编写集成测试
- [ ] 部署验证

### Siterank 服务
- [ ] 导入 `pkg/billing` 包
- [ ] 初始化 Token 中间件
- [ ] 应用到检查端点
- [ ] 特殊处理批量检查
- [ ] 添加环境变量
- [ ] 测试验证
- [ ] 部署

### Adscenter 服务
- [ ] 导入 `pkg/billing` 包
- [ ] 初始化 Token 中间件
- [ ] 应用到 Campaign 和 Account 端点
- [ ] 添加环境变量
- [ ] 测试验证
- [ ] 部署

### 监控和文档
- [ ] 添加 Token 扣费日志
- [ ] 配置 Prometheus metrics
- [ ] 创建 Grafana 仪表板
- [ ] 更新 OpenAPI 文档
- [ ] 编写用户文档

---

## 🎯 预期成果

完成集成后：

1. **自动扣费**: 用户创建 Offer/检查 Siterank/创建 Campaign 自动扣除 Token
2. **余额保护**: Token 不足时返回 402 错误，阻止操作
3. **审计追踪**: 所有扣费记录在 TokenTransaction 表
4. **可管理**: 管理员可通过 Console 调整 Token Rules
5. **向后兼容**: 规则不存在时不影响原有功能

---

**总结**: 本文档提供了完整的 Token Rules 集成指南，包括两种实施方案、各服务的具体代码示例、测试方法和部署清单。建议优先使用方案 1（中间件方式）以减少代码重复和维护成本。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
