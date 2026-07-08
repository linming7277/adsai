# AutoAds 前端迁移阶段5 - Admin 模块迁移

## 本阶段目标
- 将后台管理（Dashboard、用户管理、配置项等）从 Firebase Admin / Firestore 迁移到 Supabase + Go 微服务。
- 保留现有 Makerkit 管理界面与交互体验，仅替换数据源和认证方式。
- 移除组织/订阅等已弃用功能入口，聚焦用户级 SaaS 管控能力。

## 当前状态
- `/api/admin/dashboard`、`/api/admin/users` API 已封装 Supabase Service Key，支持基于管理员邮箱白名单的鉴权；页面端 `with-admin-props` / `isSuperAdmin` 也已改为读取 Supabase Session，无需 Firebase Admin。
- Admin 仪表盘（`/admin`）与用户列表、用户详情页（`/admin/users`, `/admin/users/[id]`）已切换至上述 API，前端通过 Supabase Access Token 调用，无需 Firebase Admin。
- 用户禁用 / 启用能力通过新的 `/api/admin/users/[id]/disable|reactivate` 路由封装 Supabase `ban_duration` 逻辑。
- 套餐、Token 统计 / 余额 / 规则、API Key、动态配置等控制面页面均迁移至 `/api/admin/**` 接口，并使用 Supabase 表持久化（schema 见 `docs/SupabaseGo/AdminDataSchema.sql`）。
- 用户列表分页与刷新逻辑迁移至 SWR，支持 Supabase `auth.admin.listUsers` 数据结构。
- 代登录（impersonate）已改为调用 Supabase Service Key 生成 Magic Link OTP，前端使用 `supabase.auth.verifyOtp` 完成会话切换并跳转 Dashboard。
- 新增 `admin_impersonation_events` 审计表，API 在每次代登录发起时记录管理员账号、目标账号、跳转地址和时间，便于运营审查。
- 移除 Firebase Session Cookie/Sign-In API 及相关前端 Hook，关闭旧版 Email/Phone/MFA 登录组件，后台仅保留 Supabase 认证入口。
- `_app.tsx` 已彻底替换 Supabase Provider，移除 Firebase AppShell/AppCheck/Analytics 与 UserSessionContext，`useUserSession` 直接返回 Supabase 用户。
- Admin 后台新增「代登录审计」页面，支持分页查看审计记录、刷新数据并从导航直接访问。

## 迁移计划
1. **权限体系**：通过 Supabase Auth 获取当前用户，结合环境变量 `ADMIN_EMAILS` 或角色字段判定管理员身份，替换原 Firebase Admin 校验。✅
2. **Dashboard 指标**：调用 Supabase Admin API 汇总用户总数、邮箱验证数量、24h 新增等基础指标；后续可结合 Go 服务扩展业务指标。
3. **用户管理**：`/admin/users` 页面改用 Supabase API 分页与搜索；实现禁用、删除、重置操作的 Supabase 版本，并根据需要调用 Go 服务封装。
4. **API 设计**：在 `/api/admin/**` 下统一代理 Supabase/Go 服务，封装错误处理与鉴权，记录敏感操作日志。
5. **UI 适配**：保留现有数据表与操作菜单，移除组织/订阅入口，补充状态提示与错误反馈。
6. **DevOps**：补充所需环境变量、Secret；更新 E2E 测试覆盖管理员登录、用户列表、禁用/删除流程。

## 待办事项
- [x] 迁移 `/api/admin/users/[id]/impersonate` 等剩余管理操作（当前仍使用 Firebase Custom Token）。
- [x] 清理残留 Firebase Admin / Firestore 调用，并更新管理员操作文档、环境变量与运维说明。
- [ ] 修复 Admin 相关 TypeScript 类型与测试用例（覆盖 Supabase 数据结构）。

> 阶段5 完成后，后台管理系统应完全摆脱 Firebase 依赖，并能在 Supabase/Go 架构下正常工作，为后续 SWR 重构与全面清理打下基础。
