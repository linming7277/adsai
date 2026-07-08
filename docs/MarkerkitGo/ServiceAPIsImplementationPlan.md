# 各服务管理 API 补充实施计划

**日期**: 2025-10-06
**目标**: 为 Console BFF 提供完整的管理 API
**前置条件**: Console 服务端点设计已确认 (37个端点)

---

## 一、实施优先级

### 优先级分类

**P0 - 核心功能** (1周内完成):
- Billing 服务：用户管理、Token 管理 API
- Offer 服务：批量操作 API

**P1 - 重要功能** (2周内完成):
- Billing 服务：套餐管理、报表 API
- Offer 服务：报表 API

**P2 - 增强功能** (3周内完成):
- Auth 服务：API Keys 管理 (或 Console 自己实现)
- 各服务：配置管理 API

---

## 二、Console 服务 Supabase 集成

### 2.1 为什么 Console 直接调用 Supabase？

**架构决策**：
- ✅ **职责清晰**：Billing 只管计费，Supabase 只管认证
- ✅ **减少耦合**：Console 已经是聚合层，不需要 Billing 做二次代理
- ✅ **简化架构**：Console 直接调用第三方 API (类似 Stripe、SendGrid)

**对比方案**：
```
❌ 之前：Console → Billing (封装 Supabase) → Supabase Auth
✅ 现在：Console → Supabase Auth (直接调用)
        Console → Billing API (业务数据)
```

### 2.2 Console Supabase 集成 (P0) - 新增

**实现文件**：
```
services/console/
  internal/
    supabase/
      client.go          # Supabase Admin API 客户端
      auth.go            # Auth 操作封装
    handlers/
      users.go           # 用户管理端点（聚合 Supabase + Billing）
```

**用户管理端点** (Console 实现):

```go
// GET /api/v1/admin/users - 获取用户列表（聚合 Supabase + Billing）
func (h *Handler) GetUsers(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. 从 Supabase 获取用户认证信息
    supabaseUsers, err := h.supabaseClient.ListUsers(ctx, page, perPage)

    // 2. 并发获取每个用户的业务数据
    var wg sync.WaitGroup
    users := make([]AdminUser, len(supabaseUsers))

    for i, su := range supabaseUsers {
        wg.Add(1)
        go func(idx int, authUser SupabaseUser) {
            defer wg.Done()

            // 从 Billing 获取业务数据
            billingInfo, _ := h.billingClient.GetUserBillingInfo(ctx, authUser.ID)

            users[idx] = AdminUser{
                // 认证数据（来自 Supabase）
                ID:        authUser.ID,
                Email:     authUser.Email,
                Role:      authUser.AppMetadata["role"],
                CreatedAt: authUser.CreatedAt,
                // 业务数据（来自 Billing）
                TokenBalance: billingInfo.TokenBalance,
                PlanID:       billingInfo.PlanID,
            }
        }(i, su)
    }

    wg.Wait()

    writeJSON(w, http.StatusOK, users)
}

// POST /api/v1/admin/users/{userId}/role - 更新用户角色
func (h *Handler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
    userID := r.PathValue("userId")
    var req UpdateUserRoleRequest
    json.NewDecoder(r.Body).Decode(&req)

    // 直接调用 Supabase 更新 app_metadata
    err := h.supabaseClient.UpdateUserMetadata(ctx, userID, map[string]interface{}{
        "role": req.Role,
    })

    writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

// DELETE /api/v1/admin/users/{userId} - 删除用户（编排多个服务）
func (h *Handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
    userID := r.PathValue("userId")

    // 1. 归档 Billing 数据
    _ = h.billingClient.ArchiveUser(ctx, userID)

    // 2. 归档 Offer 数据
    _ = h.offerClient.ArchiveUserOffers(ctx, userID)

    // 3. 从 Supabase 删除用户
    err := h.supabaseClient.DeleteUser(ctx, userID)

    writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
```

**Supabase Admin API 客户端**：
```go
// services/console/internal/supabase/client.go
package supabase

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type AdminClient struct {
    projectURL string
    serviceKey string
    httpClient *http.Client
}

func NewAdminClient(projectURL, serviceKey string) *AdminClient {
    return &AdminClient{
        projectURL: projectURL,
        serviceKey: serviceKey,
        httpClient: &http.Client{Timeout: 10 * time.Second},
    }
}

type SupabaseUser struct {
    ID          string                 `json:"id"`
    Email       string                 `json:"email"`
    AppMetadata map[string]interface{} `json:"app_metadata"`
    CreatedAt   time.Time              `json:"created_at"`
}

// ListUsers 获取用户列表
func (c *AdminClient) ListUsers(ctx context.Context, page, perPage int) ([]SupabaseUser, error) {
    url := fmt.Sprintf("%s/auth/v1/admin/users?page=%d&per_page=%d",
        c.projectURL, page, perPage)

    req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
    req.Header.Set("Authorization", "Bearer "+c.serviceKey)
    req.Header.Set("apikey", c.serviceKey)

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result struct {
        Users []SupabaseUser `json:"users"`
    }
    json.NewDecoder(resp.Body).Decode(&result)

    return result.Users, nil
}

// UpdateUserMetadata 更新用户元数据 (如 role)
func (c *AdminClient) UpdateUserMetadata(ctx context.Context, userID string, metadata map[string]interface{}) error {
    url := fmt.Sprintf("%s/auth/v1/admin/users/%s", c.projectURL, userID)

    payload := map[string]interface{}{
        "app_metadata": metadata,
    }

    body, _ := json.Marshal(payload)
    req, _ := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewReader(body))
    req.Header.Set("Authorization", "Bearer "+c.serviceKey)
    req.Header.Set("apikey", c.serviceKey)
    req.Header.Set("Content-Type", "application/json")

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("failed to update user metadata: %d", resp.StatusCode)
    }

    return nil
}

// DeleteUser 删除用户
func (c *AdminClient) DeleteUser(ctx context.Context, userID string) error {
    url := fmt.Sprintf("%s/auth/v1/admin/users/%s", c.projectURL, userID)

    req, _ := http.NewRequestWithContext(ctx, "DELETE", url, nil)
    req.Header.Set("Authorization", "Bearer "+c.serviceKey)
    req.Header.Set("apikey", c.serviceKey)

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("failed to delete user: %d", resp.StatusCode)
    }

    return nil
}
```

**环境变量**：
```yaml
# services/console/cloudbuild.yaml 或 .env
- name: SUPABASE_URL
  value: "https://xxx.supabase.co"
- name: SUPABASE_SERVICE_KEY
  valueFrom:
    secretKeyRef:
      name: supabase-service-key
      key: key
```

---

## 三、Billing 服务 API 补充

### 3.1 用户业务数据 API (P0) - 3个端点

**职责调整**：
- ❌ 不再管理用户认证（Supabase 负责）
- ✅ 只提供用户的业务数据（Token、订阅、活动日志）

**端点清单**：

```go
// GET /api/v1/users/{userId}/billing-info - 获取用户业务信息
type GetUserBillingInfoResponse struct {
    UserID       string  `json:"userId"`
    TokenBalance int     `json:"tokenBalance"`
    PlanID       string  `json:"planId,omitempty"`
    PlanName     string  `json:"planName,omitempty"`
    Subscription *struct {
        Status    string    `json:"status"` // active, canceled, expired
        ExpiresAt time.Time `json:"expiresAt"`
    } `json:"subscription,omitempty"`
}

// GET /api/v1/users/{userId}/activity - 获取用户活动日志
type GetUserActivityResponse struct {
    Activities []Activity `json:"activities"`
}

type Activity struct {
    ID        string    `json:"id"`
    UserID    string    `json:"userId"`
    Type      string    `json:"type"` // token_topup, token_consume, subscription_created
    Amount    int       `json:"amount,omitempty"`
    Details   string    `json:"details"`
    CreatedAt time.Time `json:"createdAt"`
}

// POST /api/v1/users/{userId}/archive - 归档用户数据
type ArchiveUserRequest struct {
    Reason string `json:"reason"`
}

// 软删除：标记用户数据为 archived，保留历史记录
```

---

### 3.2 套餐管理 API (P1) - 4个端点

**数据模型**：
```sql
-- 新增 plans 表
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL,
    currency TEXT DEFAULT 'USD',
    interval TEXT NOT NULL, -- monthly, yearly
    features JSONB,
    token_quota INT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

**端点清单**：
```go
// GET /api/v1/plans - 套餐列表
type GetPlansResponse struct {
    Items []Plan `json:"items"`
}

type Plan struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Description string                 `json:"description"`
    Price       float64                `json:"price"`
    Currency    string                 `json:"currency"`
    Interval    string                 `json:"interval"` // monthly, yearly
    Features    map[string]interface{} `json:"features"`
    TokenQuota  int                    `json:"tokenQuota"`
    Active      bool                   `json:"active"`
}

// POST /api/v1/plans - 创建套餐
type CreatePlanRequest struct {
    Name        string                 `json:"name"`
    Description string                 `json:"description"`
    Price       float64                `json:"price"`
    Currency    string                 `json:"currency"`
    Interval    string                 `json:"interval"`
    Features    map[string]interface{} `json:"features"`
    TokenQuota  int                    `json:"tokenQuota"`
}

// PUT /api/v1/plans/{planId} - 更新套餐
type UpdatePlanRequest struct {
    Name        *string                 `json:"name,omitempty"`
    Description *string                 `json:"description,omitempty"`
    Price       *float64                `json:"price,omitempty"`
    Features    *map[string]interface{} `json:"features,omitempty"`
    TokenQuota  *int                    `json:"tokenQuota,omitempty"`
    Active      *bool                   `json:"active,omitempty"`
}

// DELETE /api/v1/plans/{planId} - 删除套餐
// 软删除：设置 active = false
```

---

### 3.3 Token 管理 API (P0) - 6个端点

**端点清单**：

```go
// GET /api/v1/tokens/stats - 全局统计
type GetTokenStatsResponse struct {
    TotalTopUp      int64              `json:"totalTopUp"`
    TotalConsumed   int64              `json:"totalConsumed"`
    ActiveUsers     int                `json:"activeUsers"`
    ByService       map[string]int64   `json:"byService"` // service -> consumed
}

// GET /api/v1/tokens/balances - 所有用户余额
type GetAllBalancesResponse struct {
    Items []UserBalance `json:"items"`
}

type UserBalance struct {
    UserID    string `json:"userId"`
    Email     string `json:"email"`
    Available int    `json:"available"`
    Reserved  int    `json:"reserved"`
    Total     int    `json:"total"`
}

// GET /api/v1/tokens/rules - 消耗规则列表
type GetTokenRulesResponse struct {
    Items []TokenRule `json:"items"`
}

type TokenRule struct {
    ID          string `json:"id"`
    Service     string `json:"service"`     // siterank, offer, adscenter
    Action      string `json:"action"`      // check_domain, create_offer
    Cost        int    `json:"cost"`        // token 数量
    Description string `json:"description"`
    Active      bool   `json:"active"`
}

// POST /api/v1/tokens/rules - 创建消耗规则
type CreateTokenRuleRequest struct {
    Service     string `json:"service"`
    Action      string `json:"action"`
    Cost        int    `json:"cost"`
    Description string `json:"description"`
}

// PUT /api/v1/tokens/rules/{ruleId} - 更新消耗规则
type UpdateTokenRuleRequest struct {
    Cost        *int    `json:"cost,omitempty"`
    Description *string `json:"description,omitempty"`
    Active      *bool   `json:"active,omitempty"`
}

// POST /api/v1/tokens/bulk/topup - 批量充值
type BulkTopUpRequest struct {
    TopUps []struct {
        UserID string `json:"userId"`
        Amount int    `json:"amount"`
    } `json:"topUps"`
    Reason string `json:"reason"`
}

type BulkTopUpResponse struct {
    Success []string          `json:"success"` // userIds
    Failed  map[string]string `json:"failed"`  // userId -> error
}
```

**数据模型**：
```sql
-- 新增 token_rules 表
CREATE TABLE IF NOT EXISTS token_rules (
    id TEXT PRIMARY KEY,
    service TEXT NOT NULL,
    action TEXT NOT NULL,
    cost INT NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(service, action)
);

-- 初始数据
INSERT INTO token_rules (id, service, action, cost, description) VALUES
    ('rule_siterank_check', 'siterank', 'check_domain', 1, 'Check single domain rank'),
    ('rule_offer_create', 'offer', 'create_offer', 5, 'Create new offer'),
    ('rule_adscenter_execute', 'adscenter', 'execute_action', 10, 'Execute ad action');
```

---

### 3.4 报表 API (P1) - 2个端点

```go
// GET /api/v1/reports/token-usage
// Query: startDate, endDate, userId (optional)
type GetTokenUsageReportResponse struct {
    Users []UserTokenUsage `json:"users"`
}

type UserTokenUsage struct {
    UserID        string         `json:"userId"`
    Email         string         `json:"email"`
    TotalConsumed int            `json:"totalConsumed"`
    TotalTopUp    int            `json:"totalTopUp"`
    CurrentBalance int           `json:"currentBalance"`
    ByService     map[string]int `json:"byService"`
}

// GET /api/v1/reports/revenue
// Query: startDate, endDate
type GetRevenueReportResponse struct {
    TotalRevenue       float64                `json:"totalRevenue"`
    SubscriptionRevenue float64               `json:"subscriptionRevenue"`
    TokenRevenue       float64                `json:"tokenRevenue"`
    ByPlan            map[string]float64     `json:"byPlan"` // planId -> revenue
}
```

---

## 四、Offer 服务 API 补充

### 4.1 批量操作 API (P0) - 1个端点

```go
// POST /api/v1/offers/bulk/status - 批量更新状态
type BulkUpdateStatusRequest struct {
    OfferIDs []string `json:"offerIds"`
    Status   string   `json:"status"` // active, paused, archived
    Reason   string   `json:"reason"`
}

type BulkUpdateStatusResponse struct {
    Success []string          `json:"success"` // offerIds
    Failed  map[string]string `json:"failed"`  // offerId -> error
}
```

**实现要点**：
- 使用事务保证一致性
- 并发更新 (goroutine + semaphore)
- 发布事件：`EventOfferStatusChanged` (批量)

---

### 4.2 报表 API (P1) - 1个端点

```go
// GET /api/v1/reports/offers
// Query: userId (optional), status, startDate, endDate
type GetOffersReportResponse struct {
    Offers []OfferWithKPI `json:"offers"`
}

type OfferWithKPI struct {
    OfferID        string    `json:"offerId"`
    UserID         string    `json:"userId"`
    Name           string    `json:"name"`
    Status         string    `json:"status"`
    LandingURL     string    `json:"landingUrl"`
    Impressions    int64     `json:"impressions"`
    Clicks         int64     `json:"clicks"`
    Conversions    int64     `json:"conversions"`
    Revenue        float64   `json:"revenue"`
    CTR            float64   `json:"ctr"`
    ConversionRate float64   `json:"conversionRate"`
    CreatedAt      time.Time `json:"createdAt"`
}
```

---

## 五、Auth 服务 (P2 - 可选)

### 5.1 API Keys 管理

**选项 A：独立 Auth 服务**
- 创建新的 `services/auth` 微服务
- 管理 API Keys、JWT、OAuth tokens

**选项 B：Console 自己管理**
- Console 直接操作 `console_config` 表
- 存储加密的 API Keys

**推荐：选项 B**
- API Keys 管理逻辑简单
- 不需要独立服务
- Console 可以直接查询自己的配置表

**数据模型** (Console 自己管理):
```sql
-- services/console 的数据库表
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    user_id TEXT,
    scopes TEXT[], -- ['admin', 'readonly']
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    revoked BOOLEAN DEFAULT false
);
```

---

## 六、配置管理 API (P2 - 可选)

### 6.1 各服务通用配置端点

```go
// GET /api/v1/config - 配置列表
type GetConfigResponse struct {
    Items []ConfigItem `json:"items"`
}

type ConfigItem struct {
    Key         string      `json:"key"`
    Value       interface{} `json:"value"`
    Description string      `json:"description"`
    UpdatedAt   time.Time   `json:"updatedAt"`
}

// GET /api/v1/config/{key} - 获取配置项
// PUT /api/v1/config/{key} - 更新配置项 (热更新)
// GET /api/v1/config/history - 配置变更历史
```

**推荐方案**：
- 使用 **Secret Manager** 存储配置
- 各服务启动时读取配置到内存
- 提供 `/reload-config` 端点手动触发重新加载
- Console 通过 Secret Manager API 读取和更新配置

---

## 七、实施时间线

### Week 1: Console Supabase 集成 + Billing 核心 API (P0)

**Day 1-2: Console Supabase 集成**
- [ ] Console 创建 `internal/supabase/` 包
- [ ] 实现 Supabase Admin API 客户端
- [ ] 实现 5 个用户管理端点（聚合 Supabase + Billing）
- [ ] 单元测试

**Day 3: Billing 用户业务数据 API**
- [ ] 实现 3 个用户业务数据端点
  - `/users/{userId}/billing-info`
  - `/users/{userId}/activity`
  - `/users/{userId}/archive`

**Day 4: Token 管理 API**
- [ ] 创建 token_rules 表
- [ ] 实现 6 个 Token 管理端点
- [ ] 批量充值功能

**Day 5: Offer 批量 API + 集成测试**
- [ ] 实现 Offer 批量状态更新
- [ ] 事务和并发控制

### Week 2: 报表和套餐 (P1)

**Day 1-2: 套餐管理 API**
- [ ] 创建 plans 表
- [ ] 实现 4 个套餐管理端点

**Day 3-4: 报表 API**
- [ ] Billing 报表：Token 使用、收入
- [ ] Offer 报表：Offer + KPI

**Day 5: 集成测试**
- [ ] Console → Billing 集成测试
- [ ] Console → Offer 集成测试

### Week 3: Console 端点实现

**Day 1-2: 用户和套餐管理**
- [ ] Console 用户管理端点 (代理 Billing)
- [ ] Console 套餐管理端点 (代理 Billing)

**Day 3-4: Token 和配置管理**
- [ ] Console Token 管理端点
- [ ] Console 配置管理端点

**Day 5: API Keys 管理**
- [ ] Console API Keys 管理 (自己实现)
- [ ] API Keys 验证中间件

### Week 4: 测试和优化

**Day 1-2: E2E 测试**
- [ ] 管理后台完整流程测试
- [ ] 批量操作性能测试

**Day 3-4: 监控和日志**
- [ ] 管理操作审计日志
- [ ] 管理 API 速率限制

**Day 5: 文档和部署**
- [ ] API 文档更新 (OpenAPI)
- [ ] 生产环境部署

---

## 七、代码结构示例

### Billing 服务

```
services/billing/
  internal/
    supabase/
      client.go           # Supabase Admin API 客户端
      auth.go             # Auth 操作封装
    handlers/
      users.go            # 用户管理端点 (5个)
      plans.go            # 套餐管理端点 (4个)
      tokens_admin.go     # Token 管理端点 (6个)
      reports.go          # 报表端点 (2个)
    models/
      plan.go             # Plan 数据模型
      token_rule.go       # TokenRule 数据模型
  migrations/
    005_plans.up.sql
    006_token_rules.up.sql
```

### Offer 服务

```
services/offer/
  internal/
    handlers/
      bulk.go             # 批量操作端点 (1个)
      reports.go          # 报表端点 (1个)
```

### Console 服务

```
services/console/
  internal/
    clients/
      billing_admin.go    # Billing 管理 API 客户端
      offer_admin.go      # Offer 管理 API 客户端
    handlers/
      users.go            # 用户管理端点 (代理)
      plans.go            # 套餐管理端点 (代理)
      tokens.go           # Token 管理端点 (代理+聚合)
      apikeys.go          # API Keys 管理 (自己实现)
      config.go           # 配置管理端点 (代理)
```

---

## 八、总结

### 8.1 API 补充清单

| 服务 | 新增端点数 | 优先级 | 预计工时 |
|------|-----------|--------|---------|
| **Console** | 5 (用户管理聚合) | P0 | 2天 |
| **Billing** | 14 (去掉用户认证，保留业务) | P0+P1 | 6-7天 |
| **Offer** | 2 | P0+P1 | 2天 |
| **Auth** (可选) | 4 | P2 | 2天 (或0天) |
| **总计** | **21-25** | - | **12-13天** |

### 8.2 关键技术决策

1. **Supabase 集成** ⭐：
   - ✅ **Console 直接调用 Supabase Admin API**（认证操作）
   - ✅ **Billing 只提供业务数据 API**（Token、订阅）
   - ✅ **职责清晰**：认证和计费分离

2. **API Keys 管理**：
   - ✅ Console 自己实现，不创建独立 Auth 服务
   - ✅ 存储在 Console 的数据库表

3. **配置管理**：
   - ✅ 使用 Secret Manager
   - ✅ 各服务提供 `/reload-config` 端点

4. **批量操作**：
   - ✅ 各服务提供批量 API
   - ✅ Console 只负责调用和结果聚合

### 8.3 架构改进总结

**之前的设计问题**：
```
❌ Console → Billing (封装 Supabase) → Supabase Auth
   - Billing 职责混乱（计费 + 认证）
   - 增加了不必要的中间层
   - Billing 与 Supabase 耦合
```

**改进后的架构** ✅：
```
Console → Supabase Admin API (认证)
        → Billing API (业务数据)
        → Offer API
        → ...
```

**优势**：
- ✅ 职责清晰：Billing 专注计费，Supabase 专注认证
- ✅ 减少耦合：Console 已是聚合层，不需要 Billing 二次代理
- ✅ 简化架构：Console 直接调用第三方 API（类似 Stripe、SendGrid）
- ✅ 降低复杂度：Billing 端点从 17 个减少到 14 个
- ✅ 缩短工期：从 13-15 天缩短到 12-13 天

### 8.4 下一步行动

1. **立即开始** (本周):
   - **Console 服务**：Supabase Admin API 集成 (2天)
   - **Billing 服务**：用户业务数据 API (1天)
   - **Billing 服务**：Token 管理 API (2天)

2. **2周内完成**:
   - Billing 服务：套餐管理、报表 API
   - Offer 服务：批量操作、报表 API

3. **3周内完成**:
   - Console 服务：实现所有管理端点
   - API Keys 管理
   - 集成测试

---

**结论**：需要 12-13 天完成各服务的管理 API 补充，Console 直接调用 Supabase 简化了架构。

**创建日期**: 2025-10-06
**最后更新**: 2025-10-06
**状态**: ✅ 架构重新设计完成（Console 直接调用 Supabase）

🤖 Generated with [Claude Code](https://claude.com/claude-code)
