# Google OAuth 自定义域名 - 最终配置总结

**日期**: 2025-10-01
**状态**: ✅ 配置完成，等待 Google OAuth 客户端更新

## 当前配置状态

### ✅ 已完成

1. **Secret Manager 配置** ✅
   ```bash
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = www.urlchecker.dev
   ```
   已在 Secret Manager 中正确配置

2. **本地开发环境** ✅
   ```bash
   # apps/frontend/.env.local
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=www.urlchecker.dev
   ```

3. **Cloud Build 配置** ✅
   ```yaml
   # deployments/cloudbuild/build-frontend-docker.yaml
   # 正确从 Secret Manager 读取 FIREBASE_AUTH_DOMAIN
   ```

4. **Next.js Rewrite** ✅
   ```javascript
   // next.config.mjs
   {
     source: "/__/auth/:path*",
     destination: "https://gen-lang-client-0944935873.firebaseapp.com/__/auth/:path*"
   }
   ```
   保持不变，用于代理 Firebase Auth 请求

5. **代码部署** ✅
   - 提交: 65306980
   - 分支: main
   - 状态: 正在部署

### ⏳ 待完成 (需要手动操作)

**Google Cloud Console OAuth 客户端配置** ⏳

访问: https://console.cloud.google.com/apis/credentials?project=gen-lang-client-0944935873

找到 **Web client (auto created by Google Service)** 或 Firebase 的 OAuth 2.0 客户端，添加以下配置：

#### Authorized JavaScript origins (需要添加)
```
https://www.urlchecker.dev
https://www.autoads.dev
```

#### Authorized redirect URIs (需要添加)
```
https://www.urlchecker.dev/__/auth/handler
https://www.autoads.dev/__/auth/handler
```

**重要**:
- ❌ 不需要添加 `.firebaseapp.com` 相关的 redirect URIs
- ✅ 直接使用自定义域名
- ✅ 路径必须是 `/__/auth/handler`

## 工作流程说明

### OAuth 登录完整流程

```
1. 用户访问: https://www.urlchecker.dev/auth/sign-in
   └─> Next.js 前端渲染登录页面

2. 点击 "使用 Google 继续"
   └─> Firebase SDK 初始化 OAuth (authDomain = www.urlchecker.dev)

3. 重定向到 Google 授权页面
   └─> redirect_uri = https://www.urlchecker.dev/__/auth/handler
   └─> Google 显示: "www.urlchecker.dev wants to access..."

4. 用户授权
   └─> Google 重定向: https://www.urlchecker.dev/__/auth/handler?code=...

5. Next.js Rewrite 生效
   └─> 实际请求: https://gen-lang-client-0944935873.firebaseapp.com/__/auth/handler?code=...
   └─> Firebase 处理 OAuth 回调，创建 session

6. 用户重定向
   └─> 首次登录: /onboarding
   └─> 已有账号: /dashboard
```

### 为什么这样设计？

1. **用户体验**: 用户始终看到的是自定义域名 (www.urlchecker.dev)
2. **Firebase 兼容**: Firebase Auth 服务仍然正常工作 (通过 Next.js rewrite)
3. **SEO 友好**: 所有 URL 都使用品牌域名
4. **安全性**: OAuth redirect URI 限制在自定义域名

## 验证步骤

### 1. 等待部署完成

```bash
# 监控部署状态
gh run list --limit 3

# 查看构建日志
gh run view --log
```

### 2. 在 Google OAuth 客户端中添加 redirect URIs

如上 "待完成" 部分所述

### 3. 测试登录流程

```bash
# 访问登录页面
https://www.urlchecker.dev/auth/sign-in

# 测试步骤:
1. 清除浏览器缓存和 cookies
2. 点击 "使用 Google 继续"
3. 检查 Google 授权页面是否显示 "www.urlchecker.dev"
4. 完成授权
5. 确认重定向到 onboarding 或 dashboard
```

### 4. 验证配置生效

```bash
# 检查前端是否正确加载 authDomain
curl -s https://www.urlchecker.dev/ | grep -o '"authDomain":"[^"]*"'
# 预期输出: "authDomain":"www.urlchecker.dev"

# 检查 /__/auth 路径是否可访问
curl -I https://www.urlchecker.dev/__/auth/handler
# 预期: 200 或 400 (400 是正常的，因为缺少参数)
```

## 环境对应关系

| 环境 | 分支 | authDomain | Site URL | OAuth Redirect URI |
|------|------|------------|----------|-------------------|
| Preview | main | www.urlchecker.dev | https://www.urlchecker.dev | https://www.urlchecker.dev/__/auth/handler |
| Production | production | www.autoads.dev | https://www.autoads.dev | https://www.autoads.dev/__/auth/handler |

**注意**: 生产环境的 Secret Manager 需要单独配置或使用环境变量覆盖

## 常见问题

### Q: 为什么不能直接在前端使用 .firebaseapp.com?

A: 可以，但用户会在 OAuth 流程中看到 Firebase 默认域名，影响品牌体验。使用自定义域名可以提供一致的用户体验。

### Q: Next.js rewrite 会影响性能吗?

A: 不会。Rewrite 只影响 `/__/auth` 路径，这是 Firebase Auth 的专用端点，不影响其他页面。

### Q: 如果忘记配置 Google OAuth redirect URI 会怎样?

A: 会出现 `Error 400: redirect_uri_mismatch` 错误，用户无法完成登录。

### Q: 可以使用多个自定义域名吗?

A: 可以。在 Google OAuth 客户端中添加所有需要的 redirect URIs 即可。

## 下一步

1. ✅ 等待当前部署完成 (约 5-10 分钟)
2. ⏳ 在 Google Cloud Console 添加 redirect URIs
3. ⏳ 测试完整的 OAuth 登录流程
4. ⏳ 如有问题，查看浏览器控制台和 Cloud Run 日志

## 参考文档

- OAuth_CustomDomain_Setup.md - 详细设置指南
- OAuth_RedirectURI_Fix.md - redirect_uri 错误排查
- OAuth_Fix_Deployment_Test.md - 部署测试记录

---

**最后更新**: 2025-10-01 21:37 UTC+8
**提交**: 65306980
**部署状态**: 进行中
