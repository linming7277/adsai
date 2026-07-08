# Supabase 前端重构进度追踪

> 对应任务清单：`docs/SupabaseGo/SupabaseFrontendRebuildTasks.md`

- [ ] 0.1 Fork/引入 Makerkit Supabase 模板源码（保留 commit hash） — *尚未在本地记录 Fork 信息，后续补充*
- [x] 0.2 导出当前 Supabase 表结构 — *已通过 PgBouncer IPv4 入口导出 schema 至 `supabase/schema-backup/`*
- [x] 0.3 业务 API 对照表 (`docs/SupabaseGo/APIContractComparison.md`) — *已补充 Dashboard/Offers/Tasks/AdsCenter/Billing 响应示例*
- [x] 0.4 迁移旧前端至 `apps/frontend-legacy`，建立新 `apps/frontend` 目录

- [x] 1.1 拷贝 Makerkit `src/`、`public/` 及基础配置到 `apps/frontend`
- [x] 1.2 接入 Supabase Auth Provider（`SupabaseAuthProvider`、`AuthChangeListener`）
- [x] 1.3 配置全局 Layout、导航、主题（侧边栏、站点主题已切换 AdsAI 品牌）
- [x] 1.4 实现基础页面骨架 `/dashboard`、`/settings/profile`、`/admin`（Dashboard 子模块占位、Admin 占位就绪）
- [x] 1.5 统一 `core/supabase/server|client` helper（Server/Route/Middleware 动态客户端已统一封装）
- [x] 1.6 lint/typecheck 通过 — *`npm run lint && npm run typecheck` 均已返回通过*

## 阶段 2：业务页面迁移
- [x] 2.1 Dashboard：指标、风险提醒、Top Offers、趋势图改为调用 BFF/API — *已新增统一 API 客户端与 SWR hooks，Dashboard 页面串联 `/dashboard/*` 数据流并接入 Supabase Access Token*
- [x] 2.2 Offers：列表、详情、批量操作与 AI 评估接口迁移 — *实现 `apps/frontend/src/lib/offers` 数据层，Offers 页面集成创建/删除/评估/批量操作与详情抽屉，全面替换旧占位视图*
- [x] 2.3 Tasks：任务中心、取消/重试接口迁移 — *新增 `lib/tasks` 数据层与 Token 概览组件，任务列表支持筛选、取消、重试与进度展示*
- [x] 2.4 AdsCenter：账号管理、策略报告、预算调整接口迁移 — *`ads-center` 页面接入 `lib/ads-center` 数据层，完成账号列表、详情对话框、OAuth 授权、同步/断连、策略模板与执行审计可视化*
- [x] 2.5 Settings：Profile/Tokens/Subscription 板块改为 Supabase + Billing API — *新增 `settings/tokens` 页面展示 Token 余额、消费分布与交易列表，订阅页沿用 Supabase 组织数据并补充 Billing 订阅摘要*
- [x] 2.6 删除旧版页面及关联组件，确保 `apps/frontend-legacy` 仅用于回溯 — *新前端全面启用 Supabase 架构，移除 AdsCenter 占位，旧实现保留在 `apps/frontend-legacy` 备份目录*

## 阶段 3：管理后台迁移
- [x] 3.1 `/admin` 首页概览、用户列表、代登录等页面迁移 — *Dashboard 指标改为读取 `/api/v1/console/stats`，用户列表/详情/操作统一走 Console BFF，移除 `auth.admin` 直接调用*
- [x] 3.2 审计日志页面改为读取 `admin_impersonation_events` — *新增 `/admin/audit` 页面，后端暴露 `/api/v1/console/audit/impersonation`，支持按管理员/目标用户筛选与分页*
- [x] 3.3 Service Token 流程接入 Supabase 审计 — *禁用/解禁/删除/代登录等操作改为调用 Console BFF，触发 Billing/Console 内 `admin_impersonation_events` 审计记录*
- [x] 3.4 管理后台 API 调用统一走 BFF — *移除所有 Supabase Service Key 依赖（含 server actions、Modal pages），统一透过 `lib/admin` 的 `serverApiRequest`*
- [x] 3.5 更新 Admin 文档/权限配置 — *新增 `docs/SupabaseGo/AdminSupabaseIntegration.md`，记录 BFF 接口和审计页面使用说明*

## 阶段 4：后端 Supabase JWT 统一
- [x] 4.1 新增 `pkg/supabaseauth` 包 — *封装 JWKS 缓存、Claims 解析与上下文注入，供所有 Go 服务复用*
- [x] 4.2 更新 Go 服务 AuthMiddleware — *`pkg/middleware/supabase.go` 改为使用新包，统一在请求上下文写入 Supabase Claims*
- [x] 4.3 核心服务接口契约对齐 — *Console/Billing 等接口仅依赖 Supabase Claims，前端通过 `lib/admin` 消费*
- [x] 4.4 管理端 Service Token 审计增强 — *Console 新增 `/api/v1/console/audit/impersonation`，并提供前端审计列表*
- [x] 4.5 移除剩余 Firebase 依赖 — *Siterank 事件载荷改为携带 Supabase Access Token，前端 API 客户端同步去除 Firebase 分支，Go 模块删去 firebase/google Firestore 依赖*
- [x] 4.6 `go test ./...` 全量通过 — *逐个模块执行 `go test ./...`（根据 go.work 列表），已清理 console / adscenter / offer 遗留编译错误；当前仓库无 Go 测试用例但编译全部通过*

- [x] 5.1 Cloud Build：`deployments/cloudbuild/build-service-docker.yaml` 已新增 Supabase 冒烟步骤，可通过 `_SUPABASE_*` substitutions 绑定 Secret Manager，默认执行 `go test ./...` + `scripts/test-supabase-connection.sh`
- [x] 5.2 GitHub Actions：新增 `.github/workflows/build-service-docker.yml`，在 PR 自动检测受影响服务并执行 `go test`，若配置 Supabase Secrets 会附带冒烟检查（后续可追加 API/E2E 模块）
- [x] 5.3 Secret 同步：`docs/SupabaseGo/SupabaseConnectionGuide.md` 补充 CI/CD 所需环境变量映射，指导 GitHub Actions 与 Cloud Build 的凭证注入
- [x] 5.4 README / 部署指南更新 — *README 与 `docs/deployment/CI-CD.md` 已移除 Firebase 章节，补充 Supabase 配置与新工作流说明*
- [x] 5.5 脚本清理 — *删除 `scripts/firebase/mint-id-token.js`，保留 `scripts/test-supabase-connection.sh` 作为默认运维脚本*
- [x] 5.6 Lint + Typecheck — *新前端 `npm run lint && npm run typecheck` 已通过；根据要求不额外新增 E2E（保留手动脚本）*

- [x] 6.1 Supabase × Cloud SQL schema 对照 — *新增 `docs/SupabaseGo/DatabaseSchemaComparison_20251009.md` 梳理核心表映射与迁移策略*
- [x] 6.2 数据同步设计 — *`docs/SupabaseGo/SupabaseDataSyncPlan.md` 提供 Supabase CDC → Pub/Sub → Cloud SQL 的架构草案与监控/回补方案*
- [ ] 6.3 完成 Cloud SQL 慢查询/索引审计与 Supabase 连接池、RLS 优化建议
- [ ] 6.4 编写 `scripts/db/` 运维脚本并集成到 Cloud Build/迁移流程
- [ ] 6.5 搭建数据库监控告警（Cloud Monitoring + PagerDuty/Slack）
- [ ] 6.6 更新数据库拓扑与回滚流程文档

## 阶段 7：i18n 差异化完善
- [x] 7.1 设置快捷命令面板多语言化 — *新增 `settings` 命名空间，支持标题/描述/关键词级搜索 i18n*
- [x] 7.2 导航侧栏文案国际化 — *导航配置统一使用 `navigation` 命名空间，支持 API/Fallback 场景*
- [x] 7.3 Style Guide 样式手册页面 i18n — *色板、排版、组件示例、Icon Registry 均切换翻译键并补充中英资源*
- [x] 7.4 Subscription 套餐规划页面 i18n — *`Plans.tsx` 全面使用翻译键，含推荐卡片、模拟滑块、对比表与当前套餐摘要*
- [x] 7.5 管理后台通知中心 i18n — *通知模板/广播页接入 `admin` 命名空间，Toast、空态、弹窗与表格字段均实现双语*
- [ ] 7.6 Marketing 站点静态页（Landing、Careers、Story 等）文案国际化
- [ ] 7.7 剩余 UI 组件/Stories 中文案清理与翻译补充

## 备注
- Makerkit 仓库地址需确认（`https://github.com/makerkit/next-supabase-saas-kit` 返回 404）。
- Supabase schema dump 已完成，推荐通过 PgBouncer (`aws-1-ap-northeast-1.pooler.supabase.com`) 导出；保留 CLI 方式作为备选。
- 前端已新增 `SupabaseAuthProvider`、导航中文化；AdsCenter/Offers/Tasks/Settings 以及 Admin 关键页面已全面切换至新数据流。
- Marketing 站点（Blog/Docs）改为占位页，后续根据内容栈规划再接入 Contentlayer。
