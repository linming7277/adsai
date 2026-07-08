# Phase 0: 单组织迁移现状分析报告

> 生成时间：2025-10-10
> 执行人：Claude Code
> 任务来源：docs/SupabaseGo/SingleOrgMigrationPlan.md

---

## 1. 数据库现状（P0-1 完成）

### 1.1 Supabase PostgreSQL 数据库

**连接信息**：
- Host: `aws-1-ap-northeast-1.pooler.supabase.com`
- Database: `postgres`
- Project Ref: `jzzvizacfyipzdyiqfzb`

**关键发现**：
- ❌ **不存在** `organizations` 表
- ❌ **不存在** `memberships` 表
- ❌ **不存在** `public.users` 表
- ✅ 存在 `auth.users` 表（2个用户）
- ✅ 存在 `public.user_profiles` 表（0条记录）

**现有 public schema 表**：
```
admin_audit_log, admin_impersonation_events, admin_recovery_codes
ads_connections, dashboard_risk_alerts, export_history
feature_flag_history, feature_flags
notification_broadcasts, notification_templates
offers, tasks
token_transactions, token_wallets
trigger_execution_logs, user_profiles
```

### 1.2 结论

**系统已经处于准单组织状态**：
- 数据库层面：没有多组织架构的表结构
- 触发器：使用简化版 `handle_new_user()`，不创建组织
- 迁移文件：`20250109_auto_create_user_simplified.sql` 无组织逻辑

---

## 2. 代码依赖梳理（P0-2 进行中）

### 2.1 前端路由结构

**存在大量 `[organization]` 动态路由**：
```
apps/frontend/src/app/dashboard/[organization]/
├── offers/
├── tasks/
├── ads-center/
└── settings/
    ├── organization/
    │   └── members/
    ├── subscription/
    ├── profile/
    └── tokens/
```

**总计**：26个子目录使用 `[organization]` 动态参数

### 2.2 组织相关代码分布

**关键文件**（12个文件，32处引用）：
1. `lib/organizations/actions.ts` - 组织操作 actions
   - `createNewOrganizationAction`
   - `transferOrganizationOwnershipAction`
   - `inviteMembersToOrganizationAction`
   - `deleteOrganizationAction`

2. `lib/server/organizations/ensure-default-organization.ts` - 核心逻辑
   - 检测 `configuration.features.enableMultiOrganization`
   - 读取 `DEFAULT_ORGANIZATION_UID` 环境变量
   - 自动分配用户到默认组织（单组织模式）

3. `lib/organizations/database/queries.ts` - 数据库查询
   - `getOrganizationByUid`
   - `getOrganizationsByUserId`

4. `database.types.ts` - Supabase RPC 类型定义
   - `create_new_organization`

### 2.3 配置现状

**apps/frontend/src/configuration.ts**：
```typescript
features: {
  enableMultiOrganization: getBoolean(
    process.env.NEXT_PUBLIC_ENABLE_MULTI_ORGANIZATION,
    false,  // ✅ 默认值已是 false
  ),
},
organization: {
  defaultOrganizationUid:
    process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_UID ?? '',
},
```

**关键环境变量**：
- ✅ `NEXT_PUBLIC_ENABLE_MULTI_ORGANIZATION` = false（默认）
- ❌ `NEXT_PUBLIC_DEFAULT_ORGANIZATION_UID` = 未配置
- ❌ `DEFAULT_ORGANIZATION_UID` = 未配置

---

## 3. 矛盾现象分析

### 3.1 核心矛盾

| 层面 | 状态 | 说明 |
|------|------|------|
| **数据库** | ✅ 已单组织化 | 无 organizations/memberships 表 |
| **前端路由** | ❌ 未单组织化 | 仍有 `[organization]` 动态路由 |
| **代码逻辑** | ⚠️ 混合状态 | 存在组织 RPC 调用但无对应表 |
| **配置** | ⚠️ 部分配置 | `enableMultiOrganization=false` 但无默认UID |

### 3.2 风险点

1. **RPC 调用失败风险**：
   - `create_new_organization` 存在于代码中
   - 但数据库无 `organizations` 表，RPC 必然失败
   - 影响文件：`actions.ts`, `ensure-default-organization.ts`

2. **路由不一致**：
   - 前端期望 `/dashboard/[organization]/offers`
   - 但无真实组织数据支撑

3. **用户体验问题**：
   - `ensure-default-organization.ts` 尝试读取 `DEFAULT_ORGANIZATION_UID`
   - 若未配置且无组织，会返回 `null`
   - 可能导致路由跳转失败

---

## 4. 下一步行动建议

### 4.1 调整任务优先级

**原计划**：Phase 0 → Phase 1（数据迁移） → Phase 2（前端路由）

**调整后**：
- ✅ **跳过 Phase 1 数据迁移**（已无需迁移）
- ⚡ **直接进入 Phase 2 前端路由重构**
- ⚡ **同步进行 P0-3 配置验证**

### 4.2 关键任务

#### P0-3: 配置验证（优先级：P0）
- [ ] 确认 `NEXT_PUBLIC_ENABLE_MULTI_ORGANIZATION=false` 生效
- [ ] 移除所有依赖 `create_new_organization` RPC 的代码
- [ ] 移除或Mock `getOrganizationByUid` 等查询函数

#### P0-4: 默认组织处理（优先级：P1）
两种方案选择：

**方案A**：完全移除组织概念
- 优点：彻底简化，无遗留代码
- 缺点：需大量重构路由和逻辑
- 工作量：3-5天

**方案B**：保留虚拟默认组织
- 创建固定的 `DEFAULT_ORGANIZATION_UID = "default"`
- `ensure-default-organization.ts` 直接返回固定值
- 优点：最小化改动，快速上线
- 缺点：保留冗余概念
- 工作量：1天

#### Phase 2: 前端路由重构（优先级：P0）
- [ ] 将 `/dashboard/[organization]` 改为 `/dashboard`
- [ ] 更新所有链接/跳转逻辑
- [ ] 添加 301 重定向兼容旧链接
- [ ] 更新 Hook 和 Context

---

## 5. 推荐方案

### 方案：快速单组织化（方案B + Phase 2 简化版）

**第一步**：配置虚拟默认组织（1小时）
```bash
# Secret Manager 添加
DEFAULT_ORGANIZATION_UID="00000000-0000-0000-0000-000000000001"
NEXT_PUBLIC_DEFAULT_ORGANIZATION_UID="00000000-0000-0000-0000-000000000001"
```

**第二步**：修改 `ensure-default-organization.ts`（30分钟）
```typescript
// 直接返回固定UUID，跳过数据库查询
if (singleOrganizationMode) {
  const defaultUid = getDefaultOrganizationUid();
  if (!defaultUid) {
    throw new Error('DEFAULT_ORGANIZATION_UID must be configured');
  }
  return defaultUid;  // 直接返回，无需查询
}
```

**第三步**：路由重定向（2小时）
```typescript
// middleware.ts
if (pathname.startsWith('/dashboard/')) {
  const parts = pathname.split('/');
  if (isUUID(parts[2])) {
    // 旧路由: /dashboard/{uuid}/offers
    const newPath = `/dashboard/${parts.slice(3).join('/')}`;
    return NextResponse.redirect(new URL(newPath, request.url));
  }
}
```

**第四步**：前端路由调整（渐进式，2-3天）
- 优先修复核心页面：offers, tasks, ads-center
- 保留 settings 页面路由暂不改动
- 通过重定向保证兼容性

**工作量**：0.5天配置 + 2天核心重构 = **2.5天**

---

## 6. 风险与回滚

### 6.1 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 路由重定向循环 | 中 | 高 | Preview环境充分测试 |
| 用户Session失效 | 低 | 中 | 保留organizationCookie兼容 |
| RPC调用失败 | 高 | 低 | 已禁用创建组织功能 |

### 6.2 回滚方案

1. 保留旧路由目录 `[organization]` 不删除
2. 通过 Feature Flag 控制新旧路由切换
3. 数据库无变更，回滚零风险

---

## 7. 验收标准

### 7.1 功能验收
- [ ] 用户登录后自动跳转到 `/dashboard`
- [ ] Offers、Tasks、AdsCenter 页面正常访问
- [ ] 设置页面无 "组织" 字样
- [ ] 旧链接自动重定向到新路由

### 7.2 技术验收
- [ ] 无 `create_new_organization` RPC 调用
- [ ] 无 404 错误
- [ ] 无 Console 报错
- [ ] Lighthouse 性能分数 > 90

---

## 附录

### A. 受影响文件清单

**需要修改**（高优先级）：
1. `apps/frontend/src/lib/server/organizations/ensure-default-organization.ts`
2. `apps/frontend/src/app/dashboard/page.tsx`
3. `apps/frontend/src/middleware.ts`（如存在）
4. `apps/frontend/src/components/MobileAppNavigation.tsx`

**需要重构**（中优先级）：
5. `apps/frontend/src/app/dashboard/[organization]/` 下所有页面
6. `apps/frontend/src/lib/organizations/actions.ts`

**可延后**（低优先级）：
7. `apps/frontend/src/app/manage/organizations/` 管理页面
8. 组织设置相关组件

### B. 环境变量清单

**需要在 Secret Manager 添加**：
```bash
DEFAULT_ORGANIZATION_UID=00000000-0000-0000-0000-000000000001
NEXT_PUBLIC_DEFAULT_ORGANIZATION_UID=00000000-0000-0000-0000-000000000001
NEXT_PUBLIC_ENABLE_MULTI_ORGANIZATION=false
```

**需要在 Cloud Run 服务更新**：
- frontend-preview
- frontend

---

**报告结束**
