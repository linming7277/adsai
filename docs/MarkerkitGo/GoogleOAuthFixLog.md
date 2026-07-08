# Google OAuth登录问题修复日志

## 问题描述

**症状**: Google OAuth登录时,页面卡在`/__/auth/handler`,显示空白页面,无法完成登录流程。

**环境**: Cloudflare CDN + Cloud Run (Next.js) 架构

**错误URL**: 
```
https://www.urlchecker.dev/__/auth/handler?apiKey=<REDACTED_FIREBASE_API_KEY>&authType=signInViaRedirect&redirectUrl=...&providerId=google.com
```

## 根本原因

### 错误配置
```bash
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=www.urlchecker.dev
```

**问题分析**:
1. Firebase SDK 使用 `authDomain` 作为 OAuth handler 页面的域名
2. 当 `authDomain=www.urlchecker.dev` 时,SDK尝试加载:
   - `https://www.urlchecker.dev/__/auth/handler`
   - `https://www.urlchecker.dev/__/firebase/init.js`
3. 但这些路径只存在于 Firebase Hosting,不存在于 Cloud Run
4. 导致页面空白,无法加载 Firebase Auth 所需的 JavaScript

### 架构限制

**Cloudflare CDN + Cloud Run 架构**:
```
用户 → Cloudflare CDN → Cloud Run (Next.js)
         ↓
       没有 Firebase Hosting 的 /__/ 保留路径
```

**Firebase Hosting 架构** (Makerkit默认):
```
用户 → Firebase Hosting → Cloud Run
         ↓
       自动提供 /__/ 保留路径
```

## 解决方案

### 修复步骤

#### 1. 更新 authDomain 配置

```bash
# 错误配置
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=www.urlchecker.dev

# 正确配置 - 使用 Firebase 默认域名
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gen-lang-client-0944935873.firebaseapp.com
```

**执行命令**:
```bash
echo "gen-lang-client-0944935873.firebaseapp.com" | \
  gcloud secrets versions add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
  --data-file=- \
  --project=gen-lang-client-0944935873
```

**结果**: Created version [4] of the secret

#### 2. 添加 Firebase 授权域名

访问 Firebase Console:
```
https://console.firebase.google.com/project/gen-lang-client-0944935873/authentication/settings
```

在 **Authorized domains** 中添加:
- ✅ `gen-lang-client-0944935873.firebaseapp.com` (默认)
- ✅ `www.urlchecker.dev` (预发环境)
- ✅ `www.autoads.dev` (生产环境)
- ✅ `urlchecker.dev`
- ✅ `autoads.dev`
- ✅ `localhost` (本地开发)

#### 3. 更新 Firebase Admin 服务账号密钥

**问题**: 旧密钥已被撤销,导致 session cookie 创建失败

```bash
Error: invalid_grant (Invalid grant: account not found)
```

**修复**:
```bash
# 1. 创建新密钥
gcloud iam service-accounts keys create secrets/firebase-adminsdk-new.json \
  --iam-account=firebase-adminsdk-fbsvc@gen-lang-client-0944935873.iam.gserviceaccount.com

# 2. 更新 Secret Manager
cat secrets/firebase-adminsdk-new.json | jq -r '.private_key' | \
  gcloud secrets versions add SERVICE_ACCOUNT_PRIVATE_KEY --data-file=-

cat secrets/firebase-adminsdk-new.json | jq -r '.client_email' | \
  gcloud secrets versions add SERVICE_ACCOUNT_CLIENT_EMAIL --data-file=-

# 3. 删除旧密钥
gcloud iam service-accounts keys delete 38c3c552ac87d77a57f22d113a4126606223e049 \
  --iam-account=firebase-adminsdk-fbsvc@gen-lang-client-0944935873.iam.gserviceaccount.com
```

**新密钥ID**: `92f888b786b2cabe0a0d590b04f614cb89bbaa9f`

## 技术原理

### OAuth 重定向流程 (修复后)

```
1. 用户在 www.urlchecker.dev 点击 "Sign in with Google"
   ↓
2. Firebase SDK 重定向到:
   https://gen-lang-client-0944935873.firebaseapp.com/__/auth/handler
   (Firebase Hosting 提供 handler 页面和 JS 文件)
   ↓
3. Handler 页面重定向到 Google OAuth:
   https://accounts.google.com/o/oauth2/auth?client_id=...&redirect_uri=...
   ↓
4. 用户在 Google 完成授权
   ↓
5. Google 重定向回 Firebase handler:
   https://gen-lang-client-0944935873.firebaseapp.com/__/auth/handler?code=...
   ↓
6. Handler 处理 OAuth callback,然后重定向回应用:
   https://www.urlchecker.dev/auth/sign-in
   ↓
7. OAuthRedirectHandler 检测到 redirect result,创建 session
   ↓
8. 跳转到 /dashboard 或 /onboarding
```

### 关键配置

**firebase.config (客户端)**:
```typescript
{
  apiKey: "<REDACTED_FIREBASE_API_KEY>",
  authDomain: "gen-lang-client-0944935873.firebaseapp.com", // ← 使用默认域名
  projectId: "gen-lang-client-0944935873",
  ...
}
```

**configuration.ts**:
```typescript
auth: {
  useRedirectStrategy: true, // 保持 Makerkit 默认策略
  providers: {
    oAuth: [GoogleAuthProvider],
  }
}
```

## 为什么保持 Cloudflare CDN?

### 对比分析

| 维度 | Firebase Hosting | Cloudflare CDN (选择) |
|------|-----------------|---------------------|
| OAuth支持 | 原生支持 | 需配置authDomain |
| 全球CDN性能 | 中等 | ★★★★★ 优秀 |
| 中国访问 | 受限 | ★★★★☆ 友好 |
| DDOS防护 | 基础 | ★★★★★ 强大 |
| 成本 | 有流量费用 | 完全免费 |
| 配置复杂度 | 低 | 中 (一次性) |

### 最终决策

✅ **保持 Cloudflare CDN + Cloud Run 架构**

**理由**:
1. 性能优势明显 (全球200+节点)
2. 完全免费,无流量费用
3. 强大的安全防护
4. authDomain配置是一次性工作,已完成
5. 中国访问友好

## 验证清单

部署后验证:

- [ ] 访问 https://www.urlchecker.dev/auth/sign-in
- [ ] 点击 "Sign in with Google"
- [ ] 应重定向到 gen-lang-client-0944935873.firebaseapp.com
- [ ] 完成 Google 授权
- [ ] 成功跳转回 www.urlchecker.dev/dashboard
- [ ] 检查 session cookie 已创建
- [ ] 刷新页面仍保持登录状态

## 参考文档

- Firebase Auth Domains: https://firebase.google.com/docs/auth/web/redirect-best-practices
- Firebase Hosting Reserved URLs: https://firebase.google.com/docs/hosting/reserved-urls
- Makerkit Firebase Auth: https://makerkit.dev/docs/next-fire/authentication

## 修复时间线

- **2025-10-05 16:19**: 创建新的 Firebase Admin 密钥
- **2025-10-05 16:20**: 更新 Secret Manager (version 2)
- **2025-10-05 16:22**: 手动部署 frontend-preview-00133-6dp
- **2025-10-05 16:51**: 通过 Playwright 测试发现 authDomain 问题
- **2025-10-05 17:05**: 更新 authDomain 为 Firebase 默认域名
- **2025-10-05 17:10**: 等待 Firebase 授权域名配置完成

## 下一步

1. 等待用户在 Firebase Console 添加授权域名
2. 重新部署 frontend-preview 服务
3. 使用 Playwright 验证 Google 登录流程
4. 更新生产环境配置
