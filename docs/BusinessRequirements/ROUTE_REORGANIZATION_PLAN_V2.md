# AutoAds 路由重组与功能增强方案 V2

**文档版本**: V2.0（根据补充需求更新）
**创建时间**: 2025-10-15
**状态**: ✅ 设计完成，待实施
**负责团队**: Frontend Team + Backend Team

---

## 🔄 V2版本变更说明

### 与V1的主要差异

| 项目 | V1方案 | V2方案（当前） | 变更原因 |
|------|--------|---------------|---------|
| **路由策略** | 301重定向（旧路由保留） | 直接新建，删除旧路由 | 简化部署，避免维护旧代码 |
| **签到奖励** | 每日10 + 连续奖励(7天+50, 30天+200) | 仅每日10 token | 简化逻辑，降低运营成本 |
| **邀请奖励** | Token奖励（注册+100, 首充10%, 续费5%） | 套餐试用奖励 | 提升用户体验，增加付费转化 |
| **自行注册** | 无额外奖励 | 7天Professional试用 | 降低新用户使用门槛 |
| **邀请注册** | Token奖励 | 双方各获14天Professional试用 | 病毒式增长策略 |

---

## 📋 目录

1. [需求概述](#需求概述)
2. [路由实施方案](#路由实施方案)
3. [签到系统设计](#签到系统设计)
4. [邀请系统设计](#邀请系统设计)
5. [数据库Schema设计](#数据库schema设计)
6. [API设计](#api设计)
7. [前端实施计划](#前端实施计划)
8. [后端实施计划](#后端实施计划)
9. [实施时间表](#实施时间表)

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

### 关键变更（V2）

| 功能 | 现有路由 | 新路由 | 实施方式 |
|------|---------|--------|---------|
| 仪表盘 | `/dashboard` | `/dashboard` | 功能增强 |
| Offer管理 | `/dashboard/offers` | `/offers` | 新建页面，删除旧路由 |
| Ads中心 | `/dashboard/ads-center` | `/ads-center` | 新建页面，删除旧路由 |
| 任务中心 | `/dashboard/tasks` | `/tasks` | 新建页面，删除旧路由 |
| 邀请系统 | ❌ 不存在 | `/settings/referral` | 新增（套餐试用奖励） |
| 签到系统 | ❌ 不存在 | `/settings/checkin` | 新增（仅每日10 token） |

---

## 路由实施方案

### 策略说明

**V2策略：直接新建 + 删除旧路由**

```
步骤1: 在新位置创建完整页面
步骤2: 测试新路由功能完整性
步骤3: 更新导航菜单指向新路由
步骤4: 删除旧路由文件
步骤5: 发布上线
```

**优点**:
- ✅ 无需维护重定向配置
- ✅ 代码结构更清晰
- ✅ 减少技术债务
- ✅ 部署后立即生效

**缺点**:
- ⚠️ 旧书签/外部链接会失效（可通过404页面引导用户）
- ⚠️ 需要一次性完成迁移

### 新路由结构

```
apps/frontend/src/app/
├── (site)/                    # 营销页面（不变）
├── auth/                      # 认证页面（不变）
│
├── dashboard/                 # 仪表盘（增强）
│   └── page.tsx              # 聚合Offer、Ads、风险、通知
│
├── offers/                    # Offer管理（新建）
│   ├── page.tsx
│   ├── components/
│   ├── hooks/
│   └── utils/
│
├── ads-center/                # Ads中心（新建）
│   ├── page.tsx
│   ├── components/
│   ├── hooks/
│   └── utils/
│
├── tasks/                     # 任务中心（新建）
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

### 迁移步骤

**阶段1：新建页面（不影响现有功能）**

```bash
# 1. 创建新目录
mkdir -p apps/frontend/src/app/offers
mkdir -p apps/frontend/src/app/ads-center
mkdir -p apps/frontend/src/app/tasks

# 2. 复制文件到新位置
cp -r apps/frontend/src/app/dashboard/offers/* apps/frontend/src/app/offers/
cp -r apps/frontend/src/app/dashboard/ads-center/* apps/frontend/src/app/ads-center/
cp -r apps/frontend/src/app/dashboard/tasks/* apps/frontend/src/app/tasks/

# 3. 更新导入路径（使用IDE全局替换）
# 将所有 '~/app/dashboard/offers' 替换为 '~/app/offers'
# 将所有 '~/app/dashboard/ads-center' 替换为 '~/app/ads-center'
# 将所有 '~/app/dashboard/tasks' 替换为 '~/app/tasks'
```

**阶段2：测试新路由**

```bash
# 测试新路由可访问性
curl http://localhost:3000/offers
curl http://localhost:3000/ads-center
curl http://localhost:3000/tasks

# 运行E2E测试（更新测试脚本中的URL）
npm run test:e2e
```

**阶段3：更新导航菜单**

**文件**: `apps/frontend/src/navigation.config.tsx`

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
```

**阶段4：删除旧路由**

```bash
# 确认新路由测试通过后，删除旧路由
rm -rf apps/frontend/src/app/dashboard/offers
rm -rf apps/frontend/src/app/dashboard/ads-center
rm -rf apps/frontend/src/app/dashboard/tasks
```

**阶段5：自定义404页面（引导用户）**

**文件**: `apps/frontend/src/app/not-found.tsx`

```typescript
export default function NotFound() {
  const router = useRouter();

  // 检测是否访问旧路由
  const pathname = usePathname();
  const redirectMap = {
    '/dashboard/offers': '/offers',
    '/dashboard/ads-center': '/ads-center',
    '/dashboard/tasks': '/tasks',
  };

  const newPath = redirectMap[pathname];

  if (newPath) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold">页面已迁移</h1>
        <p className="mt-2 text-muted-foreground">
          此页面已迁移到新地址
        </p>
        <Button
          onClick={() => router.push(newPath)}
          className="mt-4"
        >
          前往新页面
        </Button>
      </div>
    );
  }

  return <Default404Page />;
}
```

---

## 签到系统设计

### V2简化方案

**核心逻辑**:
- ✅ 每天签到一次
- ✅ 奖励固定：10 Tokens
- ❌ 无连续签到奖励
- ❌ 无里程碑奖励

### UI设计

#### 1. 签到日历

```typescript
<CheckinCalendar
  month={currentMonth}
  checkinDays={[1, 2, 3, 5, 8, 9, 10, 14, 15]} // 已签到的日期
  todayCheckedIn={true}
  onDayClick={(day) => {
    if (day === today && !todayCheckedIn) {
      handleCheckin();
    }
  }}
/>
```

**日历视图**:
```
┌─────────────────────────────────┐
│   2025年10月                    │
├─────────────────────────────────┤
│ 一  二  三  四  五  六  日        │
│     1✓  2✓  3✓  4   5✓  6       │
│ 7   8✓  9✓  10✓ 11  12  13      │
│ 14✓ 15🔥 16  17  18  19  20      │ // 🔥 = 今天（已签到）
│ 21  22  23  24  25  26  27      │
│ 28  29  30  31                  │
└─────────────────────────────────┘

图例：
✓ = 已签到
🔥 = 今天（已签到）
15 = 今天（未签到，可点击）
```

#### 2. 签到按钮

```typescript
<CheckinButton
  disabled={todayCheckedIn}
  onClick={handleCheckin}
  loading={isCheckingIn}
>
  {todayCheckedIn ? (
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

#### 3. 签到统计

```typescript
<CheckinStatsCards>
  <StatCard
    label={t('checkin.totalCheckins')}
    value={totalCheckins}
    description={t('checkin.sinceRegistration')}
    icon={<Calendar />}
  />
  <StatCard
    label={t('checkin.thisMonthCheckins')}
    value={thisMonthCheckins}
    description={`${thisMonthCheckins}/31 days`}
    icon={<CalendarCheck />}
  />
  <StatCard
    label={t('checkin.totalTokensEarned')}
    value={`${totalTokensEarned} Tokens`}
    description={t('checkin.fromCheckins')}
    icon={<Coins />}
  />
</CheckinStatsCards>
```

#### 4. 签到历史（可选，次要功能）

```typescript
<CheckinHistoryTable
  history={recentCheckins.slice(0, 10)} // 最近10次
  columns={[
    {
      header: t('checkin.date'),
      accessor: 'checkinDate',
      cell: (row) => formatDate(row.checkinDate),
    },
    {
      header: t('checkin.tokensEarned'),
      accessor: 'tokensEarned',
      cell: () => '+10 Tokens', // 固定值
    },
  ]}
/>
```

### 签到逻辑

**业务规则**:
1. 每个用户每天只能签到一次（UTC+8时区）
2. 签到成功：立即增加10 Tokens
3. 签到记录持久化到数据库
4. 签到按钮状态：已签到则禁用

**前端逻辑**:
```typescript
const handleCheckin = async () => {
  setIsCheckingIn(true);

  try {
    const response = await fetch('/api/v1/billing/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timezone: 'Asia/Shanghai', // UTC+8
      }),
    });

    if (!response.ok) {
      const error = await response.json();

      if (error.code === 'ALREADY_CHECKED_IN') {
        toast.info(t('checkin.alreadyCheckedInToday'));
      } else {
        toast.error(t('checkin.failed'));
      }
      return;
    }

    const result = await response.json();

    toast.success(t('checkin.success', { tokens: 10 }));

    // 更新UI
    setTodayCheckedIn(true);
    setTotalCheckins(prev => prev + 1);
    setTotalTokensEarned(prev => prev + 10);

    // 刷新Token余额
    mutateTokenBalance();

  } catch (error) {
    toast.error(t('checkin.networkError'));
  } finally {
    setIsCheckingIn(false);
  }
};
```

---

## 邀请系统设计

### V2套餐试用奖励方案

**奖励规则**:

| 注册方式 | 邀请者奖励 | 被邀请者奖励 |
|---------|-----------|-------------|
| **自行注册** | - | 7天Professional试用 + 套餐包含的Tokens |
| **邀请注册** | 14天Professional试用 + 套餐包含的Tokens | 14天Professional试用 + 套餐包含的Tokens |

**Professional套餐权益**（假设）:
- 每月1000 Tokens
- AI评估功能
- 无限Offer数量
- 优先客服支持

**试用期说明**:
- 试用期内享受完整Professional权益
- 试用期结束自动降级为Starter套餐
- 用户可随时付费升级为正式Professional套餐

### UI设计

#### 1. 邀请链接卡片

```typescript
<ReferralLinkCard>
  <div className="space-y-4">
    {/* 标题和描述 */}
    <div>
      <h3 className="font-semibold text-lg">
        {t('referral.inviteFriends')}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t('referral.inviteDescription')} {/* 邀请好友注册，双方都获得14天Professional试用 */}
      </p>
    </div>

    {/* 邀请链接 */}
    <div className="flex items-center gap-2">
      <Input
        value={referralLink} // https://autoads.com/auth/sign-up?ref=ABC123
        readOnly
        className="flex-1 font-mono text-sm"
      />
      <Button
        size="sm"
        onClick={() => {
          navigator.clipboard.writeText(referralLink);
          toast.success(t('referral.linkCopied'));
        }}
      >
        <Copy className="w-4 h-4 mr-1" />
        {t('referral.copy')}
      </Button>
    </div>

    {/* 二维码（可折叠） */}
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full">
          <QrCode className="w-4 h-4 mr-2" />
          {t('referral.showQRCode')}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <div className="flex justify-center">
          <QRCodeSVG
            value={referralLink}
            size={200}
            level="M"
            includeMargin={true}
          />
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {t('referral.scanToRegister')}
        </p>
      </CollapsibleContent>
    </Collapsible>

    {/* 社交分享（可选） */}
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => shareToTwitter(referralLink)}
        className="flex-1"
      >
        <Twitter className="w-4 h-4 mr-1" />
        Twitter
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => shareToEmail(referralLink)}
        className="flex-1"
      >
        <Mail className="w-4 h-4 mr-1" />
        Email
      </Button>
    </div>
  </div>
</ReferralLinkCard>
```

#### 2. 邀请统计

```typescript
<ReferralStatsTiles>
  <StatTile
    label={t('referral.totalInvitations')}
    value={stats.totalInvitations}
    description={t('referral.totalInvitationsDesc')} // 已发送邀请链接
    icon={<Send />}
  />
  <StatTile
    label={t('referral.successfulReferrals')}
    value={stats.successfulReferrals}
    description={t('referral.successfulReferralsDesc')} // 已完成注册
    icon={<UserPlus />}
  />
  <StatTile
    label={t('referral.trialDaysEarned')}
    value={`${stats.trialDaysEarned} ${t('referral.days')}`}
    description={t('referral.trialDaysEarnedDesc')} // 累计获得试用天数
    icon={<Gift />}
  />
  <StatTile
    label={t('referral.activeTrial')}
    value={hasActiveTrial ? t('referral.yes') : t('referral.no')}
    description={activeTrial ? `${t('referral.expiresAt')} ${formatDate(activeTrial.expiresAt)}` : '-'}
    icon={<Sparkles />}
  />
</ReferralStatsTiles>
```

#### 3. 邀请列表

```typescript
<ReferralListTable
  referrals={referrals}
  columns={[
    {
      header: t('referral.invitedUser'),
      accessor: 'refereeEmail',
      cell: (row) => maskEmail(row.refereeEmail), // us***@example.com
    },
    {
      header: t('referral.status'),
      accessor: 'status',
      cell: (row) => {
        const statusMap = {
          pending: { label: t('referral.status.pending'), variant: 'secondary' },
          registered: { label: t('referral.status.registered'), variant: 'success' },
        };
        const status = statusMap[row.status];
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
    {
      header: t('referral.registeredAt'),
      accessor: 'registeredAt',
      cell: (row) => row.registeredAt ? formatDate(row.registeredAt) : '-',
    },
    {
      header: t('referral.trialGranted'),
      accessor: 'trialDays',
      cell: (row) => {
        if (row.status === 'registered') {
          return (
            <span className="text-primary font-medium">
              14 {t('referral.days')}
            </span>
          );
        }
        return '-';
      },
    },
  ]}
  pagination={{
    page: currentPage,
    pageSize: 20,
    total: totalReferrals,
    onPageChange: setCurrentPage,
  }}
/>
```

#### 4. 奖励规则说明

```typescript
<ReferralRewardsCard>
  <div className="space-y-3">
    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
      <UserPlus className="w-5 h-5 text-primary mt-0.5" />
      <div className="flex-1">
        <h4 className="font-medium">{t('referral.reward.selfRegister.title')}</h4>
        <p className="text-sm text-muted-foreground mt-1">
          {t('referral.reward.selfRegister.description')}
        </p>
        <Badge variant="outline" className="mt-2">
          7{t('referral.days')} Professional {t('referral.trial')}
        </Badge>
      </div>
    </div>

    <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
      <Users className="w-5 h-5 text-primary mt-0.5" />
      <div className="flex-1">
        <h4 className="font-medium">{t('referral.reward.inviteRegister.title')}</h4>
        <p className="text-sm text-muted-foreground mt-1">
          {t('referral.reward.inviteRegister.description')}
        </p>
        <div className="flex gap-2 mt-2">
          <Badge variant="default">
            {t('referral.inviter')}: 14{t('referral.days')} Professional
          </Badge>
          <Badge variant="default">
            {t('referral.referee')}: 14{t('referral.days')} Professional
          </Badge>
        </div>
      </div>
    </div>

    <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
      <strong>{t('referral.notice')}:</strong>
      <ul className="mt-1 space-y-1 ml-4 list-disc">
        <li>{t('referral.notice.trialIncludes')}</li>
        <li>{t('referral.notice.autoDowngrade')}</li>
        <li>{t('referral.notice.canUpgrade')}</li>
      </ul>
    </div>
  </div>
</ReferralRewardsCard>
```

### 邀请流程

#### 流程A：自行注册

```
用户访问 /auth/sign-up（无ref参数）
    ↓
注册成功
    ↓
后端自动创建试用订阅：
  - 套餐：Professional
  - 时长：7天
  - Token：Professional套餐包含的Tokens（如1000）
    ↓
用户登录后看到试用提示：
  "您正在试用Professional套餐，剩余X天"
```

#### 流程B：邀请注册

```
用户A分享邀请链接：https://autoads.com/auth/sign-up?ref=ABC123
    ↓
用户B点击链接访问注册页面
    ↓
注册页面显示：
  "您正在通过邀请注册，注册成功后您和邀请者都将获得14天Professional试用"
    ↓
用户B注册成功
    ↓
后端处理：
  1. 标记referral记录状态为registered
  2. 为用户B创建14天Professional试用
  3. 为用户A创建或延长14天Professional试用
  4. 发放Token（Professional套餐包含的Tokens）
  5. 发送通知给用户A："您邀请的好友已注册，您获得了14天Professional试用"
    ↓
用户A和用户B都看到试用提示
```

### 试用订阅管理

**数据模型**:
```typescript
type TrialSubscription = {
  userId: string;
  plan: 'professional'; // 固定
  startDate: string;
  endDate: string;
  status: 'active' | 'expired';
  source: 'self_register' | 'referral_inviter' | 'referral_referee';
  tokensGranted: number; // Professional套餐包含的Tokens
};
```

**叠加规则**:
- 如果用户已有试用期，新的试用期叠加到现有试用期之后
- 例如：用户A现有试用剩余3天，邀请成功后延长14天，总计剩余17天

**到期处理**:
- 定时任务每小时检查到期的试用订阅
- 自动降级为Starter套餐
- 发送通知："您的Professional试用已结束，已自动切换为Starter套餐"
- 提供升级入口

---

## 数据库Schema设计

### 1. Billing Service - 签到表（简化版）

```sql
-- 签到记录表
CREATE TABLE checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    -- 签到信息
    checkin_date DATE NOT NULL,                  -- 签到日期（YYYY-MM-DD）
    tokens_earned INTEGER NOT NULL DEFAULT 10,   -- 固定10 Tokens

    created_at TIMESTAMP DEFAULT NOW(),

    -- 约束：每个用户每天只能签到一次
    UNIQUE (user_id, checkin_date),

    -- 索引
    INDEX idx_user_date (user_id, checkin_date DESC),
    INDEX idx_date (checkin_date DESC)
);

-- RLS策略
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_own_checkins ON checkins
    FOR ALL USING (user_id = current_setting('app.user_id')::uuid);

-- 用户签到统计表（缓存，提升查询性能）
CREATE TABLE user_checkin_stats (
    user_id UUID PRIMARY KEY,

    -- 统计
    total_checkins INTEGER DEFAULT 0,            -- 总签到天数
    total_tokens_earned INTEGER DEFAULT 0,       -- 总获得Token（应该 = total_checkins * 10）
    this_month_checkins INTEGER DEFAULT 0,       -- 本月签到天数

    -- 最后签到
    last_checkin_date DATE,

    updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS策略
ALTER TABLE user_checkin_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_own_stats ON user_checkin_stats
    FOR ALL USING (user_id = current_setting('app.user_id')::uuid);
```

### 2. Billing Service - 邀请表（套餐试用版）

```sql
-- 邀请表
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_user_id UUID NOT NULL,              -- 邀请人
    referral_code VARCHAR(20) NOT NULL UNIQUE,   -- 邀请码（如ABC123）

    -- 被邀请人信息
    referee_user_id UUID,                        -- 被邀请人（注册后填充）
    referee_email VARCHAR(255),                  -- 被邀请人邮箱

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, registered

    -- 奖励（试用订阅）
    inviter_trial_granted BOOLEAN DEFAULT false, -- 邀请人是否已获得试用
    referee_trial_granted BOOLEAN DEFAULT false, -- 被邀请人是否已获得试用
    inviter_trial_days INTEGER DEFAULT 14,
    referee_trial_days INTEGER DEFAULT 14,

    -- 时间
    created_at TIMESTAMP DEFAULT NOW(),          -- 邀请链接生成时间
    registered_at TIMESTAMP,                     -- 被邀请人注册时间

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

### 3. Billing Service - 试用订阅表

```sql
-- 试用订阅表
CREATE TABLE trial_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    -- 套餐信息
    plan VARCHAR(20) NOT NULL DEFAULT 'professional', -- 固定为professional

    -- 时间
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'active',    -- active, expired

    -- 来源
    source VARCHAR(50) NOT NULL,                     -- self_register, referral_inviter, referral_referee
    referral_id UUID,                                -- 关联的referral记录（如果来源是邀请）

    -- 奖励Token
    tokens_granted INTEGER NOT NULL,                 -- 赠送的Token数量

    created_at TIMESTAMP DEFAULT NOW(),
    expired_at TIMESTAMP,                            -- 实际过期时间

    -- 索引
    INDEX idx_user_status (user_id, status),
    INDEX idx_end_date (end_date),
    INDEX idx_source (source)
);

-- RLS策略
ALTER TABLE trial_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_own_trials ON trial_subscriptions
    FOR ALL USING (user_id = current_setting('app.user_id')::uuid);
```

### 4. Console Service - 通知表

```sql
-- 通知表（与V1相同）
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    -- 通知内容
    type VARCHAR(50) NOT NULL,                   -- evaluation_complete, sync_complete, referral_reward, trial_expiring, etc.
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- 状态
    read BOOLEAN DEFAULT false,

    -- 关联对象
    related_object_type VARCHAR(50),             -- offer, ads_account, task, referral, subscription
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

### 1. Billing Service - 签到API（简化版）

#### GET `/api/v1/billing/checkin/status`

获取签到状态

**响应**:
```json
{
  "totalCheckins": 45,
  "totalTokensEarned": 450,
  "thisMonthCheckins": 12,
  "lastCheckinDate": "2025-10-14",
  "canCheckinToday": true,
  "todayCheckedIn": false
}
```

#### POST `/api/v1/billing/checkin`

执行签到

**请求**:
```json
{
  "timezone": "Asia/Shanghai" // 可选，默认UTC+8
}
```

**响应（成功）**:
```json
{
  "success": true,
  "checkin": {
    "date": "2025-10-15",
    "tokensEarned": 10
  },
  "newBalance": 110,
  "stats": {
    "totalCheckins": 46,
    "totalTokensEarned": 460,
    "thisMonthCheckins": 13
  }
}
```

**响应（已签到）**:
```json
{
  "success": false,
  "code": "ALREADY_CHECKED_IN",
  "message": "You have already checked in today"
}
```

#### GET `/api/v1/billing/checkin/history`

获取签到历史

**查询参数**:
- `month`: YYYY-MM（查询月份，默认当月）
- `limit`: 数量限制（默认31）

**响应**:
```json
{
  "history": [
    {
      "date": "2025-10-15",
      "tokensEarned": 10
    },
    {
      "date": "2025-10-14",
      "tokensEarned": 10
    }
  ],
  "checkinDays": [1, 2, 3, 5, 8, 9, 10, 14, 15], // 本月已签到的日期
  "thisMonthTotal": 9
}
```

---

### 2. Billing Service - 邀请API（套餐试用版）

#### GET `/api/v1/billing/referral`

获取邀请链接和统计

**响应**:
```json
{
  "referralCode": "ABC123",
  "referralLink": "https://autoads.com/auth/sign-up?ref=ABC123",
  "stats": {
    "totalInvitations": 10,             // 邀请链接被访问次数（可选）
    "successfulReferrals": 5,           // 成功注册人数
    "trialDaysEarned": 70,              // 累计获得试用天数（5 * 14 = 70）
    "activeTrial": {                    // 当前激活的试用（如果有）
      "plan": "professional",
      "startDate": "2025-10-01T00:00:00Z",
      "endDate": "2025-10-15T23:59:59Z",
      "daysRemaining": 5
    }
  }
}
```

#### GET `/api/v1/billing/referral/list`

获取邀请列表

**查询参数**:
- `page`: 页码（默认1）
- `limit`: 每页数量（默认20）
- `status`: pending, registered

**响应**:
```json
{
  "referrals": [
    {
      "id": "uuid",
      "refereeEmail": "us***@example.com",    // 脱敏
      "status": "registered",
      "registeredAt": "2025-10-01T10:00:00Z",
      "trialGranted": true,
      "trialDays": 14
    },
    {
      "id": "uuid",
      "refereeEmail": null,                   // 未注册
      "status": "pending",
      "registeredAt": null,
      "trialGranted": false,
      "trialDays": 0
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 20
}
```

#### POST `/api/v1/billing/referral/track`（内部API）

跟踪邀请注册（由Auth Service在用户注册时调用）

**请求**:
```json
{
  "referralCode": "ABC123",
  "newUserId": "uuid",
  "newUserEmail": "newuser@example.com"
}
```

**响应**:
```json
{
  "success": true,
  "referrer": {
    "userId": "uuid",
    "trialGranted": true,
    "trialDays": 14,
    "trialEndDate": "2025-10-29T23:59:59Z"
  },
  "referee": {
    "userId": "uuid",
    "trialGranted": true,
    "trialDays": 14,
    "trialEndDate": "2025-10-29T23:59:59Z"
  }
}
```

---

### 3. Billing Service - 试用订阅API

#### GET `/api/v1/billing/trial/active`

获取当前激活的试用订阅

**响应（有试用）**:
```json
{
  "hasTrial": true,
  "trial": {
    "id": "uuid",
    "plan": "professional",
    "startDate": "2025-10-01T00:00:00Z",
    "endDate": "2025-10-15T23:59:59Z",
    "daysRemaining": 5,
    "status": "active",
    "source": "referral_inviter",
    "tokensGranted": 1000
  }
}
```

**响应（无试用）**:
```json
{
  "hasTrial": false,
  "trial": null
}
```

#### GET `/api/v1/billing/trial/history`

获取试用历史

**响应**:
```json
{
  "history": [
    {
      "id": "uuid",
      "plan": "professional",
      "startDate": "2025-10-01T00:00:00Z",
      "endDate": "2025-10-15T23:59:59Z",
      "status": "expired",
      "source": "self_register",
      "tokensGranted": 1000
    }
  ],
  "total": 1
}
```

---

### 4. Auth Service - 注册增强

#### POST `/auth/sign-up`

用户注册（需增强邀请逻辑）

**请求**:
```json
{
  "email": "user@example.com",
  "password": "********",
  "referralCode": "ABC123" // 可选，从URL参数?ref=ABC123获取
}
```

**响应**:
```json
{
  "success": true,
  "userId": "uuid",
  "trial": {
    "granted": true,
    "plan": "professional",
    "days": 14,
    "source": "referral_referee"
  }
}
```

**后端处理逻辑**:
```go
func HandleSignUp(req SignUpRequest) (*SignUpResponse, error) {
    // 1. 创建用户账号
    user, err := createUser(req.Email, req.Password)
    if err != nil {
        return nil, err
    }

    // 2. 判断是否通过邀请注册
    var trialDays int
    var trialSource string

    if req.ReferralCode != "" {
        // 邀请注册：双方各获14天
        trialDays = 14
        trialSource = "referral_referee"

        // 调用Billing Service处理邀请奖励
        err = billingClient.TrackReferral(req.ReferralCode, user.ID, user.Email)
        if err != nil {
            log.Error("Failed to track referral", err)
            // 不影响注册流程，继续
        }
    } else {
        // 自行注册：获得7天
        trialDays = 7
        trialSource = "self_register"
    }

    // 3. 创建试用订阅
    trial, err := billingClient.CreateTrialSubscription(&TrialSubscription{
        UserID: user.ID,
        Plan: "professional",
        Days: trialDays,
        Source: trialSource,
        TokensGranted: 1000, // Professional套餐包含的Tokens
    })
    if err != nil {
        log.Error("Failed to create trial subscription", err)
        // 不影响注册流程，继续
    }

    // 4. 发送欢迎邮件（包含试用信息）
    emailClient.SendWelcomeEmail(user.Email, trial)

    return &SignUpResponse{
        Success: true,
        UserID: user.ID,
        Trial: trial,
    }, nil
}
```

---

### 5. Console Service - 通知API（与V1相同）

#### GET `/api/v1/console/notifications`

**响应**:
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "referral_reward",
      "title": "邀请奖励已发放",
      "description": "您邀请的好友已注册，您获得了14天Professional试用",
      "read": false,
      "relatedObjectType": "referral",
      "relatedObjectId": "uuid",
      "actionUrl": "/settings/referral",
      "actionLabel": "查看详情",
      "createdAt": "2025-10-15T10:30:00Z"
    },
    {
      "id": "uuid",
      "type": "trial_expiring",
      "title": "试用即将到期",
      "description": "您的Professional试用还剩3天，到期后将自动切换为Starter套餐",
      "read": false,
      "relatedObjectType": "subscription",
      "relatedObjectId": "uuid",
      "actionUrl": "/settings/subscription",
      "actionLabel": "立即升级",
      "createdAt": "2025-10-12T00:00:00Z"
    }
  ],
  "total": 15,
  "unreadCount": 3
}
```

---

## 前端实施计划

### 阶段1: 路由新建（2天）

**任务**:
1. 在新位置创建页面文件（复制现有代码）
2. 更新所有导入路径
3. 更新导航菜单配置
4. 创建404引导页面
5. 本地测试新路由

**验收标准**:
- ✅ 新路由可正常访问（/offers, /ads-center, /tasks）
- ✅ 所有功能正常工作
- ✅ 导航菜单指向新路由

---

### 阶段2: Dashboard增强（3天）

与V1相同，略。

---

### 阶段3: 签到系统（1天）

**3.1 签到日历（0.5天）**

**任务**:
1. 创建CheckinCalendar组件
2. 显示当月签到情况
3. 高亮已签到日期和今天

**文件**:
- `apps/frontend/src/app/settings/checkin/page.tsx`
- `apps/frontend/src/app/settings/checkin/components/CheckinCalendar.tsx`

**3.2 签到按钮和统计（0.5天）**

**任务**:
1. 创建CheckinButton组件
2. 集成`POST /api/v1/billing/checkin` API
3. 创建CheckinStatsCards组件
4. 显示总签到数、本月签到数、总获得Token

**文件**:
- `apps/frontend/src/app/settings/checkin/components/CheckinButton.tsx`
- `apps/frontend/src/app/settings/checkin/components/CheckinStatsCards.tsx`

---

### 阶段4: 邀请系统（2天）

**4.1 邀请链接和二维码（0.5天）**

**任务**:
1. 创建ReferralLinkCard组件
2. 集成`GET /api/v1/billing/referral` API
3. 实现复制链接功能
4. 显示二维码（使用`qrcode.react`库）

**文件**:
- `apps/frontend/src/app/settings/referral/page.tsx`
- `apps/frontend/src/app/settings/referral/components/ReferralLinkCard.tsx`

**依赖**:
```bash
npm install qrcode.react
```

**4.2 邀请统计（0.5天）**

**任务**:
1. 创建ReferralStatsTiles组件
2. 显示邀请数、注册数、试用天数、当前试用状态

**文件**:
- `apps/frontend/src/app/settings/referral/components/ReferralStatsTiles.tsx`

**4.3 邀请列表（0.5天）**

**任务**:
1. 创建ReferralListTable组件
2. 集成`GET /api/v1/billing/referral/list` API
3. 显示被邀请人邮箱（脱敏）、状态、奖励

**文件**:
- `apps/frontend/src/app/settings/referral/components/ReferralListTable.tsx`

**4.4 奖励规则说明（0.5天）**

**任务**:
1. 创建ReferralRewardsCard组件
2. 显示两种注册方式的奖励规则

**文件**:
- `apps/frontend/src/app/settings/referral/components/ReferralRewardsCard.tsx`

---

### 阶段5: Manage增强（4天）

与V1相同，略。

---

## 后端实施计划

### 阶段1: Billing Service - 签到系统（1天）

**任务**:
1. 创建checkins表和user_checkin_stats表
2. 实现3个API端点
   - `GET /api/v1/billing/checkin/status`
   - `POST /api/v1/billing/checkin`
   - `GET /api/v1/billing/checkin/history`
3. 实现签到逻辑
   - 每日只能签到一次（基于UTC+8时区）
   - 固定奖励10 Tokens
   - 更新统计缓存表
4. 单元测试

**业务逻辑**:
```go
func HandleCheckin(userID string, timezone string) (*CheckinResponse, error) {
    // 1. 获取当前日期（指定时区）
    loc, _ := time.LoadLocation(timezone) // "Asia/Shanghai"
    now := time.Now().In(loc)
    todayDate := now.Format("2006-01-02")

    // 2. 检查今天是否已签到
    exists, err := db.CheckinExists(userID, todayDate)
    if err != nil {
        return nil, err
    }
    if exists {
        return nil, errors.New("ALREADY_CHECKED_IN")
    }

    // 3. 创建签到记录
    checkin := &Checkin{
        UserID: userID,
        CheckinDate: todayDate,
        TokensEarned: 10,
    }
    err = db.CreateCheckin(checkin)
    if err != nil {
        return nil, err
    }

    // 4. 增加Token余额
    err = billingClient.AddTokens(userID, 10, "checkin", checkin.ID)
    if err != nil {
        log.Error("Failed to add tokens", err)
        // 已创建签到记录，不回滚
    }

    // 5. 更新统计缓存
    err = db.IncrementCheckinStats(userID, todayDate)
    if err != nil {
        log.Error("Failed to update stats", err)
    }

    // 6. 获取新余额和统计
    balance, _ := billingClient.GetTokenBalance(userID)
    stats, _ := db.GetCheckinStats(userID)

    return &CheckinResponse{
        Success: true,
        Checkin: checkin,
        NewBalance: balance,
        Stats: stats,
    }, nil
}
```

**验收标准**:
- ✅ 签到幂等性保证（同一天重复调用返回错误）
- ✅ Token正确增加
- ✅ 统计数据准确
- ✅ 单元测试通过

---

### 阶段2: Billing Service - 邀请系统（2天）

**任务**:
1. 创建referrals表和trial_subscriptions表
2. 实现3个API端点
   - `GET /api/v1/billing/referral`
   - `GET /api/v1/billing/referral/list`
   - `POST /api/v1/billing/referral/track`（内部API）
3. 实现试用订阅创建逻辑
4. 实现试用订阅到期检查（定时任务）
5. 单元测试

**试用订阅创建逻辑**:
```go
func CreateTrialSubscription(req *TrialSubscriptionRequest) (*TrialSubscription, error) {
    // 1. 检查用户是否已有激活的试用
    activeTrial, err := db.GetActiveTrialSubscription(req.UserID)
    if err != nil && err != sql.ErrNoRows {
        return nil, err
    }

    var startDate, endDate time.Time

    if activeTrial != nil {
        // 已有试用，叠加到现有试用期之后
        startDate = activeTrial.EndDate.Add(1 * time.Second)
        endDate = startDate.Add(time.Duration(req.Days) * 24 * time.Hour)
    } else {
        // 无试用，从现在开始
        startDate = time.Now()
        endDate = startDate.Add(time.Duration(req.Days) * 24 * time.Hour)
    }

    // 2. 创建试用订阅记录
    trial := &TrialSubscription{
        UserID: req.UserID,
        Plan: "professional",
        StartDate: startDate,
        EndDate: endDate,
        Status: "active",
        Source: req.Source,
        ReferralID: req.ReferralID,
        TokensGranted: req.TokensGranted,
    }
    err = db.CreateTrialSubscription(trial)
    if err != nil {
        return nil, err
    }

    // 3. 赠送Token
    err = billingClient.AddTokens(req.UserID, req.TokensGranted, "trial_subscription", trial.ID)
    if err != nil {
        log.Error("Failed to add tokens", err)
    }

    // 4. 发送通知
    notificationClient.Send(req.UserID, "trial_granted", trial.ID)

    return trial, nil
}
```

**邀请跟踪逻辑**:
```go
func TrackReferral(referralCode string, newUserID string, newUserEmail string) error {
    // 1. 查找referral记录
    referral, err := db.GetReferralByCode(referralCode)
    if err != nil {
        return err
    }

    // 2. 更新referral状态
    referral.RefereeUserID = newUserID
    referral.RefereeEmail = newUserEmail
    referral.Status = "registered"
    referral.RegisteredAt = time.Now()
    err = db.UpdateReferral(referral)
    if err != nil {
        return err
    }

    // 3. 为被邀请人创建14天试用
    refereeTrial, err := CreateTrialSubscription(&TrialSubscriptionRequest{
        UserID: newUserID,
        Days: 14,
        Source: "referral_referee",
        ReferralID: referral.ID,
        TokensGranted: 1000, // Professional套餐包含的Tokens
    })
    if err != nil {
        log.Error("Failed to create referee trial", err)
    }

    referral.RefereeTrialGranted = true
    db.UpdateReferral(referral)

    // 4. 为邀请人创建或延长14天试用
    inviterTrial, err := CreateTrialSubscription(&TrialSubscriptionRequest{
        UserID: referral.ReferrerUserID,
        Days: 14,
        Source: "referral_inviter",
        ReferralID: referral.ID,
        TokensGranted: 1000,
    })
    if err != nil {
        log.Error("Failed to create inviter trial", err)
    }

    referral.InviterTrialGranted = true
    db.UpdateReferral(referral)

    // 5. 发送通知给邀请人
    notificationClient.Send(referral.ReferrerUserID, "referral_reward", referral.ID)

    return nil
}
```

**试用到期检查**（定时任务，每小时执行）:
```go
func CheckExpiredTrials() {
    // 1. 查询即将到期的试用（未来24小时内）
    expiringTrials, err := db.GetExpiringTrials(24 * time.Hour)
    if err != nil {
        log.Error("Failed to get expiring trials", err)
        return
    }

    // 2. 发送到期提醒通知
    for _, trial := range expiringTrials {
        notificationClient.Send(trial.UserID, "trial_expiring", trial.ID)
    }

    // 3. 查询已到期的试用
    expiredTrials, err := db.GetExpiredTrials()
    if err != nil {
        log.Error("Failed to get expired trials", err)
        return
    }

    // 4. 标记为已过期
    for _, trial := range expiredTrials {
        trial.Status = "expired"
        trial.ExpiredAt = time.Now()
        db.UpdateTrialSubscription(trial)

        // 发送过期通知
        notificationClient.Send(trial.UserID, "trial_expired", trial.ID)
    }

    log.Info("Checked expired trials", "expiring", len(expiringTrials), "expired", len(expiredTrials))
}
```

**验收标准**:
- ✅ 邀请码生成唯一
- ✅ 试用订阅正确创建
- ✅ 试用期叠加逻辑正确
- ✅ 到期自动降级
- ✅ 单元测试通过

---

### 阶段3: Auth Service - 注册增强（1天）

**任务**:
1. 修改注册接口，支持referralCode参数
2. 集成Billing Service的TrackReferral API
3. 根据是否有referralCode决定试用天数（7天 vs 14天）
4. 单元测试

**验收标准**:
- ✅ 自行注册获得7天试用
- ✅ 邀请注册双方各获14天试用
- ✅ Token正确发放
- ✅ 单元测试通过

---

### 阶段4: Console Service - 通知系统（2天）

与V1相同，略。

---

### 阶段5: Admin Service - 管理员API（2天）

与V1相同，略。

---

## 实施时间表

### 总工期: 15天（约3周）

| 阶段 | 任务 | 前端 | 后端 | 总天数 |
|------|------|------|------|--------|
| 阶段1 | 路由新建 | 2天 | - | 2天 |
| 阶段2 | Dashboard增强 | 3天 | 1天 | 3天 |
| 阶段3 | 签到系统 | 1天 | 1天 | 1天 |
| 阶段4 | 邀请系统 | 2天 | 2天 | 2天 |
| 阶段5 | 管理员-订阅 | 2天 | - | 2天 |
| 阶段6 | 管理员-数据分析 | 2天 | 2天 | 2天 |
| 阶段7 | 集成测试 | 1天 | 1天 | 1天 |
| 阶段8 | E2E测试与优化 | 1天 | 1天 | 1天 |
| Buffer | 缓冲时间 | - | - | 1天 |

**相比V1减少3天**（签到系统简化，无需301重定向配置）

### 里程碑

| 里程碑 | 完成日期 | 交付物 |
|--------|---------|--------|
| M1: 路由新建完成 | Day 2 | 新路由可访问，旧路由保留 |
| M2: Dashboard增强完成 | Day 5 | 聚合Offer、Ads数据，显示风险和通知 |
| M3: 签到系统完成 | Day 6 | 签到日历、按钮、统计（仅每日10 token） |
| M4: 邀请系统完成 | Day 8 | 邀请链接、列表、试用奖励发放 |
| M5: 管理员功能完成 | Day 12 | 订阅管理、数据分析 |
| M6: 测试完成 | Day 14 | E2E测试通过率>95% |
| M7: 上线部署 | Day 15 | 删除旧路由，生产环境发布 |

---

## 风险管理

### 风险1: 试用订阅叠加逻辑复杂

**概率**: 中
**影响**: 中
**缓解措施**:
- 明确叠加规则：新试用期接在现有试用期之后
- 充分的单元测试覆盖边界情况
- 用户界面清晰显示试用到期时间

---

### 风险2: 试用到期处理失败

**概率**: 低
**影响**: 高
**缓解措施**:
- 定时任务每小时检查，降低遗漏风险
- 失败重试机制
- 监控告警（到期未处理的试用数量）
- 手动降级脚本备用

---

### 风险3: 邀请系统被滥用

**概率**: 中
**影响**: 中
**缓解措施**:
- 邀请码唯一且不可伪造
- 检测异常注册（同IP、同设备）
- 每个邀请码只能使用一次
- 监控异常邀请行为（短时间大量注册）

---

### 风险4: 删除旧路由后书签失效

**概率**: 高
**影响**: 低
**缓解措施**:
- 自定义404页面检测旧路由并引导用户
- 提前公告路由变更（发送邮件/站内通知）
- 保留旧路由1-2周过渡期（可选）

---

## 成功标准

### 功能完整性

- ✅ 5个业务模块100%实现
- ✅ 路由新建完成，功能正常
- ✅ 签到功能正常（每日10 token）
- ✅ 邀请系统正常（试用奖励发放）
- ✅ 管理员功能完善

### 质量标准

- ✅ E2E测试通过率>95%
- ✅ 单元测试覆盖率>80%
- ✅ API响应时间<500ms（P95）
- ✅ Dashboard加载<2秒

### 用户体验

- ✅ 路由迁移平滑（404引导）
- ✅ UI/UX统一（shadcn/ui）
- ✅ 移动端友好
- ✅ 试用到期提醒清晰

---

## 附录

### A. i18n翻译键（更新）

**签到系统**（简化）:
```json
{
  "checkin": {
    "title": "每日签到",
    "description": "每天签到领取10 Tokens奖励",
    "checkInNow": "立即签到",
    "alreadyCheckedIn": "今日已签到",
    "totalCheckins": "累计签到",
    "thisMonthCheckins": "本月签到",
    "totalTokensEarned": "累计获得Token",
    "sinceRegistration": "自注册以来",
    "fromCheckins": "来自签到",
    "date": "日期",
    "tokensEarned": "获得Token",
    "success": "签到成功！获得 {tokens} Tokens",
    "failed": "签到失败，请稍后重试",
    "networkError": "网络错误，请检查连接",
    "alreadyCheckedInToday": "您今天已经签到过了"
  }
}
```

**邀请系统**（套餐试用版）:
```json
{
  "referral": {
    "title": "邀请好友",
    "description": "邀请好友注册，双方都能获得试用奖励",
    "inviteFriends": "邀请好友",
    "inviteDescription": "邀请好友注册，您和好友都将获得14天Professional套餐试用",
    "link": "邀请链接",
    "copy": "复制链接",
    "linkCopied": "链接已复制",
    "showQRCode": "显示二维码",
    "scanToRegister": "扫码注册",
    "totalInvitations": "邀请总数",
    "totalInvitationsDesc": "已发送邀请链接",
    "successfulReferrals": "成功注册",
    "successfulReferralsDesc": "已通过邀请链接注册",
    "trialDaysEarned": "累计试用天数",
    "trialDaysEarnedDesc": "通过邀请获得的试用天数",
    "activeTrial": "当前试用",
    "days": "天",
    "yes": "是",
    "no": "否",
    "expiresAt": "到期时间",
    "invitedUser": "被邀请人",
    "status": "状态",
    "status.pending": "待注册",
    "status.registered": "已注册",
    "registeredAt": "注册时间",
    "trialGranted": "试用已发放",
    "trial": "试用",
    "inviter": "邀请人",
    "referee": "被邀请人",
    "reward": {
      "selfRegister": {
        "title": "自行注册",
        "description": "直接注册，获得7天Professional套餐试用"
      },
      "inviteRegister": {
        "title": "邀请注册",
        "description": "通过邀请链接注册，邀请者和被邀请者都获得14天Professional套餐试用"
      }
    },
    "notice": "注意事项",
    "notice.trialIncludes": "试用期包含Professional套餐的所有功能和Token",
    "notice.autoDowngrade": "试用期结束后自动降级为Starter套餐",
    "notice.canUpgrade": "试用期内可随时付费升级为正式套餐"
  }
}
```

---

**文档创建**: 2025-10-15
**最后更新**: 2025-10-15（V2）
**下次Review**: 实施启动前
