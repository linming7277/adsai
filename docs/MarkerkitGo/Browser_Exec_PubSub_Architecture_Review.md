# browser-exec + Pub/Sub 架构评估报告

**评估日期**: 2025-10-02
**评估目标**: 评估当前 Pub/Sub 和 browser-exec 服务的集成架构,识别耦合点和复杂性,提出简化方案

---

## 当前架构分析

### 1. 架构组件

```
┌─────────────────────────────────────────────────────────────┐
│                   客户端 / 上游服务                          │
└─────────────────────────────────────────────────────────────┘
                             │
                             ├─────────────────────┐
                             ↓                     ↓
                    ┌─────────────────┐   ┌───────────────────┐
                    │  直接 HTTP API   │   │  Pub/Sub 队列 API  │
                    │  /visit          │   │  /visit-queue     │
                    └─────────────────┘   └───────────────────┘
                             │                     │
                             │                     ↓
                             │            ┌────────────────────┐
                             │            │  Pub/Sub Topic     │
                             │            │  browser-visit-    │
                             │            │  requests          │
                             │            └────────────────────┘
                             │                     │
                             │                     ↓
                             │            ┌────────────────────┐
                             │            │  Pub/Sub           │
                             │            │  Subscription      │
                             │            │  (Pull)            │
                             │            └────────────────────┘
                             │                     │
                             │                     ↓
                             │            ┌────────────────────┐
                             │            │  Queue Worker      │
                             │            │  (ENABLE_QUEUE_    │
                             │            │  WORKER=1)         │
                             │            └────────────────────┘
                             │                     │
                             └─────────┬───────────┘
                                       ↓
                              ┌──────────────────┐
                              │ unifiedVisit     │
                              │ InternalSingle   │
                              │ Attempt          │
                              └──────────────────┘
                                       │
                                       ↓
                              ┌──────────────────┐
                              │  Playwright      │
                              │  Browser Pool    │
                              └──────────────────┘
```

### 2. 代码结构

**关键文件**:
- `services/browser-exec/queue-manager.js` - Pub/Sub 封装
- `services/browser-exec/index.js` - 主服务 (2335 行)

**集成点**:
```javascript
// index.js:8
import { queueManager } from './queue-manager.js'

// index.js:239-255 - 队列发布 API
app.post('/api/v1/browser/visit-queue', async (req, res) => {
  const result = await queueManager.publishVisitRequest(req.body)
  // ...
})

// index.js:663-676 - Worker 启动
if (process.env.ENABLE_QUEUE_WORKER === '1') {
  await queueManager.startWorker(
    async (request) => {
      return await unifiedVisitInternalSingleAttempt(request)
    },
    { maxMessages: 10, maxExtension: 600000 }
  )
}
```

---

## 架构评估

### ✅ 优点

| 优点 | 说明 |
|------|------|
| **解耦发布和消费** | 客户端发布消息后立即返回,不需要等待处理 |
| **避免限流** | Pub/Sub 缓冲请求,避免 Cloud Run 并发限制 |
| **自动重试** | Pub/Sub 内置消息重试机制 |
| **横向扩展** | 可以运行多个 worker 实例并发消费 |
| **消息持久化** | 消息存储在 Pub/Sub 中,服务重启不丢失 |

### ❌ 问题和复杂性

#### 1. 架构耦合度高

**问题**: browser-exec 服务同时承担 3 个角色
- **HTTP API 服务** (接收请求)
- **Pub/Sub Publisher** (发布消息)
- **Pub/Sub Consumer** (消费消息)

**影响**:
- 服务职责不清晰
- 难以独立扩展
- 测试复杂度高

**代码证据**:
```javascript
// 同一个服务 (index.js) 包含:
app.post('/api/v1/browser/visit', ...)          // HTTP API
app.post('/api/v1/browser/visit-queue', ...)    // Publisher
queueManager.startWorker(...)                    // Consumer
```

---

#### 2. ack/nack 语义混淆 (已修复)

**原问题**:
```javascript
// 修复前:
if (result.success) {
  message.ack()   // URL 访问成功
} else {
  message.nack()  // URL 访问失败 → 无限重试
}
```

**修复后**:
```javascript
// 总是 ack (消息处理完成)
message.ack()

if (result.success) {
  stats.processed++
} else {
  stats.failed++  // 记录失败,但不重试
}
```

**根本原因**: 混淆了 "消息处理成功" 和 "业务操作成功" 的区别

---

#### 3. Worker 启动依赖环境变量

**问题**:
```javascript
if (process.env.ENABLE_QUEUE_WORKER === '1') {
  await queueManager.startWorker(...)
}
```

**影响**:
- **配置复杂**: 需要为不同实例设置不同环境变量
- **难以调试**: 本地开发和生产环境配置不一致
- **扩展困难**: Publisher 和 Consumer 混在一起,无法独立扩展

**当前配置问题**:
- 所有 browser-exec-preview 实例都运行 worker
- 无法区分 "仅 API" 实例和 "仅 Worker" 实例

---

#### 4. 统计信息不准确

**问题**:
```javascript
// queue-manager.js
getStats() {
  return {
    published: this.stats.published,  // ✅ 准确
    processed: this.stats.processed,  // ❌ 仅当前实例
    failed: this.stats.failed,        // ❌ 仅当前实例
    inProgress: this.stats.inProgress // ❌ 仅当前实例
  }
}
```

**影响**:
- 多实例部署时,每个实例只知道自己的统计
- 无法获取全局队列处理状态
- 测试脚本等待队列完成时无法准确判断

---

#### 5. 缺少结果回调机制

**问题**: 当前架构是 "发后即忘" (fire-and-forget)
- 客户端发布消息后无法获取处理结果
- 无法知道 URL 访问是成功还是失败
- 失败原因只记录在日志中,没有结构化存储

**业务影响**:
- 无法实现 "批量访问 + 汇总结果" 的场景
- 测试脚本需要轮询日志或等待超时

---

## 松耦合架构设计方案

### 方案 A: 最小改动 - 拆分 API 和 Worker (推荐)

#### 架构图

```
┌─────────────────┐        ┌─────────────────────┐
│  browser-exec   │        │  browser-exec-      │
│  (API Only)     │        │  worker             │
│                 │        │  (Consumer Only)    │
│  - /visit       │        │                     │
│  - /visit-queue │───┐    │  - Pull from Pub/  │
│  - Publish to   │   │    │    Sub              │
│    Pub/Sub      │   │    │  - Process URLs    │
└─────────────────┘   │    │  - Write results   │
                      │    └─────────────────────┘
                      ↓
             ┌──────────────────┐
             │  Pub/Sub Topic   │
             │  browser-visit-  │
             │  requests        │
             └──────────────────┘
```

#### 实施步骤

**1. 拆分部署配置**

修改 `.github/workflows/deploy-backend.yml`:

```yaml
# 方案 1: 使用同一镜像,不同启动参数
- name: Deploy browser-exec-preview (API)
  run: |
    gcloud run deploy browser-exec-preview \
      --image=$IMAGE \
      --set-env-vars ENABLE_QUEUE_WORKER=0 \  # API 实例不启动 worker
      --min-instances=1 \
      --concurrency=4

- name: Deploy browser-exec-worker-preview (Worker)
  run: |
    gcloud run deploy browser-exec-worker-preview \
      --image=$IMAGE \
      --set-env-vars ENABLE_QUEUE_WORKER=1 \  # Worker 实例启动 worker
      --min-instances=2 \                      # 至少 2 个 worker
      --concurrency=1 \                        # Worker 不接受 HTTP 请求
      --no-allow-unauthenticated               # Worker 不对外暴露
```

**2. 优化 Worker 启动逻辑**

```javascript
// index.js:663
if (process.env.ENABLE_QUEUE_WORKER === '1') {
  console.log('[pubsub] Starting queue worker...')

  // Worker 模式: 不监听 HTTP (或仅监听健康检查)
  await queueManager.startWorker(
    async (request) => {
      return await unifiedVisitInternalSingleAttempt(request)
    },
    {
      maxMessages: 10,
      maxExtension: 600000
    }
  )

  console.log('[pubsub] Queue worker started')
  console.log('[pubsub] Worker mode: HTTP APIs disabled (health check only)')
}
```

**3. 结果存储 (可选)**

添加 Firestore 或 Cloud SQL 存储访问结果:

```javascript
// queue-manager.js:95-103
if (result.success) {
  this.stats.processed++
  // 存储成功结果
  await saveResult(message.id, {
    url: request.url,
    success: true,
    finalUrl: result.finalUrl,
    brandName: result.brandName,
    timestamp: Date.now()
  })
} else {
  this.stats.failed++
  // 存储失败结果
  await saveResult(message.id, {
    url: request.url,
    success: false,
    failureReason: result.failureReason,
    timestamp: Date.now()
  })
}
```

---

### 方案 B: 完全解耦 - 独立 Worker 服务

#### 架构图

```
┌─────────────────┐        ┌─────────────────────┐
│  browser-exec   │        │  url-visit-worker   │
│  (API Only)     │        │  (独立服务)          │
│                 │        │                     │
│  - /visit       │───┐    │  - Pull from Pub/  │
│  - /visit-queue │   │    │    Sub              │
│  - NO Worker    │   │    │  - Call browser-   │
└─────────────────┘   │    │    exec /visit API │
                      │    │  - Store results   │
                      ↓    └─────────────────────┘
             ┌──────────────────┐
             │  Pub/Sub Topic   │
             └──────────────────┘
```

#### 优点
- **完全解耦**: browser-exec 只负责浏览器访问
- **独立扩展**: Worker 可以独立扩容
- **职责清晰**: Worker 只负责队列消费和结果存储

#### 缺点
- **增加复杂度**: 需要维护额外的服务
- **网络开销**: Worker 需要通过 HTTP 调用 browser-exec

---

## 推荐方案: 方案 A (最小改动)

### 理由

1. **KISS 原则**: 最小化改动,复用现有代码
2. **快速实施**: 只需修改部署配置,无需重构代码
3. **松耦合**: API 和 Worker 在逻辑上分离,可独立扩展
4. **灵活性**: 未来可以轻松迁移到方案 B

### 实施成本

| 任务 | 工作量 | 风险 |
|------|--------|------|
| 修改部署配置 | 30 分钟 | 低 |
| 测试 API 实例 | 15 分钟 | 低 |
| 测试 Worker 实例 | 15 分钟 | 低 |
| 监控和验证 | 30 分钟 | 低 |
| **总计** | **1.5 小时** | **低** |

---

## 附加优化建议

### 1. 统一统计接口

使用 Pub/Sub 监控 API 获取全局统计:

```javascript
// index.js:258
app.get('/api/v1/browser/queue/stats', async (req, res) => {
  const localStats = queueManager.getStats()

  // 获取 Pub/Sub 全局统计
  const subscription = pubsub.subscription('browser-visit-workers')
  const [metadata] = await subscription.getMetadata()

  return res.json({
    success: true,
    stats: {
      ...localStats,
      // 全局统计
      numUndeliveredMessages: metadata.numUndeliveredMessages,
      oldestUnackedMessageAge: metadata.oldestUnackedMessageAge,
    }
  })
})
```

### 2. 添加超时和死信队列

```javascript
// 修改 subscription 配置
{
  flowControl: {
    maxMessages: 10,
    maxExtension: 600000  // 10 分钟
  },
  deadLetterPolicy: {
    deadLetterTopic: 'projects/.../topics/browser-visit-dlq',
    maxDeliveryAttempts: 5  // 最多重试 5 次
  }
}
```

### 3. 结构化日志

```javascript
// 使用结构化日志代替 console.log
import { Logging } from '@google-cloud/logging'
const logging = new Logging()
const log = logging.log('browser-exec')

// 记录处理结果
await log.write(log.entry({
  severity: result.success ? 'INFO' : 'WARNING',
  resource: { type: 'cloud_run_revision' },
}, {
  messageId: message.id,
  url: request.url,
  success: result.success,
  failureReason: result.failureReason,
  duration: Date.now() - startTime
}))
```

---

## 总结

### 当前架构问题

| 问题 | 严重程度 | 已修复 |
|------|---------|--------|
| ack/nack 语义混淆 | 🔴 高 | ✅ 是 |
| 架构耦合度高 | 🟡 中 | ❌ 否 |
| Worker 启动配置复杂 | 🟡 中 | ❌ 否 |
| 统计信息不准确 | 🟢 低 | ❌ 否 |
| 缺少结果回调 | 🟢 低 | ❌ 否 |

### 推荐行动

1. ✅ **立即**: ack/nack 修复已完成,等待部署验证
2. 🔄 **短期** (本周): 实施方案 A - 拆分 API 和 Worker 部署
3. 📊 **中期** (下周): 添加全局统计和结果存储
4. 🚀 **长期** (按需): 考虑方案 B - 完全解耦架构

---

**评估者**: Claude Code
**报告版本**: 1.0
**最后更新**: 2025-10-02
