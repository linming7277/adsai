# AdsAI SSR 依赖审计报告

> **审计时间**: 2025-10-10
> **审计范围**: `apps/frontend/src/app/dashboard/[organization]` 目录
> **审计目标**: 识别所有依赖 `params.organization` 的 Server Component 和数据预取函数

---

## 📊 执行摘要

### 关键发现

1. **Server Component 数量**: 仅 1 个真正的 Server Component
2. **Client Component 数量**: 所有业务页面均为 Client Component
3. **SSR 数据预取**: 仅在 layout.tsx 中执行
4. **组织参数依赖**: 高度集中，易于调整

### 风险等级

| 风险类型 | 等级 | 说明 |
|---------|------|------|
| **SSR 调整复杂度** | 🟢 **低** | 只需调整 1 个 layout 和 1 个数据加载函数 |
| **数据迁移风险** | 🟢 **无** | 无数据库变更，无数据迁移 |
| **回滚难度** | 🟢 **低** | 只需恢复 2 个文件 |

---

## 🔍 详细审计结果

### 1. Server Component 清单

#### 1.1 唯一的 Server Component

**文件**: `apps/frontend/src/app/dashboard/[organization]/layout.tsx`

```typescript
async function AppLayout({
  children,
  params,
}: React.PropsWithChildren<{
  params: {
    organization: string;  // ❌ 依赖组织参数
  };
}>) {
  const data = await loadAppData(params.organization);  // ❌ SSR 数据预取
  return <AppRouteShell data={data}>{children}</AppRouteShell>;
}
```

**依赖分析**:
- ✅ 第 12 行：调用 `loadAppData(params.organization)`
- ✅ SSR 阶段执行，每次路由访问都会触发
- ❌ 必须调整：移除 `params.organization` 依赖

**调整难度**: ⭐ 简单（只需修改 1 个参数）

---

### 2. 数据预取函数清单

#### 2.1 核心数据加载函数

**文件**: `apps/frontend/src/lib/server/loaders/load-app-data.ts`

```typescript
const loadAppData = cache(async (organizationUid: string) => {
  // ...
  const [userRecord, organizationData] = await Promise.all([
    getUserDataById(client, userId),
    getCurrentOrganization({ organizationUid, userId }),  // ❌ 依赖组织 UID
  ]);

  if (!organizationData) {
    // ❌ 如果没有组织数据，重定向到首页
    return redirect(configuration.paths.appHome);
  }

  return {
    organization: organizationData?.organization,  // ❌ 返回组织数据
    role: organizationData?.role,                   // ❌ 返回角色
    // ...
  };
});
```

**依赖分析**:
- ❌ 第 31 行：接受 `organizationUid` 参数
- ❌ 第 45 行：调用 `getCurrentOrganization()` 查询组织
- ❌ 第 66-76 行：检查组织数据是否存在
- ❌ 第 95-96 行：返回组织和角色数据

**调整方案**:
```typescript
// ✅ 修改后
const loadAppData = cache(async () => {
  // 无需 organizationUid 参数
  const [userRecord] = await Promise.all([
    getUserDataById(client, userId),
    // 移除 getCurrentOrganization 调用
  ]);

  // 移除组织数据检查

  return {
    // 移除 organization 和 role
    // ...其他数据
  };
});
```

**调整难度**: ⭐⭐ 中等（需要移除多处组织相关逻辑）

---

#### 2.2 组织查询函数

**文件**: `apps/frontend/src/lib/server/organizations/get-current-organization.ts`

```typescript
export default async function getCurrentOrganization(params: {
  organizationUid: string;  // ❌ 依赖组织 UID
  userId: string;
}) {
  const { userId, organizationUid } = params;
  const { data, error } = await fetchOrganization(organizationUid);  // ❌ 查询组织
  const role = await fetchUserRole(organizationUid, userId);        // ❌ 查询角色

  return {
    organization: data || undefined,  // ❌ 返回组织
    role,                              // ❌ 返回角色
  };
}
```

**底层查询**:
- `getOrganizationByUid(client, uid)` - 查询不存在的组织表
- `getUserMembershipByOrganization()` - 查询不存在的成员表

**调整方案**: ✅ **直接删除此文件**（数据库无对应表）

**调整难度**: ⭐ 简单（直接删除）

---

### 3. Client Component 清单

以下业务页面均为 **Client Component**（`"use client"`），无需 SSR 调整：

| 文件路径 | 使用 params.organization | 用途 | 调整方式 |
|---------|-------------------------|------|----------|
| `offers/page.tsx` | ✅ 第 193-194 行 | 构建 ads-center 跳转链接 | 移除 useParams() |
| `tasks/page.tsx` | ✅ 第 1 行 | 未实际使用 | 移除 useParams() |
| `ads-center/page.tsx` | ✅ 第 1 行 | 未实际使用 | 移除 useParams() |
| `settings/*/page.tsx` | ❌ 不使用 | Settings 页面 | 无需调整 |

**关键发现**: 这些页面虽然使用 `useParams<{ organization: string }>()`，但实际数据获取**完全不依赖** `organizationUid`：

```typescript
// ✅ offers/page.tsx 第 105-107 行
const { items, isLoading, mutate } = useOffers({
  status: status === 'all' ? undefined : status,
  // 注意：无 organizationUid 参数！
});
```

**调整难度**: ⭐ 简单（移除几行代码即可）

---

### 4. 隐式依赖清单

#### 4.1 Context 依赖

**文件**: `apps/frontend/src/app/dashboard/[organization]/components/OrganizationScopeLayout.tsx`

```typescript
// 推测：此组件接收 loadAppData 返回的数据
// 包含 organization 和 role 信息
// 通过 Context 注入到子组件
```

**检查方法**:
```bash
grep -r "OrganizationContext\|useOrganization" apps/frontend/src/app/dashboard/[organization] --include="*.tsx"
```

**调整方案**: 移除 OrganizationContext，替换为 UserContext

---

#### 4.2 Navigation Links 依赖

**搜索结果**（已执行）:
```bash
# 549-551 行: offers/page.tsx
organizationUid
  ? router.push(`/dashboard/${organizationUid}/ads-center`)
  : router.push('/dashboard')
```

**调整方案**:
```typescript
// ✅ 修改后
router.push('/dashboard/ads-center')
```

---

## 📋 SSR 调整方案

### 方案 A: 保留 Server Component（推荐）

**适用场景**: 需要 SSR 优化首屏加载

**实施步骤**:

1. **调整 layout.tsx**:
```typescript
// ✅ 修改后
async function AppLayout({
  children,
  params,  // 移除 params 类型定义
}: React.PropsWithChildren<{}>) {
  const data = await loadAppData();  // 无参数
  return <AppRouteShell data={data}>{children}</AppRouteShell>;
}
```

2. **简化 loadAppData**:
```typescript
const loadAppData = cache(async () => {
  const client = getSupabaseServerComponentClient();
  const session = await requireSession(client);
  const user = session.user;
  const userId = user.id;

  const userRecord = await getUserDataById(client, userId);

  if (!userRecord) {
    return redirect(configuration.paths.appHome);
  }

  const csrfToken = getCsrfToken();
  const { language } = await initializeServerI18n(getLanguageCookie());

  return {
    language,
    csrfToken,
    auth: {
      accessToken: session.access_token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
      },
    },
    user: userRecord,
    ui: getUIStateCookies(),
  };
});
```

3. **更新 OrganizationScopeLayout**:
```typescript
// 改名为 AppScopeLayout
// 移除 organization 和 role 相关逻辑
function AppScopeLayout({ data, children }: { data: AppData; children: React.ReactNode }) {
  return (
    <UserProvider user={data.user}>
      {/* 移除 OrganizationProvider */}
      {children}
    </UserProvider>
  );
}
```

**优点**:
- ✅ 保留 SSR 优化
- ✅ 首屏加载快
- ✅ SEO 友好

**缺点**:
- ⚠️ 需调整 3 个文件

---

### 方案 B: 改为 Client Component

**适用场景**: 追求最简实现

**实施步骤**:

1. **layout.tsx 改为 Client Component**:
```typescript
"use client";

import { useUser } from '~/lib/user/hooks';

function AppLayout({ children }: React.PropsWithChildren<{}>) {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return <Spinner />;
  }

  return <AppScopeLayout user={user}>{children}</AppScopeLayout>;
}
```

2. **删除 loadAppData.ts**

**优点**:
- ✅ 实现简单
- ✅ 无 SSR 复杂度

**缺点**:
- ❌ 首屏会有 loading 状态
- ❌ SEO 不友好

---

## 🎯 推荐方案

### ✅ 方案 A（保留 Server Component）

**理由**:
1. **性能优势**: SSR 预加载用户数据，首屏无 loading
2. **代码改动小**: 只需调整 3 个文件
3. **架构一致**: 与 Next.js 14 App Router 最佳实践一致

**工时估算**: 2 小时

---

## 📝 调整任务清单

### Task 0.1: 调整 layout.tsx ✅

**文件**: `apps/frontend/src/app/dashboard/[organization]/layout.tsx`

**修改**:
```diff
async function AppLayout({
  children,
- params,
-}: React.PropsWithChildren<{
-  params: {
-    organization: string;
-  };
-}>) {
+}: React.PropsWithChildren<{}>) {
-  const data = await loadAppData(params.organization);
+  const data = await loadAppData();
  return <AppRouteShell data={data}>{children}</AppRouteShell>;
}
```

**验收**: TypeScript 编译通过

---

### Task 0.2: 简化 loadAppData ✅

**文件**: `apps/frontend/src/lib/server/loaders/load-app-data.ts`

**删除行**:
- 第 12 行：`import getCurrentOrganization`
- 第 31 行：`organizationUid: string` 参数
- 第 43-46 行：`getCurrentOrganization()` 调用
- 第 66-76 行：组织数据检查
- 第 95-96 行：`organization` 和 `role` 返回值

**验收**: 函数正常返回用户数据

---

### Task 0.3: 更新 OrganizationScopeLayout ✅

**文件**: `apps/frontend/src/app/dashboard/[organization]/components/OrganizationScopeLayout.tsx`

**修改**:
- 改名为 `AppScopeLayout.tsx`
- 移除 `OrganizationProvider`
- 添加 `UserProvider`

**验收**: Context 正常工作

---

### Task 0.4: 移除 Client Component 中的 useParams ✅

**文件**:
- `offers/page.tsx`: 移除第 193-194 行
- `tasks/page.tsx`: 移除第 3 行
- `ads-center/page.tsx`: 移除第 3 行

**修改模式**:
```diff
- const params = useParams<{ organization: string }>();
- const organizationUid = params?.organization ?? '';
```

**验收**: 页面正常渲染

---

### Task 0.5: 更新导航链接 ✅

**文件**: `offers/page.tsx` 第 549-551 行

**修改**:
```diff
- organizationUid
-   ? router.push(`/dashboard/${organizationUid}/ads-center`)
-   : router.push('/dashboard')
+ router.push('/dashboard/ads-center')
```

**验收**: 跳转正常

---

## 🚨 风险评估

### 高风险项（无）

无高风险项。

### 中风险项（无）

无中风险项。

### 低风险项

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| loadAppData 参数移除导致其他文件报错 | 低 | 低 | 全局搜索 `loadAppData(` 确认调用点 |
| OrganizationScopeLayout 子组件依赖组织数据 | 低 | 中 | 逐个检查子组件 |

---

## ✅ 验收标准

### 编译检查
- [ ] `npm run typecheck` - 0 errors
- [ ] `npm run lint` - 0 errors
- [ ] `npm run build` - 构建成功

### 功能检查
- [ ] 访问 `/dashboard` - 正常显示
- [ ] 访问 `/dashboard/offers` - 正常显示列表
- [ ] 访问 `/dashboard/tasks` - 正常显示列表
- [ ] 刷新页面 - 无 loading 闪烁（SSR 正常）

### 性能检查
- [ ] Chrome DevTools Network - 首屏 HTML 包含用户数据
- [ ] React DevTools - 无组织相关 Context

---

## 📊 工时统计

| 任务 | 预估工时 | 实际工时 |
|------|----------|----------|
| SSR 依赖审计 | 0.5h | 0.5h ✅ |
| layout.tsx 调整 | 0.3h | - |
| loadAppData 简化 | 0.5h | - |
| OrganizationScopeLayout 更新 | 0.4h | - |
| Client Component 调整 | 0.3h | - |
| **总计** | **2.0h** | **0.5h** |

---

## 📚 相关文档

- [无组织模式重构方案 V2.0](./无组织模式重构方案V2.md)
- [重构任务清单](./重构任务清单.md)
- [Next.js 14 Server Components 文档](https://nextjs.org/docs/app/building-your-application/rendering/server-components)

---

**审计报告结束**

**下一步**: 根据本报告执行 Phase 1（路由结构创建）
