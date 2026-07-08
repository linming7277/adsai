# OAuth 登录调试经验教训总结

**问题时长**: 6+ 小时
**提交次数**: 10+ commits
**最终根因**: `nookies` 库在 Next.js API routes 中无法正确设置 Cookie
**日期**: 2025-10-02

---

## 问题表象 vs 实际根因

| 表象 | 我们的错误判断 | 实际根因 |
|------|--------------|---------|
| 页面停留在登录页，显示"登录中..." | 前端路由/重定向问题 | **Session cookie 根本没有被设置** |
| `POST /api/session/sign-in` 返回 200 | API 成功，cookie 已设置 | **API 成功 ≠ Cookie 被设置** |
| CSRF 401 错误 | CSRF token sameSite 配置问题 | **`nookies` 在 API routes 中不工作** |
| `router.replace()` 后没跳转 | Next.js 路由问题 | **访问 /dashboard 时 session 不存在，被重定向回登录页** |

---

## 核心错误：调试顺序错误

### ❌ 错误的调试流程（我们实际做的）

```
1. 看到页面停留在登录页
2. 假设是前端重定向问题
3. 修复 router.replace() 的 await
4. 修复 onSignIn 回调
5. 改用服务器端重定向
6. 添加延迟等待 cookie 设置
7. ... 6 小时后才发现 cookie 根本没设置
```

### ✅ 正确的调试流程（应该这样做）

```
1. 看到页面停留在登录页
2. 打开 DevTools → Application → Cookies
3. 检查是否有 session cookie ❌
4. 打开 Network → session/sign-in → Response Headers
5. 检查是否有 Set-Cookie header ❌
6. 立即定位到服务器端 cookie 设置代码
7. 5 分钟内发现 nookies 问题并修复 ✅
```

---

## 调试原则

### 1. **自底向上，先验证基础设施**

永远按照这个顺序调试：

```
基础层（最先检查）
  ↓
├─ Cookie 是否被设置？          ← 先检查这个
├─ Token 是否有效？
├─ 网络请求是否成功？
  ↓
业务逻辑层（最后检查）
  ↓
├─ 路由跳转是否正确？
├─ 状态管理是否正确？
└─ UI 是否正确渲染？
```

**教训**: 我们直接跳到业务逻辑层调试路由问题，浪费了 6 小时。

### 2. **不要相信表象，用工具验证**

| 表象 | 不要假设 | 必须验证 |
|------|---------|---------|
| API 返回 200 | ❌ Cookie 已设置 | ✅ 检查 Response Headers |
| 日志显示 "Success" | ❌ 操作成功 | ✅ 检查实际结果（浏览器状态）|
| 代码调用了 setCookie() | ❌ Cookie 已生效 | ✅ 检查 Application → Cookies |

**教训**: 我们看到 API 200 和日志 "Session created successfully" 就以为成功了。

### 3. **遇到认证/授权错误，第一反应检查凭证**

当看到以下错误时：

```
❌ 401 Unauthorized
❌ 403 Forbidden
❌ Session invalid
❌ User not authenticated
```

**立即执行的检查清单**:

```bash
□ DevTools → Application → Cookies 中是否有 session/token cookie？
□ Cookie 的属性是否正确（domain/path/secure/sameSite）？
□ Cookie 是否过期（Expires/Max-Age）？
□ Network → Request Headers 中是否携带了 Cookie？
□ Response Headers 中是否有 Set-Cookie？
```

**教训**: 遇到 401 时，我们先去查中间件、权限、代码逻辑，而不是先看 Cookie。

### 4. **系统性检查，不要跳步骤**

**完整的 OAuth + Session 验证流程**:

```typescript
// 1. OAuth 登录
□ OAuth popup 是否打开？
□ 用户是否完成授权？
□ credential 是否返回？

// 2. Session 创建（服务器端）
□ POST /api/session/sign-in 是否 200？
□ Response Headers 中是否有 Set-Cookie？
  - Set-Cookie: session=xxx; HttpOnly; Secure; SameSite=Lax
  - Set-Cookie: sessionExpiresAt=xxx; SameSite=Lax
□ Cookie 值是否正确（不是空字符串）？

// 3. Cookie 存储（浏览器端）
□ DevTools → Application → Cookies 中是否看到 session cookie？
□ Cookie 的 Domain 是否匹配当前域名？
□ Cookie 的 Path 是否是 / ？
□ 如果是 HTTPS，Cookie 是否有 Secure 标志？

// 4. 后续请求
□ 访问 /dashboard 时，Request Headers 是否携带 Cookie？
□ 服务器端是否能读取到 session？
□ 用户是否被正确识别？
```

**教训**: 我们跳过了步骤 2、3，直接去调试步骤 4 的路由问题。

---

## 技术陷阱

### 陷阱 1: nookies 在 Next.js API Routes 中不工作

```typescript
// ❌ 错误：nookies 主要为 getServerSideProps 设计
import { setCookie } from 'nookies';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCookie({ res }, 'session', sessionCookie, options);  // 不会真正设置 header！
}
```

```typescript
// ✅ 正确：使用原生 cookie 库
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const serialized = serialize('session', sessionCookie, options);
  res.setHeader('Set-Cookie', serialized);  // 真正设置 header
}
```

**原因**: nookies 的 `setCookie({ res }, ...)` 在 API routes 中不会调用 `res.setHeader()`。

### 陷阱 2: maxAge 单位不一致

```typescript
// ❌ 错误：maxAge 单位混乱
const expiresIn = 14 * 24 * 60 * 60 * 1000;  // 毫秒

setCookie(ctx, 'session', value, {
  maxAge: expiresIn,  // nookies 期望秒，但传了毫秒！
});
```

```typescript
// ✅ 正确：统一使用秒
const expiresIn = 14 * 24 * 60 * 60 * 1000;  // 内部使用毫秒

const serialized = serialize('session', value, {
  maxAge: expiresIn / 1000,  // cookie 库期望秒
});
```

### 陷阱 3: Set-Cookie header 被覆盖

```typescript
// ❌ 错误：多次调用会覆盖
res.setHeader('Set-Cookie', cookie1);
res.setHeader('Set-Cookie', cookie2);  // cookie1 丢失！
```

```typescript
// ✅ 正确：追加而非覆盖
const existing = res.getHeader('Set-Cookie') || [];
const headers = Array.isArray(existing) ? existing : [existing];
res.setHeader('Set-Cookie', [...headers, newCookie]);
```

### 陷阱 4: SameSite=Strict 阻止 OAuth 回调

```typescript
// ❌ 错误：OAuth 重定向时 cookie 不会被发送
setCookie(ctx, 'csrfSecret', secret, {
  sameSite: 'strict',  // 跨站导航不发送 cookie
});
```

```typescript
// ✅ 正确：OAuth 需要 Lax
setCookie(ctx, 'csrfSecret', secret, {
  sameSite: 'lax',  // 顶级导航（如 OAuth redirect）会发送
});
```

---

## 调试工具使用

### Chrome DevTools 必查面板

#### 1. Application → Cookies

**用途**: 验证 Cookie 是否真的被保存

```
检查项：
□ Cookie 名称是否正确（session, csrfSecret）
□ Value 是否有值（不是空字符串）
□ Domain 是否匹配（.urlchecker.dev 或 www.urlchecker.dev）
□ Path 是否是 /
□ Expires/Max-Age 是否合理
□ HttpOnly 标志（session 应该是 true）
□ Secure 标志（生产环境应该是 true）
□ SameSite 属性（应该是 Lax）
```

**教训**: 我们直到最后才检查这个面板，发现 Cookie 列表是空的。

#### 2. Network → Response Headers

**用途**: 验证服务器是否发送了 Set-Cookie

```http
# 正确的响应应该包含：
HTTP/1.1 200 OK
Set-Cookie: session=eyJhbGc...; Path=/; HttpOnly; Secure; SameSite=Lax
Set-Cookie: sessionExpiresAt=1728123456000; Path=/; SameSite=Lax
Content-Type: application/json
```

**如果没有 Set-Cookie header → 服务器端代码问题**

#### 3. Network → Request Headers

**用途**: 验证后续请求是否携带 Cookie

```http
# 访问 /dashboard 时应该包含：
GET /dashboard HTTP/1.1
Host: www.urlchecker.dev
Cookie: session=eyJhbGc...; sessionExpiresAt=1728123456000; csrfSecret=xxx
```

**如果没有 Cookie header → Cookie 未被保存或域名不匹配**

#### 4. Console 日志

**用途**: 追踪执行流程

```javascript
// 添加详细的日志
console.log('[OAuth] Starting sign-in');
console.log('[OAuth] Credential received:', !!credential);
console.log('[OAuth] Calling API with:', { userId, returnUrl });
console.log('[OAuth] API response:', response);
console.log('[OAuth] Redirecting to:', redirectTo);
```

**教训**: 我们的日志太简略，只有 "Success"，没有具体的值。

---

## 诊断流程图

```
用户点击 OAuth 登录
         ↓
   OAuth popup 打开？
    ├─ No → 检查 OAuth 配置
    └─ Yes
         ↓
   用户完成授权？
    ├─ No → 用户取消
    └─ Yes
         ↓
   credential 返回？
    ├─ No → 检查 Firebase 配置
    └─ Yes
         ↓
POST /api/session/sign-in
         ↓
   返回 200？
    ├─ No → 检查 API 错误日志
    └─ Yes
         ↓
Response Headers 有 Set-Cookie？ ← 关键检查点
    ├─ No → 服务器端 setCookie() 代码问题 ← 我们的问题在这里
    └─ Yes
         ↓
   浏览器 Cookies 中有 session？
    ├─ No → Cookie 属性问题（domain/path/secure/sameSite）
    └─ Yes
         ↓
访问 /dashboard 时携带 Cookie？
    ├─ No → Cookie domain/path 配置问题
    └─ Yes
         ↓
   服务器端读取到 session？
    ├─ No → 服务器端 parseCookies() 问题
    └─ Yes
         ↓
        成功！
```

---

## 代码 Review 清单

在提交 Cookie/Session 相关代码前，检查：

### 服务器端（Next.js API Routes）

```typescript
// ✅ 检查清单
□ 使用 cookie.serialize() 而非 nookies.setCookie()
□ 使用 res.setHeader('Set-Cookie', ...) 设置 header
□ maxAge 单位是秒（如果使用毫秒需要除以 1000）
□ 正确处理多个 Set-Cookie headers（追加而非覆盖）
□ sameSite 设置为 'lax'（除非有特殊需求）
□ 生产环境 secure 设置为 true
□ httpOnly 对敏感 cookie（如 session）设置为 true
□ path 设置为 '/'（除非有特殊需求）
□ domain 不设置（自动使用当前域名）或正确设置
□ 添加日志记录 Cookie 设置
```

### 客户端（验证）

```typescript
// ✅ 检查清单
□ 在 DevTools → Application → Cookies 中验证
□ 在 Network → Response Headers 中验证 Set-Cookie
□ 在 Network → Request Headers 中验证 Cookie 被发送
□ 测试新用户（首次登录）
□ 测试老用户（已登录过）
□ 测试登出再登录
□ 测试隐私模式
```

---

## 快速诊断命令

### 1. 检查 Cookie 设置（curl）

```bash
# 调用 API 并查看 Set-Cookie header
curl -i -X POST 'https://www.urlchecker.dev/api/session/sign-in' \
  -H 'Content-Type: application/json' \
  -H 'x-csrf-token: YOUR_TOKEN' \
  -d '{"idToken":"YOUR_ID_TOKEN"}' \
  | grep -i "set-cookie"

# 应该看到：
# Set-Cookie: session=xxx; Path=/; HttpOnly; Secure; SameSite=Lax
# Set-Cookie: sessionExpiresAt=xxx; Path=/; SameSite=Lax
```

### 2. 检查 Cookie 是否被发送（curl）

```bash
# 保存 Cookie 到文件
curl -c cookies.txt -X POST 'https://www.urlchecker.dev/api/session/sign-in' \
  -H 'Content-Type: application/json' \
  -H 'x-csrf-token: TOKEN' \
  -d '{"idToken":"ID_TOKEN"}'

# 使用 Cookie 访问受保护页面
curl -b cookies.txt 'https://www.urlchecker.dev/dashboard' -v

# 检查 Request Headers 中是否有 Cookie
```

### 3. 检查服务器日志

```bash
# 查看最近的 session/cookie 相关日志
gcloud logging read \
  'resource.type="cloud_run_revision" AND
   resource.labels.service_name="frontend-preview" AND
   (textPayload=~"Session" OR textPayload=~"Cookie")' \
  --project gen-lang-client-0944935873 \
  --limit 50 \
  --format json | jq -r '.[] | .textPayload'
```

---

## 总结：如果下次遇到类似问题

### 第一时间做的事（< 5 分钟）

1. **打开 Chrome DevTools → Application → Cookies**
   - 检查期望的 Cookie 是否存在

2. **打开 Network 面板，找到相关 API 请求**
   - 检查 Response Headers 是否有 Set-Cookie
   - 检查 Request Headers 是否携带了 Cookie

3. **如果 Cookie 不存在**
   - 问题在服务器端 → 检查 `setCookie()` 代码
   - 如果使用 nookies → 改用 cookie.serialize()

4. **如果 Cookie 存在但后续请求没发送**
   - 检查 Cookie 的 domain/path/sameSite 属性
   - 检查是否跨域问题

### 不要做的事

- ❌ 不要直接假设问题在业务逻辑（路由、状态管理等）
- ❌ 不要只看日志，要用浏览器 DevTools 验证
- ❌ 不要相信 "API 返回 200 = 成功"
- ❌ 不要跳过基础设施检查（Cookie/Token）
- ❌ 不要在没验证基础层的情况下修改上层代码

---

## 本次修复涉及的文件

```
修复前的问题代码：
apps/frontend/src/lib/server/auth/save-session-cookie.ts
  - ❌ 使用 nookies.setCookie({ res }, ...)
  - ❌ maxAge 单位是毫秒

修复后的代码：
apps/frontend/src/lib/server/auth/save-session-cookie.ts
  - ✅ 使用 cookie.serialize()
  - ✅ 使用 res.setHeader('Set-Cookie', ...)
  - ✅ maxAge 单位是秒
  - ✅ 正确处理多个 Set-Cookie headers

其他修复（过程中发现的问题）：
apps/frontend/src/core/generic/create-csrf-token.ts
  - ✅ sameSite: 'strict' → 'lax'

apps/frontend/src/pages/auth/sign-in.tsx
  - ✅ 先清除 signOut 参数再执行登出

apps/frontend/src/components/auth/OAuthProviders.tsx
  - ✅ 改用服务器端重定向
  - ✅ 添加详细日志
  - ✅ 401 自动恢复机制
```

---

## 时间线回顾

```
第 1 小时：发现问题 - 页面停留在登录页
  → 错误方向：调试前端路由

第 2-3 小时：修复 router.replace()、onSignIn 回调
  → 错误方向：调试客户端导航

第 4 小时：改用服务器端重定向 window.location.href
  → 错误方向：还是在调试导航

第 5 小时：遇到 CSRF 401 错误
  → 错误方向：修复 CSRF sameSite

第 6 小时：遇到 session/sign-in 401 错误
  → 错误方向：添加延迟等待 cookie 设置

第 6.5 小时：用户提供截图，发现 Cookies 面板是空的
  → 正确方向：发现 Cookie 根本没被设置！

第 7 小时：检查代码，发现使用 nookies
  → 正确方向：改用 cookie.serialize()
  → 问题解决！
```

**教训**: 如果一开始就检查 Cookies 面板，5 分钟就能发现问题。

---

## 参考资料

- [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [MDN: SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [Next.js: API Routes](https://nextjs.org/docs/api-routes/introduction)
- [cookie npm package](https://www.npmjs.com/package/cookie)
- [nookies - SSR-only](https://github.com/maticzav/nookies#readme)

---

**最重要的教训：先验证，再假设。用工具检查实际状态，不要只看日志。**

---

**文档作者**: Claude Code
**创建日期**: 2025-10-02
**最后更新**: 2025-10-02
**问题状态**: 已解决（等待部署验证）
