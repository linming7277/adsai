# Browser-Exec 服务

## 概述

Browser-Exec 是 autoads 项目的浏览器自动化服务，负责执行网页抓取、截图、表单填充等浏览器自动化任务。本服务使用 Playwright 提供高性能、可靠的浏览器自动化能力。

### 核心功能

- ✅ **网页抓取**: 抓取网页内容和元数据
- ✅ **截图服务**: 生成网页截图
- ✅ **表单自动化**: 自动填充和提交表单
- ✅ **模式匹配**: 识别网页模式和结构
- ✅ **代理支持**: 支持代理 IP 池
- ✅ **队列管理**: 异步任务队列
- ✅ **浏览器池**: 复用浏览器实例提高性能
- ✅ **反检测**: Stealth 插件避免被检测

---

## 技术栈

- **语言**: Node.js 20+
- **框架**: Express
- **浏览器**: Playwright 1.47.0
- **反检测**: puppeteer-extra-plugin-stealth
- **数据库**: Cloud SQL PostgreSQL
- **缓存**: Redis (ioredis)
- **消息队列**: Pub/Sub
- **部署**: GCP Cloud Run (asia-northeast1)
- **监控**: Prometheus (prom-client)

---

## 本地开发

### 前置条件

- Node.js 20+
- Docker (可选)
- GCP 服务账号密钥: `secrets/gcp_codex_dev.json`
- 访问 Secret Manager 的权限

### 环境变量

```bash
# 服务配置
PORT=8080
NODE_ENV=development

# 数据库
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# Pub/Sub
PUBSUB_PROJECT_ID=gen-lang-client-0944935873
PUBSUB_TOPIC=browser-exec-tasks

# 代理配置
PROXY_URL_US=https://api.iprocket.io/api?...
PROXY_ENABLED=true

# 浏览器配置
BROWSER_POOL_SIZE=5
BROWSER_TIMEOUT=30000
HEADLESS=true
```

### 安装依赖

```bash
# 进入服务目录
cd services/browser-exec

# 安装依赖
npm install

# 安装 Playwright 浏览器
npx playwright install chromium
```

### 启动服务

```bash
# 开发模式
npm start

# 使用 Docker
docker build -t browser-exec:local .
docker run -p 8080:8080 browser-exec:local
```

---

## API 端点

### 认证

所有 API 端点需要 Supabase JWT Token：

```bash
Authorization: Bearer <supabase_jwt_token>
```

### 主要端点

#### 网页抓取

```bash
# 抓取网页内容
POST /api/v1/browser-exec/scrape
Content-Type: application/json

{
  "url": "https://example.com",
  "waitFor": "networkidle",
  "timeout": 30000,
  "useProxy": true
}

Response 200:
{
  "url": "https://example.com",
  "title": "Example Domain",
  "content": "<html>...</html>",
  "metadata": {
    "description": "...",
    "keywords": "..."
  },
  "screenshot": "base64_encoded_image"
}
```

#### 截图服务

```bash
# 生成网页截图
POST /api/v1/browser-exec/screenshot
Content-Type: application/json

{
  "url": "https://example.com",
  "fullPage": true,
  "width": 1920,
  "height": 1080
}

Response 200:
{
  "screenshot": "base64_encoded_image",
  "format": "png"
}
```

#### 表单自动化

```bash
# 填充并提交表单
POST /api/v1/browser-exec/form
Content-Type: application/json

{
  "url": "https://example.com/form",
  "fields": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "submit": true
}

Response 200:
{
  "success": true,
  "redirectUrl": "https://example.com/success"
}
```

#### 模式匹配

```bash
# 识别网页模式
POST /api/v1/browser-exec/pattern
Content-Type: application/json

{
  "url": "https://example.com",
  "patterns": ["ecommerce", "blog", "landing"]
}

Response 200:
{
  "matchedPattern": "ecommerce",
  "confidence": 0.95,
  "elements": {
    "productTitle": ".product-name",
    "price": ".product-price",
    "addToCart": ".add-to-cart-btn"
  }
}
```

#### 健康检查

```bash
# 健康检查
GET /health

# Prometheus 指标
GET /metrics
```

---

## 架构设计

### 浏览器池

```javascript
// pool.js
class BrowserPool {
  constructor(size = 5) {
    this.size = size;
    this.browsers = [];
    this.available = [];
  }
  
  async acquire() {
    // 获取可用浏览器实例
    if (this.available.length > 0) {
      return this.available.pop();
    }
    
    // 创建新实例
    if (this.browsers.length < this.size) {
      const browser = await this.createBrowser();
      this.browsers.push(browser);
      return browser;
    }
    
    // 等待可用实例
    return await this.waitForAvailable();
  }
  
  async release(browser) {
    this.available.push(browser);
  }
}
```

### 队列管理

```javascript
// queue-manager.js
class QueueManager {
  constructor() {
    this.queue = [];
    this.processing = new Map();
  }
  
  async enqueue(task) {
    this.queue.push(task);
    await this.publishToPubSub(task);
  }
  
  async process(task) {
    const browser = await browserPool.acquire();
    try {
      const result = await this.executeTask(browser, task);
      return result;
    } finally {
      await browserPool.release(browser);
    }
  }
}
```

### 代理支持

```javascript
// proxy-client.js
class ProxyClient {
  async getProxy(country = 'US') {
    const response = await fetch(process.env.PROXY_URL_US);
    const proxyUrl = await response.text();
    return proxyUrl.trim();
  }
  
  async testProxy(proxyUrl) {
    // 测试代理可用性
  }
}
```

---

## 配置说明

### 浏览器配置

```javascript
// Playwright 配置
const browserConfig = {
  headless: process.env.HEADLESS === 'true',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu'
  ],
  timeout: parseInt(process.env.BROWSER_TIMEOUT) || 30000
};
```

### 代理配置

```javascript
// 代理配置
const proxyConfig = {
  enabled: process.env.PROXY_ENABLED === 'true',
  url: process.env.PROXY_URL_US,
  rotation: 'per-request'  // 每个请求使用新代理
};
```

### 队列配置

```javascript
// 队列配置
const queueConfig = {
  maxConcurrent: 10,
  timeout: 60000,
  retries: 3
};
```

---

## 部署

### Preview 环境

```bash
# 推送到 main 分支自动触发部署
git push origin main

# 服务名: browser-exec-preview
```

### 生产环境

```bash
# 推送到 production 分支自动触发部署
git push origin production

# 服务名: browser-exec
```

### 部署配置

- **资源**: 2 CPU, 2Gi 内存 (浏览器需要更多资源)
- **并发**: 10
- **最大实例**: 10
- **超时**: 300 秒

---

## 故障排查

### 常见问题

#### 1. 浏览器启动失败

```bash
# 检查 Playwright 安装
npx playwright install --dry-run

# 检查依赖
npm list playwright

# 查看日志
gcloud run services logs read browser-exec-preview \
  --filter="textPayload:browser" \
  --limit=100
```

#### 2. 内存不足

```bash
# 增加内存限制
gcloud run services update browser-exec-preview \
  --memory=4Gi \
  --region=asia-northeast1

# 减少浏览器池大小
export BROWSER_POOL_SIZE=3
```

#### 3. 代理连接失败

```bash
# 测试代理
curl -x $PROXY_URL_US https://api.ipify.org

# 检查代理配置
echo $PROXY_ENABLED
echo $PROXY_URL_US
```

#### 4. 超时问题

```bash
# 增加超时时间
export BROWSER_TIMEOUT=60000

# 检查网络延迟
curl -w "@curl-format.txt" -o /dev/null -s https://example.com
```

---

## 开发指南

### 代码结构

```
services/browser-exec/
├── lib/                    # 核心库
│   ├── browser.js         # 浏览器管理
│   ├── scraper.js         # 抓取逻辑
│   └── screenshot.js      # 截图逻辑
├── patterns/              # 模式定义
│   ├── ecommerce.json
│   ├── blog.json
│   └── landing.json
├── index.js               # 主入口
├── pool.js                # 浏览器池
├── queue-manager.js       # 队列管理
├── proxy-client.js        # 代理客户端
├── pattern-matcher.js     # 模式匹配
└── package.json           # 依赖管理
```

### 添加新模式

```javascript
// patterns/custom.json
{
  "name": "custom",
  "selectors": {
    "title": "h1.title",
    "description": ".description",
    "cta": "button.cta"
  },
  "rules": [
    {
      "selector": "h1.title",
      "required": true
    }
  ]
}
```

### 测试

```bash
# 运行测试
npm test

# 测试特定功能
node test-scraper.js
```

---

## 性能优化

### 浏览器池优化

- 复用浏览器实例
- 限制并发数量
- 自动清理空闲实例

### 缓存策略

- 缓存抓取结果 (5 分钟)
- 缓存截图 (1 小时)
- 缓存模式匹配结果 (1 天)

### 代理优化

- 代理池管理
- 自动测试代理可用性
- 失败自动切换

---

## 监控和告警

### Prometheus 指标

- `browser_exec_requests_total`: 请求总数
- `browser_exec_duration_seconds`: 执行时长
- `browser_pool_size`: 浏览器池大小
- `browser_pool_available`: 可用浏览器数
- `proxy_requests_total`: 代理请求总数

### 告警规则

- 浏览器池耗尽: available = 0
- 执行超时率: >10%
- 代理失败率: >20%

---

## 安全注意事项

### 反检测

- 使用 Stealth 插件
- 随机 User-Agent
- 模拟真实用户行为

### 资源限制

- 限制并发请求
- 限制执行时间
- 限制内存使用

### 代理安全

- 使用可信代理服务商
- 定期轮换代理
- 监控代理质量

---

## 贡献指南

### 提交代码

1. 创建功能分支
2. 编写代码和测试
3. 确保所有测试通过
4. 创建 Pull Request

### 提交信息规范

- `feat(scraper)`: 抓取功能
- `feat(screenshot)`: 截图功能
- `fix(proxy)`: 代理修复
- `perf`: 性能优化

---

## 相关资源

- [Playwright 文档](https://playwright.dev/)
- [Stealth 插件](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth)
- [架构分析报告](../../docs/ArchitectureReviewV1/P1-FUNCTIONAL-SERVICES-ANALYSIS.md)

---

**最后更新**: 2025-10-08  
**维护者**: 后端团队  
**技术**: Node.js + Playwright  
**状态**: ✅ 生产就绪
