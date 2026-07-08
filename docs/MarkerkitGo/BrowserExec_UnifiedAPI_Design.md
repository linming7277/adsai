# Browser-Exec统一API设计方案

## 业务场景分析

### 场景对比矩阵

| 场景 | 核心需求 | 资源加载 | 反风控 | 代理 | Referer | 超时容忍 | 重试策略 |
|------|---------|---------|--------|------|---------|---------|---------|
| **场景1: Offer评估** | 获取域名+品牌名 | 最小化(禁用图片/字体/CSS) | 中等 | 必需(按国家) | 社媒轮询 | 中等(30s) | 快速失败 |
| **场景2: 补点击** | 模拟真人访问 | 完整加载 | **高** | 必需(按国家) | 社媒轮询 | 高(60s) | 智能重试 |
| **场景3: 换链接** | 获取Final URL Suffix | 最小化 | 中等 | 可选 | 社媒轮询 | 低(15s) | 快速失败 |
| **场景4: 可用性检测** | 判断链接有效性 | **无**(HEAD请求优先) | 低 | 可选 | 置空 | 极低(10s) | 不重试 |

### 共性需求
1. ✅ 完整重定向链追踪
2. ✅ 代理IP支持（基于目标国家）
3. ✅ Referer自定义策略
4. ✅ 快速失败机制
5. ✅ 流量优化
6. ✅ 风控检测识别

### 差异化需求
- **资源加载策略**: 从无加载(HEAD) → 最小化(禁用图片/CSS) → 完整加载
- **反风控强度**: 从低(可用性检测) → 高(补点击)
- **超时时间**: 从10秒(可用性) → 60秒(补点击)
- **重试策略**: 从不重试(可用性) → 智能重试(补点击)

## 统一API设计

### 核心理念
**一个端点，多种模式**: 通过 `visitMode` 参数区分业务场景

### API端点: POST /api/v1/browser/visit

#### 请求Schema
```json
{
  "url": "string (required)",
  "visitMode": "evaluate | click | resolve | check (required)",
  "targetCountry": "US | GB | CA | ... (default: US)",
  "refererStrategy": "social | search | direct | custom | none (default: social)",
  "customReferer": "string (optional, used when refererStrategy=custom)",
  "proxyProviderURL": "string (optional)",
  "timeoutMs": "number (optional, auto-set by visitMode)",
  "advancedOptions": {
    "enableRetry": "boolean (optional, auto-set by visitMode)",
    "maxRetries": "number (default: 0)",
    "enableAntiBot": "boolean (optional, auto-set by visitMode)",
    "captureScreenshot": "boolean (default: false)",
    "executeJavaScript": "string (optional)"
  }
}
```

#### Visit Modes详解

##### Mode 1: `evaluate` (Offer评估)
```json
{
  "visitMode": "evaluate",
  "preset": {
    "resourceBlocking": ["image", "font", "media", "stylesheet"],
    "timeoutMs": 30000,
    "enableRetry": false,
    "enableAntiBot": true,
    "refererStrategy": "social"
  }
}
```
**返回数据**:
- finalUrl, finalUrlSuffix, domain, brandName
- redirectChain (完整重定向链)
- htmlSnippet (50KB)
- timings

##### Mode 2: `click` (补点击)
```json
{
  "visitMode": "click",
  "preset": {
    "resourceBlocking": [],  // 完整加载
    "timeoutMs": 60000,
    "enableRetry": true,
    "maxRetries": 2,
    "enableAntiBot": true,
    "enableFingerprinting": true,
    "humanBehavior": {
      "enableMouseMovement": true,
      "enableScrolling": true,
      "dwellTimeMs": 3000
    },
    "refererStrategy": "social"
  }
}
```
**返回数据**:
- success (是否成功访问)
- finalUrl
- antiDetectionResult (是否通过风控)
- captchaDetected (是否检测到验证码)
- timings

##### Mode 3: `resolve` (换链接)
```json
{
  "visitMode": "resolve",
  "preset": {
    "resourceBlocking": ["image", "font", "media"],
    "timeoutMs": 15000,
    "enableRetry": false,
    "enableAntiBot": false,
    "refererStrategy": "social"
  }
}
```
**返回数据**:
- finalUrl
- finalUrlSuffix (重点!)
- domain
- redirectChain

##### Mode 4: `check` (可用性检测)
```json
{
  "visitMode": "check",
  "preset": {
    "method": "HEAD",  // 优先使用HEAD请求
    "fallbackToBrowser": true,  // HEAD失败时降级为浏览器
    "resourceBlocking": ["*"],  // 禁用所有资源
    "timeoutMs": 10000,
    "enableRetry": false,
    "enableAntiBot": false,
    "refererStrategy": "none"
  }
}
```
**返回数据**:
- available (boolean)
- statusCode
- responseTimeMs
- method ("HEAD" | "browser")
- errorType (if unavailable)

#### 响应Schema
```json
{
  "success": true,
  "visitMode": "evaluate",
  "result": {
    "finalUrl": "https://brand.com/landing",
    "finalUrlSuffix": "utm_source=affiliate&utm_campaign=test",
    "domain": "brand.com",
    "brandName": "Brand Name",
    "statusCode": 200,
    "redirectChain": [
      {"url": "...", "statusCode": 302, "timestamp": "..."},
      {"url": "...", "statusCode": 200, "timestamp": "..."}
    ],
    "antiDetectionResult": {
      "passed": true,
      "cloudflareDetected": false,
      "captchaDetected": false,
      "blockedByGeo": false
    },
    "resourceStats": {
      "totalRequests": 25,
      "blockedRequests": 180,
      "bandwidthSavedKB": 2800
    },
    "timings": {
      "totalMs": 3200,
      "navigationMs": 2000,
      "stabilizationMs": 1200
    },
    "metadata": {
      "proxyUsed": true,
      "proxyLocation": "US",
      "referer": "https://facebook.com",
      "userAgent": "Mozilla/5.0..."
    }
  },
  "error": null
}
```

## Referer策略实现

### Referer预设列表

#### Social Media (社媒轮询)
```javascript
const SOCIAL_REFERERS = [
  'https://www.facebook.com/',
  'https://www.instagram.com/',
  'https://twitter.com/',
  'https://www.tiktok.com/',
  'https://www.youtube.com/',
  'https://www.linkedin.com/',
  'https://www.reddit.com/',
  'https://www.pinterest.com/'
]
```

#### Search Engines (搜索引擎轮询)
```javascript
const SEARCH_REFERERS = [
  'https://www.google.com/search',
  'https://www.bing.com/search',
  'https://search.yahoo.com/',
  'https://duckduckgo.com/'
]
```

### 策略逻辑
```javascript
function selectReferer(strategy, customReferer, targetCountry) {
  switch (strategy) {
    case 'social':
      return SOCIAL_REFERERS[Math.floor(Math.random() * SOCIAL_REFERERS.length)]
    case 'search':
      return SEARCH_REFERERS[Math.floor(Math.random() * SEARCH_REFERERS.length)]
    case 'direct':
      return 'https://www.google.com/'  // 假装从Google首页来
    case 'custom':
      return customReferer || null
    case 'none':
      return null  // 不设置Referer
    default:
      return SOCIAL_REFERERS[0]
  }
}
```

## 快速失败机制

### 风控检测策略

#### 1. 提前检测Cloudflare拦截
```javascript
async function detectAntiBot(page) {
  const earlyChecks = await Promise.race([
    // 检查1: 标题检测 (50ms内返回)
    page.title().then(title => {
      if (/just a moment|cloudflare|ddos-guard|checking your browser/i.test(title)) {
        return { blocked: true, type: 'cloudflare', method: 'title' }
      }
    }),

    // 检查2: 内容特征检测 (100ms内返回)
    page.content().then(html => {
      if (html.includes('cf-browser-verification') ||
          html.includes('ray-id') ||
          html.includes('__cf_chl_jschl_tk__')) {
        return { blocked: true, type: 'cloudflare', method: 'content' }
      }
    }),

    // 超时保护
    new Promise(resolve => setTimeout(() => resolve(null), 200))
  ])

  if (earlyChecks?.blocked) {
    throw new Error(`ANTIBOT_BLOCKED: ${earlyChecks.type}`)
  }
}
```

#### 2. 快速失败超时
```javascript
const FAST_FAIL_TIMEOUTS = {
  check: 10000,    // 可用性检测: 10秒
  resolve: 15000,  // 换链接: 15秒
  evaluate: 30000, // 评估: 30秒
  click: 60000     // 补点击: 60秒
}

async function visitWithFastFail(url, mode) {
  const timeout = FAST_FAIL_TIMEOUTS[mode]
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    // 尝试访问
    await page.goto(url, {
      timeout,
      waitUntil: mode === 'check' ? 'domcontentloaded' : 'networkidle',
      signal: controller.signal
    })

    // 风控检测 (仅在需要时)
    if (['evaluate', 'click'].includes(mode)) {
      await detectAntiBot(page)
    }

    return { success: true }
  } catch (error) {
    clearTimeout(timer)

    // 快速返回失败类型
    if (error.message.includes('ANTIBOT_BLOCKED')) {
      return { success: false, errorType: 'antibot', fastFailed: true }
    }
    if (error.name === 'TimeoutError') {
      return { success: false, errorType: 'timeout', fastFailed: true }
    }
    if (error.message.includes('net::ERR_')) {
      return { success: false, errorType: 'network', fastFailed: true }
    }

    return { success: false, errorType: 'unknown', fastFailed: true }
  }
}
```

### 3. 智能重试策略 (仅补点击模式)
```javascript
async function visitWithRetry(url, mode, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await visitWithFastFail(url, mode)

    if (result.success) return result

    // 根据失败类型决定是否重试
    const shouldRetry =
      result.errorType === 'network' ||  // 网络问题可重试
      result.errorType === 'timeout' ||  // 超时可重试
      (result.errorType === 'antibot' && attempt === 0)  // 风控第一次可换代理重试

    if (!shouldRetry || attempt === maxRetries) {
      return result  // 快速失败，不继续重试
    }

    // 换代理重试
    await switchProxy()
    await sleep(1000 * (attempt + 1))  // 指数退避
  }
}
```

## 代理选择优化

### 代理池管理
```javascript
class ProxyPool {
  constructor() {
    this.proxies = new Map()  // country -> [proxy1, proxy2, ...]
    this.stats = new Map()    // proxy -> { success: 0, fail: 0, avgLatency: 0 }
  }

  async selectBestProxy(country, previousFailed = null) {
    const candidates = this.proxies.get(country) || []

    // 过滤掉刚失败的代理
    const available = candidates.filter(p => p !== previousFailed)

    // 按成功率和延迟排序
    available.sort((a, b) => {
      const statsA = this.stats.get(a) || { success: 0, fail: 0, avgLatency: 999 }
      const statsB = this.stats.get(b) || { success: 0, fail: 0, avgLatency: 999 }

      const scoreA = (statsA.success / (statsA.success + statsA.fail + 1)) / (statsA.avgLatency + 1)
      const scoreB = (statsB.success / (statsB.success + statsB.fail + 1)) / (statsB.avgLatency + 1)

      return scoreB - scoreA  // 降序
    })

    return available[0]
  }

  recordResult(proxy, success, latency) {
    const stats = this.stats.get(proxy) || { success: 0, fail: 0, avgLatency: 0, count: 0 }

    if (success) {
      stats.success++
    } else {
      stats.fail++
    }

    stats.avgLatency = (stats.avgLatency * stats.count + latency) / (stats.count + 1)
    stats.count++

    this.stats.set(proxy, stats)
  }
}
```

## 完整实现示例

### 统一入口函数
```javascript
async function unifiedVisit(params) {
  const {
    url,
    visitMode,
    targetCountry = 'US',
    refererStrategy = 'social',
    customReferer,
    proxyProviderURL,
    advancedOptions = {}
  } = params

  // 1. 加载模式预设
  const preset = MODE_PRESETS[visitMode]
  const config = { ...preset, ...advancedOptions }

  // 2. 选择代理
  const proxy = await proxyPool.selectBestProxy(targetCountry)

  // 3. 选择Referer
  const referer = selectReferer(refererStrategy, customReferer, targetCountry)

  // 4. 获取浏览器上下文
  const context = await pool.getContext({
    proxy,
    fingerprint: { userAgent: getRandomUserAgent() }
  })
  const page = await context.newPage()

  // 5. 设置资源阻断
  if (config.resourceBlocking?.length > 0) {
    await page.route('**/*', route => {
      const type = route.request().resourceType()
      if (config.resourceBlocking.includes(type) || config.resourceBlocking.includes('*')) {
        route.abort()
      } else {
        route.continue()
      }
    })
  }

  // 6. 设置Referer
  if (referer) {
    await page.setExtraHTTPHeaders({ 'Referer': referer })
  }

  const startTime = Date.now()

  try {
    // 7. 访问页面
    const response = await page.goto(url, {
      timeout: config.timeoutMs,
      waitUntil: config.waitUntil || 'networkidle'
    })

    // 8. 风控检测
    let antiDetectionResult = { passed: true }
    if (config.enableAntiBot) {
      antiDetectionResult = await detectAntiBot(page)
      if (!antiDetectionResult.passed) {
        throw new Error('ANTIBOT_BLOCKED')
      }
    }

    // 9. 提取数据
    const result = await extractDataByMode(page, visitMode, response)

    // 10. 记录成功
    proxyPool.recordResult(proxy, true, Date.now() - startTime)

    return {
      success: true,
      visitMode,
      result: {
        ...result,
        antiDetectionResult,
        timings: { totalMs: Date.now() - startTime },
        metadata: { proxyUsed: !!proxy, referer }
      }
    }

  } catch (error) {
    // 记录失败
    proxyPool.recordResult(proxy, false, Date.now() - startTime)

    return {
      success: false,
      visitMode,
      error: {
        type: classifyError(error),
        message: error.message
      }
    }
  } finally {
    await page.close()
    await pool.release(context)
  }
}
```

## 性能监控指标

### 关键指标
```javascript
const metrics = {
  // 按模式统计
  'visit.evaluate.duration_ms': histogram,
  'visit.click.duration_ms': histogram,
  'visit.resolve.duration_ms': histogram,
  'visit.check.duration_ms': histogram,

  // 成功率
  'visit.success_rate': gauge,
  'visit.antibot_block_rate': gauge,

  // 资源优化
  'visit.bandwidth_saved_kb': counter,
  'visit.requests_blocked': counter,

  // 代理统计
  'proxy.success_rate_by_country': gauge,
  'proxy.avg_latency_by_country': gauge,

  // 快速失败
  'visit.fast_fail_count': counter,
  'visit.retry_count': counter
}
```

## 降级策略

### 分级降级
```javascript
const DEGRADATION_LEVELS = {
  LEVEL_0: {  // 正常
    enableProxy: true,
    enableAntiBot: true,
    enableRetry: true,
    resourceBlocking: ['image', 'font', 'media']
  },
  LEVEL_1: {  // 轻度降级：禁用重试
    enableProxy: true,
    enableAntiBot: true,
    enableRetry: false,
    resourceBlocking: ['image', 'font', 'media', 'stylesheet']
  },
  LEVEL_2: {  // 中度降级：禁用代理
    enableProxy: false,
    enableAntiBot: false,
    enableRetry: false,
    resourceBlocking: ['*']
  },
  LEVEL_3: {  // 重度降级：仅HEAD请求
    method: 'HEAD',
    fallbackToBrowser: false
  }
}

// 根据错误率自动降级
function getCurrentDegradationLevel() {
  const errorRate = getRecentErrorRate()  // 最近5分钟错误率

  if (errorRate > 0.5) return 'LEVEL_3'
  if (errorRate > 0.3) return 'LEVEL_2'
  if (errorRate > 0.15) return 'LEVEL_1'
  return 'LEVEL_0'
}
```

## 部署和配置

### 环境变量
```bash
# 代理配置
PROXY_URL_US=https://proxy-api.com/us
PROXY_URL_GB=https://proxy-api.com/gb
PROXY_URL_CA=https://proxy-api.com/ca

# 浏览器池
MAX_CONTEXT_COUNT=8
CONTEXT_IDLE_TIMEOUT_MS=120000

# 超时配置
TIMEOUT_CHECK_MS=10000
TIMEOUT_RESOLVE_MS=15000
TIMEOUT_EVALUATE_MS=30000
TIMEOUT_CLICK_MS=60000

# 反风控
ENABLE_ANTIBOT_DETECTION=true
ANTIBOT_EARLY_DETECTION_MS=200

# 降级策略
AUTO_DEGRADATION_ENABLED=true
ERROR_RATE_THRESHOLD=0.15
```

### 使用示例

#### Go服务调用
```go
// 场景1: Offer评估
resp, err := browserExecClient.Visit(ctx, &BrowserVisitRequest{
    Url:             offerURL,
    VisitMode:       "evaluate",
    TargetCountry:   "US",
    RefererStrategy: "social",
})

// 场景2: 补点击
resp, err := browserExecClient.Visit(ctx, &BrowserVisitRequest{
    Url:             finalURL,
    VisitMode:       "click",
    TargetCountry:   campaign.TargetCountry,
    RefererStrategy: "social",
})

// 场景3: 换链接
resp, err := browserExecClient.Visit(ctx, &BrowserVisitRequest{
    Url:             offerURL,
    VisitMode:       "resolve",
    TargetCountry:   "US",
    RefererStrategy: "social",
})

// 场景4: 可用性检测
resp, err := browserExecClient.Visit(ctx, &BrowserVisitRequest{
    Url:             offerURL,
    VisitMode:       "check",
    RefererStrategy: "none",
})
```

---

**设计版本**: v2.1
**最后更新**: 2025-01-30
**设计者**: AutoAds Team