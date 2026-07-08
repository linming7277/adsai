# Firebase Google OAuth 登录问题排查

## 问题描述
通过 Google 登录完成授权后，页面跳转回 `https://www.urlchecker.dev/en/auth/sign-in`，显示 "Signing in..." 一直转圈圈，无法完成登录。

## 根本原因分析

我们更新了 GCP OAuth 2.0 客户端凭据（从项目 1007142410985 迁移到 644672509127），但 **Firebase Authentication** 中的 Google 登录提供商配置可能还在使用旧的 OAuth 客户端，或者需要同步更新。

## 排查步骤

### 1. Firebase Authentication Google 提供商配置

访问 Firebase Console 检查 Google 登录配置：
```
https://console.firebase.google.com/project/gen-lang-client-0944935873/authentication/providers
```

需要验证的配置项：
- ✅ Google 登录提供商是否已启用
- ⚠️ OAuth Client ID 是否使用了新的凭据：`YOUR_CLIENT_ID.apps.googleusercontent.com`
- ⚠️ OAuth Client Secret 是否已更新

### 2. Firebase Authorized Domains

检查授权域名是否包含：
```
https://console.firebase.google.com/project/gen-lang-client-0944935873/authentication/settings
```

必须包含的域名：
- ✅ `urlchecker.dev`
- ✅ `www.urlchecker.dev`
- ✅ `autoads.dev`
- ✅ `www.autoads.dev`

### 3. OAuth Redirect URI 配置

检查新的 OAuth 客户端的授权重定向 URI：
```
https://console.cloud.google.com/apis/credentials/oauthclient/YOUR_CLIENT_ID?project=YOUR_PROJECT_ID
```

必须包含 Firebase Auth 回调 URL：
- ✅ `https://www.urlchecker.dev/__/auth/handler`
- ✅ `https://urlchecker.dev/__/auth/handler`
- ✅ `https://www.autoads.dev/__/auth/handler`
- ✅ `https://autoads.dev/__/auth/handler`

### 4. 浏览器控制台错误检查

请在浏览器中打开开发者工具（F12），查看：
- **Console 标签页**：检查是否有 JavaScript 错误
- **Network 标签页**：检查 OAuth 回调请求状态
  - 查找 `/__/auth/handler` 或类似的回调请求
  - 检查响应状态码（是否为 200 或重定向）
  - 查看请求和响应详情

### 5. Firebase Auth 回调处理

可能的问题：
1. **OAuth 客户端不匹配**：Firebase 使用的 OAuth Client ID 与 GCP 中的不一致
2. **重定向 URI 未授权**：新的 OAuth 客户端缺少 Firebase 回调 URL
3. **CORS 配置问题**：跨域请求被阻止
4. **Session 存储问题**：Firebase Auth Session 无法正确保存

## 解决方案

### 方案 1: 更新 Firebase Authentication Google 提供商配置

1. 访问 Firebase Console：
   ```
   https://console.firebase.google.com/project/gen-lang-client-0944935873/authentication/providers
   ```

2. 点击 Google 提供商的编辑按钮

3. 使用新的 OAuth 凭据：
   - Web Client ID: `YOUR_CLIENT_ID.apps.googleusercontent.com`
   - Web Client Secret: `YOUR_CLIENT_SECRET`

4. 保存配置

### 方案 2: 补充 OAuth 重定向 URI

在 GCP OAuth 客户端中添加 Firebase Auth 回调 URL：

```bash
# 需要手动在 GCP Console 中添加以下 URI：
https://www.urlchecker.dev/__/auth/handler
https://urlchecker.dev/__/auth/handler
https://www.autoads.dev/__/auth/handler
https://autoads.dev/__/auth/handler

# Firebase 自动生成的回调 URL 格式
https://gen-lang-client-0944935873.firebaseapp.com/__/auth/handler
```

### 方案 3: 验证 Firebase SDK 配置

检查前端应用的 Firebase 配置：

```bash
# 查看当前配置
gcloud secrets versions access latest --secret=NEXT_PUBLIC_FIREBASE_API_KEY --project=gen-lang-client-0944935873
gcloud secrets versions access latest --secret=NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN --project=gen-lang-client-0944935873
gcloud secrets versions access latest --secret=NEXT_PUBLIC_FIREBASE_PROJECT_ID --project=gen-lang-client-0944935873
```

authDomain 应该是：`www.urlchecker.dev`（当前配置 ✅）

## 临时诊断脚本

创建一个测试页面来捕获详细错误：

```javascript
// 添加到前端代码中临时调试
firebase.auth().onAuthStateChanged((user) => {
  console.log('[Firebase Auth] State Changed:', user ? 'Logged In' : 'Logged Out');
  if (user) {
    console.log('[Firebase Auth] User:', user.email);
  }
}, (error) => {
  console.error('[Firebase Auth] Error:', error);
});

// 监听 OAuth 回调错误
window.addEventListener('message', (event) => {
  console.log('[OAuth Callback] Message:', event.data);
});
```

## 下一步行动

1. **立即检查**：Firebase Console 中 Google 提供商的 OAuth 客户端配置
2. **补充 URI**：在 GCP OAuth 客户端中添加 Firebase Auth 回调 URL
3. **获取日志**：浏览器控制台和 Network 标签页的详细错误信息
4. **测试验证**：清除浏览器缓存和 Cookie 后重新测试

## 相关链接

- Firebase Console Authentication: https://console.firebase.google.com/project/YOUR_PROJECT_ID/authentication/providers
- GCP OAuth 客户端: https://console.cloud.google.com/apis/credentials/oauthclient/YOUR_CLIENT_ID?project=YOUR_PROJECT_ID
- Firebase Auth 域名配置: https://console.firebase.google.com/project/YOUR_PROJECT_ID/authentication/settings
