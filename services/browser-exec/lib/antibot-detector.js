/**
 * Anti-Bot Detection Module
 * 快速检测Cloudflare、reCAPTCHA等风控拦截
 */

const CLOUDFLARE_INDICATORS = [
  'just a moment',
  'checking your browser',
  'cloudflare',
  'ddos-guard',
  'cf-browser-verification',
  'ray-id',
  '__cf_chl_jschl_tk__',
  'challenge-platform'
]

const RECAPTCHA_INDICATORS = [
  'recaptcha',
  'g-recaptcha',
  'data-sitekey'
]

const CAPTCHA_INDICATORS = [
  'captcha',
  'hcaptcha',
  'funcaptcha',
  'arkose'
]

const GEO_BLOCK_INDICATORS = [
  'not available in your country',
  'not available in your region',
  'geo-restricted',
  'access denied',
  'blocked in your location'
]

/**
 * 快速检测页面是否被风控拦截
 * @param {Page} page - Playwright page对象
 * @param {number} earlyTimeout - 提前检测超时时间(ms)
 * @returns {Promise<Object>} { passed, blockedBy, indicators, method }
 */
async function detectAntiBot(page, earlyTimeout = 200) {
  const checks = []

  // 检查1: 快速标题检测
  checks.push(
    page.title().then(title => {
      const lowerTitle = title.toLowerCase()
      for (const indicator of CLOUDFLARE_INDICATORS) {
        if (lowerTitle.includes(indicator)) {
          return {
            passed: false,
            blockedBy: 'cloudflare',
            indicators: [indicator],
            method: 'title',
            confidence: 0.95
          }
        }
      }
      return null
    }).catch(() => null)
  )

  // 检查2: HTML内容检测 (限制读取前10KB)
  checks.push(
    page.content().then(html => {
      const snippet = html.slice(0, 10000).toLowerCase()

      // Cloudflare检测
      for (const indicator of CLOUDFLARE_INDICATORS) {
        if (snippet.includes(indicator)) {
          return {
            passed: false,
            blockedBy: 'cloudflare',
            indicators: [indicator],
            method: 'content',
            confidence: 0.9
          }
        }
      }

      // reCAPTCHA检测
      for (const indicator of RECAPTCHA_INDICATORS) {
        if (snippet.includes(indicator)) {
          return {
            passed: false,
            blockedBy: 'recaptcha',
            indicators: [indicator],
            method: 'content',
            confidence: 0.85
          }
        }
      }

      // 通用CAPTCHA检测
      for (const indicator of CAPTCHA_INDICATORS) {
        if (snippet.includes(indicator)) {
          return {
            passed: false,
            blockedBy: 'captcha',
            indicators: [indicator],
            method: 'content',
            confidence: 0.8
          }
        }
      }

      // 地域拦截检测
      for (const indicator of GEO_BLOCK_INDICATORS) {
        if (snippet.includes(indicator)) {
          return {
            passed: false,
            blockedBy: 'geo_block',
            indicators: [indicator],
            method: 'content',
            confidence: 0.75
          }
        }
      }

      return null
    }).catch(() => null)
  )

  // 检查3: DOM选择器检测
  checks.push(
    Promise.all([
      page.$('#challenge-form').then(el => el ? 'cloudflare_challenge_form' : null),
      page.$('.cf-browser-verification').then(el => el ? 'cloudflare_verification' : null),
      page.$('iframe[src*="recaptcha"]').then(el => el ? 'recaptcha_iframe' : null),
      page.$('iframe[src*="hcaptcha"]').then(el => el ? 'hcaptcha_iframe' : null)
    ]).then(results => {
      const found = results.filter(Boolean)
      if (found.length > 0) {
        return {
          passed: false,
          blockedBy: found[0].includes('cloudflare') ? 'cloudflare' : 'captcha',
          indicators: found,
          method: 'dom_selector',
          confidence: 0.9
        }
      }
      return null
    }).catch(() => null)
  )

  // 竞速：在earlyTimeout内返回第一个阳性结果
  const raceResult = await Promise.race([
    Promise.all(checks).then(results => {
      // 返回第一个非null结果
      return results.find(r => r !== null)
    }),
    new Promise(resolve => setTimeout(() => resolve(null), earlyTimeout))
  ])

  if (raceResult) {
    return raceResult
  }

  // 未检测到风控
  return {
    passed: true,
    blockedBy: null,
    indicators: [],
    method: 'none',
    confidence: 1.0
  }
}

/**
 * 检测特定类型的风控
 * @param {Page} page
 * @param {string} type - 'cloudflare' | 'captcha' | 'geo_block'
 * @returns {Promise<boolean>}
 */
async function detectSpecific(page, type) {
  try {
    const html = await page.content()
    const lowerHTML = html.toLowerCase()

    switch (type) {
      case 'cloudflare':
        return CLOUDFLARE_INDICATORS.some(indicator => lowerHTML.includes(indicator))
      case 'captcha':
        return [...RECAPTCHA_INDICATORS, ...CAPTCHA_INDICATORS].some(indicator => lowerHTML.includes(indicator))
      case 'geo_block':
        return GEO_BLOCK_INDICATORS.some(indicator => lowerHTML.includes(indicator))
      default:
        return false
    }
  } catch (error) {
    return false
  }
}

/**
 * 轻量级检测（仅检查标题）
 * @param {Page} page
 * @returns {Promise<boolean>} - true表示检测到拦截
 */
async function quickCheck(page) {
  try {
    const title = await page.title()
    const lowerTitle = title.toLowerCase()
    return CLOUDFLARE_INDICATORS.some(indicator => lowerTitle.includes(indicator))
  } catch (error) {
    return false
  }
}

module.exports = {
  detectAntiBot,
  detectSpecific,
  quickCheck,
  CLOUDFLARE_INDICATORS,
  RECAPTCHA_INDICATORS,
  CAPTCHA_INDICATORS,
  GEO_BLOCK_INDICATORS
}