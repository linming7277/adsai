# OAuth 登录问题修复与部署测试

**日期**: 2025-10-01
**环境**: Preview (www.urlchecker.dev)
**提交**: 9b2116cd

## 问题描述

修复两个 OAuth 登录问题:

1. **问题1**: OAuth 授权页面显示 "gen-lang-client-0944935873.firebaseapp.com" 而不是 "www.urlchecker.dev"
2. **问题2**: Google 授权后仍然重定向回登录页面

## 解决方案

### 已手动完成的配置

1. **Firebase Console 配置** (Authentication → Settings → Authorized domains):
   - 添加: `www.urlchecker.dev`
   - 添加: `www.autoads.dev`

2. **Google Cloud Console OAuth 客户端配置**:
   - Authorized JavaScript origins:
     - `https://www.urlchecker.dev`
     - `https://www.autoads.dev`
   - Authorized redirect URIs:
     - `https://www.urlchecker.dev/__/auth/handler`
     - `https://www.autoads.dev/__/auth/handler`

### 代码修复

修复了 Firebase Auth 初始化问题,避免在 SSR/SSG 时重复注册:

**文件**: `apps/frontend/src/core/firebase/components/FirebaseAuthProvider.tsx`

```typescript
// Check if auth is already initialized to avoid "auth has not been registered" error
let sdk;
try {
  sdk = getAuth(app);
} catch (error) {
  sdk = initializeAuth(app, { persistence });
}
```

**说明**: `authDomain` 保持为默认的 `gen-lang-client-0944935873.firebaseapp.com`,自定义域名通过 Firebase Console 的 Authorized Domains 配置生效。

## 部署流程

### 1. 代码提交与推送
```bash
git commit -m "fix: improve Firebase Auth initialization..."
git push origin main
```

### 2. CI/CD 自动部署
触发了3个 GitHub Actions workflow:
- ✅ Deploy Backend (Cloud Build → Cloud Run) - SUCCESS
- ✅ Deploy API Gateway (Render + Publish) - SUCCESS
- ✅ Deploy Frontend (Firebase Hosting) - SUCCESS

### 3. Cloud Build 构建详情
```bash
# 查看构建状态
gcloud builds list --limit=5

# 成功构建的服务:
- offer: preview-9b2116c
- browser-exec: preview-9b2116c
- console (frontend): preview-latest
```

### 4. Cloud Run 服务部署
```bash
# 前端服务
console-preview: https://console-preview-yt54xvsg5q-an.a.run.app
```

## 测试结果

### 1. 域名访问测试
```bash
curl -I https://www.urlchecker.dev/
# HTTP/2 200 ✅
# server: Google Frontend ✅
# x-powered-by: Next.js ✅
```

### 2. 登录页面测试
```bash
curl -s https://www.urlchecker.dev/auth/sign-in | grep -i "google"
```

**结果**: ✅ 登录页面正常显示 "使用 Google 继续" 按钮

### 3. Firebase Hosting + Cloud Run 部署架构

根据 `MustKnowV4.md`:
```
前端：基于Makerkit，部署结构是Firebase Hosting+Cloud Run
```

**当前部署状态**:
- ✅ Cloud Run: `console-preview-yt54xvsg5q-an.a.run.app`
- ✅ 域名: `www.urlchecker.dev` (通过 Firebase Hosting 提供CDN和SSL)
- ✅ 响应头显示: `server: Google Frontend` (Firebase Hosting)

## 下一步建议

### 需要手动测试的内容:

1. **OAuth 登录流程**:
   - [ ] 访问 https://www.urlchecker.dev/auth/sign-in
   - [ ] 点击"使用 Google 继续"
   - [ ] 验证授权页面显示的域名是否为 `www.urlchecker.dev`
   - [ ] 完成授权后检查是否正确重定向到 onboarding 或 dashboard

2. **会话管理**:
   - [ ] 验证登录后 cookie 是否正确设置
   - [ ] 刷新页面验证会话是否保持
   - [ ] 登出功能是否正常

3. **跨页面导航**:
   - [ ] 验证受保护页面的访问控制
   - [ ] 测试首次登录用户的 onboarding 流程

## 技术细节

### Next.js 配置
- Output mode: `standalone` (适合 Docker 部署)
- Firebase Auth Rewrites: `/__/auth/:path*` → Firebase Auth Handler

### Firebase Auth 初始化
- 浏览器端: 使用 `indexedDBLocalPersistence`
- 服务端: 跳过持久化(SSR/SSG)
- 避免重复初始化: 先尝试 `getAuth()`,失败时才 `initializeAuth()`

## 结论

✅ **部署成功**: 所有服务已成功构建并部署到 preview 环境
✅ **配置完成**: Firebase 和 Google OAuth 配置已就绪
⚠️ **待验证**: 需要手动测试完整的 OAuth 登录流程

---
生成时间: 2025-10-01 21:14:00 UTC+8
