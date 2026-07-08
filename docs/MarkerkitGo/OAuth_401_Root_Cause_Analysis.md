# OAuth 登录 401 错误根本原因分析与修复

## 问题概述

用户通过 Google OAuth 登录成功后，在创建 server-side session 时始终返回 `401 Unauthorized` 错误，导致无法完成登录流程。

## 根本原因

### withAdmin 中间件实现错误

**文件**: `apps/frontend/src/core/middleware/with-admin.ts`

**错误的原始实现**:
```typescript
export function withAdmin() {
  return initializeFirebaseAdminApp();  // ❌ 返回 Promise<FirebaseApp>
}
```

**问题分析**:

1. **类型不匹配**: `withAdmin()` 应该返回符合 `Middleware` 类型的函数
   ```typescript
   type Middleware = (req: NextApiRequest, res: NextApiResponse) => unknown;
   ```

2. **执行流程错误**: 在 `withPipe` 中间件管道中执行时:
   ```typescript
   // with-pipe.ts:42
   await middleware(req, res);

   // 实际执行变成:
   await FirebaseApp(req, res);  // ❌ FirebaseApp is not a function
   ```

3. **异常处理**: 错误被 `withExceptionFilter` 捕获
   ```typescript
   // with-exception-filter.ts:35-85
   catch (exception) {
     const statusCode = getExceptionStatus(exception);  // 返回 401
     return res.status(statusCode).send(responseBody);
   }
   ```

4. **Handler 从未执行**: `signIn` 函数永远不会被调用，所有日志都看不到

## 修复方案

### 1. 修复 withAdmin 中间件

**文件**: `apps/frontend/src/core/middleware/with-admin.ts`

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { initializeFirebaseAdminApp } from '../firebase/admin/initialize-firebase-admin-app';

export function withAdmin() {
  return async function adminMiddleware(
    req: NextApiRequest,
    res: NextApiResponse
  ) {
    await initializeFirebaseAdminApp();
  };
}
```

**关键改动**:
- 返回一个符合 `Middleware` 类型的 async 函数
- 函数接收 `(req, res)` 参数
- 在函数内部执行 Firebase Admin 初始化

### 2. 更新所有 API 路由调用方式

修改所有使用 `withAdmin` 的地方，从 `withAdmin` 改为 `withAdmin()`：

**sign-in.ts**:
```typescript
const handler = withPipe(
  withCsrf(),
  withMethodsGuard(SUPPORTED_HTTP_METHODS),
  withAdmin(),  // ✅ 添加括号
  signIn
);
```

**sign-out.ts**:
```typescript
const handler = withPipe(
  withMethodsGuard(SUPPORTED_HTTP_METHODS),
  withAdmin(),  // ✅ 添加括号
  signOut,
);
```

**stripe/webhook.ts**:
```typescript
const handler = withPipe(
  withMethodsGuard(SUPPORTED_HTTP_METHODS),
  withAdmin(),  // ✅ 添加括号
  checkoutWebhooksHandler,
);
```

## 技术细节

### 中间件管道执行机制

**withPipe 实现** (`with-pipe.ts:30-45`):

```typescript
export function withPipe(...middlewares: Middleware[]) {
  return async function withPipeHandler(
    req: NextApiRequest,
    res: NextApiResponse
  ) {
    for (const middleware of middlewares) {
      // 如果已发送响应头，提前退出
      if (res.headersSent) {
        return;
      }

      // 依次执行每个中间件
      await middleware(req, res);
    }
  };
}
```

**关键点**:
1. 中间件按顺序同步执行
2. 如果某个中间件抛出异常，整个管道停止
3. 后续中间件（如 `signIn`）不会被执行
4. 异常被外层的 `withExceptionFilter` 捕获

### 其他中间件的正确实现

**withCsrf** (正确示例):
```typescript
export default function withCsrf(tokenProvider = defaultTokenProvider) {
  return async (req: NextApiRequest) => {  // ✅ 返回中间件函数
    const csrf = new Csrf();
    const secret = req.cookies.csrfSecret;
    const token = await tokenProvider(req);

    if (!csrf.verify(secret, token)) {
      return throwUnauthorizedException(`CSRF check failed`);
    }
  };
}
```

**withMethodsGuard** (正确示例):
```typescript
export function withMethodsGuard(methods: HttpMethod[]) {
  return function methodsGuard(req: NextApiRequest, res: NextApiResponse) {  // ✅ 返回中间件函数
    const method = req.method as HttpMethod;

    if (!methods.includes(method)) {
      throwMethodNotAllowedException(res, methods, method);
    }
  };
}
```

## 调试历程

### 误导性线索

1. **CSRF Token 初始化时机**: 日志显示 `[CSRF] No CSRF token available in context`
   - **结论**: 这是正常现象，组件初始化时 context 尚未就绪
   - **与 401 无关**: 实际 API 调用时 token 是可用的

2. **CSRF 验证失败**: 怀疑 CSRF 中间件返回 401
   - **验证**: 服务器日志显示 `[CSRF Server] ✅ Validation passed`
   - **结论**: CSRF 验证是通过的

3. **signIn 函数日志缺失**: 添加了大量日志但从未出现
   - **关键发现**: Handler 函数根本没有被调用
   - **指向**: 中间件管道在更早的阶段就失败了

### 最终定位

通过系统性分析：
1. 检查 `withPipe` 执行逻辑 → 发现会在异常时停止
2. 检查 `withAdmin` 实现 → 发现返回类型错误
3. 检查 `withMethodsGuard` 等其他中间件 → 确认正确的实现模式
4. **结论**: `withAdmin()` 返回 Promise 而非函数，导致 `middleware(req, res)` 报错

## 影响范围

### 受影响的 API 端点

所有使用 `withAdmin` 的 API 路由都会受到影响：

1. `/api/session/sign-in` - OAuth 登录会话创建
2. `/api/session/sign-out` - 登出
3. `/api/stripe/webhook` - Stripe 支付 webhook

### 症状表现

- 所有请求返回 401 Unauthorized
- 实际 handler 函数从未执行
- 服务器日志中只有中间件日志，没有业务逻辑日志
- 错误信息通用，无法定位具体原因

## 测试验证

### 预期结果

修复后，以下流程应该正常工作：

1. **OAuth 登录**:
   ```
   用户点击 "Continue with Google"
   → Google OAuth 授权窗口
   → 授权成功，返回 idToken
   → POST /api/session/sign-in (带 idToken)
   → 服务器创建 session cookie
   → 返回 { success: true }
   → 重定向到 dashboard 或 onboarding
   ```

2. **服务器日志**:
   ```
   [CSRF Server] Validating CSRF token
   [CSRF Server] ✅ Validation passed
   Using Application Default Credentials for Firebase Admin
   [signIn] Function called
   [signIn] Body validation: passed
   [signIn] IdToken received: eyJhbGciOiJSUzI1N...
   [Session] Creating session cookie with idToken: eyJhbGciOiJSUzI1N...
   [Session] Session cookie created successfully
   ```

3. **客户端日志**:
   ```
   [OAuth] Starting sign-in with provider: google.com
   [OAuth] Sign-in result: Success
   POST /api/session/sign-in 200 OK
   (重定向到目标页面)
   ```

### 测试步骤

1. 清除浏览器缓存和 Cookie
2. 访问 https://www.urlchecker.dev/auth/sign-in
3. 打开开发者工具（Console + Network）
4. 点击 "Continue with Google"
5. 完成 Google 授权
6. 验证:
   - Network 标签显示 `/api/session/sign-in` 返回 200
   - Console 没有错误信息
   - 自动重定向到 dashboard 或 onboarding
7. 检查服务器日志确认完整流程

## 相关提交

- **Commit**: `cce61688` - fix(api): 修复 withAdmin 中间件类型错误，解决 401 Unauthorized 问题
- **修改文件**:
  - `apps/frontend/src/core/middleware/with-admin.ts`
  - `apps/frontend/src/core/hooks/use-api.ts`
  - `apps/frontend/src/pages/api/session/sign-in.ts`
  - `apps/frontend/src/pages/api/session/sign-out.ts`
  - `apps/frontend/src/pages/api/stripe/webhook.ts`

## 经验教训

1. **TypeScript 类型检查的局限性**:
   - `withAdmin` 返回类型是 `Promise<FirebaseApp>`
   - 但在 `withPipe` 中被当作 `Middleware` 使用
   - TypeScript 没有在编译时捕获这个错误

2. **中间件实现模式的重要性**:
   - 所有中间件都应该返回 `(req, res) => unknown` 函数
   - 不能直接返回 Promise 或其他类型

3. **调试方法**:
   - 添加日志要覆盖完整流程，尤其是中间件层
   - 对比其他正常工作的中间件实现
   - 系统性分析执行流程，而非只看表面错误

4. **误导性线索的识别**:
   - CSRF token 初始化日志是噪音，不是根本原因
   - 需要区分"症状"和"病因"

## 后续建议

1. **添加类型测试**: 确保所有中间件函数签名正确
2. **统一中间件模式**: 文档化标准的中间件实现模式
3. **改进错误日志**: 在 `withPipe` 中捕获并记录中间件执行异常
4. **ESLint 规则**: 检查中间件返回类型
