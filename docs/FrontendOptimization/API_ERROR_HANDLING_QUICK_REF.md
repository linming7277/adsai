# API错误处理和分页 - 快速参考

> 最后更新: 2025-01-12
> 适用版本: v1.0.0+

---

## 🚀 快速开始

### 后端 - 错误处理

```go
import "github.com/linming7277/adsai/pkg/apierrors"

// 资源未找到
err := apierrors.NotFound("Offer", offerID)
err.WriteJSON(w, r)

// 参数无效
err := apierrors.InvalidRequest("url", "URL格式无效")
err.WriteJSON(w, r)

// Token不足
err := apierrors.TokenInsufficient(required, available)
err.WriteJSON(w, r)

// 内部错误
err := apierrors.InternalError("数据库连接失败")
err.WriteJSON(w, r)

// 限流
err := apierrors.RateLimited(60) // 60秒后重试
err.WriteJSON(w, r)
```

### 后端 - 分页

```go
import "github.com/linming7277/adsai/pkg/pagination"

// 1. 解析参数
limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
limit, offset = pagination.ParseParams(limit, offset)

// 2. 查询数据
offers := []Offer{...}
total := 150

// 3. 返回响应
response := pagination.NewPaginatedResponse(offers, total, limit, offset)
json.NewEncoder(w).Encode(response)
```

### 后端 - Offer评估失败

```go
import "github.com/linming7277/adsai/services/offer/internal/evaluation"

err := evaluateOffer(url)
if err != nil {
    // 自动分类错误
    reason := evaluation.ClassifyError(err)

    // 转换为API错误并返回
    apiErr := reason.ToAPIError()
    apiErr.WriteJSON(w, r)
    return
}
```

### 前端 - 错误处理

```typescript
import { useErrorHandler } from '@/hooks/use-error-handler';
import { ErrorDisplay } from '@/components/errors/ErrorDisplay';

const { error, handleError, clearError } = useErrorHandler();

try {
  await api.createOffer(url);
} catch (err) {
  handleError(err);
}

return (
  <ErrorDisplay
    error={error}
    onRetry={error?.retryable ? handleRetry : undefined}
    onDismiss={clearError}
  />
);
```

---

## 📖 错误码速查表

### 通用错误

| 错误码 | HTTP状态 | 可重试 | 使用场景 |
|--------|---------|--------|----------|
| `INTERNAL_ERROR` | 500 | ❌ | 服务器内部错误 |
| `INVALID_REQUEST` | 400 | ❌ | 请求参数无效 |
| `NOT_FOUND` | 404 | ❌ | 资源不存在 |
| `UNAUTHORIZED` | 401 | ❌ | 未认证 |
| `FORBIDDEN` | 403 | ❌ | 无权限 |
| `TIMEOUT` | 408 | ✅ | 请求超时 |
| `SERVICE_UNAVAILABLE` | 503 | ✅ | 服务不可用 |

### Token相关

| 错误码 | HTTP状态 | 可重试 | 使用场景 |
|--------|---------|--------|----------|
| `TOKEN_INSUFFICIENT` | 403 | ❌ | Token余额不足 |
| `TOKEN_QUOTA_EXCEEDED` | 403 | ❌ | Token配额超限 |
| `TOKEN_TRANSACTION_FAILED` | 422 | ❌ | Token交易失败 |

### Offer相关

| 错误码 | HTTP状态 | 可重试 | 使用场景 |
|--------|---------|--------|----------|
| `OFFER_NOT_FOUND` | 404 | ❌ | Offer不存在 |
| `OFFER_EVALUATION_FAILED` | 422 | ✅ | 评估失败 |
| `OFFER_INVALID_URL` | 400 | ❌ | URL格式无效 |
| `OFFER_DUPLICATE` | 409 | ❌ | Offer已存在 |
| `OFFER_INVALID_STATE` | 400 | ❌ | 状态不允许操作 |

### Ads相关

| 错误码 | HTTP状态 | 可重试 | 使用场景 |
|--------|---------|--------|----------|
| `ADS_SYNC_FAILED` | 422 | ✅ | 广告同步失败 |
| `ADS_OAUTH_EXPIRED` | 401 | ❌ | OAuth令牌过期 |
| `ADS_ACCOUNT_SUSPENDED` | 403 | ❌ | 广告账号暂停 |
| `ADS_ACCOUNT_NOT_FOUND` | 404 | ❌ | 广告账号不存在 |
| `ADS_RATE_LIMITED` | 429 | ✅ | API限流 |

### 任务相关

| 错误码 | HTTP状态 | 可重试 | 使用场景 |
|--------|---------|--------|----------|
| `TASK_NOT_FOUND` | 404 | ❌ | 任务不存在 |
| `TASK_TIMEOUT` | 408 | ✅ | 任务超时 |
| `TASK_CANCELLED` | 200 | ❌ | 任务已取消 |
| `TASK_FAILED` | 422 | ❌ | 任务失败 |
| `TASK_INVALID_STATE` | 400 | ❌ | 状态不允许操作 |

### 网络相关

| 错误码 | HTTP状态 | 可重试 | 使用场景 |
|--------|---------|--------|----------|
| `NETWORK_CONNECTION_FAILED` | 503 | ✅ | 网络连接失败 |
| `NETWORK_TIMEOUT` | 408 | ✅ | 网络超时 |

### 限流相关

| 错误码 | HTTP状态 | 可重试 | 使用场景 |
|--------|---------|--------|----------|
| `RATE_LIMIT_EXCEEDED` | 429 | ✅ | 请求过于频繁 |
| `CONCURRENCY_LIMIT_EXCEEDED` | 429 | ✅ | 并发数超限 |

---

## 🎯 Offer评估失败分类

### 失败类型速查

| 分类 | 可重试 | 重试延迟 | 触发条件 |
|------|--------|----------|----------|
| `network` | ✅ | 30秒 | connection refused, no such host, dns |
| `invalid_url` | ❌ | - | invalid url, malformed url, unsupported protocol |
| `timeout` | ✅ | 1分钟 | timeout, deadline exceeded |
| `rate_limit` | ✅ | 5分钟 | rate limit, too many requests, 429 |
| `content_policy` | ❌ | - | 内容违规 |
| `internal_error` | ✅ | 2分钟 | 其他错误 |

---

## 📦 分页响应格式

### 标准格式

```json
{
  "data": [
    { "id": "1", "name": "Item 1" },
    { "id": "2", "name": "Item 2" }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true,
    "nextOffset": 50
  }
}
```

### 参数说明

| 参数 | 类型 | 说明 |
|------|------|------|
| `limit` | int | 每页数量 (默认50, 最大100) |
| `offset` | int | 偏移量 (默认0, 最小0) |
| `total` | int | 总记录数 |
| `hasMore` | bool | 是否还有更多数据 |
| `nextOffset` | int? | 下一页offset (可选) |

---

## 📚 相关文档链接

- [完整实施总结](./P1_IMPLEMENTATION_SUMMARY.md)
- [Offer失败分类详解](./OFFER_FAILURE_CLASSIFICATION.md)
- [前端错误处理指南](./FRONTEND_ERROR_HANDLING_GUIDE.md)
- [后端API需求文档](./BACKEND_API_REQUIREMENTS.md)

---

**最后更新**: 2025-01-12
**维护者**: AdsAI Team
