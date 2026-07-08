/**
 * Visit Modes Configuration
 * 4种访问模式的预设配置
 */

const VISIT_MODES = {
  // 模式1: Offer评估
  evaluate: {
    resourceBlocking: ['image', 'font', 'media', 'stylesheet'],
    timeoutMs: 30000,
    waitUntil: 'networkidle',
    enableRetry: false,
    maxRetries: 0,
    enableAntiBot: true,
    enableFingerprinting: true,
    refererStrategy: 'social',
    stabilizeMs: 1200,
    captureData: {
      html: true,
      htmlMaxLength: 50000,
      screenshot: false,
      redirectChain: true,
      brandName: true,
      urlSuffix: true
    },
    description: 'Offer evaluation mode: optimized for fast domain extraction'
  },

  // 模式2: 补点击 (模拟真人)
  click: {
    resourceBlocking: [],  // 完整加载所有资源
    timeoutMs: 60000,
    waitUntil: 'networkidle',
    enableRetry: true,
    maxRetries: 2,
    enableAntiBot: true,
    enableFingerprinting: true,
    refererStrategy: 'social',
    stabilizeMs: 2000,
    humanBehavior: {
      enableMouseMovement: true,
      enableScrolling: true,
      enableRandomClicks: false,
      dwellTimeMs: 3000,
      scrollDistance: 500
    },
    captureData: {
      html: false,
      screenshot: false,
      redirectChain: true,
      antiDetection: true
    },
    description: 'Click simulation mode: full page load with human-like behavior'
  },

  // 模式3: 换链接 (获取Final URL Suffix)
  resolve: {
    resourceBlocking: ['image', 'font', 'media'],
    timeoutMs: 15000,
    waitUntil: 'domcontentloaded',
    enableRetry: false,
    maxRetries: 0,
    enableAntiBot: false,
    enableFingerprinting: false,
    refererStrategy: 'social',
    stabilizeMs: 1000,
    captureData: {
      html: false,
      screenshot: false,
      redirectChain: true,
      brandName: false,
      urlSuffix: true  // 重点!
    },
    description: 'URL resolution mode: fast redirect chain tracking'
  },

  // 模式4: 可用性检测
  check: {
    method: 'HEAD',  // 优先使用HEAD请求
    fallbackToBrowser: true,  // HEAD失败时降级为浏览器
    resourceBlocking: ['*'],  // 禁用所有资源
    timeoutMs: 10000,
    waitUntil: 'domcontentloaded',
    enableRetry: false,
    maxRetries: 0,
    enableAntiBot: false,
    enableFingerprinting: false,
    refererStrategy: 'none',
    stabilizeMs: 0,
    captureData: {
      html: false,
      screenshot: false,
      redirectChain: false,
      statusCodeOnly: true
    },
    description: 'Availability check mode: lightweight HEAD request with browser fallback'
  }
}

/**
 * 获取模式配置
 * @param {string} mode - evaluate | click | resolve | check
 * @param {Object} overrides - 覆盖配置
 * @returns {Object}
 */
function getModeConfig(mode, overrides = {}) {
  const baseConfig = VISIT_MODES[mode]

  if (!baseConfig) {
    throw new Error(`Invalid visit mode: ${mode}. Valid modes: ${Object.keys(VISIT_MODES).join(', ')}`)
  }

  // 深度合并配置
  return deepMerge(baseConfig, overrides)
}

/**
 * 验证模式配置
 * @param {string} mode
 * @returns {boolean}
 */
function isValidMode(mode) {
  return Object.keys(VISIT_MODES).includes(mode)
}

/**
 * 获取所有可用模式
 * @returns {Array<string>}
 */
function getAvailableModes() {
  return Object.keys(VISIT_MODES)
}

/**
 * 获取模式描述
 * @param {string} mode
 * @returns {string}
 */
function getModeDescription(mode) {
  return VISIT_MODES[mode]?.description || 'Unknown mode'
}

/**
 * 根据业务场景推荐模式
 * @param {string} scenario - 业务场景描述
 * @returns {string}
 */
function recommendMode(scenario) {
  const lowerScenario = scenario.toLowerCase()

  if (lowerScenario.includes('evaluat') || lowerScenario.includes('domain') || lowerScenario.includes('brand')) {
    return 'evaluate'
  }

  if (lowerScenario.includes('click') || lowerScenario.includes('human') || lowerScenario.includes('bypass')) {
    return 'click'
  }

  if (lowerScenario.includes('resolve') || lowerScenario.includes('suffix') || lowerScenario.includes('redirect')) {
    return 'resolve'
  }

  if (lowerScenario.includes('check') || lowerScenario.includes('availab') || lowerScenario.includes('status')) {
    return 'check'
  }

  return 'evaluate'  // 默认
}

/**
 * 深度合并对象
 */
function deepMerge(target, source) {
  const output = { ...target }

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] || {}, source[key])
    } else {
      output[key] = source[key]
    }
  }

  return output
}

module.exports = {
  VISIT_MODES,
  getModeConfig,
  isValidMode,
  getAvailableModes,
  getModeDescription,
  recommendMode
}