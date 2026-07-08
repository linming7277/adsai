# Ads Center & Tasks 页面完善设计方案

**文档版本**: V1.0
**创建时间**: 2025-10-15
**基于**: ROUTE_REORGANIZATION_PLAN_V2.md + 现有实现分析

---

## 📋 目录

1. [设计概述](#设计概述)
2. [Ads Center页面设计](#ads-center页面设计)
3. [Tasks页面设计](#tasks页面设计)
4. [数据模型与API](#数据模型与api)
5. [实施计划](#实施计划)

---

## 设计概述

### 现状分析

**已有实现**:
- ✅ `/dashboard/ads-center` - 功能完整，包括账号列表、同步、策略模板、执行报告
- ✅ `/dashboard/tasks` - 功能完整，包括任务列表、筛选、时间线、Token统计

**待完善**:
1. **路由迁移**: 从`/dashboard/`迁移到顶层路由
2. **功能增强**:
   - Ads Center: 增加Offer关联展示、数据分析
   - Tasks: 增加任务类型展示、Token消耗明细
3. **数据隔离**: 确保所有查询基于`user_id`过滤

### 核心原则

- ✅ **用户级隔离**: 所有数据查询必须加`WHERE user_id = $user_id`
- ✅ **性能优化**: 使用索引、缓存、分页
- ✅ **实时同步**: SSE推送状态更新
- ✅ **简洁直观**: 遵循现有UI规范

---

## Ads Center页面设计

### 页面路由

**新路由**: `/ads-center`（从`/dashboard/ads-center`迁移）

### 功能模块

#### 1. 账号概览（Summary Cards）

**组件**: `<AdsSummaryTiles />`

```typescript
interface AdsSummaryStats {
  totalAccounts: number;        // 总账号数
  activeAccounts: number;       // 活跃账号数（最近7天有数据）
  pausedAccounts: number;       // 暂停账号数
  totalOffers: number;          // 关联Offer总数
  totalCampaigns: number;       // 总广告系列数
  totalAdGroups: number;        // 总广告组数
  totalAds: number;             // 总广告数
  todaySpend: number;           // 今日花费
  todayImpressions: number;     // 今日展示
  todayClicks: number;          // 今日点击
}
```

**展示**:
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ 总账号      │ 活跃账号    │ 关联Offer   │ 今日花费    │
│ 5          │ 3          │ 12         │ $245.80    │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

#### 2. 账号列表（Accounts Table）

**组件**: `<AdsAccountsTable />`

**列定义**:
| 列名 | 说明 | 示例 |
|------|------|------|
| 账号名称 | Google Ads账号名 + 图标 | 🎯 Nike Ads Account |
| 账号ID | Customer ID | 123-456-7890 |
| 状态 | enabled/paused/suspended | 🟢 Active |
| 关联Offer | 关联的Offer数量 | 3 offers |
| 最近同步 | 上次同步时间 | 2分钟前 |
| 数据统计 | 花费/点击/转化 | $89.20 / 340 / 12 |
| 操作 | 同步/断开/详情 | [同步] [详情] |

**数据查询（含用户隔离）**:
```sql
SELECT
  uac.id,
  uac.account_id,
  uac.account_name,
  uac.account_status,
  uac.last_sync_at,
  COUNT(DISTINCT o.id) as offer_count,
  SUM(apm.cost_micros) / 1000000 as total_spend,
  SUM(apm.clicks) as total_clicks
FROM user_ads_connections uac
LEFT JOIN offers o ON o.ads_account_id = uac.account_id AND o.user_id = uac.user_id
LEFT JOIN ads_performance_metrics apm ON apm.account_id = uac.account_id
  AND apm.date = CURRENT_DATE
WHERE uac.user_id = $user_id  -- 用户隔离
GROUP BY uac.id
ORDER BY uac.last_sync_at DESC;
```

#### 3. 账号详情对话框（Account Detail Dialog）

**组件**: `<AdsAccountDetailDialog />`

**Tab结构**:
```
┌───────────────────────────────────────────────────────┐
│ [概览] [关联Offer] [广告系列] [性能数据] [同步日志]   │
├───────────────────────────────────────────────────────┤
│                                                       │
│  Tab 1 - 概览:                                       │
│    - 账号基本信息                                      │
│    - 当前状态                                         │
│    - 授权信息                                         │
│    - 数据统计（30天）                                 │
│                                                       │
│  Tab 2 - 关联Offer:                                  │
│    ┌──────────┬────────┬────────┬────────┐           │
│    │ Offer名  │ 状态   │ 广告组 │ 花费   │           │
│    ├──────────┼────────┼────────┼────────┤           │
│    │ Nike    │ Active │ 3      │ $45.2  │           │
│    │ Adidas  │ Paused │ 2      │ $23.8  │           │
│    └──────────┴────────┴────────┴────────┘           │
│                                                       │
│  Tab 3 - 广告系列:                                    │
│    - 广告系列列表                                      │
│    - 预算/状态/性能                                    │
│                                                       │
│  Tab 4 - 性能数据:                                    │
│    - 图表展示                                         │
│    - 趋势分析                                         │
│                                                       │
│  Tab 5 - 同步日志:                                    │
│    - 同步历史                                         │
│    - 错误日志                                         │
│                                                       │
└───────────────────────────────────────────────────────┘
```

#### 4. Offer关联面板（NEW）

**组件**: `<OfferAssociationPanel />`

**功能**: 展示该账号下所有关联的Offer及其广告表现

```typescript
<OfferAssociationPanel
  accountId={selectedAccountId}
  offers={associatedOffers}
  onViewOffer={(offerId) => router.push(`/offers/${offerId}`)}
  onUnlink={(offerId) => handleUnlink(offerId)}
/>
```

**展示**:
```
关联的Offers (12)
┌────────────────────────────────────────────────────────┐
│ Nike.com                         [查看] [取消关联]      │
│ 3个广告组 | $45.20 | CTR 2.3% | 12转化                │
├────────────────────────────────────────────────────────┤
│ Adidas.com                       [查看] [取消关联]      │
│ 2个广告组 | $23.80 | CTR 1.8% | 5转化                 │
└────────────────────────────────────────────────────────┘
```

#### 5. 策略模板（Strategy Templates）

**组件**: `<StrategyTemplates />`（现有）

保持现有实现，展示可用的广告策略模板。

#### 6. 执行报告（Execution Report）

**组件**: `<ExecutionReport />`（现有）

保持现有实现，展示自动化执行结果。

---

## Tasks页面设计

### 页面路由

**新路由**: `/tasks`（从`/dashboard/tasks`迁移）

### 功能模块

#### 1. Token余额卡片（Token Balance Card）

**组件**: `<TokenBalanceCard />`

```typescript
<TokenBalanceCard>
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-muted-foreground">{t('tasks.tokenBalance')}</p>
      <p className="text-3xl font-bold">{balance} Tokens</p>
    </div>
    <Button variant="outline" onClick={() => router.push('/settings/tokens')}>
      {t('tasks.buyTokens')}
    </Button>
  </div>

  <div className="mt-4 flex gap-4 text-sm">
    <div>
      <span className="text-muted-foreground">{t('tasks.consumed30Days')}: </span>
      <span className="font-medium">{consumed30Days} Tokens</span>
    </div>
    <div>
      <span className="text-muted-foreground">{t('tasks.pendingReservation')}: </span>
      <span className="font-medium">{pendingReservation} Tokens</span>
    </div>
  </div>
</TokenBalanceCard>
```

#### 2. 任务筛选（Task Filters）

**组件**: `<TasksFilters />`（增强）

**筛选维度**:
- **任务类型**: All / Evaluation / Link Rotation / Click Simulation / Batch Open
- **任务状态**: All / Pending / Running / Completed / Failed / Cancelled
- **时间范围**: Today / 7 Days / 30 Days / Custom
- **Offer筛选**: 按Offer名称搜索

```typescript
<TasksFilters
  type={selectedType}
  onTypeChange={setSelectedType}
  status={selectedStatus}
  onStatusChange={setSelectedStatus}
  dateRange={dateRange}
  onDateRangeChange={setDateRange}
  offerSearch={offerSearch}
  onOfferSearchChange={setOfferSearch}
  taskCount={filteredTasks.length}
/>
```

#### 3. 任务列表（Tasks Table）

**组件**: `<TasksTable />`（增强）

**列定义**:
| 列名 | 说明 | 示例 |
|------|------|------|
| 任务类型 | 图标 + 类型名称 | 🔍 Offer评估 |
| 关联Offer | Offer名称（可点击） | Nike.com |
| 任务状态 | Badge展示 | 🟢 Completed |
| Token消耗 | 已消耗/预留 | 3 / 0 |
| 创建时间 | 相对时间 | 2小时前 |
| 完成时间 | 相对时间或- | 5分钟前 |
| 结果 | 简要结果或错误信息 | AI Score: 85 |
| 操作 | 查看详情/重试/取消 | [详情] |

**任务类型图标**:
```typescript
const taskTypeIcons = {
  evaluation: <Search className="w-4 h-4" />,        // Offer评估
  link_rotation: <RefreshCw className="w-4 h-4" />,  // 换链接
  click_simulation: <MousePointer className="w-4 h-4" />, // 补点击
  batch_open: <Layers className="w-4 h-4" />,       // 批量打开
};
```

**数据查询（含用户隔离）**:
```sql
SELECT
  t.id,
  t.task_type,
  t.status,
  t.tokens_consumed,
  t.tokens_reserved,
  t.created_at,
  t.completed_at,
  t.result_summary,
  t.error_message,
  o.name as offer_name,
  o.url as offer_url
FROM tasks t
LEFT JOIN offers o ON t.offer_id = o.id
WHERE t.user_id = $user_id  -- 用户隔离
  AND ($type IS NULL OR t.task_type = $type)
  AND ($status IS NULL OR t.status = $status)
  AND t.created_at >= $start_date
  AND t.created_at <= $end_date
ORDER BY t.created_at DESC
LIMIT 50 OFFSET $offset;
```

#### 4. 任务详情抽屉（Task Detail Sheet）

**组件**: `<TaskDetailSheet />`（NEW）

**结构**:
```
┌────────────────────────────────────┐
│  Task #12345 - Offer评估           │
│  ───────────────────────────────   │
│                                    │
│  基本信息:                          │
│  - 任务类型: Offer评估              │
│  - 关联Offer: Nike.com [查看]       │
│  - 创建时间: 2025-10-15 14:30      │
│  - 完成时间: 2025-10-15 14:35      │
│  - 状态: ✅ Completed              │
│                                    │
│  Token消耗:                         │
│  - 预留: 3 Tokens                  │
│  - 确认: 3 Tokens                  │
│  - 退还: 0 Tokens                  │
│                                    │
│  评估结果:                          │
│  - 域名: nike.com                  │
│  - 品牌: Nike                      │
│  - 全球排名: 125                   │
│  - AI推荐指数: 85/100              │
│  - 推荐理由:                        │
│    1. 高流量品牌，月访问量1.2亿      │
│    2. 转化率高，用户粘性强           │
│    3. 品牌知名度高，信任度好         │
│                                    │
│  详细日志:                          │
│  14:30:12 - 任务创建                │
│  14:30:15 - 预扣3 Tokens           │
│  14:30:16 - 开始评估                │
│  14:31:23 - 获取域名: nike.com     │
│  14:32:45 - SimilarWeb数据获取成功  │
│  14:33:50 - AI评估完成              │
│  14:35:02 - 确认Token消耗           │
│  14:35:03 - 任务完成                │
│                                    │
│  [关闭] [查看Offer] [重新评估]      │
└────────────────────────────────────┘
```

#### 5. 任务时间线（Task Timeline）

**组件**: `<TaskTimeline />`（现有，增强）

**展示**: 按时间轴展示任务执行历史

```
今天 (5个任务)
├─ 14:35  ✅ Nike.com 评估完成 (3 tokens)
├─ 12:20  ✅ Adidas.com 评估完成 (3 tokens)
├─ 10:15  ❌ Test.com 评估失败 (0 tokens)
├─ 09:30  ✅ Puma.com 换链接完成 (5 tokens)
└─ 08:00  ✅ Reebok.com 补点击完成 (10 tokens)

昨天 (8个任务)
├─ ...
```

#### 6. Offer-Ads关联洞察（Task Insights）

**组件**: `<TaskOfferAdsInsights />`（现有）

保持现有实现，展示任务与Offer、Ads的关联分析。

---

## 数据模型与API

### 数据模型

#### 1. Tasks表

```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,  -- 用户隔离

    -- 任务信息
    task_type VARCHAR(50) NOT NULL,  -- evaluation, link_rotation, click_simulation, batch_open
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, cancelled

    -- 关联
    offer_id UUID REFERENCES offers(id),
    ads_account_id UUID REFERENCES user_ads_connections(id),

    -- Token
    tokens_reserved INTEGER DEFAULT 0,
    tokens_consumed INTEGER DEFAULT 0,
    tokens_refunded INTEGER DEFAULT 0,

    -- 结果
    result_summary JSONB,  -- 简要结果
    result_details JSONB,  -- 详细结果
    error_message TEXT,

    -- 时间
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- 索引
    INDEX idx_tasks_user_id (user_id),
    INDEX idx_tasks_status (status),
    INDEX idx_tasks_type (task_type),
    INDEX idx_tasks_created_at (created_at DESC)
);

-- RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_own_tasks ON tasks
    FOR ALL USING (user_id = current_setting('app.user_id')::uuid);
```

#### 2. Offers表（增强）

```sql
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ads_account_id UUID REFERENCES user_ads_connections(id);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS campaign_id VARCHAR(255);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ad_group_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_offers_ads_account ON offers(ads_account_id);
```

### API端点

#### Ads Center API

```typescript
// 1. 获取账号列表（含统计）
GET /api/v1/adscenter/accounts?include_stats=true
Response: {
  accounts: AdsAccount[],
  stats: AdsSummaryStats
}

// 2. 获取账号详情（含关联Offer）
GET /api/v1/adscenter/accounts/:id?include_offers=true
Response: {
  account: AdsAccount,
  offers: OfferWithAdsData[],
  campaigns: Campaign[],
  metrics: PerformanceMetrics
}

// 3. 同步账号
POST /api/v1/adscenter/accounts/:id/sync
Response: {
  status: 'syncing',
  job_id: string
}
```

#### Tasks API

```typescript
// 1. 获取任务列表（含筛选）
GET /api/v1/tasks?type=evaluation&status=completed&start_date=2025-10-01&limit=50
Response: {
  tasks: Task[],
  total: number,
  pagination: {
    page: number,
    page_size: number,
    total_pages: number
  }
}

// 2. 获取任务详情
GET /api/v1/tasks/:id
Response: {
  task: Task,
  offer: Offer,
  logs: TaskLog[]
}

// 3. 重试任务
POST /api/v1/tasks/:id/retry
Response: {
  new_task_id: string,
  status: 'pending'
}

// 4. 取消任务
POST /api/v1/tasks/:id/cancel
Response: {
  status: 'cancelled',
  tokens_refunded: number
}

// 5. 获取Token统计
GET /api/v1/billing/tokens/stats?days=30
Response: {
  balance: number,
  consumed_30_days: number,
  pending_reservation: number,
  daily_breakdown: { date: string, consumed: number }[]
}
```

---

## 实施计划

### Phase 1: 路由迁移（1天）

**任务**:
1. 创建`/ads-center/page.tsx`，复制现有实现
2. 创建`/tasks/page.tsx`，复制现有实现
3. 更新所有内部链接（从`/dashboard/`改为`/`）
4. 测试路由访问

**验收**:
- ✅ `/ads-center`可访问，功能正常
- ✅ `/tasks`可访问，功能正常
- ✅ 所有链接正确跳转

### Phase 2: Ads Center增强（2天）

**任务**:
1. 实现`<OfferAssociationPanel />`组件
2. 在账号详情对话框添加"关联Offer" Tab
3. 增强数据查询（JOIN offers表）
4. 添加Offer-Ads关联/解除功能

**验收**:
- ✅ 可查看账号下所有关联Offer
- ✅ 可从详情页跳转到Offer页
- ✅ 数据正确展示

### Phase 3: Tasks增强（2天）

**任务**:
1. 实现`<TaskDetailSheet />`组件
2. 增强`<TasksFilters />`（添加任务类型筛选）
3. 实现Token统计API
4. 添加任务详情日志展示

**验收**:
- ✅ 可查看任务完整详情
- ✅ 任务类型筛选正常
- ✅ Token统计准确
- ✅ 日志展示完整

### Phase 4: 数据隔离验证（1天）

**任务**:
1. 审查所有SQL查询，确保有`user_id`过滤
2. 测试RLS策略生效
3. 测试多用户数据隔离

**验收**:
- ✅ 所有查询有用户隔离
- ✅ RLS策略生效
- ✅ 多用户测试通过

### Phase 5: 删除旧路由（0.5天）

**任务**:
1. 删除`/dashboard/ads-center`目录
2. 删除`/dashboard/tasks`目录
3. 清理相关引用

**验收**:
- ✅ 旧路由不可访问
- ✅ 无死链

---

## 总结

本设计方案在现有实现基础上：
1. ✅ 完成路由迁移到顶层
2. ✅ 增强Ads Center功能（Offer关联）
3. ✅ 增强Tasks功能（任务详情、筛选）
4. ✅ 确保数据用户级隔离
5. ✅ 保持UI一致性和良好用户体验

总工期：6.5天

**依赖**:
- 前置：M1基础设施完成（✅已完成）
- 后续：M3路由重组、M4前端核心功能
