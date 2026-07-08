# 前端优化所需后端API清单

> 本文档列出前端优化方案中依赖的后端API接口、数据结构和功能需求

## 1. 已实现的核心接口

### 1.1 Console API - 监控与洞察

#### GET `/api/v1/console/monitoring/overview`
**用途**: 获取监控总览快照(降级场景使用)

**响应**:
```typescript
interface MonitoringOverview {
  services: ServiceHealth[];
  metrics: MetricSnapshot[];
  alerts: Alert[];
  timestamp: string;
}
```

**实现状态**: ✅ 已完成 (`services/console/internal/handlers/monitoring.go`)

---

#### SSE `/api/v1/console/monitoring/stream`
**用途**: 实时推送监控数据

**SSE事件格式**:
```
event: message
data: {"services":[...],"metrics":[...],"alerts":[...],"timestamp":"2025-01-12T..."}
```

**实现状态**: ✅ 已完成 (`services/console/internal/handlers/monitoring.go:streamMonitoringOverview`)

**注意事项**:
- Cloud Run超时300秒,需前端自动重连
- 断开时前端自动降级到快照模式

---

#### GET `/api/v1/console/insights`
**用途**: 获取AI洞察快照

**响应**:
```typescript
interface InsightsResponse {
  insights: Insight[];
}

interface Insight {
  id: string;
  category: 'token' | 'task' | 'ads';
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  createdAt: string;
  action?: {
    label: string;
    url: string;
  };
}
```

**实现状态**: ✅ 已完成 (`services/console/internal/handlers/insights.go`)

---

#### SSE `/api/v1/console/insights/stream`
**用途**: 实时推送AI洞察

**实现状态**: ✅ 已完成 (`services/console/internal/handlers/insights.go:streamInsights`)

---

### 1.2 Console API - 任务管理

#### GET `/api/v1/console/tasks/stats`
**响应**:
```typescript
interface TaskStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
}
```

**实现状态**: ✅ 已完成 (`lib/api/console/tasks.ts`)

---

#### GET `/api/v1/console/tasks?limit=100&offset=0&status=pending`
**查询参数**:
- `limit`: 分页大小(默认50,最大100)
- `offset`: 分页偏移
- `status`: 筛选条件(pending|running|completed|failed)
- `type`: 任务类型(评估|同步等)

**响应**:
```typescript
interface TasksResponse {
  tasks: Task[];
  total: number;
  limit: number;
  offset: number;
}
```

**实现状态**: ✅ 已完成

---

### 1.3 Console API - Offer管理

#### GET `/api/v1/console/offers/quality`
**响应**:
```typescript
interface OfferQualityMetrics {
  avgScore: number;
  distribution: { score: number; count: number }[];
  trends: { date: string; avgScore: number }[];
}
```

**实现状态**: ✅ 已完成 (`lib/api/console/quality.ts`)

---

#### GET `/api/v1/console/offers/stats`
**响应**:
```typescript
interface OfferStats {
  total: number;
  active: number;
  paused: number;
  evaluating: number;
}
```

**实现状态**: ✅ 已完成

---

### 1.4 Console API - Token/Billing

#### GET `/api/v1/console/tokens/usage-prediction`
**用途**: Token用量预测(用于智能提醒)

**响应**:
```typescript
interface UsagePrediction {
  currentBalance: number;
  dailyAvgConsumption: number;
  estimatedDaysRemaining: number;
  predictedExhaustDate: string; // ISO 8601
  confidence: 'high' | 'medium' | 'low';
}
```

**实现状态**: ✅ 已完成 (`lib/api/console/tokens.ts`)

---

#### GET `/api/v1/console/financial/overview`
**响应**:
```typescript
interface FinancialOverview {
  revenue: MetricValue;
  costs: MetricValue;
  margin: MetricValue;
  trends: TrendData[];
}
```

**实现状态**: ✅ 已完成 (`lib/api/console/financial.ts`)

---

### 1.5 Console API - 用户与安全

#### GET `/api/v1/console/users/login-history?userId={userId}&limit=20`
**用途**: 获取登录历史(用于安全页展示)

**响应**:
```typescript
interface LoginHistory {
  sessions: LoginSession[];
  total: number;
}

interface LoginSession {
  id: string;
  userId: string;
  ip: string;
  userAgent: string;
  location?: string;
  timestamp: string;
  status: 'success' | 'failed';
  method: 'google' | 'email';
}
```

**实现状态**: ✅ 已完成 (`lib/api/console/users.ts`)

---

#### GET `/api/v1/console/security/stats`
**响应**:
```typescript
interface SecurityStats {
  activeDevices: number;
  recentLogins: number;
  failedAttempts: number;
  mfaEnabled: boolean;
}
```

**实现状态**: ✅ 已完成 (`lib/api/security/`)

---

### 1.6 Main API - Offer操作

#### POST `/api/v1/offers/{id}/evaluate`
**请求体**:
```typescript
{
  priority?: 'high' | 'normal' | 'low';
}
```

**响应**:
```typescript
{
  taskId: string;
  estimatedTokenCost: number;
  status: 'queued';
}
```

**实现状态**: ✅ 已完成 (`services/offer/internal/handlers/http.go`)

---

#### POST `/api/v1/offers/batch-evaluate`
**请求体**:
```typescript
{
  offerIds: string[];
  priority?: 'high' | 'normal' | 'low';
}
```

**响应**:
```typescript
{
  taskIds: string[];
  totalEstimatedCost: number;
  status: 'queued';
}
```

**实现状态**: ✅ 已完成

---

### 1.7 Ads Center API

#### POST `/api/v1/adscenter/accounts/{id}/sync`
**用途**: 触发广告账号同步

**响应**:
```typescript
{
  taskId: string;
  status: 'queued';
  estimatedDuration: number; // 秒
}
```

**实现状态**: ✅ 已完成 (`services/adscenter/internal/api/router.go`)

---

#### POST `/api/v1/adscenter/accounts/sync-all`
**用途**: 批量同步所有账号

**响应**:
```typescript
{
  taskIds: string[];
  totalAccounts: number;
  status: 'queued';
}
```

**实现状态**: ✅ 已完成

---

#### GET `/api/v1/adscenter/accounts/stats`
**响应**:
```typescript
interface AdsAccountStats {
  total: number;
  active: number;
  syncing: number;
  error: number;
  lastSyncTime: string;
}
```

**实现状态**: ✅ 已完成

---

## 2. 需要增强的接口

### 2.1 任务详情API (优先级: P1)

#### GET `/api/v1/console/tasks/{taskId}/details`
**当前问题**: 缺少任务关联的Offer/Ads/Token消耗详情

**期望响应**:
```typescript
interface TaskDetail {
  id: string;
  type: string;
  status: string;
  progress: number; // 0-100
  createdAt: string;
  startedAt?: string;
  completedAt?: string;

  // 新增字段
  relatedResources: {
    offerId?: string;
    offerUrl?: string;
    adsAccountId?: string;
    adsAccountName?: string;
  };

  tokenConsumption: {
    estimated: number;
    actual?: number;
  };

  errorDetails?: {
    code: string;
    message: string;
    retryable: boolean;
    suggestedAction?: string;
  };

  timeline: TaskTimelineEvent[]; // 执行历史
}

interface TaskTimelineEvent {
  timestamp: string;
  stage: 'queued' | 'running' | 'completed' | 'failed';
  message: string;
}
```

**实现建议**: 在 `services/console/internal/handlers/tasks.go` 中新增 `getTaskDetail` 处理器

---

### 2.2 Offer评估失败原因分类 (优先级: P1)

#### GET `/api/v1/offers/{id}/evaluation-result`
**当前问题**: 失败时仅返回通用错误,缺少分类和重试建议

**期望增强**:
```typescript
interface EvaluationResult {
  taskId: string;
  status: 'success' | 'failed' | 'pending';
  score?: number;

  // 新增失败分类
  failureReason?: {
    category: 'network' | 'invalid_url' | 'timeout' | 'rate_limit' | 'internal_error';
    message: string;
    retryable: boolean;
    suggestedAction: string;
    estimatedRetryTime?: string;
  };

  metadata: {
    tokensUsed: number;
    duration: number;
    retryCount: number;
  };
}
```

**实现建议**: 在 `services/offer/internal/handlers/http.go` 中丰富错误处理逻辑

---

### 2.3 跨服务关联数据API (优先级: P2)

#### GET `/api/v1/console/insights/cross-service`
**用途**: 为管理后台提供跨域洞察(Offer ↔ Ads ↔ Token ↔ Task)

**期望响应**:
```typescript
interface CrossServiceInsights {
  offerToAds: {
    offersWithAds: number;
    offersWithoutAds: number;
    avgAdsPerOffer: number;
  };

  taskToToken: {
    avgTokenPerTask: number;
    topConsumingTaskTypes: { type: string; avgTokens: number }[];
  };

  conversionFunnel: {
    offersCreated: number;
    offersEvaluated: number;
    offersWithAds: number;
    adsActive: number;
  };

  healthScore: {
    overall: number; // 0-100
    dimensions: {
      offerQuality: number;
      taskSuccessRate: number;
      tokenEfficiency: number;
      adsPerformance: number;
    };
  };
}
```

**实现建议**: 在 `services/console/internal/handlers/insights.go` 中新增聚合查询

---

### 2.4 实时任务进度推送 (优先级: P2)

#### SSE `/api/v1/tasks/{taskId}/progress`
**用途**: 长时间运行任务的实时进度推送

**SSE事件**:
```
event: progress
data: {"taskId":"...","progress":45,"stage":"fetching_data","eta":120}

event: completed
data: {"taskId":"...","result":{...}}

event: error
data: {"taskId":"...","error":{...}}
```

**实现建议**:
- 在各服务(offer/adscenter)中实现进度上报机制
- 在console服务中聚合和转发SSE事件

---

## 3. 数据质量优化需求

### 3.1 分页元数据标准化 (优先级: P0) ✅ **已完成**

**当前问题**: 不同接口返回的分页元数据格式不统一

**标准格式**:
```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    nextOffset?: number;
  };
}
```

**实现状态**: ✅ 已完成
- 创建 `pkg/pagination` 包,提供泛型分页工具
- `NewPaginatedResponse()` 快捷构造函数
- `ParseParams()` 参数解析(默认50,最大100)
- 需在各服务中集成使用

**涉及接口**:
- `/api/v1/console/tasks`
- `/api/v1/console/offers`
- `/api/v1/adscenter/accounts`
- `/api/v1/console/users/login-history`

---

### 3.2 错误码标准化 (优先级: P0) ✅ **已完成**

**当前问题**: HTTP状态码统一,但缺少业务错误码

**标准错误格式**:
```typescript
interface APIError {
  code: string; // 如 "OFFER_EVALUATION_FAILED"
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  suggestedAction?: string;
}
```

**实现状态**: ✅ 已完成
- 创建 `pkg/apierrors` 包,提供标准化错误处理
- 40+个业务错误码 (覆盖Token/Offer/Ads/Task/User/Subscription全部域)
- 自动HTTP状态码映射 (`GetHTTPStatus()`)
- 可重试判断逻辑 (`IsRetryable()`)
- `WriteJSON()` 标准化JSON响应
- 快捷构造函数 (`NotFound()`, `InvalidRequest()`, `TokenInsufficient()` 等)
- 需在各服务中集成使用

**错误码分类** (已在 `pkg/apierrors/codes.go` 中实现):
```typescript
// Token相关
TOKEN_INSUFFICIENT = "TOKEN_INSUFFICIENT"
TOKEN_QUOTA_EXCEEDED = "TOKEN_QUOTA_EXCEEDED"

// Offer相关
OFFER_NOT_FOUND = "OFFER_NOT_FOUND"
OFFER_EVALUATION_FAILED = "OFFER_EVALUATION_FAILED"
OFFER_INVALID_URL = "OFFER_INVALID_URL"

// Ads相关
ADS_SYNC_FAILED = "ADS_SYNC_FAILED"
ADS_OAUTH_EXPIRED = "ADS_OAUTH_EXPIRED"
ADS_ACCOUNT_SUSPENDED = "ADS_ACCOUNT_SUSPENDED"

// 任务相关
TASK_NOT_FOUND = "TASK_NOT_FOUND"
TASK_TIMEOUT = "TASK_TIMEOUT"
TASK_CANCELLED = "TASK_CANCELLED"

// ... 更多错误码详见 pkg/apierrors/codes.go
```

---

### 3.3 时间戳格式统一 (优先级: P2)

**要求**: 所有时间字段使用 ISO 8601 格式 + UTC时区

**示例**: `2025-01-12T08:30:45.123Z`

**涉及字段**:
- `createdAt`, `updatedAt`, `timestamp`
- `startedAt`, `completedAt`
- `lastSyncTime`, `predictedExhaustDate`

---

## 4. 性能优化需求

### 4.1 数据缓存策略 (优先级: P2)

**需求**: 为高频查询接口添加Cache-Control头

**推荐配置**:
```
# 统计数据(变化慢)
GET /api/v1/console/*/stats
Cache-Control: public, max-age=60

# 实时数据(变化快)
GET /api/v1/console/monitoring/overview
Cache-Control: private, max-age=10

# 历史数据(不变)
GET /api/v1/console/tasks/{id}/details
Cache-Control: private, max-age=300
```

---

### 4.2 批量查询接口 (优先级: P2)

#### POST `/api/v1/console/tasks/batch-query`
**用途**: 减少前端并发请求数

**请求体**:
```typescript
{
  taskIds: string[]; // 最多50个
}
```

**响应**:
```typescript
{
  tasks: Record<string, Task>;
  notFound: string[];
}
```

**类似接口需求**:
- `/api/v1/offers/batch-query`
- `/api/v1/adscenter/accounts/batch-query`

---

## 5. 实现优先级总结

| 优先级 | 功能 | 预估后端工时 | 影响范围 |
|--------|------|-------------|----------|
| **P0** | 错误码标准化 | 8小时 | 全局 |
| **P0** | 分页元数据标准化 | 4小时 | Console API |
| **P1** | 任务详情API增强 | 16小时 | 任务管理 |
| **P1** | Offer失败原因分类 | 8小时 | Offer评估 |
| **P1** | 时间戳格式统一 | 4小时 | 全局 |
| **P2** | 跨服务关联数据API | 24小时 | 管理后台 |
| **P2** | 实时任务进度SSE | 16小时 | 任务体验 |
| **P2** | 缓存策略优化 | 4小时 | 性能 |
| **P2** | 批量查询接口 | 12小时 | 性能 |

**总计**: ~96小时 (约2周全职开发)

---

## 6. 前后端协作检查清单

### 部署前检查
- [ ] 新接口已在 `configs/environment/variables.json` 中声明环境变量
- [ ] 已在 Secret Manager 创建对应密钥
- [ ] 已更新 Cloud Run 服务的 `--update-secrets`
- [ ] 已补充 API 文档(Swagger/OpenAPI)
- [ ] 已添加集成测试

### 数据格式验证
- [ ] 时间戳使用 ISO 8601 + UTC
- [ ] 分页元数据符合标准格式
- [ ] 错误响应包含业务错误码
- [ ] SSE事件格式符合规范

### 性能检查
- [ ] 添加适当的Cache-Control头
- [ ] 分页查询默认限制50条,最大100条
- [ ] 批量接口限制最大50个ID
- [ ] 长查询添加超时控制(30秒)

---

**最后更新**: 2025-01-12
**维护者**: Frontend Team
**审阅者**: Backend Team
