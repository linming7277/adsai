# OAuth redirect_uri_mismatch 错误修复

**错误信息**:
```
Error 400: redirect_uri_mismatch
You can't sign in because project-644672509127 sent an invalid request.
```

## 问题分析

Firebase Authentication 的 OAuth 流程需要正确配置 redirect URI。当前错误是因为实际使用的 redirect URI 没有在 Google OAuth 客户端配置中授权。

## Firebase Auth 工作原理

1. 用户在 `www.urlchecker.dev/auth/sign-in` 点击 "使用 Google 继续"
2. Firebase SDK 重定向到 Google OAuth，redirect_uri = `https://{authDomain}/__/auth/handler`
3. 用户授权后，Google 重定向回该 redirect_uri
4. Firebase 处理回调，然后重定向用户回到应用

## 当前配置

`.env.local`:
```env
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gen-lang-client-0944935873.firebaseapp.com
```

这意味着实际的 redirect_uri 是:
```
https://gen-lang-client-0944935873.firebaseapp.com/__/auth/handler
```

## 需要的 OAuth 客户端配置

在 Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs 中，需要添加以下 redirect URIs:

### 必需的 Redirect URIs:

```
https://gen-lang-client-0944935873.firebaseapp.com/__/auth/handler
```

### Authorized JavaScript origins:

```
https://www.urlchecker.dev
https://www.autoads.dev
https://gen-lang-client-0944935873.firebaseapp.com
```

## 修复步骤

### 方式1: 通过 Google Cloud Console (推荐)

1. 访问 https://console.cloud.google.com/apis/credentials?project=gen-lang-client-0944935873
2. 找到 Firebase 使用的 OAuth 2.0 客户端 ID (通常名称包含 "Web client")
3. 点击编辑
4. 在 "Authorized redirect URIs" 中添加:
   - `https://gen-lang-client-0944935873.firebaseapp.com/__/auth/handler`
5. 在 "Authorized JavaScript origins" 中确保包含:
   - `https://www.urlchecker.dev`
   - `https://www.autoads.dev`
   - `https://gen-lang-client-0944935873.firebaseapp.com`
6. 保存

### 方式2: 通过 gcloud CLI

```bash
# 查找 OAuth 客户端 ID
gcloud auth application-default print-access-token

# 使用 API 更新配置 (需要知道具体的 client ID)
# 通常 Firebase 的 OAuth 客户端可以在 Firebase Console → Project Settings → General → Web API Key 附近找到
```

## Firebase Console 确认

同时确保在 Firebase Console 中:

1. **Authentication → Settings → Authorized domains**:
   - ✅ `urlchecker.dev`
   - ✅ `www.urlchecker.dev`
   - ✅ `autoads.dev`
   - ✅ `www.autoads.dev`
   - ✅ `gen-lang-client-0944935873.firebaseapp.com`

2. **Authentication → Sign-in method → Google**:
   - 确保已启用
   - Web SDK 配置中的 Web client ID 应该与 Google Cloud Console 中的一致

## 验证

配置完成后:

1. 清除浏览器缓存和 cookies
2. 访问 https://www.urlchecker.dev/auth/sign-in
3. 点击 "使用 Google 继续"
4. 应该能够成功授权并重定向

## 常见问题

### Q: 为什么不直接使用自定义域名作为 authDomain?
A: Firebase Authentication 的 OAuth 回调必须经过 Firebase 的服务器处理。使用默认的 `.firebaseapp.com` 域名可以确保所有 Firebase 服务正常工作。自定义域名通过 Firebase Hosting 提供前端内容，但 OAuth 回调仍然使用 Firebase 域名。

### Q: 用户会看到 .firebaseapp.com 域名吗?
A: OAuth 流程中会短暂跳转到该域名，但整个过程非常快，用户体验基本无感。

### Q: 可以完全使用自定义域名吗?
A: 可以，但需要在 Firebase Hosting 中配置自定义域名为 authDomain，这需要额外的 DNS 配置和 Firebase Hosting 高级设置。当前方案更简单可靠。

---
**下一步**: 请在 Google Cloud Console 中添加上述 redirect URI 配置后重试登录。
