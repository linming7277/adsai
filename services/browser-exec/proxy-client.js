/**
 * Proxy Pool HTTP Client
 * Communicates with centralized proxy-pool service
 */

import fetch from 'node-fetch'

class ProxyPoolClient {
  constructor(proxyPoolURL) {
    this.baseURL = proxyPoolURL || process.env.PROXY_POOL_URL || 'http://proxy-pool-preview'
    console.log(`[ProxyClient] Initialized with base URL: ${this.baseURL}`)
  }

  /**
   * Get a proxy from the pool
   * @param {string} targetURL - The URL that will be accessed with this proxy
   * @returns {Promise<string|null>} Proxy string in format "ip:port:user:pass"
   */
  async getProxy(targetURL) {
    try {
      const url = `${this.baseURL}/proxy?targetUrl=${encodeURIComponent(targetURL)}`
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      })

      if (!response.ok) {
        const error = await response.text()
        console.error(`[ProxyClient] Failed to get proxy: ${response.status} ${error}`)
        return null
      }

      const data = await response.json()
      return data.proxy || null
    } catch (error) {
      console.error(`[ProxyClient] Error getting proxy: ${error.message}`)
      return null
    }
  }

  /**
   * Release a proxy back to the pool
   * @param {string} proxy - The proxy string
   * @param {boolean} success - Whether the proxy worked successfully
   * @param {number} responseTime - Response time in milliseconds
   */
  async releaseProxy(proxy, success = true, responseTime = null) {
    try {
      const response = await fetch(`${this.baseURL}/proxy/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxy,
          success,
          responseTime
        }),
        timeout: 5000
      })

      if (!response.ok) {
        const error = await response.text()
        console.error(`[ProxyClient] Failed to release proxy: ${response.status} ${error}`)
      }
    } catch (error) {
      console.error(`[ProxyClient] Error releasing proxy: ${error.message}`)
    }
  }

  /**
   * Get pool statistics
   * @returns {Promise<Object|null>}
   */
  async getStats() {
    try {
      const response = await fetch(`${this.baseURL}/stats`, {
        method: 'GET',
        timeout: 5000
      })

      if (!response.ok) {
        return null
      }

      return await response.json()
    } catch (error) {
      console.error(`[ProxyClient] Error getting stats: ${error.message}`)
      return null
    }
  }

  /**
   * Health check
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        timeout: 3000
      })

      return response.ok
    } catch (error) {
      return false
    }
  }
}

// Singleton instance
let clientInstance = null

export function getProxyClient(proxyPoolURL) {
  if (!clientInstance) {
    clientInstance = new ProxyPoolClient(proxyPoolURL)
  }
  return clientInstance
}

export { ProxyPoolClient }
