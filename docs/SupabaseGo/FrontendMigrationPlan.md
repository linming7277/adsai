# AutoAds 前端迁移方案（Firebase → Supabase）

## 目标概述
- **架构原则**：遵循《docs/MarkerkitGo/MustKnowV4.md》，全面切换至 Supabase + Go 微服务，淘汰 Firebase/ReactFire。
- **用户模型**：多用户 SaaS（无租户概念），用户隔离和权限由 Supabase Auth 与 Go API 授权控制。
- **范围限定**：不迁移历史 Firebase 账号；保留核心控制台功能（仪表盘、Offers、Tokens、设置等），**移除组织/团队**相关模块。

## 阶段划分
| 阶段 | 说明 | 交付 | 预计耗时 |
| --- | --- | --- | --- |
| 0. 准备（本方案文档） | 明确迁移目标、范围、文档 | `FrontendMigrationPlan.md` | 0.5 周 |
| 1. 基线对比与拆分 | 分析 Makerkit 现有模块 vs Supabase 目标，列出替换清单 | 模块对照表、任务拆解 | 0.5 周 |
| 2. Supabase 基础设施 | 配置 Supabase 项目、Auth、DB、RLS、ENV | Supabase 项目 + SQL 初始化脚本 | 1 周 |
| 3. 认证流程迁移 | 登录/注册/忘记密码/回调页面改为 Supabase | 登录页面、Session 获取逻辑、`supabase-js` 集成 | 1.5 周 |
| 4. 控制台功能回迁 | 仪表盘、Offers、Tokens、设置中心等功能，剥离组织功能 | 对应页面/组件复位并改用 Supabase/Go API | 2~3 周 |
| 5. Admin 模块迁移 | 重构后台管理（用户管理、配置等）到 Supabase/Go | Admin API、Supabase Service Client、前端数据表 | 1~2 周 |
| 6. SWR/API 改造 | 标准化数据请求（SWR/React Query），替换 Firebase 调用 | API 客户端、Hook、类型定义更新 | 1 周 |
| 7. 清理与验收 | 移除 Firebase 依赖、完善文档、E2E 回归 | 构建通过、部署测试截图、迁移报告 | 1 周 |

> 注：可根据人力调整并行进行。如阶段 2 与 3 可部分重叠。

## 阶段细化

### 阶段 1：基线对比与拆分
1. **梳理现有模块**：列出 `/pages`、`/components`、`~/lib/*` 中与 Firebase 强耦合的文件。
2. **识别可复用模块**：Makerkit UI（Radix + Tailwind）、SWR 配置、`~/core/ui` 等保留；Firebase hooks/api 删除。
3. **制定替换清单**：逐页标注迁移目标（Supabase Auth、Go API）。
4. **确认删除项**：所有组织/团队页面（`/settings/organization`、`/admin/users` 等）标记为移除或禁用。

### 阶段 2：Supabase 基础设施
1. **创建 Supabase Project**：开启 Email + Google 登录，配置默认重定向 URL。
2. **定义数据库结构**：
   - `profiles`（用户基础信息，与 `auth.users` 1:1）。
   - `token_balances`、`token_transactions`、`offers` 等业务表。
   - 根据需要保留/扩展 Makerkit 原表，确保只存储当前需求。
3. **RLS 策略**：按 `auth.uid()` 控制行级访问，确保每个用户只访问自己的数据。
4. **配置存储/Edge Function**（如需）。
5. **生成 SQL 初始化脚本**与 `.env` 样板（`SUPABASE_URL`、`SUPABASE_ANON_KEY`、服务端 `SERVICE_ROLE_KEY`）。

### 阶段 3：认证流程迁移
1. **环境配置**：在 Next.js 中注入 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` 等。
2. **客户端集成**：编写 `lib/supabase/client.ts`，使用 `createBrowserClient` + Supabase 会话管理。
3. **自定义 AuthContext**：利用 Supabase session 订阅（`onAuthStateChange`）维护前端上下文。
4. **登录页面重写**：
   - 登录入口使用 `supabase.auth.signInWithOAuth`。
   - `/auth/callback` 处理 Supabase session 并跳转控制台。
   - `/auth/password-reset`、`/auth/error` 等页面改为 Supabase API。
5. **Session Cookie/SWR**（如需 SSR）：可选实现 `next/headers` + Supabase Auth Helpers，或前后端统一用 JWT 调 Supabase。

### 阶段 4：控制台功能回迁
按模块分批进行：
1. **仪表盘 (Dashboard)**：
   - Hook 改写：由 Supabase 表或 Go API 获取统计数据。
   - UI 保留 Makerkit 风格。
2. **Offers & Tasks**：
   - 提供 Supabase or Go API 接口，替换原 Firestore 查询。
   - 重新实现 Offer 列表、详情、AI 提示等视图。
3. **Token & Billing**：
   - Token 余额/交易改走 Go Billing 服务或 Supabase 表。
   - 暂不接入 Stripe 订阅，仅保留“联系咨询”弹窗等前端提示。
4. **设置中心 (Profile)**：
   - 个人信息读取 `profiles` 表。
   - 修改头像/昵称 → Supabase Storage/Edge Function，或直接调用 Go 服务。
   - 密码/邮箱调整 → Supabase Auth API。
5. **删除组织/团队**：
   - 移除 `settings/organization`、`admin/organizations` 等页面。
   - 删除组织相关 Hook/类型。

### 阶段 5：Admin 模块迁移
1. **权限校验**：
   - 采用 Supabase JWT + 管理员邮箱白名单替代 Firebase Admin 权限判定。
2. **Dashboard 指标**：
   - 通过 Supabase Admin API 获取用户总数、邮箱验证数量、新增用户等指标；后续可接入 Go 微服务补充业务指标。
3. **用户管理**：
   - `/admin/users` 调整为调用 Supabase API 列表/分页用户；实现禁用、删除、重置操作对应的 Supabase 流程。
4. **API 设计**：
   - 新增 `/api/admin/**` 路由代理 Supabase/Go 服务；统一错误处理与鉴权。
5. **UX 适配**：
   - 保留现有 Makerkit UI（表格、操作菜单等），替换数据源与交互文案。

### 阶段 6：SWR/API 改造
1. **统一 API 客户端**：
   - 建立 `lib/api/client.ts`，封装 fetch 请求、错误处理、Supabase token 传递。
2. **使用 SWR 或 React Query**：
   - 提供 `useXXX` Hook，缓存/刷新逻辑由 Supabase or Go API 提供。
3. **类型定义**：
   - 使用 TypeScript 定义 `Offer`, `TokenBalance`, `Task` 等结构。
   - 若 Supabase 表创建，考虑 `supabase-js` 类型生成器。

### 阶段 7：清理与验收
1. **移除 Firebase 依赖**：删除 `firebase`, `firebase-admin`, `reactfire` 等包；清理 `/core/firebase` 模块。
2. **更新文档**：
   - 项目 README、部署指南、环境变量说明。
   - 运维 Runbook：如何在 Supabase 查看用户、Token 余额等。
3. **测试回归**：
   - 单元测试（如有）。
   - E2E 测试流程：注册、登录、访问仪表盘、创建/查看 Offer、查看 Token、更新 Profile 等。
   - 手动验证多用户隔离。
4. **CI/CD**：更新 Cloud Build、Cloud Run 脚本，注入 Supabase 环境变量。
5. **验收输出**：构建日志、部署截图、修复说明。

---

## 任务清单（样例）
- [ ] 梳理待保留页面/组件清单。
- [ ] 创建 Supabase 项目并提交 SQL 初始化脚本。
- [ ] 整合 Supabase Auth（Google 登录、Session 管理）。
- [ ] 修改 `/auth` 页面为 Supabase 实现。
- [ ] 重构 Dashboard 数据访问逻辑。
- [ ] 重构 Offers/Tokens/Tasks 页面，替换为 Supabase/Go API。
- [ ] 移除组织/团队相关页面和类型。
- [ ] 迁移 Admin 模块（Dashboard、用户管理等）到 Supabase/Go API。
- [ ] 框架级 API 客户端、SWR Hook 更新。
- [ ] 删除 Firebase/ReactFire 依赖与模块，保留咨询弹窗替代 Stripe 流程。
- [ ] 更新 README / 部署指南，补充 E2E 测试。

## Ticket 拆分建议

> 说明：以下每条 Ticket 预期 1~3 个工作日可完成，按优先级从上到下执行；如需并行处理，可在冲刺规划时按阶段交叉。

| Ticket ID | 标题 / 目标 | 主要任务 | 依赖 | 验收标准 |
| --- | --- | --- | --- | --- |
| **T1** | 构建保留功能清单与差异分析 | 盘点 `/pages`、`/components`、`~/lib`；标记保留/移除；输出对照表 | 无 | 文档：保留功能清单、迁移差异报告 |
| **T2** | Supabase 项目初始化 | 创建项目，配置 Auth 与邮箱模板；编写数据库建表/索引/RLS 脚本；提交 `.sql` 和 `.env.example` | T1 | Supabase 项目可登录；SQL 初始化脚本通过 |
| **T3** | Supabase Auth 客户端集成 | 新建 `lib/supabase/client.ts`、Auth Context；替换 ReactFire 监听；更新 `_app.tsx` | T2 | 本地可通过 Supabase 登录/登出；无 Firebase/ReactFire 依赖 |
| **T4** | 登录/注册页面迁移 | 迁移 `/auth/sign-in`、`/auth/callback`、密码重置页面；处理错误态 | T3 | Supabase OAuth 流程跑通；登录回调跳转 Dashboard |
| **T5** | Dashboard 数据改造 | 将仪表盘相关 Hook 改为 Supabase/Go API；完成 UI 恢复 | T3 | Dashboard 可展示实时数据；通过基本 UI 测试 |
| **T6** | Offers 模块迁移 | 替换 Offer 列表/详情的 Firestore 调用；对接 Go Offers API；保留 AI 文案展示 | T3 | Offer 列表、详情可正常访问；创建/更新走通 |
| **T7** | Tokens & Billing 迁移 | Tokens 余额/交易改为 Supabase/Go Billing API；移除未用字段 | T3 | Token 页面数据正确；计费相关按钮可跳转 |
| **T8** | Admin 模块迁移 | Dashboard 指标、用户管理改为调用 Supabase/Go API；重写权限校验 | T3~T7 | `/admin` 页面加载正常，权限校验仅依赖 Supabase |
| **T9** | 设置中心复原 | Profile/密码/邮箱改用 Supabase Auth；移除组织页面；调整导航 | T3 | 设置页面加载/更新无报错；组织入口隐藏 |
| **T10** | API 客户端与 SWR 统一 | 重构 `lib/api/client.ts`、Hook；加入全局错误处理、Token 注入 | T5~T9（可并行） | 所有数据请求统一通过新客户端；构建无警告 |
| **T11** | Firebase 清理与依赖精简 | 删除 `/core/firebase`、ReactFire Hook；更新 `package.json`、ENV 文档 | T3~T10 | `npm ls firebase` 等返回空；构建通过 |
| **T12** | 文档与测试更新 | 更新 README、部署指南、迁移手册；编写/修复 E2E 脚本 | T4~T11 | 文档齐备；关键 E2E 流程通过 |

> 若需支持 Stripe 订阅，也可单独创建 **T12**：校准 Billing/Stripe 回调逻辑。


> 可根据项目进展拆分为多次 PR / Sprint。

### 近期进展（2025-10-06）
- 移除 Firebase Session API（`/api/session/sign-in|sign-out`）及相关 Session Cookie 管理逻辑，Supabase 成为唯一会话来源。
- 删除旧版 Firebase 登录组件（Email/Phone/OAuth 容器、MFA、Reauthentication 等），保留 Supabase 认证界面，显著降低 Reactfire 依赖面。
- `_app.tsx` 切换为纯 Supabase Provider，移除 Firebase AppShell/AppCheck/Analytics 与 UserSessionContext，`useUserSession` 直接返回 Supabase 用户。

## 参考资料
- `makerkit/next-supabase-saas-kit`、`next-supabase-saas-kit-lite`：Supabase + Next.js SaaS 模板。
- Supabase 文档：[https://supabase.com/docs](https://supabase.com/docs)
- Next.js + Supabase Auth 实践：[https://supabase.com/docs/guides/auth/server-side/nextjs](https://supabase.com/docs/guides/auth/server-side/nextjs)
