# 🚀 Google登录问题快速参考

## 📍 当前状态

- ✅ 代码已修复
- ✅ 已部署到Cloud Run
- ⏳ 等待测试验证

## 🔗 关键链接

### 测试URL
- **Cloud Run直接**: https://frontend-preview-yt54xvsg5q-an.a.run.app/auth/sign-in
- **Cloudflare CDN**: https://www.urlchecker.dev/auth/sign-in

### Firebase Console
- **认证设置**: https://console.firebase.google.com/project/gen-lang-client-0944935873/authentication/settings
- **授权域名**: 在认证设置页面滚动到底部

### Cloudflare Dashboard
- **域名管理**: https://dash.cloudflare.com/
- **Page Rules**: Rules > Page Rules

## 🧪 快速测试步骤

### 1分钟快速测试

```bash
# 1. 运行自动诊断
./auto-diagnose.sh

# 2. 打开隐身窗口
# 3. 访问: https://frontend-preview-yt54xvsg5q-an.a.run.app/auth/sign-in
# 4. 打开Console (Cmd+Option+I)
# 5. 点击Google登录
# 6. 观察日志
```

### 期望的成功日志

```
[Sign In] Signing in with redirect
[OAuth Redirect] Checking for redirect result...
[OAuth Redirect] Credential received, creating session
```

或

```
[OAuth Redirect] User found via onAuthStateChanged, creating session
```

## 🔍 常见错误快速修复

### auth/unauthorized-domain
→ 添加域名到Firebase授权列表

### getRedirectResult() 返回 null
→ 检查IndexedDB和Cookie是否被阻止

### 无限"Signing in..."
→ 清除浏览器缓存，使用隐身窗口

### Cloudflare问题
→ 配置Page Rule绕过 `/auth/*` 缓存

## 📋 必需的Firebase授权域名

- [ ] localhost
- [ ] www.urlchecker.dev
- [ ] urlchecker.dev
- [ ] frontend-preview-yt54xvsg5q-an.a.run.app
- [ ] frontend-prod-yt54xvsg5q-an.a.run.app
- [ ] gen-lang-client-0944935873.firebaseapp.com
- [ ] gen-lang-client-0944935873.web.app
- [ ] www.autoads.dev
- [ ] autoads.dev

## 🛠️ 诊断工具

```bash
# 自动诊断
./auto-diagnose.sh

# 检查Firebase配置
node verify-firebase-oauth-config.cjs

# 检查OAuth Client
bash get-oauth-client-config.sh

# 查看部署状态
gcloud run revisions list --service=frontend-preview --region=asia-northeast1 --limit=3
```

## 📚 详细文档

- **完整排查指南**: GOOGLE_LOGIN_TROUBLESHOOTING.md
- **诊断指南**: diagnose-google-login.md
- **浏览器测试脚本**: browser-test-script.js

## 🎯 决策树

```
测试Cloud Run直接URL
    ↓
成功? → 测试Cloudflare CDN
    ↓
    成功? → ✅ 完成！
    失败? → 配置Cloudflare

失败? → 查看错误类型
    ↓
    auth/unauthorized-domain? → 添加域名
    getRedirectResult null? → 检查存储
    无限转圈? → 清除缓存
    其他? → 查看详细文档
```

## 💡 关键提示

1. **总是使用隐身窗口测试**
2. **总是打开Console查看日志**
3. **先测试Cloud Run，再测试Cloudflare**
4. **记录所有错误信息**
5. **清除缓存后再测试**

## 📞 需要帮助？

提供以下信息：
- 测试的URL
- Console完整日志
- 错误信息截图
- 浏览器和版本
- 测试时间

---

**现在开始**: 运行 `./auto-diagnose.sh` 然后测试！
