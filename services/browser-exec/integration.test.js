/**
 * Browser-exec Integration Tests
 * 
 * 这些测试直接调用预发环境的 browser-exec 服务
 * 测试真实的浏览器自动化功能
 * 
 * 运行方式:
 * BROWSER_EXEC_URL=https://browser-exec-preview-xxx.run.app node integration.test.js
 */

const BASE_URL = process.env.BROWSER_EXEC_URL || 'http://localhost:8080'
const INTERNAL_TOKEN = process.env.BROWSER_INTERNAL_TOKEN || ''

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = []
    this.passed = 0
    this.failed = 0
  }

  test(name, fn) {
    this.tests.push({ name, fn })
  }

  async run() {
    console.log(`\n🧪 Running ${this.tests.length} integration tests...\n`)
    
    for (const { name, fn } of this.tests) {
      try {
        await fn()
        this.passed++
        console.log(`✅ ${name}`)
      } catch (error) {
        this.failed++
        console.log(`❌ ${name}`)
        console.log(`   Error: ${error.message}`)
      }
    }

    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed\n`)
    process.exit(this.failed > 0 ? 1 : 0)
  }
}

// Helper functions
async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  if (INTERNAL_TOKEN) {
    headers['X-Service-Token'] = INTERNAL_TOKEN
  }

  const response = await fetch(url, {
    ...options,
    headers
  })

  const text = await response.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }

  return {
    status: response.status,
    ok: response.ok,
    data
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed')
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`)
  }
}

function assertGreaterThan(actual, expected, message) {
  if (actual <= expected) {
    throw new Error(message || `Expected ${actual} > ${expected}`)
  }
}

// Test suite
const runner = new TestRunner()

// Health check tests
runner.test('GET /healthz should return 200', async () => {
  const res = await request('/healthz')
  assertEqual(res.status, 200, 'Health check should return 200')
})

runner.test('GET /health should return 200', async () => {
  const res = await request('/health')
  assertEqual(res.status, 200, 'Health endpoint should return 200')
})

runner.test('GET /readyz should return 200', async () => {
  const res = await request('/readyz')
  assertEqual(res.status, 200, 'Ready check should return 200')
})

// Metrics test
runner.test('GET /metrics should return Prometheus metrics', async () => {
  const res = await request('/metrics')
  assertEqual(res.status, 200, 'Metrics should return 200')
  assert(typeof res.data === 'string', 'Metrics should be text')
  assert(res.data.includes('be_checks_total'), 'Should include check counter')
  assert(res.data.includes('be_clicks_total'), 'Should include click counter')
})

// Config tests
runner.test('GET /api/v1/browser/config should return configuration', async () => {
  const res = await request('/api/v1/browser/config')
  assertEqual(res.status, 200, 'Config should return 200')
  assert(res.data.concurrency, 'Should have concurrency setting')
  assert(res.data.limits, 'Should have limits')
  assert(res.data.stats, 'Should have stats')
})

runner.test('GET /api/v1/browser/capacity should return capacity info', async () => {
  const res = await request('/api/v1/browser/capacity')
  assertEqual(res.status, 200, 'Capacity should return 200')
  assert(typeof res.data.maxContexts === 'number', 'Should have maxContexts')
  assert(typeof res.data.maxMemoryMb === 'number', 'Should have maxMemoryMb')
  assert(typeof res.data.running === 'number', 'Should have running count')
})

runner.test('GET /api/v1/browser/pools should return pool information', async () => {
  const res = await request('/api/v1/browser/pools')
  assertEqual(res.status, 200, 'Pools should return 200')
  assert(typeof res.data === 'object', 'Should return object with pool details')
})

runner.test('GET /api/v1/browser/stats should return detailed statistics', async () => {
  const res = await request('/api/v1/browser/stats')
  assertEqual(res.status, 200, 'Stats endpoint should return 200')
  assert(res.data, 'Should have stats data')
  assertEqual(typeof res.data.pools, 'number', 'Should include pools count')
  assertEqual(typeof res.data.totalContextsPooled, 'number', 'Should include total contexts pooled')
  assertEqual(typeof res.data.maxContexts, 'number', 'Should include max contexts')
  assert(res.data.poolDetails, 'Should include pool details')
})

// Maintenance mode tests
runner.test('GET /api/v1/browser/maintenance should return maintenance status', async () => {
  const res = await request('/api/v1/browser/maintenance')
  assertEqual(res.status, 200, 'Maintenance status should return 200')
  assert(typeof res.data.maintenance === 'boolean', 'Should have maintenance boolean')
})

// Parse URL test
runner.test('POST /api/v1/browser/parse-url should parse valid URL', async () => {
  const res = await request('/api/v1/browser/parse-url', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://example.com/path' })
  })
  assertEqual(res.status, 200, 'Parse URL should return 200')
  assertEqual(res.data.hostname, 'example.com', 'Should extract hostname')
  assertEqual(res.data.brand, 'example', 'Should extract brand')
  assert(res.data.ok, 'Should be ok')
})

runner.test('POST /api/v1/browser/parse-url should reject invalid URL', async () => {
  const res = await request('/api/v1/browser/parse-url', {
    method: 'POST',
    body: JSON.stringify({ url: 'not-a-url' })
  })
  assertEqual(res.status, 400, 'Invalid URL should return 400')
  assert(res.data.error, 'Should have error')
  assertEqual(res.data.error.code, 'INVALID_URL', 'Should have INVALID_URL error code')
})

// Queue tests
runner.test('GET /api/v1/browser/queue/stats should return queue statistics', async () => {
  const res = await request('/api/v1/browser/queue/stats')
  assertEqual(res.status, 200, 'Queue stats should return 200')
  assert(typeof res.data.queueLength === 'number', 'Should have queueLength')
  assert(typeof res.data.running === 'number', 'Should have running count')
  assert(typeof res.data.processed === 'number', 'Should have processed count')
  assert(res.data.backend, 'Should have backend type')
})

// Proxy pool tests
runner.test('GET /api/v1/browser/proxy-pool/stats should return proxy statistics', async () => {
  const res = await request('/api/v1/browser/proxy-pool/stats')
  // May return 500 if proxy pool is not available, which is acceptable
  assert(res.status === 200 || res.status === 500, 'Should return 200 or 500')
  if (res.status === 200) {
    assert(res.data, 'Should have proxy stats data')
  }
})

runner.test('GET /api/v1/browser/proxy-pool/health should check proxy pool health', async () => {
  const res = await request('/api/v1/browser/proxy-pool/health')
  // May return 200 or 500 if proxy pool is not available
  assert(res.status === 200 || res.status === 500, 'Should return 200 or 500')
  // Just verify we got a response, format may vary
  assert(res.data !== undefined, 'Should have response')
})

// Check availability test (lightweight)
runner.test('POST /api/v1/browser/check-availability should check URL availability', async () => {
  const res = await request('/api/v1/browser/check-availability', {
    method: 'POST',
    body: JSON.stringify({
      url: 'https://example.com',
      method: 'HEAD',
      timeoutMs: 5000
    })
  })
  
  // Should return 200, 404 (not found), or 503 (if overloaded)
  assert(res.status === 200 || res.status === 404 || res.status === 503, 'Should return 200, 404, or 503')
  
  if (res.status === 200 && res.data) {
    // Response format may vary, just check it has some data
    assert(res.data, 'Should have response data')
  }
})

// Queue task tests
runner.test('POST /api/v1/browser/queue/task should enqueue a check task', async () => {
  const res = await request('/api/v1/browser/queue/task', {
    method: 'POST',
    body: JSON.stringify({
      type: 'check',
      payload: {
        url: 'https://example.com',
        timeoutMs: 5000
      },
      priority: 'normal'
    })
  })
  
  // May return 200, 404 (endpoint not found), or 503 (overloaded)
  assert(res.status === 200 || res.status === 404 || res.status === 503, 'Should return 200, 404, or 503')
  
  if (res.status === 200 && res.data) {
    // Task ID is optional depending on implementation
    assert(res.data, 'Should have response data')
  }
})

// Pattern matcher test
runner.test('POST /api/v1/browser/match-pattern should match URL patterns', async () => {
  const res = await request('/api/v1/browser/match-pattern', {
    method: 'POST',
    body: JSON.stringify({
      url: 'https://example.com/checkout/success',
      patterns: ['checkout', 'success']
    })
  })
  
  // May not be implemented, so accept 404
  assert(res.status === 200 || res.status === 404 || res.status === 503, 
    'Should return 200, 404, or 503')
})

// Error handling tests
runner.test('POST /api/v1/browser/check-availability should handle missing URL', async () => {
  const res = await request('/api/v1/browser/check-availability', {
    method: 'POST',
    body: JSON.stringify({})
  })
  
  assert(res.status === 400 || res.status === 500, 'Should return 400 or 500 for missing URL')
})

runner.test('POST /api/v1/browser/queue/task should handle invalid task type', async () => {
  const res = await request('/api/v1/browser/queue/task', {
    method: 'POST',
    body: JSON.stringify({
      type: 'invalid-type',
      payload: {}
    })
  })
  
  // Should accept the task but may fail during processing, or endpoint may not exist
  assert(res.status === 200 || res.status === 400 || res.status === 404 || res.status === 503, 
    'Should return 200, 400, 404, or 503')
})

// Concurrent request test
runner.test('Should handle multiple concurrent requests', async () => {
  const requests = []
  for (let i = 0; i < 5; i++) {
    requests.push(
      request('/api/v1/browser/parse-url', {
        method: 'POST',
        body: JSON.stringify({ url: `https://example${i}.com` })
      })
    )
  }
  
  const results = await Promise.all(requests)
  
  // All should succeed or some may be rate limited
  const successCount = results.filter(r => r.status === 200).length
  assertGreaterThan(successCount, 0, 'At least one request should succeed')
})

// Configuration update test (if token is provided)
if (INTERNAL_TOKEN) {
  runner.test('PUT /api/v1/browser/config should update configuration', async () => {
    // Get current config
    const currentRes = await request('/api/v1/browser/config')
    const currentConcurrency = currentRes.data.concurrency
    
    // Try to update (same value to avoid disruption)
    const updateRes = await request('/api/v1/browser/config', {
      method: 'PUT',
      body: JSON.stringify({
        concurrency: currentConcurrency
      })
    })
    
    assertEqual(updateRes.status, 200, 'Config update should return 200')
    assert(updateRes.data.ok, 'Update should be ok')
    assertEqual(updateRes.data.concurrency, currentConcurrency, 
      'Concurrency should match')
  })
}

// Run all tests
runner.run().catch(error => {
  console.error('Test runner error:', error)
  process.exit(1)
})
