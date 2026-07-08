# Starter套餐"创建Offer"功能修复 - 快速指南

## 🔍 问题

Starter套餐用户无法使用"创建Offer"功能。

## 🎯 根本原因

数据库中Starter套餐的permissions配置**缺少** `createOffers` 权限字段。

**当前配置**:
```json
{
  "dashboard_risk_alerts": false,
  "offer_evaluation_basic": true,
  "offer_evaluation_ai": false,
  // ❌ 缺少 "createOffers": true
}
```

## ✅ 解决方案

### 方案1: 执行Migration (推荐)

```bash
# 1. 进入billing服务目录
cd services/billing

# 2. 执行migration
go run cmd/migrate/main.go up

# 或使用migrate工具
migrate -path internal/migrations -database "postgres://..." up
```

### 方案2: 直接执行SQL (快速修复)

```sql
-- 在数据库中直接执行
UPDATE subscription_plan_configs
SET 
    permissions = permissions || '{
        "createOffers": true,
        "创建Offer": true
    }'::jsonb,
    updated_at = NOW(),
    version = version + 1
WHERE tier = 'starter' AND is_active = true;

-- 同时更新其他套餐
UPDATE subscription_plan_configs
SET 
    permissions = permissions || '{
        "createOffers": true,
        "创建Offer": true
    }'::jsonb,
    updated_at = NOW(),
    version = version + 1
WHERE tier IN ('pro', 'elite') AND is_active = true;
```

### 方案3: 临时前端修复 (应急)

如果无法立即修改数据库，可以临时修改前端代码：

```typescript
// apps/frontend/src/core/hooks/use-billing-api.ts
export function useEnhancedSubscription() {
  // ... 现有代码 ...
  
  return {
    // ... 其他返回值 ...
    
    // 临时修复：所有套餐都可以创建Offer
    canCreateOffers: subscription?.tier !== undefined,
  };
}
```

## 📋 验证步骤

### 1. 检查数据库配置

```sql
-- 查看Starter套餐的permissions
SELECT 
    tier,
    permissions->>'createOffers' as can_create_offers,
    permissions
FROM subscription_plan_configs
WHERE tier = 'starter' AND is_active = true;

-- 应该返回: can_create_offers = 'true'
```

### 2. 清除缓存

```bash
# 如果使用Redis缓存
redis-cli DEL "permissions:plan:starter"
redis-cli DEL "permissions:all"
```

### 3. 测试API

```bash
# 测试权限检查API
curl -X POST "https://www.urlchecker.dev/api/v1/billing/permissions/check" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "feature": "createOffers"
  }'

# 应该返回: {"allowed": true, ...}
```

### 4. 前端验证

1. 登录Starter套餐账号
2. 访问 `/offers` 页面
3. 检查"Create Offer"按钮是否可见
4. 点击按钮，检查是否可以创建Offer

## 🚀 执行步骤

### 立即执行 (5分钟)

```bash
# 1. 连接到数据库
psql -h HOST -U USER -d DATABASE

# 2. 执行修复SQL
UPDATE subscription_plan_configs
SET permissions = permissions || '{"createOffers": true, "创建Offer": true}'::jsonb,
    updated_at = NOW(), version = version + 1
WHERE tier IN ('starter', 'pro', 'elite') AND is_active = true;

# 3. 验证
SELECT tier, permissions->>'createOffers' as can_create_offers
FROM subscription_plan_configs
WHERE is_active = true;

# 4. 清除缓存（如果有）
# redis-cli DEL "permissions:plan:*"

# 5. 退出
\q
```

### 验证修复 (2分钟)

1. 使用Starter套餐账号登录
2. 访问Offers页面
3. 确认可以创建Offer

## 📊 影响范围

- **影响用户**: 所有Starter套餐用户
- **影响功能**: 创建Offer功能
- **修复时间**: 5分钟
- **风险等级**: 低（只是添加权限，不影响现有功能）

## 🔄 回滚方案

如果需要回滚：

```sql
UPDATE subscription_plan_configs
SET 
    permissions = permissions - 'createOffers' - '创建Offer',
    updated_at = NOW(),
    version = version + 1
WHERE tier IN ('starter', 'pro', 'elite') AND is_active = true;
```

## 📝 相关文件

- `services/billing/internal/migrations/000008_fix_starter_create_offer_permission.up.sql` - Migration文件
- `services/billing/internal/migrations/000007_subscription_plan_configs.up.sql` - 原始配置
- `services/billing/internal/handlers/permission.go` - 权限检查逻辑
- `docs/CREATE_OFFER_PERMISSION_ISSUE.md` - 详细分析文档

## ✅ 成功标准

- [ ] 数据库中Starter套餐的permissions包含 `"createOffers": true`
- [ ] API `/permissions/check` 返回 `allowed: true`
- [ ] 前端 `canCreateOffers` 为 `true`
- [ ] Offers页面显示"Create Offer"按钮
- [ ] 用户可以成功创建Offer

## 💡 预防措施

1. **添加权限配置验证**
   - 在migration中添加验证逻辑
   - 确保所有必需权限都已配置

2. **统一权限字段名称**
   - 使用英文key作为主key
   - 中文key作为别名

3. **添加默认配置fallback**
   - 后端代码添加默认权限配置
   - 即使数据库配置缺失也能正常工作

4. **添加监控**
   - 监控权限检查失败率
   - 当配置缺失时发送告警
