# Supabase 多用户 SaaS 前端迁移路线图（2025-10-06）

## 1. 当前状态概览
- **认证体系**：已全部切换为 Supabase Auth；前端 `_app.tsx` 仅保留 `SupabaseAuthProvider` 与 SWR，去除 Firebase Session/Reactfire。
- **页面结构**：
  - *控制台*：`/dashboard`、`/offers`、`/tasks`、`/adscenter`、`/settings/profile|tokens|subscription` 保留单用户视角。
  - *管理后台*：`/admin` 模块使用 Supabase Access Token + Service Key，实现用户管理、代登录审计、配置管理。
  - *营销页*：主页、Pricing、FAQ、Docs、Blog 等保留原状。
- **遗留依赖**：
  - 服务端 API（如 `with-app-props`、Stripe Webhook、部分 Cypress/测试脚本）仍依赖 Firebase Admin / Firestore。
  - `npm run lint` / `npm run typecheck` 有历史告警，与迁移无直接冲突，但需后续收敛。

## 2. 目标架构
- **数据源**：Supabase Postgres 作为唯一用户数据存储，每张业务表带 `user_id` 并启用 RLS。
- **业务服务**：Go 微服务负责所有业务接口（Offers、Tasks、Tokens、AdsCenter、订阅、配置等），统一验证 Supabase JWT；运营后台继续通过相同接口维护数据。
- **前端职责**：以 Supabase Session 获取 Access Token，通过 `useApiRequest` 调用 Go API，不再直接访问 Service Key 或 Firestore。
- **功能定位**：组织/团队能力正式停用；SaaS 聚焦单账号多租户模式（一个账号 = 一个租户），但仍支持多名独立客户。

## 3. 实施路线与任务跟踪

### 阶段一：数据与权限准备
- [x] 在 Supabase 建立下表并配置 RLS：
  - `user_profiles`（镜像 Supabase Auth 扩展字段）
  - `offers`、`tasks`、`ads_connections`、`token_transactions` 等核心业务表
  - `admin_impersonation_events`（已存在，可补充索引/元数据）
- [x] 梳理 Firebase/Firestore 原有数据，确认需迁移的字段与记录（可仅迁活跃用户数据）。

- [x] 为所有服务添加 Supabase JWT 校验中间件（缓存 JWKS 或使用官方 SDK）。
- [x] 新增用户级 API：
  - `/api/v1/offers/**`、`/api/v1/tasks/**`、`/api/v1/tokens/**`、`/api/v1/adscenter/**`
  - 响应体须严格按 `user_id` 过滤。
  - (`2025-10-07` 更新) `/api/v1/offers` 已输出 Supabase 表结构，前端钩子完成初步对接；`/api/v1/adscenter/accounts`/`{id}`/`accounts/sync`/`accounts/disconnect`/`transfer-budget` 已切换至 Go 服务并读取 Supabase `ads_connections`，前端 `useAdsAccounts` 已改用新接口，当前统计/预算数据仍为占位（待补充真实管数）。
  - (`2025-10-08` 更新) Billing 服务新增 `/api/v1/tokens/balance|transactions|usage` 用户级接口并复用 Supabase JWT，从前端 Hooks 起始路径完成切换；遗留 `/api/v1/tokens/{userId}/usage` 现通过 `AdminOnly` 约束仅限后台查询。
  - (`2025-10-08` 更新2) Billing 服务补充 `/api/v1/tokens/{userId}/balance|transactions|usage` 管理端点，统一挂载 `AdminOnly`；Supabase 管理员访问会追加 `admin_impersonation_events` 审计记录，Service Key 访问仍保留但暂未写入审计（待增强）。
- [ ] 管理后台专属接口继续使用 Service Key，但在业务层记录审计日志。
  - (`2025-10-08` 更新) `/api/v1/tokens/{userId}/usage` 已加上 `AdminOnly` 校验，后续需补写 `admin_impersonation_events` 审计。

**验收标准**
- Supabase RLS 策略通过 `scripts/db/rls-smoke-test.sh` 验证（执行 `./scripts/db/rls-smoke-test.sh`，核心表必须启用 RLS 且存在策略）。`2025-10-07` 已使用 Session Pooler 连接串完成验证。
- Secret Manager 已同步 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`，并清点 Firebase 相关变量计划下线。
- Go 服务 JWT 中间件在预发布环境完成集成测试（返回 401/403 行为与规格一致）。

**Makerkit 复用建议**
- 参考 `makerkit/next-supabase-saas-kit/supabase/migrations` 的 RLS 写法与 `database.types.ts` 模板更新类型定义。
- 使用 `makerkit/next-supabase-saas-kit/src/core/supabase/get-supabase-client-keys.ts` 作为 environment key 管理参考，统一环境变量读取逻辑。

### 阶段二：Go 服务 API 发布
- [ ] 在各 Go 微服务中实现 `/api/v1/offers/**`、`/api/v1/tasks/**`、`/api/v1/tokens/**`、`/api/v1/adscenter/**` 等新接口，并接入 Supabase JWT 校验。
- [ ] 引入 Makerkit `packages/features/auth` 中的 MFA/OTP 流程作为中台可选模块，确保统一认证体验。
- [ ] 为 `admin` 专属接口补充 Service Key 访问控制及 `admin_impersonation_events` 审计写入。
  - (`2025-10-08` 更新) Billing 服务在 `/api/v1/tokens/{userId}/usage` 管理端点新增代查审计，自动向 `admin_impersonation_events` 写入管理员与目标用户的访问记录；Service Token 仍可访问但无用户态信息时跳过审计。
- [ ] 在 Cloud Build 流水线中加入新 API 的预部署 Smoke 测试脚本。

**验收标准**
- 新接口在预发布环境通过 Postman/`node scripts/tests/api-smoke.mjs` 全量校验，均按 `user_id` 过滤数据。
- Go 服务镜像按照 `docs/monorepo-build-best-practices.md` 建议完成构建且无 size 回退。
- 审计事件可在 Supabase `admin_impersonation_events` 表中按请求追踪。

**Makerkit 复用建议**
- 套用 `makerkit/next-supabase-saas-kit/src/core/hooks/use-api.ts` 的请求格式，确保前端调用契约先行统一。
- 参考 `makerkit/next-supabase-saas-kit-turbo/packages/features/auth/src` 对 OTP/MFA 的域逻辑实现，减少自研成本。

### 阶段三：前端迁移
- [ ] 将前端所有 `pages/api/**`、`lib/server/**` 中的 Firebase Admin 调用改为 Go API 或 Supabase SDK。
  - (`2025-10-08` 更新) `pages/api/user/index.tsx` 已替换为基于 Supabase Admin 的注销流程，移除 Firebase Admin 依赖；`mfa/*` 等路由仍待迁移。
  - (`2025-10-09` 更新) `pages/api/user/mfa/disable.ts` 改为使用 Supabase MFA API（签名用户上下文 + `auth.mfa.unenroll`），彻底清理 Firebase Admin；其他剩余 Firebase 中间件待后续下线。
  - (`2025-10-09` 更新2) 旧版 `/api/auth/google-signin` 路由已移除，前端统一通过 Supabase OAuth (`supabase.auth.signInWithOAuth`) 完成 Google 登录。
- [ ] 调整控制台页面数据源：Dashboard/Offers/Tasks/AdsCenter/Settings 统一通过 `useApiRequest` 请求新接口。
- [ ] 删除剩余 `lib/organizations/**`、`organizations` 相关引用，清理停用页面（已展示迁移公告可保留）。
- [ ] 更新 Cypress/测试脚本，改用 Supabase 测试账号；移除 Firebase 模拟器依赖。

**验收标准**
- `npm run dev` 在 Supabase 测试账号下手动验证核心页面无 4xx/5xx，关键动作（创建 Offer/Task、更新 Tokens）链路可走通。
- `npm run lint && npm run typecheck` 无新增告警；Cypress 冒烟套件 `cypress/e2e/supabase-smoke.cy.ts` 全部通过。
- 前端 `pages/api/**` 下无 Firebase 相关 import，`lib/server/**` 仅保留 Supabase 或 Go API 调用。

**Makerkit 复用建议**
- 复用 `makerkit/next-supabase-saas-kit/src/components/AuthChangeListener.tsx`、`ProfileDropdown.tsx` 等组件，缩短 Supabase Session 体验调整时间。
- 控制台导航可借鉴 `makerkit/next-supabase-saas-kit/src/app/dashboard` 布局或 `next-supabase-saas-kit-turbo/packages/ui/src/makerkit/sidebar.tsx` 的适配实现。
- Cypress 测试结构参考 `makerkit/next-supabase-saas-kit/cypress` 目录的登录/仪表盘脚本。

### 阶段四：测试与清理
- [ ] 修复 lint/typecheck 告警，确保 `npm run lint && npm run typecheck` 全量通过。
- [ ] 更新 README、部署说明、SupabaseGo 文档，补充新的 API 契约与表结构。
- [ ] 移除 `firebase`、`firebase-admin`、`reactfire` 等剩余依赖，清理相关脚本与 Secret。

**验收标准**
- CI 全流程（lint、typecheck、单测、Cypress 冒烟）均处于通过状态。
- README 与部署文档已同步 Supabase 环境变量清单，并在 `docs/SupabaseGo/` 发布迁移完成公告。
- `package.json` 与 lock 文件不再包含 Firebase 相关依赖，Secret Manager 清除废弃条目。

**Makerkit 复用建议**
- 文档部分可参考 `makerkit/next-supabase-saas-kit/documentation` 的结构与术语。
- 邮件与通知可对接 `makerkit/makerkit-emails-starter`，统一迁移完成后的用户通知格式。

- **权限校验**：Go 服务必须校验 Supabase JWT，并对返回数据执行 `user_id` 过滤；建议同时在 Supabase 表上开启 RLS，形成双重保障。
- **数据迁移**：若迁移旧数据，需评估字段映射与历史值的可用性；不推荐无差别搬运长期无效记录。
- **订阅/支付**：Stripe Webhook 目前仍依赖旧组织逻辑，切换到用户维度时需重新设计映射与通知流程。
- **沟通与文档**：组织功能停用需对外公告（帮助中心/FAQ），并在前端保持醒目提示。
- **回滚策略**：保留 Firebase API 只读模式与 API Gateway 开关，出现严重故障时可在 30 分钟内切回旧链路；迁移窗口需安排数据对账脚本（Supabase/Firebase 差异报告）。
- **监控预案**：在 Cloud Monitoring/Log Explorer 中新增 Supabase JWT 校验失败、Go API 4xx/5xx、RLS 策略拒绝等指标告警，设置迁移期间 24h 强化观察。

## 4.1 测试与验证矩阵
- **单元测试**：Go 服务新增接口需补充 `internal/handlers/*_test.go`，前端关键 hooks/组件在 `__tests__` 目录覆盖。
- **端到端**：Cypress 冒烟覆盖登录、仪表盘、Offer 创建、Token 充值等流程；必要时结合 Playwright（可参考 Makerkit Turbo 项目）。
- **负载与安全**：针对 JWT 验证与 RLS 策略执行压测（可使用 k6/Supabase 官方工具），验证并发情况下的性能与权限正确性。
- **可观测性**：确保 OpenTelemetry/Logging 中新增字段（user_id、trace_id）上线，便于迁移后快速定位问题。

## 5. 支持与后续
- 需要补充的输出：
  - Supabase 建表 & RLS SQL
  - Go 服务 JWT 中间件示例
  - 前端 API 封装与错误处理模板
- 推荐工作方式：以阶段划分对应看板/PR，完成一个阶段后再进入下一阶段，避免并行改动互相阻塞。

**环境变量清单（阶段一验收前必须对齐）**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `SUPABASE_API_URL`（供 Go 服务验证 JWKS 使用）
- `STRIPE_WEBHOOK_SECRET`（如需调整用户维度业务逻辑）

## 6. Makerkit 可复用资源
- `makerkit/next-supabase-saas-kit`：保留成熟的 Supabase 鉴权封装（`AuthChangeListener`、`SupabaseAuthProvider`、`useApiRequest`、多端客户端工厂）以及控制台/后台页面骨架，可直接映射到 Dashboard、Admin 模块的迁移实现。
- `makerkit/next-supabase-saas-kit-turbo`：Monorepo 结构下的 `packages/ui`、`packages/features/*` 拆分出 UI 组件、认证与通知流程，适合作为复用包移入现有 repo；其中的 `packages/supabase`、`packages/next` 提供 CSP、主题和服务器端工具的可复用实现。
- `makerkit/next-supabase-saas-kit-lite`：轻量版模板保留核心鉴权与 Tailwind 布局，适合作为营销页或简化控制台的阶段性迁移蓝本。
- `makerkit/next-supabase-saas-kit-plugins`：可选聊天、反馈、富文本等插件，为 Go 服务迁移完成后按需扩展前端交互提供现成组件。
- `makerkit/makerkit-emails-starter`：供 Go 后端触发的邮件通知统一使用的模板仓库，可直接对接 Supabase 事件与通知工作流。
- **注意事项**：上述模板仍包含组织/团队逻辑（如 `src/lib/organizations`），迁移时需按当前单账号模型裁剪；环境变量与 Secret 配置需与 SupabaseGo 项目约定对齐，避免混用 Firebase 依赖。

> 所有 TODO 项可作为任务看板同步推进，下游团队在执行时请参考上方阶段划分，确保顺序和责任边界清晰。
