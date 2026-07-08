import express from 'express'
import { pool, setLimits, getLimits } from './pool.js'
import client from 'prom-client'
import { TaskQueue } from './queue.js'
import { patternMatcher } from './pattern-matcher.js'
import { getProxyClient } from './proxy-client.js'
import { queueManager } from './queue-manager.js'
import { dbClient } from './db-client.js'

// Initialize centralized proxy pool client
const proxyPoolURL = process.env.PROXY_POOL_URL || 'http://proxy-pool-preview'
const proxyClient = getProxyClient(proxyPoolURL)
console.log(`[browser-exec] Using centralized proxy pool: ${proxyPoolURL}`)

// Initialize database client
await dbClient.init()

const app = express()
app.use(express.json({ limit: '1mb' }))

app.get('/healthz', (req, res) => res.sendStatus(200))
app.get('/health', (req, res) => res.sendStatus(200))
app.get('/readyz', (req, res) => res.sendStatus(200))
// Prometheus metrics
const registry = new client.Registry()
client.collectDefaultMetrics({ register: registry })
const chkCounter = new client.Counter({ name: 'be_checks_total', help: 'check-availability total', registers: [registry] })
const clickCounter = new client.Counter({ name: 'be_clicks_total', help: 'simulate-click total', registers: [registry] })
const failCounter = new client.Counter({ name: 'be_failures_total', help: 'total failures', registers: [registry] })
const runningGauge = new client.Gauge({ name: 'be_running_tasks', help: 'running tasks', registers: [registry] })
const durHist = new client.Histogram({ name: 'be_task_duration_ms', help: 'task duration ms', registers: [registry], buckets: [50,100,200,500,1000,2000,5000,10000,15000] })
const ctxGauge = new client.Gauge({ name: 'be_pool_shared_contexts', help: 'shared contexts in use (sum)', registers: [registry] })
const poolsGauge = new client.Gauge({ name: 'be_active_pools', help: 'active browser pools', registers: [registry] })
const rssGauge = new client.Gauge({ name: 'be_memory_rss_mb', help: 'process RSS in MB', registers: [registry] })
const capExhausted = new client.Counter({ name: 'be_capacity_exhausted_total', help: 'capacity exhausted events', registers: [registry] })
const resolveCounter = new client.Counter({ name: 'be_resolve_total', help: 'resolve-offer total', registers: [registry] })
const qLenGauge = new client.Gauge({ name: 'be_queue_length', help: 'queue length', registers: [registry] })
const qProcCounter = new client.Counter({ name: 'be_queue_processed_total', help: 'queue processed', registers: [registry] })
const proxTotal = new client.Gauge({ name: 'be_proxies_total', help: 'proxies total by country', labelNames: ['country'], registers: [registry] })
const proxBad = new client.Gauge({ name: 'be_proxies_bad', help: 'proxies quarantined by country', labelNames: ['country'], registers: [registry] })
app.get('/metrics', async (req, res) => { res.set('Content-Type', registry.contentType); res.end(await registry.metrics()) })

setInterval(() => {
  try {
    const s = pool.stats()
    // Calculate total shared contexts across all pools
    let totalSharedContexts = 0
    for (const poolDetail of Object.values(s.poolDetails)) {
      totalSharedContexts += poolDetail.sharedContexts
    }
    ctxGauge.set(totalSharedContexts)
    poolsGauge.set(s.pools)
    rssGauge.set(process.memoryUsage().rss / (1024 * 1024))
  } catch (err) {
    // ignore metric sampling issues in preview environment
  }
}, 2000)

// --- Task Queue (optional Redis / memory fallback) ---
const queue = new TaskQueue(process.env.REDIS_URL)
// wire queue stats
setInterval(async () => {
  try {
    const st = await queue.stats()
    qLenGauge.set((st && st.queueLength) || 0)
    qProcCounter.inc(0)
  } catch (err) {
    // queue backend unavailable; skip metrics update
  }
}, 2000)
// proxy pool stats refresh
setInterval(async () => {
  try {
    const stats = await proxyClient.getStats()
    if (stats && typeof stats.available === 'number') {
      proxTotal.labels('pool').set(stats.available)
    }
    const bad = stats && (stats.bad ?? stats.quarantined)
    if (typeof bad === 'number') {
      proxBad.labels('pool').set(bad)
    }
    const breakdown = stats && (stats.countries || stats.byCountry)
    if (breakdown && typeof breakdown === 'object') {
      Object.entries(breakdown).forEach(([country, payload]) => {
        const available = typeof payload === 'number' ? payload : payload?.available
        if (typeof available === 'number') {
          proxTotal.labels(country || 'pool').set(available)
        }
        const badCount = typeof payload?.bad === 'number' ? payload.bad : undefined
        if (typeof badCount === 'number') {
          proxBad.labels(country || 'pool').set(badCount)
        }
      })
    }
  } catch (err) {
    // proxy pool unreachable; skip metrics update
  }
}, 5000)

// SSE: queue stats stream (best-effort)
const sseClients = new Set()
app.get('/api/v1/browser/queue/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  const client = { res }
  sseClients.add(client)
  req.on('close', () => { sseClients.delete(client) })
})
setInterval(async () => {
  if (sseClients.size === 0) return
  try {
    const st = await queue.stats()
    const data = `event: stats\ndata: ${JSON.stringify(st)}\n\n`
    for (const c of sseClients) { try { c.res.write(data) } catch {} }
  } catch {}
}, 2000)

let MAX_CONCURRENCY = Number(process.env.BROWSER_MAX_CONCURRENCY || 4)
queue.registerHandlers({
  // Minimal tasks mapping to existing capabilities
  async check(payload) { const { url, timeoutMs, method, retries, backoffMs, proxyProviderURL } = payload || {}; return await checkAvailabilityInternal({ url, timeoutMs, method, retries, backoffMs, proxyProviderURL }) },
  async resolve(payload) { return await resolveOfferInternal(payload || {}) },
  async click(payload) { const { url, fingerprint, proxy } = payload || {}; const r = await simulateClick(url, { fingerprint, proxy, ...(payload||{}) }); return r },
})
queue.start(MAX_CONCURRENCY)

// KISS: no real browser yet; this is a skeleton with minimal behaviors
app.post('/api/v1/browser/parse-url', (req, res) => {
  const { url } = req.body || {}
  try {
    const u = new URL(url)
    const host = u.hostname
    const parts = host.split('.')
    const brand = parts.length >= 2 ? parts[parts.length - 2] : host
    res.json({ ok: true, hostname: host, brand })
  } catch {
    res.status(400).json({ error: { code: 'INVALID_URL', message: 'Invalid URL' } })
  }
})

// --- Ops config & guards ---
let running = 0
let MAINTENANCE = false
function withSlot(fn) {
  return async (req, res) => {
    if (MAINTENANCE) {
      res.set('Retry-After', '60')
      return res.status(503).json({ error: { code: 'MAINTENANCE', message: 'Service in maintenance mode' } })
    }
    if (running >= MAX_CONCURRENCY) {
      res.set('Retry-After', '1')
      return res.status(503).json({ error: { code: 'OVERLOADED', message: 'Too many concurrent tasks' } })
    }
    running++
    runningGauge.set(running)
    try { await fn(req, res) } finally { running--; runningGauge.set(running) }
  }
}

// Enable stealth if using Playwright
const USE_PW = String(process.env.PLAYWRIGHT || '').toLowerCase() === '1'

// buildContextOptions moved to pool.js

async function gotoWithFingerprint(url, opts = {}) {
  const { timeoutMs = 8000, proxy, fingerprint } = opts
  const h = await pool.getContext({ fingerprint, proxy })
  const page = await h.context.newPage()
  let status = 0
  try {
    const resp = await page.goto(url, { timeout: Math.min(15000, Math.max(2000, timeoutMs)), waitUntil: 'domcontentloaded' })
    status = resp?.status() || 0
    return { ok: status >= 200 && status < 400, status }
  } finally { try { await page.close() } catch {}; await pool.release(h) }
}

// Internal auth (optional)
const INTERNAL_TOKEN = (process.env.BROWSER_INTERNAL_TOKEN || '').trim()
function enforceInternal(req, res, next) {
  if (!INTERNAL_TOKEN) return next()
  const hdr = (req.headers['x-service-token'] || req.headers['authorization'] || '').toString()
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : hdr
  if (token === INTERNAL_TOKEN) return next()
  return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'internal token required' } })
}
app.use('/api/v1/browser', enforceInternal)

// --- Ops & maintenance endpoints ---
// GET current config and runtime stats
app.get('/api/v1/browser/config', (req, res) => {
  try {
    return res.json({
      concurrency: MAX_CONCURRENCY,
      limits: getLimits(),
      maintenance: MAINTENANCE,
      stats: pool.stats(),
      queue: { backend: queue.isRedis ? 'redis' : 'memory' }
    })
  } catch (e) { return res.status(500).json({ error: { code: 'CONFIG_READ_FAILED', message: String(e?.message || e) } }) }
})
// PUT to update in-memory config: { concurrency?, maxContexts?, maxMemoryMb? }
app.put('/api/v1/browser/config', (req, res) => {
  try {
    const { concurrency, maxContexts, maxMemoryMb } = req.body || {}
    if (Number.isFinite(concurrency) && concurrency > 0) {
      MAX_CONCURRENCY = Math.min(256, Math.max(1, concurrency|0))
    }
    setLimits({ maxContexts, maxMemoryMb })
    queue.setConcurrency(MAX_CONCURRENCY).catch(()=>{})
    return res.json({ ok: true, concurrency: MAX_CONCURRENCY, limits: getLimits() })
  } catch (e) { return res.status(400).json({ error: { code: 'CONFIG_UPDATE_FAILED', message: String(e?.message || e) } }) }
})
// Proxy registry endpoints (minimal)
// Proxy pool stats (delegated to centralized proxy-pool service)
app.get('/api/v1/browser/proxy-pool/stats', async (req, res) => {
  try {
    const stats = await proxyClient.getStats()
    return res.json(stats || { error: 'Service unavailable' })
  } catch (e) {
    return res.status(500).json({ error: { code: 'PROXY_STATS_FAILED', message: String(e?.message || e) } })
  }
})

app.get('/api/v1/browser/proxy-pool/health', async (req, res) => {
  try {
    const healthy = await proxyClient.healthCheck()
    return res.json({ healthy, timestamp: new Date().toISOString() })
  } catch (e) {
    return res.status(500).json({ healthy: false, error: String(e?.message || e) })
  }
})
// Maintenance toggle
app.get('/api/v1/browser/maintenance', (req, res) => res.json({ maintenance: MAINTENANCE }))
app.post('/api/v1/browser/maintenance', (req, res) => {
  const enabled = !!(req.body && (req.body.enabled === true || String(req.body.enabled).toLowerCase() === 'true'))
  MAINTENANCE = enabled
  return res.json({ ok: true, maintenance: MAINTENANCE })
})
// Capacity view (static computation based on current limits)
app.get('/api/v1/browser/capacity', (req, res) => {
  try {
    const st = pool.stats()
    const perCtxPerMin = 10 // heuristic: each context ~10 tasks/min for lightweight ops
    const estPerMin = st.maxContexts * perCtxPerMin
    return res.json({ maxContexts: st.maxContexts, maxMemoryMb: st.maxMemoryMb, maxPools: st.maxPools, running, estTasksPerMinute: estPerMin, pools: st.pools })
  } catch (e) { return res.status(500).json({ error: { code: 'CAPACITY_FAILED', message: String(e?.message || e) } }) }
})

// Pools inspection & recycle
app.get('/api/v1/browser/pools', (req, res) => {
  try { return res.json(pool.stats().poolDetails || {}) } catch (e) { return res.status(500).json({ error: { code: 'POOLS_FAILED', message: String(e?.message || e) } }) }
})

// Detailed pool statistics including context pools
app.get('/api/v1/browser/stats', (req, res) => {
  try { return res.json(pool.stats()) } catch (e) { return res.status(500).json({ error: { code: 'STATS_FAILED', message: String(e?.message || e) } }) }
})
app.post('/api/v1/browser/pools/recycle', async (req, res) => {
  try { await pool.recycleIdle(); return res.json({ ok: true }) } catch (e) { return res.status(500).json({ error: { code: 'RECYCLE_FAILED', message: String(e?.message || e) } }) }
})

// Resolve an affiliate Offer URL to final landing page; return final URL, suffix, domain, brand
app.post('/api/v1/browser/resolve-offer', withSlot(async (req, res) => {
  const out = await resolveOfferInternal(req.body || {})
  if (out && out.error) return res.status(out.status||502).json({ error: out.error })
  return res.json(out)
}))

// Dedicated endpoint for Offer evaluation with resource optimization
app.post('/api/v1/browser/evaluate-offer', withSlot(async (req, res) => {
  const out = await evaluateOfferInternal(req.body || {})
  if (out && out.error) return res.status(out.status||502).json({ error: out.error })
  return res.json(out)
}))

// Unified visit endpoint - uses single optimized configuration
// No visitMode parameter required - all requests use the same optimal config
app.post('/api/v1/browser/visit', withSlot(async (req, res) => {
  const out = await unifiedVisitInternal(req.body || {})
  if (!out.success && out.error) {
    const statusCode = out.error.type === 'capacity' ? 503 : out.error.type === 'invalid_url' ? 400 : 502
    return res.status(statusCode).json(out)
  }
  return res.json(out)
}))

// 新增: 队列化访问API（避免速率限制）
app.post('/api/v1/browser/visit-queue', async (req, res) => {
  const result = await queueManager.publishVisitRequest(req.body)

  if (result.success) {
    return res.json({
      success: true,
      messageId: result.messageId,
      status: 'queued',
      message: 'Request queued successfully. Processing will begin shortly.'
    })
  } else {
    return res.status(500).json({
      success: false,
      error: result.error
    })
  }
})

// 获取队列统计
app.get('/api/v1/browser/queue/stats', (req, res) => {
  const stats = queueManager.getStats()
  return res.json({ success: true, stats })
})

app.post('/api/v1/browser/check-availability', withSlot(async (req, res) => {
  const { url, timeoutMs = 5000, method = 'HEAD', retries = 0, backoffMs = 150, proxyProviderURL } = req.body || {}
  if (!url) return res.status(400).json({ error: { code: 'INVALID_ARGUMENT', message: 'url required' } })
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), Math.min(15000, Math.max(1000, timeoutMs)))
  try {
    chkCounter.inc()
    const t0 = Date.now()
    const attempt = async () => {
      if (USE_PW) {
        // allow proxy provider
        let proxy = (req.body && req.body.proxy) || undefined
        if (!proxy && proxyProviderURL) {
          try {
            const txt = await (await fetch(String(proxyProviderURL))).text()
            const lines = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
            if (lines.length) proxy = toPlaywrightProxy(lines[(Math.random()*lines.length)|0])
          } catch {}
        }
        const fp = (req.body && req.body.fingerprint) || {}
        return await gotoWithFingerprint(url, { timeoutMs, proxy, fingerprint: fp })
      }
      const r = await fetch(url, { method, redirect: 'follow', signal: ctrl.signal })
      return { ok: r.ok, status: r.status, engine: 'fetch' }
    }
    let out = null, lastErr = null
    const n = Math.max(0, Math.min(3, Number(retries)))
    const backoff = Math.max(50, Math.min(1000, Number(backoffMs)))
    for (let i = 0; i <= n; i++) {
      try { out = await attempt(); break } catch (e) { lastErr = e }
      await new Promise(r => setTimeout(r, backoff * (i + 1)))
    }
    durHist.observe(Date.now() - t0)
    clearTimeout(t)
    if (!out) return res.json({ ok: false, status: 0, error: String(lastErr?.message || lastErr) })
    res.json({ ...out, engine: out.engine || (USE_PW ? 'playwright' : 'fetch') })
  } catch (e) {
    failCounter.inc()
    clearTimeout(t)
    res.json({ ok: false, status: 0, error: String(e?.message || e) })
  }
}))

app.post('/api/v1/browser/simulate-click', (req, res) => {
  const { url, fingerprint, proxy } = req.body || {}
  if (!url) return res.status(400).json({ error: { code: 'INVALID_ARGUMENT', message: 'url required' } })
  const taskId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`
  tasks.set(taskId, { status: 'queued' })
  ;(async () => {
    tasks.set(taskId, { status: 'running' })
    try {
      const t0 = Date.now()
      const result = await simulateClick(url, { fingerprint, proxy, ...req.body })
      durHist.observe(Date.now() - t0)
      clickCounter.inc()
      tasks.set(taskId, { status: 'completed', result })
    } catch (e) {
      failCounter.inc()
      tasks.set(taskId, { status: 'failed', error: String(e?.message || e) })
    }
  })()
  res.status(202).json({ taskId, status: 'queued' })
})

app.post('/api/v1/browser/batch-execute', async (req, res) => {
  const { tasks: items = [] } = req.body || {}
  const groupId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`
  const ids = []
  for (const it of items) { ids.push(await queue.enqueue('click', { url: it.url, fingerprint: it.fingerprint, proxy: it.proxy })) }
  res.status(202).json({ accepted: items.length, taskGroupId: groupId, taskIds: ids })
})

// Tasks status endpoint (minimal)
app.get('/api/v1/browser/tasks/:id', async (req, res) => {
  const st = await queue.getTask(req.params.id)
  if (!st) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'task not found' } })
  res.json(st)
})
app.post('/api/v1/browser/tasks', async (req, res) => {
  const { type, payload } = req.body || {}
  if (!type) return res.status(400).json({ error: { code: 'INVALID_ARGUMENT', message: 'type required' } })
  const id = await queue.enqueue(type, payload || {})
  res.status(202).json({ taskId: id, status: 'queued' })
})
app.get('/api/v1/browser/queue/stats', async (req, res) => {
  const s = await queue.stats(); res.json(s)
})

// JSON fetch via browser with optional proxy provider
app.post('/api/v1/browser/json-fetch', withSlot(async (req, res) => {
  if (!USE_PW) return res.status(400).json({ error: { code: 'PLAYWRIGHT_DISABLED', message: 'playwright disabled' } })
  const {
    url,
    headers = {},
    userAgent,
    waitUntil = 'domcontentloaded', // 'domcontentloaded' | 'load' | 'networkidle'
    timeoutMs = 20000,              // clamp 1s..30s
    proxyProviderURL,
    retries = 1,
    backoffMs = 200
  } = req.body || {}
  if (!url) return res.status(400).json({ error: { code: 'INVALID_ARGUMENT', message: 'url required' } })
  const wUntil = ['domcontentloaded','load','networkidle'].includes(String(waitUntil)) ? String(waitUntil) : 'domcontentloaded'
  const navTimeout = Math.min(30000, Math.max(1000, Number(timeoutMs)))

  async function pickWorkingProxy(targetUrl) {
    try {
      // Get proxy from centralized pool
      const proxyString = await proxyClient.getProxy(targetUrl)
      if (proxyString) {
        const playwrightProxy = toPlaywrightProxy(proxyString)
        if (playwrightProxy) {
          playwrightProxy._rawProxy = proxyString // Store raw proxy for later release
          return playwrightProxy
        }
      }
    } catch (err) {
      console.error('[check-availability] Error getting proxy:', err.message)
    }
    return undefined
  }

  const attempt = async () => {
    let proxyOpt = undefined
    const startTime = Date.now()
    try {
      // Get proxy from centralized pool
      proxyOpt = await pickWorkingProxy(url)
    } catch (e) {
      console.error('[check-availability] Proxy allocation error:', e.message)
    }
    let h
    try {
      // pass userAgent via fingerprint; allow SIMILARWEB_USER_AGENT fallback
      const fp = { userAgent: userAgent || process.env.SIMILARWEB_USER_AGENT || undefined }
      h = await pool.getContext({ proxy: proxyOpt, fingerprint: fp })
    } catch (e) {
      if (String(e).startsWith('capacity_exhausted')) capExhausted.inc()
      throw new Error(String(e?.message || e))
    }
    const page = await h.context.newPage()
    try {
      // apply extra headers if provided
      const hdrs = headers && typeof headers === 'object' ? headers : {}
      const keys = Object.keys(hdrs)
      if (keys.length) { try { await page.setExtraHTTPHeaders(hdrs) } catch {} }
      const resp = await page.goto(url, { timeout: navTimeout, waitUntil: wUntil })
      const status = resp?.status() || 0
      let bodyText = ''
      try { bodyText = await page.evaluate(() => document.body && document.body.innerText || '') } catch {}
      let parsed = null
      try { parsed = JSON.parse(bodyText) } catch {}
      // Release proxy back to pool
      const ok = status >= 200 && status < 400
      const responseTime = Date.now() - startTime
      if (proxyOpt && proxyOpt._rawProxy) {
        try {
          await proxyClient.releaseProxy(proxyOpt._rawProxy, ok, responseTime)
        } catch (err) {
          console.error('[check-availability] Error releasing proxy:', err.message)
        }
      }
      return { status, json: parsed, text: parsed ? undefined : bodyText, via: proxyOpt ? 'proxy' : 'direct' }
    } finally { try { await page.close() } catch {}; await pool.release(h) }
  }
  try {
    let lastErr = null
    const n = Math.max(0, Math.min(3, Number(retries)))
    const backoff = Math.max(50, Math.min(2000, Number(backoffMs)))
    for (let i = 0; i <= n; i++) {
      try { const out = await attempt(); return res.json(out) } catch (e) { lastErr = e }
      await new Promise(r => setTimeout(r, backoff * (i + 1)))
    }
    return res.status(502).json({ error: { code: 'BROWSER_FETCH_FAILED', message: String(lastErr?.message || lastErr) } })
  } catch (e) {
    return res.status(502).json({ error: { code: 'BROWSER_FETCH_FAILED', message: String(e?.message || e) } })
  }
}))

// SimilarWeb data fetcher - specialized endpoint for SimilarWeb API
app.post('/api/v1/browser/similarweb', withSlot(async (req, res) => {
  if (!USE_PW) return res.status(400).json({ error: { code: 'PLAYWRIGHT_DISABLED', message: 'playwright disabled' } })
  const {
    domain,
    timeoutMs = 20000,
    retries = 2,
    backoffMs = 500
  } = req.body || {}

  if (!domain) return res.status(400).json({ error: { code: 'INVALID_ARGUMENT', message: 'domain required' } })

  // Normalize domain: remove protocol and www
  const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  const apiUrl = `https://data.similarweb.com/api/v1/data?domain=${encodeURIComponent(normalizedDomain)}`

  const navTimeout = Math.min(30000, Math.max(5000, Number(timeoutMs)))

  // Helper: Parse SimilarWeb HTML response (fallback)
  function parseSimilarWebHTML(html) {
    const data = {}
    try {
      // Extract global rank from HTML patterns
      const globalRankMatch = html.match(/Global\s+Rank[:\s]+#?([\d,]+)/i) ||
                             html.match(/globalRank["\s:]+(\d+)/i)
      if (globalRankMatch) {
        data.global_rank = parseInt(globalRankMatch[1].replace(/,/g, ''), 10)
      }

      // Extract category rank
      const categoryRankMatch = html.match(/Category\s+Rank[:\s]+#?([\d,]+)/i) ||
                                html.match(/categoryRank["\s:]+(\d+)/i)
      if (categoryRankMatch) {
        data.category_rank = parseInt(categoryRankMatch[1].replace(/,/g, ''), 10)
      }

      // Extract country data
      const countryMatch = html.match(/country["\s:]+["']([A-Z]{2})["']/i)
      if (countryMatch) {
        data.top_country_shares = [{ country: countryMatch[1], value: null }]
      }

      // Extract monthly visits
      const visitsMatch = html.match(/visits["\s:]+(\d+)/i)
      if (visitsMatch) {
        data.monthly_visits = parseInt(visitsMatch[1], 10)
      }
    } catch (err) {
      console.error('[similarweb] HTML parsing error:', err.message)
    }
    return data
  }

  // Helper: Parse SimilarWeb JSON response
  function parseSimilarWebJSON(json) {
    const data = {}
    try {
      if (json.GlobalRank !== undefined) data.global_rank = json.GlobalRank
      if (json.CategoryRank !== undefined) data.category_rank = json.CategoryRank
      if (json.TopCountryShares && Array.isArray(json.TopCountryShares)) {
        data.top_country_shares = json.TopCountryShares.map(item => ({
          country: item.Country || item.country,
          value: item.Value !== undefined ? item.Value : item.value
        }))
      }
      if (json.CountryRank !== undefined) data.country_rank = json.CountryRank
      if (json.Visits !== undefined || json.MonthlyVisits !== undefined) {
        data.monthly_visits = json.Visits || json.MonthlyVisits
      }
    } catch (err) {
      console.error('[similarweb] JSON parsing error:', err.message)
    }
    return data
  }

  const attempt = async () => {
    let proxyOpt = undefined
    const startTime = Date.now()

    try {
      // Get proxy from centralized pool
      const proxyString = await proxyClient.getProxy(apiUrl)
      if (proxyString) {
        const playwrightProxy = toPlaywrightProxy(proxyString)
        if (playwrightProxy) {
          playwrightProxy._rawProxy = proxyString
          proxyOpt = playwrightProxy
        }
      }
    } catch (e) {
      console.error('[similarweb] Proxy allocation error:', e.message)
    }

    let h
    try {
      const fp = { userAgent: process.env.SIMILARWEB_USER_AGENT || undefined }
      h = await pool.getContext({ proxy: proxyOpt, fingerprint: fp })
    } catch (e) {
      if (String(e).startsWith('capacity_exhausted')) capExhausted.inc()
      throw new Error(`Capacity exhausted: ${e?.message || e}`)
    }

    const page = await h.context.newPage()

    try {
      const resp = await page.goto(apiUrl, { timeout: navTimeout, waitUntil: 'domcontentloaded' })
      const status = resp?.status() || 0

      // Get page body text for parsing
      let bodyText = ''
      try {
        bodyText = await page.evaluate(() => document.body && document.body.innerText || '')
      } catch {}

      // Try JSON parse first
      let parsedData = null
      let parseMethod = 'none'

      try {
        const jsonData = JSON.parse(bodyText)
        parsedData = parseSimilarWebJSON(jsonData)
        parseMethod = 'json'
      } catch {
        // JSON parse failed, try HTML parsing
        try {
          const htmlContent = await page.content()
          parsedData = parseSimilarWebHTML(htmlContent)
          parseMethod = 'html'
        } catch (htmlErr) {
          console.error('[similarweb] HTML parsing fallback failed:', htmlErr.message)
        }
      }

      const ok = status >= 200 && status < 400
      const responseTime = Date.now() - startTime

      // Release proxy back to pool
      if (proxyOpt && proxyOpt._rawProxy) {
        try {
          await proxyClient.releaseProxy(proxyOpt._rawProxy, ok, responseTime)
        } catch (err) {
          console.error('[similarweb] Error releasing proxy:', err.message)
        }
      }

      return {
        ok,
        status,
        domain: normalizedDomain,
        data: parsedData || {},
        parseMethod,
        via: proxyOpt ? 'proxy' : 'direct',
        responseTimeMs: responseTime
      }
    } finally {
      try { await page.close() } catch {}
      await pool.release(h)
    }
  }

  try {
    let lastErr = null
    const n = Math.max(0, Math.min(3, Number(retries)))
    const backoff = Math.max(100, Math.min(2000, Number(backoffMs)))

    for (let i = 0; i <= n; i++) {
      try {
        const result = await attempt()
        return res.json(result)
      } catch (e) {
        lastErr = e
        console.error(`[similarweb] Attempt ${i + 1}/${n + 1} failed:`, e.message)
      }
      if (i < n) {
        await new Promise(r => setTimeout(r, backoff * (i + 1)))
      }
    }

    return res.status(502).json({
      error: {
        code: 'SIMILARWEB_FETCH_FAILED',
        message: String(lastErr?.message || lastErr)
      }
    })
  } catch (e) {
    return res.status(502).json({
      error: {
        code: 'SIMILARWEB_FETCH_FAILED',
        message: String(e?.message || e)
      }
    })
  }
}))

// Page signals: title and og:site_name (best-effort)
app.post('/api/v1/browser/page-signals', withSlot(async (req, res) => {
  const { url, timeoutMs = 8000 } = req.body || {}
  if (!url) return res.status(400).json({ error: { code: 'INVALID_ARGUMENT', message: 'url required' } })
  const timeout = Math.min(15000, Math.max(1000, timeoutMs))
  try {
    if (USE_PW) {
      const h = await pool.getContext({})
      const page = await h.context.newPage()
      try {
        const resp = await page.goto(url, { timeout, waitUntil: 'domcontentloaded' })
        const status = resp?.status() || 0
        const info = await page.evaluate(() => ({
          title: document?.title || '',
          siteName: (document.querySelector('meta[property="og:site_name"]')?.getAttribute('content')) || ''
        }))
        return res.json({ status, ...info })
      } finally { try { await page.close() } catch {}; await pool.release(h) }
    }
    // Fallback: plain fetch and regex parse
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeout)
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal })
    clearTimeout(t)
    const status = r.status
    const html = await r.text()
    const lower = html.toLowerCase()
    let title = ''
    const ti = lower.indexOf('<title>')
    if (ti >= 0) { const end = lower.indexOf('</title>', ti+7); if (end > ti) title = html.slice(ti+7, end) }
    let siteName = ''
    const ogi = lower.indexOf('property="og:site_name"')
    if (ogi >= 0) {
      const seg = html.slice(ogi)
      const m = seg.match(/content=["']([^"']+)["']/i)
      if (m && m[1]) siteName = m[1]
    }
    return res.json({ status, title, siteName })
  } catch (e) {
    return res.status(502).json({ error: { code: 'PAGE_SIGNALS_FAILED', message: String(e?.message || e) } })
  }
}))

// Debug stats endpoint
app.get('/api/v1/browser/stats', (req, res) => {
  try { return res.json(pool.stats()) } catch (e) { return res.status(500).json({ error: { code: 'STATS_FAILED', message: String(e?.message || e) } }) }
})

// Proxy pool stats
app.get('/api/v1/browser/proxy-pool/stats', (req, res) => {
  try {
    const stats = getProxyPoolStats()
    return res.json({ ok: true, stats })
  } catch (e) {
    return res.status(500).json({ error: { code: 'PROXY_POOL_STATS_FAILED', message: String(e?.message || e) } })
  }
})

// Proxy health stats
app.get('/api/v1/browser/proxy-pool/health', (req, res) => {
  try {
    const healthStats = []
    for (const [proxy, health] of proxyHealthRegistry.entries()) {
      healthStats.push({
        proxy: proxy.split(':')[0], // Only show IP
        ...health.toJSON()
      })
    }

    // Sort by score descending
    healthStats.sort((a, b) => b.score - a.score)

    return res.json({
      ok: true,
      totalProxies: healthStats.length,
      healthyProxies: healthStats.filter(h => h.score >= 30 && !h.isQuarantined).length,
      quarantinedProxies: healthStats.filter(h => h.isQuarantined).length,
      proxies: healthStats
    })
  } catch (e) {
    return res.status(500).json({ error: { code: 'PROXY_HEALTH_STATS_FAILED', message: String(e?.message || e) } })
  }
})

// Clear proxy usage for a URL
app.post('/api/v1/browser/proxy-pool/clear-usage', (req, res) => {
  try {
    const { url } = req.body || {}
    if (!url) return res.status(400).json({ error: { code: 'INVALID_ARGUMENT', message: 'url required' } })
    clearProxyUsageForURL(url)
    return res.json({ ok: true, message: `Cleared proxy usage tracking for ${url}` })
  } catch (e) {
    return res.status(500).json({ error: { code: 'PROXY_POOL_CLEAR_FAILED', message: String(e?.message || e) } })
  }
})

// Clear all proxy pool cache
app.post('/api/v1/browser/proxy-pool/clear-all', (req, res) => {
  try {
    const size = proxyPoolCache.size
    proxyPoolCache.clear()
    return res.json({ ok: true, message: `Cleared ${size} proxy pool cache entries` })
  } catch (e) {
    return res.status(500).json({ error: { code: 'PROXY_POOL_CLEAR_ALL_FAILED', message: String(e?.message || e) } })
  }
})

function toPlaywrightProxy(line) {
  try {
    let server = '', username = undefined, password = undefined
    if (line.includes('://')) {
      const u = new URL(line)
      server = `${u.protocol}//${u.hostname}:${u.port}`
      if (u.username) username = decodeURIComponent(u.username)
      if (u.password) password = decodeURIComponent(u.password)
    } else if (line.includes('@')) {
      const [cred, host] = line.split('@')
      const [user, pass] = cred.split(':')
      const [h, p] = host.split(':')
      server = `http://${h}:${p}`
      username = user; password = pass
    } else {
      // Handle host:port:username:password format
      const parts = line.split(':')
      if (parts.length === 4) {
        const [h, p, user, pass] = parts
        server = `http://${h}:${p}`
        username = user
        password = pass
      } else if (parts.length === 2) {
        // host:port format (no auth)
        const [h, p] = parts
        server = `http://${h}:${p}`
      }
    }
    return { server, username, password }
  } catch { return undefined }
}

// ---- Pattern Management API ----

// Get pattern library stats
app.get('/api/v1/browser/patterns/stats', (req, res) => {
  try {
    const stats = patternMatcher.getStats()
    return res.json({ ok: true, stats })
  } catch (e) {
    return res.status(500).json({ error: { code: 'PATTERN_STATS_FAILED', message: String(e?.message || e) } })
  }
})

// Get all patterns
app.get('/api/v1/browser/patterns', (req, res) => {
  try {
    return res.json({ ok: true, library: patternMatcher.library })
  } catch (e) {
    return res.status(500).json({ error: { code: 'PATTERN_GET_FAILED', message: String(e?.message || e) } })
  }
})

// Add domain pattern
app.post('/api/v1/browser/patterns/domain', (req, res) => {
  try {
    const pattern = req.body
    patternMatcher.addDomainPattern(pattern)
    return res.json({ ok: true, pattern })
  } catch (e) {
    return res.status(400).json({ error: { code: 'PATTERN_ADD_FAILED', message: String(e?.message || e) } })
  }
})

// Update domain pattern
app.put('/api/v1/browser/patterns/domain/:id', (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    patternMatcher.updateDomainPattern(id, updates)
    return res.json({ ok: true })
  } catch (e) {
    const status = e.message.includes('not found') ? 404 : 400
    return res.status(status).json({ error: { code: 'PATTERN_UPDATE_FAILED', message: String(e?.message || e) } })
  }
})

// Delete domain pattern
app.delete('/api/v1/browser/patterns/domain/:id', (req, res) => {
  try {
    const { id } = req.params
    patternMatcher.deleteDomainPattern(id)
    return res.json({ ok: true })
  } catch (e) {
    const status = e.message.includes('not found') ? 404 : 400
    return res.status(status).json({ error: { code: 'PATTERN_DELETE_FAILED', message: String(e?.message || e) } })
  }
})

// Reload pattern library (hot reload)
app.post('/api/v1/browser/patterns/reload', (req, res) => {
  try {
    patternMatcher.reloadPatternLibrary()
    return res.json({ ok: true, message: 'Pattern library reloaded successfully' })
  } catch (e) {
    return res.status(500).json({ error: { code: 'PATTERN_RELOAD_FAILED', message: String(e?.message || e) } })
  }
})

const port = process.env.PORT || 8080
app.listen(port, async () => {
  console.log(`[browser-exec] listening on :${port}`)

  // 启动Pub/Sub队列worker
  if (process.env.ENABLE_QUEUE_WORKER === '1') {
    console.log('[pubsub] Starting queue worker...')
    await queueManager.startWorker(
      async (request) => {
        // 使用unifiedVisitInternalSingleAttempt处理队列消息
        const result = await unifiedVisitInternalSingleAttempt(request)

        // 保存访问结果到数据库
        try {
          await dbClient.saveVisitResult(result, {
            url: request.url,
            batchId: request.batchId || null,
            taskId: request.taskId || null,
          })
        } catch (err) {
          console.error('[pubsub] Failed to save result to database:', err.message)
        }

        return result
      },
      {
        maxMessages: 2,  // 🔧 修复OOM: 2GB内存最多支持2个浏览器（每个~400MB）
        maxExtension: 600000
      }
    )
    console.log('[pubsub] Queue worker started')
  }
})

// ---- helpers ----
async function simulateClick(url, opts = {}) {
  if (!USE_PW) return { ok: false, status: 0, error: 'playwright disabled' }
  const t0 = Date.now()
  const { timeoutMs = 10000, proxy, fingerprint, selector, wait = {}, dwellMs = 0 } = opts
  const h = await pool.getContext({ fingerprint, proxy })
  const page = await h.context.newPage()
  let status = 0
  try {
    const resp = await page.goto(url, { timeout: Math.min(15000, Math.max(2000, timeoutMs)), waitUntil: 'domcontentloaded' })
    status = resp?.status() || 0
    // try click first visible link or body
    const targetSel = selector || 'a[href]'
    let anchor = null
    try { anchor = await page.waitForSelector(targetSel, { timeout: 1500, state: 'visible' }) } catch {}
    const ct0 = Date.now()
    if (anchor) {
      await anchor.click({ trial: false, timeout: 2000 }).catch(()=>{})
    } else {
      await page.mouse.click(10 + Math.random()*100, 10 + Math.random()*50).catch(()=>{})
    }
    // optional wait strategy after click
    const until = (wait && wait.until) || 'domcontentloaded'
    const waitTimeout = Math.min(10000, Math.max(500, wait.timeoutMs || 1500))
    try {
      if (until === 'networkidle') {
        await page.waitForLoadState('networkidle', { timeout: waitTimeout })
      } else if (until === 'selector' && wait.selector) {
        await page.waitForSelector(wait.selector, { timeout: waitTimeout })
      } else {
        await page.waitForLoadState('domcontentloaded', { timeout: waitTimeout })
      }
    } catch {}
    if (dwellMs > 0) { await page.waitForTimeout(Math.min(5000, Math.max(100, dwellMs))) }
    const tNav = Date.now() - t0
    const tClick = Date.now() - ct0
    return { ok: status >= 200 && status < 400, status, timings: { navMs: tNav, clickMs: tClick } }
  } finally {
    try { await page.close() } catch {}
    await pool.release(h)
  }
}

// Internal helpers to unify queue handlers with REST endpoints
async function checkAvailabilityInternal({ url, timeoutMs = 5000, method = 'HEAD', retries = 0, backoffMs = 150, proxyProviderURL } = {}) {
  if (!url) throw new Error('url required')
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), Math.min(15000, Math.max(1000, timeoutMs)))
  try {
    const attempt = async () => {
      if (USE_PW) {
        let proxy = undefined
        if (proxyProviderURL) {
          try { const txt = await (await fetch(String(proxyProviderURL))).text(); const lines = txt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean); if (lines.length) proxy = toPlaywrightProxy(lines[(Math.random()*lines.length)|0]) } catch {}
        }
        const fp = {}
        return await gotoWithFingerprint(url, { timeoutMs, proxy, fingerprint: fp })
      }
      const r = await fetch(url, { method, redirect: 'follow', signal: ctrl.signal })
      return { ok: r.ok, status: r.status, engine: 'fetch' }
    }
    let out = null, lastErr = null
    const n = Math.max(0, Math.min(3, Number(retries)))
    const backoff = Math.max(50, Math.min(1000, Number(backoffMs)))
    for (let i = 0; i <= n; i++) { try { out = await attempt(); break } catch (e) { lastErr = e }; await new Promise(r => setTimeout(r, backoff * (i + 1))) }
    clearTimeout(t)
    if (!out) return { ok: false, status: 0, error: String(lastErr?.message || lastErr) }
    return { ...out, engine: out.engine || (USE_PW ? 'playwright' : 'fetch') }
  } catch (e) { clearTimeout(t); return { ok: false, status: 0, error: String(e?.message || e) } }
}

async function resolveOfferInternal(body = {}) {
  if (!USE_PW) return { status: 400, error: { code: 'PLAYWRIGHT_DISABLED', message: 'playwright disabled' } }
  const { url, waitUntil = 'networkidle', timeoutMs = 45000, stabilizeMs = 1200, headers = {}, userAgent, proxyProviderURL } = body || {}
  if (!url) return { status: 400, error: { code: 'INVALID_ARGUMENT', message: 'url required' } }
  resolveCounter.inc()
  const wUntil = ['domcontentloaded','load','networkidle'].includes(String(waitUntil)) ? String(waitUntil) : 'networkidle'
  const navTimeout = Math.min(60000, Math.max(2000, Number(timeoutMs)))
  const stabBudget = Math.max(0, Math.min(5000, Number(stabilizeMs)))

  async function pickWorkingProxy(providerUrl, maxProbe = 3) {
    try {
      const txt = await (await fetch(providerUrl)).text()
      const all = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      const candidates = all.slice(0, Math.max(1, Math.min(maxProbe, all.length)))
      for (const line of candidates) {
        const opt = toPlaywrightProxy(line); if (!opt) continue
        const h = await pool.getContext({ proxy: opt }); const page = await h.context.newPage()
        let ok = false
        try { const resp = await page.goto('https://www.gstatic.com/generate_204', { timeout: 3000, waitUntil: 'load' }); const sc = resp?.status() || 0; ok = sc >= 200 && sc < 400 } catch {}
        try { await page.close() } catch {}
        await pool.release(h)
        if (ok) return opt
      }
    } catch {}
    return undefined
  }

  let proxyOpt = undefined
  try { const provider = String(proxyProviderURL || process.env.PROXY_URL_US || '').trim(); if (provider) proxyOpt = await pickWorkingProxy(provider, 5) } catch {}

  const fp = { userAgent: userAgent || process.env.SIMILARWEB_USER_AGENT || undefined }
  let h
  try { h = await pool.getContext({ proxy: proxyOpt, fingerprint: fp }) } catch (e) { if (String(e).startsWith('capacity_exhausted')) capExhausted.inc(); return { status: 503, error: { code: 'CAPACITY_EXHAUSTED', message: String(e?.message || e) } } }
  const page = await h.context.newPage()
  try {
    const hdrs = headers && typeof headers === 'object' ? headers : {}; const keys = Object.keys(hdrs)
    if (keys.length) { try { await page.setExtraHTTPHeaders(hdrs) } catch {} }
    const t0 = Date.now()
    const resp = await page.goto(url, { timeout: navTimeout, waitUntil: wUntil })
    const status = resp?.status() || 0
    const chain = []
    try { let reqObj = resp?.request?.(); if (typeof reqObj === 'function') reqObj = resp.request(); let cur = reqObj; while (cur) { chain.push(cur.url()); cur = cur.redirectedFrom?.() }; chain.reverse() } catch {}
    let current = page.url(); let stableSince = Date.now()
    while (Date.now() - t0 < navTimeout && Date.now() - stableSince < stabBudget) { await new Promise(r => setTimeout(r, 300)); const now = page.url(); if (now !== current) { current = now; stableSince = Date.now() } }
    const stabilizeMsSpent = Date.now() - stableSince
    const finalHref = await page.evaluate(() => window.location && window.location.href || document.location.href)
    const u = new URL(finalHref)
    const finalUrl = `${u.origin}${u.pathname}${u.pathname.endsWith('/') ? '' : '/'}`
    const finalUrlSuffix = (u.search || '').replace(/^\?/, '')
    const domain = u.hostname
    const parts = domain.split('.')
    const brand = parts.length >= 2 ? parts[parts.length - 2] : domain
    return { ok: status >= 200 && status < 400, status, finalUrl, finalUrlSuffix, domain, brand, via: proxyOpt ? 'proxy' : 'direct', chainLength: chain.length, chain, timings: { navMs: Date.now() - t0, stabilizeMs: stabilizeMsSpent } }
  } catch (e) {
    const msg = String(e?.message || e); if (/Timeout/i.test(msg)) return { status: 504, error: { code: 'RESOLVE_TIMEOUT', message: msg } }; return { status: 502, error: { code: 'RESOLVE_FAILED', message: msg } }
  } finally { try { await page.close() } catch {}; await pool.release(h) }
}

// Optimized version for Offer evaluation with resource blocking
async function evaluateOfferInternal(body = {}) {
  if (!USE_PW) return { status: 400, error: { code: 'PLAYWRIGHT_DISABLED', message: 'playwright disabled' } }
  const { url, waitUntil = 'networkidle', timeoutMs = 30000, stabilizeMs = 1200, headers = {}, userAgent, proxyProviderURL, targetCountry = 'US' } = body || {}
  if (!url) return { status: 400, error: { code: 'INVALID_ARGUMENT', message: 'url required' } }

  const wUntil = ['domcontentloaded','load','networkidle'].includes(String(waitUntil)) ? String(waitUntil) : 'networkidle'
  const navTimeout = Math.min(60000, Math.max(2000, Number(timeoutMs)))
  const stabBudget = Math.max(0, Math.min(5000, Number(stabilizeMs)))

  // Proxy selection based on target country
  async function pickWorkingProxy(providerUrl, maxProbe = 3) {
    try {
      const txt = await (await fetch(providerUrl)).text()
      const all = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      const candidates = all.slice(0, Math.max(1, Math.min(maxProbe, all.length)))
      for (const line of candidates) {
        const opt = toPlaywrightProxy(line); if (!opt) continue
        const h = await pool.getContext({ proxy: opt }); const page = await h.context.newPage()
        let ok = false
        try { const resp = await page.goto('https://www.gstatic.com/generate_204', { timeout: 3000, waitUntil: 'load' }); const sc = resp?.status() || 0; ok = sc >= 200 && sc < 400 } catch {}
        try { await page.close() } catch {}
        await pool.release(h)
        if (ok) return opt
      }
    } catch {}
    return undefined
  }

  let proxyOpt = undefined
  try {
    const provider = String(proxyProviderURL || process.env.PROXY_URL_US || '').trim()
    if (provider) proxyOpt = await pickWorkingProxy(provider, 5)
  } catch {}

  const fp = { userAgent: userAgent || process.env.SIMILARWEB_USER_AGENT || undefined }
  let h
  try {
    h = await pool.getContext({ proxy: proxyOpt, fingerprint: fp })
  } catch (e) {
    if (String(e).startsWith('capacity_exhausted')) capExhausted.inc()
    return { status: 503, error: { code: 'CAPACITY_EXHAUSTED', message: String(e?.message || e) } }
  }

  const page = await h.context.newPage()

  try {
    // OPTIMIZATION: Block resource-heavy content to reduce bandwidth and speed up evaluation
    await page.route('**/*', (route) => {
      const req = route.request()
      const resType = req.resourceType()
      // Block images, fonts, media, and stylesheets to minimize traffic
      if (['image', 'font', 'media', 'stylesheet'].includes(resType)) {
        route.abort()
      } else {
        route.continue()
      }
    })

    const hdrs = headers && typeof headers === 'object' ? headers : {}
    const keys = Object.keys(hdrs)
    if (keys.length) { try { await page.setExtraHTTPHeaders(hdrs) } catch {} }

    const t0 = Date.now()
    const resp = await page.goto(url, { timeout: navTimeout, waitUntil: wUntil })
    const status = resp?.status() || 0

    // Track redirect chain
    const chain = []
    try {
      let reqObj = resp?.request?.()
      if (typeof reqObj === 'function') reqObj = resp.request()
      let cur = reqObj
      while (cur) {
        chain.push({ url: cur.url(), timestamp: new Date().toISOString() })
        cur = cur.redirectedFrom?.()
      }
      chain.reverse()
    } catch {}

    // Wait for URL stabilization
    let current = page.url()
    let stableSince = Date.now()
    while (Date.now() - t0 < navTimeout && Date.now() - stableSince < stabBudget) {
      await new Promise(r => setTimeout(r, 300))
      const now = page.url()
      if (now !== current) { current = now; stableSince = Date.now() }
    }

    const stabilizeMsSpent = Date.now() - stableSince
    const finalHref = await page.evaluate(() => window.location && window.location.href || document.location.href)

    // Extract brand name from page title
    const pageTitle = await page.title().catch(() => '')
    let brandName = pageTitle.split('|')[0].split('-')[0].trim()

    // Parse final URL
    const u = new URL(finalHref)
    const finalUrl = `${u.origin}${u.pathname}`
    const finalUrlSuffix = (u.search || '').replace(/^\?/, '')
    const domain = u.hostname.replace(/^www\./, '')

    // Fallback brand name from domain
    if (!brandName) {
      const parts = domain.split('.')
      brandName = parts.length >= 2 ? parts[parts.length - 2] : domain
      brandName = brandName.charAt(0).toUpperCase() + brandName.slice(1)
    }

    // Get minimal HTML for text analysis (first 50KB only)
    const html = await page.content().catch(() => '')
    const htmlSnippet = html.slice(0, 50000)

    return {
      ok: status >= 200 && status < 400,
      status,
      finalUrl,
      finalUrlSuffix,
      domain,
      brandName,
      redirectChain: chain,
      htmlSnippet,
      via: proxyOpt ? 'proxy' : 'direct',
      timings: {
        totalMs: Date.now() - t0,
        navigationMs: Date.now() - t0 - stabilizeMsSpent,
        stabilizeMs: stabilizeMsSpent
      }
    }
  } catch (e) {
    const msg = String(e?.message || e)
    if (/Timeout/i.test(msg)) return { status: 504, error: { code: 'EVALUATION_TIMEOUT', message: msg } }
    return { status: 502, error: { code: 'EVALUATION_FAILED', message: msg } }
  } finally {
    try { await page.close() } catch {}
    await pool.release(h)
  }
}

// ========== Proxy Pool Management ==========

// Global proxy pool: { url -> { proxies: [proxy_string], usedProxies: Map<proxy_string, count> } }
const proxyPoolCache = new Map()

// Global proxy allocation lock (prevent concurrent requests from getting same proxy)
// Map<proxy_string, timestamp>
const proxyAllocationLock = new Map()

// Cleanup expired locks every 5 seconds (优化: 减少锁窗口，提高代理分配速度)
setInterval(() => {
  const now = Date.now()
  const LOCK_EXPIRY = 5000 // 5 seconds (从 10s 优化到 5s)
  for (const [proxy, timestamp] of proxyAllocationLock.entries()) {
    if (now - timestamp > LOCK_EXPIRY) {
      proxyAllocationLock.delete(proxy)
    }
  }
}, 5000)

// Proxy health tracking
class ProxyHealth {
  constructor(proxy) {
    this.proxy = proxy
    this.score = 100 // Initial score 100
    this.successCount = 0
    this.failureCount = 0
    this.totalRequests = 0
    this.avgResponseTime = 0
    this.lastUsed = null
    this.lastSuccess = null
    this.lastFailure = null
    this.consecutiveFailures = 0
    this.isQuarantined = false
    this.quarantineUntil = null
    this.createdAt = Date.now()
  }

  recordSuccess(responseTime) {
    this.successCount++
    this.totalRequests++
    this.consecutiveFailures = 0
    this.lastSuccess = Date.now()
    this.lastUsed = Date.now()

    // Update average response time
    if (this.avgResponseTime === 0) {
      this.avgResponseTime = responseTime
    } else {
      this.avgResponseTime = (this.avgResponseTime * 0.7) + (responseTime * 0.3)
    }

    // Increase score
    this.score = Math.min(100, this.score + 2)
  }

  recordFailure(errorType) {
    this.failureCount++
    this.totalRequests++
    this.consecutiveFailures++
    this.lastFailure = Date.now()
    this.lastUsed = Date.now()

    // Decrease score based on error type
    const penalty = errorType === 'timeout' ? 5 : (errorType === 'network' ? 10 : 8)
    this.score = Math.max(0, this.score - penalty)

    // Quarantine after 3 consecutive failures
    if (this.consecutiveFailures >= 3) {
      this.isQuarantined = true
      this.quarantineUntil = Date.now() + 30 * 60 * 1000 // 30 minutes
      console.log(`[proxy-health] Quarantined ${this.proxy.split(':')[0]} for 30 minutes (score: ${this.score})`)
    }
  }

  getSuccessRate() {
    return this.totalRequests > 0 ? this.successCount / this.totalRequests : 0
  }

  isHealthy() {
    // Check quarantine status
    if (this.isQuarantined && Date.now() < this.quarantineUntil) {
      return false
    }

    // Release from quarantine
    if (this.isQuarantined && Date.now() >= this.quarantineUntil) {
      this.isQuarantined = false
      this.consecutiveFailures = 0
      this.score = 50 // Reset to medium score
      console.log(`[proxy-health] Released ${this.proxy.split(':')[0]} from quarantine (score: ${this.score})`)
    }

    // Enhanced health criteria:
    // 1. Score-based: >= 30
    // 2. Success rate threshold: >= 0.3 if has history (>= 5 requests)
    // 3. Age-based grace period: Allow new proxies (< 60s old) with score >= 50
    const hasEnoughHistory = this.totalRequests >= 5
    const successRate = this.getSuccessRate()
    const age = Date.now() - this.createdAt

    // New proxies get grace period
    if (age < 60000 && this.score >= 50) {
      return true
    }

    // Proxies with history need good success rate
    if (hasEnoughHistory && successRate < 0.3) {
      return false
    }

    // Consider healthy if score >= 30
    return this.score >= 30
  }

  getTier() {
    const successRate = this.getSuccessRate()
    const hasHistory = this.totalRequests >= 3

    // Premium tier: high success rate + fast response
    if (hasHistory && successRate > 0.9 && this.avgResponseTime < 3000) {
      return 'premium'
    }

    // Standard tier: decent success rate + reasonable speed
    if (hasHistory && successRate > 0.7 && this.avgResponseTime < 5000) {
      return 'standard'
    }

    // Promising tier: new proxy with good initial performance
    if (!hasHistory && this.score >= 90) {
      return 'promising'
    }

    // Fallback tier
    return 'fallback'
  }

  toJSON() {
    return {
      proxy: this.proxy.split(':').slice(0, 2).join(':'), // Only show IP:port
      score: this.score,
      successRate: this.getSuccessRate(),
      avgResponseTime: Math.round(this.avgResponseTime),
      totalRequests: this.totalRequests,
      consecutiveFailures: this.consecutiveFailures,
      isQuarantined: this.isQuarantined,
      quarantineUntil: this.quarantineUntil,
      tier: this.getTier(),
      age: Math.floor((Date.now() - this.createdAt) / 1000) + 's'
    }
  }
}

// Global proxy health registry
const proxyHealthRegistry = new Map()

/**
 * Get or create proxy health tracker
 */
function getProxyHealth(proxy) {
  if (!proxyHealthRegistry.has(proxy)) {
    proxyHealthRegistry.set(proxy, new ProxyHealth(proxy))
  }
  return proxyHealthRegistry.get(proxy)
}

/**
 * Record proxy feedback after request
 */
function recordProxyFeedback(proxy, success, responseTime = null, errorType = null) {
  const health = getProxyHealth(proxy)

  if (success) {
    health.recordSuccess(responseTime)
    console.log(`[proxy-health] ✅ ${proxy.split(':')[0]} success (score: ${health.score}, avg: ${Math.round(health.avgResponseTime)}ms)`)
  } else {
    health.recordFailure(errorType || 'unknown')
    console.log(`[proxy-health] ❌ ${proxy.split(':')[0]} failed (${errorType}, score: ${health.score}, consecutive: ${health.consecutiveFailures})`)
  }
}

/**
 * Get or create proxy pool for a URL
 * @param {string} proxyProviderURL - URL to fetch proxies
 * @param {number} poolSize - Number of proxies to fetch (default: 10)
 * @returns {Promise<string[]>} Array of proxy strings
 */
async function getProxyPool(proxyProviderURL, poolSize = 10) {
  if (!proxyProviderURL) return []

  // Check cache
  if (proxyPoolCache.has(proxyProviderURL)) {
    const cached = proxyPoolCache.get(proxyProviderURL)
    // Return cached proxies if not expired (TTL: 5 minutes)
    if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.proxies
    }
  }

  // Fetch new proxies
  try {
    // Modify URL to request multiple IPs
    const url = new URL(proxyProviderURL)
    url.searchParams.set('ips', String(poolSize))

    const txt = await (await fetch(url.toString())).text()
    const proxies = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean)

    if (proxies.length > 0) {
      proxyPoolCache.set(proxyProviderURL, {
        proxies,
        timestamp: Date.now()
      })
      console.log(`[proxy-pool] Fetched ${proxies.length} proxies for pool`)
      return proxies
    }
  } catch (err) {
    console.error('[proxy-pool] Fetch failed:', err.message)
  }

  return []
}

/**
 * Get next available proxy for a URL
 * Track usage per URL to avoid reusing same proxy for same URL
 * @param {string} url - The target URL being visited
 * @param {string} proxyProviderURL - Proxy provider URL
 * @param {number} poolSize - Pool size
 * @returns {Promise<{proxy: string|null, pool: string[]}>}
 */
async function getNextProxyForURL(url, proxyProviderURL, poolSize = 10) {
  const pool = await getProxyPool(proxyProviderURL, poolSize)
  if (pool.length === 0) return { proxy: null, pool: [], health: null }

  // Filter healthy proxies only
  let healthyProxies = pool.filter(proxy => {
    const health = getProxyHealth(proxy)
    return health.isHealthy()
  })

  if (healthyProxies.length === 0) {
    console.warn('[proxy-pool] No healthy proxies available, using all proxies')
    // Fallback to all proxies if none are healthy
    healthyProxies = [...pool]
  }

  // Get recently allocated proxies (within last 5 seconds) - GLOBAL LOCK (优化: 减少锁窗口)
  const now = Date.now()
  const LOCK_WINDOW = 5000 // 5 seconds (从 10s 优化到 5s，提高高并发下的代理分配速度)
  const recentlyAllocated = Array.from(proxyAllocationLock.entries())
    .filter(([proxy, timestamp]) => now - timestamp < LOCK_WINDOW)
    .map(([proxy, _]) => proxy)

  // Track which proxies have been used for this specific URL
  const cacheKey = `${url}:usage`
  if (!proxyPoolCache.has(cacheKey)) {
    proxyPoolCache.set(cacheKey, new Map()) // Map<proxy_string, usage_count>
  }
  const usageMap = proxyPoolCache.get(cacheKey)

  // Filter out:
  // 1. Already used proxies for this URL (prevent same-URL reuse)
  // 2. Recently allocated proxies globally (prevent concurrent conflicts)
  const availableProxies = healthyProxies.filter(proxy => {
    const usedForThisUrl = usageMap.has(proxy)
    const recentlyAllocatedGlobally = recentlyAllocated.includes(proxy)
    return !usedForThisUrl && !recentlyAllocatedGlobally
  })

  // If we have available proxies, use them; otherwise fall back to healthy proxies
  const candidateProxies = availableProxies.length > 0 ? availableProxies : healthyProxies

  // Find best proxy: consider health score and speed
  let selectedProxy = null
  let bestScore = -Infinity

  for (const proxy of candidateProxies) {
    const health = getProxyHealth(proxy)

    // Scoring based on health and speed
    // - Health score (0-100)
    // - Speed penalty: slower = lower score
    const speedPenalty = health.avgResponseTime > 0 ? health.avgResponseTime / 100 : 0
    const score = health.score - speedPenalty

    if (score > bestScore) {
      bestScore = score
      selectedProxy = proxy
    }
  }

  // Fallback: if no proxy selected, pick random from candidates
  if (selectedProxy === null) {
    selectedProxy = candidateProxies[Math.floor(Math.random() * candidateProxies.length)]
  }

  // Mark proxy as used for this URL
  usageMap.set(selectedProxy, 1)

  // Add to global allocation lock (prevent concurrent requests from using same proxy)
  proxyAllocationLock.set(selectedProxy, now)

  // Log proxy selection info
  const unusedCount = availableProxies.length
  const allocatedCount = recentlyAllocated.length
  console.log(`[proxy-pool] Selected ${selectedProxy.split(':')[0]} for ${new URL(url).hostname} (available: ${unusedCount}/${healthyProxies.length}, locked: ${allocatedCount})`)

  const health = getProxyHealth(selectedProxy)

  return {
    proxy: selectedProxy,
    pool: healthyProxies,
    health: health.toJSON()
  }
}

/**
 * Clear proxy usage tracking for a URL (e.g., after task completion)
 */
function clearProxyUsageForURL(url) {
  const cacheKey = `${url}:usage`
  proxyPoolCache.delete(cacheKey)
}

/**
 * Get proxy pool statistics
 */
function getProxyPoolStats() {
  const stats = {}
  for (const [key, value] of proxyPoolCache.entries()) {
    if (key.endsWith(':usage')) {
      const url = key.replace(':usage', '')
      const usageMap = value
      stats[url] = {
        uniqueProxiesUsed: usageMap.size,
        totalUsage: Array.from(usageMap.values()).reduce((a, b) => a + b, 0),
        usageByProxy: Object.fromEntries(usageMap)
      }
    } else {
      stats[key] = {
        poolSize: value.proxies.length,
        age: Math.floor((Date.now() - value.timestamp) / 1000) + 's'
      }
    }
  }
  return stats
}

/**
 * Proxy pool warmup - preload proxies on startup
 * @param {string} proxyProviderURL - Proxy provider URL
 * @param {number} poolSize - Number of proxies to fetch
 */
async function warmupProxyPool(proxyProviderURL, poolSize = 10) {
  if (!proxyProviderURL) {
    console.log('[proxy-warmup] No proxy provider URL, skipping warmup')
    return
  }

  try {
    console.log(`[proxy-warmup] Starting proxy pool warmup (size: ${poolSize})...`)
    const startTime = Date.now()

    // Fetch proxies
    const proxies = await getProxyPool(proxyProviderURL, poolSize)

    if (proxies.length === 0) {
      console.warn('[proxy-warmup] Failed to fetch proxies during warmup')
      return
    }

    console.log(`[proxy-warmup] Fetched ${proxies.length} proxies in ${Date.now() - startTime}ms`)

    // Initialize health tracking for all proxies
    for (const proxy of proxies) {
      getProxyHealth(proxy)
    }

    console.log(`[proxy-warmup] Initialized health tracking for ${proxies.length} proxies`)
    console.log(`[proxy-warmup] Warmup complete (${Date.now() - startTime}ms)`)
  } catch (err) {
    console.error('[proxy-warmup] Warmup failed:', err.message)
  }
}

// Auto-warmup on startup if PROXY_URL_US is set
if (process.env.PROXY_URL_US) {
  // 优化: 增大代理池预热大小，支持更高并发
  const WARMUP_POOL_SIZE = Number(process.env.PROXY_POOL_WARMUP_SIZE || 200) // 从 20 增加到 200
  console.log(`[proxy-warmup] Will warmup ${WARMUP_POOL_SIZE} proxies on startup`)

  // Delay warmup by 2 seconds to allow server to start first
  setTimeout(() => {
    warmupProxyPool(process.env.PROXY_URL_US, WARMUP_POOL_SIZE).catch(err => {
      console.error('[proxy-warmup] Auto-warmup error:', err.message)
    })
  }, 2000)
}

// Cleanup old cache entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of proxyPoolCache.entries()) {
    if (!key.endsWith(':usage') && now - value.timestamp > 10 * 60 * 1000) {
      proxyPoolCache.delete(key)
      console.log('[proxy-pool] Cleaned up expired cache:', key)
    }
  }
}, 10 * 60 * 1000)

// ========== Unified Visit Implementation ==========

// Visit mode presets
// Unified visit configuration (optimized based on performance testing)
// Previous modes (evaluate/click/resolve/check) have been removed
// All visits now use this single optimized configuration
// - Best success rate: 100%
// - Fastest response: ~5.2s average
// - Minimal bandwidth: ~300KB per visit
// - Full anti-bot protection enabled
//
// OPTIMIZATION (2025-10-02):
// - timeout: 30000 → 60000 (解决 pboost.me Cloudflare 挑战超时)
// - stabilizeMs: 8000 → 12000 (延长稳定等待时间,确保中间页完成跳转)
const UNIFIED_VISIT_CONFIG = {
  resourceBlock: ['image', 'font', 'media', 'stylesheet'],
  timeout: 60000,
  waitUntil: 'domcontentloaded',
  enableAntiBot: true,
  stabilizeMs: 12000,
  referer: 'social',
  requireProxy: true,
  requireBrandExtraction: true
}

// Referer strategies (search removed per requirement)
const REFERER_LISTS = {
  social: ['https://www.facebook.com/','https://www.instagram.com/','https://twitter.com/','https://www.tiktok.com/','https://www.youtube.com/','https://www.linkedin.com/','https://www.reddit.com/','https://www.pinterest.com/']
}

function selectRefererByStrategy(strategy, customRef) {
  if (strategy === 'none') return null
  if (strategy === 'custom' && customRef) return customRef
  if (strategy === 'direct') return 'https://www.google.com/'
  const list = REFERER_LISTS[strategy] || REFERER_LISTS.social
  return list[Math.floor(Math.random() * list.length)]
}

// Anti-bot detection (quick check)
async function quickAntiBotCheck(page) {
  try {
    const checks = await Promise.race([
      page.title().then(t => /just a moment|cloudflare|ddos-guard|checking your browser/i.test(t.toLowerCase())),
      page.content().then(h => {
        const snippet = h.slice(0,5000).toLowerCase()
        return snippet.includes('cf-browser-verification') || snippet.includes('ray-id') || snippet.includes('__cf_chl_jschl_tk__')
      }),
      new Promise(r => setTimeout(() => r(false), 200))
    ])
    return checks === true ? { passed: false, blockedBy: 'cloudflare' } : { passed: true }
  } catch {
    return { passed: true }
  }
}

// Known affiliate network domains
const AFFILIATE_NETWORK_DOMAINS = [
  'pboost.me', 'clickbank.net', 'cj.com', 'jvzoo.com', 'shareasale.com',
  'awin1.com', 'impact.com', 'partnerize.com', 'rakutenmarketing.com',
  'avantlink.com', 'flexoffers.com', 'linksynergy.com', 'pjaff.com'
]

// Detect intermediate page (affiliate network landing page, not actual offer landing page)
/**
 * Known intermediate page domains (tracking/verification pages)
 */
const INTERMEDIATE_PAGE_DOMAINS = [
  'chromewebdata',
  'trackingdesk',
  'voluum',
  'binom',
  'keitaro',
  'bemob',
  'redirectpage',
  'tracking',
  'verification'
]

/**
 * Attempt to trigger navigation from intermediate page
 * Tries various methods to force the page to navigate to the final destination
 */
async function attemptIntermediatePageNavigation(page) {
  try {
    console.log('[auto-navigate] Attempting to trigger navigation from intermediate page...')

    // Method 0: Check for anti-bot/verification challenges (Cloudflare, chromewebdata, etc.)
    const isChallengePage = await page.evaluate(() => {
      const bodyText = document.body.textContent || ''
      const html = document.documentElement.innerHTML || ''

      // Cloudflare challenge indicators
      const hasCloudflare = html.includes('cf-browser-verification') ||
                           html.includes('Checking your browser') ||
                           bodyText.includes('Cloudflare') ||
                           bodyText.includes('DDoS protection')

      // Generic bot detection
      const hasBotCheck = bodyText.includes('verify you are human') ||
                         bodyText.includes('security check') ||
                         bodyText.includes('prove you are not a robot') ||
                         bodyText.includes('captcha')

      return hasCloudflare || hasBotCheck
    }).catch(() => false)

    if (isChallengePage) {
      console.log('[auto-navigate] Detected anti-bot challenge page, waiting for auto-solve...')

      // Wait longer for challenge to auto-solve (Cloudflare/chromewebdata usually needs 8-12 seconds)
      await new Promise(r => setTimeout(r, 12000))

      // Check if challenge checkbox needs to be clicked
      const challengeClicked = await page.evaluate(() => {
        // Look for Cloudflare challenge checkbox
        const challengeCheckbox = document.querySelector('#challenge-running, .challenge-form input[type="checkbox"]')
        if (challengeCheckbox && challengeCheckbox.offsetParent !== null) {
          challengeCheckbox.click()
          return true
        }

        // Look for "Verify you are human" button
        const verifyButton = Array.from(document.querySelectorAll('button, input[type="button"]')).find(btn => {
          const text = (btn.textContent || btn.value || '').toLowerCase()
          return text.includes('verify') || text.includes('continue') || text.includes('i am human')
        })

        if (verifyButton && verifyButton.offsetParent !== null) {
          verifyButton.click()
          return true
        }

        return false
      }).catch(() => false)

      if (challengeClicked) {
        console.log('[auto-navigate] Clicked challenge verification')
        // Wait for verification to complete and page navigation
        await new Promise(r => setTimeout(r, 8000))
        return true
      }

      // If no interaction needed, wait for auto-solve and check if URL changed
      console.log('[auto-navigate] Waiting for challenge auto-solve...')
      const urlBeforeWait = page.url()
      await new Promise(r => setTimeout(r, 5000))
      const urlAfterWait = page.url()

      if (urlBeforeWait !== urlAfterWait) {
        console.log('[auto-navigate] Challenge passed, URL changed to:', urlAfterWait)
        return true
      }

      return urlBeforeWait !== urlAfterWait
    }

    // Method 1: Look for and click "continue" or "proceed" buttons
    const buttonClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'))
      const continueButton = buttons.find(btn => {
        const text = (btn.textContent || btn.value || btn.innerHTML || '').toLowerCase()
        return text.includes('continue') ||
               text.includes('proceed') ||
               text.includes('click here') ||
               text.includes('next') ||
               text.includes('go to') ||
               text.includes('enter') ||
               text.includes('redirect')
      })

      if (continueButton) {
        continueButton.click()
        return true
      }
      return false
    }).catch(() => false)

    if (buttonClicked) {
      console.log('[auto-navigate] Clicked continue button')
      return true
    }

    // Method 2: Check for hidden form and submit it
    const formSubmitted = await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'))
      if (forms.length > 0) {
        // Find auto-submit form or first form
        const autoForm = forms.find(f => f.hasAttribute('data-auto-submit') || f.id.includes('redirect'))
        const targetForm = autoForm || forms[0]
        targetForm.submit()
        return true
      }
      return false
    }).catch(() => false)

    if (formSubmitted) {
      console.log('[auto-navigate] Submitted redirect form')
      return true
    }

    // Method 3: Look for redirect URL in page content and navigate directly
    const redirectUrl = await page.evaluate(() => {
      // Check for data attributes
      const redirectElement = document.querySelector('[data-redirect-url], [data-target-url], [data-destination]')
      if (redirectElement) {
        return redirectElement.getAttribute('data-redirect-url') ||
               redirectElement.getAttribute('data-target-url') ||
               redirectElement.getAttribute('data-destination')
      }

      // Check for meta refresh
      const metaRefresh = document.querySelector('meta[http-equiv="refresh"]')
      if (metaRefresh) {
        const content = metaRefresh.getAttribute('content')
        const urlMatch = content && content.match(/url=(.+)$/i)
        if (urlMatch) {
          return urlMatch[1]
        }
      }

      // Check for JavaScript redirect patterns
      const scripts = Array.from(document.querySelectorAll('script'))
      for (const script of scripts) {
        const content = script.textContent || ''
        // Look for window.location assignments
        const locationMatch = content.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i)
        if (locationMatch) {
          return locationMatch[1]
        }
      }

      // Check for visible links that look like redirect URLs
      const links = Array.from(document.querySelectorAll('a[href]'))
      const redirectLink = links.find(link => {
        const href = link.href || ''
        const text = (link.textContent || '').toLowerCase()
        // Skip javascript: and # links
        if (href.startsWith('javascript:') || href.startsWith('#')) {
          return false
        }
        // Look for links with "redirect", "continue", or pointing to external domains
        return text.includes('continue') ||
               text.includes('click here') ||
               href.includes('redirect') ||
               href.includes('forward')
      })

      return redirectLink ? redirectLink.href : null
    }).catch(() => null)

    if (redirectUrl && redirectUrl.startsWith('http')) {
      console.log(`[auto-navigate] Found redirect URL: ${redirectUrl}`)
      await page.goto(redirectUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {})
      return true
    }

    // Method 4: Trigger common JavaScript redirect functions
    const jsTriggered = await page.evaluate(() => {
      try {
        // Try calling common redirect functions if they exist
        if (typeof window.redirectToOffer === 'function') {
          window.redirectToOffer()
          return true
        }
        if (typeof window.continueToOffer === 'function') {
          window.continueToOffer()
          return true
        }
        if (typeof window.proceedToDestination === 'function') {
          window.proceedToDestination()
          return true
        }
      } catch (e) {
        return false
      }
      return false
    }).catch(() => false)

    if (jsTriggered) {
      console.log('[auto-navigate] Triggered JavaScript redirect function')
      return true
    }

    console.log('[auto-navigate] No navigation method found')
    return false

  } catch (error) {
    console.log(`[auto-navigate] Error attempting navigation: ${error.message}`)
    return false
  }
}

async function detectIntermediatePage(page, originalURL) {
  try {
    const [title, content, currentURL] = await Promise.all([
      page.title().catch(() => ''),
      page.content().catch(() => ''),
      page.url()
    ])

    const urlDomain = new URL(currentURL).hostname.replace(/^www\./, '')
    const originalDomain = new URL(originalURL).hostname.replace(/^www\./, '')
    const urlPath = new URL(currentURL).pathname

    // Extract page features for pattern matching
    const pageFeatures = {
      domain: urlDomain,
      url: currentURL,
      title,
      content,
      urlPath
    }

    // Use PatternMatcher for detection
    const detection = await patternMatcher.detectIntermediatePage(pageFeatures)

    // Check if expired/suspended page (final error page)
    if (detection.isExpired) {
      console.log(`[intermediate] Detected expired/suspended offer page (final error page): ${currentURL}`)
      return { isIntermediate: false, expectedWaitTime: 0 }  // This is a final page (expired offer), not an intermediate page
    }

    // Check if intermediate page
    if (detection.isIntermediate) {
      const waitTime = detection.expectedWaitTime || 8000 // Default to 8 seconds if not specified
      console.log(`[intermediate] Detected intermediate page: ${urlDomain} (reason: ${detection.reason}, confidence: ${detection.confidence}, waitTime: ${waitTime}ms)`)

      return { isIntermediate: true, expectedWaitTime: waitTime }
    }

    // Additional fallback checks for affiliate networks not in pattern library
    // Check if still on known affiliate network domain (backward compatibility)
    for (const networkDomain of AFFILIATE_NETWORK_DOMAINS) {
      if (urlDomain.includes(networkDomain)) {
        console.log(`[intermediate] Still on affiliate network domain: ${urlDomain}`)
        return { isIntermediate: true, expectedWaitTime: 8000 }  // FAILED: Stuck on affiliate network, not on actual landing page
      }
    }

    // Check if same domain as original and original was an affiliate network
    if (urlDomain === originalDomain && AFFILIATE_NETWORK_DOMAINS.some(d => originalDomain.includes(d))) {
      console.log(`[intermediate] No redirect happened from affiliate network: ${urlDomain}`)
      return { isIntermediate: true, expectedWaitTime: 8000 }  // FAILED: No redirect happened from affiliate network
    }

    console.log(`[intermediate] Not intermediate: ${urlDomain} (confidence: ${detection.confidence})`)
    return { isIntermediate: false, expectedWaitTime: 0 }
  } catch (error) {
    console.error(`[intermediate] Error during detection:`, error.message)
    // On error, assume it's not intermediate (fail open)
    return { isIntermediate: false, expectedWaitTime: 0 }
  }
}

// Unified visit internal function (single attempt)
async function unifiedVisitInternalSingleAttempt(body = {}, selectedProxy = null) {
  const { url, targetCountry = 'US', refererStrategy, customReferer, proxyProviderURL, proxyPoolSize = 10, advancedOptions = {} } = body || {}

  if (!url) return { success: false, error: { type: 'invalid_url', message: 'url required' } }

  // Use unified config - can be overridden with advancedOptions
  const config = { ...UNIFIED_VISIT_CONFIG, ...advancedOptions }
  const result = { success: false, metadata: {}, timings: {}, result: null, error: null }
  const t0 = Date.now()

  let proxyServer = null

  try {
    // Select proxy - Use UnifiedProxyClient for centralized proxy management
    let proxyOpt = undefined
    let poolInfo = null
    if (proxyProviderURL) {
      try {
        // Use provided proxy or get new one from Unified Proxy Manager
        if (selectedProxy) {
          proxyServer = selectedProxy
          proxyOpt = toPlaywrightProxy(selectedProxy)
          console.log(`[proxy] Using provided proxy: ${selectedProxy.split(':')[0]}`)
        } else {
          // Use global proxyClient (supports Redis or HTTP mode)
          const useUnified = process.env.USE_UNIFIED_PROXY !== 'false'
          const activeClient = useUnified ? proxyClient : smartProxyPool

          console.log(`[proxy] Using ${useUnified ? (USE_REDIS_PROXY ? 'redis-direct' : 'http-api') : 'legacy'} proxy client`)

          const { proxy, poolInfo: info } = await activeClient.getProxy(proxyProviderURL, url, proxyPoolSize)
          if (proxy) {
            proxyOpt = toPlaywrightProxy(proxy)
            proxyServer = proxy
            poolInfo = info
            console.log(`[proxy] Selected proxy: ${proxy.split(':')[0]}`)
          }
        }
      } catch (err) {
        console.error('[proxy] Selection failed:', err.message)
      }
    }

    // Validate proxy is required for all modes now
    if (config.requireProxy && !proxyOpt) {
      result.error = { type: 'proxy_required', message: 'Proxy is required for this mode but not available' }
      result.timings.totalMs = Date.now() - t0
      return result
    }

    result.metadata.proxyUsed = !!proxyOpt
    if (proxyServer) result.metadata.proxyServer = proxyServer
    if (poolInfo) result.metadata.proxyPoolInfo = poolInfo

    // Select referer
    const referer = selectRefererByStrategy(refererStrategy || config.referer, customReferer)
    result.metadata.referer = referer

    // Get browser context
    const userAgent = process.env.SIMILARWEB_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    result.metadata.userAgent = userAgent

    let h
    try { h = await pool.getContext({ proxy: proxyOpt, fingerprint: { userAgent } }) } catch (e) {
      if (String(e).includes('capacity_exhausted')) capExhausted.inc()
      return { ...result, error: { type: 'capacity', message: String(e?.message || e) } }
    }

    const page = await h.context.newPage()
    // Track new pages/popups opened during navigation
    let targetPage = page
    const newPages = []

    try {
      h.context.on('page', async (newPage) => {
        console.log(`[popup] New page opened: ${newPage.url()}`)
        newPages.push(newPage)

        // If new page is not verification page, switch to it
        const url = newPage.url()
        if (!url.includes('chromewebdata') &&
            !url.includes('verification') &&
            !url.includes('about:blank') &&
            url.startsWith('http')) {
          console.log(`[popup] Switching to new page: ${url}`)
          targetPage = newPage
        }
      })

      // Resource blocking
      if (config.resourceBlock && config.resourceBlock.length > 0) {
        await page.route('**/*', route => {
          const type = route.request().resourceType()
          if (config.resourceBlock.includes('*') || config.resourceBlock.includes(type)) {
            route.abort()
          } else {
            route.continue()
          }
        })
      }

      // Set referer
      if (referer) {
        await page.setExtraHTTPHeaders({ 'Referer': referer })
      }

      // Navigate
      const navStart = Date.now()
      const resp = await page.goto(url, { timeout: config.timeout, waitUntil: config.waitUntil })
      result.timings.navigationMs = Date.now() - navStart
      const statusCode = resp?.status() || 0

      // Anti-bot check and handling
      if (config.enableAntiBot) {
        const antiBotResult = await quickAntiBotCheck(page)
        result.result = { antiDetectionResult: antiBotResult }

        // If Cloudflare detected, don't fail immediately - wait for auto-solve
        if (!antiBotResult.passed && antiBotResult.blockedBy === 'cloudflare') {
          console.log('[cloudflare] Cloudflare challenge detected, waiting for auto-solve...')

          // Wait up to 20 seconds for Cloudflare challenge to auto-solve
          const cfStart = Date.now()
          const cfMaxWait = 20000
          let urlBeforeWait = page.url()

          while (Date.now() - cfStart < cfMaxWait) {
            await new Promise(r => setTimeout(r, 1000)) // Check every 1 second

            const urlNow = page.url()
            if (urlNow !== urlBeforeWait) {
              console.log(`[cloudflare] URL changed from ${new URL(urlBeforeWait).hostname} to ${new URL(urlNow).hostname}`)
              urlBeforeWait = urlNow

              // Check if still on Cloudflare challenge page
              const recheckResult = await quickAntiBotCheck(page)
              if (recheckResult.passed) {
                console.log('[cloudflare] Challenge passed! Continuing...')
                result.result.antiDetectionResult = { passed: true, solvedCloudflare: true }
                break
              }
            }

            // Check page content for challenge completion without URL change
            const cfStatus = await page.evaluate(() => {
              const bodyText = document.body?.textContent || ''
              const html = document.documentElement?.innerHTML || ''

              // Still showing challenge
              if (bodyText.includes('Checking your browser') ||
                  bodyText.includes('Just a moment') ||
                  html.includes('cf-browser-verification')) {
                return 'challenge'
              }

              // Challenge appears to be complete
              return 'complete'
            }).catch(() => 'unknown')

            if (cfStatus === 'complete') {
              console.log('[cloudflare] Challenge appears complete (no redirect yet)')
              // Wait a bit more for redirect
              await new Promise(r => setTimeout(r, 3000))

              // Recheck
              const finalCheck = await quickAntiBotCheck(page)
              if (finalCheck.passed) {
                console.log('[cloudflare] Challenge confirmed passed!')
                result.result.antiDetectionResult = { passed: true, solvedCloudflare: true }
                break
              }
            }
          }

          // Final check after waiting
          const finalAntiBotResult = await quickAntiBotCheck(page)
          if (!finalAntiBotResult.passed) {
            console.log('[cloudflare] Challenge not solved after 20s, failing')
            result.error = { type: 'antibot', message: `Blocked by ${finalAntiBotResult.blockedBy}`, fastFailed: false, waitedMs: Date.now() - cfStart }
            result.result.antiDetectionResult = finalAntiBotResult
            return result
          } else {
            console.log('[cloudflare] Challenge solved successfully!')
            result.result.antiDetectionResult = { passed: true, solvedCloudflare: true, solveTimeMs: Date.now() - cfStart }
          }
        } else if (!antiBotResult.passed) {
          // Non-Cloudflare antibot detection - fail immediately
          result.error = { type: 'antibot', message: `Blocked by ${antiBotResult.blockedBy}`, fastFailed: true }
          result.result = { antiDetectionResult: antiBotResult }
          return result
        }
      }

      // URL stabilization with redirect detection
      if (config.stabilizeMs > 0) {
        const stabilizeStart = Date.now()
        let current = page.url()
        let stableSince = Date.now()
        const maxWait = Math.max(config.stabilizeMs, 25000) // Increase to 25 seconds for intermediate/verification pages
        const minStableTime = 12000 // Increase to 12 seconds for verification pages with countdown redirects
        let redirectCount = 0
        let lastRedirectTime = Date.now()

        // Monitor for navigation events (JavaScript redirects)
        const navigationPromise = new Promise((resolve) => {
          page.on('framenavigated', () => {
            lastRedirectTime = Date.now()
          })
          setTimeout(resolve, maxWait)
        })

        while (Date.now() - stabilizeStart < maxWait) {
          await new Promise(r => setTimeout(r, 500)) // Check every 500ms
          const now = page.url()

          if (now !== current) {
            // URL changed - redirect detected
            redirectCount++
            current = now
            stableSince = Date.now()
            lastRedirectTime = Date.now()

            console.log(`[stabilize] URL changed to: ${new URL(now).hostname}`)

            // Check if we left affiliate network domain
            const currentDomain = new URL(now).hostname
            const isStillOnAffiliateNetwork = AFFILIATE_NETWORK_DOMAINS.some(d => currentDomain.includes(d))

            if (!isStillOnAffiliateNetwork) {
              // Successfully redirected away from affiliate network
              // Wait extra time for JavaScript redirects
              console.log(`[stabilize] Left affiliate network, waiting for JavaScript redirects...`)
              await new Promise(r => setTimeout(r, 3000))

              // Check if URL changed again during wait
              if (page.url() !== now) {
                console.log(`[stabilize] Additional redirect detected after leaving network`)
                continue
              }

              // Don't break immediately - need to check if this is an intermediate page or final landing page
              // Reset stable time to trigger intermediate page check
              stableSince = Date.now() - (minStableTime - 1000) // Set to almost stable (1 second before threshold)
            }
          }

          // Check for meta refresh or JavaScript redirects
          const hasMetaRefresh = await page.evaluate(() => {
            const metaRefresh = document.querySelector('meta[http-equiv="refresh"]')
            return !!metaRefresh
          }).catch(() => false)

          if (hasMetaRefresh) {
            console.log(`[stabilize] Meta refresh detected, continuing to wait...`)
            stableSince = Date.now()
          }

          // If URL stable for a while, check if we're truly on final page
          const stableTime = Date.now() - stableSince

          if (stableTime >= minStableTime) {
            const currentDomain = new URL(current).hostname
            const isOnAffiliateNetwork = AFFILIATE_NETWORK_DOMAINS.some(d => currentDomain.includes(d))

            if (!isOnAffiliateNetwork) {
              // Check if this is truly a landing page or an intermediate page
              const detection = await detectIntermediatePage(page, current)

              if (!detection.isIntermediate) {
                console.log(`[stabilize] Reached final landing page: ${currentDomain}`)
                break
              } else {
                console.log(`[stabilize] Still on intermediate page: ${currentDomain}, expected wait: ${detection.expectedWaitTime}ms`)

                // Check if page has meta refresh or will auto-redirect
                const hasAutoRedirect = await page.evaluate(() => {
                  // Check for meta refresh
                  const metaRefresh = document.querySelector('meta[http-equiv="refresh"]')
                  if (metaRefresh) return true

                  // Check for setTimeout/setInterval redirects in scripts
                  const scripts = Array.from(document.querySelectorAll('script'))
                  for (const script of scripts) {
                    const content = script.textContent || ''
                    // Check if script contains timer functions (setTimeout/setInterval) AND location changes
                    const hasTimer = content.includes('setTimeout') || content.includes('setInterval')
                    const hasLocationChange = content.includes('window.location') || content.includes('.location.href') || content.includes('.location.replace')
                    if (hasTimer && hasLocationChange) return true
                    // Also check for direct window.location assignment
                    if (content.includes('window.location=') || content.includes('window.location =')) return true
                  }

                  // Check for countdown/timer elements that indicate automatic redirect
                  const hasCountdown = !!document.querySelector('[id*="count"], [class*="countdown"], [class*="redirect"]')
                  if (hasCountdown) {
                    // Additional check: see if page contains text suggesting auto-redirect
                    const bodyText = document.body?.textContent || ''
                    if (bodyText.toLowerCase().includes('redirect') && bodyText.toLowerCase().includes('second')) {
                      return true
                    }
                  }

                  return false
                }).catch(() => false)

                if (hasAutoRedirect) {
                  // Use pattern library's expectedWaitTime if available, otherwise try to extract countdown
                  let waitTime = detection.expectedWaitTime

                  if (!waitTime || waitTime === 8000) {
                    // Fallback: try to extract countdown seconds for adaptive waiting
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
                      waitTime = (countdownSeconds + 1) * 1000
                      console.log(`[stabilize] Extracted countdown: ${countdownSeconds}s`)
                    }
                  }

                  console.log(`[stabilize] Waiting ${waitTime}ms for auto-redirect...`)
                  await new Promise(r => setTimeout(r, waitTime))
                  // Don't reset stableSince - let it proceed to check if redirect happened
                } else {
                  // No auto-redirect, try manual interaction
                  console.log(`[stabilize] No auto-redirect found, attempting manual interaction...`)
                  const triggered = await attemptIntermediatePageNavigation(page)

                  if (triggered) {
                    console.log(`[stabilize] Successfully triggered navigation from intermediate page`)
                    // Reset stable time and last redirect time to continue monitoring
                    stableSince = Date.now()
                    lastRedirectTime = Date.now()
                    // Wait longer for the navigation to complete (especially for verification pages)
                    await new Promise(r => setTimeout(r, 8000))
                  } else {
                    console.log(`[stabilize] No navigation trigger found, continuing to wait...`)
                    // Reset stable time to wait more
                    stableSince = Date.now()
                  }
                }
              }
            } else {
              // Still on affiliate network, wait more
              console.log(`[stabilize] Still on affiliate network: ${currentDomain}`)
              stableSince = Date.now()
            }
          }

          // If no activity for 8 seconds and not on affiliate network, likely done
          if (Date.now() - lastRedirectTime > 8000) {
            const currentDomain = new URL(current).hostname
            const isOnAffiliateNetwork = AFFILIATE_NETWORK_DOMAINS.some(d => currentDomain.includes(d))
            if (!isOnAffiliateNetwork) {
              console.log(`[stabilize] No activity for 8s, assuming complete`)
              break
            }
          }
        }

        result.timings.stabilizationMs = Date.now() - stabilizeStart
        result.timings.redirectCount = redirectCount
        console.log(`[stabilize] Stabilization complete: ${redirectCount} redirects, ${result.timings.stabilizationMs}ms`)

        // If we have new pages, use the target page
        if (newPages.length > 0) {
          console.log(`[stabilize] ${newPages.length} popup(s) detected, using targetPage: ${targetPage.url()}`)
        }
      }

      // Use targetPage for extraction (might be a popup)
      const extractPage = targetPage || page

      // Extract data with fallback
      let finalHref = await extractPage.evaluate(() => {
        try {
          // Check if we're in an iframe
          if (window.self !== window.top) {
            console.log('[extract] Detected iframe, getting parent URL')
            return window.top.location.href
          }
          return window.location && window.location.href
        } catch (e) {
          // Cross-origin iframe - cannot access parent
          console.log('[extract] Cross-origin iframe detected')
          return null
        }
      }).catch(() => null)

      // Fallback to page.url() if evaluation fails or returns null
      if (!finalHref || finalHref === 'null' || finalHref.includes('chromewebdata')) {
        // Try to get main frame URL if we're stuck on verification page
        const frames = extractPage.frames()
        console.log(`[extract] Found ${frames.length} frames`)

        for (const frame of frames) {
          const frameUrl = frame.url()
          console.log(`[extract] Frame URL: ${frameUrl}`)

          // Skip chromewebdata and verification pages
          if (!frameUrl.includes('chromewebdata') &&
              !frameUrl.includes('verification') &&
              !frameUrl.includes('about:blank') &&
              frameUrl.startsWith('http')) {
            finalHref = frameUrl
            console.log(`[extract] Using frame URL: ${finalHref}`)
            break
          }
        }

        // Last resort: use extractPage.url()
        if (!finalHref || finalHref === 'null' || finalHref.includes('chromewebdata')) {
          finalHref = extractPage.url()
          console.log(`[extract] Using extractPage.url() as last resort: ${finalHref}`)
        }
      }

      const u = new URL(finalHref)
      const finalUrl = `${u.origin}${u.pathname}`
      const finalUrlSuffix = (u.search || '').replace(/^\?/, '')
      const domain = u.hostname.replace(/^www\./, '')

      result.result = {
        ...result.result,
        statusCode,
        finalUrl,
        finalUrlSuffix,
        domain
      }

      // Brand extraction (always enabled with unified config)
      if (config.requireBrandExtraction) {
        const title = await extractPage.title().catch(() => '')
        const brandName = title.split('|')[0].split('-')[0].trim() || domain.split('.')[0]
        result.result.brandName = brandName.charAt(0).toUpperCase() + brandName.slice(1)

        // Enhanced check: detect if reached actual landing page vs intermediate page
        const isIntermediatePage = await detectIntermediatePage(extractPage, url)
        const available = (statusCode >= 200 && statusCode < 400) && !isIntermediatePage.isIntermediate

        // DEBUG: Log extraction results
        console.log(`[brand-extract] domain="${domain}", brandName="${brandName}", title="${title}", isIntermediate=${isIntermediatePage.isIntermediate}, statusCode=${statusCode}`)

        // Brand extraction MUST succeed
        if (!domain || !brandName || isIntermediatePage.isIntermediate) {
          result.success = false
          result.result.available = false
          result.result.method = 'browser'
          result.result.isIntermediatePage = isIntermediatePage
          result.result.statusCode = statusCode
          result.result.failureReason = isIntermediatePage.isIntermediate ? 'stuck_at_intermediate_page' : 'brand_extraction_failed'
          console.log(`[brand-extract] FAILED: failureReason=${result.result.failureReason}`)
        } else {
          result.result.available = available
          result.result.method = 'browser'
          result.result.isIntermediatePage = isIntermediatePage
          result.result.statusCode = statusCode

          if (!available && isIntermediatePage.isIntermediate) {
            result.result.failureReason = 'stuck_at_intermediate_page'
          } else if (!available) {
            result.result.failureReason = statusCode >= 400 ? `http_error_${statusCode}` : 'unknown'
          }
          console.log(`[brand-extract] SUCCESS: available=${available}, brandName=${result.result.brandName}`)
        }
      }

      // Redirect chain
      const chain = []
      try {
        let reqObj = resp?.request?.(); if (typeof reqObj === 'function') reqObj = resp.request()
        let cur = reqObj
        while (cur) { chain.push({ url: cur.url(), timestamp: new Date().toISOString() }); cur = cur.redirectedFrom?.() }
        chain.reverse()
      } catch {}
      result.result.redirectChain = chain

      // Dwell time (if configured)
      if (config.dwellMs) {
        await new Promise(r => setTimeout(r, config.dwellMs))
      }

      result.success = true
      result.timings.totalMs = Date.now() - t0

      // Record proxy success feedback
      if (proxyServer) {
        recordProxyFeedback(proxyServer, true, result.timings.totalMs)

        // Release proxy back to unified manager if using it
        const useUnified = process.env.USE_UNIFIED_PROXY !== 'false'
        if (useUnified && !selectedProxy) {
          await proxyClient.releaseProxy(proxyServer, true, result.timings.totalMs)
        }
      }

      return result

    } finally {
      // Close all pages
      try { await page.close() } catch {}
      for (const p of newPages) {
        try { await p.close() } catch {}
      }
      await pool.release(h)
    }

  } catch (e) {
    const msg = String(e?.message || e)

    // Record proxy failure feedback
    if (proxyServer) {
      const errorType = /timeout/i.test(msg) ? 'timeout' : /network/i.test(msg) ? 'network' : 'unknown'
      recordProxyFeedback(proxyServer, false, null, errorType)

      // Release proxy back to unified manager if using it (mark as failed)
      const useUnified = process.env.USE_UNIFIED_PROXY !== 'false'
      if (useUnified && !selectedProxy) {
        await proxyClient.releaseProxy(proxyServer, false)
      }
    }
    result.error = {
      type: /Timeout/i.test(msg) ? 'timeout' : /net::ERR/i.test(msg) ? 'network' : 'unknown',
      message: msg,
      fastFailed: true
    }
    result.timings.totalMs = Date.now() - t0
    return result
  }
}

// Unified visit internal function with failover (wrapper)
async function unifiedVisitInternal(body = {}) {
  const { maxRetries = 3, proxyProviderURL } = body || {}

  // If no proxy provider or retries disabled, use single attempt
  if (!proxyProviderURL || maxRetries <= 1) {
    return await unifiedVisitInternalSingleAttempt(body)
  }

  let lastError = null
  let attempts = []

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[failover] Attempt ${attempt}/${maxRetries} for ${body.url}`)

      const result = await unifiedVisitInternalSingleAttempt(body)

      // Success
      if (result.success) {
        result.metadata.attempts = attempts.concat([{
          attempt,
          success: true,
          proxy: result.metadata.proxyServer?.split(':')[0],
          duration: result.timings.totalMs
        }])
        result.metadata.totalAttempts = attempt
        return result
      }

      // Failed but got result
      lastError = result.error
      attempts.push({
        attempt,
        success: false,
        proxy: result.metadata.proxyServer?.split(':')[0],
        error: result.error?.type,
        duration: result.timings.totalMs
      })

      // Don't retry on certain errors
      if (result.error?.type === 'invalid_url' || result.error?.type === 'invalid_mode') {
        console.log(`[failover] Non-retryable error, stopping`)
        result.metadata.attempts = attempts
        result.metadata.totalAttempts = attempt
        return result
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        console.log(`[failover] Waiting ${delay}ms before retry...`)
        await new Promise(r => setTimeout(r, delay))
      }

    } catch (error) {
      lastError = { type: 'unknown', message: error.message }
      attempts.push({
        attempt,
        success: false,
        error: 'exception',
        message: error.message
      })

      console.error(`[failover] Attempt ${attempt} exception:`, error.message)
    }
  }

  // All attempts failed
  console.error(`[failover] All ${maxRetries} attempts failed for ${body.url}`)

  return {
    success: false,
    metadata: {
      attempts,
      totalAttempts: maxRetries
    },
    timings: {
      totalMs: attempts.reduce((sum, a) => sum + (a.duration || 0), 0)
    },
    result: null,
    error: {
      type: 'all_attempts_failed',
      message: `All ${maxRetries} attempts failed. Last error: ${lastError?.message || 'unknown'}`,
      attempts
    }
  }
}
