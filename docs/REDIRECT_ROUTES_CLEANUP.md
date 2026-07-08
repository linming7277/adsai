# 重定向路由清理记录

## 清理时间
2025-10-18

## 清理目标
移除所有不必要的重定向路由，直接使用最终准确的路由路径。

## 已删除的重定向路由

### 1. `/auth/sign-in` → `/auth`
- **删除文件**: `apps/frontend/src/app/auth/sign-in/page.tsx`
- **原因**: 该页面仅包含一个重定向到 `/auth`，没有实际功能
- **影响**: 无，配置文件中 `paths.signIn` 已指向 `/auth`

### 2. `/auth/sign-up` → `/auth`
- **删除文件**: `apps/frontend/src/app/auth/sign-up/page.tsx`
- **原因**: 该页面仅包含一个重定向到 `/auth`，没有实际功能
- **影响**: 无，配置文件中 `paths.signUp` 已指向 `/auth`

### 3. `/dashboard/ads-center` → `/dashboard/offers`
- **删除文件**: `apps/frontend/src/app/dashboard/ads-center/page.tsx`
- **原因**: 用户要求删除，不再提供向后兼容性
- **影响**: 旧链接将返回404

## 更新的硬编码引用

所有硬编码的路由引用已更新为直接使用最终路径：

### 更新的文件列表
1. `apps/frontend/src/core/hooks/useRequireAuth.ts`
   - `/auth/sign-in` → `/auth`

2. `apps/frontend/src/components/layout/navbar/MobileMenu.tsx`
   - 登录按钮: `/auth/sign-in` → `/auth`
   - 注册按钮: `/auth/sign-up` → `/auth`

3. `apps/frontend/src/components/layout/navbar/UserActions.tsx`
   - 登录按钮: `/auth/sign-in` → `/auth`
   - 注册按钮: `/auth/sign-up` → `/auth`

4. `apps/frontend/src/app/auth/callback/error/page.tsx`
   - 错误重定向: `/auth/sign-in` → `/auth`
   - 返回按钮: `/auth/sign-in` → `/auth`

5. `apps/frontend/src/app/userinfo/components/ReferralTab.tsx`
   - 推荐链接: `/auth/sign-up?ref=` → `/auth?ref=`

6. `apps/frontend/src/app/userinfo/hooks/useUserInfoActions.ts`
   - 推荐链接: `/auth/sign-up?ref=` → `/auth?ref=`

## 保留的配置引用

以下文件使用 `configuration.paths.signIn` 等配置项，无需修改：
- `apps/frontend/src/lib/user/require-session.ts`
- `apps/frontend/src/components/PricingTable.tsx`
- `apps/frontend/src/components/layout/Navbar.tsx`
- `apps/frontend/src/app/auth/password-reset/page.tsx`
- `apps/frontend/src/app/auth/verify/page.tsx`

这些文件会自动使用配置文件中定义的路径（`/auth`）。

## 验证结果

✅ 所有硬编码的 `/auth/sign-in` 引用已清除
✅ 所有硬编码的 `/auth/sign-up` 引用已清除
✅ 重定向页面已删除
✅ 配置文件路径保持一致

## 路由结构简化

### 之前
```
/auth/sign-in → redirect → /auth
/auth/sign-up → redirect → /auth
/dashboard/ads-center → redirect → /dashboard/offers
```

### 之后
```
/auth (直接访问)
/dashboard/offers (直接访问)
```

## 优势

1. **减少重定向**: 消除不必要的HTTP重定向，提升页面加载速度
2. **简化维护**: 减少需要维护的路由文件数量
3. **统一路径**: 所有认证相关功能统一使用 `/auth` 路径
4. **清晰架构**: 路由结构更加清晰，易于理解

## 注意事项

- 旧的 `/auth/sign-in` 和 `/auth/sign-up` URL 将返回 404
- 如果有外部链接指向这些旧路径，需要更新
- 推荐链接已更新为使用 `/auth?ref=` 格式
