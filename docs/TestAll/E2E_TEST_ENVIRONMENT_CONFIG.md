# E2E测试环境配置对比

**日期**: 2025-10-13
**目的**: 确保E2E测试环境完全模拟生产环境

---

## 📋 环境对比

### 生产环境配置 (frontend-preview)
来源: Cloud Run服务配置

```bash
# 核心环境变量
NEXT_PUBLIC_API_BASE_URL=https://autoads-gw-885pd7lz.an.gateway.dev/api/v1
NEXT_PUBLIC_CONSOLE_API_URL=https://console-preview-644672509127.asia-northeast1.run.app/api/v1/console
NEXT_PUBLIC_DEPLOYMENT_ENV=preview
NODE_ENV=production
BACKEND_URL=https://autoads-gw-885pd7lz.an.gateway.dev
OFFER_BASE_URL=https://offer-preview-yt54xvsg5q-an.a.run.app
CONSOLE_URL=https://console-preview-644672509127.asia-northeast1.run.app
BILLING_BASE_URL=https://billing-preview-644672509127.asia-northeast1.run.app

# Supabase配置 (从Secret读取)
NEXT_PUBLIC_SUPABASE_URL=https://jzzvizacfyipzdyiqfzb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[secret]
SUPABASE_SERVICE_KEY=[secret]

# 其他配置
NEXT_PUBLIC_FIREBASE_PROJECT_ID=gen-lang-client-0944935873
ENABLE_TEST_API=true
```

### E2E测试环境配置
来源: `scripts/tests/run-all-tests.mjs`

```javascript
const env = {
  ...process.env,          // 继承所有环境变量
  PREVIEW_BASE: BASE_URL,  // 测试目标URL
  HEADLESS: HEADLESS.toString(),  // 是否无头模式
};
```

实际测试时的配置:
```bash
PREVIEW_BASE=https://www.urlchecker.dev
HEADLESS=true
# 其他环境变量继承自本地环境
```

---

## ⚠️ 发现的差异

### 1. API配置差异

**生产环境**:
- 明确配置`NEXT_PUBLIC_API_BASE_URL`指向API Gateway
- 前端代码通过API Gateway统一访问后端服务
- 所有API请求格式: `https://autoads-gw-885pd7lz.an.gateway.dev/api/v1/{endpoint}`

**E2E测试环境**:
- 测试脚本未明确设置`NEXT_PUBLIC_API_BASE_URL`
- **但**: E2E测试访问的是已部署的生产前端 (`https://www.urlchecker.dev`)
- **结论**: 测试环境实际使用的是生产环境的API配置 ✅

### 2. 本地开发配置差异

**问题**: 本地`.env.local`文件缺少`NEXT_PUBLIC_API_BASE_URL`配置
**影响**: 本地开发时API调用可能失败
**解决**: 需要在本地`.env.local`中添加:
```bash
NEXT_PUBLIC_API_BASE_URL=https://autoads-gw-885pd7lz.an.gateway.dev/api/v1
```

---

## 🔍 E2E测试失败的真实原因

经过分析，E2E测试失败**不是**因为API配置问题，而是：

### 根本原因1: HoverCard组件缺少data-testid支持 ✅ 已修复
- **问题**: `HoverCard`组件未传递`data-testid`属性到DOM元素
- **影响**: Dashboard快速操作按钮无法被测试定位
- **修复**: Commit `139bb7b2` - 添加data-testid支持到HoverCard组件
- **验证**: 等待前端部署后重新测试

### 可能原因2: 测试超时设置过短
- **问题**: 某些测试只等待3秒 (`timeout: 3000`)
- **影响**: 如果页面加载慢，元素可能还未渲染完成
- **建议**: 增加关键元素的等待超时时间到10-15秒

### 可能原因3: 测试数据依赖
- **问题**: 某些测试依赖特定的测试数据状态
- **影响**: 如果数据不符合预期，UI可能不渲染某些元素
- **示例**: `deployedOffers > 0`时才显示"最近活动"卡片

---

## ✅ 正确的测试方法

### E2E测试的实际执行流程

```
1. 测试脚本启动 (本地)
   ↓
2. 使用Playwright/Puppeteer打开浏览器
   ↓
3. 访问生产前端URL: https://www.urlchecker.dev
   ↓
4. 浏览器加载生产前端代码 (已构建的Next.js应用)
   ↓
5. 前端代码使用生产环境变量 (来自Cloud Run配置)
   ↓
6. 前端通过API Gateway访问后端
   ↓
7. 测试脚本通过Playwright API检测页面元素
```

**关键点**:
- E2E测试访问的是**已部署的生产应用**，不是本地代码
- 测试环境变量(`PREVIEW_BASE`, `HEADLESS`)只控制**测试行为**，不影响前端应用配置
- 前端应用使用的环境变量来自**Cloud Run服务配置**，不是测试脚本

---

## 📝 配置最佳实践

### 1. 本地开发环境 (`.env.local`)

应该包含与生产环境一致的配置：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://jzzvizacfyipzdyiqfzb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# API配置 (应该添加)
NEXT_PUBLIC_API_BASE_URL=https://autoads-gw-885pd7lz.an.gateway.dev/api/v1

# 其他配置
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
```

### 2. E2E测试脚本

当前配置是合理的：

```javascript
const env = {
  ...process.env,
  PREVIEW_BASE: 'https://www.urlchecker.dev',
  HEADLESS: 'true',
};
```

**不需要**添加`NEXT_PUBLIC_*`变量，因为：
- 测试访问的是已部署的应用
- 已部署的应用有自己的环境配置

### 3. 超时配置建议

增加关键元素的等待时间：

```javascript
// 当前
const isVisible = await element.isVisible({ timeout: 3000 });

// 建议
const isVisible = await element.isVisible({ timeout: 10000 });
```

---

## 🎯 后续行动

### 立即行动
- [x] 修复HoverCard组件data-testid支持 (Commit 139bb7b2)
- [x] 等待前端部署完成
- [ ] 运行E2E测试验证修复

### 中期优化
- [ ] 更新本地`.env.local`添加API_BASE_URL配置
- [ ] 增加E2E测试的超时时间配置
- [ ] 添加更多测试日志，诊断失败原因

### 长期改进
- [ ] 创建E2E测试专用的测试数据管理脚本
- [ ] 添加测试前置条件检查 (数据状态验证)
- [ ] 实现测试环境配置自动验证工具

---

## 📎 相关文档

- **生产环境查询命令**:
  ```bash
  gcloud run services describe frontend-preview \
    --region=asia-northeast1 \
    --project=gen-lang-client-0944935873 \
    --format="yaml(spec.template.spec.containers[0].env)"
  ```

- **HoverCard修复**: Commit `139bb7b2`
- **API Gateway地址**: `https://autoads-gw-885pd7lz.an.gateway.dev`
- **测试执行日志**: `.kiro/tmp/e2e-test-results.log`

---

**文档维护**: 2025-10-13 18:05
**最后更新**: Jason / Claude Code
