# Frontend Hooks Integration Guide

## 概述

本指南详细说明了如何将现有的前端Hooks迁移到使用增强的统一用户服务，以及新Hooks的使用方法。

## 迁移完成的核心Hooks

### 1. 用户相关Hooks (`/core/hooks/use-user.ts`)

#### 更新前
```typescript
// 使用直接的Supabase API
function useUser() {
  const client = useSupabase();
  return useSWR(['user'], () => client.auth.getUser());
}
```

#### 更新后
```typescript
// 使用统一用户服务
import { enhancedUnifiedUserService } from '~/lib/services/EnhancedUnifiedUserService';

function useUser() {
  return useSWR(['user'], async () => {
    const userSession = await enhancedUnifiedUserService.getUserSession();
    return userSession.user;
  });
}

// 新增的增强Hooks
export function useUserSession() {
  return useSWR(['user-session'], () =>
    enhancedUnifiedUserService.getUserSession()
  );
}

export function useUserPermissions() {
  const userSession = useUserSession();
  return useSWR(
    userSession.data ? ['permissions', userSession.data.user.id] : null,
    () => enhancedUnifiedUserService.getUserPermissions(userSession.data.user.id)
  );
}

export function useUserProfile() {
  const userSession = useUserSession();
  return useSWR(
    userSession.data ? ['profile', userSession.data.user.id] : null,
    () => enhancedUnifiedUserService.getUserProfile(userSession.data.user.id)
  );
}
```

### 2. 订阅和权限Hooks (`/lib/hooks/useSubscription.ts`)

#### 更新前
```typescript
// 直接调用API端点
export function useSubscription() {
  return useSWR(
    userSession ? '/api/v1/users/me/subscription' : null,
    async (url) => {
      const response = await fetch(`${apiBaseURL}${url}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.json();
    }
  );
}
```

#### 更新后
```typescript
// 使用统一用户服务，提供回退机制
import { enhancedUnifiedUserService } from '~/lib/services/EnhancedUnifiedUserService';
import { useUserSession } from '~/core/hooks/use-user';

export function useSubscription() {
  const { data: userSession } = useUserSession();

  return useSWR(
    userSession ? ['subscription', userSession.user.id] : null,
    () => enhancedUnifiedUserService.getUserSubscription(userSession.user.id)
  );
}

// 新增的便利Hooks
export function useUserAccess() {
  const { data: userSession } = useUserSession();

  const { data: permissions } = useSWR(
    userSession ? ['access', userSession.user.id] : null,
    () => enhancedUnifiedUserService.getUserPermissions(userSession.user.id)
  );

  return {
    permissions,
    canCreateOffer: permissions?.canCreateOffers ?? false,
    canUseAI: permissions?.canUseAI ?? false,
    isAdmin: permissions?.isAdmin ?? false,
    maxOffersPerMonth: permissions?.maxOffersPerMonth ?? 0,
  };
}

export function useUserActivity() {
  const { data: userSession } = useUserSession();

  return useSWR(
    userSession ? ['activity', userSession.user.id] : null,
    () => enhancedUnifiedUserService.getUserActivityStats(userSession.user.id)
  );
}
```

### 3. 计费API Hooks (`/core/hooks/use-billing-api.ts`)

#### 更新前
```typescript
export function useSubscription() {
  const client = createBillingApiClient();
  return useSWR('billing-subscription', () => client.getSubscription());
}

export function useTokenBalance() {
  const client = createBillingApiClient();
  return useSWR('billing-token-balance', () => client.getTokenBalance());
}

export function usePermissions() {
  const client = createBillingApiClient();
  return useSWR('billing-permissions', () => client.checkPermissions());
}
```

#### 更新后
```typescript
// 增强的Hooks，优先使用统一用户服务，提供回退机制
import { enhancedUnifiedUserService } from '~/lib/services/EnhancedUnifiedUserService';

export function useSubscription() {
  const client = createBillingApiClient();

  return useSWR('billing-subscription', async () => {
    try {
      // 优先使用统一用户服务
      const userSession = await enhancedUnifiedUserService.getUserSession();
      return await enhancedUnifiedUserService.getUserSubscription(userSession.user.id);
    } catch (unifiedError) {
      console.warn('[useSubscription] Unified service failed, falling back to billing client:', unifiedError);
      // 回退到原始计费客户端
      return client.getSubscription();
    }
  });
}

export function useTokenBalance() {
  const client = createBillingApiClient();

  return useSWR('billing-token-balance', async () => {
    try {
      const userSession = await enhancedUnifiedUserService.getUserSession();
      return await enhancedUnifiedUserService.getTokenBalance(userSession.user.id);
    } catch (unifiedError) {
      console.warn('[useTokenBalance] Unified service failed, falling back to billing client:', unifiedError);
      return client.getTokenBalance();
    }
  });
}

export function usePermissions() {
  const client = createBillingApiClient();

  return useSWR('billing-permissions', async () => {
    try {
      const userSession = await enhancedUnifiedUserService.getUserSession();
      return await enhancedUnifiedUserService.getUserPermissions(userSession.user.id);
    } catch (unifiedError) {
      console.warn('[usePermissions] Unified service failed, falling back to billing client:', unifiedError);
      return client.checkPermissions();
    }
  });
}
```

## 新增的便利Hooks

### 1. 用户访问控制Hook

```typescript
// 使用示例
function MyComponent() {
  const { canCreateOffer, canUseAI, isAdmin } = useUserAccess();

  if (!canCreateOffer) {
    return <div>升级套餐以创建更多Offer</div>;
  }

  if (canUseAI) {
    return <AIEvaluationButton />;
  }

  return <StandardOfferForm />;
}
```

### 2. 用户活动统计Hook

```typescript
// 使用示例
function UserDashboard() {
  const { activity, isLoading } = useUserActivity();

  if (isLoading) return <Loading />;

  return (
    <div>
      <h2>本月统计</h2>
      <p>总Offer数: {activity?.totalOffers}</p>
      <p>总收入: ${activity?.totalEarnings}</p>
      <p>活跃天数: {activity?.activeDays}</p>
    </div>
  );
}
```

### 3. 增强的用户会话Hook

```typescript
// 使用示例
function UserProfile() {
  const { data: userSession } = useUserSession();
  const { data: profile } = useUserProfile();
  const { data: permissions } = useUserPermissions();

  if (!userSession) return <NotAuthenticated />;

  return (
    <div>
      <h1>{profile?.displayName}</h1>
      <p>当前套餐: {permissions?.subscriptionPlan}</p>
      <p>Token余额: {userSession.tokens?.available}</p>
    </div>
  );
}
```

## 迁移指南

### 对于现有组件

1. **简单替换**：对于使用基础用户数据的组件
   ```typescript
   // 之前
   const { data: user } = useUser();

   // 现在
   const { data: user } = useUser(); // 无需更改
   const { data: userSession } = useUserSession(); // 获取更多数据
   ```

2. **权限检查**：替换手动的权限逻辑
   ```typescript
   // 之前
   const { data: subscription } = useSubscription();
   const canUseAI = subscription?.plan === 'professional' || subscription?.plan === 'elite';

   // 现在
   const { canUseAI } = useUserAccess(); // 更简洁
   ```

3. **计费数据**：现有计费Hooks保持向后兼容
   ```typescript
   // 无需更改，自动使用统一用户服务
   const { data: subscription } = useSubscription();
   const { data: balance } = useTokenBalance();
   ```

### 最佳实践

1. **使用新的便利Hooks**：
   ```typescript
   // 推荐：使用便利Hook
   const { canCreateOffer, canUseAI } = useUserAccess();

   // 不推荐：重复的逻辑
   const { data: permissions } = useUserPermissions();
   const canCreateOffer = permissions?.canCreateOffers;
   const canUseAI = permissions?.canUseAI;
   ```

2. **组合使用Hooks**：
   ```typescript
   function OfferManagement() {
     const { data: userSession } = useUserSession();
     const { canCreateOffer } = useUserAccess();
     const { activity } = useUserActivity();

     // 组合多个Hook的数据
     const remainingOffers = canCreateOffer
       ? Math.max(0, userSession?.permissions?.maxOffersPerMonth - activity?.totalOffers)
       : 0;
   }
   ```

3. **错误处理**：
   ```typescript
   const { data: userSession, error } = useUserSession();

   if (error) {
     console.error('用户会话加载失败:', error);
     return <ErrorPage />;
   }
   ```

## 性能优化

### 1. 缓存策略
- 统一用户服务内部实现缓存，减少重复API调用
- SWR缓存确保相同数据不会重复请求
- 合理的刷新间隔配置

### 2. 回退机制
- 统一用户服务不可用时自动回退到原始API
- 保证系统稳定性和可用性

### 3. 错误恢复
- 详细的错误日志记录
- 优雅的错误处理和用户提示

## 下一步

1. **测试验证**：验证所有更新的Hooks在真实环境中的工作情况
2. **性能监控**：监控API调用次数和响应时间的改善
3. **文档更新**：更新组件文档和开发者指南
4. **培训推广**：向开发团队介绍新的Hooks使用方法

## 总结

通过将前端Hooks迁移到统一用户服务，我们实现了：

- ✅ **统一数据源**：用户数据通过统一服务获取，避免不一致
- ✅ **简化API调用**：减少直接API调用，提高代码可维护性
- ✅ **性能优化**：智能缓存和回退机制提高系统性能
- ✅ **向后兼容**：现有代码无需大幅修改即可使用新服务
- ✅ **增强功能**：新的便利Hooks提供更丰富的功能和更好的开发体验