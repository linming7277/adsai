# 新用户Onboarding系统验证指南

## 📅 部署信息
- **部署时间**: 2025-10-18 09:24:55 UTC
- **服务版本**: billing-preview-00047-t5f
- **环境**: Preview (preview.example.com)
- **状态**: ✅ 已成功部署

## 🎯 系统功能

新用户注册后自动初始化以下内容：

### 1. Demo Offers (8个示例Offer)
```
Nike Summer Sale Campaign          - Status: scaling, ROAS: 4.2, Revenue: $250K
Amazon Prime Day Electronics       - Status: scaling, ROAS: 3.8, Revenue: $180K
Apple iPhone 15 Launch            - Status: scaling, ROAS: 5.1, Revenue: $320K
Adidas Fall Collection            - Status: optimizing, 待评估
Samsung Galaxy Launch             - Status: optimizing, 待评估
Sony PlayStation Deals            - Status: evaluating, 评估中
Microsoft Surface Promo           - Status: evaluating, eval_status: failed
Dell Laptop Campaign (Archived)   - Status: archived, ROAS: 3.2, Revenue: $150K
```

### 2. 欢迎通知
- **标题**: Welcome to AdsAI!
- **内容**: Thank you for joining AdsAI! You have received 1000 free tokens...

### 3. 签到系统初始化
- total_checkins: 0
- total_tokens_earned: 0
- this_month_checkins: 0
- last_checkin_date: NULL

### 4. 邀请码生成
- 8位随机邀请码
- status: 'pending'

## 🧪 验证方法

### 方法一：注册新用户测试（推荐）

1. **清除浏览器数据**
   ```bash
   # Chrome
   Command+Shift+Delete → 清除所有数据

   # 或使用隐私模式
   Command+Shift+N
   ```

2. **注册新账号**
   - 访问: https://preview.example.com/auth
   - 点击"Continue with Google"
   - 使用一个全新的Google账号登录
   - 完成OAuth授权流程

3. **验证Onboarding结果**

   **Dashboard (/):**
   - ✅ 应该显示统计数据（来自8个Demo Offers）
   - ✅ Token余额显示 1000
   - ✅ 不应该显示"Failed to fetch dashboard stats"错误

   **Offers页面 (/offers):**
   - ✅ 应该显示8个示例Offer
   - ✅ 不同状态: scaling (3), optimizing (2), evaluating (2), archived (1)
   - ✅ 部分Offer有Revenue和ROAS数据
   - ✅ 不应该显示空状态 "Get started by creating your first offer"

   **Tasks页面 (/tasks):**
   - ℹ️  可能显示评估任务（如果demo创建触发了评估）
   - ℹ️  或显示空状态（正常，demo不自动触发任务）

   **Settings > Subscription (/settings/subscription):**
   - ✅ 显示 TRIAL 订阅
   - ✅ 显示到期时间
   - ✅ Token quota: 1000

   **Settings > Tokens (/settings/tokens):**
   - ✅ 可用余额: 1000
   - ✅ 有一条"Trial subscription created"交易记录

   **Settings > Checkin (/settings/checkin):**
   - ✅ 连续签到天数: 0
   - ✅ 显示签到按钮（可以点击）
   - ✅ 不应该显示"暂无签到记录"错误

   **Settings > Referral (/settings/referral):**
   - ✅ 显示8位邀请码
   - ✅ 可以复制邀请链接
   - ✅ 不应该显示"暂无法获取邀请信息"错误

   **Notifications:**
   - ✅ 有欢迎通知
   - ✅ 通知内容提到1000 free tokens

### 方法二：数据库查询验证

如果你有数据库访问权限：

```sql
-- 查询最近的trial订阅和onboarding数据
SELECT
  s.id as subscription_id,
  s."userId" as user_id,
  s."trialStartDate" as trial_start,
  COALESCE(demo_offers.count, 0) as demo_offers_count,
  CASE WHEN notif.user_id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_welcome,
  CASE WHEN checkin.user_id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_checkin,
  CASE WHEN ref.referrer_user_id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_referral
FROM "Subscription" s
LEFT JOIN (
  SELECT user_id, COUNT(*) as count
  FROM offers WHERE is_demo = true GROUP BY user_id
) demo_offers ON demo_offers.user_id = s."userId"
LEFT JOIN LATERAL (
  SELECT user_id FROM user_notifications
  WHERE user_id = s."userId" AND type = 'welcome' LIMIT 1
) notif ON true
LEFT JOIN LATERAL (
  SELECT user_id FROM user_checkin_stats WHERE user_id = s."userId" LIMIT 1
) checkin ON true
LEFT JOIN LATERAL (
  SELECT referrer_user_id FROM referrals WHERE referrer_user_id = s."userId" LIMIT 1
) ref ON true
WHERE s."trialStartDate" IS NOT NULL
ORDER BY s."trialStartDate" DESC
LIMIT 5;
```

**期望结果**:
- demo_offers_count: 8
- has_welcome: Yes
- has_checkin: Yes
- has_referral: Yes

### 方法三：自动化测试脚本

我们提供了两个测试脚本：

1. **完整E2E测试** (需要Playwright)
   ```bash
   cd /path/to/adsai
   node scripts/tests/test-new-user-onboarding.mjs
   ```

   这个脚本会：
   - 自动注册新用户
   - 验证所有onboarding功能
   - 生成测试报告

2. **数据库验证脚本**
   ```bash
   cd /path/to/adsai
   ./scripts/verify-onboarding-data.sh
   ```

   这个脚本会：
   - 查询数据库中的onboarding数据
   - 统计完成度
   - 显示最近trial用户的onboarding状态

### 方法四：服务日志检查

```bash
# 查看billing服务onboarding日志
gcloud logging read \
  'resource.labels.service_name="billing-preview" AND jsonPayload.message=~"Onboarding"' \
  --limit 50 \
  --freshness=24h

# 查看offer服务demo创建日志
gcloud logging read \
  'resource.labels.service_name="offer-preview" AND jsonPayload.message=~"demo"' \
  --limit 50 \
  --freshness=24h
```

**期望日志内容**:
```
[Onboarding] Starting initialization for user <user-id>
[Onboarding] ✓ Demo offers initialized for user <user-id>
[Onboarding] ✓ Welcome notification sent for user <user-id>
[Onboarding] ✓ Checkin initialized for user <user-id>
[Onboarding] ✓ Referral initialized for user <user-id>
[Onboarding] ✓ Successfully initialized all modules for user <user-id>
```

## 🔍 故障排查

### 问题：Demo Offers没有创建

**可能原因**:
1. Offer服务URL配置错误
2. 内部服务调用失败（HTTP认证问题）

**检查**:
```bash
# 验证环境变量
gcloud run services describe billing-preview --region asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env)" | grep OFFER_SERVICE_URL

# 测试offer服务可访问性
curl -I https://offer-preview-yt54xvsg5q-an.a.run.app/health
```

### 问题：通知/签到/邀请没有初始化

**可能原因**:
1. 数据库连接问题
2. SQL语法错误（字段名不匹配）

**检查**:
```bash
# 查看billing服务错误日志
gcloud logging read \
  'resource.labels.service_name="billing-preview" AND severity>=ERROR' \
  --limit 20 \
  --freshness=1h
```

### 问题：初始化延迟过长

**说明**:
- Onboarding使用异步执行（goroutine）
- 正常情况下3-5秒完成
- 如果超过15秒仍未完成，检查服务性能

**检查**:
```bash
# 查看Cloud Run服务指标
gcloud run services describe billing-preview --region asia-northeast1 \
  --format="value(status.latestCreatedRevisionName,status.traffic)"
```

## 📊 性能指标

**预期性能**:
- Trial创建响应时间: < 500ms
- Demo Offers创建时间: 2-3秒
- 总初始化时间: 3-5秒
- Token发放时间: < 100ms

## ⚠️ 注意事项

1. **幂等性保证**:
   - 所有SQL使用 `ON CONFLICT DO NOTHING`
   - 重复调用不会创建重复数据

2. **错误隔离**:
   - 任何单个模块失败不影响其他模块
   - 不阻止用户登录和使用系统

3. **异步执行**:
   - 初始化使用background context
   - 失败仅记录日志，不抛出错误

4. **服务间通信**:
   - 使用完整Cloud Run URLs
   - 通过X-User-ID header传递用户标识

## 📝 相关文档

- 完整实现总结: `NEW_USER_ONBOARDING_IMPLEMENTATION.md`
- Onboarding Handler代码: `services/billing/internal/handlers/onboarding_handler.go`
- Demo Handlers代码: `services/offer/internal/handlers/demo_handlers.go`
- Trial Subscription代码: `services/billing/internal/handlers/trial_subscription.go`

## 🎉 预期效果

**新用户首次登录后看到的界面应该是**:
- ✨ Dashboard充满数据和统计信息
- ✨ Offers页面有8个不同状态的示例
- ✨ Token余额显示1000，可以立即体验评估功能
- ✨ 签到功能可用，可以签到赚取更多tokens
- ✨ 邀请功能可用，可以邀请朋友获得奖励
- ✨ 欢迎通知提示用户系统功能

**而不是之前的空白状态**:
- ❌ Dashboard: "Failed to fetch dashboard stats"
- ❌ Offers: "Get started by creating your first offer"
- ❌ Checkin: "暂无签到记录"
- ❌ Referral: "暂无法获取邀请信息"
- ❌ Notifications: "Failed to load notifications"

---

**实施者**: Claude Code
**协助者**: Jason (Project Owner)
**部署日期**: 2025-10-18
**验证建议**: 使用新Google账号注册并完整体验新用户流程
