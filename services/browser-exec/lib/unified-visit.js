/**
 * Unified Visit Function
 * 统一的浏览器访问入口，支持4种模式
 */

const { getModeConfig, isValidMode } = require('./visit-modes')
const { detectAntiBot } = require('./antibot-detector')
const { selectReferer } = require('./referer-strategy')
const { getProxyPool } = require('./proxy-pool')

// 错误类型分类
const ERROR_TYPES = {
  ANTIBOT_BLOCKED: 'antibot',
  TIMEOUT: 'timeout',
  NETWORK_ERROR: 'network',
  GEO_BLOCKED: 'geo_block',
  INVALID_URL: 'invalid_url',
  CAPACITY_EXHAUSTED: 'capacity',
  UNKNOWN: 'unknown'
}

/**
 * 统一访问函数
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function unifiedVisit(params, pool) {
  const {
    url,
    visitMode,
    targetCountry = 'US',
    refererStrategy = null,  // null表示使用模式默认值
    customReferer = null,
    proxyProviderURL = null,
    advancedOptions = {}
  } = params

  // 1. 验证参数
  if (!url) {
    return createErrorResponse('invalid_url', 'URL is required')
  }

  if (!isValidMode(visitMode)) {
    return createErrorResponse('invalid_mode', `Invalid visit mode: ${visitMode}`)
  }

  // 2. 加载模式配置
  const config = getModeConfig(visitMode, advancedOptions)

  // 3. 初始化结果对象
  const result = {
    success: false,
    visitMode,
    metadata: {
      targetCountry,
      referer: null,
      proxyUsed: false,
      proxyLocation: null,
      userAgent: null
    },
    timings: {
      totalMs: 0,
      navigationMs: 0,
      stabilizationMs: 0,
      antiBotCheckMs: 0
    },
    resourceStats: {
      totalRequests: 0,
      blockedRequests: 0,
      bandwidthSavedKB: 0
    },
    result: null,
    error: null
  }

  const startTime = Date.now()

  try {
    // 4. 可用性检测模式：优先尝试HEAD请求
    if (visitMode === 'check' && config.method === 'HEAD') {
      const headResult = await tryHeadRequest(url, config.timeoutMs)
      if (headResult.success || !config.fallbackToBrowser) {
        result.success = headResult.success
        result.result = {
          available: headResult.success,
          statusCode: headResult.statusCode,
          method: 'HEAD',
          responseTimeMs: Date.now() - startTime
        }
        result.timings.totalMs = Date.now() - startTime
        return result
      }
      // HEAD失败且允许降级，继续使用浏览器
    }

    // 5. 初始化代理池
    const proxyPool = getProxyPool()
    let proxy = null

    // 加载代理 (如果需要)
    if (config.enableFingerprinting && proxyProviderURL) {
      await proxyPool.loadProxiesFromProvider(targetCountry, proxyProviderURL)
      proxy = await proxyPool.selectBestProxy(targetCountry)

      if (proxy) {
        result.metadata.proxyUsed = true
        result.metadata.proxyLocation = targetCountry
      }
    }

    // 6. 选择Referer
    const finalRefererStrategy = refererStrategy || config.refererStrategy
    const referer = selectReferer(finalRefererStrategy, customReferer, targetCountry)
    result.metadata.referer = referer

    // 7. 获取浏览器上下文
    const userAgent = getRandomUserAgent()
    result.metadata.userAgent = userAgent

    const contextOptions = {
      proxy: proxy || undefined,
      fingerprint: config.enableFingerprinting ? { userAgent } : undefined
    }

    let h
    try {
      h = await pool.getContext(contextOptions)
    } catch (error) {
      if (String(error).includes('capacity_exhausted')) {
        return createErrorResponse('capacity', 'Browser pool capacity exhausted', result)
      }
      throw error
    }

    const page = await h.context.newPage()

    try {
      // 8. 设置资源阻断
      if (config.resourceBlocking && config.resourceBlocking.length > 0) {
        let blockedCount = 0
        await page.route('**/*', route => {
          const resourceType = route.request().resourceType()

          if (config.resourceBlocking.includes('*') || config.resourceBlocking.includes(resourceType)) {
            blockedCount++
            route.abort()
          } else {
            route.continue()
          }
        })

        // 更新统计
        result.resourceStats.blockedRequests = blockedCount
      }

      // 9. 设置Referer头
      if (referer) {
        await page.setExtraHTTPHeaders({ 'Referer': referer })
      }

      // 10. 导航到页面
      const navStartTime = Date.now()
      const response = await page.goto(url, {
        timeout: config.timeoutMs,
        waitUntil: config.waitUntil || 'networkidle'
      })
      const navEndTime = Date.now()
      result.timings.navigationMs = navEndTime - navStartTime

      const statusCode = response?.status() || 0

      // 11. 风控检测 (如果启用)
      if (config.enableAntiBot) {
        const antiBotStartTime = Date.now()
        const antiBotResult = await detectAntiBot(page, 200)
        result.timings.antiBotCheckMs = Date.now() - antiBotStartTime

        if (!antiBotResult.passed) {
          // 快速失败：检测到风控拦截
          if (proxy) {
            proxyPool.recordResult(proxy, false, Date.now() - startTime)
          }

          result.success = false
          result.result = {
            antiDetectionResult: antiBotResult
          }
          result.error = {
            type: 'antibot',
            message: `Blocked by ${antiBotResult.blockedBy}`,
            fastFailed: true
          }

          return result
        }

        result.result = result.result || {}
        result.result.antiDetectionResult = antiBotResult
      }

      // 12. URL稳定化等待
      if (config.stabilizeMs > 0) {
        const stabilizeStartTime = Date.now()
        let currentURL = page.url()
        let stableSince = Date.now()

        while (Date.now() - stabilizeStartTime < config.stabilizeMs) {
          await new Promise(resolve => setTimeout(resolve, 300))
          const newURL = page.url()
          if (newURL !== currentURL) {
            currentURL = newURL
            stableSince = Date.now()
          }
        }

        result.timings.stabilizationMs = Date.now() - stabilizeStartTime
      }

      // 13. 提取数据 (根据模式)
      const extractedData = await extractDataByMode(page, visitMode, config, response)
      result.result = { ...result.result, ...extractedData }

      // 14. 人类行为模拟 (仅click模式)
      if (visitMode === 'click' && config.humanBehavior?.enableScrolling) {
        await simulateHumanBehavior(page, config.humanBehavior)
      }

      // 15. 记录成功
      result.success = true
      result.timings.totalMs = Date.now() - startTime

      if (proxy) {
        proxyPool.recordResult(proxy, true, result.timings.totalMs)
      }

      return result

    } finally {
      await page.close()
      await pool.release(h)
    }

  } catch (error) {
    // 错误分类
    const errorInfo = classifyError(error)
    result.error = errorInfo
    result.timings.totalMs = Date.now() - startTime

    // 记录代理失败
    const proxyPool = getProxyPool()
    const proxy = result.metadata.proxyUsed ? await proxyPool.selectBestProxy(targetCountry) : null
    if (proxy) {
      proxyPool.recordResult(proxy, false, result.timings.totalMs)
    }

    return result
  }
}

/**
 * HEAD请求尝试
 */
async function tryHeadRequest(url, timeout) {
  try {
    const fetch = require('node-fetch')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal
    })

    clearTimeout(timer)

    return {
      success: response.ok,
      statusCode: response.status
    }
  } catch (error) {
    return {
      success: false,
      statusCode: 0
    }
  }
}

/**
 * 按模式提取数据
 */
async function extractDataByMode(page, visitMode, config, response) {
  const data = {
    statusCode: response?.status() || 0
  }

  try {
    const finalURL = page.url()
    const parsedURL = new URL(finalURL)

    // 所有模式都需要的基础数据
    data.finalUrl = `${parsedURL.origin}${parsedURL.pathname}`
    data.domain = parsedURL.hostname.replace(/^www\./, '')

    // URL Suffix (resolve和evaluate需要)
    if (config.captureData?.urlSuffix) {
      data.finalUrlSuffix = parsedURL.search.replace(/^\?/, '')
    }

    // 品牌名提取 (evaluate需要)
    if (config.captureData?.brandName) {
      const title = await page.title().catch(() => '')
      data.brandName = extractBrandName(title, data.domain)
    }

    // HTML片段 (evaluate需要)
    if (config.captureData?.html) {
      const html = await page.content().catch(() => '')
      data.htmlSnippet = html.slice(0, config.captureData.htmlMaxLength || 50000)
    }

    // 重定向链 (多数模式需要)
    if (config.captureData?.redirectChain) {
      data.redirectChain = await extractRedirectChain(response)
    }

    // 仅状态码 (check模式)
    if (config.captureData?.statusCodeOnly) {
      data.available = data.statusCode >= 200 && data.statusCode < 400
      data.method = 'browser'
    }

  } catch (error) {
    console.error(`[UnifiedVisit] Data extraction error: ${error.message}`)
  }

  return data
}

/**
 * 提取重定向链
 */
async function extractRedirectChain(response) {
  const chain = []

  try {
    let reqObj = response?.request?.()
    if (typeof reqObj === 'function') reqObj = response.request()

    let current = reqObj
    while (current) {
      chain.push({
        url: current.url(),
        timestamp: new Date().toISOString()
      })
      current = current.redirectedFrom?.()
    }

    chain.reverse()
  } catch (error) {
    // Ignore
  }

  return chain
}

/**
 * 提取品牌名
 */
function extractBrandName(title, domain) {
  if (title) {
    const cleanTitle = title.split('|')[0].split('-')[0].trim()
    if (cleanTitle) return cleanTitle
  }

  // 从域名提取
  const parts = domain.split('.')
  if (parts.length >= 2) {
    const name = parts[parts.length - 2]
    return name.charAt(0).toUpperCase() + name.slice(1)
  }

  return 'Unknown'
}

/**
 * 模拟人类行为
 */
async function simulateHumanBehavior(page, behaviorConfig) {
  try {
    // 随机等待
    if (behaviorConfig.dwellTimeMs) {
      await new Promise(resolve => setTimeout(resolve, behaviorConfig.dwellTimeMs))
    }

    // 滚动页面
    if (behaviorConfig.enableScrolling) {
      await page.evaluate((distance) => {
        window.scrollBy({
          top: distance,
          behavior: 'smooth'
        })
      }, behaviorConfig.scrollDistance || 500)

      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // 鼠标移动 (简化实现)
    if (behaviorConfig.enableMouseMovement) {
      await page.mouse.move(Math.random() * 800, Math.random() * 600)
    }

  } catch (error) {
    // Ignore errors in behavior simulation
  }
}

/**
 * 错误分类
 */
function classifyError(error) {
  const message = String(error.message || error)

  if (message.includes('ANTIBOT_BLOCKED')) {
    return { type: ERROR_TYPES.ANTIBOT_BLOCKED, message, fastFailed: true }
  }

  if (message.includes('Timeout') || message.includes('timeout')) {
    return { type: ERROR_TYPES.TIMEOUT, message, fastFailed: true }
  }

  if (message.includes('net::ERR_') || message.includes('ENOTFOUND') || message.includes('ECONNREFUSED')) {
    return { type: ERROR_TYPES.NETWORK_ERROR, message, fastFailed: true }
  }

  if (message.includes('capacity_exhausted')) {
    return { type: ERROR_TYPES.CAPACITY_EXHAUSTED, message, fastFailed: true }
  }

  return { type: ERROR_TYPES.UNKNOWN, message, fastFailed: false }
}

/**
 * 创建错误响应
 */
function createErrorResponse(type, message, baseResult = {}) {
  return {
    success: false,
    ...baseResult,
    error: {
      type,
      message,
      fastFailed: true
    }
  }
}

/**
 * 获取随机User-Agent
 */
function getRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
  ]
  return userAgents[Math.floor(Math.random() * userAgents.length)]
}

module.exports = {
  unifiedVisit,
  ERROR_TYPES
}