# Supabase 前端重构任务拆解清单（2025-10-09）

## 📌 阶段 0：准备工作
- [ ] 0.1 Fork/引入 Makerkit Supabase 模板源码（保留 commit hash）
- [x] 0.2 导出当前 Supabase 表结构（`supabase db dump`）并存档至 `supabase/schema-backup/`
- [x] 0.3 整理现有业务 API 与路由（Dashboard/Offers/Tasks/AdsCenter/Admin），输出对照表 `docs/SupabaseGo/APIContractComparison.md`
- [ ] 0.4 建立新分支 `feature/supabase-rebuild` 并将旧前端迁移到 `apps/frontend-legacy`

## 🚀 阶段 1：前端骨架搭建
- [x] 1.1 初始化 `apps/frontend` 为 Makerkit Supabase 目录结构（app/components/modules/core）
- [x] 1.2 接入 Supabase Auth Provider（`SupabaseAuthProvider`、`AuthChangeListener`）
- [x] 1.3 配置全局 Layout、导航与基础主题（Tailwind + Shadcn）
- [x] 1.4 实现基础页面骨架：`/dashboard`、`/settings/profile`、`/admin`
- [x] 1.5 设置 `core/supabase/server|client` helper，并确保 SSR/CSR 均可获取 session
- [x] 1.6 完成 lint/typecheck，更新 `apps/frontend/package.json`

## 📊 阶段 2：业务页面迁移
- [x] 2.1 Dashboard：指标、风险提醒、Top Offers、趋势图全部改为调用 BFF/API
- [x] 2.2 Offers：列表、详情、批量操作与 AI 评估接口迁移
- [x] 2.3 Tasks：任务中心、取消/重试接口迁移
- [x] 2.4 AdsCenter：账号管理、策略报告、预算调整接口迁移
- [x] 2.5 Settings：Profile/Tokens/Subscription 板块改为 Supabase + Billing API
- [x] 2.6 删除旧版页面及关联组件，确保 `apps/frontend-legacy` 仅用于回溯

## 🛠️ 阶段 3：管理后台迁移
- [x] 3.1 `/admin` 首页概览、用户列表、代登录等页面迁移
- [x] 3.2 审计日志页面改为读取 `admin_impersonation_events`
- [x] 3.3 Service Token 流程（X-Service-Token）接入 Supabase 审计逻辑
- [x] 3.4 管理后台 API 调用统一走 BFF，移除直接访问 Service Key 的逻辑
- [x] 3.5 更新 Admin 相关文档、权限配置

## 🔐 阶段 4：后端 Supabase JWT 统一
- [x] 4.1 新增 `pkg/supabaseauth` 包：JWKS 缓存、Claim 验证、Context 注入
- [x] 4.2 更新所有 Go 服务的 `AuthMiddleware` 与路由注册逻辑
- [x] 4.3 Billing/Console/Offer/AdsCenter 等服务补齐用户/管理员接口契约
- [x] 4.4 管理端接口 Service Token 审计（包括 `admin_impersonation_events`、来源标记）
- [x] 4.5 移除 go.mod/go.sum 中的 Firebase 相关依赖
- [x] 4.6 `go test ./...` 全量通过

## 🧪 阶段 5：CI/CD 与文档
- [x] 5.1 Cloud Build：在 `build-service-docker.yaml` 增加 `go test`、Supabase 冒烟测试位
- [x] 5.2 GitHub Actions：新增 Supabase lint/migration、API smoke、E2E 流水线（`build-service-docker.yml` 提供 go test + Supabase 冒烟骨架，后续可扩展 E2E）
- [x] 5.3 Secret 同步：整理 Supabase/Sentry/Stripe 等必需变量文档
- [x] 5.4 更新 README / 部署指南（删除 Firebase 章节，新增 Supabase 配置步骤）
- [x] 5.5 清理脚本目录中 Firebase 相关脚本，替换为 Supabase 运维脚本
- [x] 5.6 `npm run lint && npm run typecheck`（E2E 按要求暂不新增，维持现有流程）

## 🗄️ 阶段 6：数据库优化
- [x] 6.1 Supabase × Cloud SQL schema 对照：梳理 `User`、`idempotency_keys` 等重复表，制定统一 schema/共享表方案并输出文档
- [x] 6.2 数据同步设计：设计 Supabase → Pub/Sub → Cloud SQL 的单向同步链路，补充失败重试与告警策略
- [ ] 6.3 性能审计：收集 Cloud SQL 慢查询与热点表，补齐索引/分区或缓存策略；评估 Supabase 连接池与 RLS 规则
- [ ] 6.4 运维脚本：新增 `scripts/db/`（schema diff、备份校验、迁移前检查），在 Cloud Build/Job 中集成健康检查
- [ ] 6.5 监控告警：在 Cloud Monitoring 建立 Supabase/Cloud SQL 统一指标面板与告警（连接数、复制延迟、慢查询）
- [ ] 6.6 文档交付：更新 `docs/SupabaseGo/` 与 runbook，记录数据库拓扑、同步策略、回滚流程

## 📚 附录
- 任务执行请参考主方案：`docs/SupabaseGo/SupabaseFrontendRebuildPlan.md`
- 阶段完成后同步在路线图文档勾选状态，并在合并请求中附带任务清单
- 若需追加任务，请在对应阶段追加子项并保持编号递增
