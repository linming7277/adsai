# OAuth 登录 401 错误调试进展

## 问题描述
用户通过 Google OAuth 登录成功，但创建 server-side session 时返回 401 Unauthorized。

## 已完成的修复

### 1. OAuth 重定向 URI 配置 ✅
- **问题**：缺少非 www 版本的重定向 URI
- **修复**：在 GCP OAuth 客户端中添加：
  - `https://urlchecker.dev/__/auth/handler`
  - `https://autoads.dev/__/auth/handler`
- **状态**：✅ 已完成

### 2. CSRF Token 调试日志 ✅
- **客户端**：`apps/frontend/src/core/hooks/use-api.ts`
  - 添加日志显示 token 是否可用
- **服务器端**：`apps/frontend/src/core/middleware/with-csrf.ts`
  - 添加详细的 CSRF 验证日志
  - 会显示具体哪个检查失败（token缺失/secret缺失/验证失败）
- **状态**：✅ 已完成

### 3. Cloud Build 配置修复 ✅
- **问题**：`.gcloudignore` 排除了 `apps/` 目录，导致前端构建失败
  - 错误：`unable to evaluate symlinks in Dockerfile path: lstat /workspace/apps: no such file or directory`
- **修复**：重写 `.gcloudignore` 文件，使用显式的否定规则：
  ```
  !apps/
  !apps/frontend/
  !apps/frontend/**
  ```
- **验证**：本地测试 `gcloud meta list-files-for-upload` 确认 `apps/frontend/` 文件会被上传
- **状态**：✅ 已完成

## 当前状态

### 构建进度
- **GitHub Actions Run**: #18171194436
- **状态**: in_progress (正在构建中)
- **Commit**: 7f8e52fb (包含所有修复)
- **预计完成时间**: 5-8分钟（Docker 构建 + 部署）

### 下一步操作
部署完成后：

1. **验证 CSRF Token 流程**
   - 访问 https://www.urlchecker.dev/auth/sign-in
   - 打开浏览器开发者工具（Console + Network）
   - 点击 "Continue with Google"
   - 观察日志输出：
     - `[CSRF] Token available: ...` 或 `[CSRF] No CSRF token available`
     - `[OAuth] Starting sign-in...`
     - `[OAuth] Sign-in result: Success`
     - 检查 `/api/session/sign-in` 请求的响应

2. **查看服务器端日志**
   ```bash
   gcloud run services logs read frontend-preview \
     --project=gen-lang-client-0944935873 \
     --region=asia-northeast1 \
     --limit=50
   ```
   查找：
   - `[CSRF Server] Validating CSRF token`
   - `[CSRF Server] Token present: ...`
   - `[CSRF Server] Secret present: ...`
   - `[CSRF Server] FAILED: ...` (如果有错误)

3. **诊断结果分析**

   **情况A：Token 不可用**
   - 日志显示：`[CSRF] No CSRF token available`
   - 原因：`CsrfTokenContext` 中没有 token
   - 解决方案：检查 SSR 页面生成，确保 `withAuthProps` 正确调用

   **情况B：Token 可用但请求头缺失**
   - 日志显示：`[CSRF] Token available`
   - 服务器日志：`[CSRF Server] FAILED: Token is missing`
   - 原因：`use-api.ts` 没有正确添加请求头
   - 解决方案：检查 `getSecurityHeaders()` 逻辑

   **情况C：Secret 缺失**
   - 服务器日志：`[CSRF Server] FAILED: Secret is missing`
   - 原因：Cookie `csrfSecret` 没有发送或被清除
   - 解决方案：检查 Cookie 配置（SameSite, Secure, HttpOnly）

   **情况D：验证失败**
   - 服务器日志：`[CSRF Server] FAILED: Token verification failed`
   - 原因：Token 和 Secret 不匹配（可能页面刷新或过期）
   - 解决方案：确保 token 和 secret 来自同一次页面加载

## 相关文件

### 前端代码
- `apps/frontend/src/components/auth/OAuthProviders.tsx` - OAuth 登录逻辑
- `apps/frontend/src/core/hooks/use-api.ts` - API 请求封装（含 CSRF token）
- `apps/frontend/src/core/middleware/with-csrf.ts` - CSRF 验证中间件
- `apps/frontend/src/lib/props/with-auth-props.ts` - 登录页 SSR props
- `apps/frontend/src/pages/auth/sign-in.tsx` - 登录页面

### 配置文件
- `.gcloudignore` - Cloud Build 上传过滤规则
- `deployments/cloudbuild/build-frontend-docker.yaml` - 前端构建配置
- `.github/workflows/deploy-frontend.yml` - CI/CD 工作流

### 测试脚本
- `test-csrf-token.js` - 测试登录页 CSRF token 配置

## 架构说明

### OAuth 登录流程
1. 用户点击 "Continue with Google"
2. 弹出 Google OAuth 窗口（Popup 策略）
3. 用户授权后，popup 关闭，返回 Firebase UserCredential
4. 前端调用 `POST /api/session/sign-in` 创建 server-side session
   - 请求头包含：`x-csrf-token: <token>`
   - Cookie 包含：`csrfSecret=<secret>`
5. 服务器验证 CSRF token，创建 session cookie
6. 重定向到 dashboard 或 onboarding

### CSRF 保护机制
- **生成**：SSR 时通过 `createCsrfToken(ctx)` 生成
- **存储**：
  - Secret → `csrfSecret` cookie (HttpOnly, Secure, SameSite=Strict)
  - Token → `pageProps.csrfToken` → `CsrfTokenContext.Provider`
- **传递**：`use-api.ts` 自动从 context 获取 token 并添加到请求头
- **验证**：`with-csrf.ts` 中间件验证 token 和 secret 是否匹配

## 预期结果

✅ **成功场景**
```
浏览器控制台:
[CSRF] Token available: zIesUH2L-q...
[OAuth] Starting sign-in with provider: google.com
[OAuth] Sign-in result: Success
(重定向到 dashboard)

服务器日志:
[CSRF Server] Validating CSRF token
[CSRF Server] Token present: true (zIesUH2L-q...)
[CSRF Server] Secret present: true (yw3I-lYMjO...)
[CSRF Server] ✅ Validation passed
```

❌ **失败场景**（当前问题）
```
浏览器控制台:
[OAuth] Sign-in result: Success
POST /api/session/sign-in 401 (Unauthorized)
[OAuth] Sign-in error: {statusCode: 401, ...}

服务器日志:
[CSRF Server] Validating CSRF token
[CSRF Server] Token present: false
[CSRF Server] FAILED: Token is missing from request headers
```

## 测试清单

构建部署完成后，依次检查：

- [ ] 构建是否成功（无 `lstat /workspace/apps` 错误）
- [ ] 前端服务是否更新到最新版本
- [ ] 登录页面是否正常加载
- [ ] 浏览器控制台是否显示 CSRF token 日志
- [ ] OAuth 登录是否成功（Google 弹窗）
- [ ] Session 创建是否成功（无 401 错误）
- [ ] 服务器日志是否显示详细的 CSRF 验证信息
- [ ] 首次登录用户是否正确重定向到 onboarding
- [ ] 已有用户是否重定向到 dashboard

## 补充信息

### 用户注册流程
根据用户说明："目前用户前端只有一个'Continue with Google'的登录按钮，如果用户之前未注册过，那么第一次通过Google登录就需要同步建立用户档案。"

这意味着：
1. 首次 OAuth 登录时，Firebase Authentication 会自动创建用户账号
2. 需要检查后端是否正确处理首次登录的用户
3. `withAppProps` 中的 `isOnboarded` 检查会决定是否重定向到 onboarding

相关代码（`with-app-props.ts:96-102`）：
```typescript
const isOnboarded = Boolean(metadata?.customClaims?.onboarded);

// when the user is not yet onboarded,
// we simply redirect them back to the onboarding flow
if (!isOnboarded) {
  return redirectToOnboarding();
}
```

这个逻辑依赖于 session 创建成功，所以 **401 错误是阻塞整个注册流程的根本问题**。
