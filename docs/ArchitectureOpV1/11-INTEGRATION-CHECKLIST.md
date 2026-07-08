# 权限管理与Token消耗集成验证清单

**版本**: 1.0
**创建日期**: 2025-10-16
**目标**: 确保所有业务功能正确集成权限管控和Token消耗规则

---

## ✅ 集成验证矩阵

### 1. Offer服务（5个功能点）

| 功能 | 权限检查 | Token计算 | 并发控制 | 错误处理 | 测试状态 | 负责人 | 截止日期 |
|------|---------|----------|---------|---------|---------|--------|---------|
| **F2: 普通评估** | ☐ `offer_evaluation_basic` | ☐ 动态读取 | ☐ 并发数检查 | ☐ 403/402/429 | ☐ 未测试 | - | Week 1 |
| **F3: AI评估** | ☐ `offer_evaluation_ai` | ☐ 动态读取 | ☐ 并发数检查 | ☐ 403/402/429 | ☐ 未测试 | - | Week 1 |
| **F4: 并发控制** | ☐ `offer_evaluation_concurrency` | N/A | ☐ 实时查询 | ☐ 429 | ☐ 未测试 | - | Week 1 |
| **F5: 换链接** | ☐ `offer_link_replacement` | ☐ 动态读取 | N/A | ☐ 403/402 | ☐ 未测试 | - | Week 1 |

**文件清单**:
- ☐ `services/offer/internal/handlers/offers_evaluation_handlers.go` - 修改评估逻辑
- ☐ `services/offer/internal/handlers/offers_link_handlers.go` - 添加换链接功能
- ☐ `services/offer/main.go` - 初始化RedisClient并传递给Handler
- ☐ `services/offer/go.mod` - 添加billing/permissions依赖

**关键代码片段**:
```go
// ✅ 正确示例（动态权限检查）
permChecker := permissions.NewPermissionChecker(h.DB, h.RedisClient)
canUseAI, err := permChecker.CanUseAIEvaluation(ctx, userTier)
if !canUseAI {
    return http.StatusForbidden, "AI evaluation not available"
}

tokensRequired, err := permChecker.GetTokenCost(ctx, userTier, "offer_evaluation_ai")
```

```go
// ❌ 错误示例（硬编码检查）
if subscription.Plan == "starter" {
    return http.StatusForbidden, "AI evaluation requires Pro plan"
}
tokensRequired := 3 // 硬编码
```

---

### 2. Batchopen服务（4个功能点）

| 功能 | 权限检查 | Token计算 | 配额检查 | 错误处理 | 测试状态 | 负责人 | 截止日期 |
|------|---------|----------|---------|---------|---------|--------|---------|
| **F6: 默认曲线** | ☐ `autoclick_default_curves` | N/A | ☐ 曲线数量 | ☐ 403 | ☐ 未测试 | - | Week 2 |
| **F7: 定制曲线** | ☐ `autoclick_custom_curves` | N/A | N/A | ☐ 403 | ☐ 未测试 | - | Week 2 |
| **F8: 成功点击** | N/A | ☐ `autoclick_per_success` | N/A | ☐ 402 Log | ☐ 未测试 | - | Week 2 |
| **F9: 代理IP国家** | ☐ `autoclick_proxy_countries` | N/A | ☐ 国家列表 | ☐ 403 | ☐ 未测试 | - | Week 2 |

**文件清单**:
- ☐ `services/batchopen/internal/handlers/task_handler.go` - 添加权限检查
- ☐ `services/batchopen/internal/handlers/click_callback_handler.go` - Token扣减回调
- ☐ `services/batchopen/main.go` - 初始化RedisClient
- ☐ `services/batchopen/go.mod` - 添加依赖

**关键代码片段**:
```go
// ✅ 代理IP国家检查
allowedCountries, err := permChecker.GetProxyCountries(ctx, userTier)
if !(len(allowedCountries) == 1 && allowedCountries[0] == "*") {
    // 检查请求国家是否在允许列表中
    if !contains(allowedCountries, requestedCountry) {
        return http.StatusForbidden, "Country not allowed"
    }
}

// ✅ 成功点击后Token扣减
func OnClickSuccess(ctx context.Context, taskID string) {
    task, _ := repo.GetTask(ctx, taskID)
    tokenCost, _ := permChecker.GetTokenCost(ctx, task.UserTier, "autoclick_per_success")
    billingClient.DeductTokens(ctx, task.UserID, tokenCost)
}
```

---

### 3. AdsCenter服务（1个功能点）

| 功能 | 权限检查 | 配额查询 | 错误处理 | 测试状态 | 负责人 | 截止日期 |
|------|---------|---------|---------|---------|--------|---------|
| **F10: Ads账号绑定** | ☐ `ads_account_binding_limit` | ☐ 当前绑定数 | ☐ 403 | ☐ 未测试 | - | Week 2 |

**文件清单**:
- ☐ `services/adscenter/internal/handlers/binding_handler.go` - 添加绑定数量检查
- ☐ `services/adscenter/internal/repositories/binding_repository.go` - 查询当前绑定数
- ☐ `services/adscenter/main.go` - 初始化RedisClient
- ☐ `services/adscenter/go.mod` - 添加依赖

**关键代码片段**:
```go
// ✅ 绑定数量检查
maxBindings, err := permChecker.GetFeatureQuota(ctx, userTier, "ads_account_binding_limit")
currentBindings, err := repo.GetActiveBindingCount(ctx, userID)

if currentBindings >= maxBindings {
    return http.StatusForbidden, gin.H{
        "error": "Binding limit reached",
        "current": currentBindings,
        "max": maxBindings,
        "hint": "Upgrade to a higher plan",
    }
}
```

---

### 4. Frontend（1个功能点）

| 功能 | 权限检查 | UI展示控制 | 测试状态 | 负责人 | 截止日期 |
|------|---------|-----------|---------|--------|---------|
| **F1: 风险提醒** | ☐ `dashboard_risk_alerts` | ☐ 条件渲染 | ☐ 未测试 | - | Week 3 |

**文件清单**:
- ☐ `apps/frontend/src/lib/hooks/useUserPermissions.ts` - 权限Hook
- ☐ `apps/frontend/src/app/dashboard/page.tsx` - Dashboard页面
- ☐ `apps/frontend/src/app/dashboard/components/RiskAlertPanel.tsx` - 风险提醒组件

**关键代码片段**:
```typescript
// ✅ 前端权限检查
const canViewRiskAlerts = useHasPermission('dashboard_risk_alerts');

return (
  <DashboardPageLayout>
    {canViewRiskAlerts && <RiskAlertPanel />}
    {!canViewRiskAlerts && (
      <UpgradePrompt feature="风险提醒" requiredPlan="Pro" />
    )}
  </DashboardPageLayout>
);
```

---

## 🔧 代码改造清单

### Phase 1: 基础设施准备

- [x] ✅ 创建 `services/billing/internal/permissions/permission_checker.go`
- [x] ✅ 创建 `services/billing/internal/workers/config_reload_worker.go`
- [ ] ☐ 在各服务的 `main.go` 中初始化 RedisClient
- [ ] ☐ 在各服务的 `go.mod` 中添加依赖

**示例代码**:
```go
// services/offer/main.go

import (
	"github.com/go-redis/redis/v8"
	"github.com/xxrenzhe/autoads/services/billing/internal/permissions"
)

func main() {
	// ... 初始化DB

	// 初始化Redis客户端
	redisClient := redis.NewClient(&redis.Options{
		Addr: os.Getenv("REDIS_URL"),
	})

	// 传递给Handler
	handler := &Handler{
		DB:          db,
		RedisClient: redisClient, // ✅ 新增
		Cache:       cache,
		Publisher:   publisher,
	}

	// ...
}
```

### Phase 2: Offer服务改造

**文件**: `services/offer/internal/handlers/offers_evaluation_handlers.go`

**改动清单**:
```diff
func (h *Handler) handleEvaluateOffer(...) {
    // ...

+   // 初始化PermissionChecker
+   permChecker := permissions.NewPermissionChecker(h.DB, h.RedisClient)
+
+   // 动态检查AI评估权限
-   if req.EnableAI && subscription.Plan == "starter" {
-       return errors.Write(w, r, http.StatusForbidden, "AI evaluation requires Pro plan")
-   }
+   if req.EnableAI {
+       canUseAI, err := permChecker.CanUseAIEvaluation(ctx, subscription.Plan)
+       if !canUseAI {
+           return errors.Write(w, r, http.StatusForbidden, "AI evaluation not available")
+       }
+   }

+   // 动态计算Token消耗
-   tokensRequired := 1
-   if req.EnableAI { tokensRequired = 3 }
+   operationKey := "offer_evaluation_basic"
+   if req.EnableAI { operationKey = "offer_evaluation_ai" }
+   tokensRequired, err := permChecker.GetTokenCost(ctx, subscription.Plan, operationKey)

+   // 检查并发数
+   maxConcurrency, err := permChecker.GetEvaluationConcurrency(ctx, subscription.Plan)
+   var currentConcurrency int
+   h.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM offer_evaluations WHERE status IN ('pending', 'running') AND ...`).Scan(&currentConcurrency)
+   if currentConcurrency >= maxConcurrency {
+       return errors.Write(w, r, http.StatusTooManyRequests, "Concurrency limit reached")
+   }

    // ... 后续Token预扣逻辑不变
}
```

**参考文件**: `services/offer/internal/handlers/permission_integration_example.go` (已创建)

### Phase 3: Batchopen服务改造

**文件**: `services/batchopen/internal/handlers/task_handler.go`

**改动清单**:
```go
func (h *Handler) CreateTask(c *gin.Context) {
    // ... 解析请求

    permChecker := permissions.NewPermissionChecker(h.DB, h.RedisClient)

    // ✅ 代理IP国家检查
    allowedCountries, err := permChecker.GetProxyCountries(ctx, user.Tier)
    if !(len(allowedCountries) == 1 && allowedCountries[0] == "*") {
        if !contains(allowedCountries, req.Country) {
            return c.JSON(http.StatusForbidden, gin.H{
                "error": "Country not allowed",
                "allowed": allowedCountries,
            })
        }
    }

    // ✅ 定制曲线权限检查
    if req.CurveType == "custom" {
        canUseCustom, _ := permChecker.CheckFeaturePermission(ctx, user.Tier, "autoclick_custom_curves")
        if !canUseCustom {
            return c.JSON(http.StatusForbidden, gin.H{"error": "Custom curves not available"})
        }
    }

    // ✅ 获取Token消耗规则（记录到任务中，点击成功时扣减）
    tokenCostPerClick, err := permChecker.GetTokenCost(ctx, user.Tier, "autoclick_per_success")

    // 创建任务
    task := &Task{
        UserID: user.ID,
        TokenCost: tokenCostPerClick, // 记录单次成本
        // ...
    }
    h.repo.Create(ctx, task)

    return c.JSON(http.StatusOK, task)
}

// 点击成功回调
func (h *Handler) OnClickSuccess(ctx context.Context, taskID string, clickID string) {
    task, _ := h.repo.GetTask(ctx, taskID)

    // ✅ 扣减Token（按实际成功扣减）
    err := h.billingClient.DeductTokens(ctx, task.UserID, task.TokenCost)
    if err != nil {
        log.Printf("WARNING: Token deduction failed: %v", err)
    }
}
```

### Phase 4: AdsCenter服务改造

**文件**: `services/adscenter/internal/handlers/binding_handler.go`

**改动清单**:
```go
func (h *Handler) CreateBinding(c *gin.Context) {
    // ... 解析请求

    permChecker := permissions.NewPermissionChecker(h.DB, h.RedisClient)

    // ✅ 获取绑定数量限制
    maxBindings, err := permChecker.GetFeatureQuota(ctx, user.Tier, "ads_account_binding_limit")

    // ✅ 查询当前绑定数
    currentBindings, err := h.repo.GetActiveBindingCount(ctx, user.ID)

    if currentBindings >= maxBindings {
        return c.JSON(http.StatusForbidden, gin.H{
            "error": "Binding limit reached",
            "current": currentBindings,
            "max": maxBindings,
        })
    }

    // 创建绑定
    // ...
}
```

### Phase 5: Frontend改造

**文件**: `apps/frontend/src/lib/hooks/useUserPermissions.ts`

```typescript
export function useUserPermissions() {
  const { data: user } = useUser();

  return useQuery({
    queryKey: ['user-permissions', user?.tier],
    queryFn: async () => {
      if (!user?.tier) return null;
      const response = await fetch(`/api/v1/billing/plans/${user.tier}`);
      const data = await response.json();
      return data.data.permissions;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useHasPermission(key: string) {
  const { data: permissions } = useUserPermissions();
  return permissions?.[key] ?? false;
}
```

**文件**: `apps/frontend/src/app/dashboard/page.tsx`

```typescript
export default function DashboardPage() {
  const canViewRiskAlerts = useHasPermission('dashboard_risk_alerts');

  return (
    <DashboardPageLayout>
      {canViewRiskAlerts && <RiskAlertPanel />}
      {!canViewRiskAlerts && (
        <UpgradePrompt feature="风险提醒" requiredPlan="Pro" />
      )}
    </DashboardPageLayout>
  );
}
```

---

## 🧪 测试用例清单

### 1. Offer服务测试

```bash
# Test 1: Starter用户尝试AI评估（应该失败）
curl -X POST https://offer-preview.autoads.dev/api/v1/offers/123/evaluate \
  -H "Authorization: Bearer $STARTER_TOKEN" \
  -H "Idempotency-Key: test-001" \
  -d '{"enableAI": true}'

# 预期: 403 Forbidden
# {"error": "AI evaluation not available for your plan"}

# Test 2: Pro用户AI评估成功，Token消耗动态读取
curl -X POST https://offer-preview.autoads.dev/api/v1/offers/123/evaluate \
  -H "Authorization: Bearer $PRO_TOKEN" \
  -H "Idempotency-Key: test-002" \
  -d '{"enableAI": true}'

# 预期: 202 Accepted
# {"tokensReserved": 2, "message": "Evaluation started"} ← 从配置读取，不再硬编码为3

# Test 3: 并发数限制测试
for i in {1..2}; do
  curl -X POST https://offer-preview.autoads.dev/api/v1/offers/123/evaluate \
    -H "Authorization: Bearer $STARTER_TOKEN" \
    -H "Idempotency-Key: test-00$i" \
    -d '{"enableAI": false}' &
done

# 预期: 第一个202 Accepted，第二个429 Too Many Requests
```

### 2. Batchopen服务测试

```bash
# Test 1: Starter用户尝试使用GB代理（应该失败）
curl -X POST https://batchopen-preview.autoads.dev/api/v1/batchopen/tasks \
  -H "Authorization: Bearer $STARTER_TOKEN" \
  -d '{"url": "https://example.com", "country": "GB", "click_count": 10}'

# 预期: 403 Forbidden
# {"error": "Country not allowed", "allowed": ["US"]}

# Test 2: Elite用户使用任意国家
curl -X POST https://batchopen-preview.autoads.dev/api/v1/batchopen/tasks \
  -H "Authorization: Bearer $ELITE_TOKEN" \
  -d '{"url": "https://example.com", "country": "JP", "click_count": 10}'

# 预期: 200 OK

# Test 3: Starter用户尝试定制曲线（应该失败）
curl -X POST https://batchopen-preview.autoads.dev/api/v1/batchopen/tasks \
  -H "Authorization: Bearer $STARTER_TOKEN" \
  -d '{"url": "...", "curve_type": "custom", "custom_curve": {...}}'

# 预期: 403 Forbidden
# {"error": "Custom curves not available for your plan"}
```

### 3. AdsCenter服务测试

```bash
# Test 1: Starter用户绑定第2个账号（应该失败）
curl -X POST https://adscenter-preview.autoads.dev/api/v1/adscenter/bindings \
  -H "Authorization: Bearer $STARTER_TOKEN" \
  -d '{"ads_account_id": "1234", "platform": "google_ads"}'

# 预期: 403 Forbidden（假设已有1个绑定）
# {"error": "Binding limit reached", "current": 1, "max": 1}

# Test 2: Pro用户查询配额
curl https://adscenter-preview.autoads.dev/api/v1/adscenter/bindings/quota \
  -H "Authorization: Bearer $PRO_TOKEN"

# 预期: 200 OK
# {"used": 5, "total": 10, "available": 5}
```

---

## 📋 最终验证清单

### 代码审查

- [ ] ☐ 所有硬编码的 `subscription.Plan == "starter"` 已移除
- [ ] ☐ 所有硬编码的 `tokensRequired = 3` 已移除
- [ ] ☐ 所有服务已初始化 `RedisClient` 并传递给Handler
- [ ] ☐ 所有Handler已注入 `permissions.PermissionChecker`
- [ ] ☐ 所有权限检查使用 `CheckFeaturePermission()` 或便捷函数
- [ ] ☐ 所有Token消耗使用 `GetTokenCost()` 动态读取
- [ ] ☐ 错误响应包含 `tier` 和 `hint` 字段，指导用户升级

### 功能测试

- [ ] ☐ Starter用户无法使用AI评估（F3）
- [ ] ☐ Starter用户只能1个并发评估（F4）
- [ ] ☐ Pro用户AI评估消耗2个Token（F3，从配置读取）
- [ ] ☐ Starter用户无法换链接（F5）
- [ ] ☐ Starter用户只能使用US代理（F9）
- [ ] ☐ Elite用户可以使用定制曲线（F7）
- [ ] ☐ Starter用户最多绑定1个Ads账号（F10）
- [ ] ☐ Pro用户可以绑定10个Ads账号（F10）
- [ ] ☐ Starter用户Dashboard不显示风险提醒（F1）
- [ ] ☐ Pro用户Dashboard显示风险提醒（F1）

### 配置热更新测试

- [ ] ☐ 修改Pro套餐AI评估Token消耗：2→3，5秒后生效
- [ ] ☐ 修改Elite套餐并发数：100→200，5秒后生效
- [ ] ☐ 禁用Starter套餐的基础评估，5秒后生效（极端测试）
- [ ] ☐ 修改Starter套餐代理IP国家：US→US+GB，5秒后生效

### 性能测试

- [ ] ☐ 权限检查延迟（缓存命中）< 5ms
- [ ] ☐ 权限检查延迟（缓存未命中）< 50ms
- [ ] ☐ Token消耗规则查询延迟 < 5ms
- [ ] ☐ 并发1000个请求，权限检查不成为瓶颈

---

## 📊 完成度追踪

| 服务 | 代码改造 | 单元测试 | 集成测试 | 部署验证 | 完成度 |
|------|---------|---------|---------|---------|--------|
| **Billing** | ✅ | ☐ | ☐ | ☐ | 25% |
| **Offer** | ☐ | ☐ | ☐ | ☐ | 0% |
| **Batchopen** | ☐ | ☐ | ☐ | ☐ | 0% |
| **AdsCenter** | ☐ | ☐ | ☐ | ☐ | 0% |
| **Frontend** | ☐ | ☐ | ☐ | ☐ | 0% |

**总体完成度**: **5%** (1/20)

---

## 🎯 下一步行动

### 本周（Week 1）
1. ✅ 完成Billing服务基础设施
2. ☐ 改造Offer服务（5个功能点）
3. ☐ 编写Offer服务单元测试
4. ☐ 部署Offer服务到preview环境
5. ☐ 运行集成测试

### 下周（Week 2）
1. ☐ 改造Batchopen服务（4个功能点）
2. ☐ 改造AdsCenter服务（1个功能点）
3. ☐ 编写单元测试和集成测试
4. ☐ 部署到preview环境

### Week 3
1. ☐ Frontend集成（风险提醒展示控制）
2. ☐ 完整端到端测试
3. ☐ 配置热更新测试
4. ☐ 性能测试
5. ☐ 生产环境部署

---

**关键提醒**:
- ⚠️ 所有硬编码的权限和Token规则必须移除
- ⚠️ 每个服务必须初始化RedisClient
- ⚠️ 错误响应必须包含用户友好的升级提示
- ⚠️ 配置修改后必须在5秒内生效

**参考文档**:
- 完整集成指南: `docs/ArchitectureOpV1/10-PERMISSION-INTEGRATION-GUIDE.md`
- Offer服务示例: `services/offer/internal/handlers/permission_integration_example.go`
- 配置热更新机制: `docs/ArchitectureOpV1/08-CONFIG-HOT-RELOAD-WORKFLOW.md`
