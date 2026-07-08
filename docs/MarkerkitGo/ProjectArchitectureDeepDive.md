# AutoAds 项目架构深度解析

*基于代码实际实现的完整架构文档*

## 一、架构概览

### 1.1 混合架构设计

AutoAds 采用 **Makerkit (Next.js) + Go微服务** 的混合架构：

```
┌─────────────────────────────────────────────────────────────┐
│                    用户层 (Browsers)                          │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│         Cloudflare CDN + Firebase Hosting                    │
│              (预发: urlchecker.dev)                           │
│              (生产: autoads.dev)                              │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│   Next.js Frontend (SSR + CSR)                               │
│   - apps/frontend                                            │
│   - Firebase Auth (Google OAuth)                             │
│   - Stripe Payments                                          │
│   - i18n (zh/en)                                             │
└────────┬──────────────────────────────────┬─────────────────┘
         │                                  │
         │ Firebase JWT Token               │ REST API Calls
         ▼                                  ▼
┌────────────────────┐         ┌──────────────────────────────┐
│  Firebase Services │         │   API Gateway (GCP)           │
│  - Authentication  │         │   - autoads-api-preview       │
│  - Firestore       │         │   - JWT Validation            │
│  - Hosting         │         │   - Rate Limiting             │
└────────────────────┘         └─────────┬────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
            ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
            │ Offer Service │   │ Siterank Svc  │   │ Billing Svc   │
            │   (Go)        │   │   (Go)        │   │   (Go)        │
            │ Cloud Run     │   │ Cloud Run     │   │ Cloud Run     │
            └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        ▼
                            ┌───────────────────────┐
                            │  Cloud SQL PostgreSQL  │
                            │  - autoads_db         │
                            │  - Event Sourcing     │
                            │  - Read Models        │
                            └───────────────────────┘
```

### 1.2 核心组件层级

1. **前端层** - Next.js (Pages Router)
2. **CDN层** - Cloudflare + Firebase Hosting
3. **API网关层** - Google Cloud API Gateway
4. **业务服务层** - Go微服务集群
5. **异步处理层** - Pub/Sub + Cloud Run Jobs
6. **数据层** - PostgreSQL + Firestore + Redis
7. **AI处理层** - Firebase AI Logic (规划中)

---

## 二、前端架构 (Next.js + Makerkit)

### 2.1 技术栈

```typescript
// apps/frontend/package.json
{
  "framework": "Next.js 14.2.8 (Pages Router)",
  "ui": "React 18.3 + Radix UI + Tailwind CSS",
  "auth": "Firebase 9.22 + Reactfire 4.2",
  "payments": "Stripe 14.20 + @stripe/react-stripe-js",
  "forms": "react-hook-form 7.53 + Zod 3.23",
  "state": "SWR 2.2 + React Context",
  "i18n": "next-i18next 15.3",
  "deployment": "Cloudflare + Cloud Run"
}
```

### 2.2 目录结构

```
apps/frontend/src/
├── components/          # UI组件库
│   ├── ui/              # 基础UI组件 (Radix + Tailwind)
│   ├── auth/            # 认证相关组件
│   └── dashboard/       # Dashboard专用组件
├── core/                # 核心功能模块
│   ├── firebase/        # Firebase配置和utils
│   ├── middleware/      # 中间件 (auth, csrf, rate-limit)
│   └── session/         # Session管理
├── pages/               # Next.js页面路由
│   ├── api/             # API Routes (BFF模式)
│   ├── auth/            # 认证页面
│   ├── dashboard/       # 主Dashboard
│   ├── offers/          # Offer管理
│   ├── adscenter/       # 广告中心
│   └── settings/        # 设置页面
├── sdk/                 # 后端服务SDK (OpenAPI生成)
│   ├── offer/           # Offer Service客户端
│   ├── siterank/        # Siterank Service客户端
│   ├── billing/         # Billing Service客户端
│   └── adscenter/       # Adscenter Service客户端
├── lib/                 # 工具库
│   ├── stripe/          # Stripe集成
│   └── api/             # API客户端封装
└── configuration.ts     # 全局配置
```

### 2.3 认证流程

```typescript
// apps/frontend/src/configuration.ts
auth: {
  sessionCookieTTLDays: 7,
  enableMultiFactorAuth: false,
  requireEmailVerification: false,
  providers: {
    emailPassword: false,     // ❌ 禁用
    phoneNumber: false,       // ❌ 禁用
    emailLink: false,         // ❌ 禁用
    oAuth: [GoogleAuthProvider]  // ✅ 仅Google OAuth
  },
  useRedirectStrategy: false  // 使用Popup策略避免CSRF问题
}
```

**认证步骤**：

1. 用户点击 "Sign in with Google"
2. Firebase Auth 弹出OAuth popup
3. 用户授权后，Firebase返回 `idToken` (JWT)
4. 前端调用 `/api/session/sign-in` 创建session cookie
5. Cookie有效期7天，自动续期
6. 调用后端API时，在 `Authorization: Bearer {idToken}` 携带JWT

### 2.4 前后端通信

**BFF模式 (Backend For Frontend)**:

```typescript
// Frontend调用 → Next.js API Route → Go微服务

// 示例: 创建Offer
// pages/offers/new.tsx
const createOffer = async (data) => {
  const response = await fetch('/api/offers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify(data)
  });
  return response.json();
};

// pages/api/offers/index.ts (Next.js API Route)
export default async function handler(req, res) {
  const idToken = req.headers.authorization?.split('Bearer ')[1];

  // 转发到API Gateway
  const response = await fetch(
    `${process.env.API_GATEWAY_URL}/offers`,
    {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    }
  );

  res.status(response.status).json(await response.json());
}
```

---

## 三、后端架构 (Go微服务)

### 3.1 微服务清单

| 服务名 | 技术栈 | 职责 | 端口 | Cloud Run |
|--------|--------|------|------|-----------|
| **offer** | Go + Chi | Offer生命周期管理 | 8080 | ✅ |
| **siterank** | Go + Chi | 网站排名追踪 | 8081 | ✅ |
| **billing** | Go + Chi | 计费和Token管理 | 8082 | ✅ |
| **adscenter** | Go + Chi | Google Ads集成 | 8083 | ✅ |
| **browser-exec** | Node.js + Playwright | 浏览器自动化 | 8084 | ✅ (拆分架构) |
| **proxy-pool-manager** | Node.js + Redis | 代理池管理 | 8085 | ✅ |
| **batchopen** | Go + Chi | 批量任务处理 | 8086 | ✅ |
| **identity** | Go + Chi | 用户身份管理 | 8087 | ✅ |
| **recommendations** | Go + Chi | 推荐引擎 | 8088 | ✅ |
| **notifications** | Go + Chi | 通知服务 | 8089 | ✅ |
| **console** | Go + Chi | 管理后台API | 8090 | ✅ |

### 3.2 标准Go服务结构

```
services/offer/
├── cmd/
│   └── server/
│       └── main.go          # 服务入口
├── internal/
│   ├── config/              # 配置加载
│   ├── handlers/            # HTTP处理器
│   ├── events/              # Event发布
│   └── oapi/                # OpenAPI生成代码
├── api/
│   └── openapi.yaml         # OpenAPI规范
├── Dockerfile               # 容器化
├── cloudbuild.yaml          # Cloud Build配置
└── go.mod                   # Go模块
```

### 3.3 统一中间件栈

```go
// services/offer/main.go
r := chi.NewRouter()

// 1. Request ID (追踪)
r.Use(middleware.RequestID())

// 2. Logging (结构化日志)
r.Use(middleware.LoggingMiddleware("offer"))

// 3. Metrics (Prometheus)
r.Use(middleware.MetricsMiddleware())

// 4. Auth (Firebase JWT验证)
r.Use(middleware.AuthMiddleware(cfg.FirebaseProjectID))

// 5. CORS
r.Use(middleware.CORS())

// 6. Recovery (panic恢复)
r.Use(middleware.Recovery())
```

### 3.4 认证中间件

```go
// pkg/middleware/auth.go
func AuthMiddleware(projectID string) func(next http.Handler) http.Handler {
  return func(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
      // 1. 从Header提取JWT
      authHeader := r.Header.Get("Authorization")
      idToken := strings.TrimPrefix(authHeader, "Bearer ")

      // 2. 使用Firebase Admin SDK验证
      token, err := firebaseAuth.VerifyIDToken(ctx, idToken)
      if err != nil {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
      }

      // 3. 将userID注入Context
      ctx := context.WithValue(r.Context(), "userID", token.UID)
      next.ServeHTTP(w, r.WithContext(ctx))
    })
  }
}
```

---

## 四、Browser-exec服务 (特殊架构)

### 4.1 拆分架构 (2025-10-02升级)

```
┌──────────────────────────────────────────────────────────┐
│                  Browser-exec 拆分架构                     │
└──────────────────────────────────────────────────────────┘

API实例 (browser-exec-preview)
  - 职责: 接收HTTP请求，验证参数
  - 资源: 1Gi内存 / 1CPU
  - 扩展: 1-5实例
  - 操作: 发布消息到Pub/Sub
           │
           ▼
    ┌──────────────────┐
    │  Pub/Sub Queue    │
    │ browser-visit-    │
    │   requests        │
    └─────────┬────────┘
              │
              ▼
Worker实例 (browser-exec-preview-worker)
  - 职责: 消费队列，执行浏览器任务
  - 资源: 2Gi内存 / 2CPU
  - 扩展: 5-20实例 (自动扩展)
  - 操作:
    1. 从Redis获取代理
    2. 启动Playwright浏览器
    3. 访问目标URL
    4. 保存结果到PostgreSQL
```

### 4.2 代理池架构

```
┌────────────────────────────────────────────────────────┐
│           Proxy Pool Manager + Redis                    │
└────────────────────────────────────────────────────────┘

Proxy Pool Manager (proxy-pool-manager)
  - 职责: 管理代理IP池
  - 操作:
    1. 从iprocket.io获取代理IP
    2. 健康检查和评分
    3. 存储到Redis
    4. 定时补充(每5秒检查)
         │
         ▼
    ┌─────────────────┐
    │ Redis (Memorystore) │
    │ autoads-redis      │
    │ 10.25.251.131:6379 │
    └──────┬──────────┘
           │
           │ LPUSH/LPOP
           ▼
Browser-exec Worker
  - 从Redis获取代理(LPOP)
  - 使用后归还或丢弃
  - URL hash去重(避免重复使用)
```

### 4.3 数据库保存

```javascript
// services/browser-exec/db-client.js
class DatabaseClient {
  async saveVisitResult(result, options) {
    const urlHash = hashUrl(options.url); // SHA256

    await pool.query(`
      INSERT INTO url_visit_results (
        source_url_hash,  -- 汇聚key
        source_url,
        final_url,
        result_type,      -- success/failed/blocked/timeout
        landing_page_type, -- final/intermediate/error/suspended
        brand_name,
        total_duration_ms,
        total_bytes_transferred,
        redirect_chain,
        cloudflare_challenge,
        raw_result,
        created_at
      ) VALUES (...)
    `);
  }
}
```

---

## 五、数据存储策略

### 5.1 多数据源架构

```
┌─────────────────────────────────────────────────────────┐
│                   数据存储分层                            │
└─────────────────────────────────────────────────────────┘

1. PostgreSQL (Cloud SQL) - 主数据库
   - 实例: autoads
   - 数据库: autoads_db
   - 连接: VPC Connector (cr-conn-default-ane1)
   - 用途:
     ✓ Event Store (事件溯源)
     ✓ Read Models (读模型)
     ✓ URL访问结果 (url_visit_results)
     ✓ Offer数据
     ✓ KPI数据
     ✓ 计费记录

2. Firestore (Firebase) - 文档数据库
   - 数据库: firestoredb
   - 用途:
     ✓ 用户配置缓存
     ✓ 实时数据同步
     ✓ 轻量级查询

3. Redis (Memorystore) - 缓存和队列
   - 实例: autoads-redis
   - IP: 10.25.251.131:6379
   - 用途:
     ✓ 代理IP池 (proxy:available)
     ✓ URL去重 (url:{hash}:used_proxies)
     ✓ 会话缓存
     ✓ 限流计数器

4. Pub/Sub - 消息队列
   - Topic: browser-visit-requests
   - Subscription: browser-visit-workers
   - DLQ: browser-visit-requests-dlq
   - 用途:
     ✓ 异步任务分发
     ✓ 事件驱动通信
```

### 5.2 Event Sourcing模式

```sql
-- Event Store表
CREATE TABLE event_store (
  id UUID PRIMARY KEY,
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL,
  user_id UUID NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Read Model表
CREATE TABLE "Offer" (
  id UUID PRIMARY KEY,
  "userId" UUID NOT NULL,
  name TEXT,
  "originalUrl" TEXT,
  status VARCHAR(20),  -- draft/evaluating/active/suspended
  created_at TIMESTAMP WITH TIME ZONE
);
```

**事件流**:

1. 命令 → Handler处理
2. 发布领域事件 → Event Store
3. 投影到Read Model
4. Notifications服务订阅事件

---

## 六、部署流程

### 6.1 CI/CD Pipeline

```yaml
# .github/workflows/deploy-backend.yml

触发器:
  - push to main → preview环境
  - push to production → 生产环境
  - tag (v*) → 生产环境 (版本化)

步骤:
1. Detect changed services (检测哪些服务变更)
2. Prepare metadata (生成tag)
3. Build images (Cloud Build)
   - Tag: preview-{commitid}
   - Tag: preview-latest
4. Tag images (secondary)
5. DB Migrate (执行数据库迁移)
6. Deploy services (部署到Cloud Run)
```

### 6.2 Cloud Build配置

```yaml
# services/browser-exec/cloudbuild.yaml
steps:
  - name: gcr.io/kaniko-project/executor:latest
    args:
      - --destination=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/browser-exec:${_TAG}
      - --dockerfile=Dockerfile
      - --cache=true
      - --cache-ttl=24h
```

### 6.3 环境变量管理

```bash
# Secret Manager存储
gcloud secrets versions access latest --secret="DATABASE_URL"
gcloud secrets versions access latest --secret="FIREBASE_ADMIN_KEY"
gcloud secrets versions access latest --secret="STRIPE_SECRET_KEY"

# Cloud Run环境变量注入
gcloud run deploy browser-exec-preview-worker \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest" \
  --set-env-vars="USE_REDIS_PROXY=true,REDIS_URL=redis://10.25.251.131:6379"
```

---

## 七、关键技术决策

### 7.1 为什么选择Pages Router而非App Router?

```typescript
// 实际代码使用Pages Router
// apps/frontend/src/pages/_app.tsx
export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
```

**原因**:
1. Makerkit基于Pages Router构建
2. 稳定性更高（App Router还在演进）
3. SSR和ISR支持完善
4. 中间件生态成熟

### 7.2 为什么Browser-exec用Node.js而非Go?

```javascript
// Playwright只有Node.js/Python官方SDK
import playwright from 'playwright';

const browser = await playwright.chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

**原因**:
1. Playwright官方Node.js SDK
2. 浏览器自动化生态丰富
3. 性能已满足需求（400 URL/分钟）

### 7.3 为什么拆分API和Worker?

**原因**:
1. 资源隔离: API轻量(1Gi) vs Worker重量(2Gi)
2. 扩展独立: API 1-5实例 vs Worker 5-20实例
3. 避免OOM: maxMessages=2控制并发
4. 成本优化: 按需扩展，idle时缩容

### 7.4 为什么使用Event Sourcing?

```go
// 所有状态变更记录为事件
type OfferCreatedEvent struct {
  OfferID string
  UserID  string
  URL     string
}

// 可审计、可回溯、可重放
```

**原因**:
1. 完整审计日志
2. 时间旅行调试
3. CQRS模式支持
4. 微服务事件驱动

---

## 八、性能指标

### 8.1 Browser-exec性能

```
并发任务: 200个
吞吐量: 400 URL/分钟
平均延迟: 150ms (Redis获取代理)
成功率: 60-80% (Cloudflare绕过)
资源消耗:
  - Worker实例: 5-20个
  - 每实例内存: 2Gi
  - 每浏览器内存: ~400MB
  - maxMessages: 2 (防止OOM)
```

### 8.2 代理池性能

```
代理容量: 200个
补充速率: 300代理/分钟
消耗速率: ~36代理/分钟
Redis延迟: 1-5ms
水位检查: 每5秒
低水位触发: < 50代理
```

---

## 九、安全架构

### 9.1 多层防护

```
1. Cloudflare WAF
   - DDoS防护
   - Bot检测
   - Rate limiting

2. Firebase Authentication
   - Google OAuth (唯一认证方式)
   - JWT有效期: 1小时
   - Session cookie: 7天

3. API Gateway
   - JWT验证
   - Rate limiting
   - Request validation

4. 后端服务
   - Firebase Admin SDK验证
   - Row Level Security (PostgreSQL)
   - Secret Manager (敏感数据)
```

### 9.2 数据隔离

```sql
-- PostgreSQL RLS (Row Level Security)
CREATE POLICY "Users can view their own visit results"
  ON url_visit_results
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role可以访问所有数据
CREATE POLICY "Service role can access all visit results"
  ON url_visit_results
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );
```

---

## 十、监控和可观测性

### 10.1 日志

```
Cloud Logging:
  - 结构化日志 (JSON)
  - Request ID追踪
  - Error聚合
  - 日志保留: 30天
```

### 10.2 指标

```
Prometheus Metrics:
  - HTTP请求数 (by endpoint, status)
  - 请求延迟 (histogram)
  - 错误率
  - 代理池水位
  - 浏览器实例数
```

### 10.3 告警

```
Cloud Monitoring:
  - 429状态码 > 100/min
  - Error rate > 5%
  - 代理池耗尽
  - Worker OOM
  - 死信队列消息数 > 0
```

---

## 十一、成本优化

### 11.1 自动扩缩容

```yaml
Cloud Run自动扩展:
  API实例:
    min: 1
    max: 5
    cpu-throttling: true

  Worker实例:
    min: 0  # 空闲时缩容到0
    max: 20
    cpu-throttling: false  # 计算密集型任务
```

### 11.2 资源优化

```
1. Proxy Pool Manager过度配置
   当前: concurrency=1000, max-instances=10
   建议: concurrency=10, max-instances=1
   节省: ~$120/月

2. Browser缓存策略
   - 共享浏览器Context
   - 页面池复用
   - 及时释放资源
```

---

## 十二、技术债务和改进点

### 12.1 已知问题

1. **前端SDK未统一**: 各服务SDK都是OpenAPI生成的types，没有统一的client封装
2. **日志保留限制**: Cloud Logging只保留30天，历史数据难以追溯
3. **缺少E2E测试**: Cypress配置存在但未充分使用

### 12.2 改进方向

1. **统一SDK层**: 创建 `@autoads/api-client` 封装所有后端调用
2. **完善监控**: 添加分布式追踪 (OpenTelemetry)
3. **数据导出**: 将老化日志导出到BigQuery
4. **金丝雀部署**: 支持灰度发布

---

## 附录

### A. 关键配置文件

```
项目根目录/
├── apps/frontend/
│   ├── .env.local              # 本地开发环境变量
│   ├── .env.production         # 生产环境变量
│   ├── next.config.js          # Next.js配置
│   └── tailwind.config.js      # Tailwind CSS配置
├── services/*/
│   ├── Dockerfile              # 容器化
│   ├── cloudbuild.yaml         # Cloud Build
│   └── api/openapi.yaml        # API规范
├── .github/workflows/          # CI/CD
├── database/migrations/        # 数据库迁移
└── schemas/sql/                # SQL Schema
```

### B. 开发命令速查

```bash
# 前端开发
cd apps/frontend
npm run dev                    # 启动开发服务器
npm run build                  # 构建生产版本
npm run typecheck              # 类型检查

# 后端开发
cd services/offer
go run main.go                 # 启动服务
go test ./...                  # 运行测试

# 部署
git push origin main           # 触发preview环境部署
git tag v1.0.0 && git push --tags  # 发布生产版本

# 数据库迁移
./scripts/db/run-migration.sh preview up

# 查看日志
gcloud logging read 'resource.type="cloud_run_revision"'
```

---

**文档版本**: 1.0
**最后更新**: 2025-10-04
**维护者**: Claude (AI Assistant)
**基于**: 实际代码分析，而非文档推测
