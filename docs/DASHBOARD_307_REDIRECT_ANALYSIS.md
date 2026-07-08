# Dashboard 307 重定向分析

## 问题描述

访问 `https://preview.example.com/dashboard` 时返回 307 Temporary Redirect，重定向到 `/auth?redirect=%2Fdashboard`。

## 根本原因

**这是预期的正常行为，不是bug。**

### 认证流程说明

1. **受保护的路由**
   - `/dashboard` 是受保护的路由，需要用户登录才能访问
   - 在 `middleware.ts` 中定义：
   ```typescript
   const PROTECTED_ROUTES = [
     '/dashboard',
     '/settings',
     '/manage',
   ];
   ```

2. **中间件认证检查**
   - 当用户访问 `/dashboard` 时，middleware 会检查 Supabase session
   - 如果没有有效的 session（未登录），会重定向到 `/auth`
   - 重定向URL包含 `redirect` 参数，用于登录后返回原页面

3. **HTTP 307 状态码**
   - 307 Temporary Redirect 是正确的状态码
   - 表示临时重定向，保持原始请求方法（GET）
   - 与 302 不同，307 不会改变请求方法

## 实际测试结果

```bash
$ curl -I https://preview.example.com/dashboard

HTTP/2 307 
location: /auth?redirect=%2Fdashboard
x-middleware-set-cookie: lang=en; Path=/; Expires=Sun, 18 Oct 2026 01:54:02 GMT; Max-Age=31536000
```

**响应头分析**：
- `HTTP/2 307` - 临时重定向
- `location: /auth?redirect=%2Fdashboard` - 重定向到登录页，并保存原始目标
- `x-middleware-set-cookie: lang=en` - 设置语言Cookie

## 正确的访问流程

### 未登录用户访问 Dashboard

1. 用户访问 `https://preview.example.com/dashboard`
2. Middleware 检测到没有有效 session
3. 返回 307 重定向到 `/auth?redirect=%2Fdashboard`
4. 用户在 `/auth` 页面登录
5. 登录成功后，自动重定向回 `/dashboard`

### 已登录用户访问 Dashboard

1. 用户访问 `https://preview.example.com/dashboard`
2. Middleware 检测到有效的 Supabase session
3. 返回 200 OK，显示 Dashboard 页面

## Middleware 认证逻辑

```typescript
// apps/frontend/src/middleware.ts

async function checkAuthentication(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 检查是否是受保护的路由
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // 如果不是受保护的路由，允许访问
  if (!isProtectedRoute || isPublicRoute) {
    return null;
  }

  // 创建 Supabase 客户端并检查 session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        // ...
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 如果没有 session，重定向到登录页
  if (!session) {
    const redirectURL = new URL('/auth', request.url);
    redirectURL.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectURL);
  }

  return response;
}
```

## Supabase Session 管理

### Session Cookie 名称

Supabase 使用以下 cookie 存储 session：
- Cookie 名称格式：`sb-{project-ref}-auth-token`
- 本项目：`sb-jzzvizacfyipzdyiqfzb-auth-token`
- Cookie 内容：Base64 编码的 JSON，包含 access_token 和 refresh_token

### Session 验证

```typescript
// Middleware 通过 Supabase SSR 客户端验证 session
const { data: { session } } = await supabase.auth.getSession();

// session 对象包含：
// - access_token: JWT token
// - refresh_token: 用于刷新 access_token
// - user: 用户信息
// - expires_at: 过期时间
```

## 如何测试已登录状态

### 方法1：通过浏览器登录

1. 访问 `https://preview.example.com/auth`
2. 点击 "Sign in with Google" 完成登录
3. 登录成功后，浏览器会存储 Supabase session cookie
4. 再次访问 `/dashboard`，应该返回 200 OK

### 方法2：使用有效的 Session Cookie

```bash
# 需要先获取有效的 session token
curl -I https://preview.example.com/dashboard \
  -H "Cookie: sb-jzzvizacfyipzdyiqfzb-auth-token=<valid-token>"
```

### 方法3：使用测试脚本

```bash
# 使用项目中的测试脚本
node scripts/tests/test-login.mjs
```

## 公共路由 vs 受保护路由

### 公共路由（无需登录）

```typescript
const PUBLIC_ROUTES = [
  '/',
  '/features',
  '/pricing',
  '/case-studies',
  '/support',
  '/about',
  '/contact',
  '/careers',
  '/roadmap',
  '/changelog',
  '/privacy',
  '/terms',
  '/security',
  '/auth',
];
```

这些路由可以直接访问，返回 200 OK。

### 受保护路由（需要登录）

```typescript
const PROTECTED_ROUTES = [
  '/dashboard',
  '/settings',
  '/manage',
];
```

这些路由需要有效的 Supabase session，否则返回 307 重定向。

## 忽略的路径

```typescript
const IGNORED_PATHS = ['/api', '/_next', '/static', '/assets'];
```

这些路径完全绕过 middleware，不进行任何检查。

## 总结

**307 重定向是正常的认证保护机制**：

✅ **正常行为**：
- 未登录用户访问 `/dashboard` → 307 重定向到 `/auth`
- 已登录用户访问 `/dashboard` → 200 OK，显示页面
- 公共路由（如 `/`, `/pricing`）→ 200 OK，无需登录

❌ **不是问题**：
- 这不是配置错误
- 这不是路由错误
- 这不是 Cloudflare 缓存问题

🔧 **如果需要测试已登录状态**：
1. 在浏览器中完成 Google OAuth 登录
2. 或使用测试脚本获取有效的 session token
3. 或在开发环境中使用 `scripts/tests/test-login.mjs`

## 相关文件

- `apps/frontend/src/middleware.ts` - 认证中间件
- `apps/frontend/src/app/dashboard/page.tsx` - Dashboard 页面
- `apps/frontend/src/app/auth/page.tsx` - 登录页面
- `apps/frontend/src/configuration.ts` - 路由配置

## 环境变量

```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://jzzvizacfyipzdyiqfzb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

## 调试建议

如果需要调试认证流程：

1. **检查 Cookie**：
   ```bash
   # 在浏览器 DevTools → Application → Cookies
   # 查找 sb-jzzvizacfyipzdyiqfzb-auth-token
   ```

2. **检查 Session**：
   ```javascript
   // 在浏览器 Console
   const { data } = await supabase.auth.getSession();
   console.log(data.session);
   ```

3. **查看 Middleware 日志**：
   ```bash
   # 在开发环境中，middleware 会输出日志
   npm run dev
   # 访问 /dashboard，查看终端输出
   ```

4. **测试 OAuth 流程**：
   ```bash
   # 访问登录页
   open https://preview.example.com/auth
   # 完成 Google 登录
   # 检查是否重定向回 /dashboard
   ```
