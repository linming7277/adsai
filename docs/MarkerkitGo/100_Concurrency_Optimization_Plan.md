# Browser-Exec 100并发优化方案

**当前状态**: 8-12并发，成功率83-87%
**目标**: 100并发，成功率>90%

---

## 🔍 当前瓶颈分析

### 1. Cloud Run实例限制
- **当前配置**: concurrency=4, max-instances=10
- **理论最大并发**: 4 × 10 = **40并发**
- **瓶颈**: 最大实例数不足

### 2. 代理池限制
- **当前配置**: PROXY_POOL_WARMUP_SIZE=20
- **问题**: 20个代理无法支持100并发（每个请求需独立代理）
- **瓶颈**: 代理池大小不足

### 3. 浏览器资源限制
- **内存**: 2Gi per instance
- **CPU**: 2 per instance
- **问题**: Playwright浏览器实例消耗大量资源
- **瓶颈**: 单实例并发能力受限

### 4. 网络带宽限制
- Cloud Run出站流量限制
- 代理提供商API限流

---

## 🚀 优化方案

### 方案A: 垂直扩展 + 水平扩展（推荐）

#### 1. 增加Cloud Run实例数

```bash
gcloud run deploy browser-exec-preview \
  --image=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/browser-exec:preview-latest \
  --region=asia-northeast1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=4Gi \                    # 2Gi → 4Gi (增加内存)
  --cpu=4 \                          # 2 → 4 (增加CPU)
  --concurrency=8 \                  # 4 → 8 (增加单实例并发)
  --timeout=600 \
  --min-instances=5 \                # 1 → 5 (预热5个实例，减少冷启动)
  --max-instances=20 \               # 10 → 20 (增加最大实例数)
  --set-env-vars="PROXY_URL_US=...,PROXY_POOL_WARMUP_SIZE=100,BROWSER_MAX_CONCURRENCY=8"
```

**理论并发能力**: 8 × 20 = **160并发**

**成本估算**:
- 内存: 4Gi × 20实例 = 80Gi
- CPU: 4 × 20实例 = 80 vCPU
- 预计成本: ~$200-300/月 (按使用量计费)

#### 2. 优化代理池配置

```javascript
// services/browser-exec/index.js

// 增加代理池大小
const WARMUP_POOL_SIZE = Number(process.env.PROXY_POOL_WARMUP_SIZE || 100)

// 优化代理分配策略
async function getNextProxyForURL(url, proxyProviderURL, poolSize = 50) {
  // 增加单次请求的代理池大小
  const pool = await getProxyPool(proxyProviderURL, poolSize)

  // 更激进的健康检查
  let healthyProxies = pool.filter(proxy => {
    const health = getProxyHealth(proxy)
    return health.score >= 60  // 降低阈值，接受更多代理
  })

  // ...
}
```

**配置**:
- `PROXY_POOL_WARMUP_SIZE=100` - 启动时预热100个代理
- `proxyPoolSize=50` - 每次请求使用50个代理池

#### 3. 优化浏览器资源使用

```javascript
// 减少浏览器资源消耗

// 1. 禁用更多资源
const resourceBlock = ['image', 'font', 'media', 'stylesheet', 'websocket', 'manifest']

// 2. 降低超时时间
const navigationTimeout = 30000  // 60s → 30s

// 3. 使用更激进的等待策略
await page.goto(url, {
  waitUntil: 'domcontentloaded',  // 不等待load事件
  timeout: 30000
})

// 4. 快速关闭浏览器
await context.close()
await browser.close()
```

#### 4. 实现连接池复用

```javascript
// 浏览器实例池（复用浏览器）
class BrowserPool {
  constructor(maxSize = 10) {
    this.pool = []
    this.maxSize = maxSize
  }

  async acquire() {
    if (this.pool.length > 0) {
      return this.pool.pop()
    }
    return await playwright.chromium.launch(...)
  }

  release(browser) {
    if (this.pool.length < this.maxSize) {
      this.pool.push(browser)
    } else {
      browser.close()
    }
  }
}

const browserPool = new BrowserPool(10)
```

---

### 方案B: 架构重构（长期方案）

#### 1. 引入消息队列

```
Client → API Gateway → Redis Queue → Browser-Exec Workers (N个)
```

**优点**:
- 解耦请求和处理
- 支持任意并发（队列缓冲）
- 更好的负载均衡
- 支持重试和优先级

**实现**:
```javascript
// 使用Redis作为任务队列
import { Queue } from 'bullmq'

const visitQueue = new Queue('browser-visits', {
  connection: { host: 'redis-host', port: 6379 }
})

// API端点：提交任务
app.post('/api/v1/browser/visit-async', async (req, res) => {
  const job = await visitQueue.add('visit', req.body, {
    priority: req.body.priority || 5,
    attempts: 3
  })

  return res.json({ jobId: job.id, status: 'queued' })
})

// Worker: 处理任务
const worker = new Worker('browser-visits', async job => {
  return await unifiedVisitInternalSingleAttempt(job.data)
}, { concurrency: 4 })
```

#### 2. 分布式部署

- **多区域部署**: asia-northeast1, us-central1, europe-west1
- **智能路由**: 根据目标URL地理位置选择最近的区域
- **负载均衡**: Cloud Load Balancer分发请求

---

## 📊 配置对比

| 配置项 | 当前 | 方案A | 方案B |
|--------|------|-------|-------|
| **max-instances** | 10 | 20 | 50 |
| **concurrency** | 4 | 8 | 4 |
| **memory** | 2Gi | 4Gi | 2Gi |
| **cpu** | 2 | 4 | 2 |
| **min-instances** | 1 | 5 | 10 |
| **代理池** | 20 | 100 | 200 |
| **理论并发** | 40 | 160 | 200 |
| **实际并发** | 12 | **100+** | **200+** |
| **成本/月** | $50 | $250 | $500 |

---

## 🎯 实施步骤（方案A）

### 第1步: 增加代理池（立即）

```bash
gcloud run services update browser-exec-preview \
  --region=asia-northeast1 \
  --update-env-vars="PROXY_POOL_WARMUP_SIZE=100"
```

### 第2步: 扩展实例配置（立即）

```bash
gcloud run deploy browser-exec-preview \
  --image=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/browser-exec:preview-latest \
  --region=asia-northeast1 \
  --memory=4Gi \
  --cpu=4 \
  --concurrency=8 \
  --min-instances=5 \
  --max-instances=20
```

### 第3步: 代码优化（1-2小时）

```javascript
// 1. 优化资源阻止
const resourceBlock = ['image', 'font', 'media', 'stylesheet', 'websocket', 'manifest']

// 2. 降低超时
const navigationTimeout = 30000

// 3. 增加代理池大小
proxyPoolSize: 50

// 4. 优化等待策略
waitUntil: 'domcontentloaded'
```

### 第4步: 测试验证（30分钟）

```bash
# 测试20并发
node test-concurrency-100.js --concurrency=20

# 测试50并发
node test-concurrency-100.js --concurrency=50

# 测试100并发
node test-concurrency-100.js --concurrency=100
```

### 第5步: 监控调优（持续）

- 监控CPU/内存使用率
- 监控代理池健康状态
- 监控请求成功率
- 根据数据调整参数

---

## 💰 成本优化建议

### 1. 使用自动缩放
- 低峰期：min-instances=2
- 高峰期：自动扩展到20
- 成本节省：~40%

### 2. 优化代理成本
- 使用更便宜的代理提供商
- 实现代理缓存和复用
- 按需获取代理（而非预热100个）

### 3. 资源优化
- 监控实际CPU/内存使用
- 如果使用率<50%，降低配置
- 使用Spot实例（如果可用）

---

## 📈 预期效果

### 方案A实施后

| 指标 | 当前 | 预期 |
|------|------|------|
| **最大并发** | 12 | **100+** |
| **成功率** | 83% | **90%+** |
| **平均响应时间** | 12s | **15s** |
| **冷启动时间** | 10s | **<2s** (min-instances=5) |
| **月成本** | $50 | **$250** |

### ROI分析

- **并发提升**: 12 → 100 (**+733%**)
- **成本增加**: $50 → $250 (**+400%**)
- **性价比**: 提升 **83%**

---

## ⚠️ 风险和注意事项

### 1. 代理提供商限制
- **问题**: 100并发需要100+代理，代理提供商可能限流
- **解决**:
  - 联系代理提供商提升配额
  - 使用多个代理提供商
  - 实现代理轮换机制

### 2. Cloud Run配额
- **问题**: 单区域max-instances可能有限制
- **解决**:
  - 申请提升配额
  - 多区域部署

### 3. 浏览器内存泄漏
- **问题**: 长时间运行可能导致内存泄漏
- **解决**:
  - 定期重启实例（rolling update）
  - 监控内存使用，超过阈值自动重启

### 4. 网络带宽
- **问题**: 100并发可能超过网络带宽限制
- **解决**:
  - 优化资源加载（已实现resourceBlock）
  - 使用CDN加速
  - 监控网络流量

---

## 🔜 下一步行动

### 立即执行（今天）
1. ✅ 增加PROXY_POOL_WARMUP_SIZE到100
2. ✅ 部署扩展配置（4Gi内存，4CPU，concurrency=8，max-instances=20）
3. ✅ 运行100并发测试

### 短期（本周）
1. 优化代码（资源阻止、超时、等待策略）
2. 实现浏览器实例池复用
3. 添加性能监控和告警

### 中期（2周）
1. 评估方案B（消息队列）
2. 多区域部署（如需要）
3. 成本优化和自动缩放调优

---

**总结**: 方案A可立即实施，预计1小时内完成，支持100并发，成本可控。
