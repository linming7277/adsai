# 重定向跳转机制兼容性分析

## 当前支持的重定向类型

### 1. HTTP 3xx 重定向 ✅
**机制**: 服务器返回301/302/303/307/308状态码
**检测**: Playwright自动跟踪
**示例**: `bonusarrive.com → redirect.partner.fatcoupon.com`

### 2. Meta Refresh 重定向 ✅
**机制**: HTML中的 `<meta http-equiv="refresh" content="0;url=...">`
**检测**:
```javascript
const metaRefresh = document.querySelector('meta[http-equiv="refresh"]')
if (metaRefresh) return true
```
**处理**: 重置stableSince继续等待
**示例**: 某些老式重定向页面

### 3. JavaScript setTimeout 重定向 ✅
**机制**: `setTimeout(() => window.location.href = url, delay)`
**检测**:
```javascript
const hasTimer = content.includes('setTimeout')
const hasLocationChange = content.includes('window.location') ||
                          content.includes('.location.href') ||
                          content.includes('.location.replace')
if (hasTimer && hasLocationChange) return true
```
**处理**: 检测到后重置stableSince，等待最多12秒
**示例**: 一般的JavaScript重定向

### 4. JavaScript setInterval 倒计时重定向 ✅
**机制**: `setInterval(() => { if(--seconds == 0) window.location.href = url }, 1000)`
**检测**:
```javascript
// 检测timer函数
const hasTimer = content.includes('setTimeout') || content.includes('setInterval')
// 检测location变更
const hasLocationChange = content.includes('window.location') || ...
// 检测倒计时元素
const hasCountdown = !!document.querySelector('[id*="count"], [class*="countdown"]')
// 检测重定向文本
if (bodyText.includes('redirect') && bodyText.includes('second')) return true
```
**处理**: 检测到后等待最多12秒让倒计时完成
**示例**:
- `dailybacks.com/return.html` (5秒倒计时)
- `www.linkbux.com` (可能的倒计时页面)

### 5. JavaScript 立即重定向 ✅
**机制**: `window.location = url` 或 `window.location.href = url`
**检测**:
```javascript
if (content.includes('window.location=') || content.includes('window.location ='))
    return true
```
**处理**: Playwright自动跟踪
**示例**: 快速JavaScript重定向

### 6. Frame/Iframe 重定向 ⚠️ **部分支持**
**机制**: 在iframe中加载目标页面，然后跳转
**检测**: 目前没有专门的iframe检测
**处理**: 依赖Playwright的frame navigation事件
**限制**: 如果iframe没有触发导航可能无法检测

### 7. Form POST 重定向 ⚠️ **部分支持**
**机制**: 自动提交表单进行跳转
**检测**: 目前没有专门的form submit检测
**处理**: 依赖attemptIntermediatePageNavigation点击按钮/链接
**限制**: 如果表单需要特殊参数可能失败

### 8. AJAX/Fetch 后重定向 ❌ **不支持**
**机制**: 发送AJAX请求获取URL后再跳转
**检测**: 当前script检测无法识别异步请求
**示例**:
```javascript
fetch('/api/getRedirectUrl').then(res => res.json())
    .then(data => window.location = data.url)
```
**建议**: 需要增加对Promise/async/await的检测

## 当前流程图

```
页面加载
  ↓
检测Cloudflare? ─Yes→ 等待20秒自动求解
  ↓ No
URL变化? ─Yes→ 重置stableSince，继续监控
  ↓ No
离开联盟网络? ─Yes→ 等待3秒 → 检测中间页
  ↓ No
Meta refresh? ─Yes→ 重置stableSince
  ↓ No
稳定时间 >= 12秒?
  ↓ Yes
仍在联盟网络? ─Yes→ 继续等待
  ↓ No
是中间页?
  ↓ Yes
检测自动重定向?
  ├─Yes (setTimeout/setInterval/countdown)
  │   → 重置stableSince，继续等待
  └─No
      → 尝试手动点击/触发
          ├─成功 → 重置stableSince
          └─失败 → 返回中间页结果
```

## 问题分析

### 已修复的问题

1. ✅ **setInterval检测不完整**
   - 问题: 只检测setTimeout，不检测setInterval
   - 修复: 添加 `content.includes('setInterval')`

2. ✅ **倒计时页面未识别**
   - 问题: return.html的倒计时未被检测
   - 修复: 增加countdown元素检测和文本检测

3. ✅ **离开联盟网络后立即退出**
   - 问题: 到达linkbux.com后直接break，跳过中间页检测
   - 修复: 移除break，设置stableSince接近阈值触发检测

4. ✅ **稳定等待时间不足**
   - 问题: 8秒不够倒计时完成
   - 修复: 增加到12秒

### 当前存在的gap

1. ⚠️ **动态加载的脚本**
   - 问题: 如果重定向代码通过外部JS动态加载，可能无法检测
   - 建议: 监听script标签的动态添加

2. ⚠️ **复杂的异步逻辑**
   - 问题: Promise链、async/await包裹的重定向
   - 建议: 增加对Promise/async关键词的检测

3. ⚠️ **条件重定向**
   - 问题: 根据用户行为或条件才触发的重定向
   - 建议: 增加更智能的交互逻辑

## 兼容性评分

| 重定向类型 | 支持程度 | 评分 |
|-----------|---------|------|
| HTTP 3xx | 完全 | ⭐⭐⭐⭐⭐ |
| Meta Refresh | 完全 | ⭐⭐⭐⭐⭐ |
| setTimeout | 完全 | ⭐⭐⭐⭐⭐ |
| setInterval倒计时 | 完全 | ⭐⭐⭐⭐⭐ |
| 立即JS重定向 | 完全 | ⭐⭐⭐⭐⭐ |
| Iframe | 部分 | ⭐⭐⭐ |
| Form POST | 部分 | ⭐⭐⭐ |
| AJAX/异步 | 不支持 | ⭐ |

**总体评分**: ⭐⭐⭐⭐ (4/5)

## 建议改进

### 短期（已在进行）
1. ✅ 修复minStableTime作用域问题
2. 🔄 部署并测试新版本
3. 验证4个Offer URL的完整重定向链路

### 中期
1. 增加AJAX/Fetch重定向检测
2. 增强动态脚本监控
3. 添加iframe内容检测

### 长期
1. 建立重定向模式库
2. 机器学习识别中间页
3. 自适应等待时间调整
