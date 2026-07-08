# RBAC 功能快速测试指南

## ⚠️ 重要提示

**本系统仅支持 Google OAuth 一键登录**
- ✅ 所有用户（普通用户和管理员）都通过 "Sign in with Google" 登录
- ❌ 不支持邮箱密码登录、手机号登录等其他方式

---

## 准备工作

### 1. 创建测试账号

**必须通过前端Google OAuth完成注册**：

#### 步骤A: 创建普通用户
1. 访问 https://www.urlchecker.dev (preview环境)
2. 点击 "Sign in with Google"
3. 使用一个Google账号完成授权（例如：test-user@gmail.com）
4. 登录成功后，该用户自动成为**普通用户**

#### 步骤B: 创建管理员
1. 使用另一个Google账号重复上述步骤（例如：admin@gmail.com）
2. 登录成功后，在Supabase Dashboard中设置角色（见下方说明）

### 2. 设置管理员角色

**重要**: 只能为已通过Google登录的用户设置管理员角色

#### 方法A: 通过Supabase Dashboard
1. 访问 https://jzzvizacfyipzdyiqfzb.supabase.co
2. **Authentication** → **Users**
3. 找到通过Google登录的用户（查看 provider 字段应为 "google"）
4. 点击用户进入详情页
5. 编辑 **App Metadata** (⚠️ 注意是App Metadata，不是User Metadata)
6. 添加:
   ```json
   {
     "role": "super-admin"
   }
   ```
7. 保存后，用户需要**重新登录**才能生效

#### 方法B: 通过SQL Console
```sql
-- 设置管理员角色（确保是Google登录用户）
UPDATE auth.users
SET raw_app_meta_data =
  COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "super-admin"}'::jsonb
WHERE email = 'admin@gmail.com'  -- 你的Google邮箱
  AND raw_user_meta_data->>'provider' = 'google';  -- 确保是Google用户

-- 验证设置结果
SELECT
  email,
  raw_app_meta_data->>'role' as role,
  raw_user_meta_data->>'provider' as provider
FROM auth.users
WHERE email = 'admin@gmail.com';
```

---

## 测试场景

### 场景1: 普通用户登录

**操作步骤**:
1. 访问 https://www.urlchecker.dev
2. 点击 "Sign in with Google"
3. 使用普通用户的Google账号登录（未设置管理员角色的账号）
4. 进入 `/dashboard`

**预期结果**:
- ✅ 侧边栏导航包含:
  - 仪表盘
  - Offer管理
  - 任务中心
  - 广告中心 (如果订阅了Pro套餐)
  - 系统设置
- ❌ 侧边栏**不显示** "后台管理" 入口
- ❌ 直接访问 `/manage` → 返回 **404 Not Found**
- ❌ ProfileDropdown 中**不显示** "Admin" 链接

---

### 场景2: 管理员登录

**操作步骤**:
1. 访问 https://www.urlchecker.dev
2. 点击 "Sign in with Google"
3. 使用管理员的Google账号登录（已在Supabase中设置 app_metadata.role = "super-admin"）
4. 进入 `/dashboard`

**⚠️ 注意**:
- 如果是首次设置管理员角色，需要先退出登录，然后重新使用Google登录
- 或者清除浏览器缓存后刷新页面
- 这样才能获取包含新角色信息的JWT Token

**预期结果**:
- ✅ 侧边栏导航包含:
  - 仪表盘
  - Offer管理
  - 任务中心
  - 广告中心
  - **--- 分隔线 ---**
  - **后台管理** ← 新增
  - 系统设置
- ✅ 点击 "后台管理" → 跳转到 `/manage`
- ✅ ProfileDropdown 中**显示** "Admin" 链接
- ✅ 可以访问所有 `/manage/*` 路由

---

### 场景3: 前端权限组件测试

创建测试页面验证 `useUserRole` hook:

```typescript
// apps/frontend/src/app/dashboard/test-rbac/page.tsx
'use client';

import useUserRole from '~/lib/user/hooks/use-user-role';

export default function RbacTestPage() {
  const { role, isAdmin, isUser } = useUserRole();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">RBAC 测试页面</h1>

      <div className="space-y-2">
        <p><strong>当前角色:</strong> {role}</p>
        <p><strong>是管理员:</strong> {isAdmin ? '✅ 是' : '❌ 否'}</p>
        <p><strong>是普通用户:</strong> {isUser ? '✅ 是' : '❌ 否'}</p>
      </div>

      {isAdmin && (
        <div className="mt-4 p-4 bg-green-100 rounded">
          <p className="text-green-800">🎉 管理员专属内容</p>
        </div>
      )}

      {isUser && (
        <div className="mt-4 p-4 bg-blue-100 rounded">
          <p className="text-blue-800">👤 普通用户视图</p>
        </div>
      )}
    </div>
  );
}
```

**测试步骤**:
1. 访问 `/dashboard/test-rbac`
2. 以不同角色登录查看输出

**预期结果**:
- 普通用户: `role="user"`, `isAdmin=false`, `isUser=true`
- 管理员: `role="admin"`, `isAdmin=true`, `isUser=false`

---

## 浏览器DevTools检查

### 1. 检查JWT Token中的角色信息

```javascript
// 在浏览器Console中运行
const session = await (await fetch('/auth/session')).json();
console.log('User Role:', session?.user?.app_metadata?.role);
```

### 2. 检查导航配置

```javascript
// 在 /dashboard 页面Console中运行
const navigation = document.querySelectorAll('[data-sidebar-item]');
console.log('导航项数量:', navigation.length);
console.log('是否包含"后台管理":',
  Array.from(navigation).some(el => el.textContent?.includes('后台管理'))
);
```

---

## 常见问题排查

### 问题1: 修改角色后未生效

**解决方案**:
```typescript
// 清除浏览器缓存并重新登录
localStorage.clear();
sessionStorage.clear();

// 或刷新Token
await supabase.auth.refreshSession();
```

### 问题2: 导航栏未显示"后台管理"

**检查清单**:
1. ✅ 确认 `app_metadata.role = "super-admin"`
2. ✅ 用户已重新登录
3. ✅ `useUserRole()` 返回 `isAdmin=true`
4. ✅ `navigation.config.tsx` 中配置正确

**Debug日志**:
```typescript
// 在 AppSidebarNavigation.tsx 中添加
console.log('User Role:', userRole);
console.log('Navigation Items:', items);
```

### 问题3: 访问 /manage 返回404

**原因**: 路由守卫工作正常，当前用户不是管理员

**验证步骤**:
```sql
-- 在Supabase SQL Editor中运行
SELECT
  email,
  raw_app_meta_data->>'role' as role
FROM auth.users
WHERE email = '你的邮箱';
```

---

## 性能测试

### 1. 导航渲染性能

```typescript
// 使用 React DevTools Profiler
// 预期: 角色过滤不应增加明显渲染时间 (<50ms)
```

### 2. 权限检查性能

```typescript
import { performance } from 'perf_hooks';

const start = performance.now();
const { isAdmin } = useUserRole();
const end = performance.now();

console.log(`useUserRole 执行时间: ${end - start}ms`);
// 预期: <5ms (有缓存优化)
```

---

## 自动化测试脚本

```bash
#!/bin/bash
# test-rbac.sh

echo "🧪 开始RBAC功能测试..."

# 测试1: 检查TypeScript编译
echo "📝 测试1: TypeScript编译"
cd apps/frontend && npx tsc --noEmit && echo "✅ 通过" || echo "❌ 失败"

# 测试2: 检查导航配置
echo "📝 测试2: 导航配置语法"
node -e "require('./apps/frontend/src/navigation.config.tsx')" && echo "✅ 通过" || echo "❌ 失败"

# 测试3: 本地构建
echo "📝 测试3: 本地构建"
cd apps/frontend && npm run build && echo "✅ 通过" || echo "❌ 失败"

echo "✅ RBAC测试完成"
```

---

## 回滚方案

如果需要回滚此功能:

```bash
# 1. 恢复文件
git checkout HEAD~1 -- \
  apps/frontend/src/navigation.config.tsx \
  apps/frontend/src/lib/user/hooks/use-user-role.ts \
  apps/frontend/src/app/dashboard/components/AppSidebarNavigation.tsx

# 2. 移除所有用户的管理员角色
# 在Supabase SQL Editor中运行:
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data - 'role'
WHERE raw_app_meta_data->>'role' = 'super-admin';

# 3. 重新部署
npm run build && npm run deploy
```

---

## 联系支持

如有问题，请查阅:
- 📖 [RBAC实现指南](./RBAC-Implementation-Guide.md)
- 🏗️ [项目架构文档](./MustKnowV6.md)
