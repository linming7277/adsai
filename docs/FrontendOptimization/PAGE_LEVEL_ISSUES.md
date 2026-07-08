# AutoAds Frontend 页面层面审查报告

**审查日期**: 2025-10-11
**审查对象**: Dashboard, Offers, Tasks, Ads-Center 等关键页面

---

## 🔴 Critical Issues (页面层面)

### 1. **Dashboard 页面性能问题** 🔴
**位置**: `/src/app/dashboard/page.tsx`

**问题分析**:
```typescript
function DashboardPage() {
  const { items: offers, isLoading: offersLoading } = useOffers(); // ❌ 获取所有 offers
  const { tier, isLoading: subscriptionLoading } = useUserSubscription();
  const { data: tokenBalance, isLoading: tokensLoading } = useBillingTokenBalance();

  // ❌ 在客户端计算统计数据
  const totalOffers = offers.length;
  const pendingOffers = offers.filter(o => o.status === 'pending_evaluation').length;
  const deployedOffers = offers.filter(o => o.status === 'deployed').length;
  const readyOffers = offers.filter(o => o.status === 'ready_to_deploy').length;
}
```

**问题**:
1. **过度获取数据**: Dashboard 只需要统计数据，却获取了所有 offers
2. **客户端计算**: 统计应该由后端完成
3. **三个独立请求**: 应该合并为单个 dashboard API

**性能影响**:
- 如果用户有 1000 个 offers，会传输大量不必要的数据
- 客户端计算浪费资源
- 三个请求延长页面加载时间

**建议方案**:
```typescript
// 新增 Dashboard API
// GET /api/v1/dashboard/overview
interface DashboardOverview {
  offers: {
    total: number;
    pending: number;
    deployed: number;
    ready: number;
  };
  subscription: {
    tier: string;
    status: string;
  };
  tokens: {
    balance: number;
    monthlyAllowance: number;
  };
  recentActivity: Activity[];
}

// 优化后的组件
function DashboardPage() {
  const { data, isLoading } = useDashboardOverview(); // ✅ 单个请求

  return (
    <StatCard title="Offers 总数" value={data?.offers.total} />
    // ...
  );
}
```

---

### 2. **Offers 页面存在 N+1 查询问题** 🔴
**位置**: `/src/app/dashboard/offers/page.tsx`

**代码证据**:
```typescript
const { items, isLoading, mutate } = useOffers({
  status: status === 'all' ? undefined : status,
});

// ❌ 客户端过滤、排序、分页
const filteredOffers = useMemo(() => {
  return items.filter((offer) => {
    if (showFavoritesOnly && !offer.isFavorite) return false;
    if (evaluationFilter === 'ai' && typeof offer.healthScore !== 'number') return false;
    // ... 更多过滤逻辑
  });
}, [items, searchTerm, evaluationFilter, timeRange, showFavoritesOnly]);

const displayedOffers = useMemo(() => {
  const sorted = filteredOffers.slice();
  sorted.sort((a, b) => { /* 排序逻辑 */ });
  return sorted;
}, [filteredOffers, sortField, sortOrder]);
```

**问题**:
1. **获取所有数据后客户端过滤**: 浪费带宽和内存
2. **客户端排序**: 应该由数据库完成
3. **没有真正的分页**: 只是前端切片

**建议方案**:
```typescript
// ✅ 所有过滤、排序、分页由后端完成
function OffersPage() {
  const [filters, setFilters] = useState({
    status: 'all',
    evaluation: 'all',
    timeRange: 'all',
    favorite: false,
    search: '',
    page: 1,
    limit: 20,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  const { data, isLoading } = useOffers(filters); // ✅ 传递完整参数

  return (
    <>
      {data.items.map(offer => <OfferRow offer={offer} />)}
      <Pagination
        current={data.page}
        total={data.totalPages}
        onChange={(page) => setFilters(prev => ({ ...prev, page }))}
      />
    </>
  );
}
```

---

### 3. **Tasks 页面轮询导致性能问题** 🔴
**位置**: `/src/app/dashboard/tasks/page.tsx`

**问题**:
```typescript
const {
  items,
  isLoading,
  mutate: mutateTasks,
} = useTasks(
  { status },
  { refreshInterval: 5000 }, // ❌ 每 5 秒刷新所有任务
);
```

**影响**:
- 即使没有 running 的任务也会轮询
- 可能导致大量不必要的请求
- 用户不在页面时仍然轮询

**建议方案**:
```typescript
function TasksPage() {
  const [hasRunningTasks, setHasRunningTasks] = useState(false);

  const { items, isLoading } = useTasks(
    { status },
    {
      // ✅ 智能轮询：只在有 running 任务时启用
      refreshInterval: hasRunningTasks ? 5000 : 0,
      // ✅ 离开页面时暂停
      refreshWhenOffline: false,
      refreshWhenHidden: false,
    },
  );

  useEffect(() => {
    const running = items.some(t => t.status === 'running' || t.status === 'pending');
    setHasRunningTasks(running);
  }, [items]);

  // ✅ 或者使用 WebSocket 实时更新
  useTaskWebSocket((update) => {
    if (update.taskId) {
      mutateTasks(); // 仅在收到更新时刷新
    }
  });
}
```

---

## 🟠 High Priority Issues

### 4. **缺少乐观更新** 🟠
**位置**: 多个页面的 mutate 操作

**当前**:
```typescript
const handleToggleFavorite = async (offer: Offer, nextValue: boolean) => {
  try {
    await toggleFavorite(offer.id, nextValue); // ❌ 等待后端响应
    mutate(); // ❌ 然后重新获取所有数据
    toast.success(nextValue ? '已加入收藏' : '已取消收藏');
  } catch (error) {
    toast.error('更新收藏状态失败');
  }
};
```

**问题**:
- 用户体验差：等待网络请求
- 不必要的重新获取：只改变一个字段却重新获取所有数据

**建议**:
```typescript
const handleToggleFavorite = async (offer: Offer, nextValue: boolean) => {
  // ✅ 乐观更新
  mutate(
    (currentData) => {
      if (!currentData) return currentData;
      return currentData.map(o =>
        o.id === offer.id ? { ...o, isFavorite: nextValue } : o
      );
    },
    false, // 不立即revalidate
  );

  toast.success(nextValue ? '已加入收藏' : '已取消收藏');

  try {
    await toggleFavorite(offer.id, nextValue);
    // ✅ 静默刷新，确保数据一致
    mutate();
  } catch (error) {
    // ✅ 失败时回滚
    mutate();
    toast.error('更新收藏状态失败');
  }
};
```

---

### 5. **Dashboard快速操作区域有dead link** 🟠
**位置**: `/src/app/dashboard/page.tsx:130-137`

**代码**:
```typescript
<QuickActionButton
  icon={ChartBarIcon}
  label="数据报表"
  description="查看投放数据分析"
  onClick={() => router.push('/dashboard/reports')} // ❌ 路由不存在
  disabled
/>
```

**问题**:
- 显示已禁用的按钮，但没有说明原因
- 点击无效，用户体验差

**建议**:
```typescript
// 方案 1: 隐藏未实现的功能
{canAccessReports && (
  <QuickActionButton
    icon={ChartBarIcon}
    label="数据报表"
    onClick={() => router.push('/dashboard/reports')}
  />
)}

// 方案 2: 添加提示
<QuickActionButton
  icon={ChartBarIcon}
  label="数据报表"
  description="即将推出"
  onClick={() => toast.info('此功能正在开发中')}
  disabled
/>

// 方案 3: 引导升级
{!canAccessReports && (
  <QuickActionButton
    icon={ChartBarIcon}
    label="数据报表"
    description="升级至 Pro 解锁"
    onClick={() => router.push('/pricing')}
    variant="upgrade"
  />
)}
```

---

### 6. **Offers 详情弹窗重复请求** 🟠
**位置**: `/src/app/dashboard/offers/components/OfferDetailDialog.tsx`

**问题**:
```typescript
function OfferDetailDialog({ offerId, open, onClose }) {
  const { offer, isLoading, mutate } = useOffer(offerId ?? undefined);
  const { history, mutate: refreshHistory } = useOfferEvaluationHistory(offerId ?? undefined);

  // ❌ 两个独立请求
  // ❌ 每次打开弹窗都重新请求，即使数据已缓存
}
```

**建议**:
```typescript
// ✅ 合并请求
function OfferDetailDialog({ offerId, open, onClose }) {
  const { data, isLoading } = useOfferDetail(offerId, {
    enabled: open, // ✅ 只在打开时请求
    staleTime: 60000, // ✅ 1分钟内复用缓存
  });

  // data 包含: { offer, evaluationHistory, linkedAccounts }
}

// ✅ 后端实现
// GET /api/v1/offers/:id/detail
{
  offer: {...},
  evaluationHistory: [...],
  linkedAccounts: [...],
  relatedTasks: [...]
}
```

---

## 🟡 Medium Priority Issues

### 7. **空状态设计不统一** 🟡

**当前**:
```typescript
// offers/page.tsx
<EmptyState
  title={'未找到符合条件的 Offer'}
  description={'调整筛选条件或清除搜索关键字'}
  actions={<Button onClick={handleResetFilters}>清除筛选</Button>}
/>

// tasks/page.tsx (不同的样式和文案)
{!hasFilteredTasks && !isLoading ? (
  <div className="text-center py-12">
    <p className="text-muted-foreground">暂无任务</p>
  </div>
) : null}
```

**建议**: 统一空状态组件
```typescript
// components/EmptyState.tsx
interface EmptyStateProps {
  variant: 'no-data' | 'no-results' | 'error' | 'coming-soon';
  icon?: React.ComponentType;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

// 使用
<EmptyState
  variant="no-results"
  icon={MagnifyingGlassIcon}
  title="未找到符合条件的 Offer"
  description="尝试调整筛选条件"
  actions={<Button onClick={handleReset}>清除筛选</Button>}
/>
```

---

### 8. **错误状态处理不完整** 🟡

**当前**: 大部分页面没有错误边界

**建议**:
```typescript
// app/dashboard/layout.tsx
import { ErrorBoundary } from 'react-error-boundary';

export default function DashboardLayout({ children }) {
  return (
    <ErrorBoundary
      FallbackComponent={DashboardErrorFallback}
      onError={(error, info) => {
        console.error('Dashboard Error:', error, info);
        // 上报到监控系统
      }}
      onReset={() => {
        // 清除错误状态，刷新页面
        window.location.reload();
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

function DashboardErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2>页面出错了</h2>
      <p>{error.message}</p>
      <Button onClick={resetErrorBoundary}>重新加载</Button>
    </div>
  );
}
```

---

### 9. **批量操作缺少进度提示** 🟡
**位置**: `/src/app/dashboard/offers/page.tsx:320-373`

**当前**:
```typescript
const handleBulkEvaluate = () => {
  const ids = Array.from(selected);

  startBulkTransition(async () => {
    try {
      await batchEvaluate(ids); // ❌ 用户不知道进度
      toast.success('批量评估已提交');
    } catch (error) {
      toast.error('批量评估失败');
    }
  });
};
```

**建议**:
```typescript
const handleBulkEvaluate = async () => {
  const ids = Array.from(selected);
  const toastId = toast.loading(`正在提交 ${ids.length} 个评估任务...`);

  try {
    const result = await batchEvaluate(ids, {
      onProgress: (completed, total) => {
        toast.loading(
          `评估任务提交中 ${completed}/${total}`,
          { id: toastId }
        );
      },
    });

    toast.success(
      `已成功提交 ${result.success} 个任务，失败 ${result.failed} 个`,
      { id: toastId }
    );
  } catch (error) {
    toast.error('批量评估失败', { id: toastId });
  }
};
```

---

### 10. **搜索防抖实现不当** 🟡
**位置**: `/src/app/dashboard/offers/page.tsx:99`

**当前**:
```typescript
const [searchTerm, setSearchTerm] = useState('');

// ❌ 每次输入都触发重新计算
const filteredOffers = useMemo(() => {
  const term = searchTerm.trim().toLowerCase();
  return items.filter((offer) => {
    const normalizedBrand = (offer.brandName ?? '').toLowerCase();
    return normalizedBrand.includes(term);
  });
}, [items, searchTerm]);
```

**建议**:
```typescript
import { useDebouncedValue } from '~/hooks/useDebounce';

function OffersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300); // ✅ 300ms 防抖

  const { data, isLoading } = useOffers({
    search: debouncedSearch, // ✅ 传给后端
    // ...
  });

  return (
    <TextFieldInput
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="搜索品牌或 URL"
    />
  );
}
```

---

## 🟢 Low Priority Issues

### 11. **URL 状态管理缺失** 🟢

**问题**: 筛选条件不同步到 URL

**影响**:
- 用户刷新页面后丢失筛选状态
- 无法分享带筛选条件的链接
- 浏览器前进/后退不生效

**建议**:
```typescript
import { useSearchParams } from 'next/navigation';

function OffersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState(searchParams.get('status') ?? 'all');

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    router.push(`/dashboard/offers?${params.toString()}`);
  };

  return (
    <Select
      value={status}
      onValueChange={(value) => updateFilters('status', value)}
    >
      {/* ... */}
    </Select>
  );
}
```

---

### 12. **可访问性问题** 🟢

**发现的问题**:
1. StatCard 没有合适的 `aria-label`
2. 表格缺少 `caption`
3. 筛选器没有 `aria-describedby`
4. 键盘导航不完整

**建议**:
```typescript
<StatCard
  title="Offers 总数"
  value={totalOffers}
  onClick={() => router.push('/dashboard/offers')}
  aria-label={`查看所有 ${totalOffers} 个 Offers`}
/>

<table aria-label="Offers 列表" aria-describedby="offers-description">
  <caption id="offers-description" className="sr-only">
    显示当前筛选条件下的所有 Offers，包括状态、评分等信息
  </caption>
  {/* ... */}
</table>
```

---

## 📊 页面性能汇总

| 页面 | 问题 | 优化前请求数 | 优化后请求数 | 预期提升 |
|-----|------|------------|------------|---------|
| Dashboard | 过度获取 + 多请求 | 3 | 1 | 60% |
| Offers | 客户端过滤排序 | 1 (大payload) | 1 (小payload) | 70% |
| Tasks | 无效轮询 | N×12/min | 按需 | 80% |
| Offer Detail | 重复请求 | 3 | 1 | 66% |

---

## 🎯 优先修复顺序

### Week 1 (Critical)
1. Dashboard 合并 API (`POST /api/v1/dashboard/overview`)
2. Offers 后端过滤排序
3. Tasks 智能轮询

### Week 2 (High)
4. 实现乐观更新
5. 合并 Offer 详情请求
6. 移除/优化 dead links

### Week 3 (Medium)
7. 统一空状态组件
8. 添加错误边界
9. 批量操作进度
10. 搜索防抖

### Week 4 (Low)
11. URL 状态管理
12. 可访问性优化

---

Last Updated: 2025-10-11
Reviewer: Claude (Anthropic)
