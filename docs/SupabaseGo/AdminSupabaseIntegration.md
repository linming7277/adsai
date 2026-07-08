# Admin 模块 Supabase 集成说明（2025-10-10）

## 概览

- `/admin` 首页、`/admin/users`、`/admin/users/[id]` 与相关弹窗已切换为调用 Console 服务 (`/api/v1/console/**`)。
- 代登录、禁用、解禁、删除等敏感操作通过 `lib/admin/server.ts` 统一发起；前端不再持有 Service Key。
- 新增 `/admin/audit` 页面，用于查询 `admin_impersonation_events` 表记录，支持管理员 ID / 目标用户 ID 筛选与分页。

## 主要改动

### 1. API 客户端

- `apps/frontend/src/lib/server/api-client.ts`：封装 `serverApiRequest`，在服务端请求时自动附带 Supabase Access Token。
- `apps/frontend/src/lib/admin/`：提供 `fetchAdminUsers`、`fetchAdminUser`、`impersonateAdminUser`、`fetchImpersonationEvents` 等接口。

### 2. 页面迁移

| 页面 | 数据来源 | 说明 |
| --- | --- | --- |
| `/admin` | `/api/v1/console/stats` | 展示用户数、活跃订阅、Token 总量与近 24h 通知量，包含更新时间。 |
| `/admin/users` | `/api/v1/console/users` | 用户列表分页，展示邮箱、昵称、最后登录、封禁状态及快捷操作。 |
| `/admin/users/[id]` | `/api/v1/console/users/{id}` + `/api/v1/console/users/{id}/tokens` | 详情页整合 Supabase/Billing 数据，含 Token 余额与最近交易。 |
| `/admin/audit` | `/api/v1/console/audit/impersonation` | 代登录审计列表，可按管理员/目标用户筛选。 |

### 3. 操作与审计

- **禁用/解禁/删除**：调用 `banAdminUser` / `reactivateAdminUser` / `deleteAdminUser`，完成后 `revalidatePath('/admin/users')`。
- **代登录**：调用 `impersonateAdminUser` 生成 Magic Link 令牌，前端使用 `supabase.auth.verifyOtp` 设置新会话。
- **审计记录**：代登录事件写入 `admin_impersonation_events`，前端可在 `/admin/audit` 页面查看。

## 权限校验

- `AdminGuard` / `withAdminSession` 仍基于 Supabase 会话 + `isUserSuperAdmin`，无需额外环境变量。
- Console 服务继续通过 `ADMIN_EMAILS` 白名单校验管理员身份，并对 `/api/v1/console/**` 路由套用 `AdminOnly` 中间件。

## 后续事项

- [ ] 若需扩展组织级别的审计或搜索能力，可在 Console 服务内新增相应过滤参数。
- [ ] 补充 E2E 测试覆盖禁用/代登录流程（当前仅手动验证）。
- [ ] 与安全团队确认 `admin_impersonation_events` 的保留周期与脱敏策略。

