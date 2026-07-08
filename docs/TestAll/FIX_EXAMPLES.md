# UI修复代码示例

**创建时间**: 2025-10-11
**目的**: 提供具体的代码修复示例，解决前端UI组件不渲染问题

---

## 问题1: 统计卡片不渲染

### 现象

```
❌ 只找到0/4个统计卡片
```

### 原因分析

1. **条件渲染逻辑错误**
2. **数据加载状态未处理**
3. **空状态未处理**
4. **缺少data-testid**

---

## 修复方案

### 方案A: 增强错误处理和加载状态

```tsx
// apps/frontend/src/app/dashboard/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '~/components/ui/skeleton';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { StatsCard } from './components/StatsCard';
import { useDashboardStats } from '~/lib/dashboard/hooks';

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboardStats();

  // 调试日志
  useEffect(() => {
    console.log('[Dashboard] Render state:', {
      isLoading,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
      error: error?.message,
    });
  }, [isLoading, data, error]);

  // 错误状态
  if (error) {
    return (
      <div className="p-6" data-testid="dashboard-error">
        <Alert variant="destructive">
          <AlertDescription>
            加载失败: {error.message}
            <button onClick={() => refetch()} className="ml-4 underline">
              重试
            </button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="p-6" data-testid="dashboard-loading">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // 空状态 (新用户)
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="p-6" data-testid="dashboard-empty">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium">欢迎使用AutoAds</h3>
          <p className="text-muted-foreground mt-2">
            开始创建您的第一个Offer
          </p>
        </div>
      </div>
    );
  }

  // 正常渲染
  return (
    <div className="p-6" data-testid="dashboard-content">
      {/* 统计卡片区域 */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        data-testid="stats-cards-container"
      >
        <StatsCard
          data-testid="stats-card-offers"
          title="Offers 总数"
          value={data.offersCount ?? 0}
          trend={data.offersTrend}
          icon="📝"
        />
        <StatsCard
          data-testid="stats-card-tasks"
          title="任务数"
          value={data.tasksCount ?? 0}
          trend={data.tasksTrend}
          icon="📋"
        />
        <StatsCard
          data-testid="stats-card-ads"
          title="广告账户"
          value={data.adsAccountsCount ?? 0}
          icon="🎯"
        />
        <StatsCard
          data-testid="stats-card-tokens"
          title="Token 余额"
          value={data.tokenBalance ?? 0}
          icon="🪙"
        />
      </div>

      {/* 快速操作区域 */}
      <div className="mt-8" data-testid="quick-actions-container">
        <h2 className="text-lg font-semibold mb-4">快速操作</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionCard
            data-testid="action-create-offer"
            title="创建 Offer"
            description="添加新的推广链接"
            href="/dashboard/offers/new"
            icon="➕"
          />
          <ActionCard
            data-testid="action-manage-offers"
            title="管理 Offers"
            description="查看和编辑现有 Offers"
            href="/dashboard/offers"
            icon="📊"
          />
          <ActionCard
            data-testid="action-view-tasks"
            title="查看任务"
            description="监控任务执行状态"
            href="/dashboard/tasks"
            icon="📋"
          />
        </div>
      </div>
    </div>
  );
}
```

---

### 方案B: 创建可复用的StatsCard组件

```tsx
// apps/frontend/src/app/dashboard/components/StatsCard.tsx

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';

interface StatsCardProps {
  'data-testid'?: string;
  title: string;
  value: number | string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: string;
  onClick?: () => void;
}

export function StatsCard({
  'data-testid': testId,
  title,
  value,
  trend,
  icon,
  onClick,
}: StatsCardProps) {
  return (
    <Card
      data-testid={testId}
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <span className="text-2xl">{icon}</span>}
      </CardHeader>
      <CardContent>
        <div data-testid={`${testId}-value`} className="text-3xl font-bold">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {trend && (
          <div
            data-testid={`${testId}-trend`}
            className={`flex items-center mt-2 text-sm ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend.isPositive ? (
              <ArrowUpIcon className="w-4 h-4 mr-1" />
            ) : (
              <ArrowDownIcon className="w-4 h-4 mr-1" />
            )}
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### 方案C: 创建数据加载Hook

```tsx
// apps/frontend/src/lib/dashboard/hooks.ts

import { useQuery } from '@tanstack/react-query';
import { useUser } from '~/core/hooks/use-user';

interface DashboardStats {
  offersCount: number;
  offersTrend?: { value: number; isPositive: boolean };
  tasksCount: number;
  tasksTrend?: { value: number; isPositive: boolean };
  adsAccountsCount: number;
  tokenBalance: number;
}

async function fetchDashboardStats(userId: string): Promise<DashboardStats> {
  const response = await fetch(`/api/dashboard/stats?userId=${userId}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch dashboard stats');
  }

  const data = await response.json();

  // 验证数据结构
  console.log('[Dashboard Hook] API Response:', data);

  return {
    offersCount: data.offersCount ?? 0,
    offersTrend: data.offersTrend,
    tasksCount: data.tasksCount ?? 0,
    tasksTrend: data.tasksTrend,
    adsAccountsCount: data.adsAccountsCount ?? 0,
    tokenBalance: data.tokenBalance ?? 0,
  };
}

export function useDashboardStats() {
  const user = useUser();

  return useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: () => fetchDashboardStats(user!.id),
    enabled: !!user?.id,
    staleTime: 30000, // 30秒内不重新请求
    gcTime: 300000, // 5分钟后清除缓存
    retry: 2,
    onError: (error) => {
      console.error('[Dashboard Hook] Error:', error);
    },
  });
}
```

---

## 问题2: 订阅管理页面套餐列表不渲染

### 修复代码

```tsx
// apps/frontend/src/app/dashboard/settings/subscription/page.tsx

'use client';

import { Skeleton } from '~/components/ui/skeleton';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { useUserSubscription } from '~/lib/billing/hooks';
import { PricingCard } from './components/PricingCard';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: ['100 Tokens/月', '基础评估', '社区支持'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    features: ['1000 Tokens/月', 'AI智能评估', '优先支持'],
  },
  {
    id: 'elite',
    name: 'Elite',
    price: 99,
    features: ['10000 Tokens/月', '高级AI评估', '专属客服'],
  },
];

export default function SubscriptionPage() {
  const { data: subscription, isLoading, error } = useUserSubscription();

  if (error) {
    return (
      <Alert variant="destructive" data-testid="subscription-error">
        <AlertDescription>
          加载失败: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div data-testid="subscription-loading">
        <Skeleton className="h-32 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="subscription-content">
      {/* 当前套餐 */}
      {subscription && (
        <div className="mb-8" data-testid="current-plan-section">
          <h2 className="text-lg font-semibold mb-4">当前套餐</h2>
          <div
            data-testid="current-plan-card"
            className="p-4 border rounded-lg"
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium">{subscription.planName}</h3>
                <p className="text-sm text-muted-foreground">
                  {subscription.status === 'active' ? '活跃' : '已取消'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  ${subscription.amount}/月
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 套餐列表 */}
      <div data-testid="plans-section">
        <h2 className="text-lg font-semibold mb-4">升级套餐</h2>
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          data-testid="plans-container"
        >
          {PLANS.map((plan, index) => (
            <PricingCard
              key={plan.id}
              data-testid={`plan-card-${plan.id}`}
              plan={plan}
              currentPlan={subscription?.planId}
              isPopular={index === 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 问题3: Token管理页面统计卡片不渲染

### 修复代码

```tsx
// apps/frontend/src/app/dashboard/settings/tokens/page.tsx

'use client';

import { Skeleton } from '~/components/ui/skeleton';
import { Button } from '~/components/ui/button';
import { useTokenBalance } from '~/lib/billing/hooks';
import { StatsCard } from '~/app/dashboard/components/StatsCard';

export default function TokensPage() {
  const { data: tokenData, isLoading, error } = useTokenBalance();

  if (isLoading) {
    return (
      <div data-testid="tokens-loading" className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="tokens-error" className="p-6">
        <Alert variant="destructive">
          <AlertDescription>
            加载Token信息失败: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // 确保数据存在
  const balance = tokenData?.balance ?? 0;
  const totalEarned = tokenData?.totalEarned ?? 0;
  const totalSpent = tokenData?.totalSpent ?? 0;

  return (
    <div className="p-6" data-testid="tokens-content">
      {/* Token统计卡片 */}
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
        data-testid="token-stats-container"
      >
        <StatsCard
          data-testid="token-balance-card"
          title="当前余额"
          value={balance}
          icon="🪙"
        />
        <StatsCard
          data-testid="token-earned-card"
          title="累计获得"
          value={totalEarned}
          icon="⬆️"
        />
        <StatsCard
          data-testid="token-spent-card"
          title="累计消耗"
          value={totalSpent}
          icon="⬇️"
        />
      </div>

      {/* 充值按钮 */}
      <div className="mb-8" data-testid="token-actions">
        <Button data-testid="recharge-button" size="lg">
          充值 Tokens
        </Button>
      </div>

      {/* 交易记录 */}
      <div data-testid="transaction-history">
        <h2 className="text-lg font-semibold mb-4">使用明细</h2>
        {/* 交易记录表格 */}
      </div>
    </div>
  );
}
```

---

## 测试选择器更新

### 更新原则

1. **优先使用data-testid**: 稳定、不受样式和文本变化影响
2. **多语言兼容**: 使用正则匹配中英文
3. **增强等待策略**: 等待元素可见后再操作

### 示例

```javascript
// scripts/tests/test-dashboard-overview.mjs

// ❌ 旧选择器 (脆弱)
const statsCards = await page.locator('div.stat-card');
const offersCard = await page.locator('text=Offers 总数');

// ✅ 新选择器 (稳定)
const statsCards = await page.locator('[data-testid^="stats-card-"]');
const offersCard = await page.locator('[data-testid="stats-card-offers"]');

// 等待元素可见
await page.waitForSelector('[data-testid="stats-cards-container"]', {
  state: 'visible',
  timeout: 10000,
});

// 验证数量
const cardsCount = await statsCards.count();
console.log(`   ✓ 找到 ${cardsCount}/4 个统计卡片`);
```

---

## 错误边界组件

```tsx
// apps/frontend/src/components/ErrorBoundary.tsx

'use client';

import { Component, type ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-6" data-testid="error-boundary">
          <Alert variant="destructive">
            <AlertTitle>出错了</AlertTitle>
            <AlertDescription>
              <p className="mb-4">{this.state.error?.message}</p>
              <Button
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.reload();
                }}
              >
                刷新页面
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

// 使用方式
<ErrorBoundary>
  <DashboardPage />
</ErrorBoundary>
```

---

## 验收清单

修复完成后，应满足以下条件：

### 前端验收

- [ ] Dashboard页面4个统计卡片正常显示
- [ ] 订阅管理页面3个套餐卡片正常显示
- [ ] Token管理页面3个统计卡片正常显示
- [ ] 广告中心页面4个统计卡片正常显示
- [ ] 任务管理页面4个状态Tab正常显示
- [ ] 所有关键元素有data-testid
- [ ] 浏览器Console无错误
- [ ] 加载状态正常显示
- [ ] 错误状态有友好提示
- [ ] 空状态有占位符

### 测试验收

- [ ] 所有测试选择器使用data-testid
- [ ] 测试代码支持中英文环境
- [ ] E2E测试通过率 > 80%
- [ ] 关键测试通过率 = 100%
- [ ] 无超时错误

---

**文档版本**: v1.0
**最后更新**: 2025-10-11
