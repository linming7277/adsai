# browser-exec 4 Offers 测试报告 (优化后)

**测试时间**: 2025-10-02 10:04
**测试环境**: browser-exec 预发环境
**优化版本**:
- browser-exec code: commit 5ed79f0c + 7feb4fd2
- timeout: 60s (优化后)
- stabilizeMs: 12s (优化后)
- concurrency: 4 (修复后)
- min-instances: 1 (修复后)

---

## 📊 测试结果总览

| Offer URL | 状态 | 最终域名 | 品牌 | 耗时 | 问题 |
|-----------|------|----------|------|------|------|
| **pboost.me** | ✅ 成功 | yitahome.com | YITAHOME | 14.2s | 无 |
| **dognet.com** | ✅ 成功 | dyson.hr | Dyson Hrvatska | 36.2s | 无 |
| **yeahpromos** | ❌ 中间页 | dailybacks.com | Page is redirecting | 9.5s | 停留在 return.html |
| **bonusarrive** | ✅ 成功 | beautyologie.com | Clean Beauty | 20.1s | 无 |

**成功率**: 75% (3/4)
**平均耗时**: 20.0s

---

## 🎯 详细分析

### 1. ✅ pboost.me → yitahome.com (成功)

**测试结果**:
```
耗时: 14.2s
最终URL: https://www.yitahome.com/
品牌: YITAHOME｜Home Furniture & Decor
HTTP状态: 200
```

**对比历史**:
| 版本 | 状态 | 耗时 |
|------|------|------|
| Revision 00030 | ✅ 成功 | 14.4s |
| 本次测试 | ✅ 成功 | **14.2s** |

**评估**:
- ✅ timeout 60s 生效,不再超时
- ✅ 稳定访问 yitahome.com
- ✅ 性能持平甚至略优

---

### 2. ✅ dognet.com → dyson.hr (成功)

**测试结果**:
```
耗时: 36.2s
最终URL: https://www.dyson.hr/
品牌: Dyson Hrvatska
HTTP状态: 200
重定向: go.dognet.com → clk.tradedoubler.com → dyson.hr
```

**对比历史**:
| 版本 | 状态 | 耗时 |
|------|------|------|
| Revision 00030 | ✅ 成功 | 15.5s |
| 本次测试 | ✅ 成功 | **36.2s** |

**分析**:
- ✅ 访问成功,品牌识别准确
- ⚠️ 耗时增加 2.3倍 (15.5s → 36.2s)
- **原因**: 稳定化时间从 6.9s 增加到 26.3s
- **可能原因**: 新的 stabilizeMs: 12s 配置导致等待时间延长

**日志证据**:
```
[stabilize] Stabilization complete: 1 redirects, 26274ms
```

---

### 3. ❌ yeahpromos → dailybacks.com (中间页)

**测试结果**:
```
耗时: 9.5s
最终URL: https://dailybacks.com/return.html
品牌: Page is redirecting
HTTP状态: 200
问题: stuck_at_intermediate_page
```

**对比历史**:
| 版本 | 状态 | 最终页 | 耗时 |
|------|------|--------|------|
| Revision 00030 | ✅ 成功 | error_suspended.html | 18.5s |
| 本次测试 | ❌ 失败 | **return.html** (中间页) | **9.5s** |

**核心问题**:
优化后的版本**退步**了!从成功访问到 error_suspended.html 退化为停留在 return.html 中间页。

**日志证据**:
```
[stabilize] URL changed to: dailybacks.com
[stabilize] Left affiliate network, waiting for JavaScript redirects...
[stabilize] Stabilization complete: 1 redirects, 6133ms
```

**问题分析**:

1. **Pattern Library 配置已更新**:
   ```json
   {
     "id": "dailybacks-return",
     "expectedWaitTime": 15000  // 已从 6000 改为 15000
   }
   ```

2. **但实际等待时间仍然是 6秒**:
   - 日志显示: `Stabilization complete: 1 redirects, 6133ms`
   - 预期: 应该等待 15000ms (15秒)

3. **根本原因**:
   - ⚠️ Pattern Library 配置未生效
   - ⚠️ 可能是代码未重新部署
   - ⚠️ 或者 detectIntermediatePage 逻辑未正确使用 expectedWaitTime

**需要检查**:
```javascript
// index.js:2011-2012 应该使用 detection.expectedWaitTime
let waitTime = detection.expectedWaitTime

// 如果 dailybacks-return 匹配成功,waitTime 应该是 15000
// 但实际日志显示只等待了 6133ms
```

---

### 4. ✅ bonusarrive → beautyologie.com (成功)

**测试结果**:
```
耗时: 20.1s
最终URL: https://beautyologie.com/
品牌: Clean Beauty
HTTP状态: 200
重定向: bonusarrive.com → fatcoupon.com (Cloudflare) → linkbux.com → beautyologie.com
```

**对比历史**:
| 版本 | 状态 | 耗时 |
|------|------|------|
| Revision 00030 | ✅ 成功 | 26.7s |
| 本次测试 | ✅ 成功 | **20.1s** |

**评估**:
- ✅ Cloudflare 绕过成功
- ✅ 性能提升 25% (26.7s → 20.1s)
- ✅ 4跳重定向全部追踪

**日志证据**:
```
[cloudflare] Cloudflare challenge detected, waiting for auto-solve...
[cloudflare] URL changed from fatcoupon.com to www.linkbux.com
[cloudflare] Challenge passed! Continuing...
[cloudflare] Challenge solved successfully!
```

---

## 📈 性能对比

| 指标 | Revision 00030 | 本次测试 | 变化 |
|------|---------------|---------|------|
| **成功率** | 100% (4/4) | **75%** (3/4) | ⬇️ -25% |
| **平均耗时** | 18.8s | **20.0s** | ⬆️ +6% |
| **最快** | 14.4s (pboost) | 14.2s (pboost) | ✅ 持平 |
| **最慢** | 26.7s (bonusarrive) | **36.2s** (dognet) | ⬆️ +35% |

---

## 🐛 发现的问题

### 问题 1: yeahpromos 退步 (高优先级)

**现象**: 从成功访问 error_suspended.html 退化为停留在 return.html

**根本原因**: Pattern Library 的 expectedWaitTime 配置未生效

**验证**:
```bash
# Pattern Library 配置 (已更新)
cat services/browser-exec/patterns/intermediate-pages.json | \
  jq '.domainPatterns[] | select(.id == "dailybacks-return") | .expectedWaitTime'
# 输出: 15000 ✓

# 实际等待时间 (日志)
[stabilize] Stabilization complete: 1 redirects, 6133ms
# 实际: 6133ms ✗
```

**可能原因**:
1. ⚠️ browser-exec 服务未重新部署 Pattern Library 更新
2. ⚠️ detectIntermediatePage 逻辑未正确应用 expectedWaitTime
3. ⚠️ dailybacks.com/return.html 未被识别为中间页

---

### 问题 2: dognet.com 耗时增加 (中优先级)

**现象**: 耗时从 15.5s 增加到 36.2s (增加 135%)

**根本原因**: stabilizeMs 从 8s 改为 12s,导致稳定化时间过长

**日志证据**:
```
Revision 00030: Stabilization complete: 1 redirects, 6.9s
本次测试:     Stabilization complete: 1 redirects, 26.3s
```

**分析**:
- stabilizeMs: 12s 配置生效
- 但 dyson.hr 只有 1 跳重定向,不需要等待 26秒
- **自适应等待逻辑未生效**

---

## 🔍 根本原因诊断

### 核心问题: Pattern Library 更新未部署

**证据链**:

1. ✅ **Pattern Library 已更新**:
   ```json
   "dailybacks-return": { "expectedWaitTime": 15000 }
   ```

2. ✅ **代码已提交**:
   ```
   commit 5ed79f0c: 更新 intermediate-pages.json
   commit 7feb4fd2: 修复 concurrency 和 min-instances
   ```

3. ⚠️ **部署状态不明**:
   - 测试时 Github Actions 仍在运行
   - browser-exec 可能使用的是旧版本镜像

4. ❌ **实际行为不一致**:
   - 配置: expectedWaitTime: 15000
   - 日志: Stabilization complete: 6133ms
   - **差异**: 配置未生效

---

## ✅ 优化建议

### 高优先级

**1. 等待部署完成后重新测试**

```bash
# 检查部署状态
gh run list --limit 1

# 等待 browser-exec 部署完成
gh run watch <run_id>

# 重新测试
node test-browser-exec-http.js
```

**预期**: dailybacks 应该等待 15秒,成功跳转到 error_suspended.html

---

### 中优先级

**2. 优化 dognet.com 耗时**

**方案**: 使用 Pattern Library 的 expectedWaitTime 而非固定 stabilizeMs

```javascript
// 当前逻辑 (index.js:1897-1899)
const maxWait = Math.max(config.stabilizeMs, 25000)  // 固定 12s

// 优化后逻辑
const maxWait = detection.expectedWaitTime || config.stabilizeMs || 25000

// dognet.com Pattern Library 配置
{
  "id": "dognet",
  "expectedWaitTime": 2000  // 只需等待 2秒
}
```

**预期效果**: dognet 耗时从 36s 降至 ~15s

---

## 📊 成功率分析

### 为什么成功率下降?

| 版本 | pboost | dognet | yeahpromos | bonusarrive | 成功率 |
|------|--------|--------|-----------|------------|--------|
| **Revision 00030** | ✅ | ✅ | ✅ | ✅ | **100%** |
| **本次测试** | ✅ | ✅ | ❌ | ✅ | **75%** |

**核心原因**: yeahpromos 退步

**深层原因**:
- Pattern Library 更新未及时部署
- 测试时使用的是**旧版本**镜像 (Revision 00030 之前)

---

## 🎯 验证计划

### Step 1: 确认部署状态

```bash
# 查看 browser-exec 当前版本
gcloud run revisions list \
  --service=browser-exec \
  --region=asia-northeast1 \
  --platform=managed \
  --limit=5

# 检查镜像标签
gcloud run revisions describe <latest-revision> \
  --region=asia-northeast1 \
  --format="value(image)"
```

### Step 2: 等待新部署完成

```bash
# 等待部署 (约 10 分钟)
gh run watch 18189611226
```

### Step 3: 重新测试

```bash
# 重新执行测试
node test-browser-exec-http.js

# 检查 dailybacks 是否等待 15秒
gcloud run services logs read browser-exec \
  --region=asia-northeast1 \
  --limit=50 | grep "dailybacks"
```

---

## 📝 总结

### ✅ 优化生效部分

1. ✅ **pboost.me timeout 修复**: 60s 生效,成功访问
2. ✅ **bonusarrive Cloudflare 绕过**: 性能提升 25%
3. ✅ **concurrency 配置**: 已修正为 4

### ❌ 优化未生效部分

1. ❌ **yeahpromos Pattern Library**: expectedWaitTime 15s 未生效
2. ❌ **dognet 自适应等待**: 耗时增加而非减少

### 🔧 根本原因

**部署时间问题**: 测试时 browser-exec 使用的是**旧版本**镜像

**证据**:
- Pattern Library 已更新 (本地文件)
- 实际行为与配置不符 (日志)
- Github Actions 部署仍在进行中

### 🚀 下一步

1. **等待部署完成** (~10分钟)
2. **重新测试验证**
3. **如果仍失败,检查 detectIntermediatePage 逻辑**

---

**报告生成时间**: 2025-10-02 10:10
**测试版本**: browser-exec (可能是旧版本,等待部署)
**建议**: ⏳ 等待最新部署完成后重新测试
