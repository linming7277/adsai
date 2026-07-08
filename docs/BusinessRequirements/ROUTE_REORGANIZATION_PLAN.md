# AutoAds 路由重组与功能增强方案

**文档版本**: V1.0
**创建时间**: 2025-10-15
**状态**: ✅ 设计完成，待实施
**负责团队**: Frontend Team + Backend Team

---

## 📋 目录

1. [需求概述](#需求概述)
2. [现有架构分析](#现有架构分析)
3. [路由重组方案](#路由重组方案)
4. [功能增强方案](#功能增强方案)
5. [数据库Schema设计](#数据库schema设计)
6. [API设计](#api设计)
7. [前端实施计划](#前端实施计划)
8. [后端实施计划](#后端实施计划)
9. [测试策略](#测试策略)
10. [实施时间表](#实施时间表)

---

## 需求概述

### 核心目标

**5个业务模块优化**：

1. **仪表盘** (`/dashboard`)：聚合Offer数据、Ads账号数据、风险提醒、消息通知
2. **Offer管理** (`/offers`)：从`/dashboard/offers`迁移，以Offer为视角的完整管理
3. **Ads中心** (`/ads-center`)：从`/dashboard/ads-center`迁移，账号授权和管理
4. **任务中心** (`/tasks`)：从`/dashboard/tasks`迁移，任务执行和Token消耗查看
5. **个人中心** (`/settings`)：增加邀请、签到功能
6. **后台管理** (`/manage`)：完善管理员功能

### 关键变更

| 功能 | 现有路由 | 新路由 | 变更类型 |
|------|---------|--------|---------|
| 仪表盘 | `/dashboard` | `/dashboard` | 功能增强 |
| Offer管理 | `/dashboard/offers` | `/offers` | 路由迁移 |
| Ads中心 | `/dashboard/ads-center` | `/ads-center` | 路由迁移 |
| 任务中心 | `/dashboard/tasks` | `/tasks` | 路由迁移 |
| Token余额 | `/settings/tokens` | `/settings/tokens` | 保持不变 |
| 订阅管理 | `/settings/subscription` | `/settings/subscription` | 保持不变 |
| 个人信息 | `/settings/profile` | `/settings/profile` | 保持不变 |
| 邀请系统 | ❌ 不存在 | `/settings/referral` | 新增 |
| 签到系统 | ❌ 不存在 | `/settings/checkin` | 新增 |
| 后台管理 | `/manage` | `/manage` | 功能增强 |

---

## 现有架构分析

### 前端路由结构（当前）

```
apps/frontend/src/app/
├── (site)/                    # 营销页面
│   ├── page.tsx              # 首页
│   ├── pricing/              # 价格页
│   ├── features/             # 功能介绍
│   └── docs/                 # 文档
│
├── auth/                      # 认证页面
│   ├── sign-in/
│   ├── sign-up/
│   └── callback/
│
├── dashboard/                 # 用户仪表盘（需重组）
│   ├── page.tsx              # 仪表盘首页 ✅ 已实现
│   ├── offers/               # Offer管理 ✅ 已实现（需迁移到/offers）
│   ├── ads-center/           # Ads中心 ✅ 已实现（需迁移到/ads-center）
│   └── tasks/                # 任务中心 ✅ 已实现（需迁移到/tasks）
│
├── settings/                  # 个人设置（需增强）
│   ├── profile/              # 个人信息 ✅ 已实现
│   ├── subscription/         # 订阅管理 ✅ 已实现
│   └── tokens/               # Token余额 ✅ 已实现
│   # ❌ 缺少：referral/（邀请）、checkin/（签到）
│
└── manage/                    # 后台管理（需完善）
    ├── page.tsx              # 管理员仪表盘 ✅ 已实现
    ├── users/                # 用户管理 ✅ 已实现
    ├── offers/               # Offer管理 ✅ 已实现
    ├── tasks/                # 任务管理 ✅ 已实现
    ├── ads-accounts/         # Ads账号管理 ✅ 已实现
    ├── tokens/               # Token管理 ⚠️ 部分实现
    └── security/             # 安全管理 ✅ 已实现
    # ❌ 缺少：subscriptions/（订阅管理）、analytics/（数据分析）
```

### 后端服务（当前）

| 服务 | 端点数 | 状态 | 说明 |
|------|--------|------|------|
| **billing** | 14 | ✅ 完整 | Token、订阅、签到、邀请API |
| **offer** | 12 | ✅ 完整 | Offer CRUD、评估、统计 |
| **adscenter** | 20+ | ✅ 完整 | OAuth、账号管理、数据同步 |
| **console** | 15+ | ✅ 完整 | 任务管理、通知、SLO监控 |
| **notifications** | 5 | ✅ 完整 | 通知规则、推送 |
| **recommendations** | 6 | ✅ 完整 | AI推荐、策略模板 |

### 现有页面实现情况

#### ✅ 已完整实现

1. **Dashboard** (`/dashboard/page.tsx`):
   - 显示Offer统计（总数、待处理、就绪）
   - 显示Token余额
   - AI Insights Feed
   - 快速操作卡片
   - ⚠️ **缺少**: Ads账号数据、风险提醒、消息通知

2. **Offers** (`/dashboard/offers/page.tsx`):
   - ✅ 完整列表、筛选、排序、分页
   - ✅ 批量操作（评估、删除）
   - ✅ 详情抽屉
   - ✅ 创建Offer对话框
   - ✅ 收藏功能

3. **Ads Center** (`/dashboard/ads-center/page.tsx`):
   - ✅ 账号列表表格
   - ✅ 统计卡片
   - ✅ 连接、同步、断开操作
   - ✅ 账号详情对话框
   - ✅ 策略模板预览
   - ✅ 执行报告总览

4. **Tasks** (`/dashboard/tasks/page.tsx`):
   - ✅ 任务列表表格
   - ✅ Token统计卡片
   - ✅ 任务筛选（按状态）
   - ✅ 取消、重试操作
   - ✅ 任务时间轴
   - ✅ Offer-Ads关联洞察

5. **Settings - Tokens** (`/settings/tokens/page.tsx`):
   - ✅ Token余额统计
   - ✅ 消耗趋势图表
   - ✅ 交易历史表格
   - ✅ 套餐信息卡片

6. **Settings - Subscription** (`/settings/subscription/page.tsx`):
   - ✅ 当前套餐展示
   - ✅ 套餐对比表格
   - ✅ 升级/降级操作
   - ✅ Stripe支付集成

7. **Settings - Profile** (`/settings/profile/page.tsx`):
   - ✅ 个人信息编辑
   - ✅ 邮箱管理
   - ✅ 密码管理
   - ✅ 安全设置

8. **Manage - Dashboard** (`/manage/page.tsx`):
   - ✅ 管理员统计卡片
   - ✅ AdminGuard权限控制

9. **Manage - Users** (`/manage/users/page.tsx`):
   - ✅ 用户列表表格
   - ✅ 用户详情页
   - ✅ 禁用、删除、模拟登录操作

10. **Manage - Offers** (`/manage/offers/page.tsx`):
    - ✅ 所有用户Offer列表
    - ✅ 批量操作

11. **Manage - Tasks** (`/manage/tasks/page.tsx`):
    - ✅ 所有用户任务列表
    - ✅ 任务统计

12. **Manage - Ads Accounts** (`/manage/ads-accounts/page.tsx`):
    - ✅ 所有用户Ads账号列表
    - ✅ 账号状态监控

#### ❌ 需要新增

1. **Settings - Referral** (`/settings/referral/page.tsx`):
   - 邀请链接生成
   - 邀请二维码
   - 邀请列表（被邀请人信息、状态、奖励）
   - 邀请统计（邀请数、注册数、充值数、累计奖励）

2. **Settings - Checkin** (`/settings/checkin/page.tsx`):
   - 签到日历（本月签到情况）
   - 签到按钮（每日+10 tokens）
   - 连续签到奖励规则（7天+50, 30天+200）
   - 签到历史记录

3. **Manage - Subscriptions** (`/manage/subscriptions/page.tsx`):
   - 所有用户订阅列表
   - 订阅统计（各套餐用户数、收入）
   - 订阅变更历史
   - 手动调整订阅

4. **Manage - Analytics** (`/manage/analytics/page.tsx`):
   - 用户增长趋势
   - Token消耗趋势
   - 收入统计
   - 活跃度分析

---

## 路由重组方案

### 新路由结构

```
apps/frontend/src/app/
├── (site)/                    # 营销页面（不变）
├── auth/                      # 认证页面（不变）
│
├── dashboard/                 # 仪表盘（增强）
│   └── page.tsx              # 聚合Offer、Ads、风险、通知
│
├── offers/                    # Offer管理（从/dashboard/offers迁移）
│   ├── page.tsx
│   ├── components/
│   ├── hooks/
│   └── utils/
│
├── ads-center/                # Ads中心（从/dashboard/ads-center迁移）
│   ├── page.tsx
│   ├── components/
│   ├── hooks/
│   └── utils/
│
├── tasks/                     # 任务中心（从/dashboard/tasks迁移）
│   ├── page.tsx
│   ├── components/
│   └── hooks/
│
├── settings/                  # 个人设置（增强）
│   ├── profile/              # 个人信息（不变）
│   ├── subscription/         # 订阅管理（不变）
│   ├── tokens/               # Token余额（不变）
│   ├── referral/             # 邀请系统（新增）
│   └── checkin/              # 签到系统（新增）
│
└── manage/                    # 后台管理（完善）
    ├── page.tsx              # 管理员仪表盘（增强）
    ├── users/                # 用户管理（不变）
    ├── offers/               # Offer管理（不变）
    ├── tasks/                # 任务管理（不变）
    ├── ads-accounts/         # Ads账号管理（不变）
    ├── tokens/               # Token管理（增强）
    ├── subscriptions/        # 订阅管理（新增）
    ├── analytics/            # 数据分析（新增）
    └── security/             # 安全管理（不变）
```

### 路由迁移映射表

| 功能 | 旧路由 | 新路由 | 重定向 |
|------|--------|--------|--------|
| Offer管理 | `/dashboard/offers` | `/offers` | ✅ 需要 |
| Ads中心 | `/dashboard/ads-center` | `/ads-center` | ✅ 需要 |
| 任务中心 | `/dashboard/tasks` | `/tasks` | ✅ 需要 |

### 重定向配置

**文件**: `apps/frontend/next.config.mjs`

```javascript
const config = {
  async redirects() {
    return [
      {
        source: '/dashboard/offers',
        destination: '/offers',
        permanent: true, // 301永久重定向
      },
      {
        source: '/dashboard/offers/:path*',
        destination: '/offers/:path*',
        permanent: true,
      },
      {
        source: '/dashboard/ads-center',
        destination: '/ads-center',
        permanent: true,
      },
      {
        source: '/dashboard/ads-center/:path*',
        destination: '/ads-center/:path*',
        permanent: true,
      },
      {
        source: '/dashboard/tasks',
        destination: '/tasks',
        permanent: true,
      },
      {
        source: '/dashboard/tasks/:path*',
        destination: '/tasks/:path*',
        permanent: true,
      },
    ];
  },
};
```

### 导航菜单更新

**文件**: `apps/frontend/src/navigation.config.tsx`（或类似配置文件）

```typescript
export const mainNavigation = [
  {
    label: 'dashboard.title',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'offers.title',
    path: '/offers', // 从 /dashboard/offers 更新
    icon: Target,
  },
  {
    label: 'adsCenter.title',
    path: '/ads-center', // 从 /dashboard/ads-center 更新
    icon: GoogleAds,
  },
  {
    label: 'tasks.title',
    path: '/tasks', // 从 /dashboard/tasks 更新
    icon: ListTodo,
  },
];

export const settingsNavigation = [
  {
    label: 'settings.profile',
    path: '/settings/profile',
    icon: User,
  },
  {
    label: 'settings.subscription',
    path: '/settings/subscription',
    icon: CreditCard,
  },
  {
    label: 'settings.tokens',
    path: '/settings/tokens',
    icon: Coins,
  },
  {
    label: 'settings.referral',
    path: '/settings/referral', // 新增
    icon: Users,
  },
  {
    label: 'settings.checkin',
    path: '/settings/checkin', // 新增
    icon: CalendarCheck,
  },
];

export const manageNavigation = [
  {
    label: 'manage.dashboard',
    path: '/manage',
    icon: LayoutDashboard,
  },
  {
    label: 'manage.users',
    path: '/manage/users',
    icon: Users,
  },
  {
    label: 'manage.offers',
    path: '/manage/offers',
    icon: Target,
  },
  {
    label: 'manage.adsAccounts',
    path: '/manage/ads-accounts',
    icon: GoogleAds,
  },
  {
    label: 'manage.tasks',
    path: '/manage/tasks',
    icon: ListTodo,
  },
  {
    label: 'manage.subscriptions',
    path: '/manage/subscriptions', // 新增
    icon: CreditCard,
  },
  {
    label: 'manage.tokens',
    path: '/manage/tokens',
    icon: Coins,
  },
  {
    label: 'manage.analytics',
    path: '/manage/analytics', // 新增
    icon: BarChart,
  },
  {
    label: 'manage.security',
    path: '/manage/security',
    icon: Shield,
  },
];
```

---

## 功能增强方案

### 1. Dashboard增强（/dashboard）

**现有功能**:
- ✅ Offer统计（总数、待处理、就绪）
- ✅ Token余额
- ✅ AI Insights Feed
- ✅ 快速操作卡片

**新增功能**:

#### 1.1 Ads账号数据聚合

```typescript
// 新增统计卡片
<StatsCard
  label={t('dashboard.adsAccounts.total')}
  value={adsStats.totalAccounts}
  icon={<GoogleAds />}
  trend={adsStats.trend}
/>

<StatsCard
  label={t('dashboard.adsAccounts.activeAccounts')}
  value={adsStats.activeAccounts}
  icon={<Activity />}
/>

<StatsCard
  label={t('dashboard.adsAccounts.totalSpend')}
  value={formatCurrency(adsStats.totalSpend)}
  icon={<DollarSign />}
  trend={adsStats.spendTrend}
/>
```

#### 1.2 风险提醒面板

```typescript
<AlertsBanner alerts={alerts} />

// 风险类型
type Alert = {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  source: 'offer' | 'ads' | 'billing' | 'system';
  createdAt: string;
  actionUrl?: string;
  actionLabel?: string;
};

// 示例风险
const alerts = [
  {
    type: 'error',
    title: '3个Offer评估失败',
    description: 'SimilarWeb API返回错误，请重试',
    source: 'offer',
    actionUrl: '/offers?status=failed',
    actionLabel: '查看详情',
  },
  {
    type: 'warning',
    title: '2个Ads账号授权即将过期',
    description: '需要在7天内重新授权',
    source: 'ads',
    actionUrl: '/ads-center',
    actionLabel: '重新授权',
  },
  {
    type: 'info',
    title: 'Token余额不足100',
    description: '建议充值以保证服务连续性',
    source: 'billing',
    actionUrl: '/settings/tokens',
    actionLabel: '充值',
  },
];
```

#### 1.3 消息通知列表

```typescript
<NotificationsFeed notifications={notifications} />

type Notification = {
  id: string;
  type: 'evaluation_complete' | 'sync_complete' | 'task_failed' | 'subscription_expiring';
  title: string;
  description: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
};

// API端点
GET /api/v1/console/notifications?limit=10&unreadOnly=false
```

#### 1.4 数据图表

```typescript
// 1. Offer状态分布饼图
<OfferStatusPieChart data={offerStatusData} />

// 2. Token消耗趋势折线图（最近7天）
<TokenUsageTrendChart data={tokenTrendData} />

// 3. Ads账号数据汇总卡片
<AdsSummaryCards data={adsSummaryData} />

// 4. 任务执行状态统计
<TaskStatusBarChart data={taskStatusData} />
```

### 2. Settings增强 - 邀请系统（/settings/referral）

#### 2.1 邀请链接和二维码

```typescript
<ReferralLinkCard>
  <div className="space-y-4">
    {/* 邀请链接 */}
    <div className="flex items-center gap-2">
      <Input
        value={referralLink}
        readOnly
        className="flex-1"
      />
      <Button
        size="sm"
        onClick={() => copyToClipboard(referralLink)}
      >
        <Copy className="w-4 h-4 mr-1" />
        {t('referral.copy')}
      </Button>
    </div>

    {/* 二维码 */}
    <div className="flex justify-center">
      <QRCodeSVG value={referralLink} size={200} />
    </div>

    {/* 社交分享按钮 */}
    <div className="flex gap-2 justify-center">
      <Button
        size="sm"
        variant="outline"
        onClick={() => shareToTwitter(referralLink)}
      >
        <Twitter className="w-4 h-4" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => shareToFacebook(referralLink)}
      >
        <Facebook className="w-4 h-4" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => shareToEmail(referralLink)}
      >
        <Mail className="w-4 h-4" />
      </Button>
    </div>
  </div>
</ReferralLinkCard>
```

#### 2.2 邀请统计

```typescript
<ReferralStatsTiles>
  <StatTile
    label={t('referral.totalInvitations')}
    value={referralStats.totalInvitations}
    icon={<Send />}
  />
  <StatTile
    label={t('referral.registrations')}
    value={referralStats.registrations}
    icon={<UserPlus />}
  />
  <StatTile
    label={t('referral.conversions')}
    value={referralStats.conversions}
    description={t('referral.conversionsDescription')} // 完成首次充值
    icon={<DollarSign />}
  />
  <StatTile
    label={t('referral.totalRewards')}
    value={`${referralStats.totalRewards} Tokens`}
    icon={<Gift />}
  />
</ReferralStatsTiles>
```

#### 2.3 邀请列表

```typescript
<ReferralListTable
  referrals={referrals}
  columns={[
    {
      header: t('referral.invitedUser'),
      accessor: 'email', // 脱敏：us***@example.com
    },
    {
      header: t('referral.status'),
      accessor: 'status', // pending, registered, converted
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: t('referral.registeredAt'),
      accessor: 'registeredAt',
      cell: (row) => formatDate(row.registeredAt),
    },
    {
      header: t('referral.rewardEarned'),
      accessor: 'rewardEarned',
      cell: (row) => `${row.rewardEarned} Tokens`,
    },
  ]}
/>
```

#### 2.4 奖励规则

```typescript
<ReferralRewardsCard>
  <div className="space-y-3">
    <RewardRule
      icon={<UserPlus />}
      title={t('referral.reward.registration')}
      description={t('referral.reward.registrationDesc')}
      amount="+100 Tokens"
    />
    <RewardRule
      icon={<DollarSign />}
      title={t('referral.reward.firstPurchase')}
      description={t('referral.reward.firstPurchaseDesc')}
      amount="10% of purchase"
    />
    <RewardRule
      icon={<Repeat />}
      title={t('referral.reward.recurring')}
      description={t('referral.reward.recurringDesc')}
      amount="5% of renewals"
    />
  </div>
</ReferralRewardsCard>
```

### 3. Settings增强 - 签到系统（/settings/checkin）

#### 3.1 签到日历

```typescript
<CheckinCalendar
  month={currentMonth}
  checkinDays={checkinDays} // [1, 2, 3, 5, 8, 9, 10, ...]
  streakDays={streakDays}   // 连续签到天数
  onDayClick={(day) => handleCheckin(day)}
/>

// 日历视图
┌─────────────────────────────────┐
│   2025年10月                    │
├─────────────────────────────────┤
│ 一  二  三  四  五  六  日        │
│     1✓  2✓  3✓  4   5✓  6       │
│ 7   8✓  9✓  10✓ 11  12  13      │
│ 14  15🔥 16  17  18  19  20      │ // 🔥 = 今天，可签到
│ 21  22  23  24  25  26  27      │
│ 28  29  30  31                  │
└─────────────────────────────────┘
```

#### 3.2 签到按钮

```typescript
<CheckinButton
  disabled={alreadyCheckedToday}
  onClick={handleCheckin}
  loading={isCheckingIn}
>
  {alreadyCheckedToday ? (
    <>
      <CheckCircle className="w-4 h-4 mr-2" />
      {t('checkin.alreadyCheckedIn')}
    </>
  ) : (
    <>
      <Calendar className="w-4 h-4 mr-2" />
      {t('checkin.checkInNow')} (+10 Tokens)
    </>
  )}
</CheckinButton>
```

#### 3.3 连续签到奖励

```typescript
<CheckinRewardsCard>
  <div className="space-y-3">
    <RewardMilestone
      icon={<Calendar />}
      title={t('checkin.dailyReward')}
      description={t('checkin.dailyRewardDesc')}
      amount="+10 Tokens"
      achieved={true}
    />
    <RewardMilestone
      icon={<Flame />}
      title={t('checkin.7DayStreak')}
      description={t('checkin.7DayStreakDesc')}
      amount="+50 Tokens"
      progress={streakDays}
      target={7}
      achieved={streakDays >= 7}
    />
    <RewardMilestone
      icon={<Trophy />}
      title={t('checkin.30DayStreak')}
      description={t('checkin.30DayStreakDesc')}
      amount="+200 Tokens"
      progress={streakDays}
      target={30}
      achieved={streakDays >= 30}
    />
  </div>
</CheckinRewardsCard>
```

#### 3.4 签到历史

```typescript
<CheckinHistoryTable
  history={checkinHistory}
  columns={[
    {
      header: t('checkin.date'),
      accessor: 'checkinDate',
      cell: (row) => formatDate(row.checkinDate),
    },
    {
      header: t('checkin.streakDay'),
      accessor: 'streakDay',
      cell: (row) => `第${row.streakDay}天`,
    },
    {
      header: t('checkin.tokensEarned'),
      accessor: 'tokensEarned',
      cell: (row) => `+${row.tokensEarned} Tokens`,
    },
  ]}
/>
```

### 4. Manage增强 - 订阅管理（/manage/subscriptions）

#### 4.1 订阅统计

```typescript
<SubscriptionStatsTiles>
  <StatTile
    label={t('manage.subscriptions.totalUsers')}
    value={subscriptionStats.totalUsers}
    icon={<Users />}
  />
  <StatTile
    label={t('manage.subscriptions.paidUsers')}
    value={subscriptionStats.paidUsers}
    description={`${subscriptionStats.conversionRate}% conversion`}
    icon={<DollarSign />}
  />
  <StatTile
    label={t('manage.subscriptions.mrr')}
    value={formatCurrency(subscriptionStats.mrr)}
    description="Monthly Recurring Revenue"
    icon={<TrendingUp />}
  />
  <StatTile
    label={t('manage.subscriptions.churnRate')}
    value={`${subscriptionStats.churnRate}%`}
    icon={<AlertTriangle />}
  />
</SubscriptionStatsTiles>
```

#### 4.2 订阅列表

```typescript
<SubscriptionsTable
  subscriptions={subscriptions}
  columns={[
    {
      header: t('manage.subscriptions.user'),
      accessor: 'userEmail',
    },
    {
      header: t('manage.subscriptions.plan'),
      accessor: 'planName',
      cell: (row) => <PlanBadge plan={row.planName} />,
    },
    {
      header: t('manage.subscriptions.status'),
      accessor: 'status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: t('manage.subscriptions.startDate'),
      accessor: 'startDate',
      cell: (row) => formatDate(row.startDate),
    },
    {
      header: t('manage.subscriptions.renewDate'),
      accessor: 'renewDate',
      cell: (row) => formatDate(row.renewDate),
    },
    {
      header: t('manage.subscriptions.mrr'),
      accessor: 'mrr',
      cell: (row) => formatCurrency(row.mrr),
    },
    {
      header: t('manage.subscriptions.actions'),
      cell: (row) => (
        <ActionMenu
          items={[
            { label: t('manage.subscriptions.viewDetails'), onClick: () => viewDetails(row.id) },
            { label: t('manage.subscriptions.adjust'), onClick: () => adjustSubscription(row.id) },
            { label: t('manage.subscriptions.cancel'), onClick: () => cancelSubscription(row.id) },
          ]}
        />
      ),
    },
  ]}
/>
```

### 5. Manage增强 - 数据分析（/manage/analytics）

#### 5.1 用户增长趋势

```typescript
<UserGrowthChart
  data={userGrowthData}
  metrics={['totalUsers', 'activeUsers', 'newUsers']}
  timeRange="30d" // 7d, 30d, 90d, 1y
/>
```

#### 5.2 Token消耗趋势

```typescript
<TokenUsageChart
  data={tokenUsageData}
  breakdown={['evaluation', 'ai_evaluation', 'other']}
  timeRange="30d"
/>
```

#### 5.3 收入统计

```typescript
<RevenueChart
  data={revenueData}
  metrics={['totalRevenue', 'subscriptionRevenue', 'tokenRevenue']}
  timeRange="30d"
/>
```

#### 5.4 活跃度分析

```typescript
<ActivityHeatmap
  data={activityData}
  metric="dailyActiveUsers"
  timeRange="90d"
/>
```

---

## 数据库Schema设计

### 1. Billing Service - 邀请系统

```sql
-- 邀请表
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_user_id UUID NOT NULL,              -- 邀请人
    referral_code VARCHAR(20) NOT NULL UNIQUE,   -- 邀请码（短链接）

    -- 被邀请人信息
    referee_user_id UUID,                        -- 被邀请人（注册后填充）
    referee_email VARCHAR(255),                  -- 被邀请人邮箱

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, registered, converted

    -- 奖励
    registration_reward INTEGER DEFAULT 0,       -- 注册奖励（给邀请人）
    conversion_reward INTEGER DEFAULT 0,         -- 首次充值奖励
    recurring_rewards INTEGER DEFAULT 0,         -- 累计续费奖励

    -- 时间
    invited_at TIMESTAMP DEFAULT NOW(),
    registered_at TIMESTAMP,
    converted_at TIMESTAMP,                      -- 首次充值时间

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- 索引
    INDEX idx_referrer (referrer_user_id),
    INDEX idx_referee (referee_user_id),
    INDEX idx_code (referral_code),
    INDEX idx_status (status)
);

-- RLS策略
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_own_referrals ON referrals
    FOR ALL USING (referrer_user_id = current_setting('app.user_id')::uuid);
```

### 2. Billing Service - 签到系统

```sql
-- 签到表
CREATE TABLE checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    -- 签到信息
    checkin_date DATE NOT NULL,                  -- 签到日期（YYYY-MM-DD）
    streak_day INTEGER NOT NULL,                 -- 连续签到第几天
    tokens_earned INTEGER NOT NULL DEFAULT 10,   -- 本次获得Token

    -- 额外奖励
    milestone_reward INTEGER DEFAULT 0,          -- 里程碑奖励（7天+50, 30天+200）
    milestone_type VARCHAR(20),                  -- streak_7, streak_30

    created_at TIMESTAMP DEFAULT NOW(),

    -- 约束
    UNIQUE (user_id, checkin_date),

    -- 索引
    INDEX idx_user_date (user_id, checkin_date DESC),
    INDEX idx_date (checkin_date DESC)
);

-- RLS策略
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_own_checkins ON checkins
    FOR ALL USING (user_id = current_setting('app.user_id')::uuid);

-- 用户签到状态表（缓存）
CREATE TABLE user_checkin_status (
    user_id UUID PRIMARY KEY,

    -- 连续签到
    current_streak INTEGER DEFAULT 0,            -- 当前连续天数
    longest_streak INTEGER DEFAULT 0,            -- 最长连续天数

    -- 总统计
    total_checkins INTEGER DEFAULT 0,            -- 总签到天数
    total_tokens_earned INTEGER DEFAULT 0,       -- 总获得Token

    -- 最后签到
    last_checkin_date DATE,

    updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS策略
ALTER TABLE user_checkin_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_own_status ON user_checkin_status
    FOR ALL USING (user_id = current_setting('app.user_id')::uuid);
```

### 3. Console Service - 通知系统

```sql
-- 通知表
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    -- 通知内容
    type VARCHAR(50) NOT NULL,                   -- evaluation_complete, sync_complete, task_failed, subscription_expiring, etc.
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- 状态
    read BOOLEAN DEFAULT false,

    -- 关联对象
    related_object_type VARCHAR(50),             -- offer, ads_account, task, subscription
    related_object_id UUID,

    -- 操作
    action_url VARCHAR(500),
    action_label VARCHAR(50),

    created_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP,

    -- 索引
    INDEX idx_user_read (user_id, read),
    INDEX idx_user_created (user_id, created_at DESC),
    INDEX idx_type (type)
);

-- RLS策略
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_own_notifications ON notifications
    FOR ALL USING (user_id = current_setting('app.user_id')::uuid);
```

---

## API设计

### 1. Billing Service - 邀请API

#### GET `/api/v1/billing/referral`

获取邀请链接和统计

**响应**:
```json
{
  "referralCode": "ABC123",
  "referralLink": "https://autoads.com/auth/sign-up?ref=ABC123",
  "stats": {
    "totalInvitations": 10,
    "registrations": 5,
    "conversions": 2,
    "totalRewards": 350
  }
}
```

#### GET `/api/v1/billing/referral/list`

获取邀请列表

**查询参数**:
- `page`: 页码
- `limit`: 每页数量
- `status`: pending, registered, converted

**响应**:
```json
{
  "referrals": [
    {
      "id": "uuid",
      "refereeEmail": "us***@example.com",
      "status": "converted",
      "registeredAt": "2025-10-01T10:00:00Z",
      "convertedAt": "2025-10-02T15:30:00Z",
      "rewardEarned": 150
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 20
}
```

### 2. Billing Service - 签到API

#### GET `/api/v1/billing/checkin/status`

获取签到状态

**响应**:
```json
{
  "currentStreak": 5,
  "longestStreak": 15,
  "totalCheckins": 30,
  "totalTokensEarned": 450,
  "lastCheckinDate": "2025-10-14",
  "canCheckinToday": true
}
```

#### POST `/api/v1/billing/checkin`

执行签到

**请求**:
```json
{
  "date": "2025-10-15" // 可选，默认今天
}
```

**响应**:
```json
{
  "success": true,
  "checkin": {
    "date": "2025-10-15",
    "streakDay": 6,
    "tokensEarned": 10,
    "milestoneReward": 0
  },
  "newBalance": 110
}
```

#### GET `/api/v1/billing/checkin/history`

获取签到历史

**查询参数**:
- `month`: YYYY-MM（查询月份）
- `limit`: 数量限制

**响应**:
```json
{
  "history": [
    {
      "date": "2025-10-15",
      "streakDay": 6,
      "tokensEarned": 10,
      "milestoneReward": 0
    },
    {
      "date": "2025-10-14",
      "streakDay": 5,
      "tokensEarned": 10,
      "milestoneReward": 0
    }
  ],
  "checkinDays": [1, 2, 3, 5, 8, 9, 10, 14, 15]
}
```

### 3. Console Service - 通知API

#### GET `/api/v1/console/notifications`

获取通知列表

**查询参数**:
- `unreadOnly`: true/false
- `limit`: 数量限制
- `offset`: 偏移量

**响应**:
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "evaluation_complete",
      "title": "Offer评估完成",
      "description": "Nike官网的评估已完成，AI推荐指数：85分",
      "read": false,
      "relatedObjectType": "offer",
      "relatedObjectId": "uuid",
      "actionUrl": "/offers?id=uuid",
      "actionLabel": "查看详情",
      "createdAt": "2025-10-15T10:30:00Z"
    }
  ],
  "total": 15,
  "unreadCount": 3
}
```

#### PUT `/api/v1/console/notifications/{id}/read`

标记通知为已读

**响应**:
```json
{
  "success": true
}
```

#### POST `/api/v1/console/notifications/read-all`

标记所有通知为已读

**响应**:
```json
{
  "success": true,
  "markedCount": 10
}
```

### 4. Console Service - Dashboard聚合API

#### GET `/api/v1/console/dashboard/stats`

获取Dashboard聚合统计

**响应**:
```json
{
  "offers": {
    "total": 50,
    "pending": 10,
    "ready": 30,
    "deployed": 8,
    "failed": 2
  },
  "adsAccounts": {
    "total": 5,
    "active": 4,
    "expired": 1,
    "totalSpend": 1500.50,
    "spendTrend": 15.3
  },
  "tasks": {
    "total": 100,
    "running": 3,
    "completed": 90,
    "failed": 7
  },
  "tokens": {
    "balance": 150,
    "todayUsage": 20,
    "weekUsage": 80
  },
  "alerts": [
    {
      "type": "error",
      "title": "3个Offer评估失败",
      "description": "SimilarWeb API返回错误",
      "source": "offer",
      "actionUrl": "/offers?status=failed",
      "actionLabel": "查看详情"
    }
  ],
  "notifications": [
    {
      "id": "uuid",
      "type": "evaluation_complete",
      "title": "Offer评估完成",
      "description": "Nike官网的评估已完成",
      "read": false,
      "createdAt": "2025-10-15T10:30:00Z"
    }
  ]
}
```

---

## 前端实施计划

### 阶段1: 路由迁移（2天）

**任务**:
1. 创建新路由目录结构
2. 移动页面文件和组件
3. 更新导入路径
4. 配置重定向规则
5. 更新导航菜单
6. 测试所有路由跳转

**迁移步骤**:

```bash
# 1. 创建新目录
mkdir -p apps/frontend/src/app/offers
mkdir -p apps/frontend/src/app/ads-center
mkdir -p apps/frontend/src/app/tasks

# 2. 移动文件
mv apps/frontend/src/app/dashboard/offers/* apps/frontend/src/app/offers/
mv apps/frontend/src/app/dashboard/ads-center/* apps/frontend/src/app/ads-center/
mv apps/frontend/src/app/dashboard/tasks/* apps/frontend/src/app/tasks/

# 3. 删除旧目录
rm -rf apps/frontend/src/app/dashboard/offers
rm -rf apps/frontend/src/app/dashboard/ads-center
rm -rf apps/frontend/src/app/dashboard/tasks
```

**验收标准**:
- ✅ 所有新路由可正常访问
- ✅ 旧路由自动重定向到新路由
- ✅ 导航菜单更新正确
- ✅ 无404错误

---

### 阶段2: Dashboard增强（3天）

**2.1 Ads账号数据聚合（1天）**

**任务**:
1. 添加Ads统计卡片组件
2. 集成`GET /api/v1/console/dashboard/stats` API
3. 显示总账号数、活跃账号、总支出
4. 添加趋势图表

**文件**:
- `apps/frontend/src/app/dashboard/components/AdsSummaryCards.tsx`
- `apps/frontend/src/app/dashboard/page.tsx`（更新）

**2.2 风险提醒面板（1天）**

**任务**:
1. 创建AlertsBanner组件
2. 显示来自Offer、Ads、Billing的风险
3. 支持点击跳转到详情页
4. 自动刷新（每5分钟）

**文件**:
- `apps/frontend/src/app/dashboard/components/AlertsBanner.tsx`

**2.3 消息通知列表（1天）**

**任务**:
1. 创建NotificationsFeed组件
2. 集成`GET /api/v1/console/notifications` API
3. 支持标记已读
4. 实时更新（SSE或轮询）

**文件**:
- `apps/frontend/src/app/dashboard/components/NotificationsFeed.tsx`
- `apps/frontend/src/hooks/useNotifications.ts`

---

### 阶段3: Settings增强 - 邀请系统（2天）

**3.1 邀请链接和二维码（0.5天）**

**任务**:
1. 创建ReferralLinkCard组件
2. 集成`GET /api/v1/billing/referral` API
3. 实现复制链接功能
4. 显示二维码（qrcode.react库）

**文件**:
- `apps/frontend/src/app/settings/referral/page.tsx`
- `apps/frontend/src/app/settings/referral/components/ReferralLinkCard.tsx`

**3.2 邀请统计（0.5天）**

**任务**:
1. 创建ReferralStatsTiles组件
2. 显示邀请数、注册数、转化数、总奖励
3. 添加趋势图表

**文件**:
- `apps/frontend/src/app/settings/referral/components/ReferralStatsTiles.tsx`

**3.3 邀请列表（0.5天）**

**任务**:
1. 创建ReferralListTable组件
2. 集成`GET /api/v1/billing/referral/list` API
3. 显示被邀请人邮箱（脱敏）、状态、奖励
4. 支持分页

**文件**:
- `apps/frontend/src/app/settings/referral/components/ReferralListTable.tsx`

**3.4 奖励规则（0.5天）**

**任务**:
1. 创建ReferralRewardsCard组件
2. 显示3种奖励规则
3. 使用图标和卡片布局

**文件**:
- `apps/frontend/src/app/settings/referral/components/ReferralRewardsCard.tsx`

---

### 阶段4: Settings增强 - 签到系统（2天）

**4.1 签到日历（1天）**

**任务**:
1. 创建CheckinCalendar组件
2. 显示当月签到情况
3. 高亮已签到日期
4. 显示连续签到天数

**文件**:
- `apps/frontend/src/app/settings/checkin/page.tsx`
- `apps/frontend/src/app/settings/checkin/components/CheckinCalendar.tsx`

**4.2 签到按钮和奖励（0.5天）**

**任务**:
1. 创建CheckinButton组件
2. 集成`POST /api/v1/billing/checkin` API
3. 显示今日是否已签到
4. 签到成功后更新UI

**文件**:
- `apps/frontend/src/app/settings/checkin/components/CheckinButton.tsx`

**4.3 连续签到奖励（0.5天）**

**任务**:
1. 创建CheckinRewardsCard组件
2. 显示每日奖励、7天里程碑、30天里程碑
3. 显示进度条

**文件**:
- `apps/frontend/src/app/settings/checkin/components/CheckinRewardsCard.tsx`

---

### 阶段5: Manage增强 - 订阅管理（2天）

**5.1 订阅统计（0.5天）**

**任务**:
1. 创建SubscriptionStatsTiles组件
2. 显示总用户数、付费用户数、MRR、流失率

**文件**:
- `apps/frontend/src/app/manage/subscriptions/page.tsx`
- `apps/frontend/src/app/manage/subscriptions/components/SubscriptionStatsTiles.tsx`

**5.2 订阅列表（1天）**

**任务**:
1. 创建SubscriptionsTable组件
2. 显示用户、套餐、状态、续费日期、MRR
3. 支持筛选、排序、分页

**文件**:
- `apps/frontend/src/app/manage/subscriptions/components/SubscriptionsTable.tsx`

**5.3 订阅详情和调整（0.5天）**

**任务**:
1. 创建SubscriptionDetailDialog组件
2. 显示订阅详细信息
3. 支持手动调整套餐、取消订阅

**文件**:
- `apps/frontend/src/app/manage/subscriptions/components/SubscriptionDetailDialog.tsx`

---

### 阶段6: Manage增强 - 数据分析（2天）

**6.1 用户增长趋势（0.5天）**

**任务**:
1. 创建UserGrowthChart组件
2. 使用recharts库绘制折线图
3. 显示总用户、活跃用户、新增用户

**文件**:
- `apps/frontend/src/app/manage/analytics/page.tsx`
- `apps/frontend/src/app/manage/analytics/components/UserGrowthChart.tsx`

**6.2 Token消耗趋势（0.5天）**

**任务**:
1. 创建TokenUsageChart组件
2. 显示评估、AI评估、其他类型的Token消耗
3. 支持堆叠条形图

**文件**:
- `apps/frontend/src/app/manage/analytics/components/TokenUsageChart.tsx`

**6.3 收入统计（0.5天）**

**任务**:
1. 创建RevenueChart组件
2. 显示总收入、订阅收入、Token收入

**文件**:
- `apps/frontend/src/app/manage/analytics/components/RevenueChart.tsx`

**6.4 活跃度分析（0.5天）**

**任务**:
1. 创建ActivityHeatmap组件
2. 显示每日活跃用户热力图

**文件**:
- `apps/frontend/src/app/manage/analytics/components/ActivityHeatmap.tsx`

---

## 后端实施计划

### 阶段1: Billing Service - 邀请系统（2天）

**任务**:
1. 创建referrals表
2. 实现邀请码生成逻辑
3. 实现3个API端点
   - `GET /api/v1/billing/referral`
   - `GET /api/v1/billing/referral/list`
   - `POST /api/v1/billing/referral/track`（内部API，用户注册/充值时调用）
4. 实现奖励计算和发放逻辑
5. 单元测试

**验收标准**:
- ✅ 邀请码生成唯一
- ✅ 奖励正确发放
- ✅ API测试通过

---

### 阶段2: Billing Service - 签到系统（2天）

**任务**:
1. 创建checkins表和user_checkin_status表
2. 实现3个API端点
   - `GET /api/v1/billing/checkin/status`
   - `POST /api/v1/billing/checkin`
   - `GET /api/v1/billing/checkin/history`
3. 实现签到逻辑
   - 每日只能签到一次
   - 连续签到天数计算
   - 里程碑奖励发放（7天、30天）
4. 单元测试

**验收标准**:
- ✅ 签到幂等性保证
- ✅ 连续签到计算正确
- ✅ 里程碑奖励正确发放

---

### 阶段3: Console Service - 通知系统（2天）

**任务**:
1. 创建notifications表
2. 实现4个API端点
   - `GET /api/v1/console/notifications`
   - `PUT /api/v1/console/notifications/{id}/read`
   - `POST /api/v1/console/notifications/read-all`
   - `POST /api/v1/console/notifications/create`（内部API）
3. 实现通知创建逻辑（在其他服务事件发生时调用）
4. 实现SSE推送（可选）
5. 单元测试

**验收标准**:
- ✅ 通知正确创建
- ✅ 已读标记正常
- ✅ 查询性能良好（索引）

---

### 阶段4: Console Service - Dashboard聚合API（1天）

**任务**:
1. 实现`GET /api/v1/console/dashboard/stats` API
2. 并发调用6个微服务API
   - Offer Service: 统计数据
   - AdsCenter Service: 账号数据
   - Console Service: 任务数据
   - Billing Service: Token余额
   - Console Service: 风险提醒
   - Console Service: 通知列表
3. 实现5分钟缓存（Redis）
4. 错误处理（部分失败不影响整体）

**验收标准**:
- ✅ 聚合API响应时间<1秒
- ✅ 部分服务失败不影响整体
- ✅ 缓存正常工作

---

### 阶段5: Admin Service - 管理员API（2天）

**任务**:
1. 实现订阅管理API
   - `GET /api/v1/admin/subscriptions`
   - `GET /api/v1/admin/subscriptions/{id}`
   - `PUT /api/v1/admin/subscriptions/{id}/adjust`
   - `DELETE /api/v1/admin/subscriptions/{id}/cancel`
2. 实现数据分析API
   - `GET /api/v1/admin/analytics/users`
   - `GET /api/v1/admin/analytics/tokens`
   - `GET /api/v1/admin/analytics/revenue`
   - `GET /api/v1/admin/analytics/activity`
3. 权限控制（AdminGuard）
4. 单元测试

**验收标准**:
- ✅ 只有管理员可访问
- ✅ 数据统计准确
- ✅ API测试通过

---

## 测试策略

### 1. 单元测试

**覆盖率目标**: 80%+

**测试范围**:
- 所有新增API端点
- 邀请奖励计算逻辑
- 签到连续天数计算
- 通知创建逻辑

### 2. 集成测试

**测试场景**:
1. 路由重定向测试
   - 访问旧路由，验证自动跳转到新路由
2. Dashboard聚合测试
   - 验证6个微服务数据正确聚合
3. 邀请流程测试
   - 用户A生成邀请链接 → 用户B注册 → 用户A获得奖励
4. 签到流程测试
   - 连续签到7天 → 获得里程碑奖励

### 3. E2E测试

**测试用例**:
1. 路由迁移测试
   - 从旧路由访问，验证重定向
2. Dashboard增强测试
   - 验证Ads数据、风险提醒、通知显示
3. 邀请系统测试
   - 复制邀请链接、查看邀请列表
4. 签到系统测试
   - 点击签到按钮、查看签到日历
5. 管理员功能测试
   - 查看订阅列表、数据分析图表

---

## 实施时间表

### 总工期: 18天（约4周）

| 阶段 | 任务 | 前端 | 后端 | 总天数 |
|------|------|------|------|--------|
| 阶段1 | 路由迁移 | 2天 | - | 2天 |
| 阶段2 | Dashboard增强 | 3天 | 1天 | 3天 |
| 阶段3 | 邀请系统 | 2天 | 2天 | 2天 |
| 阶段4 | 签到系统 | 2天 | 2天 | 2天 |
| 阶段5 | 管理员-订阅 | 2天 | - | 2天 |
| 阶段6 | 管理员-数据分析 | 2天 | 2天 | 2天 |
| 阶段7 | 集成测试 | 2天 | 1天 | 2天 |
| 阶段8 | E2E测试与优化 | 2天 | 1天 | 2天 |
| Buffer | 缓冲时间 | - | - | 1天 |

### 里程碑

| 里程碑 | 完成日期 | 交付物 |
|--------|---------|--------|
| M1: 路由迁移完成 | Day 2 | 新路由可访问，旧路由自动重定向 |
| M2: Dashboard增强完成 | Day 5 | 聚合Offer、Ads数据，显示风险和通知 |
| M3: 邀请系统完成 | Day 7 | 邀请链接、列表、统计、奖励发放 |
| M4: 签到系统完成 | Day 9 | 签到日历、按钮、奖励规则 |
| M5: 管理员功能完成 | Day 13 | 订阅管理、数据分析 |
| M6: 测试完成 | Day 17 | E2E测试通过率>95% |
| M7: 上线部署 | Day 18 | 生产环境发布 |

---

## 风险管理

### 风险1: 路由迁移导致SEO影响

**概率**: 中
**影响**: 中
**缓解措施**:
- 使用301永久重定向
- 提交sitemap更新到搜索引擎
- 监控搜索排名变化

---

### 风险2: Dashboard聚合API性能问题

**概率**: 中
**影响**: 高
**缓解措施**:
- 实现5分钟Redis缓存
- 并发调用微服务API
- 设置合理超时（3秒）
- 部分失败不影响整体

---

### 风险3: 签到系统被刷

**概率**: 高
**影响**: 高
**缓解措施**:
- 每日只能签到一次（数据库约束）
- 服务器端验证时间
- 记录IP和设备指纹
- 异常检测和封禁

---

### 风险4: 邀请系统被滥用

**概率**: 高
**影响**: 高
**缓解措施**:
- 邀请码每人唯一
- 奖励需要被邀请人完成注册+首次充值
- 检测异常注册（同IP、同设备）
- 设置每日邀请上限

---

## 成功标准

### 功能完整性

- ✅ 5个业务模块100%实现
- ✅ 路由迁移完成，无404错误
- ✅ 邀请和签到功能正常工作
- ✅ 管理员功能完善

### 质量标准

- ✅ E2E测试通过率>95%
- ✅ 单元测试覆盖率>80%
- ✅ API响应时间<500ms（P95）
- ✅ 无P0/P1安全漏洞

### 用户体验

- ✅ 路由跳转流畅（重定向<100ms）
- ✅ Dashboard加载<2秒
- ✅ UI/UX统一（shadcn/ui）
- ✅ 移动端友好（响应式布局）

---

## 附录

### A. i18n翻译键

**新增翻译键**（需添加到`locales/zh-CN.json`和`locales/en-US.json`）:

```json
{
  "referral": {
    "title": "邀请好友",
    "description": "邀请好友注册，双方都能获得Token奖励",
    "link": "邀请链接",
    "copy": "复制链接",
    "qrCode": "二维码",
    "totalInvitations": "邀请总数",
    "registrations": "注册人数",
    "conversions": "转化人数",
    "totalRewards": "累计奖励",
    "invitedUser": "被邀请人",
    "status": "状态",
    "rewardEarned": "获得奖励",
    "reward": {
      "registration": "注册奖励",
      "registrationDesc": "好友注册成功后获得100 Tokens",
      "firstPurchase": "首次充值奖励",
      "firstPurchaseDesc": "好友首次充值，获得充值金额10%的Token",
      "recurring": "续费奖励",
      "recurringDesc": "好友续费订阅，获得续费金额5%的Token"
    }
  },
  "checkin": {
    "title": "每日签到",
    "description": "每天签到领取Token奖励，连续签到获得额外奖励",
    "checkInNow": "立即签到",
    "alreadyCheckedIn": "今日已签到",
    "currentStreak": "连续签到",
    "longestStreak": "最长连续",
    "totalCheckins": "累计签到",
    "days": "天",
    "dailyReward": "每日奖励",
    "dailyRewardDesc": "每天签到获得10 Tokens",
    "7DayStreak": "连续7天",
    "7DayStreakDesc": "连续签到7天，额外获得50 Tokens",
    "30DayStreak": "连续30天",
    "30DayStreakDesc": "连续签到30天，额外获得200 Tokens",
    "date": "日期",
    "streakDay": "连续天数",
    "tokensEarned": "获得Token"
  },
  "manage": {
    "subscriptions": {
      "title": "订阅管理",
      "totalUsers": "总用户数",
      "paidUsers": "付费用户",
      "mrr": "月度经常性收入",
      "churnRate": "流失率",
      "user": "用户",
      "plan": "套餐",
      "status": "状态",
      "startDate": "开始日期",
      "renewDate": "续费日期",
      "viewDetails": "查看详情",
      "adjust": "调整套餐",
      "cancel": "取消订阅"
    },
    "analytics": {
      "title": "数据分析",
      "userGrowth": "用户增长",
      "tokenUsage": "Token消耗",
      "revenue": "收入统计",
      "activity": "活跃度分析"
    }
  }
}
```

---

**文档创建**: 2025-10-15
**最后更新**: 2025-10-15
**下次Review**: 实施启动前
