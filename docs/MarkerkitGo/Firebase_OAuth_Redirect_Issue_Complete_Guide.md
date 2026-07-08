# Firebase Google OAuth 登录一直转圈问题 - 完整诊断和解决方案

## 问题确认

✅ Firebase Console Web 客户端 ID 配置正确：`644672509127-sj0oe3shl7nltvn1agiuf1rv2vqgfsuj.apps.googleusercontent.com`
✅ OAuth 重定向 URI 包含：`https://www.urlchecker.dev/__/auth/handler`
✅ Firebase authDomain 配置为：`www.urlchecker.dev`
✅ 使用 Redirect 策略（不是 Popup）

## 问题根源

经过代码分析，发现 **CSRF Token 依赖**问题：

```typescript
// apps/frontend/src/components/auth/OAuthRedirectHandler.tsx:49-53
// Wait for CSRF token to be available before proceeding
// This ensures the session creation API call will have the required token
if (!csrfToken) {
  return;  // ⚠️ 如果 CSRF token 未生成，会一直等待
}
```

### OAuth Redirect 流程

1. 用户点击 "Sign in with Google"
2. 跳转到 Google OAuth 授权页面
3. Google 授权后重定向到：`https://www.urlchecker.dev/en/auth/sign-in?code=xxx&state=xxx`
4. **页面重新加载**，触发 `getServerSideProps` → `withAuthProps` → 生成 CSRF token
5. `OAuthRedirectHandler` 等待 CSRF token 可用
6. 调用 `getRedirectResult` 获取 OAuth 凭据
7. 创建服务端 Session
8. 跳转到首页

**如果第 4 步失败或延迟，会导致第 5 步一直等待**，页面显示 "Signing in..." 转圈。

## 可能的原因

### 原因 1: getServerSideProps 执行失败

检查 `/en/auth/sign-in` 路由的 SSR 日志：

```bash
gcloud logging read "resource.type=cloud_run_revision \
  AND resource.labels.service_name=frontend-preview \
  AND (textPayload=~'sign-in' OR textPayload=~'withAuthProps' OR textPayload=~'csrf')" \
  --limit=50 \
  --project=gen-lang-client-0944935873 \
  --format=json
```

### 原因 2: Cookie 策略问题

CSRF token 通过 Cookie 传递，可能被浏览器阻止：
- SameSite 策略
- 第三方 Cookie 限制
- HTTPS/HTTP 混合

### 原因 3: OAuth 回调路由问题

Firebase Auth 使用 `/__/auth/handler` 处理回调，可能：
- Cloud Run 路由配置问题
- Firebase Hosting rewrite 配置问题

## 诊断步骤

### 步骤 1: 浏览器控制台检查

请提供以下信息：

1. **打开开发者工具（F12）**
2. **切换到 Console 标签页**
3. **清除浏览器缓存和 Cookie**
4. **访问** `https://www.urlchecker.dev/en/auth/sign-in`
5. **点击** "Sign in with Google"
6. **完成 Google 授权**
7. **回到登录页面后，查看 Console 中的日志**

重点关注：
- 是否有红色错误信息？
- 是否有 `csrfToken` 相关的日志？
- 是否有 `getRedirectResult` 相关的日志？

### 步骤 2: Network 请求检查

在 **Network 标签页** 中：

1. **筛选**：`sign-in`
2. **查看** 回调后的页面请求
   - 状态码是否为 200？
   - Response Headers 中是否包含 `Set-Cookie`？
   - Response 中是否包含 `csrfToken`？

3. **筛选**：`__/auth`
4. **查看** `/__/auth/handler` 请求
   - 状态码是否为 200 或 302？
   - 是否有错误响应？

### 步骤 3: 临时添加调试日志

编辑 `OAuthRedirectHandler.tsx` 添加调试日志：

```typescript
useLayoutEffect(() => {
  async function checkRedirectSignIn() {
    console.log('[OAuth Debug] Starting redirect check');
    console.log('[OAuth Debug] CSRF Token:', csrfToken ? 'Available' : 'Missing');

    if (didCheckRedirect) {
      console.log('[OAuth Debug] Already checked, skipping');
      return;
    }

    if (!csrfToken) {
      console.log('[OAuth Debug] Waiting for CSRF token...');
      return;
    }

    didCheckRedirect = true;
    console.log('[OAuth Debug] Calling getRedirectResult...');

    try {
      const credential = await getRedirectResult(auth, browserPopupRedirectResolver);
      console.log('[OAuth Debug] Credential:', credential ? 'Success' : 'No credential');

      if (credential) {
        console.log('[OAuth Debug] Creating session...');
        await onSignIn(credential.user);
      }
    } catch (e) {
      console.error('[OAuth Debug] Error:', e);
      onError(e as FirebaseError);
    }
  }

  void checkRedirectSignIn();
}, [auth, onSignIn, checkingRedirect, onError, csrfToken]);
```

## 解决方案

### 方案 1: 修复 CSRF Token 超时问题（推荐）

如果 CSRF token 生成延迟，添加超时机制：

```typescript
// apps/frontend/src/components/auth/OAuthRedirectHandler.tsx

useLayoutEffect(() => {
  let timeoutId: NodeJS.Timeout;

  async function checkRedirectSignIn() {
    if (didCheckRedirect) {
      return;
    }

    if (!csrfToken) {
      // 设置 5 秒超时，如果 CSRF token 仍未生成，跳过等待
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          console.warn('[OAuth] CSRF token timeout, proceeding anyway');
          didCheckRedirect = true;
          // 尝试无 CSRF token 的回调处理（可能失败但至少有错误提示）
          void proceedWithoutCsrf();
        }, 5000);
      }
      return;
    }

    // 清除超时
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    didCheckRedirect = true;

    try {
      const credential = await getRedirectResult(auth, browserPopupRedirectResolver);
      didSignIn = !!credential;

      if (credential) {
        await onSignIn(credential.user);
      } else {
        setCheckingRedirecting(false);
      }
    } catch (e) {
      onError(e as FirebaseError);
      setCheckingRedirecting(false);
    }
  }

  async function proceedWithoutCsrf() {
    try {
      const credential = await getRedirectResult(auth, browserPopupRedirectResolver);
      if (credential) {
        // 显示错误提示：CSRF token 缺失
        onError(new Error('CSRF token unavailable') as any);
      }
      setCheckingRedirecting(false);
    } catch (e) {
      onError(e as FirebaseError);
      setCheckingRedirecting(false);
    }
  }

  void checkRedirectSignIn();

  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
}, [auth, onSignIn, checkingRedirect, onError, csrfToken]);
```

### 方案 2: 切换到 Popup 策略（临时方案）

修改配置文件：

```typescript
// apps/frontend/src/configuration.ts

auth: {
  // ...
  // Use Popup strategy instead of Redirect (temporary fix)
  useRedirectStrategy: false,  // 改为 false
},
```

**优点**：
- Popup 策略不需要页面重新加载
- CSRF token 保持可用
- 登录流程更快

**缺点**：
- 某些浏览器可能阻止弹窗
- 用户体验略差

### 方案 3: 检查 Firebase Hosting 配置

确认 `firebase.json` 正确配置了 rewrite：

```json
{
  "hosting": [
    {
      "site": "autoads-preview",
      "rewrites": [
        {
          "source": "**",
          "run": {
            "serviceId": "frontend-preview",
            "region": "asia-northeast1"
          }
        }
      ],
      "headers": [
        {
          "source": "**",
          "headers": [
            {
              "key": "X-Frame-Options",
              "value": "SAMEORIGIN"
            },
            {
              "key": "X-Content-Type-Options",
              "value": "nosniff"
            }
          ]
        }
      ]
    }
  ]
}
```

### 方案 4: 验证 withAuthProps 正确传递 CSRF token

检查 `withAuthProps` 实现：

```bash
# 查看 withAuthProps 源码
cat apps/frontend/src/lib/props/with-auth-props.ts
```

确保返回的 props 包含 `csrfToken`。

## 立即操作建议

### 最快修复（5分钟）

1. **临时切换到 Popup 策略**：
   ```bash
   # 编辑配置文件
   vim apps/frontend/src/configuration.ts
   # 将 useRedirectStrategy 改为 false
   ```

2. **重新部署前端**：
   ```bash
   git add apps/frontend/src/configuration.ts
   git commit -m "fix: switch to popup OAuth strategy temporarily"
   git push origin main
   ```

3. **等待部署完成后测试**

### 深入调试（需要浏览器信息）

请提供以下信息：

1. **Console 标签页截图**（完成 OAuth 后）
2. **Network 标签页截图**（筛选 `sign-in` 和 `__/auth`）
3. **登录页面的 HTML 源代码**（查看是否包含 CSRF token）
   ```javascript
   // 在 Console 中运行
   console.log('Page Props:', window.__NEXT_DATA__.props);
   ```

## 后续优化

一旦问题解决，建议：

1. **添加更好的错误处理和超时机制**
2. **添加 Loading 状态的详细提示**
3. **监控 OAuth 回调成功率**
4. **添加 Sentry 或类似的错误追踪**

## 相关文档

- Firebase Auth Redirect vs Popup: https://firebase.google.com/docs/auth/web/redirect-best-practices
- Next.js getServerSideProps: https://nextjs.org/docs/basic-features/data-fetching/get-server-side-props
- CSRF Protection: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
