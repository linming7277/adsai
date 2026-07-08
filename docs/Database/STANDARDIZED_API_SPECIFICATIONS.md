# AdsAI 标准化API规范

**文档版本**: v1.0
**创建日期**: 2025-10-19
**设计目标**: 建立统一的服务间API访问标准，确保数据安全和性能优化

---

## 📋 设计原则

### 核心原则
1. **统一性**: 所有服务遵循相同的API设计模式
2. **安全性**: 通过db-admin服务统一管理数据库访问
3. **性能**: 优化的查询模式和缓存策略
4. **可观测性**: 完整的日志、指标和追踪
5. **容错性**: 优雅的错误处理和重试机制

### 架构模式
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │───▶│   API Gateway   │───▶│  Business APIs  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                      │
                                                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Admin Panel   │───▶│  Service Mesh   │───▶│   DB Admin API  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                      │
                                                      ▼
                                              ┌─────────────────┐
                                              │   New Database  │
                                              │    (Domains)    │
                                              └─────────────────┘
```

---

## 🔐 认证和授权规范

### JWT Token 结构
```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT",
    "kid": "key-id"
  },
  "payload": {
    "sub": "user-uuid",
    "email": "user@example.com",
    "role": "user|admin|service",
    "permissions": ["read:profile", "write:offers"],
    "service_id": "service-uuid", // 仅服务间调用
    "issued_at": 1695062400,
    "expires_at": 1695148800,
    "scope": "api:read api:write"
  }
}
```

### API密钥认证 (服务间)
```yaml
# 服务间认证头
X-Service-ID: "recommendations-service"
X-API-Key: "sk_live_example_key_replace_with_actual_key"
X-Timestamp: "2025-10-19T10:30:00Z"
X-Signature: "sha256=calculated_hmac_signature"
```

### 权限矩阵
| 域 (Domain) | 用户权限 | 服务权限 | 管理员权限 |
|--------------|----------|----------|------------|
| user_domain | read:own, write:own | read:all, write:all | full:all |
| billing_domain | read:own, write:own | read:all, write:limited | full:all |
| offer_domain | read:own, write:own | read:all, write:all | full:all |
| ads_domain | read:own, write:own | read:all, write:all | full:all |
| activity_domain | read:own, write:own | read:all, write:all | full:all |

---

## 📊 通用API响应格式

### 标准响应结构
```json
{
  "success": true,
  "data": {
    // 实际数据内容
  },
  "meta": {
    "request_id": "req_123456789",
    "timestamp": "2025-10-19T10:30:00Z",
    "version": "v1",
    "service": "user-service",
    "execution_time_ms": 45
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  },
  "links": {
    "self": "/api/v1/users?page=1&limit=20",
    "next": "/api/v1/users?page=2&limit=20",
    "prev": null,
    "first": "/api/v1/users?page=1&limit=20",
    "last": "/api/v1/users?page=8&limit=20"
  }
}
```

### 错误响应结构
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format",
        "code": "INVALID_FORMAT"
      }
    ],
    "request_id": "req_123456789",
    "timestamp": "2025-10-19T10:30:00Z",
    "trace_id": "trace_123456789"
  },
  "meta": {
    "request_id": "req_123456789",
    "timestamp": "2025-10-19T10:30:00Z",
    "service": "user-service",
    "execution_time_ms": 12
  }
}
```

### 错误代码规范
```yaml
# 通用错误代码
VALIDATION_ERROR: 400
UNAUTHORIZED: 401
FORBIDDEN: 403
NOT_FOUND: 404
CONFLICT: 409
RATE_LIMITED: 429
INTERNAL_ERROR: 500
SERVICE_UNAVAILABLE: 503

# 业务特定错误代码
USER_NOT_FOUND: 404001
INSUFFICIENT_TOKENS: 402001
OFFER_NOT_ACCESSIBLE: 403001
ACCOUNT_SYNC_FAILED: 503001
```

---

## 🏗️ 数据域API规范

### 1. 用户域 (User Domain) API

#### 用户信息管理
```yaml
# 获取当前用户信息
GET /api/v1/users/me
Response: {
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar_url": "https://example.com/avatar.jpg",
    "status": "active",
    "created_at": "2025-01-01T00:00:00Z",
    "preferences": {
      "notifications": true,
      "theme": "light"
    }
  }
}

# 更新用户信息
PUT /api/v1/users/me
Request: {
  "name": "John Smith",
  "avatar_url": "https://example.com/new-avatar.jpg"
}
Response: {
  "success": true,
  "data": { /* 更新后的用户信息 */ }
}

# 获取用户偏好设置
GET /api/v1/users/me/preferences
Response: {
  "success": true,
  "data": {
    "email_notifications": true,
    "push_notifications": false,
    "theme": "light",
    "language": "en",
    "timezone": "America/New_York"
  }
}

# 更新偏好设置
PATCH /api/v1/users/me/preferences
Request: {
  "theme": "dark",
  "email_notifications": false
}
```

#### 用户会话管理
```yaml
# 获取活跃会话
GET /api/v1/users/me/sessions
Response: {
  "success": true,
  "data": [
    {
      "id": "session-uuid",
      "device_info": {
        "user_agent": "Mozilla/5.0...",
        "ip_address": "192.168.1.1"
      },
      "created_at": "2025-10-19T09:00:00Z",
      "expires_at": "2025-10-19T21:00:00Z",
      "is_active": true
    }
  ]
}

# 终止指定会话
DELETE /api/v1/users/me/sessions/{session_id}
Response: {
  "success": true,
  "message": "Session terminated successfully"
}

# 终止所有其他会话
DELETE /api/v1/users/me/sessions/others
```

### 2. 计费域 (Billing Domain) API

#### 账户信息
```yaml
# 获取账户信息
GET /api/v1/billing/account
Response: {
  "success": true,
  "data": {
    "account_type": "premium",
    "status": "active",
    "balance_cents": 5000,
    "currency": "USD",
    "credit_limit_cents": 10000,
    "created_at": "2025-01-01T00:00:00Z"
  }
}

# 获取代币余额
GET /api/v1/billing/tokens
Response: {
  "success": true,
  "data": [
    {
      "token_type": "search",
      "balance": 1500,
      "last_updated": "2025-10-19T10:00:00Z"
    },
    {
      "token_type": "analysis",
      "balance": 750,
      "last_updated": "2025-10-19T10:00:00Z"
    }
  ]
}

# 获取交易历史
GET /api/v1/billing/transactions?page=1&limit=20
Response: {
  "success": true,
  "data": [
    {
      "id": "tx-uuid",
      "token_type": "search",
      "amount": -100,
      "balance_before": 1600,
      "balance_after": 1500,
      "transaction_type": "consumption",
      "description": "Keyword search analysis",
      "created_at": "2025-10-19T09:30:00Z"
    }
  ],
  "pagination": { /* 分页信息 */ }
}
```

#### 订阅管理
```yaml
# 获取订阅信息
GET /api/v1/billing/subscription
Response: {
  "success": true,
  "data": {
    "id": "sub-uuid",
    "plan_name": "Professional",
    "status": "active",
    "current_period_start": "2025-10-01T00:00:00Z",
    "current_period_end": "2025-11-01T00:00:00Z",
    "amount_cents": 4900,
    "currency": "USD",
    "auto_renew": true,
    "next_billing_date": "2025-11-01T00:00:00Z"
  }
}

# 更新订阅
PATCH /api/v1/billing/subscription
Request: {
  "auto_renew": false
}
```

### 3. Offer域 (Offer Domain) API

#### Offer管理
```yaml
# 获取Offer列表
GET /api/v1/offers?page=1&limit=20&status=active&sort=updated_at:desc
Response: {
  "success": true,
  "data": [
    {
      "id": "offer-uuid",
      "title": "Marketing Campaign for Product X",
      "description": "Comprehensive marketing strategy...",
      "brand_name": "Brand X",
      "status": "active",
      "visibility": "private",
      "created_at": "2025-10-15T00:00:00Z",
      "updated_at": "2025-10-19T08:00:00Z",
      "ai_score": 0.85,
      "analysis_status": "completed"
    }
  ]
}

# 创建新Offer
POST /api/v1/offers
Request: {
  "title": "New Marketing Campaign",
  "description": "Campaign description",
  "brand_name": "Brand Name",
  "product_category": "technology",
  "target_audience": {
    "age_range": "25-45",
    "interests": ["technology", "business"]
  },
  "budget_range": {
    "min_cents": 100000,
    "max_cents": 500000
  }
}
Response: {
  "success": true,
  "data": { /* 创建的Offer信息 */ }
}

# 获取Offer详情
GET /api/v1/offers/{offer_id}
Response: {
  "success": true,
  "data": {
    "id": "offer-uuid",
    "title": "Marketing Campaign",
    // ... 基本信息
    "analysis_results": [
      {
        "analysis_type": "market_analysis",
        "ai_score": 0.85,
        "confidence_score": 0.92,
        "insights": ["Market opportunity identified"],
        "created_at": "2025-10-18T15:00:00Z"
      }
    ],
    "keywords": [
      {
        "keyword": "digital marketing",
        "relevance_score": 0.95,
        "search_volume": 50000,
        "competition_level": "high"
      }
    ],
    "competitors": [
      {
        "competitor_name": "Competitor A",
        "market_position": "Market Leader",
        "strengths": ["Strong brand recognition"],
        "weaknesses": ["Limited innovation"]
      }
    ]
  }
}
```

#### 分析管理
```yaml
# 请求Offer分析
POST /api/v1/offers/{offer_id}/analysis
Request: {
  "analysis_types": ["market_analysis", "keyword_analysis"],
  "priority": "normal"
}
Response: {
  "success": true,
  "data": {
    "analysis_request_id": "req-uuid",
    "status": "queued",
    "estimated_completion": "2025-10-19T11:00:00Z"
  }
}

# 获取分析结果
GET /api/v1/offers/{offer_id}/analysis/{analysis_id}
Response: {
  "success": true,
  "data": {
    "id": "analysis-uuid",
    "analysis_type": "market_analysis",
    "status": "completed",
    "ai_score": 0.85,
    "confidence_score": 0.92,
    "analysis_data": {
      "market_size": "$2.5B",
      "growth_rate": "15% YoY",
      "key_trends": ["Digital transformation", "AI integration"]
    },
    "insights": [
      "Market shows strong growth potential",
      "Competition increasing but still manageable"
    ],
    "recommendations": [
      "Focus on digital channels",
      "Leverage AI-powered targeting"
    ],
    "created_at": "2025-10-18T15:00:00Z"
  }
}
```

### 4. 广告域 (Ads Domain) API

#### 账户连接管理
```yaml
# 获取广告账户连接
GET /api/v1/ads/accounts
Response: {
  "success": true,
  "data": [
    {
      "id": "connection-uuid",
      "platform": "google_ads",
      "platform_account_id": "123-456-7890",
      "platform_account_name": "My Google Ads Account",
      "status": "active",
      "sync_status": "completed",
      "last_sync": "2025-10-19T09:00:00Z",
      "permissions": ["read", "write"]
    }
  ]
}

# 连接广告账户
POST /api/v1/ads/accounts
Request: {
  "platform": "google_ads",
  "platform_account_id": "123-456-7890",
  "access_token": "oauth_access_token",
  "refresh_token": "oauth_refresh_token"
}
Response: {
  "success": true,
  "data": { /* 连接信息 */ }
}

# 同步账户数据
POST /api/v1/ads/accounts/{account_id}/sync
Response: {
  "success": true,
  "data": {
    "sync_job_id": "sync-uuid",
    "status": "started",
    "estimated_completion": "2025-10-19T10:05:00Z"
  }
}
```

#### 活动管理
```yaml
# 获取活动列表
GET /api/v1/ads/campaigns?account_id={account_id}&status=enabled
Response: {
  "success": true,
  "data": [
    {
      "id": "campaign-uuid",
      "platform_campaign_id": "camp-123",
      "campaign_name": "Summer Sale 2025",
      "status": "enabled",
      "budget_amount_cents": 500000,
      "budget_type": "daily",
      "start_date": "2025-06-01",
      "end_date": "2025-08-31",
      "performance_summary": {
        "impressions": 1500000,
        "clicks": 15000,
        "conversions": 750,
        "cost_cents": 300000,
        "ctr": 0.01,
        "cpc_cents": 20,
        "conversion_rate": 0.05
      }
    }
  ]
}

# 获取活动性能数据
GET /api/v1/ads/campaigns/{campaign_id}/performance?start_date=2025-10-01&end_date=2025-10-19
Response: {
  "success": true,
  "data": [
    {
      "date": "2025-10-19",
      "impressions": 75000,
      "clicks": 750,
      "conversions": 38,
      "cost_cents": 15000,
      "ctr": 0.01,
      "cpc_cents": 20,
      "conversion_rate": 0.051
    }
  ]
}
```

#### 批量操作
```yaml
# 创建批量操作
POST /api/v1/ads/bulk-operations
Request: {
  "operation_type": "campaign_create",
  "campaign_data": [
    {
      "name": "New Campaign 1",
      "budget_amount_cents": 100000,
      "targeting": { /* targeting config */ }
    }
  ],
  "schedule_for": "2025-10-19T15:00:00Z"
}
Response: {
  "success": true,
  "data": {
    "operation_id": "bulk-uuid",
    "status": "queued",
    "total_items": 1
  }
}

# 获取批量操作状态
GET /api/v1/ads/bulk-operations/{operation_id}
Response: {
  "success": true,
  "data": {
    "id": "bulk-uuid",
    "operation_type": "campaign_create",
    "status": "completed",
    "total_items": 1,
    "processed_items": 1,
    "failed_items": 0,
    "started_at": "2025-10-19T15:00:00Z",
    "completed_at": "2025-10-19T15:02:00Z",
    "results": {
      "successful_items": ["campaign-uuid-1"],
      "failed_items": []
    }
  }
}
```

### 5. 活动域 (Activity Domain) API

#### 通知管理
```yaml
# 获取通知列表
GET /api/v1/notifications?status=unread&limit=20
Response: {
  "success": true,
  "data": [
    {
      "id": "notif-uuid",
      "type": "info",
      "title": "Analysis completed",
      "message": "Your market analysis is ready to view",
      "status": "unread",
      "priority": "normal",
      "action_url": "/offers/offer-uuid/analysis",
      "created_at": "2025-10-19T10:00:00Z"
    }
  ]
}

# 标记通知为已读
PATCH /api/v1/notifications/{notification_id}/read
Response: {
  "success": true,
  "message": "Notification marked as read"
}

# 批量操作通知
PATCH /api/v1/notifications/batch
Request: {
  "notification_ids": ["notif-1", "notif-2"],
  "action": "mark_read"
}
```

#### 用户活动跟踪
```yaml
# 记录用户事件
POST /api/v1/activities/events
Request: {
  "event_type": "feature_used",
  "event_data": {
    "feature": "offer_analysis",
    "offer_id": "offer-uuid"
  },
  "page_url": "/offers/offer-uuid"
}
Response: {
  "success": true,
  "message": "Event recorded successfully"
}

# 获取用户活动统计
GET /api/v1/activities/stats?period=7d
Response: {
  "success": true,
  "data": {
    "total_sessions": 25,
    "total_page_views": 180,
    "features_used": ["offer_analysis", "keyword_research"],
    "engagement_score": 8.5,
    "daily_activity": [
      {
        "date": "2025-10-19",
        "sessions": 3,
        "page_views": 25,
        "engagement_score": 9.2
      }
    ]
  }
}
```

#### 签到系统
```yaml
# 用户签到
POST /api/v1/activities/checkins
Response: {
  "success": true,
  "data": {
    "checkin_id": "checkin-uuid",
    "streak_days": 15,
    "points_earned": 25,
    "bonus_points": 10,
    "total_points": 375
  }
}

# 获取签到历史
GET /api/v1/activities/checkins?limit=30
Response: {
  "success": true,
  "data": [
    {
      "checkin_date": "2025-10-19",
      "streak_days": 15,
      "points_earned": 25,
      "claimed_at": "2025-10-19T09:00:00Z"
    }
  ]
}
```

---

## 🔧 服务间API调用规范

### 统一HTTP客户端配置
```go
// Go示例 - 标准化HTTP客户端
type ServiceClient struct {
    baseURL    string
    serviceID  string
    apiKey     string
    httpClient *http.Client
    tracer     trace.Tracer
}

func NewServiceClient(baseURL, serviceID, apiKey string) *ServiceClient {
    return &ServiceClient{
        baseURL:   baseURL,
        serviceID: serviceID,
        apiKey:    apiKey,
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
            Transport: &http.Transport{
                MaxIdleConns:        100,
                MaxIdleConnsPerHost: 10,
                IdleConnTimeout:     90 * time.Second,
            },
        },
        tracer: otel.Tracer(serviceID),
    }
}

func (c *ServiceClient) MakeRequest(ctx context.Context, method, path string, body interface{}) (*APIResponse, error) {
    ctx, span := c.tracer.Start(ctx, "service_request")
    defer span.End()

    // 构建请求
    url := c.baseURL + path
    var reqBody io.Reader
    if body != nil {
        jsonBody, err := json.Marshal(body)
        if err != nil {
            return nil, err
        }
        reqBody = bytes.NewBuffer(jsonBody)
    }

    req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
    if err != nil {
        return nil, err
    }

    // 设置标准头部
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Accept", "application/json")
    req.Header.Set("X-Service-ID", c.serviceID)
    req.Header.Set("X-API-Key", c.apiKey)
    req.Header.Set("X-Timestamp", time.Now().UTC().Format(time.RFC3339))

    // 添加追踪头部
    spanContext := span.SpanContext()
    req.Header.Set("X-Trace-Id", spanContext.TraceID().String())
    req.Header.Set("X-Span-Id", spanContext.SpanID().String())

    // 执行请求
    resp, err := c.httpClient.Do(req)
    if err != nil {
        span.SetStatus(codes.Error, err.Error())
        return nil, err
    }
    defer resp.Body.Close()

    // 处理响应
    var apiResp APIResponse
    if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
        span.SetStatus(codes.Error, err.Error())
        return nil, err
    }

    // 记录指标
    recordAPICallMetrics(method, path, resp.StatusCode, apiResp.Meta.ExecutionTimeMs)

    return &apiResp, nil
}
```

### 重试和熔断机制
```go
type ResilientClient struct {
    client     *ServiceClient
    retryCount int
    retryDelay time.Duration
    circuitBreaker *gobreaker.CircuitBreaker
}

func (rc *ResilientClient) CallWithRetry(ctx context.Context, method, path string, body interface{}) (*APIResponse, error) {
    var lastErr error

    for attempt := 0; attempt <= rc.retryCount; attempt++ {
        if attempt > 0 {
            select {
            case <-time.After(rc.retryDelay):
            case <-ctx.Done():
                return nil, ctx.Err()
            }
        }

        // 检查熔断器状态
        result := rc.circuitBreaker.Execute(func() (interface{}, error) {
            return rc.client.MakeRequest(ctx, method, path, body)
        })

        if result.Error() != nil {
            lastErr = result.Error()
            if attempt < rc.retryCount {
                continue
            }
            return nil, lastErr
        }

        return result.Result().(*APIResponse), nil
    }

    return nil, lastErr
}
```

---

## 📊 监控和可观测性

### 标准化指标
```yaml
# 请求指标
http_requests_total: CounterVec{
  labels: ["service", "method", "endpoint", "status_code", "user_type"]
}

http_request_duration_ms: HistogramVec{
  labels: ["service", "method", "endpoint", "status_code"],
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
}

# 业务指标
database_operations_total: CounterVec{
  labels: ["service", "domain", "operation", "table", "result"]
}

database_operation_duration_ms: HistogramVec{
  labels: ["service", "domain", "operation", "table"]
}

active_sessions: GaugeVec{
  labels: ["service", "user_type"]
}

api_errors_total: CounterVec{
  labels: ["service", "error_type", "severity"]
}
```

### 日志格式标准
```json
{
  "timestamp": "2025-10-19T10:30:00.123Z",
  "level": "INFO",
  "service": "user-service",
  "trace_id": "trace-123456",
  "span_id": "span-789",
  "request_id": "req-456",
  "user_id": "user-uuid",
  "message": "User profile updated successfully",
  "data": {
    "operation": "update_user_profile",
    "fields_updated": ["name", "avatar_url"],
    "execution_time_ms": 45
  },
  "tags": ["api", "user_management", "success"]
}
```

### 分布式追踪
```yaml
# 追踪头部标准
X-Trace-Id: "全局唯一追踪ID"
X-Span-Id: "当前跨度ID"
X-Parent-Span-Id: "父跨度ID"
X-Sampled: "1/0" # 是否采样

# 追踪操作类型
api_request: API请求处理
database_query: 数据库查询
external_service: 外部服务调用
cache_operation: 缓存操作
background_job: 后台任务执行
```

---

## 🚀 性能优化规范

### 缓存策略
```yaml
# 缓存层级
L1_Memory: 应用内存缓存 (TTL: 5-15分钟)
  - 用户会话信息
  - 热点配置数据
  - 频繁访问的权限信息

L2_Redis: 分布式缓存 (TTL: 30分钟-2小时)
  - API响应缓存
  - 数据库查询结果
  - 计算结果缓存

L3_Database: 数据库查询缓存
  - 预编译语句缓存
  - 连接池缓存
  - 索引缓存

# 缓存键命名规范
user:profile:{user_id}
offers:list:{user_id}:{filters_hash}
billing:tokens:{user_id}
ads:performance:{account_id}:{date_hash}
```

### 数据库优化
```yaml
# 查询优化
分页查询: 使用LIMIT和OFFSET，避免全表扫描
索引使用: 确保查询使用合适的索引
批量操作: 使用批量插入/更新减少网络往返
连接池: 合理配置连接池大小
只读副本: 查询操作优先使用只读副本

# 查询模式示例
# ✅ 好的查询
SELECT id, title, status, updated_at
FROM offer_domain.offers
WHERE user_id = $1 AND status = 'active'
ORDER BY updated_at DESC
LIMIT 20;

# ❌ 避免的查询
SELECT * FROM offers; -- 全表扫描
WHERE LOWER(title) LIKE '%keyword%'; -- 无法使用索引
ORDER BY created_at, updated_at; -- 复杂排序
```

---

## 🛡️ 安全规范

### 输入验证
```yaml
# 通用验证规则
字符串长度: 1-255字符
邮箱格式: RFC 5322标准
UUID格式: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
数字范围: 根据业务逻辑定义
JSON格式: 有效的JSON结构
SQL注入防护: 使用参数化查询

# 示例验证
name:
  type: string
  min_length: 1
  max_length: 100
  pattern: "^[a-zA-Z0-9\\s\\-_]+$"

email:
  type: string
  format: email
  max_length: 255

budget_cents:
  type: integer
  min: 0
  max: 100000000 # 100万美元
```

### 输出过滤
```yaml
# 敏感信息过滤
密码字段: 永不返回
令牌字段: 仅在创建时返回
内部ID: 根据权限返回
调试信息: 仅在开发环境返回
错误详情: 生产环境简化

# 数据脱敏
邮箱: user***@example.com
电话: ***-***-1234
IP地址: 192.168.***.***
财务信息: 部分掩码
```

---

## 📋 API版本管理

### 版本策略
```yaml
# URL版本控制 (推荐)
/api/v1/users
/api/v2/users

# 头部版本控制
Accept: application/vnd.api+json;version=1
API-Version: v1

# 查询参数版本控制
/api/users?version=v1

# 版本兼容性原则
主版本: 不向后兼容的更改
次版本: 向后兼容的功能添加
修订版本: 向后兼容的问题修复

# 版本生命周期
Current: 当前活跃版本
Supported: 支持但推荐迁移
Deprecated: 即将弃用
Sunset: 已停止支持
```

### 弃用管理
```yaml
# 弃用响应头
Deprecation: true
Sunset: 2025-12-31T00:00:00Z
Link: </api/v2/users>; rel="successor-version"

# 弃用通知日志
{
  "level": "WARN",
  "message": "API endpoint deprecated",
  "data": {
    "endpoint": "/api/v1/users",
    "deprecation_date": "2025-10-01",
    "sunset_date": "2025-12-31",
    "successor_version": "v2"
  }
}
```

---

## 📚 使用示例

### 完整的API调用流程
```typescript
// 前端TypeScript示例
class AdsAIAPIClient {
  private baseURL: string;
  private authToken: string;

  constructor(baseURL: string, authToken: string) {
    this.baseURL = baseURL;
    this.authToken = authToken;
  }

  async createOffer(offerData: CreateOfferRequest): Promise<OfferResponse> {
    const response = await fetch(`${this.baseURL}/api/v1/offers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
        'X-Request-ID': this.generateRequestId(),
      },
      body: JSON.stringify(offerData),
    });

    if (!response.ok) {
      const error = await response.json() as APIError;
      throw new Error(error.error.message);
    }

    return response.json() as Promise<APIResponse<OfferResponse>>;
  }

  async getOfferAnalysis(offerId: string, analysisId: string): Promise<AnalysisResponse> {
    const response = await fetch(
      `${this.baseURL}/api/v1/offers/${offerId}/analysis/${analysisId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'X-Request-ID': this.generateRequestId(),
        },
      }
    );

    return response.json();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 使用示例
const apiClient = new AdsAIAPIClient('https://api.example.com', 'jwt-token');

try {
  const offer = await apiClient.createOffer({
    title: 'New Marketing Campaign',
    description: 'Campaign description',
    brand_name: 'Brand Name',
  });

  console.log('Offer created:', offer.data);

  // 请求分析
  const analysisRequest = await apiClient.requestAnalysis(offer.data.id, {
    analysis_types: ['market_analysis', 'keyword_analysis'],
  });

  console.log('Analysis requested:', analysisRequest.data);

} catch (error) {
  console.error('API call failed:', error.message);
}
```

---

**文档完成状态**: ✅ 标准化API规范设计完成

**下一步**: 基于此规范实施服务间认证机制 (P2-6)，并更新各后端服务以符合新的API标准。