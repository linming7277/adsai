# 前端错误处理适配指南

> 创建日期: 2025-01-12
> 适用版本: Frontend v2.0+
> 后端兼容: 支持新旧错误格式

---

## 📊 概述

本指南帮助前端开发者适配新的标准化错误格式，实现更好的用户体验和错误处理。

**核心特性**:
- ✅ 向后兼容旧错误格式
- ✅ 支持详细的错误分类
- ✅ 自动重试判断
- ✅ 提供建议操作
- ✅ TypeScript类型安全

---

## 🔧 TypeScript类型定义

### 1. 标准化错误类型

```typescript
// apps/frontend/src/lib/api/types/errors.ts

/**
 * 标准化API错误响应
 */
export interface APIError {
  /** 业务错误码 (如 "OFFER_NOT_FOUND") */
  code: string;
  /** 错误消息 (人类可读) */
  message: string;
  /** 详细信息 (可选) */
  details?: Record<string, any>;
  /** 是否可重试 */
  retryable: boolean;
  /** 建议操作 (可选) */
  suggestedAction?: string;
  /** 追踪ID (可选) */
  traceId?: string;
}

/**
 * API错误响应包装
 */
export interface APIErrorResponse {
  error: APIError;
}

/**
 * 旧版错误格式 (向后兼容)
 */
export interface LegacyErrorResponse {
  error: string;
}

/**
 * Offer评估失败详情
 */
export interface EvaluationFailureDetails {
  category: 'network' | 'invalid_url' | 'timeout' | 'rate_limit' | 'content_policy' | 'internal_error';
  error?: string;
  url?: string;
  estimatedRetryTime?: string; // ISO 8601格式
}

/**
 * 任务状态错误详情
 */
export interface TaskStateDetails {
  taskId: string;
  currentState?: string;
  reason?: string;
}
```

### 2. 错误码常量

```typescript
// apps/frontend/src/lib/api/types/error-codes.ts

/**
 * 标准化错误码常量
 */
export const ErrorCodes = {
  // 通用错误
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TIMEOUT: 'TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Token相关
  TOKEN_INSUFFICIENT: 'TOKEN_INSUFFICIENT',
  TOKEN_QUOTA_EXCEEDED: 'TOKEN_QUOTA_EXCEEDED',

  // Offer相关
  OFFER_NOT_FOUND: 'OFFER_NOT_FOUND',
  OFFER_EVALUATION_FAILED: 'OFFER_EVALUATION_FAILED',
  OFFER_INVALID_URL: 'OFFER_INVALID_URL',
  OFFER_DUPLICATE: 'OFFER_DUPLICATE',
  OFFER_INVALID_STATE: 'OFFER_INVALID_STATE',

  // Ads相关
  ADS_SYNC_FAILED: 'ADS_SYNC_FAILED',
  ADS_OAUTH_EXPIRED: 'ADS_OAUTH_EXPIRED',
  ADS_ACCOUNT_SUSPENDED: 'ADS_ACCOUNT_SUSPENDED',

  // 任务相关
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_TIMEOUT: 'TASK_TIMEOUT',
  TASK_CANCELLED: 'TASK_CANCELLED',
  TASK_FAILED: 'TASK_FAILED',
  TASK_INVALID_STATE: 'TASK_INVALID_STATE',

  // 网络相关
  NETWORK_CONNECTION_FAILED: 'NETWORK_CONNECTION_FAILED',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',

  // 限流
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

---

## 🛠️ 错误处理工具函数

### 1. 错误解析器

```typescript
// apps/frontend/src/lib/api/core/error-parser.ts

import { APIError, APIErrorResponse, LegacyErrorResponse } from '../types/errors';

/**
 * 判断是否为新格式错误
 */
export function isAPIError(response: any): response is APIErrorResponse {
  return (
    response &&
    typeof response === 'object' &&
    'error' in response &&
    typeof response.error === 'object' &&
    'code' in response.error &&
    'message' in response.error
  );
}

/**
 * 判断是否为旧格式错误
 */
export function isLegacyError(response: any): response is LegacyErrorResponse {
  return (
    response &&
    typeof response === 'object' &&
    'error' in response &&
    typeof response.error === 'string'
  );
}

/**
 * 解析API错误 (支持新旧格式)
 */
export function parseAPIError(response: any): APIError {
  // 新格式
  if (isAPIError(response)) {
    return response.error;
  }

  // 旧格式 - 转换为新格式
  if (isLegacyError(response)) {
    return {
      code: 'INTERNAL_ERROR',
      message: response.error,
      retryable: false,
    };
  }

  // 未知格式 - 返回默认错误
  return {
    code: 'INTERNAL_ERROR',
    message: '发生未知错误',
    retryable: false,
  };
}

/**
 * 获取用户友好的错误消息
 */
export function getUserFriendlyMessage(error: APIError): string {
  // 优先使用suggestedAction
  if (error.suggestedAction) {
    return error.suggestedAction;
  }

  // 使用message
  return error.message || '操作失败，请稍后重试';
}

/**
 * 判断是否应该显示重试按钮
 */
export function shouldShowRetry(error: APIError): boolean {
  return error.retryable === true;
}

/**
 * 获取建议重试时间
 */
export function getRetryTime(error: APIError): Date | null {
  const retryTimeStr = error.details?.estimatedRetryTime;
  if (!retryTimeStr) return null;

  try {
    return new Date(retryTimeStr);
  } catch {
    return null;
  }
}
```

### 2. BaseApiClient集成

```typescript
// apps/frontend/src/lib/api/core/BaseApiClient.ts (修改)

import { parseAPIError, APIError } from './error-parser';

export class BaseApiClient {
  // ... 现有代码 ...

  protected async request<T>(
    method: string,
    path: string,
    options?: RequestOptions
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal,
      });

      if (!response.ok) {
        // 解析错误响应
        const errorData = await response.json();
        const apiError = parseAPIError(errorData);

        // 抛出带详细信息的错误
        throw new APIClientError(
          apiError.message,
          response.status,
          apiError
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof APIClientError) {
        throw error;
      }

      // 网络错误等
      throw new APIClientError(
        '网络请求失败',
        0,
        {
          code: 'NETWORK_CONNECTION_FAILED',
          message: '网络请求失败',
          retryable: true,
        }
      );
    }
  }
}

/**
 * API客户端错误类
 */
export class APIClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public apiError: APIError
  ) {
    super(message);
    this.name = 'APIClientError';
  }

  get code(): string {
    return this.apiError.code;
  }

  get retryable(): boolean {
    return this.apiError.retryable;
  }

  get details(): Record<string, any> | undefined {
    return this.apiError.details;
  }
}
```

---

## 🎯 React错误处理组件

### 1. ErrorDisplay组件

```typescript
// apps/frontend/src/components/errors/ErrorDisplay.tsx

import { AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { APIError } from '@/lib/api/types/errors';
import { ErrorCodes } from '@/lib/api/types/error-codes';
import { getUserFriendlyMessage, shouldShowRetry, getRetryTime } from '@/lib/api/core/error-parser';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useEffect, useState } from 'react';

interface ErrorDisplayProps {
  error: APIError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorDisplay({ error, onRetry, onDismiss }: ErrorDisplayProps) {
  const message = getUserFriendlyMessage(error);
  const canRetry = shouldShowRetry(error);
  const retryTime = getRetryTime(error);
  const [countdown, setCountdown] = useState<number>(0);

  useEffect(() => {
    if (!retryTime) return;

    const updateCountdown = () => {
      const now = Date.now();
      const diff = retryTime.getTime() - now;
      setCountdown(Math.max(0, Math.ceil(diff / 1000)));
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, [retryTime]);

  // 根据错误码自定义样式
  const variant = getAlertVariant(error.code);
  const icon = getErrorIcon(error.code);

  return (
    <Alert variant={variant} className="my-4">
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1">
          <AlertTitle>
            {getErrorTitle(error.code)}
          </AlertTitle>
          <AlertDescription className="mt-2">
            {message}
          </AlertDescription>

          {/* 详细信息 (开发模式) */}
          {process.env.NODE_ENV === 'development' && error.details && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                查看详细信息
              </summary>
              <pre className="mt-2 overflow-auto rounded bg-muted p-2">
                {JSON.stringify(error.details, null, 2)}
              </pre>
            </details>
          )}

          {/* 操作按钮 */}
          <div className="mt-4 flex gap-2">
            {canRetry && onRetry && (
              <Button
                onClick={onRetry}
                disabled={countdown > 0}
                size="sm"
                variant="outline"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {countdown > 0 ? `等待 ${countdown}秒` : '重试'}
              </Button>
            )}

            {onDismiss && (
              <Button onClick={onDismiss} size="sm" variant="ghost">
                关闭
              </Button>
            )}
          </div>
        </div>
      </div>
    </Alert>
  );
}

function getAlertVariant(code: string): 'default' | 'destructive' {
  // 可重试的错误使用warning样式
  if (
    code === ErrorCodes.NETWORK_CONNECTION_FAILED ||
    code === ErrorCodes.TIMEOUT ||
    code === ErrorCodes.RATE_LIMIT_EXCEEDED
  ) {
    return 'default';
  }

  // 不可重试的错误使用error样式
  return 'destructive';
}

function getErrorIcon(code: string) {
  if (code === ErrorCodes.RATE_LIMIT_EXCEEDED) {
    return <Clock className="h-5 w-5" />;
  }

  return <AlertCircle className="h-5 w-5" />;
}

function getErrorTitle(code: string): string {
  switch (code) {
    case ErrorCodes.NETWORK_CONNECTION_FAILED:
      return '网络连接失败';
    case ErrorCodes.TIMEOUT:
      return '请求超时';
    case ErrorCodes.RATE_LIMIT_EXCEEDED:
      return '请求过于频繁';
    case ErrorCodes.TOKEN_INSUFFICIENT:
      return 'Token余额不足';
    case ErrorCodes.OFFER_INVALID_URL:
      return 'URL格式无效';
    case ErrorCodes.TASK_INVALID_STATE:
      return '任务状态错误';
    default:
      return '操作失败';
  }
}
```

### 2. useErrorHandler Hook

```typescript
// apps/frontend/src/hooks/use-error-handler.ts

import { useState, useCallback } from 'react';
import { APIError } from '@/lib/api/types/errors';
import { APIClientError } from '@/lib/api/core/BaseApiClient';
import { parseAPIError } from '@/lib/api/core/error-parser';
import { toast } from 'sonner';

interface UseErrorHandlerOptions {
  showToast?: boolean;
  onError?: (error: APIError) => void;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const [error, setError] = useState<APIError | null>(null);

  const handleError = useCallback((err: unknown) => {
    let apiError: APIError;

    if (err instanceof APIClientError) {
      apiError = err.apiError;
    } else if (err instanceof Error) {
      apiError = {
        code: 'INTERNAL_ERROR',
        message: err.message,
        retryable: false,
      };
    } else {
      apiError = parseAPIError(err);
    }

    setError(apiError);

    // 显示toast通知
    if (options.showToast) {
      toast.error(apiError.message, {
        description: apiError.suggestedAction,
      });
    }

    // 调用自定义错误处理
    options.onError?.(apiError);
  }, [options]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    handleError,
    clearError,
  };
}
```

---

## 💡 实际使用示例

### 1. Offer创建页面

```typescript
// apps/frontend/src/app/offers/new/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { ErrorDisplay } from '@/components/errors/ErrorDisplay';
import { offersApi } from '@/lib/api/clients/MainApiClient';
import { ErrorCodes } from '@/lib/api/types/error-codes';

export default function NewOfferPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { error, handleError, clearError } = useErrorHandler();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsLoading(true);

    try {
      const offer = await offersApi.createOffer({ url });
      router.push(`/offers/${offer.id}`);
    } catch (err) {
      handleError(err);

      // 特殊错误处理
      if (err instanceof APIClientError) {
        switch (err.code) {
          case ErrorCodes.OFFER_INVALID_URL:
            // 高亮URL输入框
            document.getElementById('url-input')?.focus();
            break;

          case ErrorCodes.TOKEN_INSUFFICIENT:
            // 跳转到充值页面
            router.push('/billing/recharge');
            break;
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    clearError();
    handleSubmit(new Event('submit') as any);
  };

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-2xl font-bold mb-6">创建新Offer</h1>

      {/* 错误显示 */}
      {error && (
        <ErrorDisplay
          error={error}
          onRetry={error.retryable ? handleRetry : undefined}
          onDismiss={clearError}
        />
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="url-input" className="block text-sm font-medium mb-2">
              Offer URL
            </label>
            <input
              id="url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-2 border rounded"
              placeholder="https://example.com/offer"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-white py-2 rounded"
          >
            {isLoading ? '创建中...' : '创建Offer'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

### 2. 任务列表页面

```typescript
// apps/frontend/src/app/dashboard/tasks/page.tsx

'use client';

import { useTasksList } from '@/lib/tasks/hooks';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { ErrorDisplay } from '@/components/errors/ErrorDisplay';
import { ErrorCodes } from '@/lib/api/types/error-codes';

export default function TasksPage() {
  const { data, error, isLoading, mutate } = useTasksList({
    limit: 20,
    offset: 0,
  });

  const { handleError } = useErrorHandler({ showToast: true });

  const handleCancelTask = async (taskId: string) => {
    try {
      await tasksApi.cancelTask(taskId, { reason: '用户取消' });
      mutate(); // 刷新列表
    } catch (err) {
      if (err instanceof APIClientError && err.code === ErrorCodes.TASK_INVALID_STATE) {
        // 任务状态不允许取消
        toast.error('无法取消该任务', {
          description: err.apiError.suggestedAction,
        });
      } else {
        handleError(err);
      }
    }
  };

  if (isLoading) {
    return <div>加载中...</div>;
  }

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        onRetry={() => mutate()}
      />
    );
  }

  return (
    <div>
      {/* 任务列表渲染 */}
    </div>
  );
}
```

### 3. 全局错误边界

```typescript
// apps/frontend/src/components/ErrorBoundary.tsx

'use client';

import { Component, ReactNode } from 'react';
import { ErrorDisplay } from './errors/ErrorDisplay';
import { APIError } from '@/lib/api/types/errors';

interface Props {
  children: ReactNode;
}

interface State {
  error: APIError | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
        retryable: false,
      },
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container max-w-2xl py-8">
          <ErrorDisplay
            error={this.state.error}
            onDismiss={() => this.setState({ error: null })}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## 📊 错误监控和分析

### 1. 错误上报

```typescript
// apps/frontend/src/lib/monitoring/error-reporter.ts

import { APIError } from '@/lib/api/types/errors';

export function reportError(error: APIError, context?: Record<string, any>) {
  // 发送到错误监控服务 (如Sentry)
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'api_error', {
      error_code: error.code,
      error_message: error.message,
      retryable: error.retryable,
      ...context,
    });
  }

  // 也可以发送到自己的分析服务
  fetch('/api/analytics/errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    }),
  }).catch(() => {
    // 忽略上报失败
  });
}
```

### 2. 错误统计Hook

```typescript
// apps/frontend/src/hooks/use-error-analytics.ts

import { useEffect } from 'react';
import { APIError } from '@/lib/api/types/errors';
import { reportError } from '@/lib/monitoring/error-reporter';

export function useErrorAnalytics(error: APIError | null, context?: Record<string, any>) {
  useEffect(() => {
    if (error) {
      reportError(error, context);
    }
  }, [error, context]);
}
```

---

## ✅ 迁移检查清单

### Phase 1: 基础设施 (1天)
- [ ] 创建类型定义文件 (`types/errors.ts`, `types/error-codes.ts`)
- [ ] 实现错误解析器 (`error-parser.ts`)
- [ ] 修改 `BaseApiClient` 支持新错误格式
- [ ] 创建 `APIClientError` 类

### Phase 2: UI组件 (1天)
- [ ] 创建 `ErrorDisplay` 组件
- [ ] 创建 `useErrorHandler` Hook
- [ ] 创建 `ErrorBoundary` 组件
- [ ] 添加错误图标和样式

### Phase 3: 集成到现有页面 (2-3天)
- [ ] Offer创建/列表页面
- [ ] Task列表/详情页面
- [ ] Ads同步页面
- [ ] 用户设置页面
- [ ] 测试所有错误场景

### Phase 4: 监控和优化 (1天)
- [ ] 集成错误上报
- [ ] 添加错误分析
- [ ] 优化用户体验
- [ ] 编写文档

---

## 📈 预期收益

### 用户体验
- **错误理解度**: +100% (明确的错误分类和建议)
- **自助解决率**: +60% (提供可操作的建议)
- **重试成功率**: +40% (智能重试策略)

### 开发效率
- **错误调试时间**: -50% (详细的错误信息)
- **集成成本**: -70% (统一的错误处理)
- **维护成本**: -60% (类型安全和代码复用)

---

## 🔗 相关资源

- [Offer失败分类文档](./OFFER_FAILURE_CLASSIFICATION.md)
- [P1后端增强总结](./P1_BACKEND_ENHANCEMENTS_SUMMARY.md)
- [后端API需求](./BACKEND_API_REQUIREMENTS.md)

---

**最后更新**: 2025-01-12
**维护者**: AutoAds Frontend Team
