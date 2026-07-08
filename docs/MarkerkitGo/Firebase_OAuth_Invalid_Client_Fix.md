# Firebase Google 登录配置错误排查

## 错误信息
```
error=invalid_client&error_description=Unauthorized
auth/invalid-credential
OAuth2 redirect uri is: https://www.urlchecker.dev/__/auth/handler
```

## 问题根源
Firebase Authentication 的 Google 登录提供商配置与 GCP OAuth 客户端凭据不匹配。

## 必须操作

### 1. 访问 Firebase Console
```
https://console.firebase.google.com/project/gen-lang-client-0944935873/authentication/providers
```

### 2. 编辑 Google 登录提供商

点击 Google 提供商右侧的 **编辑按钮**

### 3. 更新 Web SDK 配置

**重要**: 必须同时更新 Client ID 和 Client Secret

**Web 客户端 ID**:
```
YOUR_CLIENT_ID.apps.googleusercontent.com
```

**Web 客户端密钥**:
```
YOUR_CLIENT_SECRET
```

### 4. 保存配置

点击 **保存** 按钮

### 5. 验证

保存后，Firebase 会立即使用新的凭据，无需重启服务。

## 验证步骤

1. 清除浏览器缓存和 Cookie
2. 访问 https://www.urlchecker.dev/en/auth/sign-in
3. 点击 "Continue with Google"
4. 应该会成功弹出 Google OAuth 窗口并完成登录

## 注意事项

- Client ID 和 Client Secret 必须来自同一个 OAuth 客户端
- 如果只更新 Client ID 而不更新 Secret，会导致 invalid_client 错误
- Firebase Console 的配置更新是实时生效的

## 相关链接

- GCP OAuth 客户端: https://console.cloud.google.com/apis/credentials/oauthclient/YOUR_CLIENT_ID?project=YOUR_PROJECT_ID
- Firebase Auth 设置: https://console.firebase.google.com/project/YOUR_PROJECT_ID/authentication/providers
