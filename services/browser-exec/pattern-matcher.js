import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Pattern Matcher - 中间页模式识别引擎
 * 基于可配置的模式库进行智能匹配
 */
class PatternMatcher {
  constructor() {
    this.library = null
    this.loadPatternLibrary()
  }

  /**
   * 加载模式库配置文件
   */
  loadPatternLibrary() {
    try {
      const patternPath = path.join(__dirname, 'patterns', 'intermediate-pages.json')
      const content = fs.readFileSync(patternPath, 'utf-8')
      this.library = JSON.parse(content)
      console.log(`[pattern-matcher] Loaded pattern library v${this.library.version} with ${this.library.domainPatterns.length} domain patterns`)
    } catch (err) {
      console.error('[pattern-matcher] Failed to load pattern library:', err.message)
      // Fallback to empty library
      this.library = {
        version: '0.0.0',
        domainPatterns: [],
        textPatterns: [],
        domPatterns: [],
        expiredPageIndicators: []
      }
    }
  }

  /**
   * 重新加载模式库（热更新）
   */
  reloadPatternLibrary() {
    console.log('[pattern-matcher] Reloading pattern library...')
    this.loadPatternLibrary()
  }

  /**
   * 检测是否为中间页
   * @param {Object} pageFeatures - 页面特征 {domain, url, title, content, urlPath}
   * @returns {Object} - {isIntermediate, confidence, pattern, expectedWaitTime, reason}
   */
  async detectIntermediatePage(pageFeatures) {
    const { domain, url, title, content, urlPath } = pageFeatures

    // Check 0: Detect expired/suspended pages (final error pages)
    const expiredCheck = this.checkExpiredPage(urlPath, title)
    if (expiredCheck.isExpired) {
      return {
        isIntermediate: false,
        isFinalPage: true,
        isExpired: true,
        confidence: 0.95,
        reason: 'expired-page',
        pattern: expiredCheck.pattern
      }
    }

    // Check 1: Domain pattern matching (highest priority)
    const domainMatch = this.matchDomainPattern(domain, urlPath)
    if (domainMatch && domainMatch.confidence >= 0.8) {
      return {
        isIntermediate: domainMatch.type !== 'landing',
        confidence: domainMatch.confidence,
        pattern: domainMatch,
        expectedWaitTime: domainMatch.expectedWaitTime,
        reason: 'domain-pattern',
        subtype: domainMatch.subtype
      }
    }

    // Check 2: Text pattern matching
    const textMatches = this.matchTextPatterns(title, content)
    if (textMatches.length > 0) {
      const bestMatch = textMatches.reduce((a, b) =>
        a.confidence > b.confidence ? a : b
      )
      if (bestMatch.confidence >= 0.85) {
        return {
          isIntermediate: true,
          confidence: bestMatch.confidence,
          pattern: bestMatch,
          reason: 'text-pattern',
          extractedCountdown: bestMatch.extractedCountdown
        }
      }
    }

    // Check 3: Content-based heuristics (fallback)
    const contentCheck = this.checkContentHeuristics(content)
    if (contentCheck.isIntermediate) {
      return {
        isIntermediate: true,
        confidence: contentCheck.confidence,
        reason: 'content-heuristic',
        pattern: contentCheck.pattern
      }
    }

    // Default: not intermediate
    return {
      isIntermediate: false,
      confidence: 0.5,
      reason: 'no-match'
    }
  }

  /**
   * 检查是否为失效页/错误页
   */
  checkExpiredPage(urlPath, title) {
    const lowerPath = urlPath.toLowerCase()
    const lowerTitle = title.toLowerCase()

    for (const indicator of this.library.expiredPageIndicators) {
      if (lowerPath.includes(indicator)) {
        return {
          isExpired: true,
          pattern: { type: 'expired', indicator, location: 'url' }
        }
      }
      if (lowerPath.includes('error') && (lowerTitle.includes('suspended') || lowerTitle.includes('expired'))) {
        return {
          isExpired: true,
          pattern: { type: 'expired', indicator: 'error+title', location: 'url+title' }
        }
      }
    }

    return { isExpired: false }
  }

  /**
   * 匹配域名模式
   */
  matchDomainPattern(domain, urlPath = '') {
    const cleanDomain = domain.replace(/^www\./, '')

    for (const pattern of this.library.domainPatterns) {
      // Check domain match (supports wildcards and partial matches)
      let domainMatches = false
      if (pattern.domain.includes('*')) {
        // Wildcard pattern
        domainMatches = this.matchWildcard(cleanDomain, pattern.domain)
      } else {
        // Partial match (e.g., "chromewebdata" matches "chromewebdata.com")
        domainMatches = cleanDomain.includes(pattern.domain)
      }

      if (domainMatches) {
        // If pattern has urlPattern, check it too
        if (pattern.urlPattern) {
          if (!urlPath.toLowerCase().includes(pattern.urlPattern.toLowerCase())) {
            continue
          }
        }
        return pattern
      }
    }

    return null
  }

  /**
   * 匹配文本模式
   */
  matchTextPatterns(title, content) {
    const matches = []
    const lowerTitle = title.toLowerCase()
    const lowerContent = content.slice(0, 10000).toLowerCase()

    for (const pattern of this.library.textPatterns) {
      let matched = false
      let extractedCountdown = null

      // Check location
      const textToSearch = pattern.location === 'title' ? lowerTitle :
                          pattern.location === 'body' ? lowerContent :
                          lowerTitle + ' ' + lowerContent

      // Check keywords
      const allKeywordsFound = pattern.keywords.every(kw =>
        textToSearch.includes(kw.toLowerCase())
      )

      if (allKeywordsFound) {
        matched = true

        // Extract countdown if pattern supports it
        if (pattern.extractCountdown && pattern.regex) {
          const regex = new RegExp(pattern.regex, 'i')
          const match = textToSearch.match(regex)
          if (match && match[1]) {
            extractedCountdown = parseInt(match[1], 10)
          }
        }
      }

      if (matched) {
        matches.push({
          ...pattern,
          extractedCountdown,
          matchedIn: pattern.location
        })
      }
    }

    return matches
  }

  /**
   * 通配符匹配
   */
  matchWildcard(str, pattern) {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$'
    )
    return regex.test(str)
  }

  /**
   * 基于内容的启发式检查（fallback）
   */
  checkContentHeuristics(content) {
    const lowerContent = content.slice(0, 10000).toLowerCase()

    // Meta refresh check
    if (lowerContent.includes('<meta') &&
        lowerContent.includes('http-equiv') &&
        lowerContent.includes('refresh')) {
      return {
        isIntermediate: true,
        confidence: 0.95,
        pattern: { type: 'meta-refresh', method: 'heuristic' }
      }
    }

    // Minimal content check (likely placeholder)
    // Very strict threshold to avoid false positives on landing pages
    if (content.length < 200 && !lowerContent.includes('<!doctype') && !lowerContent.includes('<head')) {
      return {
        isIntermediate: true,
        confidence: 0.7,
        pattern: { type: 'minimal-content', method: 'heuristic' }
      }
    }

    return { isIntermediate: false }
  }

  /**
   * 获取模式库统计信息
   */
  getStats() {
    return {
      version: this.library.version,
      lastUpdated: this.library.lastUpdated,
      domainPatterns: this.library.domainPatterns.length,
      textPatterns: this.library.textPatterns.length,
      domPatterns: this.library.domPatterns.length,
      expiredIndicators: this.library.expiredPageIndicators.length
    }
  }

  /**
   * 添加域名模式
   */
  addDomainPattern(pattern) {
    if (!pattern.id || !pattern.domain || !pattern.type) {
      throw new Error('Invalid pattern: id, domain, and type are required')
    }
    this.library.domainPatterns.push(pattern)
    this.savePatternLibrary()
  }

  /**
   * 更新域名模式
   */
  updateDomainPattern(id, updates) {
    const idx = this.library.domainPatterns.findIndex(p => p.id === id)
    if (idx === -1) {
      throw new Error(`Pattern not found: ${id}`)
    }
    this.library.domainPatterns[idx] = { ...this.library.domainPatterns[idx], ...updates }
    this.savePatternLibrary()
  }

  /**
   * 删除域名模式
   */
  deleteDomainPattern(id) {
    const before = this.library.domainPatterns.length
    this.library.domainPatterns = this.library.domainPatterns.filter(p => p.id !== id)
    if (this.library.domainPatterns.length === before) {
      throw new Error(`Pattern not found: ${id}`)
    }
    this.savePatternLibrary()
  }

  /**
   * 保存模式库到文件
   */
  savePatternLibrary() {
    try {
      const patternPath = path.join(__dirname, 'patterns', 'intermediate-pages.json')
      this.library.lastUpdated = new Date().toISOString()
      fs.writeFileSync(patternPath, JSON.stringify(this.library, null, 2), 'utf-8')
      console.log('[pattern-matcher] Pattern library saved successfully')
    } catch (err) {
      console.error('[pattern-matcher] Failed to save pattern library:', err.message)
      throw err
    }
  }
}

// Export singleton instance
export const patternMatcher = new PatternMatcher()
