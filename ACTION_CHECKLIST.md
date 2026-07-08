# ✅ 迁移到Supabase - 行动清单

## 🎯 总览

- **目标**: 完全迁移到Supabase，实现可靠的Google登录
- **时间**: 2-3周
- **成本节省**: 70% ($650/月)
- **可靠性提升**: 30% → 99%+

---

## 📋 阶段1: 快速验证（1小时）

### ✅ 任务清单

- [ ] **创建Supabase项目**
  - [ ] 访问 https://app.supabase.com
  - [ ] 创建项目：autoads
  - [ ] 选择区域：Asia Northeast (Tokyo)
  - [ ] 选择定价：Pro ($25/月)
  - [ ] 记录URL和密钥

- [ ] **配置Google OAuth**
  - [ ] Supabase Dashboard → Authentication → Providers
  - [ ] 启用Google
  - [ ] 输入Client ID和Secret
  - [ ] 添加回调URL到Google Cloud Console

- [ ] **安装依赖**
  ```bash
  cd apps/frontend
  npm install @supabase/supabase-js @supabase/auth-ui-react
  ```

- [ ] **创建Supabase客户端**
  - [ ] 创建 `lib/supabase/client.ts`
  - [ ] 添加环境变量到 `.env.local`

- [ ] **创建登录组件**
  - [ ] 创建 `components/auth/SupabaseGoogleLogin.tsx`
  - [ ] 创建 `pages/auth/callback.tsx`
  - [ ] 更新 `pages/auth/sign-in.tsx`

- [ ] **本地测试**
  - [ ] 启动开发服务器
  - [ ] 测试登录流程
  - [ ] 验证成功

**文档**: QUICK_START_SUPABASE.md

---

## 📋 阶段2: 完整实现（1周）

### ✅ Auth实现

- [ ] **创建Auth Context**
  - [ ] 创建 `contexts/AuthContext.tsx`
  - [ ] 在 `_app.tsx` 中使用
  - [ ] 实现 `useAuth` hook

- [ ] **实现受保护路由**
  - [ ] 创建 `components/ProtectedRoute.tsx`
  - [ ] 保护dashboard和其他页面

- [ ] **实现登出功能**
  - [ ] 添加登出按钮
  - [ ] 实现登出逻辑

- [ ] **错误处理**
  - [ ] 添加错误提示
  - [ ] 实现重试逻辑

### ✅ 数据库设置

- [ ] **创建PostgreSQL Schema**
  - [ ] 在Supabase SQL Editor执行DDL
  - [ ] 创建 `user_profiles` 表
  - [ ] 设置RLS策略

- [ ] **创建迁移脚本**
  - [ ] 编写数据迁移脚本
  - [ ] 测试迁移逻辑

---

## 📋 阶段3: 数据迁移（3-4天）

### ✅ 用户数据迁移

- [ ] **准备迁移**
  - [ ] 备份Firebase数据
  - [ ] 审计Firestore使用
  - [ ] 设计迁移策略

- [ ] **执行迁移**
  - [ ] 迁移用户数据
  - [ ] 验证数据完整性
  - [ ] 测试数据访问

- [ ] **双写模式**
  - [ ] 实现双写逻辑
  - [ ] 监控数据一致性
  - [ ] 准备切换

---

## 📋 阶段4: 移除Cloudflare（1天）

### ✅ 配置Cloud Run自定义域名

- [ ] **预发环境**
  ```bash
  gcloud run domain-mappings create \
    --service=frontend-preview \
    --domain=www.urlchecker.dev \
    --region=asia-northeast1
  ```

- [ ] **生产环境**
  ```bash
  gcloud run domain-mappings create \
    --service=frontend-prod \
    --domain=www.autoads.dev \
    --region=asia-northeast1
  ```

- [ ] **更新DNS**
  - [ ] 在Cloudflare中配置A记录
  - [ ] 设置为DNS only（灰色云）
  - [ ] 等待SSL证书生成

- [ ] **验证**
  - [ ] 测试HTTPS访问
  - [ ] 验证SSL证书
  - [ ] 检查功能正常

**文档**: CLOUD_RUN_CUSTOM_DOMAIN_GUIDE.md

---

## 📋 阶段5: 后端集成（2-3天）

### ✅ Go服务更新

- [ ] **实现Supabase JWT验证**
  - [ ] 创建 `pkg/auth/supabase.go`
  - [ ] 实现JWT验证逻辑
  - [ ] 获取JWKS

- [ ] **更新中间件**
  - [ ] 修改 `middleware/auth.go`
  - [ ] 使用Supabase验证
  - [ ] 测试API调用

- [ ] **更新所有微服务**
  - [ ] browser-exec
  - [ ] siterank
  - [ ] billing
  - [ ] offer
  - [ ] adscenter

---

## 📋 阶段6: 清理Firebase（2天）

### ✅ 移除依赖

- [ ] **卸载包**
  ```bash
  npm uninstall firebase reactfire firebase-admin
  ```

- [ ] **删除文件**
  - [ ] 删除 `src/core/firebase/`
  - [ ] 删除Firebase相关组件
  - [ ] 删除Firebase配置

- [ ] **更新环境变量**
  - [ ] 移除Firebase变量
  - [ ] 清理配置文件

- [ ] **更新文档**
  - [ ] 更新README
  - [ ] 更新MustKnowV4.md
  - [ ] 更新部署文档

---

## 📋 阶段7: 测试（2-3天）

### ✅ 功能测试

- [ ] **认证流程**
  - [ ] Google登录
  - [ ] 用户注册
  - [ ] Session管理
  - [ ] 登出

- [ ] **受保护路由**
  - [ ] Dashboard访问
  - [ ] API调用
  - [ ] 权限检查

- [ ] **数据访问**
  - [ ] 用户数据读取
  - [ ] 用户数据更新
  - [ ] RLS策略验证

### ✅ 性能测试

- [ ] **登录速度**
  - [ ] 测试登录时间
  - [ ] 目标: <2秒

- [ ] **API响应**
  - [ ] 测试API延迟
  - [ ] 目标: <200ms

- [ ] **数据库查询**
  - [ ] 测试查询性能
  - [ ] 优化慢查询

### ✅ 安全测试

- [ ] **JWT验证**
  - [ ] 测试token验证
  - [ ] 测试过期处理

- [ ] **RLS策略**
  - [ ] 测试数据隔离
  - [ ] 测试权限控制

- [ ] **CORS配置**
  - [ ] 测试跨域请求
  - [ ] 验证安全头

---

## 📋 阶段8: 部署和监控（1天）

### ✅ 部署

- [ ] **预发环境**
  - [ ] 部署代码
  - [ ] 验证功能
  - [ ] 监控1周

- [ ] **生产环境**
  - [ ] 灰度发布
  - [ ] 监控错误率
  - [ ] 完全切换

### ✅ 监控

- [ ] **设置监控**
  - [ ] Supabase监控
  - [ ] Cloud Monitoring
  - [ ] 错误告警

- [ ] **性能监控**
  - [ ] 登录成功率
  - [ ] API响应时间
  - [ ] 数据库性能

- [ ] **成本监控**
  - [ ] Supabase使用量
  - [ ] Cloud Run成本
  - [ ] 总成本跟踪

---

## 📋 最终验证

### ✅ 成功标准

- [ ] **功能**
  - [ ] Google登录成功率 > 99%
  - [ ] 登录速度 < 2秒
  - [ ] API响应时间 < 200ms
  - [ ] 零数据丢失

- [ ] **性能**
  - [ ] 页面加载 < 3秒
  - [ ] 数据库查询 < 100ms
  - [ ] 并发支持 > 1000用户

- [ ] **成本**
  - [ ] 月成本 < $300
  - [ ] 节省 > 60%

---

## 📊 进度跟踪

### 当前状态

- [ ] 阶段1: 快速验证 (0%)
- [ ] 阶段2: 完整实现 (0%)
- [ ] 阶段3: 数据迁移 (0%)
- [ ] 阶段4: 移除Cloudflare (0%)
- [ ] 阶段5: 后端集成 (0%)
- [ ] 阶段6: 清理Firebase (0%)
- [ ] 阶段7: 测试 (0%)
- [ ] 阶段8: 部署和监控 (0%)

**总进度**: 0%

---

## 🚀 开始行动

### 第一步

**现在就开始阶段1！**

1. 打开 QUICK_START_SUPABASE.md
2. 创建Supabase项目
3. 配置Google OAuth
4. 实现登录组件
5. 测试

**预计时间**: 1小时

---

## 📚 相关文档

- **QUICK_START_SUPABASE.md** - 快速开始指南
- **MIGRATION_TO_SUPABASE_PLAN.md** - 完整迁移计划
- **MIGRATION_SUMMARY.md** - 迁移总结
- **CLOUD_RUN_CUSTOM_DOMAIN_GUIDE.md** - 自定义域名配置
- **SUPABASE_GOOGLE_LOGIN.md** - Supabase Google登录详解

---

**准备好了吗？开始第一步！** 🚀
