# Phase 5-6 完成报告

> **执行时间**: 2025-10-10
> **执行人**: Claude Code
> **状态**: ✅ **已完成**

---

## Phase 5: UI/文案调整

### ✅ T5.1: 扫描组织相关文案

**执行**:
```bash
grep -r "组织\|organization" src/ --include="*.tsx" -n
```

**发现**:
- ✅ 导航组件中无 "新建组织" 按钮
- ✅ 设置菜单中无 "组织设置" 菜单项
- ✅ UI 中无组织切换器
- ⚠️ 保留了一些共享组件（`organizations/` 目录）用于兼容性

---

### ✅ T5.2: 清理国际化文件

**执行的操作**:

1. **删除 organization.json 文件**
   ```bash
   rm public/locales/zh-CN/organization.json
   rm public/locales/en/organization.json
   ```

2. **清理 common.json 中的组织词条**
   ```json
   // ❌ 已删除
   - "organizationSettingsTabLabel": "组织"
   - "yourOrganizations": "您的组织"

   // ✅ 已更新
   - "dashboardTabDescription": "您在所有项目中的活动和性能概览"
   ```

3. **删除组织级别角色词条**
   ```json
   // ❌ 已删除整个 roles 对象
   {
     "roles": {
       "owner": { ... },
       "admin": { ... },
       "member": { ... }
     }
   }
   ```

**说明**:
- 删除的是**组织级别角色**（owner/admin/member）
- **用户级别角色**（user/admin）应该保留（见后续建议）

---

### ✅ T5.3: 验收结果

| 检查项 | 状态 |
|--------|------|
| UI 中无 "组织" 字样 | ✅ |
| 导航菜单简洁 | ✅ |
| i18n 文件已清理 | ✅ |
| 组织级别角色已删除 | ✅ |

---

## Phase 6: 数据库函数清理

### ✅ T6.1: 创建审计报告

**产出**: `docs/SupabaseGo/数据库函数审计报告.md`

**内容**:
- 列出了预期的组织相关 RPC 函数
- 提供了审计 SQL 查询
- 制定了删除计划
- 包含风险评估和回滚方案

---

### ✅ T6.2: 执行建议

**高优先级删除的函数**（如果存在）:

```sql
-- 组织 CRUD
DROP FUNCTION IF EXISTS get_user_organizations(uuid);
DROP FUNCTION IF EXISTS create_organization(text, uuid);
DROP FUNCTION IF EXISTS update_organization(uuid, text);
DROP FUNCTION IF EXISTS delete_organization(uuid);

-- 成员管理
DROP FUNCTION IF EXISTS get_organization_members(uuid);
DROP FUNCTION IF EXISTS invite_organization_member(uuid, text, text);
DROP FUNCTION IF EXISTS remove_organization_member(uuid, uuid);

-- 权限检查
DROP FUNCTION IF EXISTS check_organization_permission(uuid, uuid);
```

**执行步骤**:
1. ⚠️ 先在 Supabase Dashboard 创建数据库备份
2. ⚠️ 在 Preview 环境执行删除
3. ⚠️ 验证应用功能正常
4. ⚠️ 再考虑在 Production 执行

**状态**: 📝 审计报告已创建，实际删除操作**待手动执行**

---

## 📊 Phase 5-6 总结

### 完成的任务

| Phase | 任务 | 状态 |
|-------|------|------|
| Phase 5 | 扫描组织相关文案 | ✅ |
| Phase 5 | 清理 i18n 文件 | ✅ |
| Phase 5 | 删除组织 JSON 文件 | ✅ |
| Phase 5 | 清理 roles 词条 | ✅ |
| Phase 6 | 创建数据库审计报告 | ✅ |
| Phase 6 | 制定删除计划 | ✅ |

### 修改的文件

1. ✅ `public/locales/zh-CN/common.json` - 删除组织词条
2. ✅ `public/locales/en/common.json` - 删除组织词条
3. ❌ `public/locales/*/organization.json` - 已删除
4. ✅ `docs/SupabaseGo/数据库函数审计报告.md` - 已创建

---

## ⚠️ 重要澄清：角色系统

### 已删除：组织级别角色

这些角色用于**多组织场景**下的成员权限管理：

```typescript
// ❌ 已删除（Makerkit 模板的组织角色）
enum MembershipRole {
  Owner = 'owner',        // 组织所有者
  Admin = 'admin',        // 组织管理员
  Member = 'member',      // 组织普通成员
}
```

**删除原因**: AutoAds 已改为 User-centric 架构，无需组织成员角色

---

### 应保留：用户级别角色

这些角色用于**单用户应用**中的全局权限控制：

```typescript
// ✅ 应该保留（用户级别角色）
enum UserRole {
  User = 'user',          // 普通用户
  Admin = 'admin',        // 系统管理员
}
```

**保留原因**: 区分普通用户和管理员，用于功能权限控制

---

## 🔧 后续建议：实现用户级别角色

### 建议 1: 添加 UserRole 类型

**文件**: `src/lib/types/user-role.ts`

```typescript
/**
 * User-level roles for global permission control
 * NOT to be confused with organization membership roles (removed)
 */
enum UserRole {
  User = 'user',
  Admin = 'admin',
}

export default UserRole;
```

---

### 建议 2: 更新 UserData 接口

**文件**: `src/core/session/types/user-data.ts`

```typescript
import UserRole from '~/lib/types/user-role';

interface UserData {
  id: string;
  photoUrl?: string | null;
  displayName?: string | null;
  onboarded: boolean;
  role?: UserRole;  // ✅ 新增：用户角色
}

export default UserData;
```

---

### 建议 3: 数据库表结构

确保 `users` 表有 `role` 列：

```sql
-- 检查是否存在 role 列
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'role';

-- 如果不存在，添加列
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
CHECK (role IN ('user', 'admin'));

-- 创建索引（可选，提升查询性能）
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
```

---

### 建议 4: 权限检查 Hook

**文件**: `src/lib/user/hooks/use-user-role.ts`

```typescript
import { useMemo } from 'react';
import useUserSession from '~/core/hooks/use-user-session';
import UserRole from '~/lib/types/user-role';

export function useUserRole() {
  const session = useUserSession();
  const role = session?.data?.role ?? UserRole.User;

  const isAdmin = useMemo(() => {
    return role === UserRole.Admin;
  }, [role]);

  const isUser = useMemo(() => {
    return role === UserRole.User;
  }, [role]);

  return {
    role,
    isAdmin,
    isUser,
  };
}
```

---

### 建议 5: 在导航中使用角色权限

**文件**: `src/navigation.config.tsx`

```typescript
import UserRole from '~/lib/types/user-role';

type Permission = {
  subscriptionTiers?: SubscriptionTier[];
  featureFlag?: keyof typeof configuration.features;
  requiredRole?: UserRole;  // ✅ 新增：用户角色要求
};

// 示例：管理员专属菜单
{
  label: '用户管理',
  path: '/admin/users',
  Icon: createIconRenderer('users'),
  permission: {
    requiredRole: UserRole.Admin,  // 仅管理员可见
  },
}
```

---

### 建议 6: 更新权限检查逻辑

**文件**: `src/navigation.config.tsx`

```typescript
type PermissionContext = {
  subscriptionTier?: SubscriptionTier;
  featureFlags: Record<string, boolean>;
  userRole?: UserRole;  // ✅ 新增
};

function isPermitted(
  permission: Permission | undefined,
  context: PermissionContext
) {
  if (!permission) return true;

  // 检查功能开关
  if (permission.featureFlag && !context.featureFlags?.[permission.featureFlag]) {
    return false;
  }

  // ✅ 检查用户角色
  if (permission.requiredRole) {
    if (!context.userRole || context.userRole !== permission.requiredRole) {
      return false;
    }
  }

  // 检查订阅级别
  if (permission.subscriptionTiers && permission.subscriptionTiers.length > 0) {
    if (!context.subscriptionTier) return false;
    if (!permission.subscriptionTiers.includes(context.subscriptionTier)) return false;
  }

  return true;
}
```

---

### 建议 7: RLS 策略示例

```sql
-- 示例：仅管理员可以查看所有用户的数据
CREATE POLICY "admins_can_view_all_users"
ON users FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM users WHERE role = 'admin'
  )
  OR auth.uid() = id  -- 用户可以查看自己
);
```

---

## 📋 后续 Phase 清单

### Phase 7: 全面测试（进行中）

- ✅ 开发服务器已启动: `http://localhost:3000`
- ⏳ 待测试功能：
  - [ ] 用户登录
  - [ ] Dashboard 访问
  - [ ] Offers CRUD
  - [ ] Tasks 管理
  - [ ] 广告中心
  - [ ] Settings 修改

### Phase 8: 文档更新（待开始）

- [ ] 更新 README.md
- [ ] 更新 MustKnowV6.md
- [ ] 创建架构对比图

---

## 🎯 验收标准

### Phase 5 验收

- [x] UI 中无 "组织" 相关文案
- [x] i18n 文件已清理
- [x] 组织 JSON 文件已删除
- [x] 组织级别角色已删除

### Phase 6 验收

- [x] 数据库审计报告已创建
- [x] 删除计划已制定
- [x] 风险评估已完成
- [ ] 数据库函数已删除（待手动执行）

---

## 💡 关键决策记录

### 决策 1: 保留 organizations/ 组件目录

**原因**: 某些共享组件可能还在使用（如 SubscriptionStatusBadge）

**后续**: 可以逐步重构这些组件，移除组织依赖

### 决策 2: 数据库函数删除需谨慎

**原因**:
- 需要先在 Preview 环境验证
- 可能影响现有数据
- 可以先标记为废弃，不一定立即删除

**后续**: 手动连接 Supabase Dashboard 执行删除

### 决策 3: 用户角色系统需要补充

**原因**:
- 当前缺少用户级别角色支持
- 需要区分普通用户和管理员

**后续**: 按照建议 1-7 实现用户角色系统

---

**报告完成时间**: 2025-10-10 20:55

**总耗时**: Phase 5 + Phase 6 约 10 分钟

**下一步**: 启动功能测试（Phase 7）或实现用户角色系统
