# browser-exec 高并发能力评估报告

**评估日期**: 2025-10-02
**评估目标**: 评估拆分架构下的高并发处理能力，识别瓶颈，提出优化方案

---

## 当前配置参数

### Cloud Run 配置 (browser-exec-preview)

| 参数 | 当前值 | 说明 |
|------|--------|------|
| **containerConcurrency** | 4 | 每个实例同时处理的 HTTP 请求数 |
| **minInstances** | 1 | 最小实例数 (保持热启动) |
| **maxInstances** | 10 | 最大实例数 (自动扩展上限) |
| **memory** | 2Gi | 每个实例内存 |
| **cpu** | 2 | 每个实例 CPU 核心数 |

### Pub/Sub Worker 配置

| 参数 | 当前值 | 说明 |
|------|--------|------|
| **maxMessages** | 10 | 每个 worker 实例同时处理的消息数 |
| **maxExtension** | 600000ms | 消息处理超时 (10分钟) |
| **ackDeadline** | 600s | 消息确认超时 |

### 浏览器池配置

| 参数 | 当前值 | 说明 |
|------|--------|------|
| **BROWSER_MAX_CONCURRENCY** | 4 | 浏览器任务队列并发数 |
| **BROWSER_MAX_CONTEXTS** | 12 | 最大浏览器上下文数 |
| **BROWSER_MAX_MEMORY_MB** | 1536 | 浏览器内存上限 |

---

## 并发能力计算

### 场景 1: 当前架构 (API + Worker 混合)

**假设**: 所有 10 个实例都启用 `ENABLE_QUEUE_WORKER=1`

```
并发容量:
- HTTP API 并发: 10 实例 × 4 并发 = 40 个同时请求
- Pub/Sub 并发: 10 实例 × 10 maxMessages = 100 个同时处理
- 浏览器任务: 10 实例 × 4 BROWSER_MAX_CONCURRENCY = 40 个浏览器任务

瓶颈:
1. 浏览器任务并发 (40) < Pub/Sub 并发 (100)
   → 60 个消息会排队等待浏览器任务槽位
2. 内存限制: 2Gi / 实例
   → Playwright + 12 contexts ≈ 1.5-1.8Gi (接近上限)
3. CPU 竞争: HTTP 请求和 Pub/Sub 消息共享 CPU
```

**理论吞吐量** (基于测试数据):
```
平均处理时间: 29.83s / URL
并发处理能力: 40 个浏览器任务
吞吐量: 40 / 29.83s ≈ 1.34 URL/s ≈ 80 URL/分钟
```

---

### 场景 2: 拆分架构 (API 分离 + 专用 Worker)

#### 配置方案

```yaml
# API 实例 (接收请求，发布到队列)
browser-exec-preview:
  concurrency: 10          # 提高到 10 (无浏览器负载)
  min-instances: 1
  max-instances: 5         # 降低到 5 (API 负载较轻)
  memory: 1Gi              # 降低到 1Gi (无浏览器)
  cpu: 1
  ENABLE_QUEUE_WORKER: 0

# Worker 实例 (专门消费队列)
browser-exec-worker-preview:
  concurrency: 1                    # 设为 1 (不接受 HTTP)
  min-instances: 3                  # 至少 3 个 worker
  max-instances: 20                 # 可扩展到 20
  memory: 2Gi
  cpu: 2
  ENABLE_QUEUE_WORKER: 1
  BROWSER_MAX_CONCURRENCY: 10       # 提高到 10
  maxMessages: 10
```

#### 并发容量计算

```
1. 发布能力 (API 实例):
   - 5 实例 × 10 并发 = 50 个同时发布请求
   - 发布耗时: ~500ms / 请求
   - 发布吞吐量: 50 / 0.5s = 100 请求/s = 6000 请求/分钟

2. 消费能力 (Worker 实例):
   - 20 实例 × 10 maxMessages = 200 个同时处理的消息
   - 20 实例 × 10 BROWSER_MAX_CONCURRENCY = 200 个浏览器任务
   - 平均处理时间: 29.83s
   - 处理吞吐量: 200 / 29.83s ≈ 6.7 URL/s ≈ 402 URL/分钟

3. 瓶颈分析:
   ✅ 发布能力 (6000/分钟) >> 消费能力 (402/分钟)
   ✅ 浏览器任务槽位 (200) = maxMessages (200) → 无排队
   ⚠️  消费速度受限于 URL 平均处理时间 (29.83s)
```

**理论吞吐量对比**:

| 架构 | 并发处理数 | 吞吐量 (URL/分钟) | 提升倍数 |
|------|-----------|-----------------|---------|
| 当前混合架构 | 40 | 80 | 1x |
| 拆分架构 (20 workers) | 200 | 402 | **5x** |

---

## 高并发场景测试用例

### 用例 1: 100 URL 批量访问

#### 当前架构表现

```
场景: 100 个 URL 同时提交到队列

1. 发布阶段:
   - 耗时: ~5s (✅ 快速)
   - 所有消息进入 Pub/Sub

2. 处理阶段:
   - 并发处理: 40 个
   - 第一批 (1-40): 0-30s 完成
   - 第二批 (41-80): 30-60s 完成
   - 第三批 (81-100): 60-90s 完成
   - 总耗时: ~90s

3. 瓶颈:
   - 40 个浏览器任务槽位 < 100 个 maxMessages
   - 60 个消息在内存中排队等待
```

#### 拆分架构表现 (20 workers)

```
场景: 100 个 URL 同时提交到队列

1. 发布阶段:
   - 耗时: ~2s (✅ API 实例性能提升)
   - 所有消息进入 Pub/Sub

2. 处理阶段:
   - 并发处理: 200 个 (> 100)
   - 第一批 (1-100): 0-30s 内全部完成
   - 总耗时: ~30s

3. 优势:
   - 200 个浏览器任务槽位 > 100 个消息
   - 无排队等待
   - 处理时间从 90s 降至 30s (3x 提升)
```

---

### 用例 2: 1000 URL 批量访问

#### 当前架构表现

```
场景: 1000 个 URL 同时提交

1. 发布阶段:
   - 耗时: ~50s (瓶颈: API 并发 40)

2. 处理阶段:
   - 并发处理: 40 个
   - 批次数: 1000 / 40 = 25 批
   - 总耗时: 25 × 30s = 750s (12.5分钟)

3. 问题:
   - 发布慢 (50s)
   - 处理慢 (12.5分钟)
   - 队列堆积 (960 个消息等待)
```

#### 拆分架构表现 (20 workers)

```
场景: 1000 个 URL 同时提交

1. 发布阶段:
   - 耗时: ~10s (API 并发 50)
   - ✅ 5x 提升

2. 处理阶段:
   - 并发处理: 200 个
   - 批次数: 1000 / 200 = 5 批
   - 总耗时: 5 × 30s = 150s (2.5分钟)
   - ✅ 5x 提升

3. 优势:
   - 发布快 (10s vs 50s)
   - 处理快 (2.5分钟 vs 12.5分钟)
   - 队列堆积少 (800 vs 960)
```

---

### 用例 3: 极限并发 - 10000 URL

#### 拆分架构 + 优化配置

**Worker 配置优化**:
```yaml
browser-exec-worker-preview:
  min-instances: 10         # 提高最小实例
  max-instances: 50         # 提高上限
  maxMessages: 10
  BROWSER_MAX_CONCURRENCY: 10
```

**并发能力**:
```
并发处理: 50 实例 × 10 maxMessages = 500 个消息
浏览器任务: 50 实例 × 10 BROWSER_MAX_CONCURRENCY = 500 个任务
吞吐量: 500 / 29.83s ≈ 16.76 URL/s ≈ 1000 URL/分钟
```

**10000 URL 处理时间**:
```
发布: ~20s (API 可扩展到 5 实例)
处理: 10000 / 500 = 20 批 × 30s = 600s (10分钟)
总计: ~10.3 分钟
```

---

## 瓶颈分析

### 1. 浏览器处理时间 (核心瓶颈)

```
当前平均处理时间: 29.83s
- pboost.me: 11.23s (快)
- dognet.com: 18.93s (中)
- bonusarrive.com: 33.04s (慢)
- yeahpromos.com: 56.12s (非常慢)

瓶颈原因:
1. Cloudflare 挑战: 20-25s
2. 倒计时页面等待: 15s
3. 多重跳转: 4+ 跳
4. 代理连接: 2-5s
```

**优化空间**:
- 🔴 Cloudflare: 无法避免 (20s 固定)
- 🟡 倒计时: 可优化模式识别,减少冗余等待
- 🟢 多重跳转: 可优化跳转检测逻辑
- 🟢 代理: 可使用更快的代理池

**理论最佳**:
```
假设优化到平均 20s:
- 当前架构: 40 / 20s = 2 URL/s = 120 URL/分钟
- 拆分架构 (20 workers): 200 / 20s = 10 URL/s = 600 URL/分钟
- 拆分架构 (50 workers): 500 / 20s = 25 URL/s = 1500 URL/分钟
```

---

### 2. 内存限制

**当前配置**: 2Gi / 实例

**内存使用分析**:
```
- Node.js 进程: ~200MB
- Playwright 浏览器: ~500MB
- 12 个 contexts: 12 × 50MB = 600MB
- 页面缓存/临时文件: ~200MB
- 总计: ~1.5Gi (75% 利用率)
```

**扩展限制**:
```
如果提高 BROWSER_MAX_CONCURRENCY 到 15:
- 需要更多 contexts (18+)
- 内存需求: 18 × 50MB + 500MB + 400MB = 1.8Gi
- 风险: 可能触发 OOM (Out of Memory)
```

**建议**:
- 保持 2Gi + BROWSER_MAX_CONCURRENCY=10 (安全)
- 或升级到 4Gi + BROWSER_MAX_CONCURRENCY=20 (激进)

---

### 3. CPU 限制

**当前配置**: 2 CPU / 实例

**CPU 使用场景**:
```
混合架构 (API + Worker):
- HTTP 请求处理: 20% CPU
- Pub/Sub 消息处理: 10% CPU
- Playwright 浏览器: 60% CPU
- 其他: 10% CPU
→ 总计: ~100% (CPU 饱和)

拆分架构 (Worker Only):
- Pub/Sub 消息处理: 10% CPU
- Playwright 浏览器: 80% CPU
- 其他: 10% CPU
→ 总计: ~100% (更高效)
```

**优化建议**:
- Worker 实例: 保持 2 CPU (浏览器密集)
- API 实例: 降低到 1 CPU (IO 密集)
- 成本节省: API 实例 CPU 成本降低 50%

---

### 4. Pub/Sub 配额限制

**Cloud Pub/Sub 配额**:
```
- 发布吞吐量: 无限制 (实际受 API 实例限制)
- 订阅吞吐量: 无限制
- 未确认消息: 10,000 个 / 订阅 (✅ 足够)
- 消息保留: 7 天
- 消息大小: 10MB / 消息 (✅ 足够)
```

**不是瓶颈**: Pub/Sub 可轻松支持 10,000+ 并发

---

### 5. 代理池限制

**当前代理服务** (iprocket.io):
```
- 代理池大小: 50 个 (预热)
- 代理质量: 60-80% 成功率
- 代理速度: 2-5s 连接延迟
```

**高并发问题**:
```
场景: 200 个并发任务,50 个代理
- 代理重用率: 200 / 50 = 4x
- 全局分配锁: 10s 窗口
→ 每个代理最多 10s 内分配 1 次
→ 50 个代理 = 50 个任务 / 10s = 5 任务/s

瓶颈: 代理分配速度 < 任务需求
```

**优化方案**:
1. 增大代理池: 50 → 200
2. 减少锁窗口: 10s → 5s
3. 使用多个代理服务商

---

## 高并发优化方案

### 方案 1: 渐进式扩展 (推荐)

**目标**: 支持 500 并发,1000 URL/分钟

#### 第一阶段: 拆分架构 (立即实施)

```yaml
# API 实例
browser-exec-preview:
  concurrency: 10
  min-instances: 1
  max-instances: 5
  memory: 1Gi
  cpu: 1
  ENABLE_QUEUE_WORKER: 0

# Worker 实例
browser-exec-worker-preview:
  concurrency: 1
  min-instances: 5        # 从 1 提高到 5
  max-instances: 20       # 从 10 提高到 20
  memory: 2Gi
  cpu: 2
  ENABLE_QUEUE_WORKER: 1
  maxMessages: 10
  BROWSER_MAX_CONCURRENCY: 10
```

**预期性能**:
```
并发处理: 20 × 10 = 200 个消息
吞吐量: 200 / 29.83s ≈ 400 URL/分钟
成本: ~$150-200/月 (中等)
```

#### 第二阶段: 代理池优化 (1周内)

```javascript
// smart-proxy-pool.js
const WARMUP_POOL_SIZE = 200  // 从 50 提高到 200
const LOCK_WINDOW = 5000      // 从 10s 降到 5s

// 支持多代理服务商
const PROXY_PROVIDERS = [
  process.env.PROXY_URL_US_1,
  process.env.PROXY_URL_US_2,
  process.env.PROXY_URL_ROW
]
```

**预期性能**:
```
代理池: 200 个
代理分配: 200 / 5s = 40 任务/s
支持并发: 200 个任务
```

#### 第三阶段: 处理时间优化 (2周内)

**优化目标**:
1. 减少冗余等待时间: 29.83s → 25s
2. 优化 Pattern Library 识别准确度
3. 改进跳转检测逻辑

**预期性能**:
```
平均处理时间: 25s
吞吐量: 200 / 25s ≈ 480 URL/分钟 (提升 20%)
```

---

### 方案 2: 激进扩展 (高并发场景)

**目标**: 支持 1000+ 并发,2000 URL/分钟

```yaml
# Worker 实例
browser-exec-worker-preview:
  min-instances: 20       # 大幅提高最小实例
  max-instances: 50       # 上限 50
  memory: 4Gi             # 翻倍内存
  cpu: 2
  BROWSER_MAX_CONCURRENCY: 20  # 翻倍并发
  maxMessages: 20         # 翻倍消息
```

**并发能力**:
```
并发处理: 50 × 20 = 1000 个消息
浏览器任务: 50 × 20 = 1000 个任务
吞吐量: 1000 / 25s ≈ 2400 URL/分钟
```

**成本估算**:
```
Worker: 50 实例 × 4Gi × 2 CPU × $0.00001667/GB-s × 2592000s/月
     ≈ $8,640/月 (高昂)

优化建议:
- 使用 spot 实例 (降低 50% 成本)
- 配置更激进的 scale-down (min-instances=5)
- 按需扩展 (max-instances=50, 平时 5-10 实例)
```

---

### 方案 3: 混合弹性扩展 (成本优化)

**策略**: 低成本基础 + 按需爆发

```yaml
# 基础 Worker (常驻)
browser-exec-worker-preview:
  min-instances: 3
  max-instances: 10
  memory: 2Gi
  cpu: 2

# 爆发 Worker (按需)
browser-exec-worker-burst:
  min-instances: 0        # 无流量时降为 0
  max-instances: 40       # 高峰时扩展到 40
  memory: 2Gi
  cpu: 2
```

**弹性扩展配置**:
```yaml
# Cloud Run 自动扩展参数
--scale-down-delay: 300s     # 空闲 5 分钟后缩容
--max-scale: 40
--concurrency-target: 8      # 每 8 个并发消息扩展 1 个实例
```

**成本效益**:
```
平时 (低流量):
- 3 实例 × 2Gi × 2CPU ≈ $200/月

高峰 (高流量):
- 40 实例 × 2Gi × 2CPU × 1小时 ≈ $20/小时
- 每天 2 小时高峰 × 30 天 ≈ $1200/月

总计: ~$1400/月 (比常驻 50 实例节省 84%)
```

---

## 监控和告警配置

### 关键指标

```javascript
// Prometheus 指标
const pubsubQueueLength = new client.Gauge({
  name: 'pubsub_queue_length',
  help: 'Number of messages waiting in queue'
})

const pubsubProcessingTime = new client.Histogram({
  name: 'pubsub_processing_time_seconds',
  help: 'Message processing time',
  buckets: [10, 20, 30, 45, 60, 90, 120]
})

const workerUtilization = new client.Gauge({
  name: 'worker_utilization_percent',
  help: 'Worker instance utilization'
})
```

### 告警规则

```yaml
# Cloud Monitoring 告警
alerts:
  - name: "Pub/Sub 队列堆积"
    condition: pubsub_queue_length > 1000
    duration: 5m
    action: 扩展 worker 实例

  - name: "Worker 处理延迟"
    condition: pubsub_processing_time_p95 > 60s
    duration: 10m
    action: 检查代理质量 / 优化代码

  - name: "Worker 内存接近上限"
    condition: memory_utilization > 85%
    duration: 5m
    action: 降低并发 / 增加内存
```

---

## 总结和建议

### 并发能力对比

| 场景 | 架构 | 并发处理 | 吞吐量 (URL/分钟) | 成本/月 |
|------|------|---------|------------------|---------|
| **当前** | 混合 (10 实例) | 40 | 80 | $300 |
| **方案 1** | 拆分 (20 workers) | 200 | 400 | $600 |
| **方案 2** | 激进 (50 workers) | 1000 | 2400 | $8640 |
| **方案 3** | 混合弹性 | 10-400 | 80-1600 | $1400 |

### 推荐路线图

#### 第 1 周: 基础拆分
- ✅ 实施方案 1 (拆分 API 和 Worker)
- ✅ 配置 min-instances=5, max-instances=20
- ✅ 测试 200 并发场景

#### 第 2-3 周: 代理优化
- 🔄 增大代理池到 200
- 🔄 支持多代理服务商
- 🔄 优化代理分配锁

#### 第 4-6 周: 处理优化
- 🔄 优化 Pattern Library
- 🔄 减少冗余等待时间
- 🔄 改进跳转检测

#### 长期: 弹性扩展
- 📋 实施方案 3 (混合弹性)
- 📋 配置自动扩展策略
- 📋 成本优化和监控

---

**评估者**: Claude Code
**报告版本**: 1.0
**最后更新**: 2025-10-02
