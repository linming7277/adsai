/**
 * Proxy Pool Management
 * 智能代理池：自动验证、性能追踪、最佳代理选择
 */

const fetch = require('node-fetch')

class ProxyPool {
  constructor(options = {}) {
    this.proxies = new Map()  // country -> [proxy1, proxy2, ...]
    this.stats = new Map()     // proxyKey -> { success, fail, avgLatency, lastUsed, verified }
    this.blacklist = new Set() // 黑名单代理
    this.verificationCache = new Map()  // proxyKey -> { verified, timestamp }

    this.options = {
      maxProxiesPerCountry: options.maxProxiesPerCountry || 10,
      verificationTimeout: options.verificationTimeout || 3000,
      verificationURL: options.verificationURL || 'https://www.gstatic.com/generate_204',
      cacheValidityMs: options.cacheValidityMs || 300000,  // 5分钟
      blacklistDuration: options.blacklistDuration || 600000,  // 10分钟
      minSuccessRate: options.minSuccessRate || 0.5,
      ...options
    }
  }

  /**
   * 从提供商URL加载代理列表
   * @param {string} country - 国家代码
   * @param {string} providerURL - 代理提供商API URL
   * @returns {Promise<Array<Object>>} - 代理列表
   */
  async loadProxiesFromProvider(country, providerURL) {
    try {
      const response = await fetch(providerURL, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })

      if (!response.ok) {
        throw new Error(`Provider returned ${response.status}`)
      }

      const text = await response.text()
      const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean)

      const proxies = lines
        .map(line => this.parseProxyLine(line))
        .filter(Boolean)
        .slice(0, this.options.maxProxiesPerCountry)

      // 保存到池中
      this.proxies.set(country, proxies)

      console.log(`[ProxyPool] Loaded ${proxies.length} proxies for ${country}`)
      return proxies

    } catch (error) {
      console.error(`[ProxyPool] Failed to load proxies: ${error.message}`)
      return []
    }
  }

  /**
   * 解析代理行 (支持多种格式)
   * @param {string} line - 代理字符串
   * @returns {Object|null} - { server, username, password, raw }
   */
  parseProxyLine(line) {
    // 格式1: http://host:port
    // 格式2: http://user:pass@host:port
    // 格式3: host:port:user:pass
    // 格式4: host:port

    try {
      // 尝试URL格式
      if (line.startsWith('http://') || line.startsWith('https://') || line.startsWith('socks5://')) {
        const url = new URL(line)
        return {
          server: `${url.protocol}//${url.hostname}:${url.port}`,
          username: url.username || undefined,
          password: url.password || undefined,
          raw: line
        }
      }

      // 尝试冒号分隔格式
      const parts = line.split(':')
      if (parts.length === 4) {
        // host:port:user:pass
        return {
          server: `http://${parts[0]}:${parts[1]}`,
          username: parts[2],
          password: parts[3],
          raw: line
        }
      } else if (parts.length === 2) {
        // host:port
        return {
          server: `http://${parts[0]}:${parts[1]}`,
          username: undefined,
          password: undefined,
          raw: line
        }
      }

      return null
    } catch (error) {
      console.warn(`[ProxyPool] Failed to parse proxy: ${line}`)
      return null
    }
  }

  /**
   * 验证代理是否可用
   * @param {Object} proxy
   * @returns {Promise<boolean>}
   */
  async verifyProxy(proxy) {
    const proxyKey = this.getProxyKey(proxy)

    // 检查缓存
    const cached = this.verificationCache.get(proxyKey)
    if (cached && Date.now() - cached.timestamp < this.options.cacheValidityMs) {
      return cached.verified
    }

    // 检查黑名单
    if (this.blacklist.has(proxyKey)) {
      return false
    }

    try {
      // 使用Playwright验证 (如果池可用)
      if (global.pool) {
        const h = await global.pool.getContext({ proxy })
        const page = await h.context.newPage()

        let verified = false
        try {
          const response = await page.goto(this.options.verificationURL, {
            timeout: this.options.verificationTimeout,
            waitUntil: 'load'
          })
          const statusCode = response?.status() || 0
          verified = statusCode >= 200 && statusCode < 400
        } catch (error) {
          verified = false
        } finally {
          try { await page.close() } catch {}
          await global.pool.release(h)
        }

        // 缓存结果
        this.verificationCache.set(proxyKey, {
          verified,
          timestamp: Date.now()
        })

        if (!verified) {
          this.addToBlacklist(proxyKey)
        }

        return verified
      }

      // 降级：使用HTTP验证 (需要node-fetch支持proxy)
      return false  // 简化实现，直接返回false

    } catch (error) {
      console.error(`[ProxyPool] Verification error: ${error.message}`)
      return false
    }
  }

  /**
   * 选择最佳代理
   * @param {string} country - 目标国家
   * @param {Object} previousFailed - 上次失败的代理 (避免重复选择)
   * @returns {Promise<Object|null>}
   */
  async selectBestProxy(country, previousFailed = null) {
    const candidates = this.proxies.get(country) || []

    if (candidates.length === 0) {
      return null
    }

    // 过滤掉刚失败的代理和黑名单代理
    const failedKey = previousFailed ? this.getProxyKey(previousFailed) : null
    const available = candidates.filter(proxy => {
      const key = this.getProxyKey(proxy)
      return key !== failedKey && !this.blacklist.has(key)
    })

    if (available.length === 0) {
      // 清理黑名单，重新尝试
      this.clearBlacklist()
      return candidates[0]
    }

    // 按成功率和延迟排序
    available.sort((a, b) => {
      const scoreA = this.calculateProxyScore(a)
      const scoreB = this.calculateProxyScore(b)
      return scoreB - scoreA  // 降序
    })

    return available[0]
  }

  /**
   * 计算代理评分
   * @param {Object} proxy
   * @returns {number} - 分数越高越好
   */
  calculateProxyScore(proxy) {
    const proxyKey = this.getProxyKey(proxy)
    const stats = this.stats.get(proxyKey)

    if (!stats || stats.success + stats.fail === 0) {
      // 新代理：给予中等分数
      return 0.5
    }

    const successRate = stats.success / (stats.success + stats.fail)
    const latencyScore = 1 / (stats.avgLatency + 1)  // 延迟越低分数越高
    const recencyScore = 1 / (Date.now() - stats.lastUsed + 1000)  // 最近使用过的降低优先级

    // 综合评分
    return successRate * 0.7 + latencyScore * 0.2 + recencyScore * 0.1
  }

  /**
   * 记录代理使用结果
   * @param {Object} proxy
   * @param {boolean} success
   * @param {number} latency - 延迟(ms)
   */
  recordResult(proxy, success, latency) {
    if (!proxy) return

    const proxyKey = this.getProxyKey(proxy)
    let stats = this.stats.get(proxyKey)

    if (!stats) {
      stats = {
        success: 0,
        fail: 0,
        avgLatency: 0,
        count: 0,
        lastUsed: Date.now()
      }
    }

    // 更新统计
    if (success) {
      stats.success++
    } else {
      stats.fail++
    }

    stats.avgLatency = (stats.avgLatency * stats.count + latency) / (stats.count + 1)
    stats.count++
    stats.lastUsed = Date.now()

    this.stats.set(proxyKey, stats)

    // 如果失败率过高，加入黑名单
    const successRate = stats.success / (stats.success + stats.fail)
    if (stats.count >= 5 && successRate < this.options.minSuccessRate) {
      this.addToBlacklist(proxyKey)
    }
  }

  /**
   * 添加到黑名单
   * @param {string} proxyKey
   */
  addToBlacklist(proxyKey) {
    this.blacklist.add(proxyKey)

    // 定时清除黑名单
    setTimeout(() => {
      this.blacklist.delete(proxyKey)
      console.log(`[ProxyPool] Removed ${proxyKey} from blacklist`)
    }, this.options.blacklistDuration)
  }

  /**
   * 清空黑名单
   */
  clearBlacklist() {
    console.log(`[ProxyPool] Clearing blacklist (${this.blacklist.size} entries)`)
    this.blacklist.clear()
  }

  /**
   * 获取代理唯一标识
   * @param {Object} proxy
   * @returns {string}
   */
  getProxyKey(proxy) {
    return proxy.raw || proxy.server
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    const statsByCountry = {}

    this.proxies.forEach((proxies, country) => {
      const countryStats = {
        totalProxies: proxies.length,
        blacklisted: 0,
        avgSuccessRate: 0,
        avgLatency: 0
      }

      let totalSuccessRate = 0
      let totalLatency = 0
      let count = 0

      proxies.forEach(proxy => {
        const proxyKey = this.getProxyKey(proxy)
        if (this.blacklist.has(proxyKey)) {
          countryStats.blacklisted++
        }

        const stats = this.stats.get(proxyKey)
        if (stats && stats.count > 0) {
          const successRate = stats.success / (stats.success + stats.fail)
          totalSuccessRate += successRate
          totalLatency += stats.avgLatency
          count++
        }
      })

      if (count > 0) {
        countryStats.avgSuccessRate = (totalSuccessRate / count).toFixed(2)
        countryStats.avgLatency = Math.round(totalLatency / count)
      }

      statsByCountry[country] = countryStats
    })

    return {
      countries: Object.keys(statsByCountry),
      stats: statsByCountry,
      blacklistSize: this.blacklist.size
    }
  }

  /**
   * 预热代理池（验证所有代理）
   * @param {string} country
   * @returns {Promise<number>} - 可用代理数量
   */
  async warmup(country) {
    const proxies = this.proxies.get(country) || []
    console.log(`[ProxyPool] Warming up ${proxies.length} proxies for ${country}`)

    const verificationPromises = proxies.map(proxy =>
      this.verifyProxy(proxy).catch(() => false)
    )

    const results = await Promise.all(verificationPromises)
    const validCount = results.filter(Boolean).length

    console.log(`[ProxyPool] Warmup complete: ${validCount}/${proxies.length} proxies verified`)
    return validCount
  }
}

// 单例
let globalProxyPool = null

function getProxyPool(options) {
  if (!globalProxyPool) {
    globalProxyPool = new ProxyPool(options)
  }
  return globalProxyPool
}

module.exports = {
  ProxyPool,
  getProxyPool
}