# 基于角色的访问控制 (RBAC) 实现指南

## 概述

本系统实现了基于角色的访问控制（RBAC），支持**普通用户**和**管理员**两种角色。管理员可以访问后台管理系统 (`/manage`)，而普通用户只能访问标准功能。

---

## 架构设计

### 角色定义

#### 1. UserRole (前端导航权限)
- **位置**: `apps/frontend/src/lib/types/user-role.ts`
- **枚举值**:
  - `UserRole.User` - 普通用户 (默认)
  - `UserRole.Admin` - 管理员

#### 2. GlobalRole (Supabase Auth元数据)
- **位置**: `apps/frontend/src/core/session/types/global-role.ts`
- **枚举值**:
  - `GlobalRole.SuperAdmin` - 超级管理员

#### 3. 角色映射关系
```typescript
Supabase app_metadata.role = "super-admin"
  → UserRole.Admin (前端)
  → 可访问 /manage 后台管理系统
  → 导航栏显示"后台管理"入口
```

---

## 核心实现

### 1. 用户角色Hook (`useUserRole`)

**文件**: `apps/frontend/src/lib/user/hooks/use-user-role.ts`

**优先级顺序**:
1. `app_metadata.role` (Supabase Auth) - **推荐方式**
2. `user_metadata.role` (已弃用，保留兼容性)
3. `session.data.role` (fallback)

**使用示例**:
```typescript
import useUserRole from '~/lib/user/hooks/use-user-role';

function MyComponent() {
  const { role, isAdmin, isUser } = useUserRole();

  if (!isAdmin) {
    return <AccessDenied />;
  }

  return <AdminPanel />;
}
```

---

### 2. 导航权限过滤

**文件**: `apps/frontend/src/navigation.config.tsx`

**配置示例**:
```typescript
{
  label: '后台管理',
  path: '/manage',
  Icon: createIconRenderer('settings'),
  permission: {
    requiredRole: UserRole.Admin,  // 只有管理员可见
  },
}
```

**过滤逻辑**:
```typescript
function isPermitted(permission: Permission | undefined, context: PermissionContext) {
  // 检查角色要求
  if (permission.requiredRole) {
    if (!context.userRole) return false;
    if (permission.requiredRole === UserRole.Admin) {
      return context.userRole === UserRole.Admin;
    }
  }

  // 检查订阅套餐和功能开关
  // ...
}
```

---

### 3. 后台管理系统路由保护

**文件**: `apps/frontend/src/app/manage/layout.tsx`

**守卫机制**:
```typescript
async function AdminLayout({ children }: React.PropsWithChildren) {
  const isAdmin = await isUserSuperAdmin();

  if (!isAdmin) {
    notFound();  // 返回404页面
  }

  return (
    <AdminProviders>
      <Page sidebar={<AdminSidebar />}>
        {children}
      </Page>
    </AdminProviders>
  );
}
```

---

## 在Supabase中配置管理员

### 用户登录方式说明

**重要**: 本系统仅支持 **Google OAuth 一键登录**

- ✅ 普通用户: Google一键登录
- ✅ 管理员: Google一键登录（需额外配置角色）
- ❌ 不支持: 邮箱密码登录、手机号登录、其他OAuth提供商

### 方法1: 通过Supabase Dashboard (推荐)

1. **用户首次登录**
   - 访问 https://www.urlchecker.dev (preview) 或 https://www.autoads.dev (生产)
   - 点击 "Sign in with Google"
   - 使用Google账号完成授权
   - 此时用户自动注册为**普通用户**

2. **设置管理员角色**
   - 登录 [Supabase Dashboard](https://jzzvizacfyipzdyiqfzb.supabase.co)
   - 进入 **Authentication** → **Users**
   - 找到通过Google登录的用户（识别方式：email或user_id）
   - 点击用户进入详情页
   - 在 **App Metadata** 中编辑（注意不是User Metadata）
   - 添加以下JSON：
     ```json
     {
       "role": "super-admin"
     }
     ```
   - **保存更改**

3. **生效方式**
   - 用户需要**重新登录**才能获取新的JWT Token
   - 或者清除浏览器缓存后刷新页面

### 方法2: 通过SQL更新 (适用于批量操作)

**前提条件**: 用户必须先通过Google登录完成注册

```sql
-- 将指定Google邮箱用户设为管理员
UPDATE auth.users
SET raw_app_meta_data =
  COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "super-admin"}'::jsonb
WHERE email = 'your-google-email@gmail.com'  -- 必须是已通过Google登录的邮箱
  AND raw_user_meta_data->>'provider' = 'google';  -- 确保是Google登录用户

-- 查询当前管理员列表（包括登录方式）
SELECT
  id,
  email,
  raw_app_meta_data->>'role' as role,
  raw_user_meta_data->>'provider' as login_provider,
  created_at
FROM auth.users
WHERE raw_app_meta_data->>'role' = 'super-admin';
```

### 方法3: 通过Supabase Admin API

**前提条件**: 用户必须先通过Google登录完成注册

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!  // 需要service_role密钥
);

// 步骤1: 查找通过Google登录的用户
const { data: users } = await supabase.auth.admin.listUsers();
const googleUser = users.users.find(u =>
  u.email === 'your-google-email@gmail.com' &&
  u.app_metadata.provider === 'google'
);

if (!googleUser) {
  throw new Error('用户未通过Google登录，请先让用户访问前端完成Google OAuth');
}

// 步骤2: 设置用户为管理员
await supabase.auth.admin.updateUserById(googleUser.id, {
  app_metadata: { role: 'super-admin' }
});

console.log(`✅ 用户 ${googleUser.email} 已设置为管理员`);
```

**注意**: 如果用户尚未通过Google登录注册，必须先让用户访问前端完成Google OAuth授权流程

---

## 功能验证

### 测试场景1: 普通用户登录

**预期行为**:
- ✅ 可以访问 `/dashboard`
- ✅ 可以访问 `/dashboard/offers`
- ✅ 可以访问 `/dashboard/tasks`
- ❌ 导航栏**不显示**"后台管理"入口
- ❌ 直接访问 `/manage` 返回 **404 页面**

### 测试场景2: 管理员登录

**预期行为**:
- ✅ 可以访问所有普通用户功能
- ✅ 导航栏**显示**"后台管理"入口
- ✅ 可以访问 `/manage` 及其所有子路由
- ✅ ProfileDropdown 中显示 "Admin" 链接

---

## 目录结构

```
apps/frontend/src/
├── lib/
│   ├── types/
│   │   └── user-role.ts                    # UserRole枚举定义
│   └── user/hooks/
│       └── use-user-role.ts                # 用户角色Hook
├── core/
│   └── session/types/
│       └── global-role.ts                  # GlobalRole枚举定义
├── navigation.config.tsx                   # 导航权限配置
├── app/
│   ├── dashboard/
│   │   └── components/
│   │       └── AppSidebarNavigation.tsx    # 侧边栏导航
│   └── manage/
│       ├── layout.tsx                      # 后台管理布局(路由保护)
│       ├── utils/
│       │   └── is-user-super-admin.ts      # 服务端权限检查
│       └── components/
│           └── AdminGuard.tsx              # 管理员守卫组件
└── components/
    └── ProfileDropdown.tsx                 # 用户下拉菜单
```

---

## 最佳实践

### 1. 前端权限检查 (用户体验优化)
```typescript
// ✅ 推荐: 使用useUserRole hook
const { isAdmin } = useUserRole();

if (!isAdmin) {
  return <FeatureUnavailable />;
}
```

### 2. 服务端权限校验 (安全保障)
```typescript
// ✅ 必须: 在所有敏感路由中使用AdminGuard
export default AdminGuard(async function AdminPage() {
  // 只有管理员能执行到这里
  return <AdminContent />;
});
```

### 3. API路由保护
```typescript
// apps/frontend/src/app/api/admin/route.ts
import isUserSuperAdmin from '~/app/manage/utils/is-user-super-admin';

export async function GET() {
  const isAdmin = await isUserSuperAdmin();

  if (!isAdmin) {
    return new Response('Forbidden', { status: 403 });
  }

  // 管理员操作
}
```

---

## 安全注意事项

### ⚠️ 关键安全原则

1. **永远在服务端验证权限**
   - 前端权限检查仅用于UI优化
   - 所有敏感操作必须在服务端验证

2. **使用 app_metadata 存储角色**
   - `app_metadata` 只能通过服务端API修改
   - `user_metadata` 可被客户端修改，**不安全**

3. **实现RLS (Row Level Security)**
   ```sql
   -- 示例: 只允许管理员访问审计日志
   CREATE POLICY "Admin only access"
   ON audit_logs
   FOR SELECT
   USING (
     auth.jwt()->>'app_metadata'->>'role' = 'super-admin'
   );
   ```

4. **启用MFA (多因素认证)**
   ```typescript
   // is-user-super-admin.ts
   const ENFORCE_MFA = true;  // 强制管理员使用MFA
   ```

---

## 常见问题

### Q1: 修改用户角色后，前端未生效？

**原因**: JWT Token中的`app_metadata`有缓存

**解决方案**:
```typescript
// 用户需要重新登录，或刷新Token
await supabase.auth.refreshSession();
```

### Q2: 如何批量导入管理员列表？

```sql
-- 从CSV或数组批量更新
UPDATE auth.users
SET raw_app_meta_data =
  COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "super-admin"}'::jsonb
WHERE email = ANY(ARRAY[
  'admin1@example.com',
  'admin2@example.com',
  'admin3@example.com'
]);
```

### Q3: 如何实现更细粒度的权限控制？

**方案**: 扩展 Permission 类型，添加更多权限维度

```typescript
// navigation.config.tsx
type Permission = {
  requiredRole?: UserRole;
  requiredPermissions?: string[];  // 新增权限列表
  subscriptionTiers?: SubscriptionTier[];
};

// 示例
{
  label: '财务报表',
  path: '/manage/financial',
  permission: {
    requiredRole: UserRole.Admin,
    requiredPermissions: ['finance:read', 'reports:generate']
  }
}
```

---

## 更新日志

### 2025-01-XX (初始版本)
- ✅ 实现基于 `app_metadata.role` 的角色判断
- ✅ 导航栏根据角色动态显示/隐藏
- ✅ `/manage` 路由守卫保护
- ✅ 统一 `GlobalRole.SuperAdmin` 和 `UserRole.Admin` 映射

---

## 相关文档

- [Supabase Auth文档](https://supabase.com/docs/guides/auth)
- [Next.js App Router权限控制](https://nextjs.org/docs/app/building-your-application/authentication)
- [MustKnowV6.md](./MustKnowV6.md) - 项目架构文档
