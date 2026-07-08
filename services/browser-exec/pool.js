import playwright from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

const USE_PW = String(process.env.PLAYWRIGHT || '').toLowerCase() === '1'

// Enable stealth plugin for Playwright
if (USE_PW) {
  try {
    playwright.chromium.use(StealthPlugin())
    console.log('[stealth] Stealth plugin enabled successfully')
  } catch (err) {
    console.warn('[stealth] Failed to enable stealth plugin:', err.message)
  }
}

let MAX_CONTEXTS = Number(process.env.BROWSER_MAX_CONTEXTS || 12)
let MAX_MEMORY_MB = Number(process.env.BROWSER_MAX_MEMORY_MB || 1024)
let MAX_POOLS = Number(process.env.BROWSER_MAX_POOLS || 16)
let POOL_IDLE_TTL_MS = Number(process.env.BROWSER_POOL_IDLE_TTL_MS || 60_000)
let POOL_MIN_WARM = Number(process.env.BROWSER_POOL_MIN_WARM || 1)

function buildContextOptions(fp = {}) {
  const {
    locale = 'en-US',
    timezoneId = 'UTC',
    viewport = { width: 1366, height: 768 },
    geolocation,
    colorScheme = 'light',
    userAgent,
  } = fp
  const uaList = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  ]
  const ua = userAgent || uaList[Math.floor(Math.random() * uaList.length)]
  return { locale, timezoneId, userAgent: ua, viewport, geolocation, permissions: geolocation ? ['geolocation'] : [], colorScheme }
}

class ContextPool {
  constructor(maxSize = 10) {
    this.pool = []
    this.maxSize = maxSize
    this.createdAt = Date.now()
  }

  async acquire(browser, fingerprint) {
    if (this.pool.length > 0) {
      const ctx = this.pool.pop()
      await this._cleanupContext(ctx)
      return ctx
    }
    return await browser.newContext(buildContextOptions(fingerprint))
  }

  async release(context) {
    if (this.pool.length < this.maxSize) {
      await this._cleanupContext(context)
      this.pool.push(context)
    } else {
      await context.close()
    }
  }

  async _cleanupContext(ctx) {
    try {
      // Close all pages
      const pages = await ctx.pages()
      for (const page of pages) {
        await page.close()
      }
      // Clear cookies and permissions
      await ctx.clearCookies()
      await ctx.clearPermissions()
    } catch (err) {
      console.warn('[context-pool] Error cleaning up context:', err.message)
    }
  }

  stats() {
    return {
      size: this.pool.length,
      maxSize: this.maxSize,
      ageMs: Date.now() - this.createdAt
    }
  }
}

class BrowserPool {
  constructor() {
    this.pools = new Map() // key -> { browser, contextPool, createdAt, lastUsed, proxy, warm }
  }
  _keyFrom({ proxy, poolKey } = {}) {
    if (poolKey) return String(poolKey)
    if (proxy && proxy.server) return `proxy:${proxy.server}`
    return 'direct'
  }
  async _ensurePool(key, launchOpts) {
    let p = this.pools.get(key)
    if (p && p.browser && p.browser.isConnected()) return p
    // enforce max pools
    if (this.pools.size >= MAX_POOLS) {
      // LRU eviction of idle pools (sharedContexts==0)
      let evictKey = null
      let oldest = Infinity
      for (const [k, v] of this.pools) {
        if ((v.sharedContexts|0) === 0 && v.lastUsed && v.lastUsed < oldest) { oldest = v.lastUsed; evictKey = k }
      }
      if (evictKey) {
        try { await this.pools.get(evictKey)?.browser?.close?.() } catch {}
        this.pools.delete(evictKey)
      }
    }
    const browser = await playwright.chromium.launch(launchOpts)
    const contextPool = new ContextPool(Math.floor(MAX_CONTEXTS / 2)) // Reserve half for ephemeral
    p = { browser, contextPool, sharedContexts: 0, createdAt: Date.now(), lastUsed: Date.now(), proxy: launchOpts.proxy || null, warm: true }
    this.pools.set(key, p)
    return p
  }
  async getContext({ fingerprint, proxy, poolKey } = {}) {
    if (!USE_PW) throw new Error('playwright disabled')
    // capacity guard: memory
    const rssMb = (process.memoryUsage().rss / (1024*1024)) | 0
    if (rssMb >= MAX_MEMORY_MB) throw new Error('capacity_exhausted:memory')

    // Enhanced launch options to avoid detection (including Cloudflare)
    const launchOpts = {
      headless: true,
      args: [
        // Core automation hiding
        '--disable-blink-features=AutomationControlled',
        '--exclude-switches=enable-automation',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',

        // Performance and resource optimization
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',

        // UI optimization
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-infobars',
        '--window-position=200,100',
        '--window-size=1366,768',

        // Network and timing
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',

        // TLS/SSL fingerprint masking (critical for Cloudflare)
        '--disable-features=NetworkService',
        '--enable-features=NetworkServiceInProcess',

        // Additional Cloudflare bypass measures
        '--disable-blink-features=AutomationControlled',
        '--disable-features=UserAgentClientHint',
        '--enable-features=NetworkServiceInProcess',
        '--disable-web-security', // May help with some checks
        '--allow-running-insecure-content',

        // Canvas/WebGL fingerprint (Cloudflare checks these)
        '--use-gl=swiftshader', // Software GL rendering to avoid GPU fingerprinting
        '--disable-accelerated-2d-canvas',
        '--disable-accelerated-video-decode',

        // Audio context fingerprinting
        '--disable-features=AudioServiceAudioStreams',

        // Additional stealth
        '--disable-notifications',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
        '--disable-sync',
        '--metrics-recording-only',
        '--disable-breakpad',

        // Language and locale
        '--lang=en-US',

        // User agent override at launch level
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    }

    const key = this._keyFrom({ proxy, poolKey })
    if (proxy && proxy.server) launchOpts.proxy = proxy
    // ensure pool exists and warmed
    let pool = this.pools.get(key)
    if (!pool || !pool.browser || !pool.browser.isConnected()) {
      pool = await this._ensurePool(key, launchOpts)
    }
    if (pool.sharedContexts >= MAX_CONTEXTS) throw new Error('capacity_exhausted:contexts')

    // Try to get context from pool first
    const ctx = await pool.contextPool.acquire(pool.browser, fingerprint)
    await ctx.addInitScript(this._patch)
    pool.sharedContexts++
    pool.lastUsed = Date.now()
    return { browser: pool.browser, context: ctx, isEphemeral: false, poolKey: key }
  }
  async release({ browser, context, isEphemeral, poolKey }) {
    if (isEphemeral) {
      try { await context.close() } catch {}
      try { await browser.close() } catch {}
    } else if (poolKey && this.pools.has(poolKey)) {
      const p = this.pools.get(poolKey)
      // Return context to pool instead of closing it
      await p.contextPool.release(context)
      p.sharedContexts = Math.max(0, (p.sharedContexts|0) - 1)
      p.lastUsed = Date.now()
    } else {
      try { await context.close() } catch {}
    }
  }

  // Get detailed statistics for monitoring
  stats() {
    const poolStats = {}
    let totalContextsPooled = 0

    for (const [key, pool] of this.pools) {
      const contextPoolStats = pool.contextPool ? pool.contextPool.stats() : { size: 0, maxSize: 0, ageMs: 0 }
      totalContextsPooled += contextPoolStats.size

      poolStats[key] = {
        sharedContexts: pool.sharedContexts | 0,
        createdAt: pool.createdAt,
        lastUsed: pool.lastUsed,
        proxy: pool.proxy,
        warm: pool.warm,
        connected: pool.browser?.isConnected() || false,
        contextPool: contextPoolStats
      }
    }

    return {
      pools: this.pools.size,
      totalContextsPooled,
      maxContextsPerPool: Math.floor(MAX_CONTEXTS / 2),
      maxContexts: MAX_CONTEXTS,
      maxPools: MAX_POOLS,
      poolDetails: poolStats
    }
  }

  _patch() {
    // ========== Core Automation Hiding ==========

    // 1. Hide webdriver property (most critical)
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })

    // 2. Remove automation-related properties from prototype
    try {
      delete Object.getPrototypeOf(navigator).webdriver
    } catch (e) {}

    // ========== Navigator Properties ==========

    // 3. Fix navigator.languages
    if (!navigator.languages || !navigator.languages.length) {
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
    }

    // 4. Override plugins to appear non-headless (mimic real Chrome)
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const pluginArray = [
          { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
          { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
          { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
          { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
          { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 }
        ]
        Object.defineProperty(pluginArray, 'length', { get: () => pluginArray.length })
        return pluginArray
      }
    })

    // 5. Override mimeTypes
    Object.defineProperty(navigator, 'mimeTypes', {
      get: () => {
        const mimeArray = [
          { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: { name: 'PDF Viewer' } },
          { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: { name: 'PDF Viewer' } }
        ]
        Object.defineProperty(mimeArray, 'length', { get: () => mimeArray.length })
        return mimeArray
      }
    })

    // 6. Fix vendor, platform, and other properties
    Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' })
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' })
    Object.defineProperty(navigator, 'productSub', { get: () => '20030107' })
    Object.defineProperty(navigator, 'vendorSub', { get: () => '' })
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 })
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 })
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 })

    // ========== Permissions ==========

    // 7. Override permissions API
    const originalQuery = window.navigator.permissions.query
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    )

    // ========== Chrome Runtime ==========

    // 8. Override chrome runtime (critical for anti-bot detection)
    if (!window.chrome) {
      window.chrome = {}
    }

    // Add chrome.app
    if (!window.chrome.app) {
      window.chrome.app = {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
      }
    }

    // Add chrome.runtime
    if (!window.chrome.runtime) {
      window.chrome.runtime = {
        connect: function() { return { onMessage: { addListener: function() {}, removeListener: function() {} }, postMessage: function() {}, disconnect: function() {} } },
        sendMessage: function() {},
        onMessage: { addListener: function() {}, removeListener: function() {} },
        onConnect: { addListener: function() {}, removeListener: function() {} },
        id: undefined
      }
    }

    // Add chrome.csi (Chrome Speed Index)
    if (!window.chrome.csi) {
      window.chrome.csi = function() {
        return {
          startE: Date.now(),
          onloadT: Date.now(),
          pageT: Math.floor(Math.random() * 1000) + 1000,
          tran: 15
        }
      }
    }

    // Add chrome.loadTimes (deprecated but still checked)
    if (!window.chrome.loadTimes) {
      window.chrome.loadTimes = function() {
        return {
          requestTime: Date.now() / 1000,
          startLoadTime: Date.now() / 1000,
          commitLoadTime: Date.now() / 1000,
          finishDocumentLoadTime: Date.now() / 1000,
          finishLoadTime: Date.now() / 1000,
          firstPaintTime: Date.now() / 1000,
          firstPaintAfterLoadTime: 0,
          navigationType: 'Other',
          wasFetchedViaSpdy: false,
          wasNpnNegotiated: true,
          npnNegotiatedProtocol: 'h2',
          wasAlternateProtocolAvailable: false,
          connectionInfo: 'h2'
        }
      }
    }

    // ========== CDP Detection ==========

    // 9. Hide CDP (Chrome DevTools Protocol) runtime variables
    const cdcProps = [
      'cdc_adoQpoasnfa76pfcZLmcfl_Array',
      'cdc_adoQpoasnfa76pfcZLmcfl_Promise',
      'cdc_adoQpoasnfa76pfcZLmcfl_Symbol',
      'cdc_adoQpoasnfa76pfcZLmcfl_Object',
      'cdc_adoQpoasnfa76pfcZLmcfl_JSON',
      'cdc_adoQpoasnfa76pfcZLmcfl_Proxy'
    ]
    cdcProps.forEach(prop => {
      if (window[prop]) delete window[prop]
    })

    // ========== Window Properties ==========

    // 10. Override window.chrome to be non-configurable
    Object.defineProperty(window, 'chrome', {
      value: window.chrome,
      writable: true,
      configurable: false
    })

    // 11. Fix window screen properties
    if (window.screenX === 0 && window.screenY === 0) {
      Object.defineProperty(window, 'screenX', { get: () => Math.floor(Math.random() * 100) + 100 })
      Object.defineProperty(window, 'screenY', { get: () => Math.floor(Math.random() * 100) + 100 })
    }

    if (window.outerWidth === 0) {
      Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth })
      Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 74 })
    }

    // ========== Error Stack Traces ==========

    // 12. Override Error.stackTraceLimit
    if (Error.stackTraceLimit !== 10) {
      Error.stackTraceLimit = 10
    }

    // ========== Console ==========

    // 13. Override console.debug to hide automation detection attempts
    const originalDebug = console.debug
    console.debug = function() {
      const arg0 = arguments[0]
      if (arg0 && typeof arg0 === 'string') {
        if (arg0.includes('devtools') || arg0.includes('puppeteer') || arg0.includes('playwright')) {
          return
        }
      }
      return originalDebug.apply(console, arguments)
    }

    // ========== Media Devices ==========

    // 14. Mock media devices to appear real
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      const origEnumerate = navigator.mediaDevices.enumerateDevices
      navigator.mediaDevices.enumerateDevices = async function() {
        const devices = await origEnumerate.call(navigator.mediaDevices)
        if (devices.length === 0) {
          return [
            { deviceId: 'default', kind: 'audioinput', label: '', groupId: 'default' },
            { deviceId: 'default', kind: 'audiooutput', label: '', groupId: 'default' },
            { deviceId: 'default', kind: 'videoinput', label: '', groupId: 'default' }
          ]
        }
        return devices
      }
    }

    // ========== Connection ==========

    // 15. Override connection properties
    if (navigator.connection && !navigator.connection.rtt) {
      Object.defineProperty(navigator.connection, 'rtt', { get: () => 50 + Math.floor(Math.random() * 50) })
    }

    // ========== Battery API ==========

    // 16. Mock battery to appear real (headless often has no battery info)
    if (navigator.getBattery) {
      const originalGetBattery = navigator.getBattery
      navigator.getBattery = async function() {
        try {
          return await originalGetBattery.call(navigator)
        } catch {
          return {
            charging: true,
            chargingTime: 0,
            dischargingTime: Infinity,
            level: 1.0,
            addEventListener: function() {},
            removeEventListener: function() {},
            dispatchEvent: function() { return true }
          }
        }
      }
    }

    // ========== Canvas Fingerprinting (CRITICAL for Cloudflare) ==========

    // 17. Canvas fingerprint noise injection
    const canvasProto = HTMLCanvasElement.prototype
    const originalToDataURL = canvasProto.toDataURL
    const originalToBlob = canvasProto.toBlob
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData

    // Add subtle noise to canvas operations
    canvasProto.toDataURL = function() {
      const context = this.getContext('2d')
      if (context) {
        const imageData = context.getImageData(0, 0, this.width, this.height)
        // Add minimal noise (±1 to random pixels)
        for (let i = 0; i < imageData.data.length; i += Math.floor(Math.random() * 10) + 1) {
          imageData.data[i] = imageData.data[i] + (Math.random() > 0.5 ? 1 : -1)
        }
        context.putImageData(imageData, 0, 0)
      }
      return originalToDataURL.apply(this, arguments)
    }

    // ========== WebGL Fingerprinting (CRITICAL for Cloudflare) ==========

    // 18. WebGL parameter spoofing
    const getParameter = WebGLRenderingContext.prototype.getParameter
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      // Spoof common fingerprinting parameters
      if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
        return 'Intel Inc.'
      }
      if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
        return 'Intel Iris OpenGL Engine'
      }
      return getParameter.apply(this, arguments)
    }

    // Also for WebGL2
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const getParameter2 = WebGL2RenderingContext.prototype.getParameter
      WebGL2RenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Intel Inc.'
        if (parameter === 37446) return 'Intel Iris OpenGL Engine'
        return getParameter2.apply(this, arguments)
      }
    }

    // ========== Audio Context Fingerprinting ==========

    // 19. AudioContext fingerprint protection
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (AudioContext) {
        const originalCreateAnalyser = AudioContext.prototype.createAnalyser
        AudioContext.prototype.createAnalyser = function() {
          const analyser = originalCreateAnalyser.call(this)
          const originalGetFloatFrequencyData = analyser.getFloatFrequencyData
          analyser.getFloatFrequencyData = function(array) {
            originalGetFloatFrequencyData.call(this, array)
            // Add minimal noise
            for (let i = 0; i < array.length; i++) {
              array[i] += Math.random() * 0.0001 - 0.00005
            }
          }
          return analyser
        }
      }
    } catch (e) {}

    // ========== Screen Resolution Consistency ==========

    // 20. Ensure screen dimensions match window dimensions
    Object.defineProperty(screen, 'availWidth', { get: () => 1366 })
    Object.defineProperty(screen, 'availHeight', { get: () => 768 })
    Object.defineProperty(screen, 'width', { get: () => 1366 })
    Object.defineProperty(screen, 'height', { get: () => 768 })
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 })
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 })
  }
  async recycleIdle() {
    const now = Date.now()
    for (const [k, p] of this.pools) {
      if ((p.sharedContexts|0) === 0 && p.browser && (now - (p.lastUsed||p.createdAt)) > POOL_IDLE_TTL_MS) {
        try { await p.browser.close() } catch {}
        this.pools.delete(k)
      }
    }
  }
  stats() {
    const rssMb = (process.memoryUsage().rss / (1024*1024)) | 0
    let totalShared = 0
    const pools = []
    for (const [k, p] of this.pools) {
      totalShared += (p.sharedContexts|0)
      pools.push({ key: k, contexts: p.sharedContexts|0, createdAt: p.createdAt, lastUsed: p.lastUsed, hasBrowser: !!(p.browser && p.browser.isConnected()), proxy: !!p.proxy })
    }
    return {
      sharedContexts: totalShared,
      activePools: this.pools.size,
      hasSharedBrowser: totalShared > 0,
      maxContexts: MAX_CONTEXTS,
      memoryRssMb: rssMb,
      maxMemoryMb: MAX_MEMORY_MB,
      maxPools: MAX_POOLS,
      idleTtlMs: POOL_IDLE_TTL_MS,
      pools,
    }
  }
}

export const pool = new BrowserPool()
export { buildContextOptions }

// Allow dynamic limit updates from ops endpoint
export function setLimits({ maxContexts, maxMemoryMb, maxPools, idleTtlMs, minWarm } = {}) {
  if (Number.isFinite(maxContexts) && maxContexts > 0) {
    MAX_CONTEXTS = Math.min(64, Math.max(1, maxContexts|0))
  }
  if (Number.isFinite(maxMemoryMb) && maxMemoryMb > 128) {
    MAX_MEMORY_MB = Math.min(8192, Math.max(128, maxMemoryMb|0))
  }
  if (Number.isFinite(maxPools) && maxPools > 0) {
    MAX_POOLS = Math.min(256, Math.max(1, maxPools|0))
  }
  if (Number.isFinite(idleTtlMs) && idleTtlMs >= 0) {
    POOL_IDLE_TTL_MS = Math.min(10*60_000, Math.max(0, idleTtlMs|0))
  }
  if (Number.isFinite(minWarm) && minWarm >= 0) {
    POOL_MIN_WARM = Math.min(8, Math.max(0, minWarm|0))
  }
}

export function getLimits() {
  return { maxContexts: MAX_CONTEXTS, maxMemoryMb: MAX_MEMORY_MB, maxPools: MAX_POOLS, idleTtlMs: POOL_IDLE_TTL_MS, minWarm: POOL_MIN_WARM }
}

// background recycler
setInterval(() => { pool.recycleIdle().catch(()=>{}) }, 5000)
