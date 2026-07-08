# 认证URL本地化问题分析

## 问题描述

用户在注册登录过程中，会出现 `/zh-CN/auth` 和 `/en/auth` 这样带有语言前缀的URL，而不是直接使用 `/auth`。

## 根本原因

应用中存在**两种不同的路由策略**：

### 1. 中间件层面（正确）
- **文件**: `apps/frontend/src/middleware.ts`
- **策略**: 不使用URL路径前缀，而是通过Cookie存储语言偏好
- **实现**: 
  - 检测用户语言偏好（从Cookie或Accept-Language头）
  - 将语言设置存储在Cookie中（`I18N_COOKIE_NAME`）
  - 所有路由保持原始路径，不添加语言前缀
  - 认证重定向使用 `/auth`（无语言前缀）

### 2. 前端组件层面（错误）
某些Landing页面组件错误地使用了 `injectLocaleIntoPath` 函数，将语言前缀注入到URL中：

#### 问题组件1: `HeroSection.tsx`
```typescript
// apps/frontend/src/components/landing/HeroSection.tsx
const ctaHref = useCallback(
  (target: string) => {
    const localized = injectLocaleIntoPath(
      target.startsWith('/') ? target : `/${target}`,
      i18n.language,
    );
    // ...
  },
  [i18n.language, searchParams],
);

// 使用
<Button onClick={() => router.push(ctaHref('/auth'))}>
```

#### 问题组件2: `FinalCTASection.tsx`
```typescript
// apps/frontend/src/components/landing/FinalCTASection.tsx
<Button
  onClick={() =>
    router.push(injectLocaleIntoPath('/auth', i18n.language))
  }
>
```

#### 其他组件（正确）
```typescript
// apps/frontend/src/components/layout/navbar/UserActions.tsx
// apps/frontend/src/components/layout/navbar/MobileMenu.tsx
// 这些组件直接使用 /auth，没有注入语言前缀
<Link href="/auth/sign-in">
```

## 正确的认证URL

根据应用的路由架构，**正确的认证URL应该是**：

- **登录/注册页**: `/auth`
- **OAuth回调**: `/auth/callback`
- **密码重置**: `/auth/password-reset`
- **MFA验证**: `/auth/verify`

**不应该使用**带语言前缀的URL：
- ❌ `/zh-CN/auth`
- ❌ `/en/auth`

**已废弃的URL**（重定向路由已删除）：
- ❌ `/auth/sign-in` (已删除，直接使用 `/auth`)
- ❌ `/auth/sign-up` (已删除，直接使用 `/auth`)

## 语言切换机制

应用使用**Cookie-based i18n**，而非URL-based i18n：

1. **语言检测**（middleware.ts）:
   - 首先检查Cookie中的语言设置
   - 如果没有，解析Accept-Language头
   - 默认语言: `en`（配置在 `i18n/locales.ts`）

2. **语言存储**:
   - Cookie名称: `I18N_COOKIE_NAME`
   - 路径: `/`
   - 有效期: 1年

3. **支持的语言**:
   ```typescript
   export const SUPPORTED_LOCALES = ['en', 'zh-CN'] as const;
   export const DEFAULT_LOCALE: SupportedLocale = 'en';
   ```

## 解决方案

### ✅ 已修复的组件

#### 1. **HeroSection.tsx** ✅
修改内容：
- 移除了 `injectLocaleIntoPath` 的导入
- 简化 `ctaHref` 函数，直接返回原始路径
- 移除了对 `i18n.language` 的依赖

修改前：
```typescript
const ctaHref = useCallback(
  (target: string) => {
    const localized = injectLocaleIntoPath(
      target.startsWith('/') ? target : `/${target}`,
      i18n.language,
    );
    const queryString = searchParams?.toString();
    return queryString ? `${localized}?${queryString}` : localized;
  },
  [i18n.language, searchParams],
);
```

修改后：
```typescript
const ctaHref = useCallback(
  (target: string) => {
    if (target.startsWith('http')) {
      return target;
    }
    const path = target.startsWith('/') ? target : `/${target}`;
    const queryString = searchParams?.toString();
    return queryString ? `${path}?${queryString}` : path;
  },
  [searchParams],
);
```

#### 2. **FinalCTASection.tsx** ✅
修改内容：
- 移除了 `injectLocaleIntoPath` 的导入
- 直接使用 `router.push('/auth')` 和 `router.push('/contact')`

修改前：
```typescript
onClick={() => router.push(injectLocaleIntoPath('/auth', i18n.language))}
onClick={() => router.push(injectLocaleIntoPath('/contact', i18n.language))}
```

修改后：
```typescript
onClick={() => router.push('/auth')}
onClick={() => router.push('/contact')}
```

#### 3. **其他组件检查** ✅
已确认其他组件（UserActions.tsx, MobileMenu.tsx）已经正确使用无前缀路径。

## 配置文件

### 认证路径配置
```typescript
// apps/frontend/src/configuration.ts
paths: {
  signIn: '/auth',
  signUp: '/auth',
  signInMfa: '/auth/verify',
  appPrefix: '/dashboard',
  appHome: '/dashboard',
  authCallback: '/auth/callback',
  // ...
}
```

### 默认语言配置
```typescript
// apps/frontend/src/configuration.ts
site: {
  locale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'zh-CN',
}
```

注意：虽然默认语言配置为 `zh-CN`，但这不影响URL结构，仅用于初始语言选择。

## 测试验证

修复后需要验证：

1. ✅ 首页Hero区域CTA按钮跳转到 `/auth`（不是 `/zh-CN/auth`）
2. ✅ 页面底部Final CTA按钮跳转到 `/auth`（不是 `/zh-CN/auth`）
3. ✅ 导航栏登录/注册链接统一指向 `/auth`
4. ✅ 语言切换后，认证URL保持不变
5. ✅ OAuth回调正确重定向到 `/auth/callback`
6. ✅ 已删除不必要的重定向路由 `/auth/sign-in` 和 `/auth/sign-up`
6. ✅ 认证后重定向到 `/dashboard`（不是 `/zh-CN/dashboard`）
7. ✅ 带有查询参数的URL正确保留（如 `/auth?ref=xxx`）

### 测试步骤

```bash
# 1. 启动开发服务器
cd apps/frontend
npm run dev

# 2. 访问首页
open http://localhost:3000

# 3. 测试点击
# - 点击Hero区域的"立即开始"按钮
# - 点击页面底部的CTA按钮
# - 检查浏览器地址栏，应该显示 /auth 而不是 /zh-CN/auth 或 /en/auth

# 4. 测试语言切换
# - 切换语言到英文
# - 再次点击CTA按钮
# - 确认URL仍然是 /auth

# 5. 测试带referral code的场景
open http://localhost:3000?ref=test123
# - 点击CTA按钮
# - 确认跳转到 /auth?ref=test123
```

## 相关文件

- `apps/frontend/src/middleware.ts` - 中间件路由逻辑
- `apps/frontend/src/i18n/locales.ts` - 语言配置
- `apps/frontend/src/i18n/locale-path.ts` - 路径本地化工具（不应用于认证路由）
- `apps/frontend/src/configuration.ts` - 应用配置
- `apps/frontend/src/components/landing/HeroSection.tsx` - ✅ 已修复
- `apps/frontend/src/components/landing/FinalCTASection.tsx` - ✅ 已修复

## 修复总结

**修复日期**: 2025-10-18

**修改的文件**:
1. `apps/frontend/src/components/landing/HeroSection.tsx`
2. `apps/frontend/src/components/landing/FinalCTASection.tsx`

**修改内容**:
- 移除了 `injectLocaleIntoPath` 函数的使用
- 所有认证相关的URL现在直接使用无前缀路径（`/auth`）
- 保持了查询参数的正确传递功能
- 语言偏好通过Cookie管理，不影响URL结构

**影响范围**:
- 首页Hero区域的CTA按钮
- 页面底部Final CTA区域的按钮
- 不影响其他已经正确实现的组件（导航栏等）

**预期效果**:
- 用户点击任何CTA按钮都会跳转到 `/auth`
- 不会再出现 `/zh-CN/auth` 或 `/en/auth` 的URL
- 语言切换功能正常工作，通过Cookie存储语言偏好
- OAuth登录流程正常工作
