# AutoAds 前端页面设计详细优化方案

**文档日期**: 2025-10-09
**设计师视角**: 专业前端设计师 + 用户体验师
**目标**: 基于业务需求全面重构前端页面，提升用户体验和转化率

---

## 目录

1. [页面架构重构](#一页面架构重构)
2. [核心页面设计方案](#二核心页面设计方案)
3. [导航系统设计](#三导航系统设计)
4. [新用户引导流程](#四新用户引导流程)
5. [组件复用策略](#五组件复用策略)
6. [SEO优化方案](#六seo优化方案)
7. [中英双语国际化](#七中英双语国际化)
8. [视觉设计系统](#八视觉设计系统)
9. [实施路线图](#九实施路线图)

---

## 一、页面架构重构

### 1.1 整体信息架构

```
AutoAds Platform
│
├── 官网 (Marketing Site)
│   ├── / (首页)
│   ├── /pricing (定价 + FAQ 合并)
│   ├── /about (关于)
│   ├── /blog (博客)
│   └── /docs (文档)
│
└── 应用 (App)
    ├── /dashboard (大盘)
    ├── /offers (Offer库)
    ├── /adscenter (Ads中心)
    ├── /tasks (任务中心)
    └── /userinfo (个人中心)
        ├── /userinfo/profile (个人信息)
        ├── /userinfo/subscription (套餐订阅)
        ├── /userinfo/tokens (Token余额)
        ├── /userinfo/referral (邀请)
        └── /userinfo/checkin (签到)
```

### 1.2 URL 路由重构

**当前问题**:
- 路由包含组织概念：`/dashboard/[organization]/offers`
- URL 冗长，暴露内部架构

**优化方案**:
```typescript
// 隐藏组织概念，简化路由
// 旧路由: /dashboard/[organization]/offers
// 新路由: /offers

// 实现方式：中间件自动注入组织上下文
// middleware.ts
export function middleware(request: NextRequest) {
  const session = await getSession(request);
  const organizationId = await getUserDefaultOrganization(session.user.id);

  // 将组织ID存入请求上下文，而非URL
  request.headers.set('X-Organization-Id', organizationId);
}

// 页面中通过 Hook 获取
function useCurrentOrganization() {
  // 从 Cookie/Header 读取，用户无感知
  return organizationId;
}
```

**新路由表**:
```
官网:
  / → 首页
  /pricing → 定价页（包含FAQ）
  /about → 关于页
  /blog → 博客列表
  /blog/[slug] → 博客详情
  /docs → 文档首页
  /docs/[...slug] → 文档内容

应用（需登录）:
  /dashboard → 大盘
  /offers → Offer库
  /adscenter → Ads中心
  /tasks → 任务中心
  /userinfo → 个人中心
  /userinfo/profile → 个人信息
  /userinfo/subscription → 套餐订阅
  /userinfo/tokens → Token余额
  /userinfo/referral → 邀请好友
  /userinfo/checkin → 签到

认证:
  /auth → 登录/注册统一入口（取消独立登录页）
  /auth/callback → OAuth 回调
```

---

## 二、核心页面设计方案

### 2.1 大盘页面 (/dashboard)

#### 设计目标
让用户 **3秒内** 了解核心业务状态，**1次点击** 触达高频操作

#### 布局结构

```tsx
<DashboardLayout>
  {/* 顶部横幅：重要提醒 */}
  <AlertBanner>
    <WarningAlert>
      Token 余额不足 100，<Link>立即充值</Link>
    </WarningAlert>
  </AlertBanner>

  {/* 第一屏：核心 KPI */}
  <MetricsSection>
    <MetricsGrid cols={5}>
      <KPICard
        title="Offer 总数"
        value={formatNumber(dashboardData.totalOffers)}
        trend={{ value: 12, direction: 'up', period: '本周' }}
        icon={<DocumentTextIcon />}
        color="blue"
        onClick={() => router.push('/offers')}
      />
      <KPICard
        title="评估成功率"
        value={`${dashboardData.evaluationSuccessRate}%`}
        trend={{ value: 5, direction: 'up' }}
        icon={<CheckCircleIcon />}
        color="green"
        status="success"
      />
      <KPICard
        title="已连接账号"
        value={dashboardData.connectedAccounts}
        subtitle="Google Ads"
        icon={<LinkIcon />}
        color="purple"
        onClick={() => router.push('/adscenter')}
      />
      <KPICard
        title="累计花费"
        value={formatCurrency(dashboardData.totalSpend, 'USD')}
        trend={{ value: -8, direction: 'down', label: '本周节省' }}
        icon={<CurrencyDollarIcon />}
        color="amber"
      />
      <KPICard
        title="Token 余额"
        value={formatNumber(dashboardData.tokenBalance)}
        trend={{ value: -1200, direction: 'down', label: '今日消耗' }}
        icon={<BoltIcon />}
        color="indigo"
        action={{ label: '充值', onClick: () => router.push('/userinfo/tokens') }}
      />
    </MetricsGrid>
  </MetricsSection>

  {/* 第二屏：待办任务流 + 快捷操作 */}
  <Section>
    <SectionHeader title="待办事项" badge={actionItems.length} />
    <QuickActionsGrid cols={2}>
      {/* 动态生成待办卡片 */}
      {actionItems.map(item => (
        <ActionCard
          key={item.id}
          variant={item.priority} // 'urgent' | 'normal' | 'low'
          title={item.title}
          description={item.description}
          count={item.count}
          icon={item.icon}
          cta={item.cta}
          onClick={item.onClick}
        />
      ))}

      {/* 示例: */}
      <ActionCard
        variant="urgent"
        title="5 个 Offer 待评估"
        description="新添加的落地页等待质量评估"
        count={5}
        icon={<ClockIcon />}
        cta="立即评估"
        onClick={() => router.push('/offers?status=pending_evaluation')}
      />

      <ActionCard
        variant="normal"
        title="3 个账号需要同步"
        description="广告账号数据已过期，建议同步最新数据"
        count={3}
        icon={<ArrowPathIcon />}
        cta="同步账号"
        onClick={handleSyncAll}
      />

      <ActionCard
        variant="low"
        title="查看最新任务进度"
        description="15 个任务正在执行中"
        count={15}
        icon={<ListBulletIcon />}
        cta="查看详情"
        onClick={() => router.push('/tasks?status=running')}
      />
    </QuickActionsGrid>
  </Section>

  {/* 第三屏：数据趋势图表 */}
  <ChartsSection>
    <ChartsGrid cols={2}>
      {/* 左侧：Offer 评估趋势 */}
      <ChartCard
        title="Offer 评估趋势"
        subtitle="过去 30 天"
        description="每日评估数量与成功率变化"
      >
        <LineChart
          data={dashboardData.evaluationTrend}
          series={[
            { name: '评估总数', dataKey: 'total', color: 'blue' },
            { name: '成功数量', dataKey: 'success', color: 'green' },
          ]}
          xAxisKey="date"
          height={300}
        />
      </ChartCard>

      {/* 右侧：广告花费趋势 */}
      <ChartCard
        title="广告花费趋势"
        subtitle="过去 30 天"
        description="每日花费与 ROAS 变化"
      >
        <ComboChart
          data={dashboardData.spendTrend}
          series={[
            { type: 'bar', name: '花费 (USD)', dataKey: 'spend', color: 'amber' },
            { type: 'line', name: 'ROAS', dataKey: 'roas', color: 'green' },
          ]}
          xAxisKey="date"
          height={300}
        />
      </ChartCard>

      {/* 左下：Token 消耗分布 */}
      <ChartCard
        title="Token 消耗分布"
        subtitle="过去 7 天"
        description="按任务类型分类"
      >
        <PieChart
          data={dashboardData.tokenUsageByType}
          dataKey="value"
          nameKey="taskType"
          height={300}
          colors={['#3B82F6', '#10B981', '#F59E0B', '#EF4444']}
        />
      </ChartCard>

      {/* 右下：Top 10 Offers 表现 */}
      <ChartCard
        title="Top 10 Offers"
        subtitle="按评分排序"
        description="评分最高的落地页"
      >
        <BarChart
          data={dashboardData.topOffers}
          dataKey="score"
          nameKey="name"
          layout="horizontal"
          height={300}
        />
      </ChartCard>
    </ChartsGrid>
  </ChartsSection>

  {/* 第四屏：最新活动流 */}
  <TwoColumnLayout>
    {/* 左侧：活动时间线 */}
    <ActivitySection>
      <SectionHeader title="最新活动" />
      <ActivityTimeline>
        {dashboardData.recentActivities.map(activity => (
          <ActivityItem
            key={activity.id}
            type={activity.type}
            title={activity.title}
            description={activity.description}
            timestamp={activity.timestamp}
            icon={getActivityIcon(activity.type)}
            href={activity.href}
          />
        ))}
      </ActivityTimeline>
    </ActivitySection>

    {/* 右侧：消息通知 */}
    <NotificationsSection>
      <SectionHeader title="消息通知" badge={unreadCount} />
      <NotificationsList>
        {dashboardData.notifications.map(notification => (
          <NotificationItem
            key={notification.id}
            type={notification.type}
            title={notification.title}
            message={notification.message}
            timestamp={notification.timestamp}
            isRead={notification.isRead}
            actions={notification.actions}
          />
        ))}
      </NotificationsList>
    </NotificationsSection>
  </TwoColumnLayout>

  {/* 第五屏：风险提醒 */}
  {dashboardData.risks.length > 0 && (
    <RiskAlertsSection>
      <SectionHeader title="风险提醒" icon={<ExclamationTriangleIcon />} />
      <RiskAlertsList>
        {dashboardData.risks.map(risk => (
          <RiskAlert
            key={risk.id}
            severity={risk.severity} // 'critical' | 'high' | 'medium' | 'low'
            title={risk.title}
            description={risk.description}
            recommendedAction={risk.recommendedAction}
            onAction={risk.onAction}
          />
        ))}
      </RiskAlertsList>
    </RiskAlertsSection>
  )}
</DashboardLayout>
```

#### 数据接口

```typescript
// API: GET /api/dashboard/summary
interface DashboardData {
  // KPI 指标
  totalOffers: number;
  evaluationSuccessRate: number; // 百分比
  connectedAccounts: number;
  totalSpend: number; // USD
  tokenBalance: number;

  // 待办事项
  actionItems: Array<{
    id: string;
    type: 'offer_evaluation' | 'account_sync' | 'task_check' | 'token_recharge';
    priority: 'urgent' | 'normal' | 'low';
    title: string;
    description: string;
    count: number;
    href: string;
  }>;

  // 趋势数据
  evaluationTrend: Array<{
    date: string; // YYYY-MM-DD
    total: number;
    success: number;
    failed: number;
  }>;

  spendTrend: Array<{
    date: string;
    spend: number;
    roas: number;
  }>;

  tokenUsageByType: Array<{
    taskType: string;
    value: number;
    label: string;
  }>;

  topOffers: Array<{
    id: string;
    name: string;
    score: number;
    url: string;
  }>;

  // 活动流
  recentActivities: Array<{
    id: string;
    type: 'offer_created' | 'offer_evaluated' | 'account_connected' | 'task_completed';
    title: string;
    description: string;
    timestamp: string;
    href: string;
  }>;

  // 消息通知
  notifications: Array<{
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    timestamp: string;
    isRead: boolean;
    actions?: Array<{
      label: string;
      href: string;
    }>;
  }>;

  // 风险提醒
  risks: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    recommendedAction: string;
    onAction: () => void;
  }>;
}
```

#### 响应式布局

```css
/* 桌面端：5列KPI卡片 */
@media (min-width: 1280px) {
  .metrics-grid { grid-template-columns: repeat(5, 1fr); }
  .charts-grid { grid-template-columns: repeat(2, 1fr); }
}

/* 平板端：3列KPI卡片 */
@media (min-width: 768px) and (max-width: 1279px) {
  .metrics-grid { grid-template-columns: repeat(3, 1fr); }
  .charts-grid { grid-template-columns: 1fr; }
}

/* 移动端：1列堆叠 */
@media (max-width: 767px) {
  .metrics-grid { grid-template-columns: 1fr; }
  .quick-actions-grid { grid-template-columns: 1fr; }
  .charts-grid { grid-template-columns: 1fr; }
  .two-column-layout { flex-direction: column; }
}
```

---

### 2.2 Offer库页面 (/offers)

#### 设计目标
高效管理 Offers，支持批量操作，清晰展示状态流转，与 Ads 账号关联

#### 布局结构

```tsx
<OffersPageLayout>
  {/* 页面头部 */}
  <AppHeader
    title="Offer 库"
    description="管理所有落地页，评估质量，关联广告账号"
    actions={
      <>
        <Button variant="outline" onClick={handleBulkImport}>
          <UploadIcon /> 批量导入
        </Button>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <PlusIcon /> 新建 Offer
        </Button>
      </>
    }
  />

  <PageBody>
    {/* 工具栏 */}
    <ToolbarSection>
      <FiltersBar>
        {/* 状态筛选 */}
        <Select value={statusFilter} onChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending_evaluation">
              <Badge variant="yellow">待评估</Badge>
            </SelectItem>
            <SelectItem value="evaluating">
              <Badge variant="blue">评估中</Badge>
            </SelectItem>
            <SelectItem value="ready_to_deploy">
              <Badge variant="green">可投放</Badge>
            </SelectItem>
            <SelectItem value="deployed">
              <Badge variant="indigo">已投放</Badge>
            </SelectItem>
            <SelectItem value="evaluation_failed">
              <Badge variant="red">评估失败</Badge>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* 评分范围筛选 */}
        <ScoreRangeFilter>
          <Label>评分范围</Label>
          <Slider
            min={0}
            max={100}
            step={10}
            value={scoreRange}
            onValueChange={setScoreRange}
          />
          <div className="text-sm text-muted-foreground">
            {scoreRange[0]} - {scoreRange[1]} 分
          </div>
        </ScoreRangeFilter>

        {/* 分类筛选 */}
        <Select value={categoryFilter} onChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="全部分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            <SelectItem value="ecommerce">电商</SelectItem>
            <SelectItem value="gaming">游戏</SelectItem>
            <SelectItem value="finance">金融</SelectItem>
            <SelectItem value="other">其他</SelectItem>
          </SelectContent>
        </Select>

        {/* 搜索 */}
        <SearchInput
          placeholder="搜索 URL 或名称"
          value={searchQuery}
          onChange={setSearchQuery}
          icon={<MagnifyingGlassIcon />}
        />

        <Spacer />

        {/* 视图切换 */}
        <ViewToggle>
          <Button
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('table')}
          >
            <TableCellsIcon />
          </Button>
          <Button
            variant={view === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('grid')}
          >
            <Squares2X2Icon />
          </Button>
        </ViewToggle>
      </FiltersBar>

      {/* 批量操作栏 */}
      {selectedOffers.size > 0 && (
        <BulkActionsBar>
          <Checkbox
            checked={selectedOffers.size === offers.length}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm">已选 {selectedOffers.size} 项</span>

          <Separator orientation="vertical" />

          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkEvaluate}
            disabled={bulkActionPending}
          >
            <PlayIcon /> 批量评估
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkAssignAccount}
          >
            <LinkIcon /> 关联账号
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkExport}
          >
            <ArrowDownTrayIcon /> 导出
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedOffers(new Set())}
          >
            清除选择
          </Button>
        </BulkActionsBar>
      )}
    </ToolbarSection>

    {/* 数据展示 */}
    {view === 'table' ? (
      <OffersTable
        offers={filteredOffers}
        selectedIds={selectedOffers}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onView={handleViewDetails}
        onEvaluate={handleEvaluate}
        onAssignAccount={handleAssignAccount}
        onDelete={handleDelete}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
      />
    ) : (
      <OffersGridView
        offers={filteredOffers}
        selectedIds={selectedOffers}
        onToggleSelect={handleToggleSelect}
        onView={handleViewDetails}
      />
    )}

    {/* 分页 */}
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    />
  </PageBody>

  {/* 对话框 */}
  <CreateOfferDialog
    open={createDialogOpen}
    onOpenChange={setCreateDialogOpen}
    onCreated={handleOfferCreated}
  />

  <OfferDetailDialog
    offer={selectedOffer}
    open={detailDialogOpen}
    onClose={() => setDetailDialogOpen(false)}
    onEvaluate={handleEvaluate}
    onAssignAccount={handleAssignAccount}
  />

  <BulkImportDialog
    open={bulkImportDialogOpen}
    onOpenChange={setBulkImportDialogOpen}
    onImported={handleBulkImported}
  />

  <AssignAccountDialog
    offers={Array.from(selectedOffers)}
    open={assignAccountDialogOpen}
    onClose={() => setAssignAccountDialogOpen(false)}
    onAssigned={handleAccountAssigned}
  />
</OffersPageLayout>
```

#### 表格列设计

```tsx
const columns: Column[] = [
  {
    key: 'select',
    header: <Checkbox />,
    cell: (offer) => <Checkbox checked={selectedOffers.has(offer.id)} />,
    width: '48px',
  },
  {
    key: 'name',
    header: 'Offer 名称',
    cell: (offer) => (
      <div className="flex items-center gap-2">
        <Avatar src={offer.favicon} fallback={offer.name[0]} />
        <div>
          <div className="font-medium">{offer.name}</div>
          <div className="text-xs text-muted-foreground truncate max-w-xs">
            {offer.url}
          </div>
        </div>
      </div>
    ),
    sortable: true,
    width: '300px',
  },
  {
    key: 'status',
    header: '状态',
    cell: (offer) => <StatusBadge status={offer.status} />,
    sortable: true,
    width: '120px',
  },
  {
    key: 'score',
    header: '评分',
    cell: (offer) => (
      <ScoreDisplay
        score={offer.score}
        max={100}
        showProgress
      />
    ),
    sortable: true,
    width: '120px',
  },
  {
    key: 'category',
    header: '分类',
    cell: (offer) => <CategoryTag category={offer.category} />,
    sortable: true,
    width: '100px',
  },
  {
    key: 'adsAccount',
    header: '关联账号',
    cell: (offer) => (
      offer.adsAccountId ? (
        <AdsAccountBadge accountId={offer.adsAccountId} />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleAssignAccount(offer)}
        >
          <LinkIcon className="h-4 w-4" /> 关联
        </Button>
      )
    ),
    width: '150px',
  },
  {
    key: 'createdAt',
    header: '创建时间',
    cell: (offer) => formatRelativeTime(offer.createdAt),
    sortable: true,
    width: '120px',
  },
  {
    key: 'actions',
    header: '操作',
    cell: (offer) => (
      <ActionMenu>
        <ActionMenuItem onClick={() => handleViewDetails(offer)}>
          <EyeIcon /> 查看详情
        </ActionMenuItem>
        <ActionMenuItem
          onClick={() => handleEvaluate(offer)}
          disabled={offer.status === 'evaluating'}
        >
          <PlayIcon /> 评估
        </ActionMenuItem>
        <ActionMenuItem onClick={() => handleEdit(offer)}>
          <PencilIcon /> 编辑
        </ActionMenuItem>
        <ActionMenuSeparator />
        <ActionMenuItem
          onClick={() => handleDelete(offer)}
          variant="danger"
        >
          <TrashIcon /> 删除
        </ActionMenuItem>
      </ActionMenu>
    ),
    width: '80px',
  },
];
```

#### Offer 详情对话框设计

```tsx
<Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Offer 详情</DialogTitle>
      <DialogDescription>{offer.url}</DialogDescription>
    </DialogHeader>

    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">概览</TabsTrigger>
        <TabsTrigger value="evaluation">评估结果</TabsTrigger>
        <TabsTrigger value="ads">广告关联</TabsTrigger>
        <TabsTrigger value="history">历史记录</TabsTrigger>
      </TabsList>

      {/* Tab 1: 概览 */}
      <TabsContent value="overview">
        <div className="grid grid-cols-2 gap-6">
          {/* 左侧：基本信息 */}
          <div className="space-y-4">
            <InfoItem label="Offer ID" value={offer.id} copyable />
            <InfoItem label="名称" value={offer.name} />
            <InfoItem label="URL" value={offer.url} linkable />
            <InfoItem label="分类" value={offer.category} />
            <InfoItem label="状态" value={<StatusBadge status={offer.status} />} />
            <InfoItem label="创建时间" value={formatDateTime(offer.createdAt)} />
            <InfoItem label="更新时间" value={formatDateTime(offer.updatedAt)} />
          </div>

          {/* 右侧：预览截图 */}
          <div className="space-y-4">
            <Label>页面预览</Label>
            {offer.screenshot ? (
              <img
                src={offer.screenshot}
                alt={offer.name}
                className="rounded-lg border"
              />
            ) : (
              <div className="rounded-lg border border-dashed h-64 flex items-center justify-center text-muted-foreground">
                暂无截图
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      {/* Tab 2: 评估结果 */}
      <TabsContent value="evaluation">
        {offer.evaluationResult ? (
          <div className="space-y-6">
            {/* 总评分 */}
            <Card>
              <CardHeader>
                <CardTitle>综合评分</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <ScoreCircle
                    score={offer.evaluationResult.totalScore}
                    size="large"
                  />
                  <div>
                    <div className="text-2xl font-bold">
                      {offer.evaluationResult.totalScore} / 100
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {getScoreLevel(offer.evaluationResult.totalScore)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 分项评分 */}
            <Card>
              <CardHeader>
                <CardTitle>详细评分</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {offer.evaluationResult.dimensions.map(dim => (
                  <ScoreDimension
                    key={dim.name}
                    name={dim.name}
                    score={dim.score}
                    description={dim.description}
                    suggestions={dim.suggestions}
                  />
                ))}
              </CardContent>
            </Card>

            {/* 风险项 */}
            {offer.evaluationResult.risks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>风险提示</CardTitle>
                </CardHeader>
                <CardContent>
                  <RiskList risks={offer.evaluationResult.risks} />
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <EmptyState
            icon={<ClipboardDocumentListIcon />}
            title="暂无评估结果"
            description="点击下方按钮启动评估"
            action={
              <Button onClick={() => handleEvaluate(offer)}>
                <PlayIcon /> 启动评估
              </Button>
            }
          />
        )}
      </TabsContent>

      {/* Tab 3: 广告关联 */}
      <TabsContent value="ads">
        {offer.adsAccountId ? (
          <div className="space-y-4">
            <AdsAccountCard accountId={offer.adsAccountId} />
            <CampaignsList offerId={offer.id} />
            <Button
              variant="outline"
              onClick={() => handleUnlinkAccount(offer)}
            >
              解除关联
            </Button>
          </div>
        ) : (
          <EmptyState
            icon={<LinkSlashIcon />}
            title="未关联广告账号"
            description="关联后可以自动创建广告活动"
            action={
              <Button onClick={() => handleAssignAccount(offer)}>
                <LinkIcon /> 关联账号
              </Button>
            }
          />
        )}
      </TabsContent>

      {/* Tab 4: 历史记录 */}
      <TabsContent value="history">
        <Timeline>
          {offer.history.map(event => (
            <TimelineItem
              key={event.id}
              timestamp={event.timestamp}
              type={event.type}
              title={event.title}
              description={event.description}
              actor={event.actor}
            />
          ))}
        </Timeline>
      </TabsContent>
    </Tabs>

    <DialogFooter>
      <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
        关闭
      </Button>
      <Button onClick={() => handleEvaluate(offer)}>
        <PlayIcon /> 重新评估
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

#### 批量导入功能

```tsx
<Dialog open={bulkImportDialogOpen} onOpenChange={setBulkImportDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>批量导入 Offers</DialogTitle>
      <DialogDescription>
        上传 CSV 文件，快速导入多个落地页
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4">
      {/* 下载模板 */}
      <Alert>
        <InfoCircledIcon />
        <AlertTitle>模板格式</AlertTitle>
        <AlertDescription>
          请按照模板格式准备数据：URL, Name, Category
          <Button variant="link" onClick={downloadTemplate}>
            下载模板
          </Button>
        </AlertDescription>
      </Alert>

      {/* 文件上传 */}
      <FileUpload
        accept=".csv"
        maxSize={5 * 1024 * 1024} // 5MB
        onUpload={handleFileUpload}
      />

      {/* 预览 */}
      {previewData.length > 0 && (
        <div className="space-y-2">
          <Label>预览数据（前 5 条）</Label>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>分类</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewData.slice(0, 5).map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>{row.url}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.category}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-sm text-muted-foreground">
            共 {previewData.length} 条记录
          </p>
        </div>
      )}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setBulkImportDialogOpen(false)}>
        取消
      </Button>
      <Button
        onClick={handleImport}
        disabled={!previewData.length || importing}
      >
        {importing ? <Spinner /> : '开始导入'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### 2.3 Ads中心页面 (/adscenter)

#### 设计目标
统一管理广告账号，简化授权流程，可视化账号数据，支持策略配置

#### 布局结构

```tsx
<AdsCenterLayout>
  <AppHeader
    title="Ads 中心"
    description="管理广告账号授权、数据同步与预算策略"
    actions={
      <Button onClick={handleConnectAccount}>
        <PlusCircleIcon /> 连接账号
      </Button>
    }
  />

  <PageBody>
    {/* 工具栏 */}
    <ToolbarSection>
      <div className="flex items-center gap-3">
        {/* 平台筛选 */}
        <Select value={platformFilter} onChange={setPlatformFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部平台</SelectItem>
            <SelectItem value="google">Google Ads</SelectItem>
            <SelectItem value="facebook">Facebook Ads</SelectItem>
            <SelectItem value="tiktok">TikTok Ads</SelectItem>
          </SelectContent>
        </Select>

        {/* 状态筛选 */}
        <Select value={statusFilter} onChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">
              <Badge variant="green">活跃</Badge>
            </SelectItem>
            <SelectItem value="expired">
              <Badge variant="red">已过期</Badge>
            </SelectItem>
            <SelectItem value="syncing">
              <Badge variant="blue">同步中</Badge>
            </SelectItem>
          </SelectContent>
        </Select>

        <Spacer />

        {/* 批量操作 */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncAll}
          disabled={syncingAll}
        >
          {syncingAll ? <Spinner /> : <ArrowPathIcon />}
          同步全部
        </Button>
      </div>
    </ToolbarSection>

    {/* 账号列表 */}
    <AccountsTable
      accounts={filteredAccounts}
      onView={handleViewAccount}
      onSync={handleSyncAccount}
      onDisconnect={handleDisconnect}
      pendingIds={pendingIds}
    />

    {/* 策略模板 */}
    <Section>
      <SectionHeader
        title="策略模板"
        description="预设投放策略，快速应用到账号"
      />
      <StrategyTemplatesGrid>
        {strategyTemplates.map(template => (
          <StrategyTemplateCard
            key={template.id}
            template={template}
            onApply={handleApplyTemplate}
          />
        ))}
      </StrategyTemplatesGrid>
    </Section>

    {/* 执行报告 */}
    <Section>
      <SectionHeader
        title="执行报告"
        description="过去 7 天的投放数据汇总"
      />
      <ExecutionReportChart data={executionReport} />
    </Section>
  </PageBody>

  {/* 账号详情对话框 */}
  <AccountDetailDialog
    account={selectedAccount}
    open={detailDialogOpen}
    onClose={() => setDetailDialogOpen(false)}
    onSync={handleSyncAccount}
    onDisconnect={handleDisconnect}
  />
</AdsCenterLayout>
```

---

### 2.4 任务中心页面 (/tasks)

#### 设计目标
透明展示任务执行状态，清晰显示 Token 消耗，支持任务管理

#### 增强功能

```tsx
<TasksPageLayout>
  <AppHeader
    title="任务中心"
    description="查看所有任务执行状态和 Token 消耗明细"
  />

  <PageBody>
    {/* Token 概览卡片 */}
    <TokenSummarySection>
      <TokenBalanceCard
        balance={tokenBalance}
        todayUsage={todayUsage}
        weeklyTrend={weeklyTrend}
      />
      <TokenUsageBreakdownCard
        byTaskType={usageByTaskType}
        period="本周"
      />
    </TokenSummarySection>

    {/* 任务筛选 */}
    <ToolbarSection>
      {/* 任务类型筛选 */}
      <Select value={taskTypeFilter} onChange={setTaskTypeFilter}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部任务</SelectItem>
          <SelectItem value="offer_evaluation">
            <TaskTypeIcon type="offer_evaluation" /> Offer 评估
          </SelectItem>
          <SelectItem value="click_supplement">
            <TaskTypeIcon type="click_supplement" /> 补点击
          </SelectItem>
          <SelectItem value="link_replacement">
            <TaskTypeIcon type="link_replacement" /> 换链接
          </SelectItem>
          <SelectItem value="account_sync">
            <TaskTypeIcon type="account_sync" /> 账号同步
          </SelectItem>
        </SelectContent>
      </Select>

      {/* 状态筛选 */}
      <Select value={statusFilter} onChange={setStatusFilter}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部状态</SelectItem>
          <SelectItem value="pending">待处理</SelectItem>
          <SelectItem value="running">进行中</SelectItem>
          <SelectItem value="completed">已完成</SelectItem>
          <SelectItem value="failed">失败</SelectItem>
          <SelectItem value="cancelled">已取消</SelectItem>
        </SelectContent>
      </Select>

      {/* 日期范围 */}
      <DateRangePicker
        value={dateRange}
        onChange={setDateRange}
        presets={[
          { label: '今天', value: 'today' },
          { label: '近7天', value: '7d' },
          { label: '近30天', value: '30d' },
        ]}
      />

      <Spacer />

      <Button size="sm" variant="outline" onClick={handleRefresh}>
        <ArrowPathIcon /> 刷新
      </Button>
    </ToolbarSection>

    {/* 任务列表 */}
    <TasksTable
      tasks={filteredTasks}
      onView={handleViewTask}
      onCancel={handleCancelTask}
      onRetry={handleRetryTask}
      pendingIds={pendingIds}
    />

    {/* 分页 */}
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    />
  </PageBody>

  {/* 任务详情对话框 */}
  <TaskDetailDialog
    task={selectedTask}
    open={taskDetailDialogOpen}
    onClose={() => setTaskDetailDialogOpen(false)}
  />
</TasksPageLayout>
```

#### 表格列设计（增强）

```tsx
const columns: Column[] = [
  {
    key: 'taskId',
    header: '任务 ID',
    cell: (task) => (
      <code className="text-xs bg-muted px-2 py-1 rounded">
        {task.id.slice(0, 8)}
      </code>
    ),
    width: '100px',
  },
  {
    key: 'taskType',
    header: '任务类型',
    cell: (task) => (
      <div className="flex items-center gap-2">
        <TaskTypeIcon type={task.taskType} />
        <span>{getTaskTypeLabel(task.taskType)}</span>
      </div>
    ),
    sortable: true,
    width: '150px',
  },
  {
    key: 'target',
    header: '目标对象',
    cell: (task) => (
      <Link href={getTargetLink(task)} className="text-primary hover:underline">
        {task.targetName || task.targetId}
      </Link>
    ),
    width: '200px',
  },
  {
    key: 'status',
    header: '状态',
    cell: (task) => <TaskStatusBadge status={task.status} />,
    sortable: true,
    width: '100px',
  },
  {
    key: 'progress',
    header: '进度',
    cell: (task) => (
      <ProgressBar
        value={task.progress}
        max={100}
        label={`${task.progress}%`}
      />
    ),
    width: '150px',
  },
  {
    key: 'tokenCost',
    header: 'Token 消耗',
    cell: (task) => (
      <div className="flex items-center gap-1">
        <BoltIcon className="h-4 w-4 text-amber-500" />
        <span className="font-mono">{task.tokenCost}</span>
      </div>
    ),
    sortable: true,
    width: '120px',
  },
  {
    key: 'createdAt',
    header: '创建时间',
    cell: (task) => formatRelativeTime(task.createdAt),
    sortable: true,
    width: '120px',
  },
  {
    key: 'duration',
    header: '耗时',
    cell: (task) => formatDuration(task.startTime, task.endTime),
    width: '100px',
  },
  {
    key: 'actions',
    header: '操作',
    cell: (task) => (
      <ActionMenu>
        <ActionMenuItem onClick={() => handleViewTask(task)}>
          <EyeIcon /> 查看详情
        </ActionMenuItem>
        {task.status === 'running' && (
          <ActionMenuItem onClick={() => handleCancelTask(task)}>
            <StopIcon /> 取消任务
          </ActionMenuItem>
        )}
        {task.status === 'failed' && (
          <ActionMenuItem onClick={() => handleRetryTask(task)}>
            <ArrowPathIcon /> 重试
          </ActionMenuItem>
        )}
        <ActionMenuItem onClick={() => handleDownloadLog(task)}>
          <DocumentArrowDownIcon /> 下载日志
        </ActionMenuItem>
      </ActionMenu>
    ),
    width: '80px',
  },
];
```

---

### 2.5 个人中心页面 (/userinfo)

#### 设计目标
统一管理用户个人信息、订阅、Token、邀请、签到等功能

#### 布局结构（侧边栏导航）

```tsx
<UserInfoLayout>
  {/* 左侧：导航菜单 */}
  <Sidebar>
    <UserCard>
      <Avatar src={user.avatar} size="large" />
      <UserName>{user.displayName}</UserName>
      <UserEmail>{user.email}</UserEmail>
    </UserCard>

    <SidebarNav>
      <SidebarNavItem href="/userinfo/profile" icon={<UserIcon />}>
        个人信息
      </SidebarNavItem>
      <SidebarNavItem href="/userinfo/subscription" icon={<CreditCardIcon />}>
        套餐订阅
      </SidebarNavItem>
      <SidebarNavItem href="/userinfo/tokens" icon={<BoltIcon />}>
        Token 余额
      </SidebarNavItem>
      <SidebarNavItem href="/userinfo/referral" icon={<UserGroupIcon />}>
        邀请好友
      </SidebarNavItem>
      <SidebarNavItem href="/userinfo/checkin" icon={<CalendarIcon />}>
        签到领取
      </SidebarNavItem>
    </SidebarNav>
  </Sidebar>

  {/* 右侧：内容区 */}
  <MainContent>
    {children}
  </MainContent>
</UserInfoLayout>
```

#### 子页面设计

**1. 个人信息 (/userinfo/profile)**
```tsx
<ProfilePage>
  <Section>
    <SectionHeader title="基本信息" />
    <Form>
      <FormField label="头像">
        <AvatarUpload value={user.avatar} onChange={handleAvatarChange} />
      </FormField>
      <FormField label="显示名称">
        <Input value={displayName} onChange={setDisplayName} />
      </FormField>
      <FormField label="邮箱">
        <Input value={user.email} disabled />
        <HelpText>邮箱不可修改</HelpText>
      </FormField>
      <FormField label="语言偏好">
        <Select value={language} onChange={setLanguage}>
          <SelectItem value="zh-CN">简体中文</SelectItem>
          <SelectItem value="en">English</SelectItem>
        </Select>
      </FormField>
      <FormField label="时区">
        <TimezoneSelect value={timezone} onChange={setTimezone} />
      </FormField>
    </Form>
    <FormActions>
      <Button variant="outline" onClick={handleReset}>重置</Button>
      <Button onClick={handleSave}>保存更改</Button>
    </FormActions>
  </Section>

  <Section>
    <SectionHeader title="账号安全" />
    <SecuritySettings>
      <SecurityItem
        title="两步验证"
        description="提升账号安全性"
        status={twoFactorEnabled}
        action={
          <Button onClick={handleToggle2FA}>
            {twoFactorEnabled ? '禁用' : '启用'}
          </Button>
        }
      />
      <SecurityItem
        title="登录设备管理"
        description="查看所有登录设备"
        action={
          <Button variant="ghost" onClick={() => setDevicesDialogOpen(true)}>
            查看设备
          </Button>
        }
      />
    </SecuritySettings>
  </Section>

  <Section>
    <SectionHeader title="危险操作" />
    <DangerZone>
      <DangerAction
        title="删除账号"
        description="永久删除账号及所有数据，此操作不可恢复"
        action={
          <Button variant="destructive" onClick={handleDeleteAccount}>
            删除账号
          </Button>
        }
      />
    </DangerZone>
  </Section>
</ProfilePage>
```

**2. 套餐订阅 (/userinfo/subscription)**
```tsx
<SubscriptionPage>
  {/* 当前套餐 */}
  <CurrentPlanCard>
    <PlanName>{subscription.planName}</PlanName>
    <PlanPrice>{subscription.price}/月</PlanPrice>
    <PlanFeatures>
      {subscription.features.map(feature => (
        <FeatureItem key={feature}>
          <CheckIcon /> {feature}
        </FeatureItem>
      ))}
    </PlanFeatures>
    <RenewalInfo>
      下次续费时间：{formatDate(subscription.currentPeriodEnd)}
    </RenewalInfo>
    <Button onClick={() => router.push('/pricing')}>
      升级套餐
    </Button>
  </CurrentPlanCard>

  {/* 账单历史 */}
  <Section>
    <SectionHeader title="账单历史" />
    <InvoicesList>
      {invoices.map(invoice => (
        <InvoiceItem
          key={invoice.id}
          invoice={invoice}
          onDownload={handleDownloadInvoice}
        />
      ))}
    </InvoicesList>
  </Section>

  {/* 支付方式 */}
  <Section>
    <SectionHeader title="支付方式" />
    <PaymentMethods>
      {paymentMethods.map(method => (
        <PaymentMethodCard
          key={method.id}
          method={method}
          onRemove={handleRemovePaymentMethod}
        />
      ))}
      <Button variant="outline" onClick={handleAddPaymentMethod}>
        <PlusIcon /> 添加支付方式
      </Button>
    </PaymentMethods>
  </Section>
</SubscriptionPage>
```

**3. Token 余额 (/userinfo/tokens)**
```tsx
<TokensPage>
  {/* Token 概览 */}
  <TokenOverview>
    <TokenBalanceCard
      balance={tokenBalance}
      todayUsage={todayUsage}
      weeklyTrend={weeklyTrend}
    />
    <QuickRechargeCard
      presets={[100, 500, 1000, 5000]}
      onRecharge={handleRecharge}
    />
  </TokenOverview>

  {/* 消耗趋势 */}
  <Section>
    <SectionHeader title="消耗趋势" />
    <TokenUsageChart data={usageData} period={period} />
  </Section>

  {/* 交易记录 */}
  <Section>
    <SectionHeader title="交易记录" />
    <TransactionsTable transactions={transactions} />
  </Section>
</TokensPage>
```

**4. 邀请好友 (/userinfo/referral)**
```tsx
<ReferralPage>
  {/* 邀请统计 */}
  <ReferralStats>
    <StatCard
      label="邀请人数"
      value={referralStats.totalInvites}
      icon={<UserGroupIcon />}
    />
    <StatCard
      label="已注册"
      value={referralStats.registered}
      icon={<UserCheckIcon />}
    />
    <StatCard
      label="累计奖励"
      value={`${referralStats.totalRewards} Token`}
      icon={<GiftIcon />}
    />
  </ReferralStats>

  {/* 邀请链接 */}
  <Section>
    <SectionHeader title="我的邀请链接" />
    <ReferralLinkCard>
      <Input
        value={referralLink}
        readOnly
        rightElement={
          <Button onClick={handleCopyLink}>
            <ClipboardIcon /> 复制
          </Button>
        }
      />
      <ShareButtons>
        <Button variant="outline" onClick={handleShareTwitter}>
          <TwitterIcon /> Twitter
        </Button>
        <Button variant="outline" onClick={handleShareFacebook}>
          <FacebookIcon /> Facebook
        </Button>
        <Button variant="outline" onClick={handleShareEmail}>
          <EnvelopeIcon /> 邮件
        </Button>
      </ShareButtons>
    </ReferralLinkCard>
  </Section>

  {/* 邀请记录 */}
  <Section>
    <SectionHeader title="邀请记录" />
    <ReferralsList>
      {referrals.map(referral => (
        <ReferralItem
          key={referral.id}
          referral={referral}
        />
      ))}
    </ReferralsList>
  </Section>

  {/* 奖励规则 */}
  <Section>
    <SectionHeader title="奖励规则" />
    <RulesCard>
      <RuleItem>
        <CheckCircleIcon /> 好友通过您的链接注册，您获得 100 Token
      </RuleItem>
      <RuleItem>
        <CheckCircleIcon /> 好友首次充值，您额外获得其充值金额 10% 的 Token
      </RuleItem>
      <RuleItem>
        <CheckCircleIcon /> 无上限，邀请越多奖励越多
      </RuleItem>
    </RulesCard>
  </Section>
</ReferralPage>
```

**5. 签到领取 (/userinfo/checkin)**
```tsx
<CheckinPage>
  {/* 今日签到 */}
  <CheckinCard>
    {todayCheckedIn ? (
      <div>
        <CheckCircleIcon className="text-green-500" />
        <div>今日已签到</div>
        <div>获得 {todayReward} Token</div>
      </div>
    ) : (
      <Button size="lg" onClick={handleCheckin}>
        立即签到
      </Button>
    )}
  </CheckinCard>

  {/* 签到日历 */}
  <Section>
    <SectionHeader title="签到日历" />
    <CheckinCalendar
      month={currentMonth}
      checkinDays={checkinDays}
      onMonthChange={setCurrentMonth}
    />
  </Section>

  {/* 连续签到奖励 */}
  <Section>
    <SectionHeader title="连续签到奖励" />
    <StreakRewardsCard>
      <StreakProgress current={streak} max={30} />
      <RewardsList>
        {streakRewards.map(reward => (
          <RewardItem
            key={reward.days}
            days={reward.days}
            reward={reward.tokens}
            claimed={streak >= reward.days}
          />
        ))}
      </RewardsList>
    </StreakRewardsCard>
  </Section>

  {/* 签到记录 */}
  <Section>
    <SectionHeader title="签到记录" />
    <CheckinHistory records={checkinHistory} />
  </Section>
</CheckinPage>
```

---

## 三、导航系统设计

### 3.1 顶部导航栏（全局）

#### 未登录状态
```tsx
<Header>
  <Logo href="/">
    <LogoImage />
    <LogoText>AutoAds</LogoText>
  </Logo>

  <MainNav>
    <NavItem href="/pricing">定价</NavItem>
    <NavItem href="/about">关于</NavItem>
    <NavItem href="/blog">博客</NavItem>
    <NavItem href="/docs">文档</NavItem>
  </MainNav>

  <RightActions>
    {/* 语言切换 */}
    <LanguageSwitcher>
      <Select value={language} onChange={setLanguage}>
        <SelectTrigger className="w-24">
          <GlobeIcon />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="zh-CN">
            <Flag code="CN" /> 中文
          </SelectItem>
          <SelectItem value="en">
            <Flag code="US" /> English
          </SelectItem>
        </SelectContent>
      </Select>
    </LanguageSwitcher>

    {/* 主题切换 */}
    <ThemeSwitcher>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <SunIcon className="dark:hidden" />
            <MoonIcon className="hidden dark:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setTheme('light')}>
            <SunIcon /> 浅色
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')}>
            <MoonIcon /> 深色
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('system')}>
            <ComputerDesktopIcon /> 系统
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ThemeSwitcher>

    {/* CTA 按钮 */}
    <Button
      variant="default"
      onClick={() => router.push('/auth')}
    >
      开始使用
    </Button>
  </RightActions>
</Header>
```

#### 已登录状态
```tsx
<Header>
  <Logo href="/dashboard">
    <LogoImage />
    <LogoText>AutoAds</LogoText>
  </Logo>

  <MainNav>
    <NavItem href="/dashboard" icon={<HomeIcon />} active>
      大盘
    </NavItem>
    <NavItem href="/offers" icon={<DocumentTextIcon />}>
      Offer库
      {pendingOffersCount > 0 && <Badge>{pendingOffersCount}</Badge>}
    </NavItem>
    <NavItem href="/adscenter" icon={<MegaphoneIcon />}>
      Ads中心
      {needSyncCount > 0 && <Badge variant="warning">{needSyncCount}</Badge>}
    </NavItem>
    <NavItem href="/tasks" icon={<ClipboardDocumentCheckIcon />}>
      任务中心
      {runningTasksCount > 0 && <Badge variant="blue">{runningTasksCount}</Badge>}
    </NavItem>
  </MainNav>

  <RightActions>
    {/* 通知中心 */}
    <NotificationButton
      unreadCount={unreadNotifications}
      onClick={() => setNotificationsPanelOpen(true)}
    />

    {/* 语言切换 */}
    <LanguageSwitcher />

    {/* 主题切换 */}
    <ThemeSwitcher />

    {/* 用户菜单 */}
    <UserMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <Avatar src={user.avatar} size="sm" />
            <span>{user.displayName}</span>
            <ChevronDownIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-semibold">{user.displayName}</span>
              <span className="text-xs text-muted-foreground">{user.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/userinfo')}>
            <UserIcon /> 个人中心
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/userinfo/tokens')}>
            <BoltIcon /> Token 余额
            <Badge variant="outline" className="ml-auto">
              {tokenBalance}
            </Badge>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/userinfo/subscription')}>
            <CreditCardIcon /> 套餐订阅
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/docs')}>
            <BookOpenIcon /> 帮助文档
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFeedbackDialogOpen(true)}>
            <ChatBubbleBottomCenterTextIcon /> 反馈建议
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
            <ArrowRightOnRectangleIcon /> 退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </UserMenu>
  </RightActions>
</Header>
```

### 3.2 移动端导航

```tsx
{/* 移动端底部导航栏 */}
<MobileBottomNav className="md:hidden">
  <MobileNavItem href="/dashboard" icon={<HomeIcon />} label="大盘" />
  <MobileNavItem
    href="/offers"
    icon={<DocumentTextIcon />}
    label="Offer库"
    badge={pendingOffersCount}
  />
  <MobileNavItem href="/adscenter" icon={<MegaphoneIcon />} label="Ads中心" />
  <MobileNavItem href="/tasks" icon={<ClipboardDocumentCheckIcon />} label="任务" />
  <MobileNavItem href="/userinfo" icon={<UserIcon />} label="我的" />
</MobileBottomNav>
```

---

## 四、新用户引导流程 (Onboarding)

### 4.1 流程设计

```
新用户登录（Google OAuth）
  ↓
检测 `user.onboardingCompleted === false`
  ↓
弹出欢迎 Modal
  ↓
Step 1: 创建首个 Offer
  - 输入落地页 URL
  - 自动抓取名称（可编辑）
  - 选择分类（可选）
  ↓
Step 2: 启动评估
  - 显示评估进度条
  - 实时显示评估状态
  ↓
Step 3: 连接广告账号（可跳过）
  - OAuth 授权 Google Ads
  - 自动同步账号信息
  ↓
完成引导
  - 更新 `user.onboardingCompleted = true`
  - 跳转到 Dashboard
  - 显示首个 Offer 的评估结果
```

### 4.2 UI 实现

```tsx
<OnboardingWizard>
  <WizardContainer>
    {/* 进度指示器 */}
    <WizardProgress>
      <ProgressStep active={step === 1} completed={step > 1}>
        1. 创建 Offer
      </ProgressStep>
      <ProgressStep active={step === 2} completed={step > 2}>
        2. 启动评估
      </ProgressStep>
      <ProgressStep active={step === 3} completed={step > 3}>
        3. 连接账号
      </ProgressStep>
    </WizardProgress>

    {/* Step 1: 创建 Offer */}
    {step === 1 && (
      <WizardStep>
        <StepTitle>创建您的第一个 Offer</StepTitle>
        <StepDescription>
          输入落地页 URL，我们将自动评估其质量
        </StepDescription>
        <Form onSubmit={handleCreateOffer}>
          <FormField label="落地页 URL" required>
            <Input
              type="url"
              placeholder="https://example.com/landing-page"
              value={offerUrl}
              onChange={setOfferUrl}
              autoFocus
            />
          </FormField>
          <FormField label="Offer 名称" description="自动从网页标题提取，可修改">
            <Input
              value={offerName}
              onChange={setOfferName}
              placeholder="正在加载..."
            />
          </FormField>
          <FormField label="分类" description="可选，有助于后续管理">
            <Select value={offerCategory} onChange={setOfferCategory}>
              <SelectItem value="">不选择</SelectItem>
              <SelectItem value="ecommerce">电商</SelectItem>
              <SelectItem value="gaming">游戏</SelectItem>
              <SelectItem value="finance">金融</SelectItem>
              <SelectItem value="other">其他</SelectItem>
            </Select>
          </FormField>
          <WizardActions>
            <Button variant="outline" onClick={handleSkipOnboarding}>
              跳过引导
            </Button>
            <Button type="submit" disabled={!offerUrl || creating}>
              {creating ? <Spinner /> : '下一步'}
            </Button>
          </WizardActions>
        </Form>
      </WizardStep>
    )}

    {/* Step 2: 启动评估 */}
    {step === 2 && (
      <WizardStep>
        <StepTitle>正在评估 Offer</StepTitle>
        <StepDescription>
          系统正在分析落地页质量，通常需要 30-60 秒
        </StepDescription>
        <EvaluationProgress>
          <ProgressBar value={evaluationProgress} max={100} />
          <ProgressLabel>{evaluationProgress}% 完成</ProgressLabel>
          <StatusMessage>{evaluationStatus}</StatusMessage>
        </EvaluationProgress>
        {evaluationCompleted && (
          <>
            <EvaluationResult>
              <ScoreCircle score={evaluationResult.score} size="large" />
              <ResultText>
                评估完成！您的 Offer 得分为 {evaluationResult.score}/100
              </ResultText>
            </EvaluationResult>
            <WizardActions>
              <Button variant="outline" onClick={handleSkipConnectAccount}>
                跳过连接账号
              </Button>
              <Button onClick={() => setStep(3)}>
                下一步：连接广告账号
              </Button>
            </WizardActions>
          </>
        )}
      </WizardStep>
    )}

    {/* Step 3: 连接广告账号 */}
    {step === 3 && (
      <WizardStep>
        <StepTitle>连接广告账号</StepTitle>
        <StepDescription>
          连接 Google Ads 账号，开始自动化投放（可稍后设置）
        </StepDescription>
        <ConnectAccountOptions>
          <ConnectAccountCard
            platform="google"
            title="Google Ads"
            description="全球最大的搜索广告平台"
            icon={<GoogleIcon />}
            onClick={handleConnectGoogle}
          />
          <ConnectAccountCard
            platform="facebook"
            title="Facebook Ads"
            description="社交媒体广告投放"
            icon={<FacebookIcon />}
            disabled
            comingSoon
          />
          <ConnectAccountCard
            platform="tiktok"
            title="TikTok Ads"
            description="短视频广告投放"
            icon={<TikTokIcon />}
            disabled
            comingSoon
          />
        </ConnectAccountOptions>
        <WizardActions>
          <Button variant="outline" onClick={handleFinishOnboarding}>
            稍后设置
          </Button>
          <Button onClick={handleConnectGoogle} disabled={connecting}>
            {connecting ? <Spinner /> : '连接 Google Ads'}
          </Button>
        </WizardActions>
      </WizardStep>
    )}

    {/* 完成页 */}
    {step === 4 && (
      <WizardStep>
        <CompletionAnimation>
          <CheckCircleIcon className="text-green-500 h-24 w-24" />
        </CompletionAnimation>
        <StepTitle>恭喜！设置完成</StepTitle>
        <StepDescription>
          您已成功创建首个 Offer 并完成评估，现在可以开始使用 AutoAds 了
        </StepDescription>
        <WizardActions>
          <Button size="lg" onClick={handleGoToDashboard}>
            前往大盘
          </Button>
        </WizardActions>
      </WizardStep>
    )}
  </WizardContainer>
</OnboardingWizard>
```

### 4.3 后端支持

```typescript
// API: POST /api/onboarding/create-first-offer
interface CreateFirstOfferRequest {
  url: string;
  name?: string;
  category?: string;
}

interface CreateFirstOfferResponse {
  offerId: string;
  evaluationTaskId: string;
  status: 'created' | 'evaluating';
}

// API: GET /api/onboarding/evaluation-status/:taskId
interface EvaluationStatusResponse {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  result?: {
    score: number;
    dimensions: Array<{
      name: string;
      score: number;
    }>;
  };
}

// API: POST /api/onboarding/complete
interface CompleteOnboardingRequest {
  offerId: string;
  connectedAccount?: boolean;
}

interface CompleteOnboardingResponse {
  success: boolean;
  redirectTo: string; // '/dashboard'
}
```

---

## 五、组件复用策略

### 5.1 Makerkit 组件映射

**直接复用的 Makerkit 组件**:
- ✅ `Button` - 按钮
- ✅ `Input` - 输入框
- ✅ `Select` - 下拉选择
- ✅ `Dialog` / `Modal` - 对话框
- ✅ `Tabs` - 标签页
- ✅ `Table` - 表格
- ✅ `Card` - 卡片
- ✅ `Avatar` - 头像
- ✅ `Badge` - 徽章
- ✅ `Checkbox` - 复选框
- ✅ `Switch` - 开关
- ✅ `Slider` - 滑块
- ✅ `Alert` - 提示框
- ✅ `Toast` / `Toaster` - 通知
- ✅ `Spinner` - 加载动画
- ✅ `DropdownMenu` - 下拉菜单
- ✅ `Tooltip` - 工具提示
- ✅ `Separator` - 分隔线

**需要扩展的组件**:
- 🔧 `AppHeader` - 增加右侧操作按钮区域
- 🔧 `PageBody` - 增加内边距选项
- 🔧 `Section` - 增加折叠/展开功能
- 🔧 `SectionHeader` - 增加角标和操作按钮

**需要新建的组件**:

#### KPI 卡片组件
```tsx
// components/dashboard/KPICard.tsx
interface KPICardProps {
  title: string;
  value: string | number;
  trend?: {
    value: number;
    direction: 'up' | 'down';
    period?: string;
  };
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'indigo';
  status?: 'success' | 'warning' | 'error';
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClick?: () => void;
}

export function KPICard({
  title,
  value,
  trend,
  icon,
  color = 'blue',
  status,
  subtitle,
  action,
  onClick,
}: KPICardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-lg',
        onClick && 'hover:scale-105'
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            <p className="mt-2 text-3xl font-bold">{value}</p>
            {trend && (
              <div className="mt-2 flex items-center gap-1 text-sm">
                {trend.direction === 'up' ? (
                  <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
                )}
                <span
                  className={cn(
                    'font-medium',
                    trend.direction === 'up' ? 'text-green-500' : 'text-red-500'
                  )}
                >
                  {Math.abs(trend.value)}%
                </span>
                {trend.period && (
                  <span className="text-muted-foreground">{trend.period}</span>
                )}
              </div>
            )}
          </div>
          {icon && (
            <div className={cn('rounded-lg p-3', `bg-${color}-100 text-${color}-600`)}>
              {icon}
            </div>
          )}
        </div>
        {action && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-4 w-full"
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
            }}
          >
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

#### 快捷操作卡片
```tsx
// components/dashboard/ActionCard.tsx
interface ActionCardProps {
  variant: 'urgent' | 'normal' | 'low';
  title: string;
  description: string;
  count?: number;
  icon: React.ReactNode;
  cta: string;
  onClick: () => void;
}

export function ActionCard({
  variant,
  title,
  description,
  count,
  icon,
  cta,
  onClick,
}: ActionCardProps) {
  const variantStyles = {
    urgent: 'border-red-500 bg-red-50 dark:bg-red-950',
    normal: 'border-blue-500 bg-blue-50 dark:bg-blue-950',
    low: 'border-gray-300 bg-gray-50 dark:bg-gray-900',
  };

  return (
    <Card className={cn('border-l-4', variantStyles[variant])}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-gray-800">
            {icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{title}</h3>
              {count !== undefined && (
                <Badge variant={variant === 'urgent' ? 'destructive' : 'default'}>
                  {count}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            <Button
              variant={variant === 'urgent' ? 'default' : 'outline'}
              size="sm"
              className="mt-4"
              onClick={onClick}
            >
              {cta}
              <ChevronRightIcon className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 评分显示组件
```tsx
// components/offers/ScoreDisplay.tsx
interface ScoreDisplayProps {
  score: number | null;
  max?: number;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreDisplay({
  score,
  max = 100,
  showProgress = false,
  size = 'md',
}: ScoreDisplayProps) {
  if (score === null) {
    return <span className="text-muted-foreground">--</span>;
  }

  const percentage = (score / max) * 100;
  const color = getScoreColor(percentage);

  const sizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl',
  };

  return (
    <div className="flex items-center gap-2">
      <span className={cn('font-semibold', sizeStyles[size], `text-${color}-600`)}>
        {score}
      </span>
      {showProgress && (
        <Progress value={percentage} max={100} className="w-20" />
      )}
    </div>
  );
}

function getScoreColor(percentage: number): string {
  if (percentage >= 80) return 'green';
  if (percentage >= 60) return 'blue';
  if (percentage >= 40) return 'amber';
  return 'red';
}
```

#### 状态徽章组件
```tsx
// components/offers/StatusBadge.tsx
interface StatusBadgeProps {
  status: OfferStatus;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<OfferStatus, {
  label: string;
  variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive';
  icon?: React.ReactNode;
}> = {
  pending_evaluation: {
    label: '待评估',
    variant: 'warning',
    icon: <ClockIcon className="h-3 w-3" />,
  },
  evaluating: {
    label: '评估中',
    variant: 'default',
    icon: <ArrowPathIcon className="h-3 w-3 animate-spin" />,
  },
  ready_to_deploy: {
    label: '可投放',
    variant: 'success',
    icon: <CheckCircleIcon className="h-3 w-3" />,
  },
  deployed: {
    label: '已投放',
    variant: 'secondary',
    icon: <RocketLaunchIcon className="h-3 w-3" />,
  },
  evaluation_failed: {
    label: '评估失败',
    variant: 'destructive',
    icon: <XCircleIcon className="h-3 w-3" />,
  },
  archived: {
    label: '已归档',
    variant: 'secondary',
    icon: <ArchiveBoxIcon className="h-3 w-3" />,
  },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant={config.variant} className={cn(size === 'sm' && 'text-xs')}>
      {config.icon}
      <span className="ml-1">{config.label}</span>
    </Badge>
  );
}
```

---

## 六、SEO 优化方案

### 6.1 Meta 标签优化

```tsx
// app/(site)/layout.tsx
export const metadata: Metadata = {
  title: {
    default: 'AutoAds - AI 驱动的多渠道广告自动化平台',
    template: '%s | AutoAds',
  },
  description: 'AutoAds 提供智能落地页评估、多渠道广告管理和自动化投放策略，帮助广告主提升 ROAS 300%，节省 40% 人工审核时间。',
  keywords: [
    'AutoAds',
    '广告自动化',
    '落地页评估',
    'Google Ads',
    'Facebook Ads',
    'TikTok Ads',
    'ROAS 优化',
    'AI 广告',
    '多渠道广告',
    '广告投放',
  ],
  authors: [{ name: 'AutoAds Team' }],
  creator: 'AutoAds',
  publisher: 'AutoAds',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://www.autoads.dev'),
  alternates: {
    canonical: '/',
    languages: {
      'zh-CN': '/zh-CN',
      'en-US': '/en',
    },
  },
  openGraph: {
    title: 'AutoAds - AI 驱动的多渠道广告自动化平台',
    description: '智能落地页评估、多渠道广告管理和自动化投放策略',
    url: 'https://www.autoads.dev',
    siteName: 'AutoAds',
    images: [
      {
        url: 'https://www.autoads.dev/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AutoAds Platform',
      },
    ],
    locale: 'zh_CN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AutoAds - AI 驱动的多渠道广告自动化平台',
    description: '智能落地页评估、多渠道广告管理和自动化投放策略',
    images: ['https://www.autoads.dev/twitter-image.png'],
    creator: '@AutoAds',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};
```

### 6.2 结构化数据 (JSON-LD)

```tsx
// components/seo/StructuredData.tsx
export function OrganizationStructuredData() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AutoAds',
    url: 'https://www.autoads.dev',
    logo: 'https://www.autoads.dev/logo.png',
    description: 'AI 驱动的多渠道广告自动化平台',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@autoads.dev',
      contactType: 'Customer Service',
      availableLanguage: ['Chinese', 'English'],
    },
    sameAs: [
      'https://twitter.com/AutoAds',
      'https://github.com/autoads-dev',
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

export function SoftwareApplicationStructuredData() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AutoAds',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'PriceSpecification',
        price: '0',
        priceCurrency: 'USD',
        billingDuration: 'P1M',
        name: 'Free Plan',
      },
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '120',
    },
    featureList: [
      '智能落地页评估',
      '多渠道广告管理',
      '自动化投放策略',
      'ROAS 优化',
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
```

### 6.3 Sitemap 生成

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.autoads.dev';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
      alternates: {
        languages: {
          'zh-CN': `${baseUrl}/zh-CN`,
          'en': `${baseUrl}/en`,
        },
      },
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: {
          'zh-CN': `${baseUrl}/zh-CN/pricing`,
          'en': `${baseUrl}/en/pricing`,
        },
      },
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.6,
    },
  ];
}
```

### 6.4 Robots.txt

```typescript
// app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/offers/', '/adscenter/', '/tasks/', '/userinfo/'],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/offers/', '/adscenter/', '/tasks/', '/userinfo/'],
        crawlDelay: 0,
      },
    ],
    sitemap: 'https://www.autoads.dev/sitemap.xml',
  };
}
```

### 6.5 性能优化（影响 SEO）

**图片优化**:
```tsx
// 使用 Next.js Image 组件
<Image
  src="/assets/images/dashboard-dark.webp"
  alt="AutoAds Dashboard"
  width={1200}
  height={630}
  priority // 首屏图片
  placeholder="blur" // 模糊占位符
/>
```

**代码分割**:
```tsx
// 动态导入非首屏组件
const DashboardDemo = dynamic(() => import('./components/DashboardDemo'), {
  ssr: false,
  loading: () => <Spinner />,
});
```

**字体优化**:
```tsx
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});
```

---

## 七、中英双语国际化

### 7.1 语言文件结构

```
apps/frontend/public/locales/
├── zh-CN/
│   ├── common.json
│   ├── dashboard.json
│   ├── offers.json
│   ├── adscenter.json
│   ├── tasks.json
│   ├── userinfo.json
│   ├── auth.json
│   ├── pricing.json
│   └── errors.json
└── en/
    ├── common.json
    ├── dashboard.json
    ├── offers.json
    ├── adscenter.json
    ├── tasks.json
    ├── userinfo.json
    ├── auth.json
    ├── pricing.json
    └── errors.json
```

### 7.2 核心翻译文件

#### zh-CN/dashboard.json
```json
{
  "title": "大盘",
  "description": "一览您的业务运营数据",
  "kpi": {
    "totalOffers": "Offer 总数",
    "evaluationSuccessRate": "评估成功率",
    "connectedAccounts": "已连接账号",
    "totalSpend": "累计花费",
    "tokenBalance": "Token 余额"
  },
  "actions": {
    "offersToEvaluate": "{{count}} 个 Offer 待评估",
    "accountsToSync": "{{count}} 个账号需要同步",
    "tasksRunning": "{{count}} 个任务正在执行",
    "viewAll": "查看全部"
  },
  "charts": {
    "evaluationTrend": "Offer 评估趋势",
    "spendTrend": "广告花费趋势",
    "tokenUsage": "Token 消耗分布",
    "topOffers": "Top 10 Offers"
  },
  "activity": {
    "title": "最新活动",
    "offerCreated": "创建了 Offer",
    "offerEvaluated": "评估完成",
    "accountConnected": "连接了广告账号",
    "taskCompleted": "任务完成"
  },
  "notifications": {
    "title": "消息通知",
    "markAllAsRead": "标记全部已读"
  },
  "risks": {
    "title": "风险提醒",
    "tokenLow": "Token 余额不足，建议充值",
    "accountExpired": "广告账号授权已过期，需要重新授权",
    "evaluationFailed": "部分 Offer 评估失败，请检查"
  }
}
```

#### en/dashboard.json
```json
{
  "title": "Dashboard",
  "description": "Overview of your business operations",
  "kpi": {
    "totalOffers": "Total Offers",
    "evaluationSuccessRate": "Evaluation Success Rate",
    "connectedAccounts": "Connected Accounts",
    "totalSpend": "Total Spend",
    "tokenBalance": "Token Balance"
  },
  "actions": {
    "offersToEvaluate": "{{count}} offer(s) to evaluate",
    "accountsToSync": "{{count}} account(s) need sync",
    "tasksRunning": "{{count}} task(s) running",
    "viewAll": "View All"
  },
  "charts": {
    "evaluationTrend": "Offer Evaluation Trend",
    "spendTrend": "Ad Spend Trend",
    "tokenUsage": "Token Usage Distribution",
    "topOffers": "Top 10 Offers"
  },
  "activity": {
    "title": "Recent Activity",
    "offerCreated": "Created Offer",
    "offerEvaluated": "Evaluation Completed",
    "accountConnected": "Connected Ad Account",
    "taskCompleted": "Task Completed"
  },
  "notifications": {
    "title": "Notifications",
    "markAllAsRead": "Mark All as Read"
  },
  "risks": {
    "title": "Risk Alerts",
    "tokenLow": "Low token balance, recharge recommended",
    "accountExpired": "Ad account authorization expired, re-authorization required",
    "evaluationFailed": "Some offers failed evaluation, please check"
  }
}
```

#### zh-CN/offers.json
```json
{
  "title": "Offer 库",
  "description": "管理所有落地页，评估质量，关联广告账号",
  "actions": {
    "create": "新建 Offer",
    "bulkImport": "批量导入",
    "bulkEvaluate": "批量评估",
    "assignAccount": "关联账号",
    "export": "导出",
    "delete": "删除"
  },
  "filters": {
    "allStatuses": "全部状态",
    "pendingEvaluation": "待评估",
    "evaluating": "评估中",
    "readyToDeploy": "可投放",
    "deployed": "已投放",
    "evaluationFailed": "评估失败",
    "archived": "已归档",
    "scoreRange": "评分范围",
    "allCategories": "全部分类",
    "search": "搜索 URL 或名称"
  },
  "table": {
    "name": "Offer 名称",
    "status": "状态",
    "score": "评分",
    "category": "分类",
    "adsAccount": "关联账号",
    "createdAt": "创建时间",
    "actions": "操作"
  },
  "detail": {
    "tabs": {
      "overview": "概览",
      "evaluation": "评估结果",
      "ads": "广告关联",
      "history": "历史记录"
    },
    "overview": {
      "offerId": "Offer ID",
      "name": "名称",
      "url": "URL",
      "category": "分类",
      "status": "状态",
      "createdAt": "创建时间",
      "updatedAt": "更新时间",
      "preview": "页面预览"
    },
    "evaluation": {
      "totalScore": "综合评分",
      "detailScore": "详细评分",
      "risks": "风险提示",
      "noResult": "暂无评估结果",
      "startEvaluation": "启动评估"
    },
    "ads": {
      "noAccount": "未关联广告账号",
      "connectAccount": "关联账号",
      "unlinkAccount": "解除关联",
      "campaigns": "广告活动"
    }
  },
  "bulkImport": {
    "title": "批量导入 Offers",
    "description": "上传 CSV 文件，快速导入多个落地页",
    "templateFormat": "模板格式",
    "downloadTemplate": "下载模板",
    "preview": "预览数据（前 5 条）",
    "totalRecords": "共 {{count}} 条记录",
    "startImport": "开始导入"
  }
}
```

#### en/offers.json
```json
{
  "title": "Offer Library",
  "description": "Manage all landing pages, evaluate quality, and link ad accounts",
  "actions": {
    "create": "Create Offer",
    "bulkImport": "Bulk Import",
    "bulkEvaluate": "Bulk Evaluate",
    "assignAccount": "Assign Account",
    "export": "Export",
    "delete": "Delete"
  },
  "filters": {
    "allStatuses": "All Statuses",
    "pendingEvaluation": "Pending Evaluation",
    "evaluating": "Evaluating",
    "readyToDeploy": "Ready to Deploy",
    "deployed": "Deployed",
    "evaluationFailed": "Evaluation Failed",
    "archived": "Archived",
    "scoreRange": "Score Range",
    "allCategories": "All Categories",
    "search": "Search URL or Name"
  },
  "table": {
    "name": "Offer Name",
    "status": "Status",
    "score": "Score",
    "category": "Category",
    "adsAccount": "Ad Account",
    "createdAt": "Created At",
    "actions": "Actions"
  },
  "detail": {
    "tabs": {
      "overview": "Overview",
      "evaluation": "Evaluation Result",
      "ads": "Ad Links",
      "history": "History"
    },
    "overview": {
      "offerId": "Offer ID",
      "name": "Name",
      "url": "URL",
      "category": "Category",
      "status": "Status",
      "createdAt": "Created At",
      "updatedAt": "Updated At",
      "preview": "Page Preview"
    },
    "evaluation": {
      "totalScore": "Total Score",
      "detailScore": "Detailed Score",
      "risks": "Risk Alerts",
      "noResult": "No evaluation result",
      "startEvaluation": "Start Evaluation"
    },
    "ads": {
      "noAccount": "No ad account linked",
      "connectAccount": "Connect Account",
      "unlinkAccount": "Unlink Account",
      "campaigns": "Campaigns"
    }
  },
  "bulkImport": {
    "title": "Bulk Import Offers",
    "description": "Upload CSV file to quickly import multiple landing pages",
    "templateFormat": "Template Format",
    "downloadTemplate": "Download Template",
    "preview": "Preview Data (First 5 rows)",
    "totalRecords": "Total {{count}} record(s)",
    "startImport": "Start Import"
  }
}
```

### 7.3 使用 Trans 组件

```tsx
import Trans from '~/core/ui/Trans';

<Trans i18nKey="dashboard:kpi.totalOffers" />
// 输出（中文）: Offer 总数
// 输出（英文）: Total Offers

<Trans
  i18nKey="dashboard:actions.offersToEvaluate"
  values={{ count: 5 }}
/>
// 输出（中文）: 5 个 Offer 待评估
// 输出（英文）: 5 offer(s) to evaluate
```

### 7.4 语言切换实现

```tsx
// components/LanguageSwitcher.tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { GlobeIcon } from '@heroicons/react/24/outline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';

const LANGUAGES = [
  { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (newLang: string) => {
    // 更新 i18n 语言
    i18n.changeLanguage(newLang);

    // 更新 Cookie
    document.cookie = `NEXT_LOCALE=${newLang}; path=/; max-age=31536000`;

    // 刷新页面以应用新语言
    router.refresh();
  };

  return (
    <Select value={i18n.language} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-32">
        <GlobeIcon className="h-4 w-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            <span className="mr-2">{lang.flag}</span>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

---

## 八、视觉设计系统

### 8.1 颜色系统

```css
/* 基于 Tailwind 扩展 */
:root {
  /* 主色调 - 品牌蓝 */
  --color-primary-50: #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-200: #bfdbfe;
  --color-primary-300: #93c5fd;
  --color-primary-400: #60a5fa;
  --color-primary-500: #3b82f6; /* 主色 */
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
  --color-primary-800: #1e40af;
  --color-primary-900: #1e3a8a;

  /* 成功色 - 绿色 */
  --color-success-500: #10b981;

  /* 警告色 - 黄色 */
  --color-warning-500: #f59e0b;

  /* 错误色 - 红色 */
  --color-error-500: #ef4444;

  /* 信息色 - 蓝色 */
  --color-info-500: #3b82f6;

  /* 灰度 */
  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-300: #d1d5db;
  --color-gray-400: #9ca3af;
  --color-gray-500: #6b7280;
  --color-gray-600: #4b5563;
  --color-gray-700: #374151;
  --color-gray-800: #1f2937;
  --color-gray-900: #111827;
}

/* 深色模式 */
.dark {
  --color-background: #0a0a0a;
  --color-foreground: #fafafa;
  --color-muted: #1f2937;
  --color-muted-foreground: #9ca3af;
}
```

### 8.2 间距系统

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
    },
  },
};
```

### 8.3 排版系统

```css
/* 标题 */
.heading-1 { @apply text-4xl font-bold tracking-tight; }
.heading-2 { @apply text-3xl font-semibold tracking-tight; }
.heading-3 { @apply text-2xl font-semibold; }
.heading-4 { @apply text-xl font-semibold; }
.heading-5 { @apply text-lg font-medium; }

/* 正文 */
.body-lg { @apply text-lg leading-relaxed; }
.body-base { @apply text-base leading-normal; }
.body-sm { @apply text-sm leading-normal; }
.body-xs { @apply text-xs leading-tight; }

/* 特殊 */
.caption { @apply text-xs text-muted-foreground; }
.label { @apply text-sm font-medium; }
.code { @apply font-mono text-sm bg-muted px-1 py-0.5 rounded; }
```

### 8.4 阴影系统

```css
.shadow-card { box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1); }
.shadow-hover { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); }
.shadow-dialog { box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1); }
```

### 8.5 动画系统

```css
/* 淡入 */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 滑入 */
@keyframes slide-in-from-top {
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* 缩放 */
@keyframes scale-in {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* 使用 */
.animate-fade-in { animation: fade-in 0.2s ease-out; }
.animate-slide-in { animation: slide-in-from-top 0.3s ease-out; }
.animate-scale-in { animation: scale-in 0.2s ease-out; }
```

---

## 九、实施路线图

### Phase 1: 基础架构 (第 1-2 周)

#### Week 1
- [ ] **路由重构**
  - 隐藏组织概念，简化 URL
  - 中间件自动注入组织上下文
  - 更新所有内部链接

- [ ] **导航系统**
  - 实现顶部导航栏（未登录/已登录状态）
  - 实现移动端底部导航
  - 集成语言切换和主题切换

- [ ] **组件库准备**
  - 创建 KPICard 组件
  - 创建 ActionCard 组件
  - 创建 ScoreDisplay 组件
  - 创建 StatusBadge 组件

#### Week 2
- [ ] **国际化配置**
  - 创建中英文翻译文件
  - 配置 i18n 路由
  - 实现 LanguageSwitcher 组件

- [ ] **SEO 优化**
  - 配置 Meta 标签
  - 添加结构化数据
  - 生成 Sitemap 和 Robots.txt

### Phase 2: 核心页面开发 (第 3-5 周)

#### Week 3
- [ ] **Dashboard 页面**
  - KPI 卡片区域
  - 待办任务流
  - 数据趋势图表（集成 Recharts）
  - 活动时间线
  - 通知中心

#### Week 4
- [ ] **Offers 页面增强**
  - 批量导入功能
  - Offer 详情对话框（多标签页）
  - 状态流转可视化
  - 评分展示优化

- [ ] **Ads Center 页面增强**
  - 策略模板市场
  - 账号详情对话框
  - 执行报告图表

#### Week 5
- [ ] **Tasks 页面增强**
  - Token 概览卡片
  - 任务类型筛选
  - 任务详情对话框
  - 日志下载功能

- [ ] **个人中心页面**
  - 侧边栏导航
  - 个人信息页面
  - 套餐订阅页面
  - Token 余额页面
  - 邀请好友页面
  - 签到领取页面

### Phase 3: 新用户体验 (第 6 周)

#### Week 6
- [ ] **Onboarding 流程**
  - 引导向导 UI
  - Step 1: 创建首个 Offer
  - Step 2: 启动评估（实时进度）
  - Step 3: 连接广告账号

- [ ] **空状态设计**
  - 无 Offers 时的引导
  - 无账号连接时的引导
  - 无任务时的占位符

### Phase 4: 视觉与细节 (第 7-8 周)

#### Week 7
- [ ] **官网页面重构**
  - 首页重写（突出业务价值）
  - Pricing 页面合并 FAQ
  - About 页面优化

- [ ] **视觉设计系统**
  - 颜色系统文档
  - 排版系统文档
  - 组件库文档

#### Week 8
- [ ] **移动端适配**
  - 表格转卡片视图
  - 操作抽屉 (Drawer)
  - 触摸优化

- [ ] **性能优化**
  - 图片优化（WebP格式）
  - 代码分割
  - Lighthouse 评分 >90

### Phase 5: 测试与发布 (第 9 周)

#### Week 9
- [ ] **全面测试**
  - 功能测试（所有页面）
  - 中英文翻译检查
  - SEO 测试（Google Search Console）
  - 性能测试（Lighthouse）
  - 移动端测试

- [ ] **文档完善**
  - 用户使用文档
  - 开发者文档
  - API 文档

- [ ] **正式发布**
  - 部署到生产环境
  - 监控错误和性能
  - 收集用户反馈

---

## 十、关键指标 (KPI)

### 用户体验指标
- **新用户完成 Onboarding 比例**: 目标 >70%
- **Dashboard 跳出率**: 目标 <20%
- **页面间转化率**: Dashboard → Offers → Ads Center 目标 >50%

### 性能指标
- **首屏加载时间 (FCP)**: <1.5s
- **最大内容绘制 (LCP)**: <2.5s
- **累积布局偏移 (CLS)**: <0.1
- **Lighthouse 评分**: >90

### SEO 指标
- **Google 收录页面数**: 目标 100% 公开页面
- **搜索排名**: "广告自动化平台" 前 10 名
- **有机搜索流量**: 月增长 >20%

### 业务指标
- **日活用户 (DAU)**: 跟踪登录用户数
- **Offer 创建量**: 平均每用户每周 >5 个
- **广告账号连接率**: >60% 用户完成 OAuth 授权
- **Token 消耗速率**: 平均每用户每日 >100 Token

---

## 十一、总结

本方案从**专业前端设计师和用户体验师**的角度，全面重构了 AutoAds 平台的前端页面，核心亮点包括：

### 架构优化
1. ✅ **简化 URL 路由** - 隐藏组织概念，降低用户认知负担
2. ✅ **统一导航系统** - 清晰的信息架构，支持动态角标提示
3. ✅ **组件复用策略** - 最大化利用 Makerkit，避免重复造轮子

### 核心页面
1. ✅ **Dashboard 大盘** - 3秒了解业务状态，1次点击触达高频操作
2. ✅ **Offers 库** - 批量操作、详细评估结果、广告账号关联
3. ✅ **Ads 中心** - OAuth 授权、策略模板、执行报告
4. ✅ **任务中心** - Token 消耗透明化、任务状态实时跟踪
5. ✅ **个人中心** - 统一管理个人信息、订阅、邀请、签到

### 用户体验
1. ✅ **新用户 Onboarding** - 3步引导（创建 Offer → 评估 → 连接账号）
2. ✅ **空状态设计** - 引导用户完成关键操作
3. ✅ **移动端适配** - 响应式设计，表格转卡片

### SEO与国际化
1. ✅ **完整 SEO 优化** - Meta 标签、结构化数据、Sitemap
2. ✅ **中英双语支持** - 完整翻译文件，语言切换流畅

### 实施保障
1. ✅ **9周详细路线图** - 分阶段实施，持续交付
2. ✅ **关键指标跟踪** - 用户体验、性能、SEO、业务指标

**预期效果**:
- 新用户激活率 +50%
- 用户留存率 +30%
- 官网转化率 +40%
- SEO 有机流量月增长 >20%

---

**下一步建议**: 优先实施 Phase 1（基础架构）和 Phase 3（新用户体验），快速验证设计方案的有效性。
