# 套餐配置管理系统 - 功能规格说明

**版本**: V1.0
**日期**: 2025-10-17
**状态**: 设计阶段

---

## 1. 概述

### 1.1 目标

实现一个灵活的套餐配置管理系统，支持：
- 后台管理界面配置权限、Token消耗规则、套餐价格
- 配置热更新，无需重启服务
- 前端自动同步最新套餐信息
- 多语言支持（中文¥/英文$）

### 1.2 核心价值

- **灵活性**: 无需修改代码即可调整套餐配置
- **实时性**: 配置变更立即生效
- **一致性**: 前端显示与后台配置保持同步
- **可追溯**: 配置变更历史记录

---

## 2. 套餐配置数据结构

### 2.1 权限管理配置

```typescript
interface PermissionConfig {
  feature: string;              // 功能标识
  featureName: string;          // 功能名称（支持i18n key）
  category: string;             // 分类：dashboard/offer/batchopen/adscenter
  starter: PermissionValue;     // Starter套餐权限
  professional: PermissionValue; // Professional套餐权限
  elite: PermissionValue;       // Elite套餐权限
  displayOnly: boolean;         // 是否仅用于前端显示
}

type PermissionValue = 
  | boolean                     // 支持/不支持
  | number                      // 数量限制
  | string;                     // 描述性值

// 示例数据
const permissions: PermissionConfig[] = [
  {
    feature: 'dashboard.risk_alert',
    featureName: 'subscription.features.risk_alert',
    category: 'dashboard',
    starter: false,
    professional: true,
    elite: true,
    displayOnly: false
  },
  {
    feature: 'offer.evaluation.basic',
    featureName: 'subscription.features.basic_evaluation',
    category: 'offer',
    starter: true,
    professional: true,
    elite: true,
    displayOnly: false
  },
  {
    feature: 'offer.evaluation.ai',
    featureName: 'subscription.features.ai_evaluation',
    category: 'offer',
    starter: false,
    professional: true,
    elite: true,
    displayOnly: false
  },
  {
    feature: 'offer.evaluation.concurrent',
    featureName: 'subscription.features.concurrent_evaluations',
    category: 'offer',
    starter: 1,
    professional: 10,
    elite: 100,
    displayOnly: false
  },
  {
    feature: 'offer.link_replacement',
    featureName: 'subscription.features.link_replacement',
    category: 'offer',
    starter: false,
    professional: true,
    elite: true,
    displayOnly: false
  },
  {
    feature: 'batchopen.default_curves',
    featureName: 'subscription.features.default_click_curves',
    category: 'batchopen',
    starter: 1,
    professional: 2,
    elite: 2,
    displayOnly: false
  },
  {
    feature: 'batchopen.custom_curves',
    featureName: 'subscription.features.custom_click_curves',
    category: 'batchopen',
    starter: false,
    professional: false,
    elite: true,
    displayOnly: false
  },
  {
    feature: 'batchopen.proxy_countries',
    featureName: 'subscription.features.proxy_countries',
    category: 'batchopen',
    starter: 1,
    professional: 10,
    elite: 100,
    displayOnly: false
  },
  {
    feature: 'adscenter.active_accounts',
    featureName: 'subscription.features.active_ads_accounts',
    category: 'adscenter',
    starter: 1,
    professional: 10,
    elite: 100,
    displayOnly: false
  },
  {
    feature: 'general.new_features',
    featureName: 'subscription.features.new_features',
    category: 'general',
    starter: false,
    professional: 'partial',
    elite: true,
    displayOnly: true  // 仅前端显示，不做权限检查
  }
];
```

### 2.2 Token消耗规则配置

```typescript
interface TokenCostConfig {
  action: string;               // 操作标识
  actionName: string;           // 操作名称（支持i18n key）
  category: string;             // 分类
  starter: TokenCost;           // Starter套餐消耗
  professional: TokenCost;      // Professional套餐消耗
  elite: TokenCost;             // Elite套餐消耗
}

type TokenCost = 
  | number                      // Token数量
  | 'unsupported';              // 不支持

// 示例数据
const tokenCosts: TokenCostConfig[] = [
  {
    action: 'offer.evaluation.basic',
    actionName: 'subscription.token_costs.basic_evaluation',
    category: 'offer',
    starter: 1,
    professional: 1,
    elite: 1
  },
  {
    action: 'offer.evaluation.ai',
    actionName: 'subscription.token_costs.ai_evaluation',
    category: 'offer',
    starter: 'unsupported',
    professional: 2,
    elite: 2
  },
  {
    action: 'offer.link_replacement',
    actionName: 'subscription.token_costs.link_replacement',
    category: 'offer',
    starter: 'unsupported',
    professional: 1,
    elite: 1
  },
  {
    action: 'batchopen.successful_click',
    actionName: 'subscription.token_costs.successful_click',
    category: 'batchopen',
    starter: 1,
    professional: 1,
    elite: 1
  }
];
```

### 2.3 套餐价格配置

```typescript
interface PricingConfig {
  plan: 'starter' | 'professional' | 'elite';
  displayName: string;          // 显示名称（支持i18n key）
  description: string;          // 描述（支持i18n key）
  badge?: string;               // 徽章（如"推荐"）
  recommended?: boolean;        // 是否推荐
  tokenQuota: number;           // Token配额
  pricing: {
    monthly: PriceDetail;
    yearly: PriceDetail;
  };
}

interface PriceDetail {
  amount: number;               // 价格金额（统一使用人民币）
  currency: 'CNY';              // 货币代码
  stripePriceId: string;        // Stripe价格ID
  discount?: number;            // 折扣百分比（年付）
}

// 示例数据
const pricing: PricingConfig[] = [
  {
    plan: 'starter',
    displayName: 'subscription.plans.starter.name',
    description: 'subscription.plans.starter.description',
    tokenQuota: 100,
    pricing: {
      monthly: {
        amount: 298,
        currency: 'CNY',
        stripePriceId: 'starter-plan-mth'
      },
      yearly: {
        amount: 1788,
        currency: 'CNY',
        stripePriceId: 'starter-plan-yr',
        discount: 50
      }
    }
  },
  {
    plan: 'professional',
    displayName: 'subscription.plans.professional.name',
    description: 'subscription.plans.professional.description',
    badge: 'subscription.plans.recommended',
    recommended: true,
    tokenQuota: 1000,
    pricing: {
      monthly: {
        amount: 998,
        currency: 'CNY',
        stripePriceId: 'pro-plan-mth'
      },
      yearly: {
        amount: 5988,
        currency: 'CNY',
        stripePriceId: 'pro-plan-yr',
        discount: 50
      }
    }
  },
  {
    plan: 'elite',
    displayName: 'subscription.plans.elite.name',
    description: 'subscription.plans.elite.description',
    tokenQuota: 10000,
    pricing: {
      monthly: {
        amount: 2998,
        currency: 'CNY',
        stripePriceId: 'elite-plan-mth'
      },
      yearly: {
        amount: 17988,
        currency: 'CNY',
        stripePriceId: 'elite-plan-yr',
        discount: 50
      }
    }
  }
];
```

---

## 3. 数据库设计

### 3.1 表结构

```sql
-- 权限配置表
CREATE TABLE subscription_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature VARCHAR(255) NOT NULL UNIQUE,
  feature_name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  starter_value JSONB NOT NULL,
  professional_value JSONB NOT NULL,
  elite_value JSONB NOT NULL,
  display_only BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Token消耗规则表
CREATE TABLE subscription_token_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(255) NOT NULL UNIQUE,
  action_name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  starter_cost JSONB NOT NULL,
  professional_cost JSONB NOT NULL,
  elite_cost JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- 套餐价格配置表
CREATE TABLE subscription_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  badge VARCHAR(100),
  recommended BOOLEAN DEFAULT FALSE,
  token_quota INTEGER NOT NULL,
  monthly_amount INTEGER NOT NULL,
  monthly_stripe_price_id VARCHAR(255) NOT NULL,
  yearly_amount INTEGER NOT NULL,
  yearly_stripe_price_id VARCHAR(255) NOT NULL,
  yearly_discount INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- 配置变更历史表
CREATE TABLE subscription_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type VARCHAR(50) NOT NULL, -- 'permission' | 'token_cost' | 'pricing'
  config_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL, -- 'create' | 'update' | 'delete'
  old_value JSONB,
  new_value JSONB NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_permissions_category ON subscription_permissions(category);
CREATE INDEX idx_token_costs_category ON subscription_token_costs(category);
CREATE INDEX idx_config_history_type ON subscription_config_history(config_type, changed_at DESC);
```

---

## 4. API设计

### 4.1 Billing服务API

#### 获取权限配置
```
GET /api/v1/subscription/config/permissions
Response: PermissionConfig[]
```

#### 获取Token消耗规则
```
GET /api/v1/subscription/config/token-costs
Response: TokenCostConfig[]
```

#### 获取套餐价格
```
GET /api/v1/subscription/config/pricing
Response: PricingConfig[]
```

#### 获取完整配置（前端用）
```
GET /api/v1/subscription/config/all
Response: {
  permissions: PermissionConfig[],
  tokenCosts: TokenCostConfig[],
  pricing: PricingConfig[],
  version: string  // 配置版本号，用于缓存
}
```

#### 检查权限（微服务用）
```
POST /api/v1/subscription/check-permission
Request: {
  userId: string,
  feature: string
}
Response: {
  allowed: boolean,
  value?: number | string,
  reason?: string
}
```

#### 获取Token消耗（微服务用）
```
POST /api/v1/subscription/get-token-cost
Request: {
  userId: string,
  action: string
}
Response: {
  cost: number,
  plan: string
}
```

### 4.2 Console服务API（管理后台）

#### 更新权限配置
```
PUT /api/v1/console/subscription/permissions/:feature
Request: {
  starter: PermissionValue,
  professional: PermissionValue,
  elite: PermissionValue
}
Response: PermissionConfig
```

#### 更新Token消耗规则
```
PUT /api/v1/console/subscription/token-costs/:action
Request: {
  starter: TokenCost,
  professional: TokenCost,
  elite: TokenCost
}
Response: TokenCostConfig
```

#### 更新套餐价格
```
PUT /api/v1/console/subscription/pricing/:plan
Request: PricingConfig
Response: PricingConfig
```

#### 获取配置变更历史
```
GET /api/v1/console/subscription/config/history?type=permission&limit=50
Response: ConfigHistoryEntry[]
```

---

## 5. 热更新机制

### 5.1 配置缓存策略

**Billing服务**:
```go
type ConfigCache struct {
  permissions   map[string]*PermissionConfig
  tokenCosts    map[string]*TokenCostConfig
  pricing       map[string]*PricingConfig
  version       string
  lastUpdated   time.Time
  mu            sync.RWMutex
}

// 缓存刷新策略
// 1. 定时刷新：每30秒检查一次
// 2. 主动刷新：配置更新后通过Pub/Sub通知
// 3. 懒加载：首次请求时加载
```

**前端缓存**:
```typescript
// 使用SWR进行缓存管理
const { data: config, mutate } = useSWR(
  '/api/v1/subscription/config/all',
  fetcher,
  {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60000, // 1分钟内不重复请求
  }
);

// 监听配置更新事件（SSE）
useEffect(() => {
  const eventSource = new EventSource('/api/v1/subscription/config/updates');
  eventSource.onmessage = (event) => {
    const { version } = JSON.parse(event.data);
    if (version !== config?.version) {
      mutate(); // 重新获取配置
    }
  };
  return () => eventSource.close();
}, [config?.version]);
```

### 5.2 配置更新流程

```
1. 管理员在Console更新配置
   ↓
2. Console服务保存到数据库
   ↓
3. 记录变更历史
   ↓
4. 发布Pub/Sub消息: config.updated
   ↓
5. Billing服务接收消息，刷新缓存
   ↓
6. 前端通过SSE接收通知，重新获取配置
   ↓
7. 配置立即生效
```

---

## 6. 前端实现

### 6.1 套餐展示页面

```typescript
// apps/frontend/src/app/settings/subscription/page.tsx
import { useSubscriptionConfig } from '~/lib/hooks/useSubscriptionConfig';

export default function SubscriptionPage() {
  const { pricing, permissions, tokenCosts, isLoading } = useSubscriptionConfig();
  const { t, i18n } = useTranslation();
  
  // 货币符号根据语言切换
  const currencySymbol = i18n.language === 'zh-CN' ? '¥' : '$';
  
  return (
    <div>
      {pricing.map(plan => (
        <PricingCard
          key={plan.plan}
          plan={plan}
          currencySymbol={currencySymbol}
          features={permissions.filter(p => p[plan.plan])}
        />
      ))}
    </div>
  );
}
```

### 6.2 权限检查Hook

```typescript
// apps/frontend/src/lib/hooks/usePermission.ts
export function usePermission(feature: string) {
  const { subscription } = useSubscription();
  const { permissions } = useSubscriptionConfig();
  
  const permission = permissions.find(p => p.feature === feature);
  if (!permission) return { allowed: false, value: null };
  
  const plan = subscription?.plan || 'starter';
  const value = permission[plan];
  
  return {
    allowed: value !== false && value !== 'unsupported',
    value: typeof value === 'number' ? value : null,
    limit: typeof value === 'number' ? value : null
  };
}

// 使用示例
const { allowed, limit } = usePermission('offer.evaluation.concurrent');
if (!allowed) {
  toast.error('当前套餐不支持此功能');
  return;
}
if (currentCount >= limit) {
  toast.error(`并发评估数量已达上限（${limit}个）`);
  return;
}
```

### 6.3 Token消耗显示

```typescript
// 显示操作所需Token
export function TokenCostBadge({ action }: { action: string }) {
  const { subscription } = useSubscription();
  const { tokenCosts } = useSubscriptionConfig();
  const { t } = useTranslation();
  
  const cost = tokenCosts.find(c => c.action === action);
  if (!cost) return null;
  
  const plan = subscription?.plan || 'starter';
  const tokenCost = cost[plan];
  
  if (tokenCost === 'unsupported') {
    return <Badge variant="secondary">{t('subscription.unsupported')}</Badge>;
  }
  
  return (
    <Badge variant="outline">
      {tokenCost} {t('subscription.tokens')}
    </Badge>
  );
}
```

---

## 7. 后台管理界面

### 7.1 配置管理页面结构

```
/manage/subscription/
├── permissions          # 权限管理
├── token-costs          # Token消耗规则
├── pricing              # 套餐价格
└── history              # 变更历史
```

### 7.2 权限管理界面

```typescript
// apps/frontend/src/app/manage/subscription/permissions/page.tsx
export default function PermissionsManagementPage() {
  const { permissions, mutate } = useSubscriptionConfig();
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>功能</TableHead>
          <TableHead>分类</TableHead>
          <TableHead>Starter</TableHead>
          <TableHead>Professional</TableHead>
          <TableHead>Elite</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {permissions.map(permission => (
          <TableRow key={permission.feature}>
            <TableCell>{permission.featureName}</TableCell>
            <TableCell>{permission.category}</TableCell>
            <TableCell>
              <PermissionValueEditor
                value={permission.starter}
                onChange={(value) => updatePermission(permission.feature, 'starter', value)}
              />
            </TableCell>
            <TableCell>
              <PermissionValueEditor
                value={permission.professional}
                onChange={(value) => updatePermission(permission.feature, 'professional', value)}
              />
            </TableCell>
            <TableCell>
              <PermissionValueEditor
                value={permission.elite}
                onChange={(value) => updatePermission(permission.feature, 'elite', value)}
              />
            </TableCell>
            <TableCell>
              <Button onClick={() => savePermission(permission)}>保存</Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

---

## 8. 国际化支持

### 8.1 翻译文件

```json
// apps/frontend/public/locales/zh-CN/subscription.json
{
  "features": {
    "risk_alert": "风险提醒",
    "basic_evaluation": "普通评估",
    "ai_evaluation": "AI评估",
    "concurrent_evaluations": "评估并发数",
    "link_replacement": "换链接",
    "default_click_curves": "默认点击曲线",
    "custom_click_curves": "定制点击曲线",
    "proxy_countries": "代理IP支持的国家",
    "active_ads_accounts": "绑定生效的Ads账号数量",
    "new_features": "更多新功能"
  },
  "token_costs": {
    "basic_evaluation": "普通评估",
    "ai_evaluation": "AI评估",
    "link_replacement": "换链接",
    "successful_click": "每一个成功点击"
  },
  "plans": {
    "starter": {
      "name": "Starter套餐",
      "description": "适合个人联盟营销人员，小规模测试阶段"
    },
    "professional": {
      "name": "Pro套餐",
      "description": "适合专业营销人员和小型工作室"
    },
    "elite": {
      "name": "Elite套餐",
      "description": "适合独立站主和代理商"
    },
    "recommended": "推荐"
  },
  "currency": {
    "symbol": "¥",
    "monthly": "/月",
    "yearly": "/年"
  },
  "unsupported": "不支持",
  "tokens": "tokens"
}
```

```json
// apps/frontend/public/locales/en/subscription.json
{
  "currency": {
    "symbol": "$",
    "monthly": "/mo",
    "yearly": "/yr"
  }
}
```

---

## 9. 实施计划

### Phase 1: 数据库和API（1周）
- [ ] 创建数据库表结构
- [ ] 实现Billing服务配置API
- [ ] 实现Console服务管理API
- [ ] 数据迁移脚本（从代码迁移到数据库）

### Phase 2: 热更新机制（1周）
- [ ] 实现配置缓存
- [ ] 实现Pub/Sub通知
- [ ] 实现SSE推送
- [ ] 测试配置更新流程

### Phase 3: 前端集成（1周）
- [ ] 实现useSubscriptionConfig hook
- [ ] 实现usePermission hook
- [ ] 更新套餐展示页面
- [ ] 实现Token消耗显示

### Phase 4: 后台管理界面（1周）
- [ ] 权限管理页面
- [ ] Token消耗规则管理页面
- [ ] 套餐价格管理页面
- [ ] 配置变更历史页面

### Phase 5: 测试和上线（1周）
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能测试
- [ ] 预发环境验证
- [ ] 生产环境上线

---

## 10. 注意事项

### 10.1 数据一致性
- 配置更新必须是原子操作
- 使用数据库事务确保一致性
- 配置变更必须记录历史

### 10.2 缓存失效
- 配置更新后立即通知所有服务
- 前端缓存失效策略
- 避免缓存穿透

### 10.3 向后兼容
- 保留旧的硬编码配置作为fallback
- 逐步迁移到数据库配置
- 提供配置导入导出功能

### 10.4 安全性
- 只有管理员可以修改配置
- 配置变更需要审计日志
- 敏感配置加密存储

---

**维护人**: Product & Engineering Team
**最后更新**: 2025-10-17
