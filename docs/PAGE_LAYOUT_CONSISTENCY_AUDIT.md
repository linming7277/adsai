# 页面布局一致性审计

## 审计时间
2025-10-18

## 审计目标
检查所有用户前端页面是否有统一的Header和Footer

## 布局分类

### 1. 营销页面（Site Pages）✅ 有Header和Footer

**路径**: `/(site)/*`  
**Layout**: `apps/frontend/src/app/(site)/layout.tsx`

**包含组件**:
- ✅ Header: `SiteHeaderSessionProvider` → `SiteHeader`
- ✅ Footer: `Footer`

**页面列表**:
- ✅ `/` - 首页
- ✅ `/features` - 功能介绍
- ✅ `/pricing` - 定价
- ✅ `/about` - 关于我们
- ✅ `/contact` - 联系我们
- ✅ `/support` - 支持
- ✅ `/blog` - 博客
- ✅ `/docs` - 文档
- ✅ `/faq` - 常见问题
- ✅ `/privacy` - 隐私政策
- ✅ `/terms` - 服务条款
- ✅ `/security` - 安全说明
- ✅ `/careers` - 招聘
- ✅ `/updates` - 更新日志
- ✅ `/resources` - 资源
- ✅ `/high-value-offers` - 高价值Offers

**状态**: ✅ 完全符合，有统一的Header和Footer

---

### 2. 认证页面（Auth Pages）❌ 无Header和Footer

**路径**: `/auth/*`  
**Layout**: `apps/frontend/src/app/auth/layout.tsx`

**包含组件**:
- ❌ 无Header
- ❌ 无Footer
- 只有Logo和认证表单

**页面列表**:
- ❌ `/auth` - 登录/注册
- ❌ `/auth/callback` - OAuth回调
- ❌ `/auth/callback/error` - OAuth错误
- ❌ `/auth/confirm` - 邮箱确认
- ❌ `/auth/password-reset` - 密码重置
- ❌ `/auth/verify` - MFA验证

**设计理由**: 
- 认证页面通常采用简洁设计
- 减少干扰，聚焦认证流程
- 行业标准做法

**建议**: 
- 可以考虑添加简化版Header（只有Logo和语言切换）
- 可以考虑添加简化版Footer（只有隐私政策和服务条款链接）

---

### 3. Dashboard页面 ✅ 有Navbar（无Footer）

**路径**: `/dashboard/*`  
**Layout**: `apps/frontend/src/app/dashboard/layout.tsx` → `AppLayout`

**包含组件**:
- ✅ Header: `Navbar` + `AppTopbar`
- ❌ 无Footer（应用内页面通常不需要）
- ✅ 移动端底部导航: `MobileBottomNav`

**页面列表**:
- ✅ `/dashboard` - Dashboard首页

**状态**: ✅ 符合应用内页面设计规范

---

### 4. Settings页面 ✅ 有Navbar（无Footer）

**路径**: `/settings/*`  
**Layout**: `apps/frontend/src/app/settings/layout.tsx` → `AuthenticatedPageLayout`

**包含组件**:
- ✅ Header: `Navbar`
- ❌ 无Footer
- ✅ 移动端底部导航: `MobileBottomNav`

**页面列表**:
- ✅ `/settings` - 设置首页
- ✅ `/settings/profile` - 个人资料
- ✅ `/settings/subscription` - 订阅管理
- ✅ `/settings/tokens` - Token管理
- ✅ `/settings/checkin` - 签到
- ✅ `/settings/referral` - 推荐

**状态**: ✅ 符合应用内页面设计规范

---

### 5. Offers页面 ⚠️ 无Layout定义

**路径**: `/offers`  
**Layout**: 继承自根layout

**包含组件**:
- ⚠️ 未明确定义
- 需要检查实际渲染

**页面列表**:
- ⚠️ `/offers` - Offers列表

**状态**: ⚠️ 需要验证

---

### 6. Tasks页面 ⚠️ 无Layout定义

**路径**: `/tasks`  
**Layout**: 继承自根layout

**包含组件**:
- ⚠️ 未明确定义
- 需要检查实际渲染

**页面列表**:
- ⚠️ `/tasks` - 任务列表

**状态**: ⚠️ 需要验证

---

### 7. AdsCenter页面 ⚠️ 无Layout定义

**路径**: `/adscenter`  
**Layout**: 继承自根layout

**包含组件**:
- ⚠️ 未明确定义
- 需要检查实际渲染

**页面列表**:
- ⚠️ `/adscenter` - 广告中心

**状态**: ⚠️ 需要验证

---

### 8. UserInfo页面 ⚠️ 有Layout但未明确Header/Footer

**路径**: `/userinfo`  
**Layout**: `apps/frontend/src/app/userinfo/layout.tsx`

**包含组件**:
- ⚠️ 需要检查layout内容

**页面列表**:
- ⚠️ `/userinfo` - 用户信息

**状态**: ⚠️ 需要验证

---

### 9. 管理后台（Admin Pages）✅ 有Sidebar（无传统Header/Footer）

**路径**: `/manage/*`  
**Layout**: `apps/frontend/src/app/manage/layout.tsx`

**包含组件**:
- ✅ Sidebar: `AdminSidebar`
- ❌ 无传统Header
- ❌ 无Footer

**页面列表**:
- ✅ `/manage` - 管理后台首页
- ✅ `/manage/users` - 用户管理
- ✅ `/manage/subscriptions` - 订阅管理
- ✅ `/manage/tokens` - Token管理
- ✅ `/manage/tasks` - 任务管理
- ✅ `/manage/offers` - Offers管理
- ✅ `/manage/ads-accounts` - 广告账号管理
- ✅ `/manage/analytics` - 分析
- ✅ `/manage/security` - 安全
- ✅ `/manage/subscription-config` - 订阅配置
- ✅ `/manage/subscription-plans` - 订阅套餐

**状态**: ✅ 符合管理后台设计规范（使用Sidebar而非Header）

---

### 10. 错误页面 ⚠️ 不一致

#### 10.1 `/error` ✅ 有Header和Footer
**Layout**: 自定义  
**包含组件**:
- ✅ Header: `SiteHeader`
- ✅ Footer: `Footer`

#### 10.2 `/error-page` ❌ 无Header和Footer
**Layout**: 无  
**包含组件**:
- ❌ 无Header
- ❌ 无Footer

#### 10.3 `/setup-error` ❌ 无Header和Footer
**Layout**: 无  
**包含组件**:
- ❌ 无Header
- ❌ 无Footer

#### 10.4 `/not-found` (404) ✅ 有Header和Footer
**Layout**: 自定义  
**包含组件**:
- ✅ Header: `SiteHeaderSessionProvider`
- ✅ Footer: `Footer`

**状态**: ⚠️ 错误页面布局不一致

---

### 11. 其他特殊页面

#### 11.1 `/password-reset` ❌ 无Header和Footer
**Layout**: 无  
**包含组件**:
- ❌ 无Header
- ❌ 无Footer

#### 11.2 `/invite/*` ⚠️ 有Layout但未明确
**Layout**: `apps/frontend/src/app/invite/layout.tsx`  
**状态**: ⚠️ 需要验证

---

## 问题总结

### 严重问题（需要修复）

1. **❌ `/offers` 页面无明确Layout**
   - 应该使用应用内布局（Navbar + MobileBottomNav）
   - 当前可能继承根layout，缺少导航

2. **❌ `/tasks` 页面无明确Layout**
   - 应该使用应用内布局（Navbar + MobileBottomNav）
   - 当前可能继承根layout，缺少导航

3. **❌ `/adscenter` 页面无明确Layout**
   - 应该使用应用内布局（Navbar + MobileBottomNav）
   - 当前可能继承根layout，缺少导航

4. **❌ 错误页面布局不一致**
   - `/error` 有Header/Footer
   - `/error-page` 无Header/Footer
   - `/setup-error` 无Header/Footer
   - 应该统一设计

### 中等问题（建议优化）

5. **⚠️ 认证页面完全无Header/Footer**
   - 可以考虑添加简化版Header（Logo + 语言切换）
   - 可以考虑添加简化版Footer（隐私政策 + 服务条款）

6. **⚠️ `/userinfo` 页面需要验证**
   - 检查是否有正确的导航

7. **⚠️ `/invite` 页面需要验证**
   - 检查是否有正确的布局

8. **⚠️ `/password-reset` 页面无Header/Footer**
   - 应该与认证页面保持一致

## 修复建议

### 优先级P0（立即修复）

#### 1. 为应用内页面添加统一Layout

创建 `apps/frontend/src/app/(app)/layout.tsx`:

```typescript
import loadAppData from '~/lib/server/loaders/load-app-data';
import AuthenticatedPageLayout from '~/components/layout/AuthenticatedPageLayout';

export const dynamic = 'force-dynamic';

async function AppLayout({ children }: React.PropsWithChildren) {
  const data = await loadAppData();

  return (
    <AuthenticatedPageLayout data={data}>
      {children}
    </AuthenticatedPageLayout>
  );
}

export default AppLayout;
```

#### 2. 移动页面到(app)路由组

```bash
# 移动页面到统一的app路由组
mv apps/frontend/src/app/offers apps/frontend/src/app/(app)/offers
mv apps/frontend/src/app/tasks apps/frontend/src/app/(app)/tasks
mv apps/frontend/src/app/adscenter apps/frontend/src/app/(app)/adscenter
mv apps/frontend/src/app/userinfo apps/frontend/src/app/(app)/userinfo
```

#### 3. 统一错误页面布局

所有错误页面应该使用相同的布局：

```typescript
// apps/frontend/src/app/error-page/layout.tsx
import SiteHeaderSessionProvider from '~/app/(site)/components/SiteHeaderSessionProvider';
import Footer from '~/app/(site)/components/Footer';
import loadUserData from '~/lib/server/loaders/load-user-data';

async function ErrorPageLayout({ children }: React.PropsWithChildren) {
  const { session } = await loadUserData();

  return (
    <>
      <SiteHeaderSessionProvider data={session} />
      {children}
      <Footer />
    </>
  );
}

export default ErrorPageLayout;
```

### 优先级P1（短期优化）

#### 4. 为认证页面添加简化Header/Footer

```typescript
// apps/frontend/src/app/auth/components/AuthPageShell.tsx
function AuthPageShell({ children, language }: Props) {
  return (
    <>
      {/* 简化Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="container flex items-center justify-between h-16">
          <Logo className="w-32" />
          <LanguageSwitcher />
        </div>
      </div>

      {/* 主内容 */}
      <div className="min-h-screen pt-16 pb-8">
        {children}
      </div>

      {/* 简化Footer */}
      <div className="border-t py-4 text-center text-sm text-muted-foreground">
        <Link href="/privacy">Privacy</Link>
        {' · '}
        <Link href="/terms">Terms</Link>
      </div>
    </>
  );
}
```

## 验证清单

### 需要验证的页面

- [ ] `/offers` - 检查是否有Navbar
- [ ] `/tasks` - 检查是否有Navbar
- [ ] `/adscenter` - 检查是否有Navbar
- [ ] `/userinfo` - 检查布局完整性
- [ ] `/invite/*` - 检查布局完整性
- [ ] `/error-page` - 检查是否需要Header/Footer
- [ ] `/setup-error` - 检查是否需要Header/Footer
- [ ] `/password-reset` - 检查是否需要Header/Footer

### 验证方法

```bash
# 1. 启动开发服务器
npm run dev

# 2. 访问每个页面
# 3. 检查是否有：
#    - Header/Navbar
#    - Footer（如果适用）
#    - 移动端导航（如果适用）
#    - 一致的样式和间距
```

## 设计规范

### 页面类型与布局规范

| 页面类型 | Header | Footer | 移动端导航 | 示例 |
|---------|--------|--------|-----------|------|
| 营销页面 | ✅ SiteHeader | ✅ Footer | ❌ | `/`, `/pricing` |
| 认证页面 | ⚠️ 简化 | ⚠️ 简化 | ❌ | `/auth` |
| 应用内页面 | ✅ Navbar | ❌ | ✅ MobileBottomNav | `/dashboard`, `/offers` |
| 管理后台 | ❌ (用Sidebar) | ❌ | ❌ | `/manage` |
| 错误页面 | ✅ SiteHeader | ✅ Footer | ❌ | `/error`, `/not-found` |

## 相关文件

### Layout文件
- `apps/frontend/src/app/layout.tsx` - 根layout
- `apps/frontend/src/app/(site)/layout.tsx` - 营销页面layout
- `apps/frontend/src/app/auth/layout.tsx` - 认证页面layout
- `apps/frontend/src/app/dashboard/layout.tsx` - Dashboard layout
- `apps/frontend/src/app/settings/layout.tsx` - 设置页面layout
- `apps/frontend/src/app/manage/layout.tsx` - 管理后台layout

### 组件文件
- `apps/frontend/src/app/(site)/components/SiteHeader.tsx` - 营销页面Header
- `apps/frontend/src/app/(site)/components/Footer.tsx` - Footer
- `apps/frontend/src/components/layout/Navbar.tsx` - 应用内Navbar
- `apps/frontend/src/components/layout/MobileBottomNav.tsx` - 移动端底部导航
- `apps/frontend/src/app/manage/components/AdminSidebar.tsx` - 管理后台Sidebar

## 总结

### 当前状态
- ✅ 营销页面：完全符合
- ✅ Dashboard/Settings：符合应用内规范
- ✅ 管理后台：符合后台规范
- ❌ Offers/Tasks/AdsCenter：缺少统一Layout
- ⚠️ 认证页面：可以优化
- ❌ 错误页面：不一致

### 需要修复的页面数量
- P0（严重）：3个页面（offers, tasks, adscenter）
- P1（中等）：5个页面（认证页面、错误页面、其他特殊页面）

### 预计工作量
- P0修复：2-4小时
- P1优化：4-6小时
- 总计：6-10小时
