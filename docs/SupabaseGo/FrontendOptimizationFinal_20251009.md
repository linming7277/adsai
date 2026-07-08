# AutoAds 前端页面设计完整优化方案（最终版）

**文档版本:** 2.0 Final
**创建时间:** 2025-10-09
**更新内容:** 整合当前实现分析、行业最佳实践、详细设计方案

---

## 📋 文档索引

本文档整合了以下四份设计文档的核心内容：

1. **FrontendDesignDetailedPlan_20251009.md** - 详细设计方案（3,385 行）
2. **FrontendDesignSupplement_20251009.md** - 补充设计（Footer、首页、个人中心、数据隔离）
3. **FrontendBestPractices_20251009.md** - 行业最佳实践分析
4. **CurrentImplementationAnalysis_20251009.md** - 当前实现分析与对比

---

## 🎯 核心目标

1. **提升用户体验** - 借鉴 Stripe、Linear、Vercel、Notion 的设计理念
2. **优化操作效率** - 实时刷新、搜索筛选、批量操作、快捷入口
3. **增强易用性** - 命令面板、骨架屏、空状态插图、交互反馈
4. **提高转化率** - 首页营销优化、新手引导、Aha Moment 设计
5. **确保可扩展性** - 组件化设计、状态管理、性能优化

---

## 目录

1. [执行摘要](#一执行摘要)
2. [当前实现评估](#二当前实现评估)
3. [核心页面优化方案](#三核心页面优化方案)
4. [行业最佳实践应用](#四行业最佳实践应用)
5. [路由架构与数据隔离](#五路由架构与数据隔离)
6. [组件库与设计系统](#六组件库与设计系统)
7. [性能优化策略](#七性能优化策略)
8. [实施路线图](#八实施路线图)
9. [成功指标](#九成功指标)

---

## 一、执行摘要

### 1.1 项目背景

AutoAds 是一个面向跨境电商的 AI 广告自动化平台，当前前端已实现基础功能：
- ✅ Dashboard 关键指标、风险提醒、Top Offers、趋势图表
- ✅ Offers 表格展示、批量选择、状态管理
- ✅ 错误处理、加载状态、空状态提示
- ✅ 响应式设计、TypeScript 类型安全

### 1.2 核心问题

通过对比 Stripe、Linear、Vercel 等行业标杆产品，发现以下不足：

| 问题分类 | 具体问题 | 影响 | 优先级 |
|---------|---------|------|--------|
| **实时性** | 需手动点击刷新才能获取最新数据 | 用户无法及时发现异常 | P0 |
| **效率** | 缺少搜索和筛选功能 | Offer 数量增多时难以定位 | P0 |
| **交互** | 缺少快捷操作入口 | 操作路径冗长（3+ 步） | P0 |
| **感知性能** | 加载时显示空白页面 | 等待焦虑感强 | P0 |
| **易用性** | 批量选择后无操作按钮 | 批量操作效率低 | P1 |
| **高级功能** | 趋势图仅支持查看，无交互 | 无法深入分析数据 | P1 |
| **个性化** | Dashboard 指标固定，无法自定义 | 不同用户需求差异大 | P2 |

### 1.3 优化目标

**量化目标（6 个月内）:**
- 用户满意度 +30%（NPS 从 40 提升到 52）
- 操作效率 +50%（平均任务完成时间从 120s 降至 80s）
- 首屏加载时间 -40%（从 2.5s 降至 1.5s）
- 批量操作使用率 +80%（从 15% 提升到 27%）
- 新用户激活率 +25%（首日完成评估的用户占比）

---

## 二、当前实现评估

### 2.1 Dashboard 现状分析

#### 已实现功能 ✅

**文件位置:** `apps/frontend/src/app/dashboard/[organization]/components/DashboardDemo.tsx`

1. **关键指标概览 (MetricsSection)**
   ```tsx
   // 6 个核心 KPI 卡片
   - 整体 ROAS（趋势 ↑↓）
   - 总收入（趋势 ↑↓）
   - 总花费（趋势 ↑↓）
   - Token 余额（今日消耗）
   - 活跃 Offer（待评估数量）
   - 任务进度（运行中/待处理）
   ```

2. **风险提醒区域 (RiskAlertsSection)**
   - 三级风险等级（高/中/低）with Badge 颜色区分
   - 显示关联 Offer/广告账号
   - 标记已读功能
   - 空状态："一切正常"

3. **Top Offers 区域 (TopOffersSection)**
   - 表格展示 Top 5 Offers
   - 包含：品牌名、URL、国家、ROAS、收入、花费、转化
   - 链接可点击

4. **趋势分析图表 (TrendSection)**
   - Recharts LineChart 三线图（收入、花费、ROAS）
   - 时间段切换（7d/30d/90d）
   - 双 Y 轴（左侧货币，右侧 ROAS）

#### 不足与改进建议 ⚠️

**对比 Stripe Dashboard 最佳实践：**

| 功能 | 当前实现 | Stripe 标杆 | 改进方案 |
|-----|---------|------------|---------|
| 数据更新 | 手动刷新按钮 | 自动 30s 轮询 + "Last updated 2min ago" | 实现 SWR refreshInterval |
| 数据对比 | 仅显示变化百分比 | "与上周对比" "与去年同期对比" | 添加对比模式切换器 |
| 图表交互 | 静态折线图 | 可点击跳转到详细列表 | 添加 onClick 事件处理 |
| 快捷操作 | 无 | 顶部固定 "Create payment" 按钮 | 添加快捷操作卡片区域 |
| 个性化 | 固定 6 个指标 | 用户可自定义显示指标 | 实现拖拽排序（@dnd-kit/core） |
| 帮助提示 | 无 | 关键指标旁显示 "?" Tooltip | 添加 HelpTooltip 组件 |

---

### 2.2 Offers 现状分析

#### 已实现功能 ✅

**文件位置:** `apps/frontend/src/app/dashboard/[organization]/offers/components/OffersTable.tsx`

1. **表格展示**
   - 全选/单选 Checkbox
   - 7 列：选择、Offer 名称、状态、主要市场、健康评分、创建时间、操作
   - 响应式隐藏（lg/xl 断点）
   - 状态徽章（OfferStatusBadge）

2. **操作按钮**
   - "评估"按钮（带 pending 状态）
   - "删除"按钮
   - 点击品牌名查看详情（onView 回调）

#### 不足与改进建议 ⚠️

**对比 Airtable/Notion Database 最佳实践：**

| 功能 | 当前实现 | Airtable 标杆 | 改进方案 |
|-----|---------|--------------|---------|
| 搜索 | ❌ 无 | 实时搜索（品牌名/URL/国家） | 添加 SearchInput 组件 |
| 筛选 | ❌ 无 | 多条件筛选器（状态/国家/评分） | 添加 FilterDropdown 组件 |
| 排序 | ❌ 无 | 点击列标题排序 | 添加可排序 TableHead |
| 批量操作 | ⚠️ 仅选择逻辑 | 选中后显示浮动工具栏 | 添加 BatchActionBar 组件 |
| 视图切换 | ❌ 仅表格 | 表格/卡片/看板视图 | 添加 ViewSwitcher 组件 |
| 列自定义 | ❌ 固定 7 列 | "Customize columns" 对话框 | 添加 ColumnCustomizer |
| 详情抽屉 | ❌ 未实现 | 右侧滑出 Drawer | 添加 OfferDetailSheet |
| 内联编辑 | ❌ 无 | 双击单元格编辑 | 添加可编辑 TableCell |

---

### 2.3 路由架构现状

**当前问题:**
```
❌ /dashboard/[organization]/
❌ /dashboard/[organization]/offers
❌ /dashboard/[organization]/ads-center
❌ /dashboard/[organization]/tasks
```
- URL 暴露 organization 概念（用户不理解）
- 多余的层级影响 SEO
- 与用户心理模型不符

**优化方案:**
```
✅ /dashboard
✅ /offers
✅ /adscenter
✅ /tasks
✅ /userinfo
```

**实现机制（已规划）:**
```typescript
// middleware.ts - 自动注入组织上下文
export async function middleware(request: NextRequest) {
  const session = await getSession(request);
  const organizationId = await getUserDefaultOrganization(session.user.id);

  // 注入到 Header，而非 URL
  request.headers.set('X-Organization-Id', organizationId);

  // Cookie 存储（前端可读）
  response.cookies.set('organization_id', organizationId);
}

// hooks/use-current-organization.ts
export function useCurrentOrganization() {
  const orgId = cookies().get('organization_id');
  return useSWR(`/api/organizations/${orgId}`);
}
```

---

## 三、核心页面优化方案

### 3.1 Dashboard 页面 - 完整优化方案

#### 3.1.1 P0 优化：自动刷新机制

**问题:** 用户需手动点击刷新，无法实时发现异常

**解决方案:**

```typescript
// lib/dashboard/hooks.ts
import useSWR from 'swr';

export function useDashboardOverview(organizationUid?: string) {
  return useSWR(
    organizationUid ? `/api/dashboard/overview?org=${organizationUid}` : null,
    fetcher,
    {
      refreshInterval: 30000,        // 30 秒自动刷新
      dedupingInterval: 10000,       // 10 秒内不重复请求
      revalidateOnFocus: true,       // 标签页切换时刷新
      revalidateOnReconnect: true,   // 网络重连时刷新
    }
  );
}
```

**UI 显示:**
```tsx
// DashboardDemo.tsx 右上角添加
<div className="flex items-center gap-2 text-sm text-muted-foreground">
  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
  <span>最后更新于 {formatRelativeTime(lastUpdated)}</span>
</div>
```

**预期效果:**
- 用户无需手动操作，实时获取最新数据
- 降低异常发现延迟从 5 分钟+ 到 30 秒内

---

#### 3.1.2 P0 优化：快捷操作入口

**问题:** Dashboard 只展示数据，无法快速执行高频操作

**解决方案:**

```tsx
// DashboardDemo.tsx 顶部添加快捷操作区域
function QuickActionsSection() {
  const router = useRouter();
  const [createOfferOpen, setCreateOfferOpen] = useState(false);
  const [batchEvaluateOpen, setBatchEvaluateOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {/* 创建 Offer */}
      <ActionCard
        icon={<PlusCircleIcon className="h-6 w-6" />}
        title="创建 Offer"
        description="添加新的落地页进行评估"
        onClick={() => setCreateOfferOpen(true)}
        className="hover:shadow-lg transition-shadow"
      />

      {/* 批量评估 */}
      <ActionCard
        icon={<PlayIcon className="h-6 w-6" />}
        title="批量评估"
        description="对选中的 Offers 启动评估"
        onClick={() => setBatchEvaluateOpen(true)}
        badge={pendingOffers > 0 ? `${pendingOffers} 待评估` : undefined}
      />

      {/* 连接广告账号 */}
      <ActionCard
        icon={<LinkIcon className="h-6 w-6" />}
        title="连接广告账号"
        description="授权 Facebook / Google Ads"
        onClick={() => router.push('/adscenter')}
        badge={connectedAccounts > 0 ? `${connectedAccounts} 已连接` : undefined}
      />
    </div>
  );
}

// ActionCard 组件
function ActionCard({ icon, title, description, badge, onClick, className }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-start gap-4 rounded-lg border border-border",
        "bg-card p-6 text-left transition-all hover:bg-accent",
        "focus:outline-none focus:ring-2 focus:ring-primary",
        className
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          {badge && (
            <Badge variant="secondary" size="sm">
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
    </button>
  );
}
```

**预期效果:**
- 操作路径从 3 步减少到 1 步
- 高频操作完成时间减少 60%

---

#### 3.1.3 P0 优化：骨架屏加载状态

**问题:** 加载时显示空白页面或单一 Spinner，用户等待焦虑

**解决方案:**

```tsx
// components/dashboard/DashboardSkeleton.tsx
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col space-y-6 pb-36">
      {/* 快捷操作区域骨架 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>

      {/* 关键指标骨架 */}
      <div className="rounded-lg border border-border p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* 风险提醒和 Top Offers 骨架 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>

      {/* 趋势图表骨架 */}
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

// DashboardDemo.tsx 使用
export default function DashboardDemo() {
  const metricsQuery = useDashboardOverview(organizationUid);

  if (metricsQuery.isLoading && !metricsQuery.data) {
    return <DashboardSkeleton />;
  }

  return (
    // ... 正常内容
  );
}
```

**预期效果:**
- 感知加载时间减少 30%（虽然实际加载时间不变）
- 用户焦虑感降低

---

#### 3.1.4 P1 优化：趋势图交互增强

**问题:** 趋势图仅支持查看，无法深入分析

**解决方案:**

```tsx
// DashboardDemo.tsx - 趋势图增强
function TrendSection({ period, data, loading, error, onPeriodChange }) {
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [zoomRange, setZoomRange] = useState(null);

  // 点击数据点跳转到详情
  const handlePointClick = (point) => {
    setSelectedPoint(point);
    // 显示详情对话框
    router.push(`/offers?date=${point.date}`);
  };

  // 拖拽选择时间范围
  const handleMouseDown = (e) => {
    setZoomRange({ start: e.activeLabel });
  };

  const handleMouseMove = (e) => {
    if (zoomRange?.start) {
      setZoomRange({ ...zoomRange, end: e.activeLabel });
    }
  };

  const handleMouseUp = () => {
    if (zoomRange?.start && zoomRange?.end) {
      // 放大到选中范围
      onPeriodChange('custom', zoomRange);
    }
    setZoomRange(null);
  };

  return (
    <Tile>
      <Tile.Heading>趋势分析</Tile.Heading>

      <Tile.Body>
        {/* 时间段切换 + 对比模式 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PeriodSelector value={period} onChange={onPeriodChange} />
            <ComparisonModeSelector />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={addAnnotation}>
              <TagIcon className="mr-2 h-4 w-4" />
              添加标注
            </Button>
            <Button variant="ghost" size="sm" onClick={exportData}>
              <DownloadIcon className="mr-2 h-4 w-4" />
              导出
            </Button>
          </div>
        </div>

        <div className="h-80 pt-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {/* 拖拽选择区域 */}
              {zoomRange && (
                <ReferenceArea
                  x1={zoomRange.start}
                  x2={zoomRange.end}
                  strokeOpacity={0.3}
                  fill="#3b82f6"
                  fillOpacity={0.2}
                />
              )}

              {/* 事件标注 */}
              {annotations.map(annotation => (
                <ReferenceLine
                  key={annotation.id}
                  x={annotation.date}
                  stroke="#f97316"
                  label={annotation.label}
                />
              ))}

              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />

              <Tooltip content={<CustomTooltip />} />
              <Legend />

              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ cursor: 'pointer', onClick: handlePointClick }}
                activeDot={{ r: 8, onClick: handlePointClick }}
              />

              {/* ... 其他线 */}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 选中数据点的详情卡片 */}
        {selectedPoint && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>{selectedPoint.date} 详细数据</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <Stat label="收入" value={formatCurrency(selectedPoint.revenue)} />
                <Stat label="花费" value={formatCurrency(selectedPoint.cost)} />
                <Stat label="ROAS" value={selectedPoint.roas.toFixed(2)} />
              </div>
              <Button className="mt-4" onClick={() => router.push(`/offers?date=${selectedPoint.date}`)}>
                查看当日 Offers
              </Button>
            </CardContent>
          </Card>
        )}
      </Tile.Body>
    </Tile>
  );
}

// 对比模式选择器
function ComparisonModeSelector() {
  const [mode, setMode] = useState('none');

  return (
    <Select value={mode} onValueChange={setMode}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="对比模式" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">无对比</SelectItem>
        <SelectItem value="previous_period">与上周期</SelectItem>
        <SelectItem value="previous_year">与去年同期</SelectItem>
        <SelectItem value="custom">自定义对比</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

**预期效果:**
- 数据分析深度提升 3 倍
- 用户能快速定位异常时间点并查看详情

---

### 3.2 Offers 页面 - 完整优化方案

#### 3.2.1 P0 优化：搜索和筛选

**问题:** Offer 数量增多时无法快速定位

**解决方案:**

```tsx
// app/offers/page.tsx
"use client";

import { useState, useMemo } from 'react';
import { useDebounce } from '~/hooks/use-debounce';
import { useOffersFilter } from '~/stores/offers-filter';

export default function OffersPage() {
  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    countryFilter,
    setCountryFilter,
    scoreRange,
    setScoreRange,
  } = useOffersFilter();

  const offersQuery = useOffers();

  // 客户端筛选（如果数据量小）或服务端筛选（如果数据量大）
  const filteredOffers = useMemo(() => {
    let result = offersQuery.data ?? [];

    // 搜索
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(offer =>
        offer.brandName.toLowerCase().includes(query) ||
        offer.url.toLowerCase().includes(query)
      );
    }

    // 状态筛选
    if (statusFilter.length > 0) {
      result = result.filter(offer => statusFilter.includes(offer.status));
    }

    // 国家筛选
    if (countryFilter.length > 0) {
      result = result.filter(offer => countryFilter.includes(offer.country));
    }

    // 评分范围筛选
    if (scoreRange) {
      result = result.filter(offer =>
        offer.healthScore >= scoreRange[0] &&
        offer.healthScore <= scoreRange[1]
      );
    }

    return result;
  }, [offersQuery.data, searchQuery, statusFilter, countryFilter, scoreRange]);

  return (
    <div className="flex flex-col space-y-6">
      {/* 搜索和筛选栏 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* 搜索框 */}
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索品牌名或 URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
              onClick={() => setSearchQuery('')}
            >
              <XMarkIcon className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* 筛选器 */}
        <div className="flex items-center gap-2">
          <FilterDropdown
            label="状态"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'active', label: '运行中', color: 'green' },
              { value: 'paused', label: '已暂停', color: 'yellow' },
              { value: 'pending', label: '待评估', color: 'blue' },
              { value: 'failed', label: '失败', color: 'red' },
            ]}
          />

          <FilterDropdown
            label="国家"
            value={countryFilter}
            onChange={setCountryFilter}
            options={uniqueCountries.map(c => ({ value: c, label: c }))}
            searchable
          />

          <ScoreRangeFilter
            value={scoreRange}
            onChange={setScoreRange}
          />

          {/* 重置所有筛选 */}
          {(searchQuery || statusFilter.length || countryFilter.length || scoreRange) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter([]);
                setCountryFilter([]);
                setScoreRange(null);
              }}
            >
              重置筛选
            </Button>
          )}
        </div>

        {/* 视图切换和操作按钮 */}
        <div className="flex items-center gap-2">
          <ViewSwitcher value={view} onChange={setView} />
          <Button onClick={() => setCreateDialogOpen(true)}>
            <PlusIcon className="mr-2 h-4 w-4" />
            创建 Offer
          </Button>
        </div>
      </div>

      {/* 筛选结果提示 */}
      {filteredOffers.length !== offersQuery.data?.length && (
        <Alert>
          <FunnelIcon className="h-4 w-4" />
          <AlertDescription>
            找到 {filteredOffers.length} 个结果（共 {offersQuery.data?.length} 个）
          </AlertDescription>
        </Alert>
      )}

      {/* 表格或其他视图 */}
      {view === 'table' && (
        <OffersTable
          offers={filteredOffers}
          // ... 其他 props
        />
      )}
      {view === 'grid' && (
        <OffersGrid offers={filteredOffers} />
      )}
      {view === 'board' && (
        <OffersBoard offers={filteredOffers} />
      )}
    </div>
  );
}

// 筛选下拉组件
function FilterDropdown({ label, value, onChange, options, searchable }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = searchable
    ? options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <FunnelIcon className="mr-2 h-4 w-4" />
          {label}
          {value.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {value.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        {searchable && (
          <div className="border-b p-2">
            <Input
              placeholder={`搜索${label}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredOptions.map(option => (
            <div
              key={option.value}
              className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent cursor-pointer"
              onClick={() => {
                const newValue = value.includes(option.value)
                  ? value.filter(v => v !== option.value)
                  : [...value, option.value];
                onChange(newValue);
              }}
            >
              <Checkbox
                checked={value.includes(option.value)}
                onCheckedChange={() => {}}
              />
              {option.color && (
                <div className={`h-2 w-2 rounded-full bg-${option.color}-500`} />
              )}
              <span className="text-sm">{option.label}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// 评分范围筛选器
function ScoreRangeFilter({ value, onChange }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <ChartBarIcon className="mr-2 h-4 w-4" />
          评分
          {value && (
            <Badge variant="secondary" className="ml-2">
              {value[0]}-{value[1]}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div>
            <Label>健康评分范围</Label>
            <p className="text-xs text-muted-foreground">
              选择 {value?.[0] ?? 0} - {value?.[1] ?? 100}
            </p>
          </div>
          <DualRangeSlider
            min={0}
            max={100}
            step={5}
            value={value ?? [0, 100]}
            onValueChange={onChange}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// 视图切换器
function ViewSwitcher({ value, onChange }) {
  return (
    <ToggleGroup type="single" value={value} onValueChange={onChange}>
      <ToggleGroupItem value="table" aria-label="表格视图">
        <TableIcon className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="grid" aria-label="卡片视图">
        <GridIcon className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="board" aria-label="看板视图">
        <BoardIcon className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
```

**持久化筛选状态:**

```typescript
// stores/offers-filter.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useOffersFilter = create(
  persist(
    (set) => ({
      searchQuery: '',
      statusFilter: [],
      countryFilter: [],
      scoreRange: null,

      setSearchQuery: (q) => set({ searchQuery: q }),
      setStatusFilter: (s) => set({ statusFilter: s }),
      setCountryFilter: (c) => set({ countryFilter: c }),
      setScoreRange: (r) => set({ scoreRange: r }),

      reset: () => set({
        searchQuery: '',
        statusFilter: [],
        countryFilter: [],
        scoreRange: null,
      }),
    }),
    {
      name: 'offers-filter-storage',
      // 只持久化筛选条件，不持久化搜索查询（太频繁）
      partialize: (state) => ({
        statusFilter: state.statusFilter,
        countryFilter: state.countryFilter,
        scoreRange: state.scoreRange,
      }),
    }
  )
);
```

**预期效果:**
- 用户能在 3 秒内找到目标 Offer（当前需要 30+ 秒翻页查找）
- 搜索使用率 +80%

---

#### 3.2.2 P1 优化：批量操作工具栏

**问题:** 已有全选/单选逻辑，但无批量操作按钮

**解决方案:**

```tsx
// OffersTable.tsx 添加浮动工具栏
function OffersTable({ offers, selectedIds, onToggle, ... }) {
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  const handleBatchEvaluate = async () => {
    setBatchActionLoading(true);
    try {
      await batchEvaluateOffers(Array.from(selectedIds));
      toast.success(`已提交 ${selectedIds.size} 个 Offer 的评估任务`);
      onClearSelection();
    } catch (error) {
      toast.error('批量评估失败：' + error.message);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    const confirmed = await confirm({
      title: '确认删除',
      description: `确定要删除 ${selectedIds.size} 个 Offer 吗？此操作不可撤销。`,
    });

    if (!confirmed) return;

    setBatchActionLoading(true);
    try {
      await batchDeleteOffers(Array.from(selectedIds));
      toast.success(`已删除 ${selectedIds.size} 个 Offer`);
      onClearSelection();
    } catch (error) {
      toast.error('批量删除失败：' + error.message);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleBatchExport = () => {
    const selectedOffers = offers.filter(o => selectedIds.has(o.id));
    const csv = generateCSV(selectedOffers);
    downloadFile(csv, 'offers.csv');
    toast.success(`已导出 ${selectedIds.size} 个 Offer`);
  };

  return (
    <>
      <Table>
        {/* ... 表格内容 */}
      </Table>

      {/* 浮动批量操作工具栏 */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in slide-in-from-bottom-4">
          <Card className="shadow-2xl">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked
                  onCheckedChange={onClearSelection}
                />
                <span className="font-medium">
                  已选中 {selectedIds.size} 个 Offer
                </span>
              </div>

              <Separator orientation="vertical" className="h-8" />

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBatchEvaluate}
                  disabled={batchActionLoading}
                >
                  {batchActionLoading ? (
                    <Spinner className="mr-2 h-4 w-4" />
                  ) : (
                    <PlayIcon className="mr-2 h-4 w-4" />
                  )}
                  批量评估
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBatchExport}
                  disabled={batchActionLoading}
                >
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  导出
                </Button>

                <Separator orientation="vertical" className="h-8" />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBatchDelete}
                  disabled={batchActionLoading}
                  className="text-destructive hover:text-destructive"
                >
                  <TrashIcon className="mr-2 h-4 w-4" />
                  删除
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
              >
                <XMarkIcon className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

// 确认对话框 Hook
function useConfirm() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState({});
  const [resolvePromise, setResolvePromise] = useState(null);

  const confirm = ({ title, description }) => {
    setConfig({ title, description });
    setOpen(true);
    return new Promise((resolve) => {
      setResolvePromise(() => resolve);
    });
  };

  const handleConfirm = () => {
    resolvePromise?.(true);
    setOpen(false);
  };

  const handleCancel = () => {
    resolvePromise?.(false);
    setOpen(false);
  };

  const ConfirmDialog = () => (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config.title}</AlertDialogTitle>
          <AlertDialogDescription>{config.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>确认</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, ConfirmDialog };
}
```

**预期效果:**
- 批量操作效率提升 10 倍（从单个操作 30 秒 → 批量操作 3 秒）
- 批量操作使用率 +80%

---

#### 3.2.3 P1 优化：Offer 详情抽屉

**问题:** 点击 Offer 后无法快速查看详情，需要跳转页面

**解决方案:**

```tsx
// components/offers/OfferDetailSheet.tsx
export function OfferDetailSheet({ offer, open, onOpenChange }) {
  const [activeTab, setActiveTab] = useState('overview');

  const evaluationHistoryQuery = useOfferEvaluationHistory(offer?.id);
  const adsAccountsQuery = useOfferAdsAccounts(offer?.id);
  const trafficDataQuery = useOfferTrafficData(offer?.id);

  if (!offer) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>{offer.brandName}</span>
            <OfferStatusBadge status={offer.status} />
          </SheetTitle>
          <SheetDescription>
            <a
              href={offer.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              {offer.url}
            </a>
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="evaluation">评估历史</TabsTrigger>
            <TabsTrigger value="accounts">广告账号</TabsTrigger>
            <TabsTrigger value="traffic">流量数据</TabsTrigger>
          </TabsList>

          {/* 概览 Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow label="品牌名称" value={offer.brandName} />
                <InfoRow label="主要市场" value={offer.country} />
                <InfoRow label="健康评分" value={
                  <div className="flex items-center gap-2">
                    <HealthScoreCircle score={offer.healthScore} size="sm" />
                    <span className="font-semibold">{offer.healthScore}/100</span>
                  </div>
                } />
                <InfoRow label="创建时间" value={formatDateTime(offer.createdAt)} />
                <InfoRow label="最后更新" value={formatRelativeTime(offer.updatedAt)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>核心指标</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Stat label="ROAS" value={offer.roas?.toFixed(2) ?? '--'} />
                  <Stat label="转化率" value={formatPercent(offer.conversionRate)} />
                  <Stat label="总收入" value={formatCurrency(offer.totalRevenue)} />
                  <Stat label="总花费" value={formatCurrency(offer.totalCost)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>快捷操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <PlayIcon className="mr-2 h-4 w-4" />
                  启动评估
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <PencilIcon className="mr-2 h-4 w-4" />
                  编辑信息
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <LinkIcon className="mr-2 h-4 w-4" />
                  关联广告账号
                </Button>
                <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive">
                  <TrashIcon className="mr-2 h-4 w-4" />
                  删除 Offer
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 评估历史 Tab */}
          <TabsContent value="evaluation" className="space-y-4">
            {evaluationHistoryQuery.isLoading && <Spinner />}
            {evaluationHistoryQuery.data?.map(evaluation => (
              <Card key={evaluation.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      评估 #{evaluation.id}
                    </CardTitle>
                    <Badge variant={evaluation.status === 'completed' ? 'success' : 'secondary'}>
                      {evaluation.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {formatDateTime(evaluation.createdAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">综合评分</span>
                      <span className="font-semibold">{evaluation.score}/100</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">耗时</span>
                      <span>{evaluation.duration}s</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Token 消耗</span>
                      <span>{evaluation.tokenCost}</span>
                    </div>
                  </div>
                  {evaluation.report && (
                    <Button variant="link" className="mt-2 p-0">
                      查看完整报告 →
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* 广告账号 Tab */}
          <TabsContent value="accounts">
            {/* ... */}
          </TabsContent>

          {/* 流量数据 Tab */}
          <TabsContent value="traffic">
            {/* ... */}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// InfoRow 组件
function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

// 在 OffersTable 中使用
function OffersTable({ offers, ... }) {
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleViewOffer = (offer) => {
    setSelectedOffer(offer);
    setDetailOpen(true);
  };

  return (
    <>
      <Table>
        {/* ... */}
        <TableRow onClick={() => handleViewOffer(offer)}>
          {/* ... */}
        </TableRow>
      </Table>

      <OfferDetailSheet
        offer={selectedOffer}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}
```

**预期效果:**
- 查看 Offer 详情时间从 5 秒（页面跳转）减少到 0.5 秒（抽屉展开）
- 用户浏览多个 Offer 详情的流畅度提升 10 倍

---

### 3.3 命令面板 (Cmd+K) - 高级功能

**参考:** Linear Command Palette

**实现方案:**

```bash
npm install cmdk
```

```tsx
// components/CommandPalette.tsx
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // 监听 Cmd+K 快捷键
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleCreateOffer = () => {
    router.push('/offers?action=create');
    setOpen(false);
  };

  const handleBatchEvaluate = () => {
    router.push('/offers?action=batch-evaluate');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <Command className="rounded-lg border-none">
          <div className="flex items-center border-b px-3">
            <MagnifyingGlassIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="输入命令或搜索..."
              value={search}
              onValueChange={setSearch}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <CommandList className="max-h-96 overflow-y-auto p-2">
            <CommandEmpty>未找到结果</CommandEmpty>

            <CommandGroup heading="操作">
              <CommandItem onSelect={handleCreateOffer}>
                <PlusCircleIcon className="mr-2 h-4 w-4" />
                <span>创建 Offer</span>
                <CommandShortcut>⌘N</CommandShortcut>
              </CommandItem>

              <CommandItem onSelect={handleBatchEvaluate}>
                <PlayIcon className="mr-2 h-4 w-4" />
                <span>批量评估</span>
              </CommandItem>

              <CommandItem onSelect={() => router.push('/adscenter')}>
                <LinkIcon className="mr-2 h-4 w-4" />
                <span>连接广告账号</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="导航">
              <CommandItem onSelect={() => router.push('/dashboard')}>
                <HomeIcon className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
                <CommandShortcut>⌘D</CommandShortcut>
              </CommandItem>

              <CommandItem onSelect={() => router.push('/offers')}>
                <DocumentTextIcon className="mr-2 h-4 w-4" />
                <span>Offer 库</span>
                <CommandShortcut>⌘O</CommandShortcut>
              </CommandItem>

              <CommandItem onSelect={() => router.push('/adscenter')}>
                <MegaphoneIcon className="mr-2 h-4 w-4" />
                <span>Ads 中心</span>
                <CommandShortcut>⌘A</CommandShortcut>
              </CommandItem>

              <CommandItem onSelect={() => router.push('/tasks')}>
                <ClipboardDocumentCheckIcon className="mr-2 h-4 w-4" />
                <span>任务中心</span>
                <CommandShortcut>⌘T</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="主题">
              <CommandItem onSelect={() => setTheme('light')}>
                <SunIcon className="mr-2 h-4 w-4" />
                <span>浅色模式</span>
              </CommandItem>

              <CommandItem onSelect={() => setTheme('dark')}>
                <MoonIcon className="mr-2 h-4 w-4" />
                <span>深色模式</span>
              </CommandItem>

              <CommandItem onSelect={() => setTheme('system')}>
                <ComputerDesktopIcon className="mr-2 h-4 w-4" />
                <span>跟随系统</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

// CommandShortcut 组件
function CommandShortcut({ children }) {
  return (
    <span className="ml-auto text-xs tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}

// 在 RootLayout 中引入
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <CommandPalette />
      </body>
    </html>
  );
}
```

**额外快捷键支持:**

```tsx
// hooks/use-keyboard-shortcuts.ts
export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier) return;

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          router.push('/offers?action=create');
          break;
        case 'd':
          e.preventDefault();
          router.push('/dashboard');
          break;
        case 'o':
          e.preventDefault();
          router.push('/offers');
          break;
        case 'a':
          e.preventDefault();
          router.push('/adscenter');
          break;
        case 't':
          e.preventDefault();
          router.push('/tasks');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router]);
}
```

**预期效果:**
- 高级用户操作速度提升 3 倍
- 键盘导航使用率 +60%（从 5% 提升到 8%）

---

## 四、行业最佳实践应用

### 4.1 首页营销优化（参考 Stripe、Vercel）

#### 4.1.1 Hero Section 优化

**当前问题:** 价值主张不够明确，缺少社会证明

**优化方案:**

```tsx
// app/(site)/page.tsx - Hero Section
function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-24 pb-16 sm:pt-32 lg:pt-40">
      {/* 背景渐变 */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />

      <Container>
        <div className="max-w-4xl mx-auto text-center">
          {/* 社会证明标签 */}
          <Badge variant="outline" className="mb-6">
            <TrophyIcon className="mr-2 h-3 w-3" />
            已为 2,000+ 跨境电商节省 $50M+ 广告预算
          </Badge>

          {/* 主标题 */}
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            AI 驱动的广告自动化平台
            <br />
            <span className="text-primary">提升 ROAS 300%</span>
          </h1>

          {/* 副标题 */}
          <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
            智能评估落地页质量，自动优化广告投放策略，
            <br />
            为跨境电商省时间、降成本、提转化
          </p>

          {/* CTA 按钮 */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="text-lg px-8 py-6">
              免费开始
              <ArrowRightIcon className="ml-2 h-5 w-5" />
            </Button>

            <Button size="lg" variant="outline" className="text-lg px-8 py-6">
              <PlayCircleIcon className="mr-2 h-5 w-5" />
              观看演示
            </Button>
          </div>

          {/* 信任标识 */}
          <div className="mt-10 flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
              <span>无需信用卡</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1">
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
              <span>7 天免费试用</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1">
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
              <span>随时取消</span>
            </div>
          </div>
        </div>

        {/* 产品截图或演示视频 */}
        <div className="mt-16 relative">
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-transparent to-transparent h-32 bottom-0" />
          <Image
            src="/images/dashboard-preview.png"
            alt="AutoAds Dashboard"
            width={1920}
            height={1080}
            className="rounded-lg shadow-2xl border border-border"
          />
        </div>
      </Container>
    </section>
  );
}
```

---

#### 4.1.2 Trust Bar - 客户 Logo 墙

**参考:** Stripe 的客户 Logo 墙

```tsx
// app/(site)/page.tsx - Trust Bar Section
function TrustBarSection() {
  const customerLogos = [
    { name: 'Company A', logo: '/logos/company-a.svg' },
    { name: 'Company B', logo: '/logos/company-b.svg' },
    // ... 更多
  ];

  return (
    <section className="py-12 bg-muted/30">
      <Container>
        <div className="text-center mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            被全球领先品牌信赖
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-6 opacity-70 grayscale hover:grayscale-0 transition-all">
          {customerLogos.map((customer) => (
            <div key={customer.name} className="flex items-center justify-center">
              <Image
                src={customer.logo}
                alt={customer.name}
                width={120}
                height={40}
                className="h-10 w-auto"
              />
            </div>
          ))}
        </div>

        {/* 实时统计数字 */}
        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3 text-center">
          <div>
            <div className="text-4xl font-bold text-primary">
              <AnimatedNumber value={2000} />+
            </div>
            <div className="mt-2 text-sm text-muted-foreground">活跃用户</div>
          </div>

          <div>
            <div className="text-4xl font-bold text-primary">
              <AnimatedNumber value={500000} />+
            </div>
            <div className="mt-2 text-sm text-muted-foreground">Offers 已评估</div>
          </div>

          <div>
            <div className="text-4xl font-bold text-primary">
              $<AnimatedNumber value={50} />M+
            </div>
            <div className="mt-2 text-sm text-muted-foreground">广告预算节省</div>
          </div>
        </div>
      </Container>
    </section>
  );
}

// 数字动画组件
function AnimatedNumber({ value }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    const duration = 2000;
    const steps = 60;
    const stepValue = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += stepValue;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isInView, value]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}
```

---

#### 4.1.3 Interactive Demo Widget

**参考:** Vercel 的交互式演示

```tsx
// app/(site)/page.tsx - Interactive Demo Section
function InteractiveDemoSection() {
  const [demoUrl, setDemoUrl] = useState('');
  const [demoResult, setDemoResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleDemoEvaluate = async () => {
    if (!demoUrl) return;

    setLoading(true);
    try {
      const result = await fetch('/api/public/demo-evaluate', {
        method: 'POST',
        body: JSON.stringify({ url: demoUrl }),
      }).then(r => r.json());

      setDemoResult(result);
    } catch (error) {
      toast.error('演示评估失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-24 bg-gradient-to-br from-primary/5 to-purple-500/5">
      <Container>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold sm:text-4xl">
              免费试用 AI 评估
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              无需注册，立即体验落地页智能评估
            </p>
          </div>

          <Card className="border-2 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Input
                  placeholder="输入落地页 URL，例如：https://example.com"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleDemoEvaluate()}
                  disabled={loading}
                  className="text-lg"
                />
                <Button
                  size="lg"
                  onClick={handleDemoEvaluate}
                  disabled={loading || !demoUrl}
                >
                  {loading ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      评估中...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="mr-2 h-5 w-5" />
                      免费评估
                    </>
                  )}
                </Button>
              </div>

              {demoResult && (
                <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold">评估结果</h3>
                    <Badge variant="success">
                      <CheckCircleIcon className="mr-1 h-3 w-3" />
                      评估完成
                    </Badge>
                  </div>

                  {/* 评分圆环 */}
                  <div className="flex items-center justify-center mb-6">
                    <ScoreCircle score={demoResult.score} size="lg" />
                  </div>

                  {/* 关键指标 */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {demoResult.loadTime}s
                      </div>
                      <div className="text-sm text-muted-foreground">加载速度</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {demoResult.seoScore}/100
                      </div>
                      <div className="text-sm text-muted-foreground">SEO 评分</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {demoResult.conversionScore}/100
                      </div>
                      <div className="text-sm text-muted-foreground">转化潜力</div>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="text-center">
                    <p className="mb-4 text-sm text-muted-foreground">
                      想查看完整报告和优化建议？
                    </p>
                    <Button size="lg" asChild>
                      <Link href="/auth/sign-up">
                        免费注册查看完整报告
                        <ArrowRightIcon className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            已有账号？
            <Link href="/auth/sign-in" className="text-primary hover:underline ml-1">
              立即登录
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}
```

**预期效果:**
- 新用户注册转化率 +40%（从 2% 提升到 2.8%）
- Demo 使用率 60%+

---

### 4.2 空状态设计优化（参考 Linear）

**当前问题:** 空状态仅显示简单文本，缺少视觉吸引力和引导

**优化方案:**

```tsx
// components/EmptyState.tsx
export function EmptyState({
  icon,
  illustration,
  title,
  description,
  primaryAction,
  secondaryAction,
  variant = 'default',
}) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center py-12 px-6",
      variant === 'bordered' && "rounded-lg border-2 border-dashed border-border"
    )}>
      {/* 插图或图标 */}
      {illustration ? (
        <Image
          src={illustration}
          alt={title}
          width={240}
          height={180}
          className="mb-6 opacity-80"
        />
      ) : icon ? (
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>
      ) : null}

      {/* 标题 */}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>

      {/* 描述 */}
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          {description}
        </p>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-3">
        {primaryAction && (
          <Button
            onClick={primaryAction.onClick}
            size={primaryAction.size ?? 'default'}
          >
            {primaryAction.icon && (
              <span className="mr-2">{primaryAction.icon}</span>
            )}
            {primaryAction.label}
          </Button>
        )}

        {secondaryAction && (
          <Button
            variant="outline"
            onClick={secondaryAction.onClick}
            size={secondaryAction.size ?? 'default'}
          >
            {secondaryAction.icon && (
              <span className="mr-2">{secondaryAction.icon}</span>
            )}
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}

// 使用示例 - OffersTable.tsx
if (!hasOffers && !isLoading) {
  return (
    <EmptyState
      illustration="/illustrations/empty-offers.svg"
      title="还没有 Offers"
      description="创建您的第一个 Offer 开始自动化广告投放，或从 CSV 文件批量导入历史数据。"
      variant="bordered"
      primaryAction={{
        label: '创建 Offer',
        icon: <PlusIcon className="h-4 w-4" />,
        onClick: openCreateDialog,
      }}
      secondaryAction={{
        label: '批量导入',
        icon: <ArrowUpTrayIcon className="h-4 w-4" />,
        onClick: openImportDialog,
      }}
    />
  );
}

// Dashboard - 风险提醒空状态
if (!loading && !alerts.length) {
  return (
    <EmptyState
      icon={<CheckCircleIcon className="h-8 w-8 text-green-500" />}
      title="一切正常"
      description="暂无风险提醒，您的广告投放运行平稳。"
    />
  );
}
```

**插图资源:**
- [unDraw](https://undraw.co/) - 免费 SVG 插图
- [Storyset](https://storyset.com/) - 动画插图
- [Illustrations](https://illlustrations.co/) - 精美插图包

**预期效果:**
- 空状态转化率 +50%（用户更容易理解下一步操作）
- 视觉吸引力提升，降低跳出率

---

## 五、路由架构与数据隔离

### 5.1 URL 路由重构

**当前问题:**
```
❌ /dashboard/[organization]/offers
❌ /dashboard/[organization]/ads-center
```

**优化后:**
```
✅ /dashboard
✅ /offers
✅ /adscenter
✅ /tasks
✅ /userinfo (单页面 Tab 模式)
```

### 5.2 Middleware 实现

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 未登录用户重定向到登录页
  if (!session && isProtectedRoute(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url));
  }

  if (session) {
    const userId = session.user.id;

    // 获取用户默认组织
    const organizationId = await getUserDefaultOrganization(supabase, userId);

    if (!organizationId) {
      // 用户没有组织，重定向到设置页面
      return NextResponse.redirect(new URL('/setup-error', request.url));
    }

    // 将组织 ID 注入到请求 Header（服务端可读）
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('X-Organization-Id', organizationId);
    requestHeaders.set('X-User-Id', userId);

    // 将组织 ID 存储到 Cookie（客户端可读）
    res.cookies.set('organization_id', organizationId, {
      httpOnly: false, // 允许客户端读取
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 天
    });

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return res;
}

function isProtectedRoute(pathname: string) {
  const protectedPrefixes = ['/dashboard', '/offers', '/adscenter', '/tasks', '/userinfo'];
  return protectedPrefixes.some(prefix => pathname.startsWith(prefix));
}

async function getUserDefaultOrganization(supabase, userId: string) {
  // 从数据库查询用户默认组织
  const { data, error } = await supabase
    .from('organizations_members')
    .select('organization_id')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.organization_id;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
```

### 5.3 数据隔离 - Supabase RLS 策略

```sql
-- 为所有表启用 RLS
ALTER TABLE "Offer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdsAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RiskAlert" ENABLE ROW LEVEL SECURITY;

-- Offer 表策略
CREATE POLICY "Users can only access their own offers"
  ON "Offer"
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    organization_id IN (
      SELECT organization_id FROM organizations_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own offers"
  ON "Offer"
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own offers"
  ON "Offer"
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own offers"
  ON "Offer"
  FOR DELETE
  USING (user_id = auth.uid());

-- AdsAccount 表策略（类似）
CREATE POLICY "Users can only access their own ads accounts"
  ON "AdsAccount"
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organizations_members
      WHERE user_id = auth.uid()
    )
  );

-- Task 表策略
CREATE POLICY "Users can only access their own tasks"
  ON "Task"
  FOR SELECT
  USING (user_id = auth.uid());

-- RiskAlert 表策略
CREATE POLICY "Users can only access their own alerts"
  ON "RiskAlert"
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organizations_members
      WHERE user_id = auth.uid()
    )
  );

-- 性能优化：为 user_id 和 organization_id 创建索引
CREATE INDEX idx_offer_user_id ON "Offer"(user_id);
CREATE INDEX idx_offer_organization_id ON "Offer"(organization_id);
CREATE INDEX idx_ads_account_organization_id ON "AdsAccount"(organization_id);
CREATE INDEX idx_task_user_id ON "Task"(user_id);
CREATE INDEX idx_risk_alert_organization_id ON "RiskAlert"(organization_id);

-- 复合索引（常见查询模式）
CREATE INDEX idx_offer_user_status ON "Offer"(user_id, status);
CREATE INDEX idx_offer_org_country ON "Offer"(organization_id, country);
```

### 5.4 客户端数据获取

```typescript
// hooks/use-current-organization.ts
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';

export function useCurrentOrganization() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    const orgId = Cookies.get('organization_id');
    setOrganizationId(orgId ?? null);
  }, []);

  return organizationId;
}

// lib/offers/hooks.ts
import useSWR from 'swr';
import { useCurrentOrganization } from '~/hooks/use-current-organization';

export function useOffers() {
  const organizationId = useCurrentOrganization();

  return useSWR(
    organizationId ? `/api/offers?org=${organizationId}` : null,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    }
  );
}

// API Route: app/api/offers/route.ts
export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  // 验证用户身份
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 从 Header 读取组织 ID（由 Middleware 注入）
  const organizationId = request.headers.get('X-Organization-Id');

  if (!organizationId) {
    return new Response('Organization not found', { status: 404 });
  }

  // 查询 Offers（RLS 自动过滤）
  const { data, error } = await supabase
    .from('Offer')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ data });
}
```

**预期效果:**
- URL 简洁，符合用户心理模型
- 数据隔离安全，防止跨用户数据泄露
- 支持未来扩展到多组织场景

---

## 六、组件库与设计系统

### 6.1 核心组件库

AutoAds 基于 Makerkit（Shadcn UI），已有以下组件可复用：

**Layout 组件:**
- Container, PageHeader, PageBody
- Sidebar, TopNavigation

**Form 组件:**
- Input, Select, Checkbox, Radio, Switch
- Textarea, DatePicker, FileUpload

**Feedback 组件:**
- Alert, Toast, Dialog, Sheet, Popover
- Spinner, Skeleton, Progress

**Data Display:**
- Table, Card, Badge, Avatar
- Tile (用于 Dashboard 卡片)

### 6.2 新增自定义组件

基于当前需求，需要新增以下组件：

#### 6.2.1 ScoreCircle - 评分圆环

```tsx
// components/ScoreCircle.tsx
import { cn } from '~/lib/utils';

type ScoreCircleProps = {
  score: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
};

export function ScoreCircle({
  score,
  size = 'md',
  showLabel = true,
  className,
}: ScoreCircleProps) {
  const radius = size === 'sm' ? 30 : size === 'md' ? 50 : 70;
  const strokeWidth = size === 'sm' ? 4 : size === 'md' ? 6 : 8;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const color =
    score >= 80
      ? 'text-green-500'
      : score >= 60
      ? 'text-yellow-500'
      : score >= 40
      ? 'text-orange-500'
      : 'text-red-500';

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        height={radius * 2}
        width={radius * 2}
        className="-rotate-90"
      >
        {/* 背景圆环 */}
        <circle
          stroke="currentColor"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="text-muted opacity-20"
        />

        {/* 进度圆环 */}
        <circle
          stroke="currentColor"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className={cn(color, 'transition-all duration-500')}
        />
      </svg>

      {/* 分数文本 */}
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'font-bold',
              size === 'sm' ? 'text-lg' : size === 'md' ? 'text-2xl' : 'text-4xl',
              color
            )}
          >
            {score}
          </span>
          {size !== 'sm' && (
            <span className="text-xs text-muted-foreground">/ 100</span>
          )}
        </div>
      )}
    </div>
  );
}
```

#### 6.2.2 ActionCard - 快捷操作卡片

（已在 Dashboard 优化方案中展示）

#### 6.2.3 FilterDropdown - 筛选下拉组件

（已在 Offers 优化方案中展示）

#### 6.2.4 BatchActionBar - 批量操作工具栏

（已在 Offers 优化方案中展示）

### 6.3 设计 Token

```typescript
// lib/design-tokens.ts
export const designTokens = {
  colors: {
    primary: {
      50: 'hsl(221, 83%, 97%)',
      100: 'hsl(221, 83%, 93%)',
      // ... 其他色阶
      500: 'hsl(221, 83%, 53%)', // 主色
      // ...
    },
    success: {
      500: 'hsl(142, 71%, 45%)',
    },
    warning: {
      500: 'hsl(38, 92%, 50%)',
    },
    error: {
      500: 'hsl(0, 84%, 60%)',
    },
  },
  spacing: {
    xs: '0.25rem', // 4px
    sm: '0.5rem',  // 8px
    md: '1rem',    // 16px
    lg: '1.5rem',  // 24px
    xl: '2rem',    // 32px
    '2xl': '3rem', // 48px
  },
  typography: {
    fontSize: {
      xs: '0.75rem',   // 12px
      sm: '0.875rem',  // 14px
      base: '1rem',    // 16px
      lg: '1.125rem',  // 18px
      xl: '1.25rem',   // 20px
      '2xl': '1.5rem', // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem',  // 36px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  borderRadius: {
    sm: '0.25rem',  // 4px
    md: '0.375rem', // 6px
    lg: '0.5rem',   // 8px
    xl: '0.75rem',  // 12px
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
};
```

---

## 七、性能优化策略

### 7.1 API 请求优化

#### 7.1.1 合并 Dashboard 请求

**当前问题:** 4 个独立请求，增加网络往返

```typescript
// ❌ 当前实现
const metricsQuery = useDashboardMetrics(organizationUid);
const riskAlertsQuery = useRiskAlerts(organizationUid);
const topOffersQuery = useTopOffers(5, organizationUid);
const trendsQuery = useDashboardTrends(period, organizationUid);
```

**优化方案:** 合并为单个请求

```typescript
// ✅ 优化后
// lib/dashboard/hooks.ts
export function useDashboardOverview(organizationUid?: string, period: TrendPeriod = '7d') {
  return useSWR(
    organizationUid ? `/api/dashboard/overview?org=${organizationUid}&period=${period}` : null,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    }
  );
}

// app/api/dashboard/overview/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationUid = searchParams.get('org');
  const period = searchParams.get('period') ?? '7d';

  const supabase = createRouteHandlerClient({ cookies });

  // 并行获取所有数据
  const [metrics, alerts, topOffers, trends] = await Promise.all([
    getDashboardMetrics(supabase, organizationUid),
    getRiskAlerts(supabase, organizationUid),
    getTopOffers(supabase, 5, organizationUid),
    getDashboardTrends(supabase, period, organizationUid),
  ]);

  return Response.json({
    metrics,
    alerts,
    topOffers,
    trends,
  });
}
```

**预期效果:**
- 请求数量减少 75%（从 4 个降至 1 个）
- 首屏加载时间减少 40%（从 2.5s 降至 1.5s）

---

#### 7.1.2 使用 React Server Components

```tsx
// app/dashboard/page.tsx (Server Component)
import { getOrganizationFromCookie } from '~/lib/server/organizations';
import { getDashboardOverview } from '~/lib/dashboard/queries';
import DashboardClient from './components/DashboardClient';

export default async function DashboardPage() {
  const organizationUid = await getOrganizationFromCookie();

  // 在服务端获取初始数据
  const initialData = await getDashboardOverview(organizationUid, '7d');

  return (
    <div>
      <PageHeader>Dashboard</PageHeader>
      <DashboardClient initialData={initialData} />
    </div>
  );
}

// app/dashboard/components/DashboardClient.tsx (Client Component)
"use client";

export default function DashboardClient({ initialData }) {
  const organizationUid = useCurrentOrganization();

  // 使用 fallbackData 优化首次渲染
  const { data } = useDashboardOverview(organizationUid, {
    fallbackData: initialData,
  });

  return (
    <div>
      <QuickActionsSection />
      <MetricsSection data={data.metrics} />
      {/* ... */}
    </div>
  );
}
```

**预期效果:**
- FCP (First Contentful Paint) 提前 200ms
- 用户立即看到内容，无需等待客户端 JavaScript 加载

---

### 7.2 图表库优化

#### 7.2.1 Recharts 按需加载

```tsx
// ❌ 当前实现：全量导入
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ✅ 优化后：动态导入
import dynamic from 'next/dynamic';

const LineChart = dynamic(
  () => import('recharts').then((mod) => mod.LineChart),
  { ssr: false, loading: () => <Skeleton className="h-80" /> }
);
const Line = dynamic(() => import('recharts').then((mod) => mod.Line), { ssr: false });
// ... 其他组件

// 或者更简洁的方式：整体动态导入
const DashboardCharts = dynamic(
  () => import('./DashboardCharts'),
  { ssr: false, loading: () => <Skeleton className="h-80" /> }
);
```

**预期效果:**
- 初始 JS Bundle 减小 150KB
- TTI (Time to Interactive) 减少 300ms

---

#### 7.2.2 考虑轻量级替代方案

**Recharts vs 替代方案对比:**

| 图表库 | Gzipped 大小 | 优点 | 缺点 |
|--------|-------------|------|------|
| Recharts | ~150KB | React 原生，API 友好 | 体积较大 |
| Chart.js | ~60KB | 轻量级，功能完善 | 非 React 原生 |
| Apache ECharts | ~80KB (按需) | 功能强大，可交互性强 | 学习曲线陡峭 |
| Victory | ~80KB (Tree-shakeable) | 模块化，可按需引入 | 文档较少 |
| Visx (Airbnb) | ~40KB | 极轻量，底层控制力强 | 需要手动实现很多功能 |

**建议:** 保持 Recharts（已在使用），但启用按需加载和代码分割。

---

### 7.3 数据库查询优化

#### 7.3.1 创建索引

（已在数据隔离部分展示）

#### 7.3.2 使用物化视图缓存聚合查询

```sql
-- Dashboard 统计数据物化视图
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT
  o.organization_id,
  COUNT(DISTINCT o.id) AS total_offers,
  COUNT(DISTINCT CASE WHEN o.status = 'active' THEN o.id END) AS active_offers,
  COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.id END) AS pending_evaluation,
  SUM(o.total_revenue) AS total_revenue,
  SUM(o.total_cost) AS total_cost,
  AVG(o.roas) AS avg_roas,
  COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'running') AS running_tasks,
  COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'pending') AS pending_tasks
FROM "Offer" o
LEFT JOIN "Task" t ON t.offer_id = o.id
GROUP BY o.organization_id;

-- 创建唯一索引以支持 REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_dashboard_stats_org_id
  ON dashboard_stats(organization_id);

-- 定时刷新（每 5 分钟）
-- 使用 pg_cron 或 Supabase Scheduler
SELECT cron.schedule(
  'refresh-dashboard-stats',
  '*/5 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats$$
);

-- API 查询时直接读取物化视图
-- app/api/dashboard/metrics/route.ts
const { data, error } = await supabase
  .from('dashboard_stats')
  .select('*')
  .eq('organization_id', organizationId)
  .single();
```

**预期效果:**
- Dashboard 查询速度从 500ms 降至 50ms（10 倍提升）
- 减少数据库负载 80%

---

### 7.4 图片优化

#### 7.4.1 使用 Next.js Image 组件

```tsx
// ❌ 当前实现
<img src="/images/dashboard.png" alt="Dashboard" />

// ✅ 优化后
import Image from 'next/image';

<Image
  src="/images/dashboard.png"
  alt="Dashboard"
  width={1920}
  height={1080}
  quality={85}
  placeholder="blur"
  blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
/>
```

#### 7.4.2 使用现代图片格式

```typescript
// next.config.js
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  },
};
```

**预期效果:**
- 图片体积减少 50-70%
- LCP (Largest Contentful Paint) 提前 500ms

---

## 八、实施路线图

### Phase 1: 基础架构与路由重构（Week 1-2）

**目标:** 建立坚实的技术基础，完成路由架构重构

#### Week 1
| 任务 | 工作量 | 负责人 | 来源文档 |
|------|--------|--------|---------|
| **路由架构重构** | 1 天 | 全栈工程师 | DetailedPlan |
| - Middleware 自动注入组织上下文 | | | |
| - 更新所有内部链接（隐藏 organization） | | | |
| - Cookie 机制实现 | | | |
| **导航系统** | 1 天 | 前端工程师 | DetailedPlan |
| - 顶部导航栏（未登录/已登录状态） | | | |
| - 移动端底部导航 | | | |
| - 语言切换和主题切换 | | | |
| **组件库准备** | 1 天 | 前端工程师 | DetailedPlan |
| - KPICard 组件 | | | |
| - ActionCard 组件 | | | |
| - ScoreDisplay/ScoreCircle 组件 | | | |
| - StatusBadge 组件 | | | |
| **数据库优化** | 1 天 | 后端工程师 | CurrentAnalysis |
| - 创建索引（user_id, organization_id） | | | |
| - Supabase RLS 策略配置 | | | Supplement |
| - 物化视图创建（dashboard_stats） | | | |

#### Week 2
| 任务 | 工作量 | 负责人 | 来源文档 |
|------|--------|--------|---------|
| **国际化配置** | 1 天 | 前端工程师 | DetailedPlan |
| - 创建中英文翻译文件 | | | |
| - 配置 i18n 路由 | | | |
| - LanguageSwitcher 组件 | | | |
| **SEO 优化基础** | 1 天 | 前端工程师 | DetailedPlan |
| - 配置 Meta 标签 | | | |
| - 添加结构化数据 (JSON-LD) | | | |
| - 生成 Sitemap 和 Robots.txt | | | |
| **API 请求合并** | 1 天 | 后端工程师 | CurrentAnalysis |
| - Dashboard Overview 端点 | | | |
| - 合并 4 个请求为 1 个 | | | |
| **骨架屏组件** | 0.5 天 | 前端工程师 | CurrentAnalysis |
| - DashboardSkeleton | | | |
| - TableSkeleton | | | |
| - 全局应用 | | | |

**里程碑:**
- [ ] 路由重构完成（URL 不再包含 organization）
- [ ] 导航系统上线（支持角标、语言切换）
- [ ] 基础组件库完成
- [ ] 数据库优化完成（查询速度 +10 倍）
- [ ] 国际化和 SEO 基础配置完成

---

### Phase 2: 核心页面 P0 优化（Week 3-4）

**目标:** 优化 Dashboard 和 Offers 的核心功能

#### Week 3: Dashboard 优化
| 任务 | 工作量 | 负责人 | 来源文档 |
|------|--------|--------|---------|
| **Dashboard 自动刷新** | 0.5 天 | 前端工程师 | CurrentAnalysis |
| - SWR 30s 轮询配置 | | | |
| - "最后更新于" 显示 | | | |
| **快捷操作入口** | 1 天 | 前端工程师 | CurrentAnalysis |
| - ActionCard 区域（3 个快捷操作） | | | |
| - 创建 Offer / 批量评估 / 连接账号 | | | |
| **Dashboard 页面增强** | 1.5 天 | 前端工程师 | DetailedPlan |
| - KPI 卡片区域（6 个指标） | | | |
| - 风险提醒区域 | | | |
| - Top Offers 区域 | | | |
| - 数据趋势图表（Recharts） | | | |
| - 通知中心 | | | |
| **趋势图交互增强** | 1 天 | 前端工程师 | CurrentAnalysis |
| - 点击数据点查看详情 | | | |
| - 拖拽选择时间范围 | | | |
| - 添加事件标注 | | | |

#### Week 4: Offers 优化
| 任务 | 工作量 | 负责人 | 来源文档 |
|------|--------|--------|---------|
| **Offers 搜索和筛选** | 2 天 | 前端工程师 | CurrentAnalysis |
| - SearchInput 组件（实时搜索） | | | |
| - FilterDropdown（状态/国家/评分） | | | |
| - 筛选状态持久化（Zustand） | | | |
| **批量操作工具栏** | 1.5 天 | 前端工程师 | CurrentAnalysis |
| - 浮动工具栏（Gmail 风格） | | | |
| - 批量评估 / 批量删除 / 导出 | | | |
| - 确认对话框 | | | |
| **Offers 页面增强** | 1.5 天 | 前端工程师 | DetailedPlan |
| - 批量导入功能 | | | |
| - 状态流转可视化 | | | |
| - 评分展示优化（ScoreCircle） | | | |

**里程碑:**
- [ ] Dashboard 自动刷新上线（30s 轮询）
- [ ] 快捷操作区域上线
- [ ] 趋势图可交互（点击、拖拽）
- [ ] Offers 搜索筛选可用（< 200ms 响应）
- [ ] 批量操作工具栏上线

**验收标准:**
- 首屏加载时间 < 1.5s
- Offers 搜索响应时间 < 200ms
- 批量操作支持 100+ Offer

---

### Phase 3: P1 易用性与核心页面补全（Week 5-6）

**目标:** 提升易用性，完成其他核心页面

#### Week 5: 易用性提升
| 任务 | 工作量 | 负责人 | 来源文档 |
|------|--------|--------|---------|
| **Offer 详情抽屉** | 2 天 | 前端工程师 | CurrentAnalysis |
| - Sheet 组件（右侧滑出） | | | |
| - 4 个 Tab（概览/评估历史/账号/流量） | | | |
| - 快捷操作按钮 | | | |
| **命令面板 (Cmd+K)** | 1.5 天 | 前端工程师 | CurrentAnalysis |
| - cmdk 集成 | | | |
| - 10+ 常用操作和导航 | | | |
| - 快捷键支持（Cmd+N, Cmd+D） | | | |
| **空状态设计** | 1 天 | 前端 + 设计师 | DetailedPlan |
| - EmptyState 组件（带插图） | | | |
| - 无 Offers / 无账号 / 无任务引导 | | | |
| - 从 unDraw 获取 SVG 插图 | | | |

#### Week 6: Ads Center & Tasks 页面
| 任务 | 工作量 | 负责人 | 来源文档 |
|------|--------|--------|---------|
| **Ads Center 页面增强** | 2.5 天 | 前端工程师 | DetailedPlan |
| - OAuth 授权流程优化 | | | |
| - 策略模板市场 | | | |
| - 账号详情对话框 | | | |
| - 执行报告图表 | | | |
| **Tasks 页面增强** | 2 天 | 前端工程师 | DetailedPlan |
| - Token 概览卡片 | | | |
| - 任务类型筛选 | | | |
| - 任务详情对话框 | | | |
| - 日志下载功能 | | | |

**里程碑:**
- [ ] Offer 详情抽屉完成（滑出动画 60fps）
- [ ] 命令面板可用
- [ ] 空状态设计完成
- [ ] Ads Center 页面完成
- [ ] Tasks 页面完成

---

### Phase 4: 首页营销与新手引导（Week 7-8）

**目标:** 提升新用户注册转化率和激活率

#### Week 7: 首页营销优化
| 任务 | 工作量 | 负责人 | 来源文档 |
|------|--------|--------|---------|
| **Hero Section 优化** | 1 天 | 前端 + 设计师 | BestPractices |
| - 清晰价值主张 | | | |
| - 社会证明标签 | | | |
| - CTA 按钮优化 | | | |
| **Trust Bar** | 1 天 | 前端 + 设计师 | BestPractices |
| - 客户 Logo 墙 | | | |
| - 实时统计数字（AnimatedNumber） | | | |
| **Interactive Demo Widget** | 2 天 | 全栈工程师 | BestPractices |
| - 免费试用 Widget（无需注册） | | | |
| - 评分圆环展示 | | | |
| - 引导注册流程 | | | |
| **首页 8 个 Section** | 1 天 | 前端 + 设计师 | Supplement |
| - Features Section | | | |
| - How It Works Section | | | |
| - Benefits Section | | | |
| - Case Studies Section | | | |
| - Pricing Section | | | |
| - Final CTA Section | | | |

#### Week 8: 新手引导与 Footer 页面
| 任务 | 工作量 | 负责人 | 来源文档 |
|------|--------|--------|---------|
| **Onboarding 流程** | 2 天 | 前端工程师 | DetailedPlan |
| - 引导向导 UI（3 步） | | | |
| - Step 1: 创建首个 Offer | | | |
| - Step 2: 启动评估（实时进度） | | | |
| - Step 3: 连接广告账号 | | | |
| **Footer 9 个页面** | 2.5 天 | 前端工程师 | Supplement |
| - /features (功能特性) | | | |
| - /changelog (更新日志) | | | |
| - /roadmap (产品路线图) | | | |
| - /case-studies (客户案例) | | | |
| - /support (帮助中心) | | | |
| - /contact (联系我们) | | | |
| - /careers (加入我们) | | | |
| - /privacy (隐私政策) | | | |
| - /terms (服务条款) | | | |
| **个人中心 Tab 重构** | 1 天 | 前端工程师 | Supplement |
| - /userinfo 单页面（5 个 Tab） | | | |
| - Profile / Subscription / Tokens / Referral / Checkin | | | |

**里程碑:**
- [ ] 首页营销优化完成
- [ ] Interactive Demo Widget 上线（使用率 > 60%）
- [ ] Onboarding 流程上线（完成率 > 70%）
- [ ] Footer 9 个页面完成
- [ ] 个人中心 Tab 重构完成

**验收标准:**
- 首页加载时间 < 2s
- Demo Widget 使用率 > 60%
- 注册转化率 > 2.8%
- 新用户 Onboarding 完成率 > 70%

---

### Phase 5: P2 高级功能与视觉优化（Week 9-10）

**目标:** 提供差异化竞争优势，优化视觉体验

#### Week 9: 高级功能
| 任务 | 工作量 | 负责人 | 来源文档 |
|------|--------|--------|---------|
| **Dashboard 自定义布局** | 2 天 | 前端工程师 | CurrentAnalysis |
| - @dnd-kit/core 集成 | | | |
| - 拖拽调整 KPI 卡片顺序 | | | |
| - 显示/隐藏指标设置 | | | |
| **Offers 多视图** | 2 天 | 前端工程师 | CurrentAnalysis |
| - 表格视图（当前） | | | |
| - 卡片视图（适合浏览） | | | |
| - 看板视图（按状态分组） | | | |
| - ViewSwitcher 组件 | | | |
| **数据对比功能** | 1.5 天 | 前端 + 后端 | CurrentAnalysis |
| - 对比模式选择器 | | | |
| - "与上周对比"/"与去年同期对比" | | | |
| - 趋势图双线显示 | | | |

#### Week 10: 视觉优化与性能
| 任务 | 工作量 | 负责人 | 来源文档 |
|------|--------|--------|---------|
| **视觉设计系统文档** | 1 天 | 设计师 | DetailedPlan |
| - 颜色系统文档 | | | |
| - 排版系统文档 | | | |
| - 组件库文档 | | | |
| **移动端适配** | 1.5 天 | 前端工程师 | DetailedPlan |
| - 表格转卡片视图 | | | |
| - 操作抽屉 (Drawer) | | | |
| - 触摸优化 | | | |
| **性能优化** | 1.5 天 | 前端工程师 | DetailedPlan |
| - 图片优化（Next.js Image + AVIF/WebP） | | | |
| - 代码分割（动态导入 Recharts） | | | |
| - Lighthouse 评分优化 | | | |
| **WebSocket 实时推送（可选）** | 2 天 | 后端工程师 | CurrentAnalysis |
| - WebSocket 服务端实现 | | | |
| - 客户端 Hook | | | |
| - 任务状态实时推送 | | | |

**里程碑:**
- [ ] 自定义 Dashboard 上线
- [ ] Offers 多视图切换可用
- [ ] 数据对比功能上线
- [ ] 移动端适配完成
- [ ] Lighthouse 评分 > 90

---

### Phase 6: 测试与发布（Week 11）

**目标:** 全面测试，准备正式发布

#### Week 11
| 任务 | 工作量 | 负责人 | 来源文档 |
|------|--------|--------|---------|
| **全面测试** | 3 天 | QA + 全员 | DetailedPlan |
| - 功能测试（所有页面） | | | |
| - 中英文翻译检查 | | | |
| - SEO 测试（Google Search Console） | | | |
| - 性能测试（Lighthouse） | | | |
| - 移动端测试 | | | |
| - 跨浏览器测试 | | | |
| **文档完善** | 1 天 | 技术写作 | DetailedPlan |
| - 用户使用文档 | | | |
| - 开发者文档 | | | |
| - API 文档 | | | |
| **正式发布** | 1 天 | DevOps + 全员 | DetailedPlan |
| - 部署到生产环境 | | | |
| - 监控错误和性能（Sentry） | | | |
| - 收集用户反馈 | | | |

**验收标准:**
- 所有功能测试通过
- Lighthouse 评分 > 90
- SEO 页面 100% 收录
- 无 Critical Bug
- 用户文档完整

---

## 九、成功指标

### 9.1 关键指标（6 个月目标）

| 指标 | 当前值 | 目标值 | 测量方式 |
|------|--------|--------|---------|
| **用户满意度（NPS）** | 40 | 52 (+30%) | 季度用户调研 |
| **首屏加载时间** | 2.5s | 1.5s (-40%) | Lighthouse CI |
| **任务完成时间** | 120s | 80s (-33%) | Google Analytics Events |
| **批量操作使用率** | 15% | 27% (+80%) | Mixpanel Funnel |
| **新用户激活率** | 45% | 56% (+25%) | 首日完成评估用户占比 |
| **注册转化率** | 2.0% | 2.8% (+40%) | 首页 → 注册完成 |
| **搜索使用率** | 5% | 9% (+80%) | 使用搜索功能的用户占比 |
| **命令面板使用率** | 0% | 8% (新功能) | Cmd+K 打开次数 / DAU |

### 9.2 技术指标

| 指标 | 当前值 | 目标值 |
|------|--------|--------|
| **Core Web Vitals - LCP** | 2.5s | < 1.5s |
| **Core Web Vitals - FID** | 100ms | < 50ms |
| **Core Web Vitals - CLS** | 0.1 | < 0.05 |
| **JS Bundle Size** | 500KB | < 350KB |
| **API 响应时间 (p95)** | 800ms | < 400ms |
| **数据库查询时间 (p95)** | 500ms | < 100ms |

### 9.3 业务指标

| 指标 | 6 个月目标 |
|------|-----------|
| **月活跃用户 (MAU)** | +50% |
| **付费转化率** | +25% |
| **用户留存率 (30 天)** | +20% |
| **平均会话时长** | +30% |

---

## 十、总结

### 核心改进点

**立即实施（P0）:**
1. ✅ Dashboard 自动刷新（30s 轮询）
2. ✅ Offers 搜索和筛选（实时搜索 + 多条件筛选）
3. ✅ 快捷操作入口（Dashboard 顶部卡片）
4. ✅ 骨架屏优化（提升感知性能）
5. ✅ API 请求合并（减少网络往返）

**近期实施（P1）:**
6. ✅ 批量操作工具栏（Gmail 风格）
7. ✅ Offer 详情抽屉（Linear 风格）
8. ✅ 趋势图交互增强（可点击、可拖拽）
9. ✅ 命令面板 Cmd+K（Linear 风格）
10. ✅ 路由重构（隐藏 organization）

**未来规划（P2）:**
11. 自定义 Dashboard 布局
12. Offers 多视图（卡片/看板）
13. 数据对比功能
14. WebSocket 实时推送

### 预期收益

**用户体验:**
- 操作效率 +50%
- 用户满意度 +30%
- 新用户激活率 +25%

**技术性能:**
- 首屏加载时间 -40%
- API 响应时间 -50%
- 数据库查询 -80%

**业务指标:**
- 注册转化率 +40%
- 付费转化率 +25%
- 用户留存率 +20%

---

## 附录

### A. 相关文档

1. **FrontendDesignDetailedPlan_20251009.md** - 详细设计方案（3,385 行）
   - 完整页面设计
   - 组件库
   - SEO 优化
   - 国际化
   - 视觉设计系统

2. **FrontendDesignSupplement_20251009.md** - 补充设计
   - Footer 链接页面（9 个页面完整设计）
   - 首页营销页面（8 个 Section）
   - 个人中心 Tab 重构
   - 多用户数据隔离方案

3. **FrontendBestPractices_20251009.md** - 行业最佳实践
   - 产品定位与增长策略
   - 用户体验优化
   - 性能与技术优化
   - 数据驱动与分析
   - 运营与增长黑客

4. **CurrentImplementationAnalysis_20251009.md** - 当前实现分析
   - Dashboard 现状评估
   - Offers 现状评估
   - 与行业标杆对比
   - 优先级改进建议

### B. 技术栈

**前端:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Shadcn UI (Radix UI)
- SWR (数据获取)
- Zustand (状态管理)
- Recharts (图表)
- cmdk (命令面板)

**后端:**
- Go 微服务
- PostgreSQL
- Supabase (Auth + RLS)
- Cloud Run (部署)

**工具:**
- Lighthouse CI (性能监控)
- Sentry (错误追踪)
- Mixpanel / Amplitude (用户行为分析)
- Vercel (部署 + Edge Functions)

### C. 参考资源

**设计灵感:**
- [Stripe Dashboard](https://dashboard.stripe.com)
- [Linear Issues](https://linear.app)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Notion Database](https://www.notion.so)
- [Airtable](https://airtable.com)

**组件库:**
- [Shadcn UI](https://ui.shadcn.com)
- [Radix UI](https://www.radix-ui.com)
- [Headless UI](https://headlessui.com)

**插图资源:**
- [unDraw](https://undraw.co)
- [Storyset](https://storyset.com)
- [Illustrations.co](https://illlustrations.co)

**性能优化:**
- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Web.dev - Performance](https://web.dev/explore/performance)
- [Vercel Speed Insights](https://vercel.com/docs/speed-insights)

---

**文档结束**

如需进一步讨论实施细节或技术方案，请参考上述四份详细文档，或联系技术团队。
