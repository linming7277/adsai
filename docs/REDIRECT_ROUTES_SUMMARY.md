# 前端重定向路由总结

## 概述

前端有多个重定向路由，用于不同的目的。本文档总结所有重定向路由及其用途。

## 重定向路由分类

### 1. 向后兼容性重定向

#### `/dashboard/ads-center` → `/adscenter`

**文件**: `apps/frontend/src/app/dashboard/ads-center/page.tsx`

**目的**: 架构重构后的URL简化

**实现**:
```typescript
router.replace('/adscenter');
```

**状态**: ✅ 保留（向后兼容）

---

### 2. 路由别名重定向

#### `/auth/sign-in` → `/auth`

**文件**: `apps/frontend/src/app/auth/sign-in/page.tsx`

**目的**: 统一登录入口

**实现**:
```typescript
redirect('/auth');
```

**状态**: ✅ 保留（路由别名）

#### `/auth/sign-up` → `/auth`

**文件**: `apps/frontend/src/app/auth/sign-up/page.tsx`

**目的**: 统一注册入口

**实现**:
```typescript
redirect('/auth');
```

**状态**: ✅ 保留（路由别名）

---

### 3. 认证保护重定向

#### `/userinfo` → `/auth` (未登录时)

**文件**: `apps/frontend/src/app/userinfo/page.tsx`

**目的**: 保护需要登录的页面

**实现**:
```typescript
if (!userId) {
  redirect('/auth');
}
```

**状态**: ✅ 必需（安全）

#### `/password-reset` → `/auth/password-reset` (未登录时)

**文件**: `apps/frontend/src/app/password-reset/page.tsx`

**目的**: 确保用户已登录才能重置密码

**实现**:
```typescript
if (!user.data) {
  redirect('/auth/password-reset');
}
```

**状态**: ✅ 必需（安全）

---

### 4. 状态检查重定向

#### `/setup-error` → `/dashboard` (已完成设置时)

**文件**: `apps/frontend/src/app/setup-error/page.tsx`

**目的**: 避免已设置用户看到错误页面

**实现**:
```typescript
if (userData?.onboarded) {
  redirect(configuration.paths.appHome);
}
```

**状态**: ✅ 必需（用户体验）

#### `/error` → `/dashboard` (用户数据正常时)

**文件**: `apps/frontend/src/app/error/page.tsx`

**目的**: 避免正常用户看到错误页面

**实现**:
```typescript
if (userData?.onboarded) {
  redirect(configuration.paths.appHome);
}
```

**状态**: ✅ 必需（用户体验）

#### `/auth/verify` → `/auth` (不需要MFA时)

**文件**: `apps/frontend/src/app/auth/verify/page.tsx`

**目的**: 只有需要MFA的用户才能访问验证页面

**实现**:
```typescript
if (!needsMfa) {
  redirect(configuration.paths.signIn);
}
```

**状态**: ✅ 必需（安全）

---

### 5. 错误处理重定向

#### `/auth/callback/error` → `/auth/sign-in` (无错误时)

**文件**: `apps/frontend/src/app/auth/callback/error/page.tsx`

**目的**: 如果没有错误，不应该在错误页面

**实现**:
```typescript
if (!error) {
  redirect('/auth/sign-in');
}
```

**状态**: ✅ 必需（逻辑正确性）

---

### 6. 支付流程重定向

#### `/settings/subscription/return` → Stripe URL (自托管模式)

**文件**: `apps/frontend/src/app/settings/subscription/return/page.tsx`

**目的**: Stripe支付完成后的重定向

**实现**:
```typescript
if (isSessionOpen && !isEmbeddedMode && session.url) {
  redirect(session.url);
}
```

**状态**: ✅ 必需（支付流程）

---

## 重定向方法对比

### `redirect()` (Server-side)

**使用场景**: Server Component中的重定向

**特点**:
- 服务端重定向
- 返回307状态码
- 不会在客户端执行任何代码

**示例**:
```typescript
import { redirect } from 'next/navigation';

export default async function Page() {
  redirect('/auth');
}
```

### `router.replace()` (Client-side)

**使用场景**: Client Component中的重定向

**特点**:
- 客户端重定向
- 不会在历史记录中留下当前页面
- 需要在useEffect中执行

**示例**:
```typescript
'use client';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/adscenter');
  }, [router]);
  
  return null;
}
```

### `router.push()` (Client-side)

**使用场景**: 用户操作触发的导航

**特点**:
- 客户端导航
- 会在历史记录中留下当前页面
- 用户可以点击后退按钮返回

**示例**:
```typescript
router.push('/dashboard');
```

## 重定向最佳实践

### ✅ 应该做的

1. **使用语义化的重定向**
   - 向后兼容: `router.replace()`
   - 认证保护: `redirect()`
   - 用户操作: `router.push()`

2. **提供清晰的重定向原因**
   ```typescript
   // ✅ 好
   // Redirect from /dashboard/ads-center to /adscenter
   router.replace('/adscenter');
   
   // ❌ 差
   router.replace('/adscenter');
   ```

3. **避免重定向循环**
   ```typescript
   // ✅ 好 - 有条件检查
   if (!userId) {
     redirect('/auth');
   }
   
   // ❌ 差 - 无条件重定向可能导致循环
   redirect('/auth');
   ```

4. **使用配置常量**
   ```typescript
   // ✅ 好
   redirect(configuration.paths.appHome);
   
   // ❌ 差
   redirect('/dashboard');
   ```

### ❌ 不应该做的

1. **不要创建重定向链**
   ```typescript
   // ❌ 差
   /a → /b → /c → /d
   
   // ✅ 好
   /a → /d
   /b → /d
   /c → /d
   ```

2. **不要在循环中重定向**
   ```typescript
   // ❌ 差
   while (condition) {
     redirect('/somewhere');
   }
   ```

3. **不要忘记返回null**
   ```typescript
   // ❌ 差
   export default function Page() {
     const router = useRouter();
     useEffect(() => {
       router.replace('/somewhere');
     }, [router]);
     // 缺少return
   }
   
   // ✅ 好
   export default function Page() {
     const router = useRouter();
     useEffect(() => {
       router.replace('/somewhere');
     }, [router]);
     return null; // 或者返回loading状态
   }
   ```

## 监控和维护

### 检查重定向使用情况

```bash
# 查找所有redirect调用
grep -r "redirect(" apps/frontend/src/app --include="*.tsx"

# 查找所有router.replace调用
grep -r "router.replace" apps/frontend/src/app --include="*.tsx"

# 查找所有router.push调用
grep -r "router.push" apps/frontend/src/app --include="*.tsx"
```

### 添加重定向日志

```typescript
// 在重定向前添加日志
console.log('[Redirect] From /dashboard/ads-center to /adscenter');
router.replace('/adscenter');
```

### 监控重定向性能

使用Next.js Analytics或自定义监控：

```typescript
// 记录重定向时间
const startTime = Date.now();
router.replace('/adscenter');
// 在目标页面记录加载时间
```

## 清理计划

### 可以考虑移除的重定向

1. **向后兼容重定向** (6个月后)
   - `/dashboard/ads-center` → `/adscenter`
   - 前提: 确认旧URL访问量很低

### 必须保留的重定向

1. **认证保护重定向** - 永久保留
2. **路由别名重定向** - 永久保留
3. **状态检查重定向** - 永久保留
4. **错误处理重定向** - 永久保留

## 总结

前端共有 **9个重定向路由**：

| 类型 | 数量 | 状态 |
|------|------|------|
| 向后兼容 | 1 | 可选保留 |
| 路由别名 | 2 | 永久保留 |
| 认证保护 | 2 | 永久保留 |
| 状态检查 | 3 | 永久保留 |
| 错误处理 | 1 | 永久保留 |
| 支付流程 | 1 | 永久保留 |

**结论**: 所有重定向都有明确的目的，大部分需要永久保留。只有向后兼容性重定向可以在过渡期后考虑移除。
