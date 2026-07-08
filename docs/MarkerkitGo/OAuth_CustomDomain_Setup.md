# Google OAuth 自定义域名配置指南

**日期**: 2025-10-01
**环境**:
- Preview: www.urlchecker.dev
- Production: www.autoads.dev

## 架构说明

### Firebase Authentication + 自定义域名工作流程

1. **用户访问**: `https://www.urlchecker.dev/auth/sign-in`
2. **点击 Google 登录**: Firebase SDK 初始化 OAuth 流程
3. **重定向到 Google**: redirect_uri = `https://www.urlchecker.dev/__/auth/handler`
4. **用户授权**: 在 Google 授权页面完成授权
5. **回调处理**: Google 重定向回 `https://www.urlchecker.dev/__/auth/handler`
6. **Next.js Rewrite**: Next.js 将请求代理到 Firebase: `gen-lang-client-0944935873.firebaseapp.com/__/auth/handler`
7. **Firebase 处理**: Firebase 验证 OAuth 响应，设置 session
8. **用户重定向**: 返回应用 (onboarding 或 dashboard)

## 当前配置

### 环境变量配置

**`.env.local`** (preview 环境):
```env
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=www.urlchecker.dev
NEXT_PUBLIC_SITE_URL=https://www.urlchecker.dev
```

**生产环境配置** (需要在 Cloud Build 或 Secret Manager 中设置):
```env
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=www.autoads.dev
NEXT_PUBLIC_SITE_URL=https://www.autoads.dev
```

### Next.js Rewrite 配置

**`next.config.mjs`** (保持不变):
```javascript
async rewrites() {
  return [
    {
      source: "/__/auth/:path*",
      destination: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com/__/auth/:path*`,
    },
  ];
}
```

这个 rewrite 非常关键，它确保：
- 用户看到的是自定义域名
- 实际的 OAuth 回调由 Firebase 服务器处理

## Google OAuth 客户端配置

### 需要添加的配置

访问 **Google Cloud Console**:
```
https://console.cloud.google.com/apis/credentials?project=gen-lang-client-0944935873
```

找到 **Web client (auto created by Google Service)** 或类似名称的 OAuth 2.0 客户端，添加以下配置：

#### 1. Authorized JavaScript origins

```
https://www.urlchecker.dev
https://www.autoads.dev
```

**注意**: 不需要添加 `.firebaseapp.com` 域名到这里

#### 2. Authorized redirect URIs

```
https://www.urlchecker.dev/__/auth/handler
https://www.autoads.dev/__/auth/handler
```

**关键点**:
- ✅ 使用自定义域名 (www.urlchecker.dev / www.autoads.dev)
- ✅ 路径必须是 `/__/auth/handler`
- ❌ 不使用 `.firebaseapp.com` 域名

### 配置截图参考

在 Google Cloud Console 中，配置应该类似：

```
Authorized JavaScript origins:
┌─────────────────────────────────────┐
│ https://www.urlchecker.dev          │
│ https://www.autoads.dev             │
└─────────────────────────────────────┘

Authorized redirect URIs:
┌──────────────────────────────────────────────────────┐
│ https://www.urlchecker.dev/__/auth/handler           │
│ https://www.autoads.dev/__/auth/handler              │
└──────────────────────────────────────────────────────┘
```

## Firebase Console 配置

### Authorized Domains

在 **Firebase Console → Authentication → Settings → Authorized domains** 中确认已添加:

```
✅ urlchecker.dev
✅ www.urlchecker.dev
✅ autoads.dev
✅ www.autoads.dev
```

### Google Sign-in Provider

在 **Firebase Console → Authentication → Sign-in method** 中:

1. 确保 **Google** 提供商已启用
2. 记录 **Web client ID** (应该与 Google Cloud Console 中的一致)

## 部署配置

### Cloud Build 环境变量

需要在 Cloud Build 配置中传递正确的环境变量。

**Preview 环境** (`main` 分支):
```yaml
substitutions:
  _NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "www.urlchecker.dev"
  _NEXT_PUBLIC_SITE_URL: "https://www.urlchecker.dev"
```

**Production 环境** (`production` 分支):
```yaml
substitutions:
  _NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "www.autoads.dev"
  _NEXT_PUBLIC_SITE_URL: "https://www.autoads.dev"
```

### Dockerfile 构建参数

确保 `apps/frontend/Dockerfile` 包含这些 ARG:
```dockerfile
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
```

## 验证步骤

### 1. 检查配置是否生效

```bash
# 访问前端，检查 Firebase 配置
curl -s https://www.urlchecker.dev/ | grep -o "authDomain.*urlchecker"
```

预期输出应包含: `authDomain: "www.urlchecker.dev"`

### 2. 测试 Auth Handler 端点

```bash
# 测试 rewrite 是否工作
curl -I https://www.urlchecker.dev/__/auth/handler
```

应该返回 200 或 400 (400 是正常的，因为缺少参数)

### 3. 完整登录流程测试

1. 清除浏览器缓存和 cookies
2. 访问: https://www.urlchecker.dev/auth/sign-in
3. 点击 "使用 Google 继续"
4. **检查点**:
   - ✅ Google 授权页面显示: "www.urlchecker.dev wants to..."
   - ✅ 授权后重定向到: `https://www.urlchecker.dev/__/auth/handler?...`
   - ✅ 最终重定向到: onboarding 或 dashboard
   - ❌ 不应该出现 "redirect_uri_mismatch" 错误

## 常见问题排查

### Q1: 仍然看到 redirect_uri_mismatch 错误

**原因**: Google OAuth 客户端配置未正确更新

**解决**:
1. 再次检查 Google Cloud Console 中的 redirect URIs
2. 确保没有多余的空格或错误的域名
3. 保存后等待 2-5 分钟让配置生效
4. 清除浏览器缓存

### Q2: /__/auth/handler 返回 404

**原因**: Next.js rewrite 配置问题

**解决**:
1. 检查 `next.config.mjs` 中的 rewrite 配置
2. 确保 `NEXT_PUBLIC_FIREBASE_PROJECT_ID` 环境变量正确
3. 重新构建和部署前端

### Q3: 授权后仍然返回登录页

**原因**: Session cookie 设置问题或 CORS 问题

**解决**:
1. 检查浏览器开发者工具 → Network → 查看 cookie 是否设置
2. 检查 Firebase Console → Authentication → Users 是否创建了用户
3. 查看浏览器控制台是否有错误信息

### Q4: 构建时出现 Firebase Auth 初始化错误

**原因**: SSR/SSG 时 Firebase Auth 重复初始化

**解决**: 已在 `FirebaseAuthProvider.tsx` 中修复，使用 `getAuth()` 检查是否已初始化

## 下一步操作

1. **立即执行**: 在 Google Cloud Console 中添加上述 redirect URIs
2. **提交代码**: 提交 `.env.local` 的更改
3. **触发部署**: 推送到 `main` 分支触发 preview 环境部署
4. **测试验证**: 完整测试 OAuth 登录流程
5. **生产部署**: 确认 preview 环境正常后，合并到 `production` 分支

---

**重要提示**:
- authDomain 使用自定义域名是推荐的做法
- Next.js rewrite 确保 Firebase Auth 服务正常工作
- 两个环境需要分别配置不同的域名

**最后更新**: 2025-10-01 21:35 UTC+8
