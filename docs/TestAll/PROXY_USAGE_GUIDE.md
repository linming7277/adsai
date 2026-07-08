# 代理使用指南

## 概述

所有浏览器场景的E2E测试都建议使用代理，以模拟真实用户的访问环境，特别是在测试国际化功能（如US市场Offer评估）时。

## 代理配置

### 代理提供商

**iprocket Residential Proxy**
- 提供商：iprocket.io
- 类型：住宅代理（Residential）
- 协议：HTTP
- 区域：US / ROW (Rest of World)

### 获取代理IP

代理IP通过HTTP API动态获取：

```bash
PROXY_URL="https://api.iprocket.io/api?username=com49692430&password=Qxi9V59e3kNOW6pnRi3i&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt"

curl "$PROXY_URL"
```

**返回格式**:
```
host:port:username:password
```

例如：
```
172.105.185.54:5959:user123:pass456
```

### 批量获取代理IP

通过`ips`参数控制获取数量：

```bash
# 获取5个代理IP
curl "https://api.iprocket.io/api?username=com49692430&password=Qxi9V59e3kNOW6pnRi3i&cc=ROW&ips=5&type=-res-&proxyType=http&responseType=txt"
```

返回多行，每行一个代理IP。

---

## 使用方法

### 方法1: 环境变量配置（推荐）

设置环境变量后运行测试：

```bash
# 设置代理URL
export PROXY_URL_US="https://api.iprocket.io/api?username=com49692430&password=Qxi9V59e3kNOW6pnRi3i&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt"

# 运行测试（默认使用代理）
node scripts/tests/test-real-offer-evaluation.mjs

# 或禁用代理
USE_PROXY=false node scripts/tests/test-real-offer-evaluation.mjs
```

### 方法2: 在测试脚本中使用

```javascript
import { setupBrowserWithProxy, getProxyConfig } from './helpers/proxy.mjs';

// 方式A: 直接启动带代理的浏览器
const browser = await setupBrowserWithProxy({
  headless: false,
  useProxy: true
});

// 方式B: 手动配置代理
const proxyConfig = await getProxyConfig();
const browser = await chromium.launch({
  headless: false,
  proxy: proxyConfig
});

// 代理配置格式：
// {
//   server: 'http://172.105.185.54:5959',
//   username: 'user123',
//   password: 'pass456'
// }
```

### 方法3: 测试代理连接

```bash
PROXY_URL_US="<your-proxy-url>" \
node scripts/tests/helpers/proxy.mjs
```

输出：
```
🔌 测试代理连接...

   → 获取1个代理IP...
   ✓ 成功获取1个代理IP
   ✓ 代理配置: http://172.105.185.54:5959
   → 访问IP检测服务...
   ✓ 代理IP: 45.128.xxx.xxx
   ✓ 代理服务器: http://172.105.185.54:5959
   ✓ 代理连接正常
```

---

## 代理辅助工具 API

### `getProxyConfig(forceRefresh)`

获取单个代理配置（带5分钟缓存）。

**参数**:
- `forceRefresh` (boolean): 是否强制刷新缓存，默认false

**返回**:
```javascript
{
  server: 'http://host:port',
  username: 'user',
  password: 'pass',
  raw: {
    host: '172.105.185.54',
    port: '5959',
    username: 'user',
    password: 'pass'
  }
}
```

**示例**:
```javascript
import { getProxyConfig } from './helpers/proxy.mjs';

const proxy = await getProxyConfig();
console.log(proxy.server); // http://172.105.185.54:5959
```

---

### `getMultipleProxyConfigs(count)`

获取多个代理配置（用于并行测试）。

**参数**:
- `count` (number): 代理IP数量，默认5

**返回**: 代理配置数组

**示例**:
```javascript
import { getMultipleProxyConfigs } from './helpers/proxy.mjs';

const proxies = await getMultipleProxyConfigs(10);
console.log(`获取了${proxies.length}个代理IP`);
```

---

### `setupBrowserWithProxy(options)`

启动配置了代理的Playwright浏览器。

**参数**:
```javascript
{
  headless: false,       // 是否无头模式
  useProxy: true,        // 是否使用代理
  ...otherOptions        // 其他Playwright选项
}
```

**返回**: Playwright Browser实例

**示例**:
```javascript
import { setupBrowserWithProxy } from './helpers/proxy.mjs';

// 使用代理启动浏览器
const browser = await setupBrowserWithProxy({
  headless: false,
  useProxy: true
});

const context = await browser.newContext();
const page = await context.newPage();

await page.goto('https://example.com');
await browser.close();
```

---

### `testProxyConnection()`

测试代理连接是否正常。

**返回**: Promise<boolean>

**示例**:
```javascript
import { testProxyConnection } from './helpers/proxy.mjs';

const isWorking = await testProxyConnection();
if (!isWorking) {
  console.error('代理连接失败');
  process.exit(1);
}
```

---

## 代理缓存机制

为避免频繁请求代理API，代理IP会被缓存**5分钟**：

```javascript
// 首次调用 - 从API获取
const proxy1 = await getProxyConfig();
// ✓ 使用缓存的代理IP

// 5分钟内再次调用 - 使用缓存
const proxy2 = await getProxyConfig();
// ✓ 使用缓存的代理IP

// 强制刷新缓存
const proxy3 = await getProxyConfig(true);
// → 获取1个代理IP...
// ✓ 成功获取1个代理IP
```

---

## 环境变量

| 变量名 | 说明 | 默认值 |
|-------|------|--------|
| **PROXY_URL_US** | US代理API地址 | iprocket API URL |
| **USE_PROXY** | 是否使用代理 | true |
| **HEADLESS** | 无头模式 | false |

---

## 使用场景

### 场景1: Offer评估测试（US市场）

```bash
# 使用US代理测试
PROXY_URL_US="<proxy-url>" \
USE_PROXY=true \
node scripts/tests/test-real-offer-evaluation.mjs
```

**为什么需要代理**:
- SimilarWeb数据可能因地理位置不同而不同
- 确保获取US市场的真实数据
- 避免IP被限流或封禁

---

### 场景2: 并行测试（多个Offer同时评估）

```javascript
import { getMultipleProxyConfigs } from './helpers/proxy.mjs';
import { chromium } from 'playwright';

// 获取10个代理IP
const proxies = await getMultipleProxyConfigs(10);

// 为每个测试分配一个独立代理
const testPromises = offers.map(async (offer, index) => {
  const browser = await chromium.launch({
    proxy: proxies[index % proxies.length]
  });

  // 执行测试...

  await browser.close();
});

await Promise.all(testPromises);
```

---

### 场景3: 禁用代理（快速测试/本地开发）

```bash
# 完全禁用代理
USE_PROXY=false node scripts/tests/test-real-offer-evaluation.mjs

# 或者直接运行（不设置PROXY_URL_US环境变量时会自动降级为直连）
node scripts/tests/test-real-offer-evaluation.mjs
```

---

## 故障排查

### 问题1: 代理连接超时

**现象**:
```
❌ 代理连接失败: page.goto: net::ERR_EMPTY_RESPONSE
```

**可能原因**:
1. 代理IP已过期或失效
2. 代理认证失败
3. 目标网站阻止代理IP

**解决方法**:
```bash
# 1. 强制刷新代理IP
const proxy = await getProxyConfig(true);

# 2. 测试代理连接
node scripts/tests/helpers/proxy.mjs

# 3. 禁用代理测试
USE_PROXY=false node your-test.mjs
```

---

### 问题2: 代理API返回空列表

**现象**:
```
❌ 获取代理IP失败: 代理API返回空列表
```

**可能原因**:
1. API配额用尽
2. 账号被封禁
3. 网络问题

**解决方法**:
```bash
# 手动测试API
curl "https://api.iprocket.io/api?username=com49692430&password=Qxi9V59e3kNOW6pnRi3i&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt"

# 检查返回结果
```

---

### 问题3: 代理速度慢

**现象**:
测试执行时间明显变长。

**解决方法**:
```bash
# 1. 切换到直连模式快速测试
USE_PROXY=false node your-test.mjs

# 2. 获取多个IP，选择最快的
# （需要在代理工具中实现延迟检测）

# 3. 调整超时时间
page.goto(url, { timeout: 30000 });
```

---

## 最佳实践

### 1. 生产环境测试必须使用代理

```bash
# ✅ 推荐
PROXY_URL_US="<proxy-url>" node scripts/tests/test-real-offer-evaluation.mjs

# ❌ 不推荐（可能获取到错误的数据）
USE_PROXY=false node scripts/tests/test-real-offer-evaluation.mjs
```

### 2. 本地开发可以禁用代理

```bash
# 本地快速迭代
USE_PROXY=false node your-test.mjs
```

### 3. CI/CD管道配置代理

```yaml
# GitHub Actions示例
- name: Run E2E Tests with Proxy
  env:
    PROXY_URL_US: ${{ secrets.PROXY_URL_US }}
    USE_PROXY: true
  run: node scripts/tests/test-real-offer-evaluation.mjs
```

### 4. 监控代理使用情况

```javascript
import { getProxyConfig } from './helpers/proxy.mjs';

// 记录代理使用
const proxy = await getProxyConfig();
console.log(`使用代理: ${proxy.server}`);

// 测试完成后记录
console.log('测试完成，代理工作正常');
```

---

## 参考资料

- [iprocket API 文档](https://iprocket.io/docs)
- [Playwright Proxy 配置](https://playwright.dev/docs/network#http-proxy)
- [scripts/tests/helpers/proxy.mjs](../../scripts/tests/helpers/proxy.mjs) - 代理工具源码
- [scripts/tests/fixtures/real-test-data.json](../../scripts/tests/fixtures/real-test-data.json) - 测试数据配置

---

**最后更新**: 2025-10-16
**维护者**: AdsAI QA Team
