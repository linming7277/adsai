# AutoAds 订阅系统优化分析

**版本**: V1.0
**日期**: 2025-10-17
**状态**: 现状分析

---

## 一、现有实现分析

### 1.1 Billing服务（已实现）

#### ✅ 数据库表结构（已完成）
**文件**: `services/billing/internal/migrations/000007_subscription_plan_configs.up.sql`

**已创建的表**:
1. `subscription_plan_configs` - 套餐配置主表
   - 支持3个套餐：starter, pro, elite
   - JSONB存储：permissions, token_costs, pricing, marketing_features
   - 版本控制和审计字段

2. `subscription_config_history` - 配置变更历史表
   - 记录变更前后的完整配置
   - 审计信息（changed_by, changed_at）

**初始数据**:
- ✅ Starter套餐配置已插入
- ✅ Pro套餐配置已插入
- ✅ Elite套餐配置已插入

#### ✅ API Handler（已实现）
**文件**: `services/billing/internal/handlers/subscription_plans.go`

**已实现的功能**:
- `GetAllPlans()` - 获取所有活跃套餐配置
- `GetPlanByTier()` - 获取特定套餐配置
- `UpdatePlan()` - 更新套餐配置（管理员专用）
- `fetchAllPlansFromDB()` - 从数据库获取套餐
- `fetchPlanFromDB()` - 从数据库获取单个套餐
- `updatePlanConfig()` - 更新套餐配置
- `insertConfigHistory()` - 插入配置变更历史
- `invalidateCache()` - 失效Redis缓存
- `publishConfigUpdateEvent()` - 发布Pub/Sub事件

**使用的技术**:
- Gin框架（但billing服务主要用标准http.ServeMux）
- Redis缓存（5分钟TTL）
- Google Cloud Pub/Sub
- PostgreSQL JSONB

#### ⚠️ 问题：框架不一致
- billing服务主要使用`http.ServeMux`
- 但`subscription_plans.go`使用了Gin框架
- 需要统一到`http.ServeMux`

#### ✅ Token管理（已实现）
**文件**: `services/billing/internal/tokens/service.go`

**已实现的功能**:
- `CheckAndReserveTokens()` - Token预留（两阶段提交）
- `ConfirmTokenDeduction()` - 确认Token扣除
- `RefundTokens()` - Token退款
- `GetBalance()` - 获取Token余额（带Redis缓存）
- `GetBalanceSummary()` - 获取Token余额摘要
- `CheckSubscriptionLevel()` - 检查订阅等级

#### ✅ Token规则管理（已实现）
**文件**: `services/billing/internal/handlers/token_rules_handlers.go`

**已实现的功能**:
- `getTokenRules()` - 获取所有Token消耗规则
- `createTokenRule()` - 创建Token消耗规则
- `getTokenRuleByID()` - 获取单个规则
- `updateTokenRule()` - 更新规则
- `deleteTokenRule()` - 软删除规则（设置enabled=false）

**使用的表**: `token_consumption_rules`

---

### 1.2 Gateway Middleware服务（规划中）

#### 📋 当前状态
**文件**: `services/gateway-middleware/IMPLEMENTATION_PLAN.md`

**Phase 1: MVP框架（已完成）**:
- ✅ 项目结构创建
- ✅ 配置加载模块
- ✅ JWT验证中间件
- ✅ 反向代理中间件
- ✅ 路由配置文件

**Phase 2-4: 待实施（8周计划）**:
- 🚧 Redis缓存集成
- 🚧 订阅套餐查询中间件
- 🚧 功能权限检查中间件
- 🚧 Token预留和管理中间件
- 🚧 配置热更新（Pub/Sub）
- 🚧 限流中间件

#### 🎯 Gateway Middleware的职责
1. **JWT验证** - 验证用户身份
2. **订阅查询** - 查询用户订阅套餐（从billing服务）
3. **权限检查** - 检查用户是否有权限访问API
4. **Token预留** - 预留Token（调用billing服务）
5. **请求代理** - 转发请求到业务服务
6. **请求头注入** - 注入user_id, tier, reservation_id等

---

### 1.3 前端（硬编码）

#### ❌ 问题：配置硬编码
**文件**: `apps/frontend/src/configuration.ts`

**当前实现**:
```typescript
stripe: {
  products: [
    {
      name: 'Starter',
      features: ['100 tokens/月', '基础评估', ...],
      plans: [
        { name: 'Monthly', price: '¥298', stripePriceId: 'starter-plan-mth' },
        { name: 'Yearly', price: '¥1788', stripePriceId: 'starter-plan-yr' }
      ]
    },
    // ... Professional, Elite
  ]
}
```

**问题**:
- 套餐信息硬编码在前端代码
- 修改需要重新部署前端
- 与数据库配置不同步

---

## 二、需要完成的工作

### 2.1 Billing服务优化（P0，1周）

#### 任务 1: 统一HTTP框架
**问题**: `subscription_plans.go`使用Gin，但billing服务主要用`http.ServeMux`

**解决方案**:
- 将`subscription_plans.go`的Gin handler改写为标准`http.Handler`
- 集成到`internal/handlers/http.go`的路由注册

**文件修改**:
- `services/billing/internal/handlers/subscription_plans.go` - 重写handler
- `services/billing/internal/handlers/http.go` - 添加路由

**API端点**:
```
GET  /api/v1/billing/plans                    # 获取所有套餐
GET  /api/v1/billing/plans/:tier              # 获取特定套餐
PUT  /api/v1/billing/plans/:tier              # 更新套餐（管理员）
GET  /api/v1/billing/plans/history            # 配置变更历史
```

#### 任务 2: 实现权限检查API
**目标**: 为gateway-middleware提供权限检查API

**新增API**:
```
POST /api/v1/billing/check-permission
Request: {
  "userId": "uuid",
  "feature": "offer_evaluation_ai"
}
Response: {
  "allowed": true,
  "value": true,  // 或数字、字符串
  "tier": "pro"
}
```

**实现要点**:
1. 查询用户订阅套餐（从Subscription表）
2. 查询套餐权限配置（从subscription_plan_configs表）
3. 返回权限检查结果
4. Redis缓存（5分钟TTL）

#### 任务 3: 优化Token消耗计算API
**目标**: 支持套餐级别差异化计费

**新增API**:
```
POST /api/v1/billing/get-token-cost
Request: {
  "userId": "uuid",
  "action": "offer_evaluation_ai"
}
Response: {
  "cost": 2,
  "tier": "pro"
}
```

**实现要点**:
1. 查询用户订阅套餐
2. 从subscription_plan_configs.token_costs获取消耗规则
3. 返回Token消耗数量
4. Redis缓存（5分钟TTL）

---

### 2.2 Gateway Middleware完善（P0，6周）

#### Phase 2: 核心功能集成（2周）
**依赖**: Billing服务优化完成

**任务**:
1. Redis缓存模块（3天）
   - 订阅信息缓存
   - 权限配置缓存
   - Token余额缓存

2. 订阅查询中间件（2天）
   - 调用billing服务查询订阅
   - 注入tier到context和请求头

3. 权限检查中间件（3天）
   - 调用billing服务检查权限
   - 拒绝无权限请求（403）

4. 监控指标（2天）
   - Prometheus指标
   - 缓存命中率监控

#### Phase 3: Token管理（2周）
**任务**:
1. Token预留中间件（4天）
   - 调用billing服务预留Token
   - 注入reservation_id到请求头

2. Token释放机制（3天）
   - 业务服务失败时自动释放
   - 超时自动释放（30分钟）

3. 幂等性保证（2天）
   - X-Idempotency-Key支持
   - 避免重复扣费

#### Phase 4: 生产就绪（2周）
**任务**:
1. 配置热更新（3天）
   - 订阅Pub/Sub配置变更事件
   - 自动失效缓存

2. 限流中间件（2天）
   - 基于用户ID限流
   - 基于IP限流

3. 完整测试（5天）
   - 单元测试
   - 集成测试
   - 压力测试

4. 部署上线（2天）
   - Preview环境部署
   - Production环境部署

---

### 2.3 前端配置动态化（P1，1周）

#### 任务 1: 实现配置查询Hook
**文件**: `apps/frontend/src/lib/hooks/useSubscriptionConfig.ts`

**功能**:
```typescript
export function useSubscriptionConfig() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/v1/billing/plans',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  // 监听SSE配置更新
  useEffect(() => {
    const eventSource = new EventSource('/api/v1/billing/config/updates');
    eventSource.onmessage = (event) => {
      mutate(); // 重新获取配置
    };
    return () => eventSource.close();
  }, []);

  return { plans: data, error, isLoading };
}
```

#### 任务 2: 实现权限检查Hook
**文件**: `apps/frontend/src/lib/hooks/usePermission.ts`

**功能**:
```typescript
export function usePermission(feature: string) {
  const { subscription } = useSubscription();
  const { plans } = useSubscriptionConfig();

  const plan = plans?.find(p => p.tier === subscription?.planName);
  const permission = plan?.permissions[feature];

  return {
    allowed: permission !== false && permission !== undefined,
    value: permission,
    limit: typeof permission === 'number' ? permission : null
  };
}
```

#### 任务 3: 重构套餐展示页面
**文件**: `apps/frontend/src/app/settings/subscription/page.tsx`

**改动**:
- 移除硬编码的套餐配置
- 使用`useSubscriptionConfig()`动态获取
- 根据语言显示对应的货币符号和文本

---

### 2.4 Console管理界面（P1，1周）

#### 任务 1: 套餐配置管理页面
**路由**: `/manage/subscription/plans`

**功能**:
- 列表显示所有套餐
- 编辑权限配置（JSONB编辑器）
- 编辑Token消耗规则
- 编辑价格配置
- 保存并发布更新

#### 任务 2: 配置变更历史页面
**路由**: `/manage/subscription/history`

**功能**:
- 显示配置变更历史
- 筛选（按套餐、时间、操作人）
- 查看变更详情（diff对比）
- 导出CSV

---

## 三、实施优先级

### P0: 核心功能（必须完成）

#### Week 1: Billing服务优化
- [ ] 统一HTTP框架（subscription_plans.go）
- [ ] 实现权限检查API
- [ ] 优化Token消耗计算API
- [ ] 单元测试

#### Week 2-3: Gateway Middleware Phase 2
- [ ] Redis缓存模块
- [ ] 订阅查询中间件
- [ ] 权限检查中间件
- [ ] 监控指标

#### Week 4-5: Gateway Middleware Phase 3
- [ ] Token预留中间件
- [ ] Token释放机制
- [ ] 幂等性保证

#### Week 6-7: Gateway Middleware Phase 4
- [ ] 配置热更新
- [ ] 限流中间件
- [ ] 完整测试
- [ ] 部署上线

### P1: 用户体验优化（重要）

#### Week 8: 前端配置动态化
- [ ] useSubscriptionConfig hook
- [ ] usePermission hook
- [ ] 重构套餐展示页面

#### Week 9: Console管理界面
- [ ] 套餐配置管理页面
- [ ] 配置变更历史页面

---

## 四、关键决策

### 决策 1: 套餐管理归属billing服务 ✅
**理由**:
- billing服务已有完整的数据库表结构
- billing服务已有部分API实现
- 套餐配置与计费逻辑紧密相关

### 决策 2: 权限检查和Token管理在gateway-middleware ✅
**理由**:
- gateway-middleware是统一入口
- 避免每个业务服务重复实现
- 集中管理，易于维护和监控

### 决策 3: 前端配置动态化 ✅
**理由**:
- 配置更新无需重新部署前端
- 与数据库配置保持同步
- 支持实时更新（SSE）

---

## 五、不需要做的事情（避免重复造轮子）

### ❌ 不需要：重新设计数据库表
**原因**: billing服务已有完整的表结构（subscription_plan_configs, subscription_config_history）

### ❌ 不需要：重新实现Token预留机制
**原因**: billing服务已有完整的Token管理（CheckAndReserveTokens, ConfirmTokenDeduction, RefundTokens）

### ❌ 不需要：重新实现配置缓存
**原因**: billing服务已有Redis缓存实现（GetAllPlans, GetPlanByTier）

### ❌ 不需要：重新实现Pub/Sub通知
**原因**: billing服务已有publishConfigUpdateEvent实现

### ✅ 需要做：集成和优化
**重点**:
1. 统一billing服务的HTTP框架
2. 补充权限检查和Token计算API
3. 完善gateway-middleware的中间件
4. 前端配置动态化
5. Console管理界面

---

## 六、下一步行动

### 立即开始（Week 1）
1. **Review billing服务代码**
   - 确认subscription_plan_configs表已创建
   - 确认初始数据已插入
   - 测试GetAllPlans API

2. **重写subscription_plans.go**
   - 从Gin改为http.Handler
   - 集成到http.go路由

3. **实现权限检查API**
   - POST /api/v1/billing/check-permission
   - 单元测试

4. **实现Token消耗计算API**
   - POST /api/v1/billing/get-token-cost
   - 单元测试

### Week 2-7
- 按照gateway-middleware的IMPLEMENTATION_PLAN执行
- Phase 2: 核心功能集成
- Phase 3: Token管理
- Phase 4: 生产就绪

### Week 8-9
- 前端配置动态化
- Console管理界面

---

**维护人**: Backend Team
**最后更新**: 2025-10-17
**预计完成**: 9周后
