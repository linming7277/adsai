# browser-exec 服务 URL 访问能力详细描述

**文档版本**: 1.0
**最后更新**: 2025-10-02
**服务版本**: browser-exec-preview revision 00046+

---

## 📋 目录

1. [核心能力概述](#核心能力概述)
2. [技术架构](#技术架构)
3. [核心功能模块](#核心功能模块)
4. [已验证的访问能力](#已验证的访问能力)
5. [性能指标](#性能指标)
6. [问题诊断流程](#问题诊断流程)
7. [优化建议](#优化建议)
8. [限制和已知问题](#限制和已知问题)

---

## 核心能力概述

browser-exec 是一个基于 Playwright 的智能浏览器自动化服务,专门用于**访问和分析广告联盟 Offer URL**,能够:

1. ✅ **追踪多重跳转**: 自动跟随最多 10+ 跳重定向链
2. ✅ **绕过反爬机制**: 突破 Cloudflare、DDoS-Guard 等企业级防护
3. ✅ **识别中间页**: 智能检测倒计时页、跳转页、失效页
4. ✅ **代理池管理**: 智能代理选择、健康分级、故障转移
5. ✅ **品牌提取**: 从最终落地页提取品牌名称和元数据
6. ✅ **流量优化**: 阻止图片/字体/媒体等非必要资源加载

---

## 技术架构

### 服务栈

```
┌─────────────────────────────────────────────────────────┐
│                    API Layer (Express)                   │
│  - POST /api/v1/browser/visit (主访问接口)               │
│  - GET  /api/v1/browser/patterns/* (Pattern管理)         │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│               Browser Pool (pool.js)                     │
│  - Playwright Chromium 浏览器池                          │
│  - 最大并发: 4 contexts (BROWSER_MAX_CONTEXTS=12)        │
│  - 反自动化检测: 20+ 层指纹伪装                          │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│            Smart Proxy Pool (smart-proxy-pool.js)        │
│  - 代理健康分级: Premium/Standard/Promising/Fallback     │
│  - 全局分配锁: 10秒锁窗口防止代理重复                    │
│  - 自动预热: 启动时预加载 20 个代理                      │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│         Pattern Library (pattern-matcher.js)             │
│  - 13 个域名模式 (中间页/失效页识别)                     │
│  - 8 个文本模式 (通用倒计时/跳转检测)                    │
│  - 4 个 DOM 模式 (元素级检测)                            │
│  - 可配置等待时间: expectedWaitTime                      │
└─────────────────────────────────────────────────────────┘
```

### 核心配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `timeout` | 60000ms | 单次访问总超时(Cloudflare挑战需要~37s) |
| `stabilizeMs` | 12000ms | 页面稳定化等待时间 |
| `concurrency` | 4 | Cloud Run 并发数(避免过载) |
| `min-instances` | 1 | 最小实例数(消除冷启动) |
| `resourceBlock` | `['image','font','media','stylesheet']` | 阻止的资源类型 |
| `enableAntiBot` | true | 启用反自动化检测绕过 |
| `requireProxy` | true | 强制使用代理 |

---

## 核心功能模块

### 1. Pattern Library (模式库系统)

**文件**: `services/browser-exec/patterns/intermediate-pages.json`

**功能**: 识别中间页、失效页、倒计时页

**模式类型**:

#### 1.1 域名模式 (domainPatterns)

```json
{
  "id": "dailybacks-return",
  "domain": "dailybacks.com",
  "type": "intermediate",
  "subtype": "countdown",
  "confidence": 0.9,
  "expectedWaitTime": 15000,
  "urlPattern": "/return.html",
  "notes": "5-second countdown + additional wait"
}
```

**已配置的域名模式** (13个):
- `dailybacks-return`: dailybacks.com/return.html (倒计时页, 等待15秒)
- `dailybacks-error`: dailybacks.com/error_suspended.html (失效页)
- `pboost`: pboost.me (Cloudflare保护, 等待25秒)
- `linkbux`: linkbux.com (倒计时页, 等待6秒)
- `bonusarrive`: bonusarrive.com (Cloudflare保护)
- `fatcoupon`: fatcoupon.com (Cloudflare中间页)
- `adsterra-error`: adsterra.com/error (失效页)
- ... (其他7个)

#### 1.2 文本模式 (textPatterns)

```json
{
  "id": "redirecting-in-seconds",
  "pattern": "redirect(?:ing)?\\s+in\\s+(\\d+)\\s*(?:second|sec)",
  "type": "intermediate",
  "confidence": 0.85
}
```

**已配置的文本模式** (8个):
- 倒计时检测: "redirecting in X seconds"
- 失效检测: "suspended", "banned", "expired"
- 跳转提示: "please wait", "loading"

#### 1.3 DOM 模式 (domPatterns)

检测页面元素:
- 倒计时元素: `[id*="countdown"]`, `[class*="countdown"]`
- 跳转按钮: "Continue", "Click here to proceed"
- 失效提示: "Suspended", "Error 404"

### 2. Cloudflare 企业级绕过

**文件**: `services/browser-exec/index.js:1395-1885`, `pool.js:170-475`

**能力**:
- ✅ JavaScript Challenge 自动求解 (20秒智能等待)
- ✅ Turnstile CAPTCHA 检测
- ✅ 监控 URL 变化和页面内容判断挑战完成
- ✅ 20+ 层反自动化检测伪装

**反检测机制**:

```javascript
// Canvas 指纹噪声注入 (pool.js:399-417)
HTMLCanvasElement.prototype.toDataURL = function() {
  // 添加 1-3 像素随机噪声
}

// WebGL 参数欺骗 (pool.js:422-442)
WebGLRenderingContext.prototype.getParameter = function(param) {
  // 返回常见硬件参数
}

// Chrome Runtime 隐藏 (pool.js:210-235)
delete navigator.webdriver;
Object.defineProperty(navigator, 'plugins', { get: () => fakePlugins });
```

**成功案例**:
- bonusarrive.com: fatcoupon.com (Cloudflare) → linkbux.com → beautyologie.com
- pboost.me: Cloudflare 保护 → yitahome.com

### 3. 智能代理池管理

**文件**: `services/browser-exec/smart-proxy-pool.js`, `index.js:954-1332`

**四级健康分级**:

| 级别 | 条件 | 优先级 |
|------|------|--------|
| **Premium** | 成功率 >90% + 响应 <3s | 1 |
| **Standard** | 成功率 >70% + 响应 <5s | 2 |
| **Promising** | 新代理 + 初始分数 ≥90 | 3 |
| **Fallback** | 其他代理 | 4 |

**全局分配锁** (index.js:954-964):
```javascript
const proxyAllocationLock = new Map() // proxy → timestamp
const LOCK_WINDOW = 10000 // 10秒锁定窗口

// 防止并发请求使用同一代理
if (now - lastAllocation < LOCK_WINDOW) {
  skip this proxy
}
```

**Grace Period** (新代理保护):
- 新代理 (<60秒) 即使分数 ≥50 也允许使用
- 避免过早淘汰优质代理

**自动预热** (index.js:1336-1340):
```javascript
if (process.env.PROXY_URL_US) {
  setTimeout(() => {
    warmupProxyPool(process.env.PROXY_URL_US, 20)
  }, 2000)
}
```

### 4. 自适应倒计时等待

**文件**: `services/browser-exec/index.js:2016-2046`

**支持的倒计时格式**:

```javascript
// Pattern 1: "redirecting in 5 seconds"
/redirect(?:ing)?\s+in\s+(\d+)\s*(?:second|sec|s)/i

// Pattern 2: countdown 元素内的 "5 seconds"
<div id="countdown">5 seconds</div>

// Pattern 3: countdown 元素内的纯数字 "5"
<div class="countdown-timer">5</div>
```

**自适应逻辑**:
```javascript
if (countdownSeconds && countdownSeconds > 0 && countdownSeconds <= 30) {
  waitTime = (countdownSeconds + 1) * 1000 // 倒计时 +1 秒缓冲
  console.log(`[stabilize] Extracted countdown: ${countdownSeconds}s`)
}
```

**优先级**:
1. Pattern Library 的 `expectedWaitTime` (最高优先级)
2. 页面提取的倒计时秒数
3. 全局 `stabilizeMs` 配置

### 5. 多重跳转追踪

**文件**: `services/browser-exec/index.js:1897-2123`

**跳转检测机制**:

```javascript
// 1. 监听 URL 变化
page.on('framenavigated', frame => {
  if (frame === page.mainFrame()) {
    redirectChain.push({ url: frame.url(), timestamp: new Date() })
  }
})

// 2. 检测是否离开联盟网络
const leftAffiliateNetwork =
  initialDomain !== currentDomain &&
  !isAffiliateDomain(currentDomain)

// 3. 等待 JavaScript 跳转
if (leftAffiliateNetwork) {
  await page.waitForTimeout(waitTime) // 使用自适应等待时间
}
```

**已验证的跳转链**:

| Offer | 跳转路径 | 跳转数 |
|-------|---------|--------|
| yeahpromos | yeahpromos.com → dailybacks.com/return.html → error_suspended.html | 3跳 |
| bonusarrive | bonusarrive.com → fatcoupon.com → linkbux.com → beautyologie.com | 4跳 |
| dognet | dognet.com → tradedoubler.com → dyson.hr | 3跳 |
| pboost | pboost.me → yitahome.com | 2跳 |

### 6. 品牌提取

**文件**: `services/browser-exec/index.js:2157-2253`

**提取源优先级**:
1. `<meta property="og:site_name">`
2. `<meta property="og:title">`
3. `<title>` 标签
4. `<h1>` 标签
5. 域名 (fallback)

**清理规则**:
```javascript
// 移除常见后缀
brandName = brandName.replace(/\s*[-–|]\s*(?:Shop|Store|Official|Home).*$/i, '')

// 移除 HTML 实体
brandName = he.decode(brandName)

// 截断过长文本
if (brandName.length > 100) {
  brandName = brandName.substring(0, 100).trim()
}
```

---

## 已验证的访问能力

### ✅ 成功案例 (4/4 = 100%)

#### 1. pboost.me → yitahome.com

**挑战**:
- ❌ 初始问题: timeout 30s 不足以通过 Cloudflare (需要 ~37s)
- ✅ 解决方案: 增加 timeout 到 60s + Pattern Library 配置 25s 等待

**配置**:
```json
{
  "id": "pboost",
  "domain": "pboost.me",
  "type": "affiliate",
  "subtype": "cloudflare-protected",
  "expectedWaitTime": 25000
}
```

**性能**:
- 耗时: ~11s (优化后从 15.3s 降至 11s)
- 成功率: 100%

---

#### 2. dognet.com → dyson.hr

**跳转链**:
```
go.dognet.com → clk.tradedoubler.com → www.dyson.hr
```

**特点**:
- 3 跳重定向
- 简单跳转,无反爬机制
- 稳定性高

**性能**:
- 耗时: ~12-14s
- 成功率: 100%

---

#### 3. yeahpromos.com → dailybacks.com/error_suspended.html

**挑战**:
- ❌ 初始问题: 停留在中间页 `return.html` (等待 6s 不足)
- ✅ 解决方案: Pattern Library 配置 15s 等待 + 修复 Dockerfile 路径

**完整跳转链** (3跳):
```
1. yeahpromos.com/index/index/openurl
   ↓
2. dailybacks.com/return.html?id=error_suspended.html
   ↓ (等待 15 秒倒计时)
3. dailybacks.com/error_suspended.html (最终失效页)
```

**配置**:
```json
{
  "id": "dailybacks-return",
  "domain": "dailybacks.com",
  "type": "intermediate",
  "subtype": "countdown",
  "expectedWaitTime": 15000,
  "urlPattern": "/return.html"
}
```

**性能**:
- 耗时: ~25s (包含 15s 倒计时等待)
- 成功率: 100% (修复后)
- 页面类型: **失效页** (error_suspended.html)

**关键修复**:
```dockerfile
# 修复前: COPY . ./ (从项目根目录复制)
# 修复后: COPY services/browser-exec/ ./
```

---

#### 4. bonusarrive.com → beautyologie.com

**挑战**:
- Cloudflare JavaScript Challenge
- 4 跳重定向链

**跳转链**:
```
1. bonusarrive.com
   ↓
2. fatcoupon.com (Cloudflare Challenge)
   ↓ (等待 20s 自动求解)
3. linkbux.com (倒计时页)
   ↓ (等待 6s)
4. beautyologie.com (最终落地页)
```

**性能**:
- 耗时: ~20-30s
- 成功率: 100%
- Cloudflare 绕过成功率: 100%

**日志证据**:
```
[cloudflare] Cloudflare challenge detected, waiting for auto-solve...
[cloudflare] URL changed from fatcoupon.com to www.linkbux.com
[cloudflare] Challenge passed! Continuing...
[cloudflare] Challenge solved successfully!
```

---

## 性能指标

### 平均性能 (2025-10-02 测试)

| 指标 | 数值 | 备注 |
|------|------|------|
| **成功率** | 100% (4/4) | 所有测试 URL 成功访问 |
| **平均耗时** | ~20s | 范围: 11s - 30s |
| **最快** | 11s | pboost.me (优化后) |
| **最慢** | 30s | bonusarrive.com (含 Cloudflare) |
| **Cloudflare 成功率** | 100% | bonusarrive, pboost 全部通过 |
| **多跳追踪** | 100% | 最多 4 跳全部追踪成功 |

### 拆分架构后性能 (2025-10-02 更新)

**架构变更**: API + Worker 分离部署

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| **并发处理能力** | 40 任务 | 200 任务 | **5x** |
| **吞吐量** | 80 URL/分钟 | 400 URL/分钟 | **5x** |
| **单 URL 平均耗时** | ~29.83s | ~29.83s | 不变 |
| **代理池大小** | 20 | 200 | **10x** |
| **100 URL 批量处理** | 90s | 30s | **3x** |
| **1000 URL 批量处理** | 13.3分钟 | 2.7分钟 | **5x** |

**说明**:
- 单 URL 处理时间不变（受限于 Cloudflare 挑战等固定延迟）
- 吞吐量大幅提升是通过并发处理能力提升实现的
- Worker 实例可扩展至 5-20 个，支持动态调整并发能力

### 流量优化效果

| 资源类型 | 阻止策略 | 节省流量 |
|---------|---------|---------|
| image | ✅ 阻止 | ~40-50% |
| font | ✅ 阻止 | ~5-10% |
| media | ✅ 阻止 | ~10-20% |
| stylesheet | ✅ 阻止 | ~5-10% |
| **总计** | | **60-90%** |

**实测数据**:
- 优化前: 200KB - 1MB (含所有资源)
- 优化后: <300KB (仅 HTML + JavaScript)

---

## 问题诊断流程

### 当遇到新的无法访问的 URL 时

#### Step 1: 初步诊断

**运行测试**:
```bash
node test-browser-exec-http.js
```

**检查返回结果**:
```json
{
  "result": {
    "finalUrl": "...",
    "available": false,
    "isIntermediatePage": { "isIntermediate": true },
    "failureReason": "stuck_at_intermediate_page"
  }
}
```

**常见失败原因**:

| failureReason | 含义 | 可能原因 |
|---------------|------|---------|
| `timeout` | 访问超时 | Cloudflare 挑战时间不足 / 页面加载缓慢 |
| `stuck_at_intermediate_page` | 停留在中间页 | expectedWaitTime 配置不足 |
| `proxy_required` | 缺少代理 | 代理池未配置或耗尽 |
| `all_attempts_failed` | 所有尝试失败 | 代理质量差 / URL 失效 |
| `cloudflare_challenge_failed` | Cloudflare 绕过失败 | 挑战等待时间不足 / 反检测失效 |

---

#### Step 2: 查看详细日志

```bash
# 查看最近 100 条日志
gcloud run services logs read browser-exec-preview \
  --region=asia-northeast1 \
  --limit=100 \
  --project=gen-lang-client-0944935873

# 搜索特定 URL 的日志
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="browser-exec-preview"
   AND textPayload:"example.com"' \
  --limit=50 \
  --project=gen-lang-client-0944935873
```

**关键日志标记**:
- `[cloudflare]`: Cloudflare 检测和绕过过程
- `[stabilize]`: 页面稳定化和跳转检测
- `[intermediate]`: 中间页检测结果
- `[proxy-health]`: 代理健康状态
- `[pattern-match]`: Pattern Library 匹配结果

---

#### Step 3: 分析跳转链

**查看 redirectChain**:
```json
{
  "result": {
    "redirectChain": [
      { "url": "https://example.com/step1", "timestamp": "..." },
      { "url": "https://example.com/step2", "timestamp": "..." },
      { "url": "https://example.com/final", "timestamp": "..." }
    ]
  }
}
```

**问题判断**:
1. **跳转链不完整** (少于预期跳数)
   - 原因: stabilizeMs 或 expectedWaitTime 不足
   - 解决: 增加等待时间

2. **停留在中间页**
   - 原因: Pattern Library 未识别该中间页
   - 解决: 添加新的域名/文本模式

3. **Cloudflare 页面未跳转**
   - 原因: Cloudflare 等待时间不足 (需要 20s+)
   - 解决: 配置 `subtype: "cloudflare-protected"` + `expectedWaitTime: 25000`

---

#### Step 4: 检查 Pattern Library 匹配

**查看匹配日志**:
```
[pattern-match] Domain match: dailybacks.com → dailybacks-return
[pattern-match] Confidence: 0.9
[pattern-match] Expected wait time: 15000ms
```

**未匹配的情况**:
```
[pattern-match] No domain match for: newsite.com
[pattern-match] Using default stabilizeMs: 12000ms
```

**解决方案**: 添加新模式到 `patterns/intermediate-pages.json`

---

#### Step 5: 代理问题诊断

**检查代理池状态**:
```bash
# 查看代理预热日志
gcloud run services logs read browser-exec-preview \
  --region=asia-northeast1 \
  --limit=50 | grep "proxy-warmup"
```

**正常输出**:
```
[proxy-warmup] Starting proxy pool warmup (size: 20)...
[proxy-warmup] Fetched 20 proxies in 10398ms
[proxy-warmup] Initialized health tracking for 20 proxies
[proxy-warmup] Warmup complete (10399ms)
```

**常见问题**:
1. **proxy_required 错误**
   - 检查环境变量: `gcloud run services describe browser-exec-preview | grep PROXY_URL_US`
   - 修复: `gcloud run services update browser-exec-preview --set-env-vars PROXY_URL_US=...`

2. **代理连接失败**
   - 日志: `ERR_PROXY_CONNECTION_FAILED`, `ERR_TUNNEL_CONNECTION_FAILED`
   - 原因: 代理质量差或限额耗尽
   - 解决: 增加 proxyPoolSize 或更换代理服务商

3. **代理被重复使用**
   - 检查全局锁: `proxyAllocationLock` 日志
   - 修复: 确保 LOCK_WINDOW = 10000ms

---

## 优化建议

### 新增 URL 访问优化步骤

#### 1. 添加 Pattern Library 模式

**文件**: `services/browser-exec/patterns/intermediate-pages.json`

**场景 1: 倒计时中间页**
```json
{
  "id": "newsite-countdown",
  "domain": "newsite.com",
  "type": "intermediate",
  "subtype": "countdown",
  "confidence": 0.9,
  "expectedWaitTime": 10000,
  "urlPattern": "/redirect.html",
  "notes": "倒计时页面,等待 10 秒后自动跳转",
  "examples": [
    "newsite.com/redirect.html?next=..."
  ]
}
```

**场景 2: Cloudflare 保护页**
```json
{
  "id": "newsite-cloudflare",
  "domain": "newsite.com",
  "type": "affiliate",
  "subtype": "cloudflare-protected",
  "confidence": 0.95,
  "expectedWaitTime": 25000,
  "notes": "Cloudflare JavaScript Challenge (需要 20s+)"
}
```

**场景 3: 失效页**
```json
{
  "id": "newsite-error",
  "domain": "newsite.com",
  "type": "landing",
  "subtype": "error",
  "confidence": 1.0,
  "urlPattern": "/error.html",
  "textPatterns": ["suspended", "banned"],
  "notes": "Offer 失效页面"
}
```

---

#### 2. 调整全局配置

**场景 1: 超时问题 (timeout)**

**症状**: 日志显示 `net::ERR_TIMED_OUT`, 访问耗时接近 30s

**修复**:
```javascript
// services/browser-exec/index.js:1372
const UNIFIED_VISIT_CONFIG = {
  timeout: 90000,  // 从 60000 增加到 90000 (针对极慢网站)
  // ...
}
```

**场景 2: 稳定化时间不足 (stabilizeMs)**

**症状**: 跳转链不完整,停留在倒数第二跳

**修复**:
```javascript
// services/browser-exec/index.js:1375
const UNIFIED_VISIT_CONFIG = {
  stabilizeMs: 18000,  // 从 12000 增加到 18000
  // ...
}
```

**注意**: 优先使用 Pattern Library 的 `expectedWaitTime` 而非全局 `stabilizeMs`

---

#### 3. 优化代理配置

**场景 1: 代理质量差**

**症状**: 频繁出现 `ERR_PROXY_CONNECTION_FAILED`

**解决方案**:
```javascript
// 增加代理池大小
const WARMUP_POOL_SIZE = 50 // 从 20 增加到 50

// 或调整健康分级阈值
// services/browser-exec/smart-proxy-pool.js
const HEALTH_THRESHOLDS = {
  premium: { successRate: 0.95, avgResponseTime: 2500 }, // 更严格
  standard: { successRate: 0.80, avgResponseTime: 4500 }
}
```

**场景 2: 代理限额耗尽**

**解决方案**:
1. 切换到备用代理服务商
2. 增加代理 Grace Period:
```javascript
// index.js:1043-1048
const GRACE_PERIOD = 120000 // 从 60s 增加到 120s
```

---

#### 4. 增强 Cloudflare 绕过

**场景: Cloudflare 挑战失败**

**症状**: 日志显示 `Cloudflare challenge detected` 但没有 `Challenge solved successfully`

**诊断步骤**:
1. 检查等待时间是否足够 (20s+)
2. 检查 URL 是否真的变化了
3. 检查页面内容是否还包含 Cloudflare 标记

**优化方案 1: 增加等待时间**
```javascript
// index.js:1818
const cfMaxWait = 30000 // 从 20000 增加到 30000
```

**优化方案 2: 增强检测逻辑**
```javascript
// 添加更多 Cloudflare 标记检测
const cloudflareKeywords = [
  'cf-browser-verification',
  'challenge-platform',
  'ddos-guard',
  'checking your browser',
  'ray id' // 新增
]
```

---

#### 5. 添加新的倒计时模式

**场景**: 页面使用新的倒计时格式

**示例**: `"You will be redirected after 8s"`

**修复**:
```javascript
// index.js:2016-2040 增加新的正则模式
const pattern4 = bodyText.match(/redirected after (\d+)s/i)
if (pattern4) {
  return parseInt(pattern4[1], 10)
}
```

**或者添加到 Pattern Library**:
```json
{
  "id": "redirect-after",
  "pattern": "redirected after (\\d+)s",
  "type": "intermediate",
  "confidence": 0.85
}
```

---

#### 6. 部署和验证

**Step 1: 提交代码**
```bash
git add services/browser-exec/
git commit -m "feat(browser-exec): 添加 newsite.com Pattern Library 支持"
git push
```

**Step 2: 等待自动部署**
```bash
gh run list --limit 1
gh run watch <run_id>
```

**Step 3: 验证部署**
```bash
# 检查 revision
gcloud run revisions list --service=browser-exec-preview --region=asia-northeast1 --limit=3

# 检查流量分配
gcloud run services describe browser-exec-preview --region=asia-northeast1 --format=json | jq '.status.traffic'
```

**Step 4: 测试新 URL**
```bash
# 单独测试
node -e "
import('node-fetch').then(async ({ default: fetch }) => {
  const resp = await fetch('https://browser-exec-preview-yt54xvsg5q-an.a.run.app/api/v1/browser/visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://newsite.com/offer?id=123',
      targetCountry: 'US',
      proxyProviderURL: 'https://api.iprocket.io/...',
      proxyPoolSize: 10
    })
  });
  const data = await resp.json();
  console.log('最终URL:', data.result?.finalUrl);
  console.log('可用:', data.result?.available);
  console.log('中间页:', data.result?.isIntermediatePage?.isIntermediate);
});
"
```

**Step 5: 查看日志验证**
```bash
gcloud run services logs read browser-exec-preview --region=asia-northeast1 --limit=50 | grep "newsite"
```

---

## 限制和已知问题

### 技术限制

| 限制 | 描述 | 影响 | 解决方案 |
|------|------|------|---------|
| **CAPTCHA** | 无法自动求解人机验证 | 遇到 reCAPTCHA/hCaptcha 会失败 | 使用 CAPTCHA 求解服务 (未实现) |
| **登录墙** | 无法处理需要登录的页面 | 需要账号的 Offer 无法访问 | 预配置账号凭证 (未实现) |
| **地理围栏** | 部分网站限制特定国家/地区 | 即使用代理也可能被阻止 | 使用该国家的住宅代理 |
| **JavaScript 重度网站** | 极度依赖 JS 的 SPA | 可能无法正确提取品牌信息 | 增加 waitForSelector 等待 |
| **动态倒计时** | 基于 WebSocket/实时更新 | 可能无法准确提取倒计时 | 使用固定等待时间 |

### 已知问题

#### 1. 代理池冷启动延迟

**问题**: 服务首次启动时,前几个请求可能失败 (proxy_required)

**原因**: 代理池预热需要 10-20 秒

**临时解决**:
```javascript
// 等待预热完成后再发送请求
setTimeout(() => {
  // 发送请求
}, 30000)
```

**长期解决**:
```yaml
# Cloud Run 配置
min-instances: 1  # 保持至少 1 个实例常驻
```

---

#### 2. 并发过载 (已修复)

**历史问题**: concurrency: 80 导致 503 崩溃

**修复**:
```yaml
# .github/workflows/deploy-backend.yml:299
--concurrency 4  # 限制为 4
```

**监控**:
```bash
# 查看实例并发数
gcloud run services describe browser-exec-preview --format=json | jq '.spec.template.spec.containerConcurrency'
```

---

#### 3. Dockerfile COPY 路径问题 (已修复)

**历史问题**: `COPY . ./` 从项目根目录复制,导致 Pattern Library 文件丢失

**修复**:
```dockerfile
# services/browser-exec/Dockerfile
COPY services/browser-exec/package.json ./
COPY services/browser-exec/ ./
```

**验证**:
```bash
# 检查镜像内文件
docker run --rm <image> ls -la /srv/patterns/
```

---

#### 4. Pattern Library 配置未生效 (已修复)

**问题**: 修改 `intermediate-pages.json` 后,服务仍使用旧配置

**原因**:
1. 镜像未重新构建
2. revision 未更新
3. 流量仍指向旧 revision

**解决流程**:
```bash
# 1. 检查构建状态
gh run list --limit 1

# 2. 检查镜像标签
gcloud builds list --limit=1 --filter="substitutions._SERVICE=browser-exec"

# 3. 检查当前 revision
gcloud run services describe browser-exec-preview --format=json | jq '.status.latestReadyRevisionName'

# 4. 手动触发部署 (如需要)
gcloud run deploy browser-exec-preview \
  --image=asia-northeast1-docker.pkg.dev/.../browser-exec:preview-<commit> \
  --region=asia-northeast1
```

---

### 性能瓶颈

| 瓶颈 | 影响 | 优化建议 |
|------|------|---------|
| **代理速度** | 平均耗时 15-30s | 使用优质住宅代理 / 增加代理池 |
| **Cloudflare 等待** | 固定增加 20s | 无法避免,已是最优 |
| **浏览器启动** | 冷启动 +5-10s | 使用 min-instances=1 保持实例 |
| **资源阻止** | 节省 60-90% 流量 | ✅ 已优化 |
| **并发限制** | concurrency=4 | 可增加到 8 (需监控内存) |

---

## 测试和验证清单

### 新 URL 访问测试清单

- [ ] **1. 基础访问测试**
  - [ ] 单次访问成功
  - [ ] 返回正确的 finalUrl
  - [ ] 品牌名称提取准确
  - [ ] HTTP 状态码正确 (200/404/etc)

- [ ] **2. 跳转链验证**
  - [ ] redirectChain 完整记录所有跳转
  - [ ] 跳转顺序正确
  - [ ] 时间戳合理

- [ ] **3. 中间页识别**
  - [ ] Pattern Library 正确匹配中间页
  - [ ] isIntermediatePage 标记准确
  - [ ] expectedWaitTime 生效

- [ ] **4. 失效页识别**
  - [ ] 正确识别 error/suspended/banned 页面
  - [ ] available = false
  - [ ] failureReason 准确

- [ ] **5. 性能测试**
  - [ ] 耗时 < 60s (timeout 内)
  - [ ] 代理连接成功
  - [ ] 无内存泄漏

- [ ] **6. 稳定性测试**
  - [ ] 连续 10 次访问成功率 ≥ 80%
  - [ ] 不同代理池成功率一致
  - [ ] 并发 4 个请求无崩溃

- [ ] **7. 日志验证**
  - [ ] 关键步骤有日志记录
  - [ ] 无异常 ERROR 日志
  - [ ] 代理健康状态正常

---

## 附录

### A. 常用命令速查

```bash
# 查看服务状态
gcloud run services describe browser-exec-preview --region=asia-northeast1

# 查看最新日志
gcloud run services logs read browser-exec-preview --region=asia-northeast1 --limit=100

# 查看构建历史
gcloud builds list --limit=10 --filter="substitutions._SERVICE=browser-exec"

# 手动部署
gcloud run deploy browser-exec-preview \
  --image=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/browser-exec:preview-<commit> \
  --region=asia-northeast1 \
  --concurrency=4 \
  --min-instances=1 \
  --memory=2Gi \
  --cpu=2

# 测试访问
curl -X POST https://browser-exec-preview-yt54xvsg5q-an.a.run.app/api/v1/browser/visit \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","targetCountry":"US"}'
```

### B. Pattern Library 模板

**复制此模板添加新 URL**:

```json
{
  "id": "<unique-id>",
  "domain": "<domain.com>",
  "type": "intermediate|landing|affiliate",
  "subtype": "countdown|cloudflare-protected|error|fast-redirect",
  "confidence": 0.9,
  "expectedWaitTime": 15000,
  "urlPattern": "/path/to/page.html",
  "textPatterns": ["keyword1", "keyword2"],
  "notes": "描述这个模式的作用和特点",
  "examples": [
    "domain.com/example1",
    "domain.com/example2"
  ]
}
```

### C. 相关文档

- **架构文档**: `docs/MarkerkitGo/MustKnowV4.md`
- **优化报告**: `docs/MarkerkitGo/BrowserExec_Final_Optimization_Report.md`
- **Pattern Library 实现**: `docs/MarkerkitGo/Pattern_Library_Implementation_Report.md`
- **代码匹配性评估**: `docs/MarkerkitGo/Code_Implementation_vs_Documentation_Review.md`
- **Cloudflare 绕过**: `docs/MarkerkitGo/BrowserExec_Bonusarrive_Cloudflare_Bypass.md`

---

**维护者**: DevOps Team
**联系**: support@example.com
**最后审核**: 2025-10-02
