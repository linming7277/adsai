# 评估流程测试 - 发现的问题

## 测试日期
2025-10-06

## 测试目标
验证完整的Offer评估流程：
- Offer URL: `https://pboost.me/ZDO2Bdek`
- 基础评估（Browser-exec + SimilarWeb）
- AI评估（Vertex AI Gemini）

## 发现的问题

### 🔴 问题1: Siterank服务 /healthz 返回404

**症状**:
```bash
curl https://siterank-yt54xvsg5q-an.a.run.app/healthz
# 返回: 404 Not Found (Google Cloud 404页面)
```

**预期行为**:
根据 `services/siterank/cmd/server/main.go:118`，应该有路由:
```go
router.Get("/healthz", healthCheckHandler)
```

**分析**:
1. Cloud Run服务状态显示 `Ready: True`，说明容器启动成功
2. 但HTTP路由返回404，说明应用代码没有正确处理请求
3. 可能原因：
   - 应用启动失败，Cloud Run使用了fallback处理
   - 路由配置有问题
   - Dockerfile部署了错误的二进制文件

**影响**:
- 无法通过标准HTTP端点测试评估功能
- 健康检查失败可能导致Cloud Run认为服务不健康

**建议修复**:
1. 检查siterank服务的启动日志
2. 验证Dockerfile构建的二进制文件是否正确
3. 确认路由配置在部署后生效

---

### 🔴 问题2: Billing服务 /healthz 也返回404

**症状**:
```bash
curl https://billing-644672509127.asia-northeast1.run.app/healthz
# 返回: 404 Not Found
```

**相同问题**:
billing服务和siterank服务有相同的404问题，说明可能是系统性的部署问题

---

### ⚠️ 问题3: 测试需要Firebase认证

**症状**:
所有siterank API端点都需要Firebase认证:
```go
// services/siterank/cmd/server/main.go:126-136
r.Group(func(r chi.Router) {
    r.Use(middleware.AuthMiddleware)  // 需要认证

    r.Post("/api/v1/offers/{offerId}/evaluate", evalHandler.CreateOfferEvaluation)
    r.Get("/api/v1/offers/{offerId}/evaluations/latest", evalHandler.GetLatestOfferEvaluation)
    r.Get("/evaluations/{evaluationId}", evalHandler.GetEvaluation)
})
```

**影响**:
- 无法直接通过HTTP测试评估功能
- 需要有效的Firebase Token才能调用API

**可选方案**:
1. ✅ **通过前端UI触发** - 最推荐，完整的端到端测试
2. ❌ 通过PubSub直接发布事件 - 需要创建PubSub topic和subscription
3. ❌ 添加测试端点（无需认证）- 仅限开发环境

---

## 推荐的测试方案

### 方案1: 前端UI测试（强烈推荐）

**步骤**:
1. 打开浏览器访问 https://www.urlchecker.dev
2. 登录您的Elite账号
3. 点击 "添加Offer"
4. 输入URL: `https://pboost.me/ZDO2Bdek`
5. 点击 "评估" 按钮
6. 选择 "AI智能评估（3 tokens）"
7. 点击 "启动评估"
8. 观察评估进度:
   - 初始状态: `evaluating`
   - 基础评估完成后: 显示域名、品牌名、SimilarWeb数据
   - AI评估完成后: 显示AI推荐指数、推荐理由

**验证清单**:
- [ ] Offer成功创建
- [ ] 评估按钮可点击
- [ ] Token余额正确扣减
- [ ] Browser-exec成功访问URL（处理Cloudflare）
- [ ] 提取到正确的域名和品牌名
- [ ] SimilarWeb数据显示（检查缓存状态）
- [ ] Offer的brand_name字段自动更新
- [ ] AI推荐指数在0-100范围
- [ ] 显示3条推荐理由
- [ ] 点击Offer可查看完整AI评估详情

**优点**:
- ✅ 完整的端到端测试
- ✅ 验证前后端集成
- ✅ 真实用户体验
- ✅ 无需编写测试代码

**缺点**:
- ❌ 需要手动操作
- ❌ 消耗真实Token

---

### 方案2: 使用Postman/curl测试（需要Firebase Token）

如果需要自动化测试，可以使用测试脚本，但需要先获取Firebase Token。

**获取Token**:
1. 打开浏览器 DevTools (F12)
2. 访问 https://www.urlchecker.dev 并登录
3. 在Console执行:
```javascript
firebase.auth().currentUser.getIdToken().then(token => {
  console.log(token);
  navigator.clipboard.writeText(token);
});
```

**运行测试**:
```bash
FIREBASE_TOKEN=<粘贴token> node /tmp/test-evaluation.mjs
```

**测试脚本位置**:
- `/tmp/test-evaluation.mjs` - Node.js版本（推荐）
- `/tmp/test-evaluation-flow.sh` - Bash版本

**优点**:
- ✅ 可自动化
- ✅ 详细的日志输出
- ✅ 可重复执行

**缺点**:
- ❌ 需要手动获取Token
- ❌ Token有效期限制（1小时）
- ❌ 仍消耗真实Token

---

## 下一步行动

### 高优先级（必须修复）

1. **修复 Siterank /healthz 404问题**
   - 检查服务启动日志
   - 验证部署流程
   - 确认Dockerfile正确

2. **修复 Billing /healthz 404问题**
   - 相同的诊断步骤

### 中优先级（建议优化）

3. **添加开发环境测试端点**
   - 创建 `/internal/test/*` 路由（无需认证）
   - 仅在非生产环境启用
   - 便于自动化测试

4. **创建端到端集成测试**
   - 使用Playwright模拟前端操作
   - 自动化完整的评估流程
   - 集成到CI/CD pipeline

### 低优先级（可选）

5. **优化错误处理**
   - 更详细的错误消息
   - 错误代码标准化
   - 添加重试机制

---

## 总结

**当前状态**: ⚠️ 服务部署有问题，无法通过HTTP测试

**推荐行动**:
1. 🔧 **立即修复**: Siterank和Billing服务的404问题
2. ✅ **短期方案**: 使用前端UI进行手动测试
3. 🚀 **长期方案**: 建立自动化端到端测试框架

**预计时间**:
- 修复404问题: 1-2小时
- 前端UI测试: 30分钟
- 建立自动化测试: 4-6小时
