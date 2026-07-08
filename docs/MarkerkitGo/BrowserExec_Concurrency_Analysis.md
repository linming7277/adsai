# Browser-Exec 并发能力分析与优化方案

## 🔍 崩溃原因分析

### 崩溃现象

**时间**: 2025-10-02 02:26:38
**触发**: 4个并发请求同时到达
**错误**: `cdpSession.send: Target page, context or browser has been closed`
**结果**: 服务返回503，实例自动重启

### 根本原因

#### 1. **冷启动并发问题** ⚠️

```
服务启动 (02:26:39)
  ↓
4个请求同时到达 (02:26:38) ← 在服务完全ready之前
  ↓
同时创建4个浏览器context
  ↓
内存/CPU压力过大
  ↓
浏览器进程崩溃 ❌
```

**问题点**:
- Cloud Run实例刚启动，还没完全预热
- 4个请求同时创建浏览器上下文
- Playwright启动需要时间，并发启动压力大

#### 2. **资源配置不匹配** ⚠️

**当前配置**:
```yaml
Memory: 2Gi
CPU: 2核
Concurrency: 80  ← 问题所在！
BROWSER_MAX_CONTEXTS: 12
BROWSER_MAX_CONCURRENCY: 4
```

**矛盾**:
- Cloud Run允许80个并发请求
- 但浏览器只能处理4个并发任务（BROWSER_MAX_CONCURRENCY）
- 超过4个请求会排队或创建新的浏览器实例，导致资源耗尽

#### 3. **浏览器资源消耗** 📊

每个Chromium实例的资源消耗：
```
基础内存: 150-200MB
峰值内存: 300-400MB (加载复杂页面)
CPU: 0.2-0.5核 (正常) / 1-2核 (Cloudflare求解)
```

**2Gi内存能支持**:
- 理论: 2048MB ÷ 300MB = **6-7个并发浏览器context**
- 实际: 考虑系统开销，**安全值是4-5个**

**2 CPU能支持**:
- 理论: 2核 ÷ 0.3核 = **6个并发任务**
- 实际: Cloudflare求解时需要1核，**安全值是2-3个**

#### 4. **没有请求排队机制** ⚠️

当前代码没有并发控制：
```javascript
// 当前: 所有请求直接进入处理
app.post('/api/v1/browser/visit', async (req, res) => {
  // 没有检查当前并发数
  // 没有排队机制
  const result = await visitPage(url, config) // ← 直接执行
})
```

---

## 📊 当前并发能力评估

### 实际并发能力

基于2Gi内存 + 2CPU配置：

| 场景 | 理论并发 | 实际并发 | 瓶颈 |
|------|---------|---------|------|
| **简单页面** (无Cloudflare) | 6-7个 | **4-5个** | 内存 |
| **复杂页面** (有Cloudflare) | 3-4个 | **2-3个** | CPU |
| **冷启动** | 1-2个 | **1个** | 启动时间 |
| **稳定运行** | 5-6个 | **4个** | 配置的BROWSER_MAX_CONCURRENCY |

### Cloud Run配置问题

**Concurrency: 80** 是**严重错误**：
- Cloud Run会同时转发80个请求到一个实例
- 但浏览器只能处理4个
- 剩余76个请求会排队等待或超时

---

## 🔧 解决方案

### 方案1: 修正Cloud Run并发配置（立即）⭐⭐⭐⭐⭐

**修改**:
```yaml
concurrency: 4  # 从80改为4，匹配BROWSER_MAX_CONCURRENCY
```

**效果**:
- ✅ Cloud Run会在达到4个并发后自动创建新实例
- ✅ 每个实例只处理4个并发，避免过载
- ✅ 自动水平扩展支持更多用户

**部署命令**:
```bash
gcloud run deploy browser-exec-preview \
  --image <current-image> \
  --region asia-northeast1 \
  --concurrency 4 \
  --max-instances 20 \
  --min-instances 1 \
  --memory 2Gi \
  --cpu 2
```

**成本影响**:
- 增加实例数量，但总体QPS提升
- 例如: 10个并发用户需要3个实例（10÷4=2.5）

---

### 方案2: 增加内存和CPU（短期）⭐⭐⭐⭐

**升级配置**:
```yaml
memory: 4Gi  # 从2Gi升级到4Gi
cpu: 4       # 从2核升级到4核
concurrency: 8
BROWSER_MAX_CONCURRENCY: 8
```

**效果**:
- ✅ 支持8个并发请求
- ✅ 更大的内存缓冲
- ⚠️ 成本翻倍

**适用场景**: 并发需求中等（10-50 QPS）

---

### 方案3: 实现请求队列（中期）⭐⭐⭐⭐⭐

**添加并发控制**:
```javascript
// 在services/browser-exec/index.js中添加
import pLimit from 'p-limit'

const MAX_CONCURRENT = Number(process.env.BROWSER_MAX_CONCURRENCY || 4)
const limit = pLimit(MAX_CONCURRENT)

app.post('/api/v1/browser/visit', async (req, res) => {
  // 请求进入队列
  const result = await limit(() => visitPage(url, config))
  res.json(result)
})
```

**效果**:
- ✅ 超过4个请求会自动排队
- ✅ 避免并发过载
- ✅ 请求不会被拒绝，只是等待

**配合**:
```yaml
concurrency: 20  # 允许20个请求排队
timeout: 600s    # 增加超时到10分钟
```

---

### 方案4: 浏览器池预热（中期）⭐⭐⭐⭐

**实现预热机制**:
```javascript
// 在services/browser-exec/pool.js中添加
class BrowserPool {
  async warmUp(count = 2) {
    console.log(`[pool] Warming up ${count} browser instances...`)
    for (let i = 0; i < count; i++) {
      await this.getBrowserContext({ poolKey: `warm-${i}` })
    }
  }
}

// 启动时预热
if (process.env.BROWSER_POOL_MIN_WARM > 0) {
  globalBrowserPool.warmUp(Number(process.env.BROWSER_POOL_MIN_WARM))
}
```

**配置**:
```yaml
BROWSER_POOL_MIN_WARM: 2  # 启动时预热2个浏览器
min-instances: 1          # 保持1个实例始终运行
```

**效果**:
- ✅ 首次请求不需要等待浏览器启动
- ✅ 冷启动并发能力提升
- ⚠️ 增加内存占用（每个预热浏览器200MB）

---

### 方案5: 共享浏览器实例（长期）⭐⭐⭐⭐⭐

**当前模式**: 每个请求池一个浏览器实例
**优化模式**: 所有请求共享浏览器实例，只创建不同的context

```javascript
class BrowserPool {
  async getSharedBrowser(launchOpts) {
    if (!this.sharedBrowser) {
      this.sharedBrowser = await playwright.chromium.launch(launchOpts)
    }
    return this.sharedBrowser
  }

  async getBrowserContext(opts) {
    const browser = await this.getSharedBrowser(opts.launchOpts)
    const context = await browser.newContext(opts.contextOpts)
    return context
  }
}
```

**效果**:
- ✅ 内存占用大幅减少（共享浏览器进程）
- ✅ 启动速度更快（context创建比browser创建快10x）
- ✅ 支持更高并发（12个context只需要200-300MB）

**风险**:
- ⚠️ 浏览器崩溃会影响所有请求
- ⚠️ 需要更好的隔离机制

---

## 🎯 推荐实施方案

### 第一阶段：立即修复（今天）

1. **修正concurrency配置** ✅
```bash
gcloud run deploy browser-exec-preview \
  --region asia-northeast1 \
  --concurrency 4 \
  --max-instances 20 \
  --min-instances 1
```

2. **添加healthz超时保护**
```javascript
app.get('/healthz', (req, res) => {
  res.status(200).send('OK')
})
```

**预期效果**:
- 支持并发用户: **无限制**（通过水平扩展）
- 单实例并发: 4个
- 自动扩展: 每4个并发增加1个实例

---

### 第二阶段：性能优化（1周内）

1. **实现请求队列**
   - 安装p-limit
   - 添加并发控制
   - 增加排队监控

2. **浏览器池预热**
   - 设置min-instances=2
   - BROWSER_POOL_MIN_WARM=2

**预期效果**:
- 首次请求延迟: 从5秒降到1秒
- 并发能力: 每实例稳定处理4个请求

---

### 第三阶段：架构优化（1个月内）

1. **共享浏览器实例**
   - 重构pool.js
   - 实现context池管理
   - 增加错误隔离

2. **增加监控和告警**
   - 并发数监控
   - 内存使用监控
   - 浏览器崩溃告警

**预期效果**:
- 单实例并发: 从4个提升到8-12个
- 内存效率: 提升50%
- 成本: 降低40%

---

## 📈 扩展能力预测

### 当前配置（修正concurrency后）

| 并发用户 | 需要实例 | QPS | 成本/小时 |
|---------|---------|-----|----------|
| 4 | 1 | 0.2 | $0.05 |
| 20 | 5 | 1.0 | $0.25 |
| 100 | 25 | 5.0 | $1.25 |
| 500 | 125 | 25 | $6.25 |

### 优化后（共享浏览器）

| 并发用户 | 需要实例 | QPS | 成本/小时 |
|---------|---------|-----|----------|
| 4 | 1 | 0.2 | $0.05 |
| 20 | 2 | 1.0 | $0.10 |
| 100 | 10 | 5.0 | $0.50 |
| 500 | 50 | 25 | $2.50 |

**成本节省**: ~60%

---

## 🚀 立即行动

### 紧急修复（现在执行）

```bash
# 1. 修正concurrency配置
gcloud run deploy browser-exec-preview \
  --image asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/browser-exec:preview-latest \
  --region asia-northeast1 \
  --platform managed \
  --project gen-lang-client-0944935873 \
  --concurrency 4 \
  --max-instances 20 \
  --min-instances 1 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300s \
  --execution-environment gen2 \
  --set-env-vars "PLAYWRIGHT=1,BROWSER_MAX_CONCURRENCY=4,BROWSER_MAX_CONTEXTS=12,BROWSER_MAX_MEMORY_MB=1536,NODE_ENV=production"

# 2. 验证配置
gcloud run services describe browser-exec-preview \
  --region asia-northeast1 \
  --format="value(spec.template.spec.containerConcurrency)"

# 3. 测试并发（分批发送，避免冷启动问题）
# 先发2个请求
# 等待30秒
# 再发4个请求
```

### 验证标准

✅ **成功标准**:
- 4个并发请求全部成功
- 无503错误
- 无浏览器崩溃
- 平均响应时间 < 30秒

---

## 📝 总结

### 崩溃根因

1. **concurrency=80** 配置错误（应该是4）
2. 冷启动时4个并发请求同时到达
3. 浏览器资源不足导致崩溃

### 解决方案优先级

| 方案 | 优先级 | 实施时间 | 效果 | 成本 |
|------|--------|---------|------|------|
| **修正concurrency** | P0 | 立即 | ⭐⭐⭐⭐⭐ | $0 |
| **请求队列** | P1 | 1周 | ⭐⭐⭐⭐ | $0 |
| **浏览器预热** | P1 | 1周 | ⭐⭐⭐⭐ | +10% |
| **升级资源** | P2 | 按需 | ⭐⭐⭐ | +100% |
| **共享浏览器** | P2 | 1个月 | ⭐⭐⭐⭐⭐ | -60% |

### 下一步

1. ✅ **立即**: 修正concurrency配置
2. ⏳ **本周**: 实现请求队列和浏览器预热
3. 📅 **本月**: 重构为共享浏览器架构

**预期最终能力**:
- 单实例: 8-12个并发
- 总并发: 无限制（自动扩展）
- 成本效率: 提升60%
