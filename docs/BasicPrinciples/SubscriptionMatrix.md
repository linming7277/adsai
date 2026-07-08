# AdsAI 套餐权限与Token消耗矩阵

**版本**: V1.0
**日期**: 2025-10-17
**状态**: 标准配置（将迁移到数据库）

---

## 1. 权限管理矩阵

| 功能模块 | 功能名称 | Starter套餐 | Pro套餐 | Elite套餐 |
|---------|---------|------------|---------|----------|
| **用户仪表盘** | | | | |
| | 风险提醒 | ❌ 不支持 | ✅ 支持 | ✅ 支持 |
| **Offer管理** | | | | |
| | Offer评估-普通评估 | ✅ 支持 | ✅ 支持 | ✅ 支持 |
| | Offer评估-AI评估 | ❌ 不支持 | ✅ 支持 | ✅ 支持 |
| | Offer评估-评估并发数 | 1个 | 10个 | 100个 |
| | 换链接 | ❌ 不支持 | ✅ 支持 | ✅ 支持 |
| **真实补点击** | | | | |
| | 默认点击曲线 | 1个 | 2个 | 2个 |
| | 定制点击曲线 | ❌ 不支持 | ❌ 不支持 | ✅ 支持 |
| | 代理IP支持的国家 | 1个（仅US） | 10个 | 100个 |
| **Ads中心** | | | | |
| | 绑定生效的Ads账号数量 | 1个 | 10个 | 100个 |
| **更多功能** | | | | |
| | 更多新功能 | ❌ 不支持 | 🔶 部分支持 | ✅ 全部支持 |

**注意**：
- "更多新功能"仅用于前端套餐信息显示，不涉及具体权限检查
- 数字类型的权限表示数量限制
- 布尔类型的权限表示是否支持

---

## 2. Token消耗规则矩阵

| 功能模块 | 操作名称 | Starter套餐 | Pro套餐 | Elite套餐 |
|---------|---------|------------|---------|----------|
| **Offer管理** | | | | |
| | Offer评估-普通评估 | 1个/次 | 1个/次 | 1个/次 |
| | Offer评估-AI评估 | ❌ 不支持 | 2个/次 | 2个/次 |
| | 换链接 | ❌ 不支持 | 1个/次 | 1个/次 |
| **真实补点击** | | | | |
| | 每一个成功点击 | 1个/次 | 1个/次 | 1个/次 |

**说明**：
- "不支持"表示该套餐无法使用此功能
- Token消耗在操作成功后扣除
- 操作失败时Token会自动返还

---

## 3. 套餐价格矩阵

### 3.1 价格表（人民币）

| 套餐 | 月付 | 年付 | 年付优惠 | Token配额 |
|------|------|------|---------|----------|
| **Starter套餐** | ¥298/月 | ¥1788/年 | 5折优惠 | 100个/月 |
| **Pro套餐** | ¥998/月 | ¥5988/年 | 5折优惠 | 1,000个/月 |
| **Elite套餐** | ¥2998/月 | ¥17988/年 | 5折优惠 | 10,000个/月 |

### 3.2 价格显示规则

**中文环境**：
- 货币符号：¥
- 月付显示：¥298/月
- 年付显示：¥1788/年（5折优惠）

**英文环境**：
- 货币符号：$
- 月付显示：$298/mo
- 年付显示：$1788/yr (50% off)
- **注意**：价格数字不变，仅货币符号和单位改变

---

## 4. 功能标识符映射

### 4.1 权限功能标识

```typescript
// 用于代码中的权限检查
const PERMISSION_FEATURES = {
  // Dashboard
  DASHBOARD_RISK_ALERT: 'dashboard.risk_alert',
  
  // Offer
  OFFER_EVALUATION_BASIC: 'offer.evaluation.basic',
  OFFER_EVALUATION_AI: 'offer.evaluation.ai',
  OFFER_EVALUATION_CONCURRENT: 'offer.evaluation.concurrent',
  OFFER_LINK_REPLACEMENT: 'offer.link_replacement',
  
  // Batchopen
  BATCHOPEN_DEFAULT_CURVES: 'batchopen.default_curves',
  BATCHOPEN_CUSTOM_CURVES: 'batchopen.custom_curves',
  BATCHOPEN_PROXY_COUNTRIES: 'batchopen.proxy_countries',
  
  // Adscenter
  ADSCENTER_ACTIVE_ACCOUNTS: 'adscenter.active_accounts',
  
  // General
  GENERAL_NEW_FEATURES: 'general.new_features',
} as const;
```

### 4.2 Token消耗操作标识

```typescript
// 用于Token消耗计算
const TOKEN_COST_ACTIONS = {
  // Offer
  OFFER_EVALUATION_BASIC: 'offer.evaluation.basic',
  OFFER_EVALUATION_AI: 'offer.evaluation.ai',
  OFFER_LINK_REPLACEMENT: 'offer.link_replacement',
  
  // Batchopen
  BATCHOPEN_SUCCESSFUL_CLICK: 'batchopen.successful_click',
} as const;
```

---

## 5. 使用示例

### 5.1 前端权限检查

```typescript
import { usePermission } from '~/lib/hooks/usePermission';
import { PERMISSION_FEATURES } from '~/lib/constants/permissions';

function OfferEvaluationButton() {
  const { allowed, limit } = usePermission(PERMISSION_FEATURES.OFFER_EVALUATION_CONCURRENT);
  const currentConcurrent = useCurrentConcurrentCount();
  
  const canEvaluate = allowed && currentConcurrent < limit;
  
  return (
    <Button 
      disabled={!canEvaluate}
      onClick={handleEvaluate}
    >
      评估 {!allowed && '(需升级套餐)'}
      {allowed && currentConcurrent >= limit && `(并发已达上限 ${limit})`}
    </Button>
  );
}
```

### 5.2 后端权限检查

```go
// services/siterank/internal/handlers/evaluation.go
func (h *Handler) CreateEvaluation(ctx context.Context, req *CreateEvaluationRequest) error {
    // 检查并发评估权限
    permission, err := h.billingClient.CheckPermission(ctx, &billing.CheckPermissionRequest{
        UserId:  req.UserId,
        Feature: "offer.evaluation.concurrent",
    })
    if err != nil {
        return err
    }
    
    if !permission.Allowed {
        return errors.New("当前套餐不支持评估功能")
    }
    
    // 检查当前并发数
    currentCount, err := h.repo.GetConcurrentCount(ctx, req.UserId)
    if err != nil {
        return err
    }
    
    limit := int(permission.Value)
    if currentCount >= limit {
        return fmt.Errorf("并发评估数量已达上限（%d个）", limit)
    }
    
    // 继续处理...
}
```

### 5.3 Token消耗计算

```go
// services/siterank/internal/handlers/evaluation.go
func (h *Handler) CalculateTokenCost(ctx context.Context, req *EvaluationRequest) (int, error) {
    var totalCost int
    
    // 基础评估
    basicCost, err := h.billingClient.GetTokenCost(ctx, &billing.GetTokenCostRequest{
        UserId: req.UserId,
        Action: "offer.evaluation.basic",
    })
    if err != nil {
        return 0, err
    }
    totalCost += basicCost.Cost
    
    // AI评估（可选）
    if req.EnableAI {
        aiCost, err := h.billingClient.GetTokenCost(ctx, &billing.GetTokenCostRequest{
            UserId: req.UserId,
            Action: "offer.evaluation.ai",
        })
        if err != nil {
            return 0, err
        }
        if aiCost.Cost == 0 {
            return 0, errors.New("当前套餐不支持AI评估")
        }
        totalCost += aiCost.Cost
    }
    
    return totalCost, nil
}
```

---

## 6. 数据迁移计划

### 6.1 迁移步骤

1. **创建数据库表**（见 SubscriptionConfigManagement.md）
2. **导入初始数据**：
   ```sql
   -- 从本文档的矩阵表导入到数据库
   INSERT INTO subscription_permissions (feature, feature_name, category, starter_value, professional_value, elite_value, display_only)
   VALUES 
     ('dashboard.risk_alert', 'subscription.features.risk_alert', 'dashboard', 'false', 'true', 'true', false),
     ('offer.evaluation.basic', 'subscription.features.basic_evaluation', 'offer', 'true', 'true', 'true', false),
     -- ... 更多数据
   ```
3. **更新代码**：从硬编码改为API调用
4. **测试验证**：确保功能正常
5. **灰度发布**：逐步切换到数据库配置
6. **清理代码**：移除硬编码配置

### 6.2 向后兼容

```typescript
// 保留fallback机制
export function usePermission(feature: string) {
  const { permissions, isLoading, error } = useSubscriptionConfig();
  
  // 如果API失败，使用硬编码配置
  if (error || !permissions) {
    return getHardcodedPermission(feature);
  }
  
  // 使用数据库配置
  return getDynamicPermission(feature, permissions);
}
```

---

## 7. 配置变更流程

### 7.1 变更申请

1. 产品经理提出配置变更需求
2. 技术评审配置变更影响
3. 确定变更时间和范围

### 7.2 变更执行

1. 管理员登录Console后台
2. 进入"套餐配置管理"
3. 修改相应配置项
4. 保存并确认
5. 系统自动推送更新

### 7.3 变更验证

1. 检查配置是否生效
2. 验证前端显示是否正确
3. 测试权限检查是否正常
4. 查看变更历史记录

---

## 8. 监控和告警

### 8.1 监控指标

- 配置API响应时间
- 配置缓存命中率
- 权限检查失败率
- Token消耗异常率

### 8.2 告警规则

- 配置API响应时间 > 500ms
- 配置缓存命中率 < 95%
- 权限检查失败率 > 5%
- Token消耗异常（负数、超大值）

---

**维护人**: Product & Engineering Team
**最后更新**: 2025-10-17
**下次审查**: 配置迁移到数据库后
