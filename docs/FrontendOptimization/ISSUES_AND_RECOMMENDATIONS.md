# AutoAds Frontend 深度审查报告

**审查日期**: 2025-10-11
**审查范围**: 全栈前端代码 + 后端交互层
**严重程度**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## 🔴 Critical Issues (需立即修复)

### 1. **双 API 客户端架构混乱** 🔴
**位置**: `/src/lib/api/client.ts` + `/src/lib/console-api-client.ts`

**问题**:
- 存在两套完全独立的 API 客户端
- `client.ts`: 通用 API 客户端，使用 `NEXT_PUBLIC_API_BASE_URL`
- `console-api-client.ts`: Console Service 专用客户端，硬编码 URL

**代码证据**:
```typescript
// client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL; // 未配置时警告

// console-api-client.ts
const CONSOLE_API_BASE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_API_URL ||
  'https://console-yt54xvsg5q-an.a.run.app/api/v1/console'; // 硬编码后备
```

**影响**:
- Token 重复获取（两个客户端各自实现 auth）
- 缓存不统一
- 错误处理不一致
- 维护成本高

**建议**:
```typescript
// 统一架构方案
class ApiClient {
  constructor(private baseUrl: string) {}

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // 统一的 token 缓存、错误处理、重试逻辑
  }
}

// 导出不同服务的实例
export const apiClient = new ApiClient(API_BASE_URL);
export const consoleApi = new ApiClient(CONSOLE_API_BASE_URL);
```

---

### 2. **Token 缓存策略不够健壮** 🔴
**位置**: `/src/lib/api/client.ts:43-54, 188-236`

**问题**:
- Token 缓存仅 45 秒 TTL（`TOKEN_TTL_MS = 45 * 1000`）
- 没有考虑 token 实际过期时间
- 没有主动刷新机制
- `console-api-client.ts` 没有任何缓存

**代码证据**:
```typescript
// client.ts 有简单缓存
const TOKEN_TTL_MS = 45 * 1000;
if (tokenCache.value && now - tokenCache.fetchedAt < TOKEN_TTL_MS) {
  return { token: tokenCache.value, source: tokenCache.source };
}

// console-api-client.ts 每次都重新获取
private async getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession(); // 每次调用
  return session.access_token;
}
```

**影响**:
- 不必要的 Supabase 调用
- 可能在 token 真正过期前就丢弃缓存
- 性能浪费

**建议**:
```typescript
class TokenManager {
  private cache: {
    token: string | null;
    expiresAt: number; // 使用实际过期时间
    refreshToken: string | null;
  } = { token: null, expiresAt: 0, refreshToken: null };

  async getToken(): Promise<string> {
    const now = Date.now();

    // 提前 5 分钟刷新
    if (this.cache.token && now < this.cache.expiresAt - 5 * 60 * 1000) {
      return this.cache.token;
    }

    // 尝试刷新
    if (this.cache.refreshToken && now < this.cache.expiresAt) {
      return this.refreshAccessToken();
    }

    // 重新获取
    return this.fetchNewToken();
  }
}
```

---

### 3. **环境变量未配置时的fallback策略有问题** 🔴
**位置**: `/src/lib/api/client.ts:5-11`

**代码证据**:
```typescript
if (!API_BASE_URL) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[api] NEXT_PUBLIC_API_BASE_URL 未配置，将直接使用传入路径');
  }
}
```

**问题**:
- 生产环境如果未配置，仍然继续运行
- "直接使用传入路径" 可能导致请求发到错误的 URL
- 应该在构建时就失败，而不是运行时警告

**建议**:
```typescript
// 在配置文件中
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE_URL && process.env.NODE_ENV === 'production') {
  throw new Error('NEXT_PUBLIC_API_BASE_URL 必须在生产环境配置');
}

if (!API_BASE_URL) {
  console.error('NEXT_PUBLIC_API_BASE_URL 未配置，API 请求可能失败');
}
```

---

## 🟠 High Priority Issues (应尽快修复)

### 4. **SWR 配置不合理** 🟠
**位置**: `/src/lib/api/swr-config.ts`

**问题**:
```typescript
export const swrConfig: SWRConfiguration = {
  refreshInterval: 0,           // ✅ 好
  revalidateOnFocus: false,     // ❌ 应该 true
  revalidateOnReconnect: true,  // ✅ 好
  revalidateOnMount: true,      // ✅ 好
  errorRetryCount: 3,           // ⚠️ 可能太多
  errorRetryInterval: 5000,     // ⚠️ 太长
  dedupingInterval: 2000,       // ✅ 合理
  keepPreviousData: true,       // ✅ 好
  shouldRetryOnError: true,     // ⚠️ 应区分错误类型
};
```

**建议**:
```typescript
export const swrConfig: SWRConfiguration = {
  fetcher: swrFetcher,
  refreshInterval: 0,
  revalidateOnFocus: true,      // ✅ 用户返回时刷新
  revalidateOnReconnect: true,
  revalidateOnMount: true,
  errorRetryCount: 2,           // ✅ 减少到 2 次
  errorRetryInterval: 3000,     // ✅ 缩短到 3 秒
  dedupingInterval: 2000,
  keepPreviousData: true,
  shouldRetryOnError: (error) => {
    // ✅ 智能重试
    if (error.status === 401 || error.status === 403) return false; // 认证错误不重试
    if (error.status >= 400 && error.status < 500) return false; // 客户端错误不重试
    return true; // 只重试服务器错误
  },
  onError: (error, key) => {
    console.error(`[SWR] ${key} 请求失败:`, error);
    // ✅ 可以添加 toast 通知
  },
};
```

---

### 5. **错误处理不够细致** 🟠
**位置**: `/src/lib/api/client.ts:98-100, 238-264`

**问题**:
- 所有错误都抛出 `ApiError`，没有区分类型
- 没有针对性的错误消息
- 缺少用户友好的错误提示

**当前代码**:
```typescript
if (!response.ok) {
  throw buildApiError(response.status, response.statusText, parsed);
}
```

**建议**:
```typescript
// 定义错误类型
export class NetworkError extends ApiError {}
export class AuthError extends ApiError {}
export class ValidationError extends ApiError {}
export class ServerError extends ApiError {}

function buildApiError(status: number, fallbackMessage: string, payload: unknown) {
  const message = extractErrorMessage(payload) ?? fallbackMessage;

  if (status === 401 || status === 403) {
    return new AuthError(status, 'AUTH_ERROR', getUserFriendlyMessage(status, message));
  }

  if (status >= 400 && status < 500) {
    return new ValidationError(status, 'VALIDATION_ERROR', getUserFriendlyMessage(status, message));
  }

  if (status >= 500) {
    return new ServerError(status, 'SERVER_ERROR', getUserFriendlyMessage(status, message));
  }

  if (status === 0) {
    return new NetworkError(0, 'NETWORK_ERROR', '网络连接失败，请检查网络');
  }

  return new ApiError(status, 'API_ERROR', message);
}

function getUserFriendlyMessage(status: number, technical: string): string {
  const messages = {
    400: '请求参数有误',
    401: '请先登录',
    403: '没有权限执行此操作',
    404: '请求的资源不存在',
    409: '操作冲突，请刷新后重试',
    429: '请求过于频繁，请稍后再试',
    500: '服务器错误，我们已收到通知',
    502: '服务暂时不可用',
    503: '服务维护中',
  };

  return messages[status as keyof typeof messages] ?? technical;
}
```

---

### 6. **缺少请求取消机制** 🟠
**位置**: 所有使用 `fetch` 的地方

**问题**:
- 组件卸载时，fetch 请求仍然继续
- 可能导致内存泄漏和无效的 state 更新

**建议**:
```typescript
// 在 api/client.ts 中
export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions & { signal?: AbortSignal } = {},
): Promise<T> {
  const { requireAuth = true, headers, signal, ...fetchOptions } = options;

  const response = await fetch(url, {
    ...fetchOptions,
    signal, // ✅ 支持 AbortController
    headers: finalHeaders,
  });

  // ...
}

// 在 hooks 中使用
export function useOffers(params: OfferListParams = {}) {
  const endpoint = buildListEndpoint(params);

  const swr = useSWR<Offer[]>(
    ['offers', endpoint],
    async (_, { signal }) => { // ✅ SWR 会自动传入 signal
      const data = await apiGet<OfferApiRecord[]>(endpoint, { signal });
      return data.map(mapOfferRecord);
    },
    swrConfig,
  );

  return { ...swr };
}
```

---

## 🟡 Medium Priority Issues (建议优化)

### 7. **ConsoleApiClient 类设计冗余** 🟡
**位置**: `/src/lib/console-api-client.ts:612-1046`

**问题**:
- 43 个方法，每个都重复 auth 逻辑
- 代码重复度极高
- 类型定义和 API 调用混在一起（1046 行文件）

**建议**:
```typescript
// 1. 拆分类型定义到独立文件
// types/console-api.ts
export interface TokenStats { ... }
export interface OfferStats { ... }
// ...

// 2. 使用泛型方法减少重复
class ConsoleApiClient {
  private async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return this.fetchWithAuth(`${endpoint}${query}`);
  }

  private async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.fetchWithAuth(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // 使用示例
  async getTokenStats() {
    return this.get<TokenStats>('/tokens/stats');
  }

  async topUpTokens(data: TopUpRequest) {
    return this.post<void>('/tokens/topup', data);
  }
}
```

---

### 8. **缺少全局加载/错误状态管理** 🟡
**位置**: 整个应用

**问题**:
- 每个组件自己管理 loading/error 状态
- 没有全局的请求状态指示器
- 用户体验不一致

**建议**:
```typescript
// hooks/useGlobalLoading.ts
import { create } from 'zustand';

interface LoadingState {
  activeRequests: Set<string>;
  isLoading: boolean;
  startLoading: (key: string) => void;
  stopLoading: (key: string) => void;
}

export const useGlobalLoading = create<LoadingState>((set) => ({
  activeRequests: new Set(),
  isLoading: false,
  startLoading: (key) =>
    set((state) => {
      const activeRequests = new Set(state.activeRequests);
      activeRequests.add(key);
      return { activeRequests, isLoading: activeRequests.size > 0 };
    }),
  stopLoading: (key) =>
    set((state) => {
      const activeRequests = new Set(state.activeRequests);
      activeRequests.delete(key);
      return { activeRequests, isLoading: activeRequests.size > 0 };
    }),
}));

// 在 api/client.ts 中集成
export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const requestKey = `${options.method ?? 'GET'} ${endpoint}`;

  try {
    useGlobalLoading.getState().startLoading(requestKey);
    const response = await fetch(url, { ...fetchOptions });
    // ...
    return parsed as T;
  } finally {
    useGlobalLoading.getState().stopLoading(requestKey);
  }
}

// 在 Layout 中显示全局加载条
function GlobalLoadingBar() {
  const isLoading = useGlobalLoading((state) => state.isLoading);

  return isLoading ? (
    <div className="fixed top-0 left-0 right-0 h-1 bg-primary animate-pulse z-50" />
  ) : null;
}
```

---

### 9. **没有统一的数据规范化策略** 🟡
**位置**: `/src/lib/offers/hooks.ts:29-30`

**问题**:
- 每个 hook 自己做数据映射 (`mapOfferRecord`)
- 缺少统一的数据规范化层
- 后端字段变更会影响多处代码

**建议**:
```typescript
// lib/normalization/index.ts
import { normalize, schema } from 'normalizr';

// 定义实体 schema
export const offerSchema = new schema.Entity('offers');
export const taskSchema = new schema.Entity('tasks');
export const userSchema = new schema.Entity('users');

// 规范化函数
export function normalizeOffers(data: OfferApiRecord[]) {
  return normalize(data, [offerSchema]);
}

// 在 hooks 中使用
export function useOffers(params: OfferListParams = {}) {
  const swr = useSWR(
    ['offers', endpoint],
    async () => {
      const data = await apiGet<OfferApiRecord[]>(endpoint);
      const { entities, result } = normalizeOffers(data);

      // 存储到全局 store
      useOfferStore.getState().setEntities(entities.offers);

      return result.map(id => entities.offers[id]);
    },
    swrConfig,
  );
}
```

---

### 10. **SWR polling 配置可能导致性能问题** 🟡
**位置**: `/src/lib/api/swr-config.ts:23-28`

**问题**:
```typescript
export const swrPollingConfig: SWRConfiguration = {
  ...swrConfig,
  refreshInterval: 3000,     // ⚠️ 每 3 秒轮询
  revalidateOnFocus: true,   // ⚠️ 每次 focus 都刷新
  dedupingInterval: 1000,    // ⚠️ 去重间隔只有 1 秒
};
```

**影响**:
- 如果多个组件使用 polling 配置，可能每 3 秒发送大量请求
- 用户频繁切换标签页会触发大量请求
- 可能被后端限流

**建议**:
```typescript
export const swrPollingConfig: SWRConfiguration = {
  ...swrConfig,
  refreshInterval: 10000,    // ✅ 延长到 10 秒
  revalidateOnFocus: false,  // ✅ 关闭 focus 时刷新（已有 polling）
  dedupingInterval: 5000,    // ✅ 增加去重间隔
};

// 或者使用智能轮询
export function createAdaptivePolling(baseInterval: number = 10000) {
  let consecutiveUnchanged = 0;

  return {
    refreshInterval: () => {
      // 如果连续多次数据无变化，逐步延长间隔
      const multiplier = Math.min(consecutiveUnchanged, 5);
      return baseInterval * (multiplier + 1);
    },
    onSuccess: (data, key, config) => {
      // 比较新旧数据
      if (isEqual(data, config.data)) {
        consecutiveUnchanged++;
      } else {
        consecutiveUnchanged = 0;
      }
    },
  };
}
```

---

## 🟢 Low Priority Issues (可选优化)

### 11. **类型定义可以更严格** 🟢

**当前**:
```typescript
export interface ApiRequestOptions extends RequestInit {
  requireAuth?: boolean;
  headers?: HeadersInit; // ❌ 太宽泛
}
```

**建议**:
```typescript
export interface ApiRequestOptions extends Omit<RequestInit, 'headers'> {
  requireAuth?: boolean;
  headers?: Record<string, string>; // ✅ 更明确
  retry?: boolean | number;
  timeout?: number;
  onUploadProgress?: (progress: number) => void;
  onDownloadProgress?: (progress: number) => void;
}
```

---

### 12. **缺少 API 请求日志/监控** 🟢

**建议**:
```typescript
// lib/api/monitoring.ts
export interface ApiMetrics {
  endpoint: string;
  method: string;
  status: number;
  duration: number;
  timestamp: number;
}

const metricsQueue: ApiMetrics[] = [];

export function recordApiMetric(metric: ApiMetrics) {
  metricsQueue.push(metric);

  // 每 10 秒批量上报
  if (metricsQueue.length >= 10) {
    sendMetricsToAnalytics(metricsQueue.splice(0));
  }
}

// 在 apiRequest 中集成
export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const startTime = Date.now();

  try {
    const response = await fetch(url, { ...fetchOptions });
    const duration = Date.now() - startTime;

    recordApiMetric({
      endpoint,
      method: options.method ?? 'GET',
      status: response.status,
      duration,
      timestamp: startTime,
    });

    // ...
  } catch (error) {
    const duration = Date.now() - startTime;

    recordApiMetric({
      endpoint,
      method: options.method ?? 'GET',
      status: 0,
      duration,
      timestamp: startTime,
    });

    throw error;
  }
}
```

---

## 📊 性能优化建议

### 13. **实现请求批处理** 🟡

**场景**: Dashboard 页面同时请求多个统计数据

**当前**:
```typescript
// 多个独立请求
const { data: userStats } = useSWR('/dashboard/users/stats');
const { data: offerStats } = useSWR('/dashboard/offers/stats');
const { data: taskStats } = useSWR('/dashboard/tasks/stats');
const { data: revenue } = useSWR('/dashboard/revenue');
```

**建议**:
```typescript
// 批量请求
const { data } = useSWR('/dashboard/overview', async () => {
  return apiPost('/api/v1/batch', {
    requests: [
      { id: 'users', endpoint: '/dashboard/users/stats' },
      { id: 'offers', endpoint: '/dashboard/offers/stats' },
      { id: 'tasks', endpoint: '/dashboard/tasks/stats' },
      { id: 'revenue', endpoint: '/dashboard/revenue' },
    ],
  });
});

const userStats = data?.users;
const offerStats = data?.offers;
// ...
```

---

### 14. **添加请求去重** 🟡

**问题**: 多个组件同时渲染时可能发起相同请求

**建议**:
```typescript
// lib/api/deduplication.ts
const pendingRequests = new Map<string, Promise<any>>();

export function deduplicateRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 2000,
): Promise<T> {
  const existing = pendingRequests.get(key);

  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetcher().finally(() => {
    setTimeout(() => {
      pendingRequests.delete(key);
    }, ttl);
  });

  pendingRequests.set(key, promise);

  return promise;
}

// 在 apiRequest 中使用
export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';

  // 只对 GET 请求去重
  if (method === 'GET') {
    return deduplicateRequest(endpoint, () => performRequest<T>(endpoint, options));
  }

  return performRequest<T>(endpoint, options);
}
```

---

## 🎯 优先级排序

### 立即处理 (本周)
1. 🔴 Issue #1: 统一 API 客户端架构
2. 🔴 Issue #2: 改进 Token 缓存策略
3. 🔴 Issue #3: 环境变量验证

### 短期 (2周内)
4. 🟠 Issue #4: 优化 SWR 配置
5. 🟠 Issue #5: 增强错误处理
6. 🟠 Issue #6: 添加请求取消

### 中期 (1个月内)
7. 🟡 Issue #7: 重构 ConsoleApiClient
8. 🟡 Issue #8: 全局状态管理
9. 🟡 Issue #10: 优化 polling 策略
10. 🟡 Issue #13: 请求批处理

### 长期 (按需)
11. 🟢 Issue #9: 数据规范化
12. 🟢 Issue #11: 类型增强
13. 🟢 Issue #12: API 监控
14. 🟢 Issue #14: 请求去重

---

## 📝 总结

### 核心问题
1. **架构混乱**: 双 API 客户端导致维护成本高
2. **性能隐患**: Token 缓存、轮询配置不合理
3. **用户体验**: 错误提示不友好，缺少全局状态

### 建议行动
1. **重构 API 层**: 统一 client，优化缓存
2. **增强错误处理**: 细分错误类型，用户友好提示
3. **性能优化**: 请求批处理、智能轮询、去重

### 预期收益
- ⚡ **性能提升**: 减少 30-50% 的不必要请求
- 🎯 **用户体验**: 更清晰的错误提示和加载状态
- 🛠️ **可维护性**: 代码量减少 20-30%，逻辑更清晰

---

Last Updated: 2025-10-11
Reviewer: Claude (Anthropic)
