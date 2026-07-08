# AutoAds 前端深度优化方案（2025 年 1 月）

## 1. 背景与架构理解

- **整体架构**：Next.js App Router（`apps/frontend`）+ Supabase Auth 负责会话管理，`mainApi`/`consoleApi` 统一封装 Supabase Access Token 与错误处理（`apps/frontend/src/lib/api`）。Go 微服务（`services/offer`、`adscenter`、`billing`、`console` 等）运行在 Cloud Run，通过 `pkg/middleware.SupabaseAuth()` 验证 Supabase JWT 并访问 Postgres / Redis。
- **关键指引**：  
  - `docs/SupabaseGo/MustKnowV6.md` 定义了混合架构、环境变量、迁移策略、Secret 管理流程。  
  - `docs/monorepo-build-best-practices.md` 约束 Dockerfile 模板、Tarball 打包、CI 流程与 go.work 版本统一。  
- **前端现状**：用户侧与管理侧均已覆盖核心业务，但数据访问模式、错误提示、实时反馈和 UI 体验不统一，难以体现“一站式 AI SaaS” 的高阶质感。

## 2. 核心业务流概述（代码参照）

| 流程 | 前端入口 | Hook / API | 后端服务 |
| --- | --- | --- | --- |
| 用户登录 & 会话 | `apps/frontend/src/app/(auth)` | `useUserSession`、`TokenManager` | Supabase Auth |
| Offer 管理与评估 | `/dashboard/offers`、`~/lib/offers/hooks.ts` | `/api/v1/offers/*` | `services/offer/internal/handlers/http.go` |
| 任务流水 | `/dashboard/tasks`、`/manage/tasks` | `~/lib/tasks/hooks.ts`、`consoleApi.getTasks` | `services/console/internal/handlers/tasks.go` |
| Ads 中心 | `/dashboard/ads-center`、`~/lib/ads-center/hooks.ts` | `/api/v1/adscenter/*` | `services/adscenter/internal/api/router.go` |
| Token/Billing/订阅 | `/settings/tokens` | `~/lib/billing/hooks.ts` | `services/billing/internal/handlers` |
| 个人中心（Profile/MFA） | `/settings/profile` | Supabase Auth + `consoleApi` | Console + Supabase |
| 通知 & 导航 | `useNotifications`、`useNavigationConfig` | `/api/v1/console/notifications` / `navigation` | Console |
| 管理后台聚合 | `/manage` 系列 | `consoleApi` + Server Routes | `services/console/internal/handlers/*` |

## 3. 优化目标

1. **体验统一**：不同模块的加载、错误、空态、交互反馈保持一致，并能体现 AI SaaS 的实时性与智能化。
2. **性能与首屏**：通过 Server Components 预取、SWR 缓存与虚拟滚动，降低请求开销与首屏延迟。
3. **协同闭环**：串联 Offer → Ads → 任务 → Token → 监控的跨服务视角，提供清晰的业务洞察与操作指引。
4. **工程规范**：遵循 MustKnow 与 Monorepo 指南，降低后续迭代的复杂度。

## 4. 优化方向与行动

### 4.1 数据访问层统一
- 建立 `createSWRResource`（或 `useConsoleSWR`）工厂，替换管理端 `useEffect + useState` + `useAutoRefresh` 模式（涉及 `apps/frontend/src/app/manage/*`）。
- 在 Hook 层封装 `AbortSignal`、重试和幂等策略，统一处理跨模块的错误提示与 Loading 骨架。
- 将 `consoleApi` 拆分为领域 Client（如 `clients/console/OffersClient.ts`、`TasksClient.ts`），便于维护和 Tree-shaking。

### 4.2 服务端预取与首屏优化
- 在 `/dashboard`、`/dashboard/ads-center`、`/manage` 等 Server Component 中，通过 `serverApiRequest` 预拉取关键数据，并向 `SWRConfig` 注入 `fallback`，缩短首屏等待。
- 在 Next API Route（如 `/api/monitoring/overview`）中统一 Supabase Session 获取与异常处理，避免重复代码。

### 4.3 Offer & 任务链路增强
- `OffersTable` 支持虚拟滚动、分页元数据透传，展示乐观更新的进度反馈；串联评估任务状态，给出失败原因、重试 CTA。
- 在任务列表引入时间线视图（提交→执行→回写），以及任务详情页（包含相关 Offer / Ads / Token 消耗）。
- 优化 `useEvaluateOffer`、`useBatchEvaluateOffers` 的提示与费用说明。

### 4.4 Ads 中心提升
- `AccountsTable` 增加 Provider/MCC/状态筛选、虚拟滚动、自适应列宽，并在同步过程中展示实时进度、错误分类（调用 `useSyncAccount`、`useSyncAllAccounts`）。
- Account Detail 引入历史任务、策略推荐、AI 诊断摘要；增设沙箱账号引导与 OAuth 异常恢复流程。
- 将策略和执行报告组件标准化，支持导出、对比以及“下一步建议”。

### 4.5 Token / Billing 体验
- 统一 Token 余额、消费、交易页面的表单 & 错误提示；加入“用量预测、续费倒计时、AI 建议”。
- 在交易记录中标注来源服务/任务 ID，打通财务与运营视图；提供导出功能。

### 4.6 个人中心与安全
- Profile/MFA/密码/邮箱表单统一使用 `react-hook-form + zod`，提供 inline 成功/失败反馈，保留审计日志。
- Settings 页面构建全局搜索与快捷入口（Cmd+K），覆盖 Profile、Tokens、Subscription、Referral、API Key 等。
- 增设敏感操作二次确认、登录历史、设备管理等安全信息展示。

### 4.7 通知 & 导航
- `useNotifications` 支持分类、批量操作、AI Insight Feed；在重大事件（任务失败、Token 即将耗尽、Ads 同步异常）触发提示，并提供一键 Jump。
- `useNavigationConfig` 根据 Supabase 角色、Feature Flag 自动调整菜单；深色模式 & 响应式场景保持一致体验。

### 4.8 管理后台聚合 & 分析
- 搭建通用 KPI/趋势/Insight 组件库（例如 `components/admin/metrics`），让 Financial、Monitoring、Offer Quality、Token Analytics 等复用布局与视觉。
- 在 Admin Dashboard 展示跨域关联（广告花费 ↔ Offer 转化、Token 消耗 ↔ 任务成功率），支持 Drill-down 到具体用户/账号。
- Monitoring 页替换 30s 定时刷新为 SSE/WebSocket（Console `/monitoring`），配合渐进加载与故障恢复提示。

### 4.9 实时与协同能力
- 针对任务、Ads 同步、监控等引入 SSE/WebSocket 推送，减少轮询并提供进度、预计完成时间。
- 在运营视图纳入操作日志、责任人、AI 建议，形成闭环。
- 借助 Console Aggregation 返回的 `Errors` 字段，统一错误态组件，提供重试/日志链接/联系支持等选项。

### 4.10 设计系统 & 文档
- 输出 Design Token（颜色、阴影、动效曲线）、Storybook 示例；补齐骨架/空态/错误态组件库。
- 与 MustKnow 指南一致，在新增环境变量或跨服务操作时更新 `configs/environment/variables.json` 与文档。
- 在 CI 中添加样式与 Storybook 构建检查，防止 UI 回归。

### 4.11 构建 & 部署配合
- 所有改动遵守 Monorepo 构建最佳实践：统一 Docker 模板、Tarball 策略、go.work 版本。
- 针对新增模块补充构建脚本、部署文档（放置于 `deployments/` & `docs/SupabaseGo/`）。
- 引入 `scripts/check-dependencies.sh`、Dockerfile lint 等自动化工具，守护工程质量。

## 5. 子任务拆解（按阶段执行）

| 阶段 | 目标 | 子任务 |
| --- | --- | --- |
| **Phase 1：基础设施与数据层** | 统一数据访问体验 | 1. 新建 `lib/api/resources`，实现 `createSWRResource` 并迁移管理端页面。<br>2. 拆分 `consoleApi` 为多个 Client（Offers/Tasks/Monitoring/...）。<br>3. 编写错误/空态组件并在核心页面落地。 |
| **Phase 2：核心业务链路** | Offer ↔ 任务 ↔ Ads 闭环 | 1. 重构 `/dashboard/offers` 分页、虚拟滚动、状态提示。<br>2. 优化 `Tasks`（用户 & 管理端）时间线、详情、联动。<br>3. Ads Center：表格筛选、同步进度、账号详情视图。 |
| **Phase 3：个人中心 & Token** | 提升自服务能力 | 1. 统一 Profile/MFA/密码表单体验。<br>2. Tokens 页加入预测、提醒、AI 建议。<br>3. Settings 全局搜索 / 快捷入口。 |
| **Phase 4：管理后台与洞察** | 构建统一分析界面 | 1. 推出 KPI/趋势组件库，覆盖 Financial/Monitoring/Offer Quality 等。<br>2. Admin Dashboard 整合跨服务洞察，并支持 Drill-down。<br>3. 监控页迁移至 SSE/WebSocket，提供渐进式反馈。 |
| **Phase 5：实时协同 & 文档** | 打造高阶 AI SaaS 体验 | 1. 关键流程引入实时推送（任务、Ads、监控等）。<br>2. 实现 AI Insight Feed + 操作日志抽象。<br>3. 输出 Design Token、Storybook、操作指南，完善 CI 校验。 |

> 注：每个阶段完成后需按照 MustKnow 指南执行功能测试、更新进展文档、编译镜像，并维护 `configs/environment/variables.json` / Secret Manager。

## 6. 后续跟踪

- 建议在 `docs/FrontendOptimization/` 下增设进度文档（如 `OPTIMIZATION_TRACKING.md`），每项子任务完成后记录状态、责任人与上线验证情况。
- 与后端团队同步 SSE/WebSocket、错误结构调整、聚合接口扩展，确保前后端协同推进。
- 每两周复盘一次执行效果，结合性能指标（首屏时延、网络请求数、任务完成率等）评估优化价值，并调整优先级。

---  
**最终目标**：在保留现有 Supabase + Go 混合架构优势的同时，通过统一的数据访问层、实时反馈、AI 洞察和工程规范，打造出真正具备顶级体验的 AI SaaS 网站。  
