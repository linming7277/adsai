# 权限管理与Token消耗集成指南

> ⚠️ **重要说明**：本文档已被更新的架构方案替代
>
> 当前架构已采用 **API Gateway统一权限管理** 方案（见 `14-API-GATEWAY-UNIFIED-PERMISSIONS.md`）。
>
> 业务服务**不再需要**自己调用 `PermissionChecker`，而是从Gateway注入的请求头中读取权限信息：
> - `X-User-ID`: 用户ID
> - `X-User-Tier`: 用户套餐（starter/pro/elite）
> - `X-Has-AI-Permission`: AI评估权限标志（true/false）
> - `X-Reservation-ID`: Token预留ID
> - `X-Tokens-Reserved`: 预留的Token数量
>
> 本文档保留作为历史参考，展示服务层权限检查的实现方式。
>
> **推荐阅读**: `14-API-GATEWAY-UNIFIED-PERMISSIONS.md` + `05-IMPLEMENTATION-ROADMAP.md`

---

**版本**: 1.0 (已弃用)
**创建日期**: 2025-10-16
**目标**: 确保所有业务功能正确集成权限管控和Token消耗规则

---

## 📋 业务功能清单与服务映射

### 1. 功能权限映射表

| 功能ID | 功能名称 | 所属服务 | 权限键 | Token消耗键 | 集成状态 |
|--------|---------|---------|--------|------------|---------|
| **F1** | 用户仪表盘-风险提醒 | Frontend/Dashboard | `dashboard_risk_alerts` | - | 🟡 待集成 |
| **F2** | Offer评估-普通评估 | Offer | `offer_evaluation_basic` | `offer_evaluation_basic` | 🟡 待集成 |
| **F3** | Offer评估-AI评估 | Offer | `offer_evaluation_ai` | `offer_evaluation_ai` | 🟡 待集成 |
| **F4** | Offer评估-并发数控制 | Offer | `offer_evaluation_concurrency` | - | 🟡 待集成 |
| **F5** | Offer管理-换链接 | Offer | `offer_link_replacement` | `offer_link_replacement` | 🟡 待集成 |
| **F6** | 真实补点击-默认曲线 | Batchopen | `autoclick_default_curves` | - | 🟡 待集成 |
| **F7** | 真实补点击-定制曲线 | Batchopen | `autoclick_custom_curves` | - | 🟡 待集成 |
| **F8** | 真实补点击-成功点击 | Batchopen | - | `autoclick_per_success` | 🟡 待集成 |
| **F9** | 真实补点击-代理IP国家 | Batchopen | `autoclick_proxy_countries` | - | 🟡 待集成 |
| **F10** | Ads中心-账号绑定数量 | AdsCenter | `ads_account_binding_limit` | - | 🟡 待集成 |

### 2. 套餐配置对比

| 功能 | Starter | Pro | Elite | 说明 |
|------|---------|-----|-------|------|
| **F1: 风险提醒** | ❌ | ✅ | ✅ | 仅展示控制，无Token消耗 |
| **F2: 普通评估** | ✅ 1T | ✅ 1T | ✅ 1T | 所有套餐支持 |
| **F3: AI评估** | ❌ | ✅ 2T | ✅ 2T | Starter不支持 |
| **F4: 评估并发** | 1个 | 10个 | 100个 | 限制同时评估数量 |
| **F5: 换链接** | ❌ | ✅ 1T | ✅ 1T | Starter不支持 |
| **F6: 默认曲线** | 1个 | 2个 | 2个 | 可选曲线数量 |
| **F7: 定制曲线** | ❌ | ❌ | ✅ | 仅Elite支持 |
| **F8: 成功点击** | ✅ 1T | ✅ 1T | ✅ 1T | 每次消耗 |
| **F9: 代理IP国家** | US | 10国 | 全部 | 国家列表限制 |
| **F10: Ads账号** | 1个 | 10个 | 100个 | 绑定数量限制 |

---

## 🔧 服务集成实现

### 1. Offer服务 - 评估功能集成

#### 文件位置
```
services/offer/internal/handlers/evaluation_handler.go
services/offer/internal/middleware/permission_middleware.go
```

#### 实现代码

```go
package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"autoads/services/billing/internal/permissions"
)

type EvaluationHandler struct {
	db              *sql.DB
	redisClient     *redis.Client
	billingClient   *BillingClient
	evalService     *EvaluationService
	permChecker     *permissions.PermissionChecker
}

func NewEvaluationHandler(db *sql.DB, redis *redis.Client, billing *BillingClient, eval *EvaluationService) *EvaluationHandler {
	return &EvaluationHandler{
		db:            db,
		redisClient:   redis,
		billingClient: billing,
		evalService:   eval,
		permChecker:   permissions.NewPermissionChecker(db, redis),
	}
}

// ============================================================================
// POST /api/v1/offers/:id/evaluate - Offer评估（普通/AI）
// ============================================================================

type EvaluateRequest struct {
	OfferID string `json:"offer_id" binding:"required"`
	UseAI   bool   `json:"use_ai"`   // 是否使用AI评估
}

func (h *EvaluationHandler) EvaluateOffer(c *gin.Context) {
	ctx := c.Request.Context()
	user := c.MustGet("user").(*User) // 从JWT中间件获取

	var req EvaluateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ============================================================
	// Step 1: 权限检查 - 基础评估权限（所有套餐都有）
	// ============================================================
	canUseBasic, err := h.permChecker.CheckFeaturePermission(ctx, user.Tier, "offer_evaluation_basic")
	if err != nil || !canUseBasic {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Basic evaluation not available",
			"tier":  user.Tier,
		})
		return
	}

	// ============================================================
	// Step 2: 权限检查 - AI评估权限（仅Pro和Elite）
	// ============================================================
	if req.UseAI {
		canUseAI, err := h.permChecker.CanUseAIEvaluation(ctx, user.Tier)
		if err != nil || !canUseAI {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "AI evaluation not available for your plan",
				"tier":  user.Tier,
				"hint":  "Upgrade to Pro or Elite to use AI evaluation",
			})
			return
		}
	}

	// ============================================================
	// Step 3: 并发数检查
	// ============================================================
	maxConcurrency, err := h.permChecker.GetEvaluationConcurrency(ctx, user.Tier)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check concurrency limit"})
		return
	}

	currentConcurrency, err := h.evalService.GetUserConcurrentEvaluations(ctx, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get current evaluations"})
		return
	}

	if currentConcurrency >= maxConcurrency {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":              "Evaluation concurrency limit reached",
			"current":            currentConcurrency,
			"max":                maxConcurrency,
			"tier":               user.Tier,
			"hint":               "Please wait for ongoing evaluations to complete",
		})
		return
	}

	// ============================================================
	// Step 4: Token消耗计算
	// ============================================================
	operationKey := "offer_evaluation_basic"
	if req.UseAI {
		operationKey = "offer_evaluation_ai"
	}

	tokenCost, err := h.permChecker.GetTokenCost(ctx, user.Tier, operationKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get token cost"})
		return
	}

	// ============================================================
	// Step 5: Token余额检查和预扣（两阶段提交）
	// ============================================================
	reservationID, err := h.billingClient.ReserveTokens(ctx, user.ID, tokenCost)
	if err != nil {
		c.JSON(http.StatusPaymentRequired, gin.H{
			"error":      "Insufficient tokens",
			"required":   tokenCost,
			"available":  h.billingClient.GetUserTokenBalance(ctx, user.ID),
		})
		return
	}

	// 确保失败时释放Token
	defer func() {
		if err := recover(); err != nil {
			h.billingClient.ReleaseTokens(ctx, reservationID)
			panic(err)
		}
	}()

	// ============================================================
	// Step 6: 执行评估业务逻辑
	// ============================================================
	result, err := h.evalService.Execute(ctx, req.OfferID, req.UseAI)
	if err != nil {
		// 评估失败，释放Token
		h.billingClient.ReleaseTokens(ctx, reservationID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Evaluation failed"})
		return
	}

	// ============================================================
	// Step 7: 评估成功，提交Token扣减
	// ============================================================
	err = h.billingClient.CommitTokens(ctx, reservationID)
	if err != nil {
		// 提交失败但评估已完成，记录警告日志
		log.Printf("WARNING: Token commit failed but evaluation succeeded: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"result":       result,
		"tokens_used":  tokenCost,
		"tokens_left":  h.billingClient.GetUserTokenBalance(ctx, user.ID),
	})
}

// ============================================================================
// PUT /api/v1/offers/:id/link - 换链接功能
// ============================================================================

type ReplaceLinkRequest struct {
	OfferID string `json:"offer_id" binding:"required"`
	NewLink string `json:"new_link" binding:"required,url"`
}

func (h *EvaluationHandler) ReplaceOfferLink(c *gin.Context) {
	ctx := c.Request.Context()
	user := c.MustGet("user").(*User)

	var req ReplaceLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Step 1: 权限检查 - 换链接功能（仅Pro和Elite）
	canReplace, err := h.permChecker.CanUseLinkReplacement(ctx, user.Tier)
	if err != nil || !canReplace {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Link replacement not available for your plan",
			"tier":  user.Tier,
			"hint":  "Upgrade to Pro or Elite to use this feature",
		})
		return
	}

	// Step 2: Token消耗计算
	tokenCost, err := h.permChecker.GetTokenCost(ctx, user.Tier, "offer_link_replacement")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get token cost"})
		return
	}

	// Step 3: Token预扣
	reservationID, err := h.billingClient.ReserveTokens(ctx, user.ID, tokenCost)
	if err != nil {
		c.JSON(http.StatusPaymentRequired, gin.H{"error": "Insufficient tokens"})
		return
	}

	// Step 4: 执行换链接业务逻辑
	err = h.evalService.ReplaceLink(ctx, req.OfferID, req.NewLink)
	if err != nil {
		h.billingClient.ReleaseTokens(ctx, reservationID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to replace link"})
		return
	}

	// Step 5: 提交Token扣减
	h.billingClient.CommitTokens(ctx, reservationID)

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"tokens_used": tokenCost,
	})
}
```

---

### 2. Batchopen服务 - 真实补点击集成

#### 文件位置
```
services/batchopen/internal/handlers/task_handler.go
services/batchopen/internal/handlers/curve_handler.go
services/batchopen/internal/handlers/click_handler.go
```

#### 实现代码

```go
package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"autoads/services/billing/internal/permissions"
)

type BatchopenHandler struct {
	db              *sql.DB
	redisClient     *redis.Client
	billingClient   *BillingClient
	clickService    *ClickService
	permChecker     *permissions.PermissionChecker
}

func NewBatchopenHandler(db *sql.DB, redis *redis.Client, billing *BillingClient, click *ClickService) *BatchopenHandler {
	return &BatchopenHandler{
		db:            db,
		redisClient:   redis,
		billingClient: billing,
		clickService:  click,
		permChecker:   permissions.NewPermissionChecker(db, redis),
	}
}

// ============================================================================
// POST /api/v1/batchopen/tasks - 创建批量点击任务
// ============================================================================

type CreateTaskRequest struct {
	URL          string `json:"url" binding:"required,url"`
	Country      string `json:"country" binding:"required"` // "US", "GB", etc.
	CurveType    string `json:"curve_type"`                  // "default", "custom"
	CustomCurve  *CustomCurveConfig `json:"custom_curve"`    // 仅当curve_type=custom时
	ClickCount   int    `json:"click_count" binding:"required,min=1"`
}

type CustomCurveConfig struct {
	Pattern string `json:"pattern"` // 点击模式配置
}

func (h *AutoClickHandler) CreateTask(c *gin.Context) {
	ctx := c.Request.Context()
	user := c.MustGet("user").(*User)

	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ============================================================
	// Step 1: 代理IP国家权限检查
	// ============================================================
	allowedCountries, err := h.permChecker.GetProxyCountries(ctx, user.Tier)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check country permission"})
		return
	}

	// Elite套餐：["*"] 表示所有国家
	if !(len(allowedCountries) == 1 && allowedCountries[0] == "*") {
		// 检查请求的国家是否在允许列表中
		countryAllowed := false
		for _, country := range allowedCountries {
			if country == req.Country {
				countryAllowed = true
				break
			}
		}

		if !countryAllowed {
			c.JSON(http.StatusForbidden, gin.H{
				"error":            "Country not allowed for your plan",
				"requested":        req.Country,
				"allowed":          allowedCountries,
				"tier":             user.Tier,
				"hint":             "Upgrade to Elite for unlimited country access",
			})
			return
		}
	}

	// ============================================================
	// Step 2: 点击曲线类型权限检查
	// ============================================================
	if req.CurveType == "custom" {
		canUseCustom, err := h.permChecker.CheckFeaturePermission(ctx, user.Tier, "autoclick_custom_curves")
		if err != nil || !canUseCustom {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Custom curves not available for your plan",
				"tier":  user.Tier,
				"hint":  "Upgrade to Elite to use custom curves",
			})
			return
		}
	}

	// 检查默认曲线数量限制
	if req.CurveType == "default" {
		maxDefaultCurves, err := h.permChecker.GetFeatureQuota(ctx, user.Tier, "autoclick_default_curves")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check curve limit"})
			return
		}

		// 这里可以进一步检查用户已使用的曲线数量
		// currentCurves := h.clickService.GetUserDefaultCurves(ctx, user.ID)
		// if currentCurves >= maxDefaultCurves { ... }
	}

	// ============================================================
	// Step 3: Token消耗预估（每次成功点击消耗1 Token）
	// ============================================================
	// 注意：实际消耗在点击成功后计算，这里只是检查余额是否充足
	tokenCostPerClick, err := h.permChecker.GetTokenCost(ctx, user.Tier, "autoclick_per_success")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get token cost"})
		return
	}

	estimatedCost := tokenCostPerClick * req.ClickCount
	currentBalance := h.billingClient.GetUserTokenBalance(ctx, user.ID)

	if currentBalance < estimatedCost {
		c.JSON(http.StatusPaymentRequired, gin.H{
			"error":         "Insufficient tokens",
			"required":      estimatedCost,
			"available":     currentBalance,
			"cost_per_click": tokenCostPerClick,
		})
		return
	}

	// ============================================================
	// Step 4: 创建点击任务（不预扣Token，按实际成功扣减）
	// ============================================================
	task, err := h.clickService.CreateTask(ctx, &ClickTask{
		UserID:      user.ID,
		URL:         req.URL,
		Country:     req.Country,
		CurveType:   req.CurveType,
		CustomCurve: req.CustomCurve,
		ClickCount:  req.ClickCount,
		TokenCost:   tokenCostPerClick, // 记录单次Token成本
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":            true,
		"task_id":            task.ID,
		"estimated_cost":     estimatedCost,
		"cost_per_click":     tokenCostPerClick,
		"note":               "Tokens will be deducted for each successful click",
	})
}

// ============================================================================
// 点击成功回调 - 扣减Token
// ============================================================================

func (h *AutoClickHandler) OnClickSuccess(ctx context.Context, taskID string, clickID string) error {
	// 获取任务信息
	task, err := h.clickService.GetTask(ctx, taskID)
	if err != nil {
		return err
	}

	// 扣减Token（单次成功）
	err = h.billingClient.DeductTokens(ctx, task.UserID, task.TokenCost)
	if err != nil {
		// Token扣减失败，记录警告但不阻止点击
		log.Printf("WARNING: Token deduction failed for click %s: %v", clickID, err)
	}

	return nil
}
```

---

### 3. AdsCenter服务 - 账号绑定数量限制

#### 文件位置
```
services/adscenter/internal/handlers/binding_handler.go
```

#### 实现代码

```go
package handlers

import (
	"context"
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"autoads/services/billing/internal/permissions"
)

type BindingHandler struct {
	db              *sql.DB
	redisClient     *redis.Client
	bindingRepo     *BindingRepository
	permChecker     *permissions.PermissionChecker
}

func NewBindingHandler(db *sql.DB, redis *redis.Client, repo *BindingRepository) *BindingHandler {
	return &BindingHandler{
		db:          db,
		redisClient: redis,
		bindingRepo: repo,
		permChecker: permissions.NewPermissionChecker(db, redis),
	}
}

// ============================================================================
// POST /api/v1/adscenter/bindings - 创建Ads账号绑定
// ============================================================================

type CreateBindingRequest struct {
	AdsAccountID   string `json:"ads_account_id" binding:"required"`
	AdsAccountName string `json:"ads_account_name" binding:"required"`
	Platform       string `json:"platform" binding:"required"` // "google_ads", "facebook_ads"
}

func (h *BindingHandler) CreateBinding(c *gin.Context) {
	ctx := c.Request.Context()
	user := c.MustGet("user").(*User)

	var req CreateBindingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ============================================================
	// Step 1: 获取绑定数量限制
	// ============================================================
	maxBindings, err := h.permChecker.GetFeatureQuota(ctx, user.Tier, "ads_account_binding_limit")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check binding limit"})
		return
	}

	// ============================================================
	// Step 2: 检查当前绑定数量
	// ============================================================
	currentBindings, err := h.bindingRepo.GetActiveBindingCount(ctx, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get current bindings"})
		return
	}

	if currentBindings >= maxBindings {
		c.JSON(http.StatusForbidden, gin.H{
			"error":   "Ads account binding limit reached",
			"current": currentBindings,
			"max":     maxBindings,
			"tier":    user.Tier,
			"hint":    "Upgrade to a higher plan or remove existing bindings",
		})
		return
	}

	// ============================================================
	// Step 3: 创建绑定
	// ============================================================
	binding, err := h.bindingRepo.Create(ctx, &Binding{
		UserID:         user.ID,
		AdsAccountID:   req.AdsAccountID,
		AdsAccountName: req.AdsAccountName,
		Platform:       req.Platform,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create binding"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":         true,
		"binding":         binding,
		"bindings_used":   currentBindings + 1,
		"bindings_total":  maxBindings,
	})
}

// ============================================================================
// GET /api/v1/adscenter/bindings/quota - 查询绑定配额
// ============================================================================

func (h *BindingHandler) GetBindingQuota(c *gin.Context) {
	ctx := c.Request.Context()
	user := c.MustGet("user").(*User)

	maxBindings, err := h.permChecker.GetFeatureQuota(ctx, user.Tier, "ads_account_binding_limit")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check binding limit"})
		return
	}

	currentBindings, err := h.bindingRepo.GetActiveBindingCount(ctx, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get current bindings"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"used":      currentBindings,
		"total":     maxBindings,
		"available": maxBindings - currentBindings,
		"tier":      user.Tier,
	})
}
```

---

### 4. Frontend Dashboard - 风险提醒展示控制

#### 文件位置
```
apps/frontend/src/app/dashboard/page.tsx
apps/frontend/src/lib/hooks/useUserPermissions.ts
```

#### 实现代码

```typescript
// apps/frontend/src/lib/hooks/useUserPermissions.ts

import { useQuery } from '@tanstack/react-query';
import { useUser } from '~/core/hooks/use-user';

interface UserPermissions {
  dashboard_risk_alerts: boolean;
  offer_evaluation_basic: boolean;
  offer_evaluation_ai: boolean;
  offer_evaluation_concurrency: number;
  offer_link_replacement: boolean;
  autoclick_custom_curves: boolean;
  ads_account_binding_limit: number;
  // ...其他权限
}

export function useUserPermissions() {
  const { data: user } = useUser();

  return useQuery({
    queryKey: ['user-permissions', user?.tier],
    queryFn: async () => {
      if (!user?.tier) return null;

      const response = await fetch(`/api/v1/billing/plans/${user.tier}`);
      if (!response.ok) throw new Error('Failed to fetch permissions');

      const data = await response.json();
      return data.data.permissions as UserPermissions;
    },
    enabled: !!user?.tier,
    staleTime: 5 * 60 * 1000, // 5分钟
  });
}

// 便捷Hook：检查单个权限
export function useHasPermission(featureKey: keyof UserPermissions) {
  const { data: permissions } = useUserPermissions();
  return permissions?.[featureKey] ?? false;
}
```

```typescript
// apps/frontend/src/app/dashboard/page.tsx

'use client';

import { useHasPermission } from '~/lib/hooks/useUserPermissions';
import { RiskAlertPanel } from './components/RiskAlertPanel';

export default function DashboardPage() {
  // 检查用户是否有风险提醒权限
  const canViewRiskAlerts = useHasPermission('dashboard_risk_alerts');

  return (
    <DashboardPageLayout>
      <div className="space-y-6">
        {/* 其他Dashboard内容 */}
        <StatsPanel />
        <RecentOffersPanel />

        {/* 仅Pro和Elite用户显示风险提醒 */}
        {canViewRiskAlerts && (
          <RiskAlertPanel />
        )}

        {/* Starter用户显示升级提示 */}
        {!canViewRiskAlerts && (
          <UpgradePrompt
            feature="风险提醒"
            description="实时监控您的Offer风险，提前预警潜在问题"
            requiredPlan="Pro"
          />
        )}
      </div>
    </DashboardPageLayout>
  );
}
```

---

## ✅ 集成验证清单

### 完整验证矩阵

| 功能 | 服务 | 权限检查 | Token预扣 | Token提交 | 错误处理 | 测试状态 |
|------|------|---------|----------|----------|---------|---------|
| **F1: 风险提醒** | Frontend | ✅ 前端 | N/A | N/A | N/A | 🟡 待测试 |
| **F2: 普通评估** | Offer | ✅ API | ✅ Reserve | ✅ Commit | ✅ Release | 🟡 待测试 |
| **F3: AI评估** | Offer | ✅ API | ✅ Reserve | ✅ Commit | ✅ Release | 🟡 待测试 |
| **F4: 并发控制** | Offer | ✅ API | N/A | N/A | ✅ 429 | 🟡 待测试 |
| **F5: 换链接** | Offer | ✅ API | ✅ Reserve | ✅ Commit | ✅ Release | 🟡 待测试 |
| **F6: 默认曲线** | AutoClick | ✅ API | N/A | N/A | N/A | 🟡 待测试 |
| **F7: 定制曲线** | AutoClick | ✅ API | N/A | N/A | N/A | 🟡 待测试 |
| **F8: 成功点击** | AutoClick | N/A | ❌ 事后扣减 | ✅ Deduct | ✅ Log | 🟡 待测试 |
| **F9: 代理IP国家** | AutoClick | ✅ API | N/A | N/A | ✅ 403 | 🟡 待测试 |
| **F10: Ads绑定** | AdsCenter | ✅ API | N/A | N/A | ✅ 403 | 🟡 待测试 |

---

## 🧪 测试用例

### 1. Offer评估测试

```bash
# 测试1: Starter用户尝试AI评估（应该失败）
curl -X POST https://offer-preview.autoads.dev/api/v1/offers/123/evaluate \
  -H "Authorization: Bearer $STARTER_TOKEN" \
  -d '{"offer_id": "123", "use_ai": true}'

# 预期: 403 Forbidden
# {
#   "error": "AI evaluation not available for your plan",
#   "tier": "starter",
#   "hint": "Upgrade to Pro or Elite to use AI evaluation"
# }

# 测试2: Pro用户AI评估成功
curl -X POST https://offer-preview.autoads.dev/api/v1/offers/123/evaluate \
  -H "Authorization: Bearer $PRO_TOKEN" \
  -d '{"offer_id": "123", "use_ai": true}'

# 预期: 200 OK
# {
#   "success": true,
#   "result": {...},
#   "tokens_used": 2,
#   "tokens_left": 998
# }

# 测试3: 并发限制测试（Starter套餐限制1个）
# 同时发起2个评估请求
curl -X POST .../evaluate -H "Authorization: Bearer $STARTER_TOKEN" &
curl -X POST .../evaluate -H "Authorization: Bearer $STARTER_TOKEN" &

# 预期: 第一个200 OK，第二个429 Too Many Requests
# {
#   "error": "Evaluation concurrency limit reached",
#   "current": 1,
#   "max": 1,
#   "tier": "starter"
# }
```

### 2. Batchopen国家限制测试

```bash
# 测试1: Starter用户只能使用US代理
curl -X POST https://batchopen-preview.autoads.dev/api/v1/batchopen/tasks \
  -H "Authorization: Bearer $STARTER_TOKEN" \
  -d '{
    "url": "https://example.com",
    "country": "GB",
    "click_count": 10
  }'

# 预期: 403 Forbidden
# {
#   "error": "Country not allowed for your plan",
#   "requested": "GB",
#   "allowed": ["US"],
#   "tier": "starter"
# }

# 测试2: Elite用户可以使用任意国家
curl -X POST https://batchopen-preview.autoads.dev/api/v1/batchopen/tasks \
  -H "Authorization: Bearer $ELITE_TOKEN" \
  -d '{"url": "...", "country": "JP", "click_count": 10}'

# 预期: 200 OK
```

### 3. Ads账号绑定数量测试

```bash
# 测试1: Starter用户绑定第2个账号（应该失败）
# 前提：已有1个绑定
curl -X POST https://adscenter-preview.autoads.dev/api/v1/adscenter/bindings \
  -H "Authorization: Bearer $STARTER_TOKEN" \
  -d '{
    "ads_account_id": "1234567890",
    "ads_account_name": "Test Account",
    "platform": "google_ads"
  }'

# 预期: 403 Forbidden
# {
#   "error": "Ads account binding limit reached",
#   "current": 1,
#   "max": 1,
#   "tier": "starter"
# }

# 测试2: 查询绑定配额
curl https://adscenter-preview.autoads.dev/api/v1/adscenter/bindings/quota \
  -H "Authorization: Bearer $PRO_TOKEN"

# 预期: 200 OK
# {
#   "used": 3,
#   "total": 10,
#   "available": 7,
#   "tier": "pro"
# }
```

---

## 📋 部署清单

### Phase 1: Billing服务（权限检查基础设施）

- [x] ✅ 数据库迁移
- [x] ✅ API端点实现
- [x] ✅ PermissionChecker实现
- [x] ✅ ConfigReloadWorker实现
- [ ] 🟡 部署到preview环境
- [ ] 🟡 验证API正常工作

### Phase 2: Offer服务集成

- [ ] 🟡 实现evaluation_handler.go权限检查
- [ ] 🟡 集成两阶段提交Token扣减
- [ ] 🟡 添加并发数控制
- [ ] 🟡 实现换链接权限检查
- [ ] 🟡 单元测试
- [ ] 🟡 部署到preview环境

### Phase 3: Batchopen服务集成

- [ ] 🟡 实现task_handler.go权限检查
- [ ] 🟡 代理IP国家限制
- [ ] 🟡 点击曲线类型限制
- [ ] 🟡 成功点击Token扣减
- [ ] 🟡 单元测试
- [ ] 🟡 部署到preview环境

### Phase 4: AdsCenter服务集成

- [ ] 🟡 实现binding_handler.go权限检查
- [ ] 🟡 绑定数量限制
- [ ] 🟡 配额查询API
- [ ] 🟡 单元测试
- [ ] 🟡 部署到preview环境

### Phase 5: Frontend集成

- [ ] 🟡 实现useUserPermissions Hook
- [ ] 🟡 Dashboard风险提醒展示控制
- [ ] 🟡 Offer页面AI评估按钮控制
- [ ] 🟡 Batchopen页面国家选择限制
- [ ] 🟡 AdsCenter绑定配额显示
- [ ] 🟡 部署到preview环境

---

## 📊 集成进度追踪

| 服务 | 集成状态 | 测试状态 | 部署状态 | 负责人 | 预计完成 |
|------|---------|---------|---------|--------|---------|
| **Billing** | ✅ 100% | 🟡 0% | 🟡 0% | - | - |
| **Offer** | 🟡 0% | 🟡 0% | 🟡 0% | - | Week 1 |
| **Batchopen** | 🟡 0% | 🟡 0% | 🟡 0% | - | Week 2 |
| **AdsCenter** | 🟡 0% | 🟡 0% | 🟡 0% | - | Week 2 |
| **Frontend** | 🟡 0% | 🟡 0% | 🟡 0% | - | Week 3 |

---

## 🔍 问题排查

### 常见问题

**Q1: 权限检查总是返回false？**
```bash
# 检查Redis缓存
redis-cli GET subscription:config:pro

# 检查数据库配置
psql $DATABASE_URL -c "SELECT tier, permissions FROM subscription_plan_configs WHERE tier='pro';"
```

**Q2: Token扣减不生效？**
```bash
# 检查Billing服务日志
kubectl logs -f billing-preview-xxx | grep "Token"

# 检查数据库Token余额
psql $DATABASE_URL -c "SELECT user_id, balance FROM user_tokens WHERE user_id='...';"
```

**Q3: 配置修改后没有生效？**
```bash
# 检查Pub/Sub消息
gcloud pubsub subscriptions pull subscription-config-updated-billing --limit=10

# 手动删除Redis缓存
redis-cli DEL subscription:config:pro subscription:plans:all
```

---

## 📞 支持

- 完整方案: `docs/ArchitectureOpV1/07-SUBSCRIPTION-CONFIG-HOT-RELOAD.md`
- 生效机制: `docs/ArchitectureOpV1/08-CONFIG-HOT-RELOAD-WORKFLOW.md`
- 实施总结: `docs/ArchitectureOpV1/09-IMPLEMENTATION-SUMMARY.md`

---

**下一步**: 开始Offer服务集成 → Batchopen服务 → AdsCenter服务 → Frontend
