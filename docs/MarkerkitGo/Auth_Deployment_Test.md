# 用户注册登录部署和测试报告

## 部署信息

### 部署时间
2025-10-01 19:51 (UTC+8)

### 部署环境
- **环境**: Preview (预发环境)
- **分支**: main
- **Commit**: 07adecb3
- **部署方式**: GitHub Actions → Cloud Build → Cloud Run + Firebase Hosting

### 部署URL
- **Cloud Run**: https://frontend-preview-xxxx.run.app (自动生成)
- **Firebase Hosting**: https://autoads-preview.web.app
- **自定义域名**: https://www.urlchecker.dev

## 功能实现

### 1. OAuth 时序问题修复
**问题**: Google OAuth 登录后返回登录页面,无法完成认证流程

**根本原因**:
- OAuth redirect 后,`OAuthRedirectHandler` 立即执行会话创建 API 调用
- 但 `CsrfTokenContext` 尚未初始化,导致 API 请求缺少必需的 CSRF token
- `/api/session/sign-in` 验证失败,会话创建失败

**解决方案**:
修改 `OAuthRedirectHandler.tsx`,添加 CSRF token 就绪检查:

```typescript
// Wait for CSRF token to be available before proceeding
if (!csrfToken) {
  return;
}
```

**文件位置**: `apps/frontend/src/components/auth/OAuthRedirectHandler.tsx`

### 2. 统一登录/注册入口
**实现策略**: 合并 sign-in 和 sign-up 为单一认证入口

**技术依据**:
- Firebase OAuth 本身不区分注册和登录,统一使用授权流程
- 新用户首次授权时自动创建 Firebase Auth 账户
- 系统通过 `customClaims.onboarded` 标记自动区分新老用户

**用户流程**:
1. 用户点击"使用 Google 继续"
2. Google OAuth 授权
3. 系统自动判断:
   - 新用户 (`onboarded=false`) → 重定向到 `/onboarding`
   - 老用户 (`onboarded=true`) → 重定向到 `/dashboard`

**修改内容**:
- 删除 `sign-up.tsx` 页面
- 更新 `configuration.ts`,signUp 路径指向 signIn
- 更新 UI 文案:"Sign in with Google" → "Continue with Google"
- 移除 SiteHeader 中的 Sign In/Sign Up 双按钮,改为单一"Get Started"按钮
- 添加中文翻译文件 `zh/auth.json`

## 测试项目

### 手动测试清单

#### 1. 新用户注册流程
- [ ] 访问 https://www.urlchecker.dev
- [ ] 点击 "Get Started" 或 "使用 Google 继续"
- [ ] 完成 Google OAuth 授权
- [ ] 验证自动重定向到 `/onboarding` 页面
- [ ] 完成 onboarding 流程(创建组织)
- [ ] 验证重定向到 `/dashboard`

#### 2. 现有用户登录流程
- [ ] 退出登录
- [ ] 访问 https://www.urlchecker.dev/auth/sign-in
- [ ] 点击"使用 Google 继续"
- [ ] 验证直接重定向到 `/dashboard`
- [ ] 验证用户信息正确显示

#### 3. CSRF Token 验证
- [ ] 打开浏览器开发者工具 Network 面板
- [ ] 执行 OAuth 登录流程
- [ ] 检查 `/api/session/sign-in` 请求
- [ ] 验证请求头包含 `x-csrf-token`
- [ ] 验证响应状态为 200

#### 4. 边界情况测试
- [ ] 测试中断 OAuth 流程(关闭弹窗)
- [ ] 测试网络错误处理
- [ ] 测试已登录用户访问登录页面(应重定向到 dashboard)
- [ ] 测试未登录用户访问受保护页面(应重定向到登录页)

#### 5. 多语言测试
- [ ] 验证中文界面显示正确
- [ ] 验证英文界面显示正确
- [ ] 验证语言切换功能正常

## 技术架构

### 认证流程
```
用户 → Firebase Auth (OAuth) → ID Token → Next.js API → Session Cookie → Protected Routes
```

### 关键组件
1. **OAuthProviders**: OAuth 登录按钮组件
2. **OAuthRedirectHandler**: OAuth 回调处理组件(已修复时序问题)
3. **withAuthProps**: 服务端认证检查中间件
4. **withAppProps**: 服务端数据获取中间件(包含 onboarding 检查)
5. **/api/session/sign-in**: 会话创建 API(带 CSRF 验证)

### 环境变量(从 Secret Manager 注入)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_SITE_URL`

## 部署命令

### 触发部署
```bash
git add .
git commit -m "feat: unify sign-in and sign-up with Google OAuth"
git push origin main
```

### 监控部署
```bash
# 查看部署状态
gh run list --workflow="deploy-frontend.yml" --limit 3

# 监控部署进度
gh run watch <RUN_ID> --exit-status
```

### 查看部署日志
```bash
# GitHub Actions 日志
gh run view <RUN_ID> --log

# Cloud Build 日志
gcloud builds list --limit=5 --project=gen-lang-client-0944935873
gcloud builds log <BUILD_ID> --project=gen-lang-client-0944935873
```

## 问题排查

### 常见问题

#### 1. OAuth 重定向循环
**症状**: 登录后不断重定向回登录页面
**原因**: CSRF token 未就绪
**解决**: 已在 OAuthRedirectHandler 中添加 token 检查

#### 2. Session Cookie 未设置
**检查**:
```bash
# 浏览器开发者工具 → Application → Cookies
# 查找 "session" cookie
```

#### 3. Firebase Auth 配置错误
**检查**:
```bash
# 验证环境变量
echo $NEXT_PUBLIC_FIREBASE_PROJECT_ID
# 应该输出: gen-lang-client-0944935873
```

#### 4. Google OAuth 授权域名未配置
**检查位置**: Firebase Console → Authentication → Settings → Authorized domains
**必需域名**:
- localhost (本地开发)
- autoads-preview.web.app
- www.urlchecker.dev

## 下一步工作

### 待测试项
1. [ ] 在 preview 环境完成端到端测试
2. [ ] 验证所有测试清单项
3. [ ] 记录测试结果和截图
4. [ ] 修复发现的问题

### 待部署到生产
1. [ ] 合并代码到 production 分支
2. [ ] 触发生产环境部署
3. [ ] 在 www.autoads.dev 执行生产测试
4. [ ] 监控生产环境日志

## 测试结果

### Preview 环境测试
**状态**: ⏳ 待测试
**测试时间**: 待执行
**测试人**: 待指定

测试结果将在此更新...
