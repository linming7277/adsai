# Firebase Auth 自定义域名 OAuth 回调配置方案

## 当前配置状态

✅ **authDomain 已正确配置**：`www.urlchecker.dev`
✅ **OAuth 重定向 URI 已配置**：
- `https://www.urlchecker.dev/__/auth/handler`
- `https://www.autoads.dev/__/auth/handler`

## 为什么不需要 .firebaseapp.com

当 Firebase SDK 配置了 `authDomain: 'www.urlchecker.dev'` 时，所有 OAuth 回调都会使用自定义域名，**不会使用** `gen-lang-client-0944935873.firebaseapp.com`。

这样的好处：
- ✅ 用户永远不会看到 `.firebaseapp.com` 域名
- ✅ 品牌一致性更好
- ✅ 减少暴露项目 ID

## OAuth 回调流程验证

### 正常流程应该是：

1. 用户点击 "Sign in with Google"
2. 跳转到 Google OAuth 授权页面
3. 用户授权后，Google 重定向到：`https://www.urlchecker.dev/__/auth/handler?code=xxx&state=xxx`
4. Firebase Auth 处理回调，创建 Session
5. 前端检测到登录状态，跳转到主页

### 当前问题：停在步骤 4 或 5

可能的原因：

#### 原因 1: Firebase Console 中 OAuth 客户端配置错误

访问 Firebase Console 检查：
```
https://console.firebase.google.com/project/gen-lang-client-0944935873/authentication/providers
```

点击 Google 提供商，检查：
- **Web SDK 配置** 部分的 **Web Client ID**
- 是否是新的：`YOUR_CLIENT_ID.apps.googleusercontent.com`
- 如果不是，需要更新为新的 Client ID 和 Secret

#### 原因 2: 授权域名未配置

检查 Firebase 授权域名：
```
https://console.firebase.google.com/project/gen-lang-client-0944935873/authentication/settings
```

必须包含：
- ✅ `urlchecker.dev`
- ✅ `www.urlchecker.dev`
- ✅ `autoads.dev`
- ✅ `www.autoads.dev`

#### 原因 3: CORS 或 Cookie 问题

Firebase Auth 依赖 Cookies 和 LocalStorage，可能被：
- 浏览器隐私设置阻止
- 第三方 Cookie 限制
- CORS 策略阻止

## 完整解决方案

### 步骤 1: 更新 Firebase Console Google 提供商配置

1. 访问：https://console.firebase.google.com/project/gen-lang-client-0944935873/authentication/providers

2. 点击 **Google** 提供商右侧的编辑按钮

3. 在 **Web SDK 配置** 部分：
   - **Web 客户端 ID**: `YOUR_CLIENT_ID.apps.googleusercontent.com`
   - **Web 客户端密钥**: `YOUR_CLIENT_SECRET`

4. 点击 **保存**

### 步骤 2: 验证授权域名

1. 访问：https://console.firebase.google.com/project/gen-lang-client-0944935873/authentication/settings

2. 滚动到 **授权域名** 部分

3. 确保包含：
   - `urlchecker.dev`
   - `www.urlchecker.dev`
   - `autoads.dev`
   - `www.autoads.dev`

### 步骤 3: 清理并测试

1. **清除浏览器缓存和 Cookie**
   ```
   Chrome: Cmd+Shift+Delete
   选择：Cookies 和其他网站数据、缓存的图片和文件
   时间范围：过去 24 小时
   ```

2. **访问测试**
   ```
   https://www.urlchecker.dev/en/auth/sign-in
   ```

3. **监控浏览器控制台**
   - 打开开发者工具（F12）
   - 切换到 **Console** 标签页
   - 点击 "Sign in with Google"
   - 查看是否有错误信息

4. **检查 Network 请求**
   - 切换到 **Network** 标签页
   - 筛选：`__/auth`
   - 查看 `/__/auth/handler` 请求的状态码和响应

### 步骤 4: 如果仍然失败，检查前端配置

验证前端环境变量：

```bash
# 检查 Secret Manager 中的配置
gcloud secrets versions access latest --secret=NEXT_PUBLIC_FIREBASE_API_KEY --project=gen-lang-client-0944935873
gcloud secrets versions access latest --secret=NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN --project=gen-lang-client-0944935873
gcloud secrets versions access latest --secret=NEXT_PUBLIC_FIREBASE_PROJECT_ID --project=gen-lang-client-0944935873
```

确保 `authDomain` 是 `www.urlchecker.dev`（不是 `gen-lang-client-0944935873.firebaseapp.com`）

## 常见问题

### Q: 为什么更新了 OAuth 客户端后需要在 Firebase Console 中再次配置？

A: Firebase Authentication 有自己的 OAuth 配置管理。虽然我们在 GCP 中创建了 OAuth 客户端，但 Firebase Console 需要知道使用哪个客户端。

### Q: 是否需要重启服务？

A: Firebase Console 配置更新后立即生效，但建议：
- 清除浏览器缓存和 Cookie
- 如果前端使用环境变量，可能需要重新部署前端服务

### Q: 如果要支持多个域名怎么办？

A: Firebase Auth 的 `authDomain` 只能配置一个，但可以在 OAuth 重定向 URI 中添加多个：
```
https://www.urlchecker.dev/__/auth/handler  (preview)
https://www.autoads.dev/__/auth/handler     (production)
```

前端根据部署环境使用不同的 `authDomain`。

## 调试命令

如果仍有问题，提供以下信息：

1. **浏览器控制台错误**
2. **Network 请求截图**（特别是 `/__/auth/handler`）
3. **Firebase Console 当前配置截图**

```bash
# 查看前端服务日志
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=frontend-preview" \
  --limit=50 \
  --project=gen-lang-client-0944935873 \
  --format=json

# 查看最近的错误
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" \
  --limit=20 \
  --project=gen-lang-client-0944935873
```

## 总结

✅ **不需要** 在 OAuth 重定向 URI 中添加 `.firebaseapp.com`
✅ 只需要在 **Firebase Console** 中更新 Google 提供商的 **Web Client ID** 和 **Secret**
✅ 确保 OAuth 重定向 URI 包含自定义域名的 `/__/auth/handler` 路径
