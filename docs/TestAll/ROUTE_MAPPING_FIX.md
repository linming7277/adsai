# E2E测试路由映射修正方案

**修正时间**: 2025-10-15
**问题**: 业务需求路径与现有测试脚本路径不匹配
**状态**: 🔄 路由映射修正中

---

## 🔍 路径差异分析

### 业务需求中的路径 (新的)
```
/dashboard        # 1. 仪表盘
/offers           # 2. Offer管理 (新路径)
/ads-center       # 3. Ads中心 (新路径)
/tasks            # 4. 任务中心 (新路径)
/settings         # 5. 个人中心 (新路径) - 包含个人信息、套餐订阅、Token余额、邀请、签到等
/manage           # 6. 后台管理系统 (新路径) - 仅管理员可见
```

### 现有测试脚本中的路径 (旧的)
```
/dashboard        # ✅ 匹配
/dashboard/offers # ❌ 应该是 /offers
/dashboard/ads-center # ❌ 应该是 /ads-center
/dashboard/tasks  # ❌ 应该是 /tasks
/settings/tokens  # ❌ 应该是 /settings/tokens (个人中心)
/settings/subscription # ❌ 应该是 /settings/subscription (个人中心)
/settings/profile  # ❌ 应该是 /settings/profile (个人中心)
/userinfo         # ❌ 需要改为 /settings
/userinfo/tokens  # ❌ 应该是 /settings/tokens
/userinfo/subscription # ❌ 应该是 /settings/subscription
/userinfo/profile  # ❌ 应该是 /settings/profile
/manage           # ❌ 新增后台管理系统路径
```

### 解决方案

#### 方案1: 更新测试脚本路径 (推荐)
- 修改测试脚本使用新的路径
- 保持业务需求路径不变
- 需要前端路由配置支持新路径

#### 方案2: 保持现有路径 (备选)
- 修改业务需求文档
- 保持现有测试脚本不变
- 需要与产品团队确认

---

## 🎯 推荐方案: 更新测试脚本路径

### 路径映射表

| 功能模块 | 新路径 | 旧路径 | 测试脚本 | 修改优先级 |
|---------|--------|--------|----------|------------|
| 仪表盘 | `/dashboard` | `/dashboard` | test-dashboard-overview.mjs | ✅ 无需修改 |
| Offer管理 | `/offers` | `/dashboard/offers` | test-offer-filtering.mjs | 🔴 P0 |
| Offer创建 | `/offers` | `/dashboard/offers` | test-create-offer.mjs | 🔴 P0 |
| Offer评估 | `/offers` | `/dashboard/offers` | test-ai-evaluation.mjs | 🔴 P0 |
| Ads中心 | `/ads-center` | `/dashboard/ads-center` | test-ads-center-operations.mjs | 🔴 P0 |
| Ads绑定 | `/ads-center` | `/dashboard/ads-center` | test-bind-ads-account.mjs | 🔴 P0 |
| 任务中心 | `/tasks` | `/dashboard/tasks` | test-task-management.mjs | 🔴 P0 |
| 个人中心 | `/settings` | `/userinfo` | 需要创建 | 🔴 P0 |
| Token管理 | `/settings/tokens` | `/userinfo/tokens` | test-token-management.mjs | 🔴 P0 |
| 订阅管理 | `/settings/subscription` | `/userinfo/subscription` | test-subscription-management.mjs | 🔴 P0 |
| 个人信息 | `/settings/profile` | `/userinfo/profile` | 需要创建 | 🔴 P1 |
| 邀请功能 | `/settings/invite` | 无 | 需要创建 | 🔴 P1 |
| 签到功能 | `/settings/checkin` | 无 | 需要创建 | 🔴 P1 |
| 后台管理 | `/manage` | 无 | 需要创建 | 🔴 P0 |

---

## 🔧 具体修改计划

### 第一阶段: 修正现有测试脚本 (P0)

#### 1. 修改Offer相关测试脚本

```javascript
// 文件: scripts/tests/test-offer-filtering.mjs
// 修改前:
await page.goto(`${BASE_URL}/dashboard/offers`, { waitUntil: 'networkidle' });

// 修改后:
await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
```

#### 2. 修改Ads中心测试脚本

```javascript
// 文件: scripts/tests/test-ads-center-operations.mjs
// 修改前:
await page.goto(`${BASE_URL}/dashboard/ads-center`, { waitUntil: 'networkidle' });

// 修改后:
await page.goto(`${BASE_URL}/ads-center`, { waitUntil: 'networkidle' });
```

#### 3. 修改任务管理测试脚本

```javascript
// 文件: scripts/tests/test-task-management.mjs
// 修改前:
await page.goto(`${BASE_URL}/dashboard/tasks`, { waitUntil: 'networkidle' });

// 修改后:
await page.goto(`${BASE_URL}/tasks`, { waitUntil: 'networkidle' });
```

#### 4. 修改个人设置测试脚本

```javascript
// 文件: scripts/tests/test-token-management.mjs
// 修改前:
await page.goto(`${BASE_URL}/settings/tokens`, { waitUntil: 'networkidle' });

// 修改后:
await page.goto(`${BASE_URL}/userinfo/tokens`, { waitUntil: 'networkidle' });
```

```javascript
// 文件: scripts/tests/test-subscription-management.mjs
// 修改前:
await page.goto(`${BASE_URL}/settings/subscription`, { waitUntil: 'networkidle' });

// 修改后:
await page.goto(`${BASE_URL}/userinfo/subscription`, { waitUntil: 'networkidle' });
```

### 第二阶段: 创建新测试脚本 (P1)

#### 1. 创建个人信息测试脚本

```javascript
// 文件: scripts/tests/test-user-profile.mjs
async function testUserProfile() {
  await page.goto(`${BASE_URL}/userinfo/profile`, { waitUntil: 'networkidle' });

  // 测试个人信息编辑
  await testProfileEditing();

  // 测试头像上传
  await testAvatarUpload();

  // 测试联系方式更新
  await testContactInfoUpdate();
}
```

#### 2. 创建综合个人中心测试脚本

```javascript
// 文件: scripts/tests/test-userinfo-complete.mjs
async function testUserinfoCenter() {
  // 测试个人中心首页
  await testUserinfoOverview();

  // 测试所有子页面导航
  await testUserinfoNavigation();

  // 测试个人信息整合
  await testUserInfoIntegration();
}
```

### 第三阶段: 创建新功能测试脚本 (P1)

#### 1. AI评估功能测试脚本

```javascript
// 文件: scripts/tests/test-ai-evaluation-complete.mjs
async function testAIEvaluationComplete() {
  // 测试AI评估权限控制
  await testAIEvaluationPermissions();

  // 测试AI评估流程
  await testAIEvaluationProcess();

  // 测试AI推荐指数
  await testAIRecommendationScore();

  // 测试AI评估Token消耗
  await testAIEvaluationTokenCost();
}
```

#### 2. Token消耗规则测试脚本

```javascript
// 文件: scripts/tests/test-token-consumption-rules.mjs
async function testTokenConsumptionRules() {
  // 测试基础评估Token消耗 (1 token)
  await testBasicEvaluationTokenCost();

  // 测试AI评估Token消耗 (2 tokens)
  await testAIEvaluationTokenCost();

  // 测试完整评估Token消耗 (3 tokens)
  await testCompleteEvaluationTokenCost();

  // 测试Token余额不足处理
  await testInsufficientTokenHandling();
}
```

#### 3. 套餐权限测试脚本

```javascript
// 文件: scripts/tests/test-subscription-permissions.mjs
async function testSubscriptionPermissions() {
  // 测试Starter套餐限制
  await testStarterRestrictions();

  // 测试Professional套餐功能
  await testProfessionalFeatures();

  // 测试Elite套餐功能
  await testEliteFeatures();

  // 测试套餐升级引导
  await testSubscriptionUpgradeGuidance();
}
```

---

## 🔄 前端路由配置要求

### Next.js App Router 路由结构

```
app/
├── dashboard/
│   └── page.tsx           # 仪表盘首页 ✅ 已存在
├── offers/
│   └── page.tsx           # Offer管理 🔄 需要创建/修改
├── ads-center/
│   └── page.tsx           # Ads中心 🔄 需要创建/修改
├── tasks/
│   └── page.tsx           # 任务中心 🔄 需要创建/修改
├── settings/              # 个人中心 🔄 需要创建
│   ├── page.tsx           # 个人中心首页
│   ├── profile/
│   │   └── page.tsx       # 个人信息
│   ├── tokens/
│   │   └── page.tsx       # Token管理
│   ├── subscription/
│   │   └── page.tsx       # 套餐订阅
│   ├── invite/
│   │   └── page.tsx       # 邀请功能
│   └── checkin/
│       └── page.tsx       # 签到功能
├── manage/                # 后台管理系统 🔄 需要创建
│   ├── page.tsx           # 管理首页
│   ├── dashboard/
│   │   └── page.tsx       # 管理仪表盘
│   ├── users/
│   │   └── page.tsx       # 用户管理
│   ├── tokens/
│   │   └── page.tsx       # Token管理
│   ├── offers/
│   │   └── page.tsx       # Offer管理
│   ├── subscriptions/
│   │   └── page.tsx       # 订阅管理
│   ├── tasks/
│   │   └── page.tsx       # 任务管理
│   └── ads-accounts/
│       └── page.tsx       # Ads账号管理
└── userinfo/              # 旧路径，需要重定向
    └── [...params].tsx    # 重定向到 /settings
```

### 重定向配置 (过渡期)

```typescript
// app/userinfo/[...path]/page.tsx
import { redirect } from 'next/navigation';

export default function UserinfoRedirect({ params }) {
  const path = params.path.join('/');

  // 映射旧路径到新路径
  const pathMappings = {
    '': 'settings',
    'tokens': 'settings/tokens',
    'subscription': 'settings/subscription',
    'profile': 'settings/profile'
  };

  const newPath = pathMappings[path] || `settings/${path}`;
  redirect(`/${newPath}`);
}
```

---

## 📋 修改清单

### 现有文件修改 (8个)

1. `scripts/tests/test-offer-filtering.mjs` - 路径: `/dashboard/offers` → `/offers`
2. `scripts/tests/test-create-offer.mjs` - 路径: `/dashboard/offers` → `/offers`
3. `scripts/tests/test-ai-evaluation.mjs` - 路径: `/dashboard/offers` → `/offers`
4. `scripts/tests/test-ads-center-operations.mjs` - 路径: `/dashboard/ads-center` → `/ads-center`
5. `scripts/tests/test-bind-ads-account.mjs` - 路径: `/dashboard/ads-center` → `/ads-center`
6. `scripts/tests/test-task-management.mjs` - 路径: `/dashboard/tasks` → `/tasks`
7. `scripts/tests/test-token-management.mjs` - 路径: `/userinfo/tokens` → `/settings/tokens`
8. `scripts/tests/test-subscription-management.mjs` - 路径: `/userinfo/subscription` → `/settings/subscription`

### 新增文件创建 (8个)

#### 个人中心测试脚本 (4个)
1. `scripts/tests/test-settings-complete.mjs` - 个人中心完整测试
2. `scripts/tests/test-user-profile.mjs` - 个人信息测试
3. `scripts/tests/test-invite-system.mjs` - 邀请功能测试
4. `scripts/tests/test-daily-checkin.mjs` - 签到功能测试

#### 后台管理测试脚本 (3个)
5. `scripts/tests/test-manage-dashboard.mjs` - 管理仪表盘测试
6. `scripts/tests/test-manage-users.mjs` - 用户管理测试
7. `scripts/tests/test-manage-complete.mjs` - 后台管理系统完整测试

#### 已有但需要更新的脚本 (1个)
8. `scripts/tests/test-ai-evaluation-complete.mjs` - AI评估完整测试 (已创建，需要更新路径)

### 更新文件 (1个)

1. `scripts/tests/run-e2e-test-suite.mjs` - 更新测试列表和路径

---

## ⚡ 立即执行步骤

### 第一步: 修改现有测试脚本路径
```bash
# 批量修改测试脚本中的路径
find scripts/tests -name "*.mjs" -exec sed -i 's|/dashboard/offers|/offers|g' {} \;
find scripts/tests -name "*.mjs" -exec sed -i 's|/dashboard/ads-center|/ads-center|g' {} \;
find scripts/tests -name "*.mjs" -exec sed -i 's|/dashboard/tasks|/tasks|g' {} \;
find scripts/tests -name "*.mjs" -exec sed -i 's|/settings/tokens|/userinfo/tokens|g' {} \;
find scripts/tests -name "*.mjs" -exec sed -i 's|/settings/subscription|/userinfo/subscription|g' {} \;
```

### 第二步: 验证路径修改
```bash
# 检查修改结果
grep -r "/userinfo/" scripts/tests/
grep -r "/offers/" scripts/tests/
grep -r "/ads-center/" scripts/tests/
grep -r "/tasks/" scripts/tests/
```

### 第三步: 测试现有页面是否可访问
```bash
# 测试新路径是否可访问
curl -I https://www.urlchecker.dev/offers
curl -I https://www.urlchecker.dev/ads-center
curl -I https://www.urlchecker.dev/tasks
curl -I https://www.urlchecker.dev/userinfo
```

---

## 🎯 预期成果

### 修改后的测试架构

```
✅ 新E2E测试架构 (17个测试)
├── 基础功能测试 (5个)
│   ├── test-programmatic-login.mjs        ✅
│   ├── test-dashboard-overview.mjs        ✅
│   ├── test-offer-filtering.mjs           ✅ (路径已修正)
│   ├── test-ads-center-operations.mjs     ✅ (路径已修正)
│   └── test-task-management.mjs           ✅ (路径已修正)
├── 个人中心测试 (4个)
│   ├── test-token-management.mjs          ✅ (路径已修正)
│   ├── test-subscription-management.mjs   ✅ (路径已修正)
│   ├── test-user-profile.mjs              🆕 新增
│   └── test-userinfo-complete.mjs          🆕 新增
├── Offer管理测试 (3个)
│   ├── test-create-offer.mjs              ✅ (路径已修正)
│   ├── test-ai-evaluation.mjs             ✅ (路径已修正)
│   └── test-ai-evaluation-complete.mjs     🆕 新增
├── 高级功能测试 (3个)
│   ├── test-bind-ads-account.mjs          ✅ (路径已修正)
│   ├── test-token-consumption-rules.mjs  🆕 新增
│   └── test-subscription-permissions.mjs  🆕 新增
├── 性能测试 (1个)
│   └── test-web-vitals.mjs                ✅
└── 批量操作测试 (1个)
    └── test-bulk-operations.mjs           ✅
```

### 通过率预期提升

- **修复前**: 25.0% (3/12)
- **修复后**: 80.0%+ (13/17)
- **关键功能**: 90.0%+ (8/9)
- **新功能测试**: 100% (5/5)

---

**状态**: 🎯 路径映射设计完成，开始执行修改
**预计完成时间**: 2-3小时
**风险等级**: 低 (路径修改，逻辑不变)