# 统一 API 客户端架构设计

**日期**: 2025-10-11
**状态**: 设计阶段
**优先级**: 🔴 Critical
**预计耗时**: 3-5 天

---

## 📋 问题分析

### 当前架构问题

#### 1. **双客户端架构混乱**
- `api/client.ts` (296 行): 通用 API 客户端，函数式设计
- `console-api-client.ts` (1084 行): Console 服务专用客户端，类式设计

**重复逻辑**:
- Token 获取和缓存（两处实现相同逻辑）
- 请求构造和错误处理
- Supabase session 管理
- 环境变量检查

#### 2. **设计不一致**
```typescript
// api/client.ts - 函数式
export async function apiGet<T>(endpoint: string): Promise<T> { ... }
export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> { ... }

// console-api-client.ts - 类式
class ConsoleApiClient {
  async getTokenStats(): Promise<TokenStats> { ... }
  async getOfferStats(): Promise<OfferStats> { ... }
}
export const consoleApi = new ConsoleApiClient();
```

#### 3. **URL 处理不统一**
- `api/client.ts`: 使用 `resolveApiPath()` 动态构造 URL
- `console-api-client.ts`: 使用固定 `CONSOLE_API_BASE_URL` 常量

#### 4. **类型定义分散**
- `ApiError` 定义在 `api/client.ts`
- Console 相关类型全部在 `console-api-client.ts` 中定义
- 缺少统一的类型模块

---

## 🎯 设计目标

### 核心原则

1. **DRY (Don't Repeat Yourself)**: 消除重复代码
2. **单一职责**: 每个模块只负责一件事
3. **开放封闭**: 易于扩展新的 API 服务
4. **类型安全**: 完整的 TypeScript 类型支持
5. **向后兼容**: 渐进式迁移，不破坏现有功能

### 预期收益

- ✅ 代码量减少 30%（从 1380 行 → ~950 行）
- ✅ Token 缓存逻辑统一管理
- ✅ 更好的可测试性
- ✅ 更容易添加新的 API 服务
- ✅ 统一的错误处理和日志

---

## 🏗️ 统一架构设计

### 目录结构

```
src/lib/api/
├── core/
│   ├── BaseApiClient.ts          # 基础客户端抽象类
│   ├── TokenManager.ts            # Token 缓存管理（单例）
│   ├── types.ts                   # 通用类型定义
│   └── errors.ts                  # 错误类定义
├── clients/
│   ├── MainApiClient.ts           # 主 API 客户端（原 client.ts）
│   └── ConsoleApiClient.ts        # Console API 客户端（重构）
├── types/
│   ├── console.ts                 # Console API 类型
│   └── index.ts                   # 类型导出
├── index.ts                       # 统一导出
└── resolve-api-path.ts            # 保持不变
```

---

## 📐 核心组件设计

### 1. TokenManager（Token 管理单例）

**职责**: 统一管理 Supabase token 缓存和刷新

```typescript
// src/lib/api/core/TokenManager.ts

interface TokenCacheEntry {
  value: string | null;
  source: 'supabase' | null;
  fetchedAt: number;
  expiresAt: number;
}

class TokenManager {
  private static instance: TokenManager;
  private cache: TokenCacheEntry = {
    value: null,
    source: null,
    fetchedAt: 0,
    expiresAt: 0,
  };

  private readonly REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 分钟

  private constructor() {}

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  async getToken(): Promise<{ token: string | null; source: 'supabase' | null }> {
    const now = Date.now();

    // 检查缓存
    if (
      this.cache.value &&
      this.cache.expiresAt > 0 &&
      now < this.cache.expiresAt - this.REFRESH_BUFFER_MS
    ) {
      return { token: this.cache.value, source: this.cache.source };
    }

    // 获取新 token
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        this.clearCache();
        return { token: null, source: null };
      }

      // 更新缓存
      const expiresAt = session.expires_at
        ? session.expires_at * 1000
        : now + 60 * 60 * 1000;

      this.cache = {
        value: session.access_token,
        source: 'supabase',
        fetchedAt: now,
        expiresAt,
      };

      if (process.env.NODE_ENV === 'development') {
        const expiresIn = Math.round((expiresAt - now) / 1000 / 60);
        console.log(`[TokenManager] Token 缓存更新，${expiresIn} 分钟后过期`);
      }

      return { token: session.access_token, source: 'supabase' };
    } catch (error) {
      console.error('[TokenManager] Failed to get token:', error);
      this.clearCache();
      return { token: null, source: null };
    }
  }

  clearCache(): void {
    this.cache = {
      value: null,
      source: null,
      fetchedAt: 0,
      expiresAt: 0,
    };
  }
}

export default TokenManager;
```

**优势**:
- ✅ 单例模式，全局共享一个缓存
- ✅ 消除 `api/client.ts` 和 `console-api-client.ts` 的重复逻辑
- ✅ 便于测试和 mock

---

### 2. BaseApiClient（抽象基类）

**职责**: 提供通用的 HTTP 请求方法和错误处理

```typescript
// src/lib/api/core/BaseApiClient.ts

import type { ApiError } from './errors';
import TokenManager from './TokenManager';

export interface ApiRequestOptions extends RequestInit {
  requireAuth?: boolean;
  headers?: HeadersInit;
}

abstract class BaseApiClient {
  protected readonly baseUrl: string;
  protected readonly tokenManager: TokenManager;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.tokenManager = TokenManager.getInstance();
  }

  /**
   * 构造完整 URL
   */
  protected buildUrl(endpoint: string): string {
    // 处理绝对 URL
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }

    // 处理相对路径
    const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${base}${path}`;
  }

  /**
   * 构造请求头
   */
  protected async buildHeaders(
    options: ApiRequestOptions,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    // 添加认证头
    if (options.requireAuth !== false) {
      const { token, source } = await this.tokenManager.getToken();

      if (!token) {
        throw this.createError(401, 'UNAUTHENTICATED', '尚未登录或会话失效');
      }

      headers.Authorization = `Bearer ${token}`;

      if (source === 'supabase') {
        headers['X-Supabase-Access-Token'] = token;
      }
    }

    return headers;
  }

  /**
   * 核心请求方法
   */
  protected async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(endpoint);
    const headers = await this.buildHeaders(options);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    return this.handleResponse<T>(response);
  }

  /**
   * 处理响应
   */
  protected async handleResponse<T>(response: Response): Promise<T> {
    const rawBody = await response.text();
    let parsed: unknown = undefined;

    if (rawBody) {
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        parsed = rawBody;
      }
    }

    if (!response.ok) {
      throw this.buildErrorFromResponse(response.status, response.statusText, parsed);
    }

    if (!parsed) {
      return undefined as T;
    }

    // 处理标准 API 响应格式
    if (typeof parsed === 'object') {
      const payload = parsed as { success?: boolean; data?: T; error?: any };

      if (typeof payload.success === 'boolean') {
        if (payload.success) {
          return (payload.data ?? null) as T;
        }

        const errorBlock = payload.error;
        throw this.createError(
          response.status,
          errorBlock?.code ?? 'API_ERROR',
          errorBlock?.message ?? '接口返回失败',
          errorBlock?.details,
        );
      }

      return payload as T;
    }

    return parsed as T;
  }

  /**
   * 便捷方法
   */
  protected async get<T>(endpoint: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  protected async post<T>(endpoint: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  protected async put<T>(endpoint: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  protected async patch<T>(endpoint: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  protected async delete<T>(endpoint: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * 错误处理（子类可覆盖）
   */
  protected createError(status: number, code: string, message: string, details?: unknown): ApiError {
    return new ApiError(status, code, message, details);
  }

  protected buildErrorFromResponse(status: number, fallbackMessage: string, payload: unknown): ApiError {
    if (payload && typeof payload === 'object') {
      const data = payload as Record<string, unknown>;
      const errorBlock = data.error as Record<string, unknown> | undefined;

      if (errorBlock) {
        return this.createError(
          status,
          (errorBlock.code as string) ?? 'API_ERROR',
          (errorBlock.message as string) ?? fallbackMessage,
          errorBlock.details,
        );
      }

      return this.createError(
        status,
        (data.code as string) ?? 'API_ERROR',
        (data.message as string) ?? fallbackMessage,
        data.details,
      );
    }

    return this.createError(status, 'API_ERROR', fallbackMessage);
  }
}

export default BaseApiClient;
```

**优势**:
- ✅ 所有通用逻辑集中管理
- ✅ 子类只需关注业务逻辑
- ✅ 统一的错误处理和响应解析
- ✅ 便于扩展和测试

---

### 3. MainApiClient（主 API 客户端）

**职责**: 原 `api/client.ts` 的重构版本

```typescript
// src/lib/api/clients/MainApiClient.ts

import resolveApiPath from '../resolve-api-path';
import BaseApiClient from '../core/BaseApiClient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// 环境变量检查（仅在浏览器环境）
if (!API_BASE_URL && typeof window !== 'undefined') {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[MainApiClient] CRITICAL: NEXT_PUBLIC_API_BASE_URL 未配置！' +
      'API 请求可能失败。请联系管理员。'
    );
  } else if (process.env.NODE_ENV !== 'test') {
    console.warn(
      '[MainApiClient] WARNING: NEXT_PUBLIC_API_BASE_URL 未配置。' +
      '将直接使用传入路径，这可能导致请求失败。'
    );
  }
}

class MainApiClient extends BaseApiClient {
  constructor() {
    super(API_BASE_URL);
  }

  /**
   * 覆盖 buildUrl，使用 resolveApiPath 逻辑
   */
  protected buildUrl(endpoint: string): string {
    return resolveApiPath(endpoint);
  }

  // 暴露公开方法
  async get<T>(endpoint: string, options?: any): Promise<T> {
    return super.get<T>(endpoint, options);
  }

  async post<T>(endpoint: string, body?: unknown, options?: any): Promise<T> {
    return super.post<T>(endpoint, body, options);
  }

  async put<T>(endpoint: string, body?: unknown, options?: any): Promise<T> {
    return super.put<T>(endpoint, body, options);
  }

  async patch<T>(endpoint: string, body?: unknown, options?: any): Promise<T> {
    return super.patch<T>(endpoint, body, options);
  }

  async delete<T>(endpoint: string, options?: any): Promise<T> {
    return super.delete<T>(endpoint, options);
  }
}

// 单例导出
export const mainApi = new MainApiClient();

// 保持向后兼容的函数式 API
export const apiRequest = <T>(endpoint: string, options?: any) => mainApi.request<T>(endpoint, options);
export const apiGet = <T>(endpoint: string, options?: any) => mainApi.get<T>(endpoint, options);
export const apiPost = <T>(endpoint: string, body?: unknown, options?: any) => mainApi.post<T>(endpoint, body, options);
export const apiPut = <T>(endpoint: string, body?: unknown, options?: any) => mainApi.put<T>(endpoint, body, options);
export const apiPatch = <T>(endpoint: string, body?: unknown, options?: any) => mainApi.patch<T>(endpoint, body, options);
export const apiDelete = <T>(endpoint: string, options?: any) => mainApi.delete<T>(endpoint, options);
```

**优势**:
- ✅ 继承 BaseApiClient 的所有能力
- ✅ 保持向后兼容（函数式 API 仍然可用）
- ✅ 代码量大幅减少（从 296 行 → ~80 行）

---

### 4. ConsoleApiClient（Console API 客户端重构）

**职责**: 原 `console-api-client.ts` 的重构版本

```typescript
// src/lib/api/clients/ConsoleApiClient.ts

import BaseApiClient from '../core/BaseApiClient';
import type {
  TokenStats,
  TokenBalance,
  OfferStats,
  Offer,
  // ... 其他类型
} from '../types/console';

const CONSOLE_API_BASE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_API_URL ||
  'https://console-yt54xvsg5q-an.a.run.app/api/v1/console';

class ConsoleApiClient extends BaseApiClient {
  constructor() {
    super(CONSOLE_API_BASE_URL);
  }

  // ==================== Token Management ====================
  async getTokenStats(): Promise<TokenStats> {
    return this.get<TokenStats>('/tokens/stats');
  }

  async getTokenBalances(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<{ items: TokenBalance[]; total: number; totalPages: number }> {
    const query = new URLSearchParams(params as any).toString();
    return this.get(`/tokens/balances?${query}`);
  }

  async topUpTokens(data: {
    userId: string;
    amount: number;
    reason: string;
  }): Promise<void> {
    return this.post('/tokens/topup', data);
  }

  // ==================== Offer Management ====================
  async getOfferStats(): Promise<OfferStats> {
    return this.get<OfferStats>('/offers/stats');
  }

  async getOffers(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
    userEmail?: string;
    minScore?: number;
    maxScore?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: Offer[]; total: number; totalPages: number }> {
    const query = new URLSearchParams(params as any).toString();
    return this.get(`/offers?${query}`);
  }

  // ... 其他方法（保持不变，只是使用继承的 get/post/put/delete）
}

export const consoleApi = new ConsoleApiClient();
```

**优势**:
- ✅ 不再重复实现 token 缓存逻辑
- ✅ 不再重复实现 fetchWithAuth
- ✅ 代码量减少约 40%（从 1084 行 → ~650 行）
- ✅ 更清晰的业务方法定义

---

## 🔄 迁移计划

### Phase 1: 基础设施搭建（1 天）

1. **创建 core 模块**
   - [ ] `core/errors.ts` - 移动 ApiError
   - [ ] `core/types.ts` - 通用类型定义
   - [ ] `core/TokenManager.ts` - Token 管理单例
   - [ ] `core/BaseApiClient.ts` - 抽象基类

2. **创建 types 模块**
   - [ ] `types/console.ts` - 移动 Console 类型定义
   - [ ] `types/index.ts` - 类型导出

3. **测试基础设施**
   - [ ] 编写 TokenManager 单元测试
   - [ ] 编写 BaseApiClient 单元测试

### Phase 2: 迁移 MainApiClient（1 天）

1. **创建新客户端**
   - [ ] `clients/MainApiClient.ts` - 基于 BaseApiClient
   - [ ] 保持向后兼容的函数式导出

2. **更新导出**
   - [ ] 更新 `api/index.ts`
   - [ ] 导出 ApiError 从 `core/errors.ts`

3. **测试兼容性**
   - [ ] 确保所有现有调用正常工作
   - [ ] 运行完整的 build 测试

### Phase 3: 迁移 ConsoleApiClient（1-2 天）

1. **重构客户端**
   - [ ] 继承 BaseApiClient
   - [ ] 移除重复的 token 管理逻辑
   - [ ] 简化所有 API 方法

2. **更新类型导入**
   - [ ] 所有使用 Console 类型的文件
   - [ ] 从 `api/types/console` 导入

3. **测试**
   - [ ] 测试所有 Console API 调用
   - [ ] 验证 Admin Dashboard 功能

### Phase 4: 清理和优化（0.5-1 天）

1. **删除旧文件**
   - [ ] 标记 `api/client.ts` 为 deprecated
   - [ ] 标记 `console-api-client.ts` 为 deprecated
   - [ ] 更新所有 import 路径

2. **文档更新**
   - [ ] 更新 API 使用文档
   - [ ] 添加迁移指南

3. **性能测试**
   - [ ] 验证 token 缓存工作正常
   - [ ] 测量 API 调用性能

---

## ✅ 成功标准

1. **代码质量**
   - ✅ TypeScript 0 errors
   - ✅ Build 成功
   - ✅ 所有现有功能正常工作

2. **性能指标**
   - ✅ Token 缓存命中率 > 95%
   - ✅ API 调用性能无退化
   - ✅ 构建时间无明显增加

3. **可维护性**
   - ✅ 代码量减少 30%
   - ✅ 重复代码消除
   - ✅ 新增 API 服务更容易

4. **向后兼容**
   - ✅ 所有现有 API 调用无需修改
   - ✅ 渐进式迁移，不破坏现有功能

---

## 📅 时间规划

| 阶段 | 任务 | 预计耗时 | 状态 |
|-----|------|---------|------|
| Phase 1 | 基础设施搭建 | 1 天 | ⏳ Pending |
| Phase 2 | MainApiClient 迁移 | 1 天 | ⏳ Pending |
| Phase 3 | ConsoleApiClient 迁移 | 1-2 天 | ⏳ Pending |
| Phase 4 | 清理和优化 | 0.5-1 天 | ⏳ Pending |
| **总计** | | **3.5-5 天** | |

---

## 🚀 下一步行动

1. **立即开始 Phase 1**：创建 `core/` 目录结构
2. **实现 TokenManager**：最关键的共享组件
3. **实现 BaseApiClient**：抽象基类框架
4. **编写单元测试**：确保基础设施稳定

**准备好开始了吗？**

---

**Created**: 2025-10-11 20:45
**Author**: Claude (Anthropic)
**Status**: ✅ Design Complete, Ready for Implementation
