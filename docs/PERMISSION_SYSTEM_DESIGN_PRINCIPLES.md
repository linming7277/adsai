# 权限系统设计原则

## 核心原则

### 1. 默认允许原则（Default Allow）

**不在权限管控中的功能，应该都是允许的。**

这是一个重要的设计决策，原因如下：

#### 为什么采用"默认允许"？

1. **用户友好**: 新功能默认可用，不需要等待权限配置
2. **开发效率**: 开发新功能时不需要立即配置权限
3. **渐进式管控**: 只对需要限制的功能添加权限控制
4. **避免锁定**: 防止配置错误导致用户无法使用基本功能

#### 对比：默认拒绝 vs 默认允许

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **默认拒绝** | 安全性高，明确控制 | 配置繁琐，易出错 | 高安全要求系统 |
| **默认允许** | 灵活，用户友好 | 需要明确标记限制 | SaaS产品，快速迭代 |

**我们选择：默认允许** ✅

## 实现

### 后端实现

**文件**: `services/billing/internal/handlers/permission.go`

```go
func (h *PermissionHandler) evaluatePermission(plan, feature string, permissions map[string]interface{}) *CheckPermissionResponse {
    value, exists := permissions[feature]
    
    if !exists {
        // 🎯 核心原则：不在权限管控中的功能，默认允许
        return &CheckPermissionResponse{
            Allowed: true,
            Value:   nil,
            Plan:    plan,
            Reason:  "Feature not under permission control - available to all plans",
        }
    }
    
    // 如果在权限管控中，则根据配置判断
    // ...
}
```

### 前端实现

**文件**: `apps/frontend/src/lib/billing-api-client.ts`

```typescript
async checkPermissions() {
  try {
    const subscription = await this.getSubscription();
    
    if (!subscription) {
      // 无订阅时，允许基本功能
      return {
        canUseAI: false,           // AI功能需要订阅
        canCreateOffers: true,     // 创建Offer是基本功能
        canManageAds: false,       // 广告管理需要高级订阅
        restrictions: ['Please subscribe to access premium features'],
      };
    }
    
    // 基于订阅tier判断权限
    // ...
  } catch (error) {
    // 错误时，允许基本功能
    return {
      canUseAI: false,
      canCreateOffers: true,  // 默认允许基本功能
      canManageAds: false,
      restrictions: ['Failed to load permissions'],
    };
  }
}
```

## 权限分类

### 基本功能（Basic Features）
**默认允许，所有用户可用**

- ✅ 创建Offer
- ✅ 查看Offer列表
- ✅ 编辑自己的Offer
- ✅ 基础评估
- ✅ 查看Dashboard
- ✅ 管理个人设置

**实现方式**: 不在 `subscription_plan_configs.permissions` 中配置

### 高级功能（Premium Features）
**需要特定套餐，明确配置**

- 🔒 AI评估（Professional/Elite）
- 🔒 批量操作（Elite）
- 🔒 数据导出（Professional/Elite）
- 🔒 广告账号管理（Elite）
- 🔒 API访问（Elite）

**实现方式**: 在 `subscription_plan_configs.permissions` 中明确配置

```json
{
  "useAI": true,           // Professional/Elite
  "batchOperations": true, // Elite only
  "exportData": true,      // Professional/Elite
  "manageAds": true,       // Elite only
  "apiAccess": true        // Elite only
}
```

## 数据库配置示例

### Starter套餐
```sql
INSERT INTO subscription_plan_configs (tier, permissions) VALUES (
  'Starter',
  '{
    "useAI": false,
    "batchOperations": false,
    "exportData": false,
    "manageAds": false,
    "apiAccess": false
  }'::jsonb
);
```

**注意**: `createOffers` 不在配置中，因此默认允许 ✅

### Professional套餐
```sql
INSERT INTO subscription_plan_configs (tier, permissions) VALUES (
  'Professional',
  '{
    "useAI": true,
    "batchOperations": false,
    "exportData": true,
    "manageAds": false,
    "apiAccess": false
  }'::jsonb
);
```

### Elite套餐
```sql
INSERT INTO subscription_plan_configs (tier, permissions) VALUES (
  'Elite',
  '{
    "useAI": true,
    "batchOperations": true,
    "exportData": true,
    "manageAds": true,
    "apiAccess": true
  }'::jsonb
);
```

## 添加新功能的流程

### 场景1: 添加基本功能
**示例**: 添加"分享Offer"功能

1. ✅ 开发功能
2. ✅ 部署上线
3. ❌ **不需要**配置权限
4. ✅ 所有用户自动可用

**原因**: 基本功能默认允许

### 场景2: 添加高级功能
**示例**: 添加"AI自动优化"功能

1. ✅ 开发功能
2. ✅ 决定权限策略（如：Elite专属）
3. ✅ 更新数据库配置
   ```sql
   UPDATE subscription_plan_configs
   SET permissions = jsonb_set(
     permissions,
     '{aiAutoOptimize}',
     'true'::jsonb
   )
   WHERE tier = 'Elite';
   ```
4. ✅ 添加前端权限检查
   ```typescript
   <PermissionGuard requirePermission="aiAutoOptimize">
     <AIAutoOptimizeButton />
   </PermissionGuard>
   ```
5. ✅ 部署上线

### 场景3: 将基本功能升级为高级功能
**示例**: "数据导出"从免费变为付费

1. ⚠️ **谨慎决策**（影响现有用户）
2. ✅ 通知用户变更
3. ✅ 添加权限配置
4. ✅ 设置过渡期
5. ✅ 部署上线

## 权限检查最佳实践

### ✅ 推荐做法

```typescript
// 1. 只对高级功能添加权限检查
<PermissionGuard requirePermission="useAI">
  <AIEvaluationButton />
</PermissionGuard>

// 2. 基本功能不需要权限检查
<CreateOfferButton />  // 直接使用，无需Guard

// 3. 提供清晰的升级提示
<PermissionGuard 
  requirePermission="batchOperations"
  showUpgradePrompt={true}
>
  <BatchOperationsPanel />
</PermissionGuard>
```

### ❌ 避免做法

```typescript
// ❌ 不要对基本功能添加权限检查
<PermissionGuard requirePermission="createOffers">
  <CreateOfferButton />
</PermissionGuard>

// ❌ 不要在权限配置中列出所有功能
{
  "createOffers": true,  // 不需要，默认就是true
  "viewOffers": true,    // 不需要
  "editOffers": true,    // 不需要
  "useAI": true          // 需要，这是高级功能
}

// ❌ 不要在错误时拒绝所有功能
catch (error) {
  return {
    canCreateOffers: false,  // ❌ 错误！应该允许基本功能
    canUseAI: false,
  };
}
```

## 错误处理策略

### 权限检查失败时的Fallback

```typescript
async checkPermissions() {
  try {
    // 尝试从后端获取权限
    const result = await this.request('/permissions/check');
    return result;
  } catch (error) {
    console.error('Permission check failed:', error);
    
    // Fallback: 允许基本功能，拒绝高级功能
    return {
      canUseAI: false,           // 高级功能：默认拒绝
      canCreateOffers: true,     // 基本功能：默认允许 ✅
      canManageAds: false,       // 高级功能：默认拒绝
      canExportData: false,      // 高级功能：默认拒绝
      restrictions: ['Failed to load permissions - using safe defaults'],
    };
  }
}
```

### 原则
1. **基本功能**: 错误时允许（fail-open）
2. **高级功能**: 错误时拒绝（fail-closed）
3. **安全性**: 不影响核心业务流程
4. **用户体验**: 不因技术问题阻止基本使用

## 监控和告警

### 需要监控的指标

1. **权限检查失败率**
   - 阈值: > 5%
   - 告警: 立即通知

2. **Fallback触发频率**
   - 阈值: > 10%
   - 告警: 需要调查

3. **权限配置缺失**
   - 检查: 每日
   - 告警: 发现新功能无配置

4. **用户投诉**
   - 关键词: "无法使用"、"需要升级"
   - 优先级: P0

## 文档和沟通

### 对开发团队
- 📋 新功能开发checklist
- 📚 权限系统使用指南
- 🔍 权限配置审查流程

### 对产品团队
- 📊 功能分级标准
- 💰 定价策略指导
- 📈 用户升级转化分析

### 对用户
- 📖 套餐对比表
- ❓ 常见问题解答
- 💡 升级价值说明

## 总结

### 核心原则
✅ **默认允许**: 不在权限管控中的功能，都是允许的  
🔒 **明确限制**: 只对需要限制的功能添加权限配置  
🛡️ **安全Fallback**: 错误时允许基本功能，拒绝高级功能  
📊 **持续监控**: 跟踪权限系统的健康状况

### 实施要点
1. 基本功能不配置权限（默认允许）
2. 高级功能明确配置权限
3. 错误处理保证基本功能可用
4. 定期审查权限配置
5. 监控权限系统健康度

### 相关文档
- [权限API不匹配修复](./PERMISSION_API_MISMATCH_FIX.md)
- [创建Offer权限修复总结](./CREATE_OFFER_PERMISSION_FIX_SUMMARY.md)
- [订阅系统实现总结](./SUBSCRIPTION_SYSTEM_IMPLEMENTATION_SUMMARY.md)
