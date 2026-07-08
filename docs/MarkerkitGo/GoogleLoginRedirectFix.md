# Google登录Redirect问题修复

**日期**: 2025-10-05  
**问题**: OAuth redirect成功但无法创建session  
**状态**: 已修复，待测试

---

## 🔍 **问题诊断**

### 症状

用户点击Google登录后：
1. ✅ 成功跳转到Google授权页面
2. ✅ 完成Google授权
3. ✅ 成功redirect回到原网站
4. ❌ **但是回到登录页面，没有创建session**

### 控制台日志

```
Navigated to https://gen-lang-client-0944935873.firebaseapp.com/__/auth/handler?...
Navigated to https://www.urlchecker.dev/auth/sign-in
[OAuth Redirect] No credential found, normal page load
```

### 根本原因

1. **`getRedirectResult()`返回null**
   - Firebase Auth的redirect结果没有被正确获取
   
2. **`auth.currentUser`也是null**
   - IndexedDB持久化可能还没有完全同步
   - 或者Firebase Auth状态还没有ready

3. **使用了`browserPopupRedirectResolver`**
   - 在redirect模式下不应该使用这个resolver
   - 可能导致状态不一致

---

## 🛠️ **修复方案**

### 修复1: 增强OAuthRedirectHandler的等待逻辑

**文件**: `apps/frontend/src/components/auth/OAuthRedirectHandler.tsx`

**修改内容**:
```typescript
// 1. 先尝试getRedirectResult()
const credential = await getRedirectResult(auth);

if (!credential) {
  // 2. 等待500ms让IndexedDB同步
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    // 3. 使用authStateReady()等待Auth状态完全ready
    await auth.authStateReady();
    
    const userAfterReady = auth.currentUser;
    if (userAfterReady) {
      // 找到用户，创建session
      await onSignIn(userAfterReady);
    }
  }
}
```

**原理**:
- Firebase Auth使用IndexedDB存储状态
- Redirect回来后，IndexedDB可能需要一点时间同步
- `authStateReady()`确保Auth状态完全初始化

### 修复2: 移除browserPopupRedirectResolver

**文件**: `apps/frontend/src/core/firebase/hooks/use-sign-in-with-provider.ts`

**修改前**:
```typescript
if (useRedirectStrategy) {
  const { browserPopupRedirectResolver, signInWithRedirect } = await import('firebase/auth');
  return signInWithRedirect(auth, provider, browserPopupRedirectResolver); // ❌ 不应该传resolver
}
```

**修改后**:
```typescript
if (useRedirectStrategy) {
  const { signInWithRedirect } = await import('firebase/auth');
  return signInWithRedirect(auth, provider); // ✅ 不传resolver
}
```

**原因**:
- `browserPopupRedirectResolver`是为popup模式设计的
- 在redirect模式下使用可能导致状态不一致
- Firebase会自动使用正确的resolver

### 修复3: 增强日志记录

添加了详细的日志来追踪整个流程：
```typescript
console.log('[OAuth Redirect] Checking for redirect result...');
console.log('[OAuth Redirect] Credential received, creating session', { uid, email });
console.log('[OAuth Redirect] Current user found after wait, creating session');
console.log('[OAuth Redirect] User found after authStateReady, creating session');
```

---

## 🧪 **测试步骤**

### 1. 重新部署前端

```bash
# 确保修改已经部署到预发环境
# 前端应该会自动重新构建和部署
```

### 2. 清除浏览器缓存

```bash
# 在Chrome中:
# 1. 打开开发者工具 (F12)
# 2. 右键点击刷新按钮
# 3. 选择"清空缓存并硬性重新加载"
```

### 3. 测试登录流程

1. 访问 https://www.urlchecker.dev/auth/sign-in
2. 打开开发者工具 > Console
3. 点击"Sign in with Google"
4. 完成Google授权
5. 观察控制台日志

**期望的日志**:
```
[Sign In] Signing in with redirect
[OAuth Redirect] Checking for redirect result...
[OAuth Redirect] Credential received, creating session { uid: '...', email: '...' }
或
[OAuth Redirect] Current user found after wait, creating session { uid: '...', email: '...' }
或
[OAuth Redirect] User found after authStateReady, creating session { uid: '...', email: '...' }
```

**期望的行为**:
- ✅ 成功跳转到dashboard或onboarding页面
- ✅ 可以看到用户信息
- ✅ Session cookie已设置

### 4. 验证Session

在开发者工具 > Application > Cookies 中检查：
- ✅ `__session` cookie存在
- ✅ Domain是 `www.urlchecker.dev`
- ✅ Secure和HttpOnly标志正确设置

---

## 📋 **可能的其他问题**

如果修复后仍然有问题，检查：

### 1. CSRF Token问题

**症状**: Session API返回403错误

**解决**: 确保CSRF token正确传递
```typescript
// 检查OAuthRedirectHandler是否正确使用csrfToken
const csrfToken = useCsrfToken();
```

### 2. Session API错误

**症状**: Session API返回500错误

**检查**:
- Firebase Admin SDK配置是否正确
- 服务账号权限是否足够
- Cloud Run环境变量是否正确

**调试**:
```bash
# 查看Cloud Run日志
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=frontend-preview" --limit 50 --format json
```

### 3. Cookie Domain问题

**症状**: Cookie设置了但浏览器不发送

**检查**:
- Cookie的Domain设置
- SameSite属性
- Secure标志（生产环境必须是true）

---

## 🚀 **部署清单**

- [x] 修改OAuthRedirectHandler.tsx
- [x] 修改use-sign-in-with-provider.ts
- [x] 增强错误日志
- [ ] 重新部署前端到预发环境
- [ ] 清除浏览器缓存
- [ ] 测试Google登录流程
- [ ] 验证session创建
- [ ] 验证页面跳转
- [ ] 测试dashboard访问

---

## 📞 **如果仍有问题**

请提供以下信息：

1. **完整的控制台日志**（从点击登录到最终页面）
2. **Network面板截图**（特别是`/api/session/sign-in`请求）
3. **Application > Cookies截图**
4. **当前URL和期望URL**

---

**预期结果**: 修复后，Google登录应该能够正常工作，用户授权后自动创建session并跳转到dashboard。