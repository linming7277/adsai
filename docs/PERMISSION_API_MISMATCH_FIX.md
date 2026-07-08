# 权限API数据格式不匹配问题修复

## 问题根源

前端和后端的权限API设计不匹配：

### 前端期望
```typescript
// GET /api/v1/billing/permissions/check
{
  canUseAI: boolean;
  canCreateOffers: boolean;
  canManageAds: boolean;
  restrictions: string[];
}
```

### 后端实际
```go
// POST /api/v1/billing/permissions/check
// Request: { userId: string, feature: string }
// Response: {
//   allowed: boolean,
//   value: any,
//   plan: string,
//   reason: string,
//   errorCode: string,
//   requiredPlan: string
// }
```

**问题**: 后端设计是每次检查一个feature，前端期望一次获取所有权限。

## 解决方案

### 方案1: 修改后端添加批量权限检查端点（推荐）

在billing服务添加新端点：

**文件**: `services/billing/internal/handlers/permission.go`

```go
// CheckAllPermissionsResponse represents all permissions for a user
type CheckAllPermissionsResponse struct {
    CanUseAI        bool     `json:"canUseAI"`
    CanCreateOffers bool     `json:"canCreateOffers"`
    CanManageAds    bool     `json:"canManageAds"`
    Restrictions    []string `json:"restrictions"`
    Plan            string   `json:"plan"`
}

// CheckAllPermissions handles GET /api/v1/billing/permissions/check
// Returns all permissions for the current user
func (h *PermissionHandler) CheckAllPermissions(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    
    // Get user ID from context (set by auth middleware)
    userID, ok := ctx.Value("user_id").(string)
    if !ok || userID == "" {
        errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "User ID not found", nil)
        return
    }
    
    // Get user's subscription plan
    plan, err := h.getUserPlan(ctx, userID)
    if err != nil {
        errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Failed to get user plan", map[string]string{"error": err.Error()})
        return
    }
    
    // Check all permissions
    aiPerm, _ := h.checkPermission(ctx, plan, "useAI")
    offersPerm, _ := h.checkPermission(ctx, plan, "createOffers")
    adsPerm, _ := h.checkPermission(ctx, plan, "manageAds")
    
    restrictions := []string{}
    if !aiPerm.Allowed {
        restrictions = append(restrictions, "AI features require Professional or Elite subscription")
    }
    if !offersPerm.Allowed {
        restrictions = append(restrictions, "Creating offers requires active subscription")
    }
    if !adsPerm.Allowed {
        restrictions = append(restrictions, "Ads management requires Elite subscription")
    }
    
    response := CheckAllPermissionsResponse{
        CanUseAI:        aiPerm.Allowed,
        CanCreateOffers: offersPerm.Allowed,
        CanManageAds:    adsPerm.Allowed,
        Restrictions:    restrictions,
        Plan:            plan,
    }
    
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(response)
}
```

**注册路由**: `services/billing/main.go` 或 `services/billing/cmd/server/main.go`

```go
// 修改现有路由，支持GET方法
rch.Get("/api/v1/billing/permissions/check", permissionHandler.CheckAllPermissions)
rch.Post("/api/v1/billing/permissions/check", permissionHandler.CheckPermission) // 保留单个检查
```

### 方案2: 修改前端适配后端API（临时方案）

修改前端的 `checkPermissions` 方法，调用多次后端API：

**文件**: `apps/frontend/src/lib/billing-api-client.ts`

```typescript
async checkPermissions(): Promise<{
  canUseAI: boolean;
  canCreateOffers: boolean;
  canManageAds: boolean;
  restrictions: string[];
}> {
  try {
    // 获取用户ID
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // 并发检查所有权限
    const [aiResult, offersResult, adsResult] = await Promise.all([
      this.checkSinglePermission(user.id, 'useAI'),
      this.checkSinglePermission(user.id, 'createOffers'),
      this.checkSinglePermission(user.id, 'manageAds'),
    ]);
    
    const restrictions: string[] = [];
    if (!aiResult.allowed) restrictions.push(aiResult.reason || 'AI features restricted');
    if (!offersResult.allowed) restrictions.push(offersResult.reason || 'Offer creation restricted');
    if (!adsResult.allowed) restrictions.push(adsResult.reason || 'Ads management restricted');
    
    return {
      canUseAI: aiResult.allowed,
      canCreateOffers: offersResult.allowed,
      canManageAds: adsResult.allowed,
      restrictions,
    };
  } catch (error) {
    console.error('Failed to check permissions:', error);
    // 返回默认权限（允许基本功能）
    return {
      canUseAI: false,
      canCreateOffers: true,  // 默认允许创建Offer
      canManageAds: false,
      restrictions: ['Failed to load permissions'],
    };
  }
}

private async checkSinglePermission(userId: string, feature: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  try {
    const response = await this.request<any>('/permissions/check', {
      method: 'POST',
      body: JSON.stringify({ userId, feature }),
    });
    return {
      allowed: response.allowed || false,
      reason: response.reason,
    };
  } catch (error) {
    console.error(`Failed to check permission ${feature}:`, error);
    // 默认策略：createOffers允许，其他拒绝
    return {
      allowed: feature === 'createOffers',
      reason: 'Permission check failed',
    };
  }
}
```

### 方案3: 使用Mock数据（最快临时方案）

直接在前端返回允许创建Offer：

**文件**: `apps/frontend/src/lib/billing-api-client.ts`

```typescript
async checkPermissions(): Promise<{
  canUseAI: boolean;
  canCreateOffers: boolean;
  canManageAds: boolean;
  restrictions: string[];
}> {
  // 临时方案：直接返回允许创建Offer
  console.warn('[Billing] Using fallback permissions - API not fully implemented');
  
  return {
    canUseAI: false,
    canCreateOffers: true,  // 所有用户都可以创建Offer
    canManageAds: true,
    restrictions: ['AI features require Professional or Elite subscription'],
  };
}
```

## 推荐执行步骤

### 立即执行（今天）

1. **使用方案3快速恢复功能**
   - 修改 `billing-api-client.ts`
   - 让用户可以立即使用创建Offer功能
   - 部署前端

### 短期（本周）

2. **实现方案1的后端改进**
   - 添加 `CheckAllPermissions` handler
   - 注册GET路由
   - 测试验证
   - 部署后端

3. **移除方案3的临时代码**
   - 恢复正常的API调用
   - 部署前端

### 中期（下周）

4. **完善权限系统**
   - 添加更多权限类型
   - 实现权限缓存
   - 添加权限变更通知

## 代码修改

### 立即修改（方案3）

```typescript
// apps/frontend/src/lib/billing-api-client.ts

async checkPermissions(): Promise<{
  canUseAI: boolean;
  canCreateOffers: boolean;
  canManageAds: boolean;
  restrictions: string[];
}> {
  // TODO: 实现真正的API调用
  // 当前使用fallback确保基本功能可用
  console.warn('[Billing] Using fallback permissions');
  
  try {
    // 尝试获取用户订阅信息
    const subscription = await this.getSubscription();
    
    return {
      canUseAI: subscription?.tier === 'elite' || subscription?.tier === 'professional',
      canCreateOffers: true,  // 所有用户都可以创建Offer
      canManageAds: subscription?.tier === 'elite',
      restrictions: subscription?.tier === 'starter' 
        ? ['AI features require Professional or Elite subscription']
        : [],
    };
  } catch (error) {
    console.error('[Billing] Failed to check permissions:', error);
    return {
      canUseAI: false,
      canCreateOffers: true,  // 默认允许
      canManageAds: false,
      restrictions: [],
    };
  }
}
```

## 验证

修改后验证：

```bash
# 1. 清除浏览器缓存
# 2. 重新登录
# 3. 访问 /offers 页面
# 4. 确认可以看到"Create Offer"按钮
# 5. 确认可以成功创建Offer
```

## 相关文件

- 前端API客户端: `apps/frontend/src/lib/billing-api-client.ts`
- 权限Hook: `apps/frontend/src/core/hooks/use-billing-api.ts`
- 权限守卫: `apps/frontend/src/components/PermissionGuard.tsx`
- 后端Handler: `services/billing/internal/handlers/permission.go`
- 路由配置: `services/billing/main.go`
