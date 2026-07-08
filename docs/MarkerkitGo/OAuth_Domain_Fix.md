# OAuth 授权域名问题修复方案

## 问题描述

1. **OAuth 授权页面显示错误域名**: Google OAuth 授权页面显示 "gen-lang-client-0944935873.firebaseapp.com" 而不是 "www.urlchecker.dev"
2. **登录后重定向循环**: 用户登录后可能被重定向回 sign-in 页面

## 根本原因分析

### 问题1: OAuth 授权域名显示
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` 配置为 `gen-lang-client-0944935873.firebaseapp.com`
- Firebase 的 `authDomain` 决定了 OAuth 授权页面显示的应用域名
- Google OAuth 会显示 `authDomain` 作为应用标识符

### 问题2: 登录重定向循环
- Session cookie 创建时机问题
- `withAuthProps` 检查用户登录状态,但 session cookie 可能未及时设置
- 导致已登录用户被误判为未登录

## 解决方案

### 步骤1: 更新环境变量 ✅

已完成:更新 Secret Manager 中的 `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`

```bash
# 已执行
echo "www.urlchecker.dev" | gcloud secrets versions add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
  --data-file=- --project=gen-lang-client-0944935873
```

### 步骤2: 在 Firebase Console 中添加授权域名 🔧

**需要手动操作**:

1. 打开 Firebase Console: https://console.firebase.google.com/project/gen-lang-client-0944935873/authentication/settings
2. 进入 **Authentication → Settings → Authorized domains**
3. 添加以下域名:
   - `www.urlchecker.dev` (preview 环境)
   - `www.autoads.dev` (production 环境)
   - `urlchecker.dev` (可选,不带 www)
   - `autoads.dev` (可选,不带 www)

### 步骤3: 更新 Google OAuth 配置 🔧

**需要手动操作**:

1. 打开 Google Cloud Console OAuth 配置: https://console.cloud.google.com/apis/credentials?project=gen-lang-client-0944935873
2. 找到 OAuth 2.0 客户端 ID
3. 在 **Authorized JavaScript origins** 中添加:
   - `https://www.urlchecker.dev`
   - `https://www.autoads.dev`
4. 在 **Authorized redirect URIs** 中添加:
   - `https://www.urlchecker.dev/__/auth/handler`
   - `https://www.autoads.dev/__/auth/handler`

### 步骤4: 重新部署应用

```bash
# 推送代码触发部署
git add .
git commit -m "fix: update Firebase authDomain to custom domain"
git push origin main
```

## 重要说明

### 关于 authDomain

1. **Firebase 默认行为**: Firebase 的 `authDomain` 通常是 `[project-id].firebaseapp.com`
2. **自定义域名支持**: Firebase 支持使用自定义域名作为 `authDomain`,但需要满足:
   - 域名必须在 Firebase Console 的 Authorized domains 中配置
   - 域名必须可以访问(DNS 已解析)
   - OAuth 重定向 URI 必须在 Google Cloud Console 中配置

3. **OAuth 授权页面显示**:
   - Google OAuth 授权页面会显示 `authDomain` 作为应用标识
   - 如果使用自定义域名,授权页面会显示自定义域名
   - 这提供了更好的用户体验和品牌一致性

### 关于登录重定向

当前代码流程:
1. 用户点击 Google 登录 → Firebase OAuth 流程
2. OAuth 回调 → `OAuthRedirectHandler` 处理
3. 创建 session cookie → `useCreateServerSideSession`
4. 重定向到 dashboard → `onSignIn()` 回调
5. `withAppProps` 检查 onboarding 状态:
   - 未 onboard → 重定向到 `/onboarding`
   - 已 onboard → 显示 dashboard

**可能的问题**:
- Session cookie 创建异步,可能导致短暂的认证状态不一致
- 解决方案: 代码中已有防护措施(`isSigningIn.current` flag)

## 验证步骤

### 1. 验证环境变量
```bash
gcloud secrets versions access latest --secret="NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" \
  --project=gen-lang-client-0944935873
# 应该输出: www.urlchecker.dev
```

### 2. 验证 Firebase Authorized domains
- 访问 Firebase Console 检查域名列表
- 确保包含 `www.urlchecker.dev` 和 `www.autoads.dev`

### 3. 验证 OAuth 配置
- 访问 Google Cloud Console 检查 OAuth 客户端配置
- 确保重定向 URI 包含自定义域名

### 4. 测试登录流程
```bash
# 访问 preview 环境
open https://www.urlchecker.dev/auth/sign-in

# 测试步骤:
# 1. 点击 "Sign in with Google"
# 2. 检查 OAuth 授权页面显示的域名(应该是 www.urlchecker.dev)
# 3. 授权后检查是否正确重定向到 dashboard 或 onboarding
# 4. 确认没有重定向循环
```

## 后续优化建议

1. **Session 管理优化**:
   - 考虑使用更可靠的 session 状态检查
   - 添加重试机制处理临时的认证状态不一致

2. **错误处理**:
   - 在 OAuth 回调中添加更详细的错误日志
   - 提供用户友好的错误提示

3. **监控**:
   - 添加 OAuth 流程的监控指标
   - 跟踪重定向循环的发生频率

## 参考文档

- [Firebase Custom Domain Setup](https://firebase.google.com/docs/auth/web/redirect-best-practices)
- [Google OAuth Configuration](https://developers.google.com/identity/protocols/oauth2)
- [Firebase Authorized Domains](https://firebase.google.com/docs/auth/web/redirect-best-practices#customize_the_redirect_domain_for_email_actions)
