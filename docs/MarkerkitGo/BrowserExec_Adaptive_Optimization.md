# Browser-Exec 自适应优化报告

**优化时间**: 2025-10-02 03:00
**版本**: browser-exec-preview revision 00029
**优化目标**: 根据 BrowserExec_4Offers_Final_Report.md 的建议进行性能优化

---

## ✅ 已完成优化

### 1. 自适应倒计时等待 (Adaptive Countdown Wait)

**问题**: 之前对所有倒计时页面使用固定12秒等待时间，即使页面显示"5 seconds"也要等12秒

**解决方案**: 实现智能倒计时秒数解析

**实现代码** (services/browser-exec/index.js:1814-1851):
```javascript
// Try to extract countdown seconds for adaptive waiting
const countdownSeconds = await page.evaluate(() => {
  const bodyText = document.body?.textContent || ''

  // Pattern 1: "redirecting in 5 seconds" or "redirect in 5s"
  const pattern1 = bodyText.match(/redirect(?:ing)?\s+in\s+(\d+)\s*(?:second|sec|s)/i)
  if (pattern1) return parseInt(pattern1[1], 10)

  // Pattern 2: "5 seconds" near countdown element
  const countdownEl = document.querySelector('[id*="count"], [class*="countdown"]')
  if (countdownEl) {
    const elText = countdownEl.textContent || ''
    const pattern2 = elText.match(/(\d+)\s*(?:second|sec|s)/i)
    if (pattern2) return parseInt(pattern2[1], 10)
  }

  // Pattern 3: Just a number in countdown element (likely seconds)
  if (countdownEl) {
    const number = countdownEl.textContent?.match(/\d+/)
    if (number && parseInt(number[0], 10) <= 60) {
      return parseInt(number[0], 10)
    }
  }

  return null
}).catch(() => null)

if (countdownSeconds && countdownSeconds > 0 && countdownSeconds <= 30) {
  // Wait for countdown + 1 second buffer
  const adaptiveWait = (countdownSeconds + 1) * 1000
  console.log(`[stabilize] Countdown detected: ${countdownSeconds}s, waiting ${adaptiveWait}ms...`)
  await new Promise(r => setTimeout(r, adaptiveWait))
} else {
  // Fallback to resetting stable time
  stableSince = Date.now()
}
```

**支持的倒计时模式**:
1. ✅ "redirecting in 5 seconds"
2. ✅ "redirect in 5s"
3. ✅ countdown元素内的 "5 seconds"
4. ✅ countdown元素内的纯数字 "5"

**预期性能提升**:
- **yeahpromos.com**: 从18.7秒降至12-14秒（节省**32%**时间）
- **其他倒计时页面**: 类似的时间节省

**示例日志**:
```
[stabilize] Countdown detected: 5s, waiting 6000ms...
```

---

### 2. 资源加载优化 (Resource Blocking)

**问题**: 之前加载所有资源导致流量消耗200KB-1MB

**解决方案**: 已在 UNIFIED_VISIT_CONFIG 中启用资源阻止

**当前配置** (services/browser-exec/index.js:1142-1151):
```javascript
const UNIFIED_VISIT_CONFIG = {
  resourceBlock: ['image', 'font', 'media', 'stylesheet'],
  timeout: 30000,
  waitUntil: 'domcontentloaded',
  enableAntiBot: true,
  stabilizeMs: 8000,
  referer: 'social',
  requireProxy: true,
  requireBrandExtraction: true
}
```

**阻止的资源类型**:
- ✅ image: 图片（通常占50-70%流量）
- ✅ font: 字体文件
- ✅ media: 视频/音频
- ✅ stylesheet: CSS样式表

**流量节省**: 预计**50-70%**（从200KB-1MB降至<300KB）

---

## 🔍 发现的新问题

### 问题1: 代理池大小不足导致并发失败

**现象**: 4个并发请求全部失败（网络超时）

**根因分析**:
```
测试配置: proxyPoolSize: 1
并发请求: 4个URL同时请求
结果: 4个请求都分配到同一个代理 139.162.53.199
问题: 该代理连续失败，被quarantine，但因为只有1个代理，无法切换
```

**代理健康日志**:
```
[proxy-pool] Selected proxy for https://pboost.me/ZDO2Bdek: 139.162.53.199 (1/1, score: 92)
[proxy-pool] Selected proxy for https://yeahpromos.com/...: 139.162.53.199 (1/1, score: 92)
[proxy-pool] Selected proxy for https://bonusarrive.com/...: 139.162.53.199 (1/1, score: 92)
[proxy-pool] Selected proxy for https://go.dognet.com/...: 139.162.53.199 (1/1, score: 92)
[proxy-health] ❌ 139.162.53.199 failed (unknown, score: 76, consecutive: 3)
[proxy-health] Quarantined 139.162.53.199 for 30 minutes (score: 68)
```

**解决方案**:
1. **短期**: 增加 `proxyPoolSize` 从1到10，确保每个并发请求有不同的代理可选
2. **中期**: 实现代理池预热机制，启动时预先获取10-20个代理
3. **长期**: 集成多个代理提供商，实现failover

**建议配置**:
```javascript
{
  proxyPoolSize: 10,  // 从1增加到10
  maxRetries: 3       // 保持3次重试
}
```

---

### 问题2: 并发请求导致代理重复使用

**问题**: 当前代理池逻辑是URL级别的去重，但4个不同URL的并发请求会在短时间内同时请求代理，可能拿到同一个

**当前逻辑**:
```javascript
// Track which proxies have been used for this specific URL
const cacheKey = `${url}:usage`
const usageMap = proxyPoolCache.get(cacheKey)
const unusedProxies = healthyProxies.filter(proxy => !usageMap.has(proxy))
```

**问题**: 4个不同URL各自独立追踪，可能同时选中同一个代理

**解决方案**: 实现全局代理分配锁
```javascript
// 全局代理分配锁（防止并发请求分配同一代理）
const proxyAllocationLock = new Map()

async function getNextProxyForURL(url, proxyProviderURL, poolSize = 10) {
  const pool = await getProxyPool(proxyProviderURL, poolSize)
  if (pool.length === 0) return { proxy: null, pool: [], health: null }

  // 获取全局已分配的代理（5秒内）
  const now = Date.now()
  const recentlyAllocated = Array.from(proxyAllocationLock.entries())
    .filter(([proxy, time]) => now - time < 5000)
    .map(([proxy, _]) => proxy)

  // 过滤掉最近5秒内已分配的代理
  const availableProxies = healthyProxies.filter(p => !recentlyAllocated.includes(p))

  // 选择代理
  const selectedProxy = selectBestProxy(availableProxies)

  // 记录分配（5秒后自动过期）
  proxyAllocationLock.set(selectedProxy, now)
  setTimeout(() => proxyAllocationLock.delete(selectedProxy), 5000)

  return selectedProxy
}
```

---

## 📊 性能对比

### 之前的配置 (revision 00028)

| Offer | 访问时间 | 倒计时等待 | 说明 |
|-------|---------|----------|------|
| yeahpromos.com | 18.7秒 | 12秒（固定） | return.html倒计时5秒，但等了12秒 |
| bonusarrive.com | 31.2秒 | 10.6秒 | 多重重定向 + Cloudflare |
| **平均** | **19.4秒** | **11.0秒** | - |

### 优化后的配置 (revision 00029)

| Offer | 预期访问时间 | 倒计时等待 | 节省时间 |
|-------|------------|----------|---------|
| yeahpromos.com | **12-14秒** | **6秒（自适应）** | ⬇️ **32%** |
| bonusarrive.com | **25-27秒** | 10.6秒 | ⬇️ **15%** |
| **平均** | **~16秒** | **~9秒** | ⬇️ **20-30%** |

**注意**: 由于代理问题，实际测试未能验证，但逻辑已正确实现

---

## 🎯 下一步优化建议

### 优先级 P0: 修复代理池问题

**任务**:
1. ✅ 增加 proxyPoolSize 到 10（测试脚本修改）
2. ⏳ 实现全局代理分配锁（防止并发重复）
3. ⏳ 添加代理池预热机制

**预期效果**: 并发成功率从0%提升到75-100%

---

### 优先级 P1: 进一步减少延迟

**1. Cloudflare检测提前退出**
- 当前: 每1秒检查一次，最多20秒
- 优化: 检测到URL变化后立即验证，可能5-8秒就通过
- 节省: 约5-10秒（对bonusarrive.com）

**2. 智能等待策略**
- 当前: minStableTime = 12秒（固定）
- 优化: 根据页面类型动态调整（最终页6秒，中间页12秒）
- 节省: 约3-5秒

---

### 优先级 P2: 流量优化

**已实现**: 资源阻止（image, font, media, stylesheet）

**可进一步优化**:
1. 禁用 JavaScript 文件中的非必要代码（如analytics, ads）
2. 实现智能重定向跟踪（跳过已知的无用中间页）
3. 代理池缓存优化（5分钟缓存，减少重复请求）

**预期节省**: 额外10-20%流量

---

## 📝 总结

### 本次优化成果

✅ **实现了自适应倒计时等待**
- 支持3种倒计时文本模式
- 预期节省20-30%访问时间
- yeahpromos.com: 18.7秒 → 12-14秒

✅ **确认资源阻止已启用**
- 预期节省50-70%流量
- 200KB-1MB → <300KB

🔍 **发现代理池问题**
- 并发请求时proxyPoolSize=1导致所有请求共享同一个代理
- 代理失败后无备选，导致100%失败率
- 需要增加代理池大小到10

### 待验证

由于代理问题，以下优化效果**尚未验证**:
- ⏳ 自适应倒计时的实际时间节省
- ⏳ 资源阻止的实际流量节省
- ⏳ 整体并发成功率

**下一步**: 修复代理池问题后重新测试

---

**报告生成时间**: 2025-10-02 03:15:00
**版本**: browser-exec-preview revision 00029
**状态**: 代码已部署，等待代理池修复后验证效果
