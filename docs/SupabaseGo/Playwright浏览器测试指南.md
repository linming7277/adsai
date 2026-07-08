# Playwright浏览器测试指南

## 一、现有Playwright基础设施

AutoAds项目已内置完整的Playwright浏览器自动化基础设施，核心是**browser-exec**微服务。

### 1.1 Browser-Exec服务架构

```
browser-exec (Node.js + Playwright)
├── API服务 (Express)         # RESTful API接口
├── Browser Pool              # 浏览器实例池管理
├── Task Queue                # 任务队列（Redis/内存）
├── Proxy Pool Integration    # 集成代理IP池
└── Metrics                   # Prometheus监控指标
```

**技术栈**：
- Playwright 1.47.0 (核心浏览器自动化)
- Playwright-extra 4.3.6 (插件系统)
- Puppeteer-extra-plugin-stealth (反检测)
- Express 4.19.2 (HTTP API)
- IORedis 5.4.1 (任务队列)
- Pub/Sub (异步事件)

**部署环境**：
- Preview: https://browser-exec-preview-latest-uc.a.run.app
- Production: https://browser-exec-yt54xvsg5q-an.a.run.app
- Cloud Run配置: 2 CPU, 2Gi内存

---

## 二、如何使用Playwright进行测试

### 2.1 方式一：通过browser-exec API (推荐)

**优势**：
- ✅ 无需本地安装Playwright浏览器
- ✅ 统一代理IP管理
- ✅ 自动反爬虫处理
- ✅ 任务队列支持
- ✅ 开箱即用

#### API端点列表

| 端点 | 方法 | 功能 | 用途 |
|------|------|------|------|
| `/api/v1/browser/check-availability` | POST | 检查URL可访问性 | 快速探测 |
| `/api/v1/browser/simulate-click` | POST | 模拟点击操作 | 验证转化链路 |
| `/api/v1/browser/resolve-offer` | POST | 解析Offer跳转链 | 获取最终落地页 |
| `/api/v1/browser/queue/task` | POST | 提交异步任务 | 批量处理 |
| `/api/v1/browser/queue/stats` | GET | 查看队列状态 | 监控任务进度 |

#### 示例1: 检查URL可用性

```javascript
const response = await fetch('https://browser-exec-preview-xxx.run.app/api/v1/browser/check-availability', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Token': process.env.BROWSER_INTERNAL_TOKEN // 可选
  },
  body: JSON.stringify({
    url: 'https://example.com',
    method: 'HEAD',        // 或 'GET'
    timeoutMs: 5000,
    useProxy: true,        // 使用代理IP
    country: 'US'          // 指定代理国家
  })
})

const result = await response.json()
console.log(result)
// {
//   "ok": true,
//   "statusCode": 200,
//   "finalUrl": "https://example.com",
//   "durationMs": 1234,
//   "proxyUsed": "us-proxy-01"
// }
```

#### 示例2: 模拟用户点击

```javascript
const response = await fetch('https://browser-exec-xxx.run.app/api/v1/browser/simulate-click', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://offer-landing-page.com',
    selector: 'button.cta',      // CSS选择器
    waitForNavigation: true,     // 等待页面跳转
    captureScreenshot: true,     // 截图
    timeoutMs: 15000,
    useProxy: true,
    country: 'US'
  })
})

const result = await response.json()
// {
//   "ok": true,
//   "finalUrl": "https://conversion-page.com",
//   "clicked": true,
//   "screenshot": "base64-encoded-image",
//   "durationMs": 5678
// }
```

#### 示例3: 解析Offer跳转链

```javascript
const response = await fetch('https://browser-exec-xxx.run.app/api/v1/browser/resolve-offer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://tracking-link.com/click?offer=123',
    followRedirects: true,       // 跟随重定向
    maxRedirects: 10,            // 最多10次
    captureChain: true,          // 记录完整跳转链
    useProxy: true,
    country: 'US'
  })
})

const result = await response.json()
// {
//   "ok": true,
//   "finalUrl": "https://final-landing-page.com",
//   "chain": [
//     "https://tracking-link.com/click?offer=123",
//     "https://redirect-1.com",
//     "https://redirect-2.com",
//     "https://final-landing-page.com"
//   ],
//   "redirectCount": 3,
//   "durationMs": 8900
// }
```

#### 示例4: 提交异步任务

```javascript
// 提交任务
const submitRes = await fetch('https://browser-exec-xxx.run.app/api/v1/browser/queue/task', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'check',
    payload: {
      url: 'https://example.com',
      timeoutMs: 10000
    },
    priority: 'normal'  // 'high' | 'normal' | 'low'
  })
})

const { taskId } = await submitRes.json()

// 轮询任务状态
const statsRes = await fetch('https://browser-exec-xxx.run.app/api/v1/browser/queue/stats')
const stats = await statsRes.json()
// {
//   "queueLength": 5,
//   "running": 2,
//   "processed": 123,
//   "backend": "redis"
// }
```

---

### 2.2 方式二：编写自定义Playwright测试脚本

**适用场景**：
- 需要复杂交互逻辑
- 本地开发调试
- CI/CD集成测试

#### 创建测试项目

```bash
# 1. 创建测试目录
mkdir -p scripts/tests/playwright
cd scripts/tests/playwright

# 2. 初始化package.json
npm init -y

# 3. 安装依赖
npm install --save-dev \
  @playwright/test@1.47.0 \
  playwright@1.47.0

# 4. 安装浏览器
npx playwright install chromium
```

#### 示例测试: 登录流程测试

```javascript
// tests/login.spec.js
import { test, expect } from '@playwright/test'

test.describe('AutoAds Frontend Login', () => {
  test('should login with Google OAuth', async ({ page }) => {
    // 1. 访问登录页
    await page.goto('https://www.urlchecker.dev/auth/sign-in')

    // 2. 点击Google登录按钮
    await page.click('button:has-text("Sign in with Google")')

    // 3. Google OAuth流程 (需要配置测试账号)
    await page.waitForURL('**/auth/callback*')

    // 4. 验证跳转到Dashboard
    await expect(page).toHaveURL(/\/dashboard/)

    // 5. 验证用户信息加载
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible()
  })

  test('should redirect to sign-in for unauthenticated users', async ({ page }) => {
    // 直接访问Dashboard
    await page.goto('https://www.urlchecker.dev/dashboard')

    // 应该被重定向到登录页
    await expect(page).toHaveURL(/\/auth\/sign-in/)
  })
})
```

#### 示例测试: Offer创建流程

```javascript
// tests/offers.spec.js
import { test, expect } from '@playwright/test'

test.describe('Offer Management', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前先登录
    await loginAsTestUser(page)
  })

  test('should create new offer', async ({ page }) => {
    // 1. 进入Offers页面
    await page.goto('https://www.urlchecker.dev/dashboard/offers')

    // 2. 点击创建按钮
    await page.click('[data-testid="create-offer-btn"]')

    // 3. 填写表单
    await page.fill('input[name="title"]', 'Test Offer')
    await page.fill('input[name="url"]', 'https://example.com/offer')
    await page.fill('input[name="payout"]', '10.00')

    // 4. 提交
    await page.click('button:has-text("Create")')

    // 5. 验证成功提示
    await expect(page.locator('.toast-success')).toBeVisible()
    await expect(page.locator('.toast-success')).toContainText('Offer created')

    // 6. 验证出现在列表中
    await expect(page.locator('text=Test Offer')).toBeVisible()
  })

  test('should validate offer URL', async ({ page }) => {
    await page.goto('https://www.urlchecker.dev/dashboard/offers')
    await page.click('[data-testid="create-offer-btn"]')

    // 提交无效URL
    await page.fill('input[name="url"]', 'not-a-valid-url')
    await page.click('button:has-text("Create")')

    // 验证错误提示
    await expect(page.locator('.error-message')).toContainText('Invalid URL')
  })
})

async function loginAsTestUser(page) {
  // 使用Supabase测试账号登录
  // 实现细节根据实际认证流程调整
  await page.goto('https://www.urlchecker.dev/auth/sign-in')
  // ... OAuth流程
}
```

#### 示例测试: Browser-Exec健康检查

```javascript
// tests/browser-exec-health.spec.js
import { test, expect } from '@playwright/test'

const BROWSER_EXEC_URL = 'https://browser-exec-preview-xxx.run.app'

test.describe('Browser-Exec Service Health', () => {
  test('health endpoints should return 200', async ({ request }) => {
    const endpoints = ['/health', '/healthz', '/readyz']

    for (const endpoint of endpoints) {
      const response = await request.get(`${BROWSER_EXEC_URL}${endpoint}`)
      expect(response.status()).toBe(200)
    }
  })

  test('metrics endpoint should return Prometheus format', async ({ request }) => {
    const response = await request.get(`${BROWSER_EXEC_URL}/metrics`)
    expect(response.status()).toBe(200)

    const text = await response.text()
    expect(text).toContain('be_checks_total')
    expect(text).toContain('be_clicks_total')
    expect(text).toContain('be_pool_shared_contexts')
  })

  test('config endpoint should return valid configuration', async ({ request }) => {
    const response = await request.get(`${BROWSER_EXEC_URL}/api/v1/browser/config`)
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('concurrency')
    expect(data).toHaveProperty('limits')
    expect(data).toHaveProperty('stats')
  })

  test('should check URL availability', async ({ request }) => {
    const response = await request.post(`${BROWSER_EXEC_URL}/api/v1/browser/check-availability`, {
      data: {
        url: 'https://google.com',
        method: 'HEAD',
        timeoutMs: 5000
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.ok).toBe(true)
  })
})
```

#### 配置文件: playwright.config.js

```javascript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,              // 30秒超时
  fullyParallel: true,         // 并行执行
  forbidOnly: !!process.env.CI, // CI环境禁止.only
  retries: process.env.CI ? 2 : 0, // CI环境重试2次
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',            // HTML报告

  use: {
    baseURL: 'https://www.urlchecker.dev',
    trace: 'on-first-retry',   // 失败时记录trace
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // 移动设备测试
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
})
```

#### 运行测试

```bash
# 运行所有测试
npx playwright test

# 运行指定测试
npx playwright test tests/login.spec.js

# 调试模式
npx playwright test --debug

# 生成HTML报告
npx playwright show-report

# CI环境运行
CI=true npx playwright test
```

---

### 2.3 方式三：扩展browser-exec服务

**适用场景**：
- 需要添加新的浏览器自动化功能
- 需要集成到现有微服务架构

#### 添加新的API端点

```javascript
// services/browser-exec/index.js

// 新增端点: 表单填充测试
app.post('/api/v1/browser/fill-form', async (req, res) => {
  const { url, formData, submit, timeoutMs = 10000 } = req.body

  if (!url || !formData) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'url and formData are required' }
    })
  }

  const start = Date.now()
  let page

  try {
    const ctx = await pool.getContext()
    page = await ctx.newPage()

    // 访问页面
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: timeoutMs
    })

    // 填充表单
    for (const [selector, value] of Object.entries(formData)) {
      await page.fill(selector, value)
    }

    // 如果需要提交
    if (submit) {
      const submitSelector = submit.selector || 'button[type="submit"]'
      await page.click(submitSelector)

      if (submit.waitForNavigation) {
        await page.waitForNavigation({ timeout: timeoutMs })
      }
    }

    // 截图
    const screenshot = await page.screenshot({
      type: 'png',
      encoding: 'base64'
    })

    const finalUrl = page.url()
    const duration = Date.now() - start

    res.json({
      ok: true,
      finalUrl,
      screenshot,
      durationMs: duration
    })

  } catch (error) {
    res.status(500).json({
      error: {
        code: 'FILL_FORM_FAILED',
        message: error.message
      }
    })
  } finally {
    if (page) await page.close()
  }
})
```

#### 测试新端点

```javascript
// services/browser-exec/integration.test.js

runner.test('POST /api/v1/browser/fill-form should fill and submit form', async () => {
  const res = await request('/api/v1/browser/fill-form', {
    method: 'POST',
    body: JSON.stringify({
      url: 'https://example.com/contact',
      formData: {
        'input[name="name"]': 'Test User',
        'input[name="email"]': 'test@example.com',
        'textarea[name="message"]': 'Test message'
      },
      submit: {
        selector: 'button[type="submit"]',
        waitForNavigation: true
      },
      timeoutMs: 15000
    })
  })

  assertEqual(res.status, 200)
  assert(res.data.ok, 'Form fill should succeed')
  assert(res.data.screenshot, 'Should include screenshot')
})
```

---

## 三、集成到CI/CD

### 3.1 GitHub Actions集成

```yaml
# .github/workflows/playwright-tests.yml
name: Playwright Tests

on:
  push:
    branches: [main, production]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: scripts/tests/playwright
        run: npm ci

      - name: Install Playwright Browsers
        working-directory: scripts/tests/playwright
        run: npx playwright install --with-deps chromium

      - name: Run Playwright tests
        working-directory: scripts/tests/playwright
        env:
          BASE_URL: https://www.urlchecker.dev
          BROWSER_EXEC_URL: https://browser-exec-preview-xxx.run.app
        run: npx playwright test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: scripts/tests/playwright/playwright-report/
          retention-days: 30
```

### 3.2 使用现有的integration.test.js

```yaml
# .github/workflows/browser-exec-test.yml
name: Browser-Exec Integration Tests

on:
  push:
    paths:
      - 'services/browser-exec/**'
  schedule:
    - cron: '0 */6 * * *'  # 每6小时运行一次

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Test Preview Environment
        working-directory: services/browser-exec
        env:
          BROWSER_EXEC_URL: https://browser-exec-preview-xxx.run.app
          BROWSER_INTERNAL_TOKEN: ${{ secrets.BROWSER_INTERNAL_TOKEN }}
        run: npm test

      - name: Test Production Environment
        working-directory: services/browser-exec
        env:
          BROWSER_EXEC_URL: https://browser-exec-yt54xvsg5q-an.a.run.app
          BROWSER_INTERNAL_TOKEN: ${{ secrets.BROWSER_INTERNAL_TOKEN }}
        run: npm test
```

---

## 四、最佳实践

### 4.1 性能优化

```javascript
// ✅ 使用共享浏览器上下文（browser-exec自动管理）
// ✅ 设置合理的超时时间
// ✅ 使用waitForSelector而不是sleep

// ❌ 错误做法
await page.waitForTimeout(5000)  // 固定等待

// ✅ 正确做法
await page.waitForSelector('.result', { timeout: 5000 })
```

### 4.2 反爬虫对策

Browser-exec已集成`puppeteer-extra-plugin-stealth`，自动处理：
- User-Agent随机化
- WebDriver标志移除
- Canvas指纹混淆
- 代理IP轮换

### 4.3 错误处理

```javascript
try {
  const response = await fetch(BROWSER_EXEC_URL + '/api/v1/browser/check-availability', {
    method: 'POST',
    body: JSON.stringify({ url, timeoutMs: 10000 })
  })

  if (response.status === 503) {
    // 服务过载，稍后重试
    console.log('Browser-exec overloaded, retrying...')
    await new Promise(r => setTimeout(r, 5000))
    // 重试逻辑
  }

  if (response.status === 404) {
    // URL不可达
    console.log('Target URL not reachable')
  }

  const result = await response.json()
  // 处理结果

} catch (error) {
  // 网络错误或超时
  console.error('Request failed:', error.message)
}
```

### 4.4 监控与调试

```bash
# 查看browser-exec实时指标
curl https://browser-exec-xxx.run.app/metrics

# 关键指标:
# - be_pool_shared_contexts: 浏览器上下文数量
# - be_running_tasks: 正在运行的任务
# - be_task_duration_ms: 任务执行时长
# - be_capacity_exhausted_total: 容量耗尽次数

# 查看队列状态
curl https://browser-exec-xxx.run.app/api/v1/browser/queue/stats

# 查看服务配置
curl https://browser-exec-xxx.run.app/api/v1/browser/config
```

---

## 五、常见问题

### Q1: 如何处理需要登录的页面？

**方案A**: 通过API传递Cookie

```javascript
await fetch(BROWSER_EXEC_URL + '/api/v1/browser/check-availability', {
  method: 'POST',
  body: JSON.stringify({
    url: 'https://app.example.com/dashboard',
    cookies: [
      { name: 'session_id', value: 'xxx', domain: '.example.com' }
    ]
  })
})
```

**方案B**: 扩展browser-exec添加登录端点（参考2.3节）

### Q2: 如何调试Playwright测试失败？

```bash
# 1. 启用调试模式
PWDEBUG=1 npx playwright test

# 2. 查看trace文件
npx playwright show-trace trace.zip

# 3. 启用视频录制
# playwright.config.js: video: 'on'

# 4. 查看浏览器console
page.on('console', msg => console.log('PAGE LOG:', msg.text()))
```

### Q3: Browser-exec返回503如何处理？

503表示服务容量不足，建议：
1. 使用任务队列API（`/api/v1/browser/queue/task`）
2. 实现指数退避重试
3. 联系管理员调整`concurrency`配置

### Q4: 如何在本地运行browser-exec？

```bash
cd services/browser-exec
npm install
npx playwright install chromium
PORT=8080 npm start

# 运行测试
BROWSER_EXEC_URL=http://localhost:8080 npm test
```

---

## 六、参考资料

- [Playwright官方文档](https://playwright.dev/docs/intro)
- [Browser-Exec源码](../../services/browser-exec/)
- [集成测试示例](../../services/browser-exec/integration.test.js)
- [API文档](../../services/browser-exec/README.md) (如存在)

---

## 七、快速开始清单

- [ ] 阅读本文档第二章节
- [ ] 尝试调用browser-exec API进行简单测试
- [ ] 运行`services/browser-exec/integration.test.js`
- [ ] (可选) 创建自定义Playwright测试项目
- [ ] (可选) 集成到CI/CD流程
- [ ] 查看Prometheus监控指标

---

**更新日期**: 2025-10-11
**维护者**: AutoAds团队
