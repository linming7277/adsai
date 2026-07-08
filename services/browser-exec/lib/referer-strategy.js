/**
 * Referer Strategy Module
 * 提供多种Referer策略: 社媒轮询、搜索引擎、自定义、置空
 */

// 主流社交媒体平台
const SOCIAL_REFERERS = [
  'https://www.facebook.com/',
  'https://l.facebook.com/',  // Facebook链接跳转
  'https://www.instagram.com/',
  'https://twitter.com/',
  'https://t.co/',  // Twitter短链接
  'https://www.tiktok.com/',
  'https://www.youtube.com/',
  'https://www.linkedin.com/',
  'https://www.reddit.com/',
  'https://www.pinterest.com/',
  'https://www.snapchat.com/',
  'https://discord.com/'
]

// 主流搜索引擎
const SEARCH_REFERERS = [
  'https://www.google.com/search',
  'https://www.google.com/',
  'https://www.bing.com/search',
  'https://search.yahoo.com/',
  'https://duckduckgo.com/',
  'https://www.baidu.com/s'
]

// 按国家定制的搜索引擎
const SEARCH_REFERERS_BY_COUNTRY = {
  US: ['https://www.google.com/search', 'https://www.bing.com/search'],
  GB: ['https://www.google.co.uk/search', 'https://www.bing.com/search'],
  CA: ['https://www.google.ca/search', 'https://www.bing.com/search'],
  AU: ['https://www.google.com.au/search', 'https://www.bing.com/search'],
  DE: ['https://www.google.de/search', 'https://www.bing.com/search'],
  FR: ['https://www.google.fr/search', 'https://www.bing.com/search'],
  ES: ['https://www.google.es/search', 'https://www.bing.com/search'],
  IT: ['https://www.google.it/search', 'https://www.bing.com/search'],
  JP: ['https://www.google.co.jp/search', 'https://www.yahoo.co.jp/'],
  CN: ['https://www.baidu.com/s', 'https://www.sogou.com/'],
  KR: ['https://www.google.co.kr/search', 'https://www.naver.com/'],
  BR: ['https://www.google.com.br/search', 'https://www.bing.com/search']
}

// 新闻站点
const NEWS_REFERERS = [
  'https://news.google.com/',
  'https://www.cnn.com/',
  'https://www.bbc.com/',
  'https://www.reuters.com/'
]

/**
 * 选择Referer
 * @param {string} strategy - 策略: social | search | news | direct | custom | none
 * @param {string} customReferer - 自定义Referer (当strategy=custom时使用)
 * @param {string} targetCountry - 目标国家 (用于本地化搜索引擎)
 * @returns {string|null} - Referer URL 或 null
 */
function selectReferer(strategy, customReferer = null, targetCountry = 'US') {
  switch (strategy) {
    case 'social':
      return randomChoice(SOCIAL_REFERERS)

    case 'search':
      const countrySearchEngines = SEARCH_REFERERS_BY_COUNTRY[targetCountry]
      if (countrySearchEngines) {
        return randomChoice(countrySearchEngines)
      }
      return randomChoice(SEARCH_REFERERS)

    case 'news':
      return randomChoice(NEWS_REFERERS)

    case 'direct':
      // 假装从搜索引擎首页直接访问
      const directReferers = SEARCH_REFERERS_BY_COUNTRY[targetCountry] || SEARCH_REFERERS
      return directReferers[0]  // 使用该国家的主流搜索引擎

    case 'custom':
      if (customReferer && isValidURL(customReferer)) {
        return customReferer
      }
      console.warn('Invalid custom referer, fallback to social')
      return randomChoice(SOCIAL_REFERERS)

    case 'none':
      return null

    default:
      console.warn(`Unknown referer strategy: ${strategy}, fallback to social`)
      return randomChoice(SOCIAL_REFERERS)
  }
}

/**
 * 获取带查询参数的社媒Referer (更真实)
 * @param {string} targetURL - 目标URL，用于生成fbclid等参数
 * @returns {string}
 */
function getRealisticSocialReferer(targetURL) {
  const platform = randomChoice(['facebook', 'twitter', 'instagram', 'tiktok'])

  switch (platform) {
    case 'facebook':
      // Facebook Click ID
      const fbclid = generateRandomID(20)
      return `https://l.facebook.com/l.php?u=${encodeURIComponent(targetURL)}&h=${generateRandomID(10)}&fbclid=${fbclid}`

    case 'twitter':
      // Twitter简化
      return `https://t.co/${generateRandomID(10)}`

    case 'instagram':
      return 'https://www.instagram.com/'

    case 'tiktok':
      return 'https://www.tiktok.com/'

    default:
      return 'https://www.facebook.com/'
  }
}

/**
 * 获取带搜索关键词的搜索Referer (更真实)
 * @param {string} brandName - 品牌名或域名
 * @param {string} targetCountry
 * @returns {string}
 */
function getRealisticSearchReferer(brandName, targetCountry = 'US') {
  const searchEngines = SEARCH_REFERERS_BY_COUNTRY[targetCountry] || SEARCH_REFERERS
  const searchEngine = randomChoice(searchEngines)

  // 生成搜索关键词
  const keyword = brandName || 'deals'
  const encodedKeyword = encodeURIComponent(keyword)

  if (searchEngine.includes('google')) {
    return `${searchEngine}?q=${encodedKeyword}`
  } else if (searchEngine.includes('bing')) {
    return `${searchEngine}?q=${encodedKeyword}`
  } else if (searchEngine.includes('yahoo')) {
    return `${searchEngine}?p=${encodedKeyword}`
  } else if (searchEngine.includes('baidu')) {
    return `${searchEngine}?wd=${encodedKeyword}`
  }

  return searchEngine
}

/**
 * 智能选择Referer (根据目标URL特征)
 * @param {string} targetURL
 * @param {string} targetCountry
 * @returns {string}
 */
function selectSmartReferer(targetURL, targetCountry = 'US') {
  try {
    const url = new URL(targetURL)
    const hostname = url.hostname.toLowerCase()

    // 如果目标是电商网站，优先使用搜索引擎
    const ecommerceKeywords = ['shop', 'store', 'buy', 'cart', 'product']
    if (ecommerceKeywords.some(kw => hostname.includes(kw))) {
      return selectReferer('search', null, targetCountry)
    }

    // 默认使用社交媒体
    return selectReferer('social', null, targetCountry)
  } catch (error) {
    return selectReferer('social', null, targetCountry)
  }
}

/**
 * 批量生成Referer列表 (用于轮询)
 * @param {string} strategy
 * @param {number} count
 * @param {string} targetCountry
 * @returns {Array<string>}
 */
function generateRefererList(strategy, count = 10, targetCountry = 'US') {
  const referers = []
  for (let i = 0; i < count; i++) {
    const referer = selectReferer(strategy, null, targetCountry)
    if (referer && !referers.includes(referer)) {
      referers.push(referer)
    }
  }
  return referers
}

// ========== Helper Functions ==========

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)]
}

function generateRandomID(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function isValidURL(string) {
  try {
    new URL(string)
    return true
  } catch (error) {
    return false
  }
}

module.exports = {
  selectReferer,
  getRealisticSocialReferer,
  getRealisticSearchReferer,
  selectSmartReferer,
  generateRefererList,
  SOCIAL_REFERERS,
  SEARCH_REFERERS,
  SEARCH_REFERERS_BY_COUNTRY,
  NEWS_REFERERS
}