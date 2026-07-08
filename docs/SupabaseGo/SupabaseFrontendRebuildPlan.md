# Supabase 前端整体重构方案（2025-10-09）

## 1. 重构目标
- **完全淘汰 Firebase 依赖**：认证、MFA、Session、AppCheck、Admin SDK 全部下线。
- **统一 Makerkit Supabase 架构**：以 `makerkit/next-supabase-saas-kit` 为基线，搭建可复用的多租户 SaaS 框架。
- **接口契约前置**：所有 BFF/API 调用改为走 Go 服务或 Supabase RPC，避免前端直接操作 Service Key。
- **部署与测试一体化**：在 Cloud Build/CI 中新增 Supabase 环境变量同步、冒烟测试与 E2E 流水线。

## 2. 重构范围
| 范畴 | 说明 |
| --- | --- |
| **前端应用** | `apps/frontend` 将切换为 Makerkit Supabase 模板结构，重新规划路由、Layout、认证上下文与数据获取方式。 |
| **共享库** | `core`/`lib` 目录下所有 Firebase 工具迁移或删除，替换为 Supabase SDK + BFF 客户端。 |
| **后端接口** | `services/*` 中凡是直接校验 Firebase Token 的入口改为验 Supabase JWT；新增 Makerkit 推荐的 `pkg/supabaseauth` 共用包。 |
| **部署脚本** | Cloud Build、GitHub Actions、脚本目录下的 Firebase 任务清理，添加 Supabase Key 同步与冒烟脚本。 |
| **文档与配置** | `.env` 样例、README、部署指南统一改为 Supabase 变量；废弃 Firebase 相关章节。 |

## 3. 目标架构（高阶）
```
apps/frontend (Makerkit Supabase UI)
 ├── app/、components/、modules/
 ├── core/supabase/ (client/server helpers)
 └── bff/ 请求全部指向 Go 服务

services/
 ├── {service}/main.go            (Supabase JWT 中间件)
 ├── pkg/supabaseauth/            (JWKS 缓存、Claim 解析)
 └── internal/...                 (仅保留业务逻辑)

deployments/
 ├── cloudbuild/build-service-docker.yaml   (新增 go test + Supabase 冒烟)
 ├── cloudbuild/build-frontend-docker.yaml  (使用 Makerkit Dockerfile)
 └── scripts/supabase/*                     (secret 同步、迁移脚本)
```

## 4. 重构步骤与工期建议
| 阶段 | 内容 | 预计工期 |
| --- | --- | --- |
| **Stage 0：准备** | Fork Makerkit 模板、导出 Supabase 现有表结构、整理现有业务 API 列表 | 1 天 |
| **Stage 1：前端骨架搭建** | 在 `apps/frontend` 建立新的 Makerkit 结构（保留老代码在 `apps/frontend-legacy` 分支），实现登录/登出、Dashboard 空页面 | 2 天 |
| **Stage 2：业务页面迁移** | Dashboard/Offers/Tasks/AdsCenter/Settings 逐页迁移，改成调用 BFF/Supabase 数据；完成后删除旧页面 | 4 天 |
| **Stage 3：管理后台迁移** | `/admin/**` 页面改写为 Makerkit Supabase 方案，联动审计日志与 Service Token | 2 天 |
| **Stage 4：后端 Supabase JWT 统一** | Go 服务引入 `pkg/supabaseauth`，所有入口使用同一中间件，补完 Service Key 审计逻辑 | 2 天 |
| **Stage 5：CI/CD & 文档** | Cloud Build 冒烟测试、Supabase 环境变量同步脚本、README/部署指南更新 | 1 天 |
| **Stage 6：数据库优化** | Supabase/Cloud SQL schema 审计、数据同步与性能优化、脚本与监控完善 | 3 天 |
| **Total** | — | ~15 个工作日 |

## 5. 关键工作流拆解
### 5.1 前端迁移
1. `apps/frontend` 目录重建：保留 `public/`、`i18n`、`supabase` 配置。
2. 加入 Makerkit 的 `app/`、`components/`、`modules/`、`core/` 结构。
3. 利用 `core/supabase/server|client` 封装 SSR/CSR 客户端，替换现有 `lib/supabase`。
4. 页面迁移顺序：Dashboard → Offers → Tasks → AdsCenter → Settings → Admin。
5. 所有数据请求改为调用 `/api/bff/**` 或 Go 服务；暂存的 Firebase Hook 删除。
6. 血缘梳理：确保 `contexts/`、`hooks/`、`ui/` 中不再引用 Firebase。

### 5.2 后端迁移
1. 在 `pkg/` 下新增 `supabaseauth`：负责 JWKS 缓存、Claims 解析、用户信息注入。
2. Go 服务全部引用该包，替换旧的 AuthMiddleware。
3. Billing/Console/Offer/AdsCenter 等服务补齐 `/api/v1/...` 接口契约，与前端 BFF 一致。
4. 管理后台接口增加 Service Token 审计（`admin_impersonation_events` 统一记录）。
5. 移除 `firebase`、`firestore` 相关包。

### 5.3 CI/CD & 自动化
1. Cloud Build：在 build-service-docker.yaml 里增加 `go test ./...`，并预留 Supabase 冒烟测试位。
2. GitHub Actions：为 frontend/backend 分别添加 `supabase migration lint`、`api-smoke` 步骤。
3. Secret 管理：统一在 Secret Manager 保存 `SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_KEY`、`SUPABASE_JWT_SECRET`。
4. 删除 Firebase 相关脚本（`mint-idtoken`、`firebase-smoke` 等）；添加 Supabase Bootstrapping 脚本。

### 5.4 数据库优化与整合
1. **Schema 差异梳理**：对 Supabase 与 Cloud SQL 中的 `User`、`idempotency_keys` 等重复表建立对照表，输出合并方案（共享 schema 或事件同步），并在文档中落地。
2. **数据流整合**：设计并实现用户/组织等核心数据的单向同步链路（Supabase → Pub/Sub → Cloud SQL），避免前端与后端双写；补充失败重试与告警机制。
3. **性能优化**：为 Cloud SQL 大表补齐索引、分区或物化视图评估，执行慢查询审计；Supabase 侧校验 RLS 规则、连接池配置与匿名 Key 最小化权限。
4. **运维脚本**：新增 `scripts/db/` 目录，包含 schema diff 检查、备份校验、迁移前置校验脚本；在 Cloud Build Job 中增加数据库健康检查步骤。
5. **监控告警**：将数据库指标（连接数、复制延迟、慢查询）接入 Cloud Monitoring；为 Supabase 和 Cloud SQL 建立统一的 PagerDuty/Slack 告警策略。
6. **连接方式指引**：统一使用 PgBouncer IPv4 入口 `aws-1-ap-northeast-1.pooler.supabase.com`，账号格式 `postgres.<project_ref>`，强制 `sslmode=require`；在文档中提供 `psql`/`pg_dump` 示例，指导团队在无 IPv6 环境也能导出/维护 Supabase Schema。

## 6. Makerkit 可复用资源（2025-10-09）
| 模板/组件 | 路径 | 可复用内容 | 整合建议 |
| --- | --- | --- | --- |
| 核心 Supabase SaaS 模板 | `makerkit/next-supabase-saas-kit/src/app` | Dashboard、Settings、Admin 页面骨架，`layout.tsx`、导航配置 | Stage 1 时拷贝到 `apps/frontend/app`，保留路由骨架后按业务定制 |
| Supabase 客户端封装 | `makerkit/next-supabase-saas-kit/src/core/supabase` | `getSupabaseBrowserClient`、`getSupabaseServerClient`、Auth 监听 | 替换现有 `lib/supabase`；统一 SSR/CSR 会话获取 |
| API 请求工具 | `makerkit/next-supabase-saas-kit/src/core/api` | `useApiRequest`、`apiFetch`、`ApiError` | 迁移至 `apps/frontend/core/api`，与 AutoAds BFF 契约对齐 |
| UI 组件集 | `makerkit/next-supabase-saas-kit/src/components` | 数据表、提示、模态框、表单控件（Radix + Tailwind） | 作为通用 UI 库，有选择地替换 AutoAds 自研组件 |
| 国际化结构 | `makerkit/next-supabase-saas-kit/src/i18n`、`public/locales` | `next-i18next.config.mjs`、命名空间模板 | 融合 AutoAds 现有 zh/zh-CN 词条，保留 Makerkit 命名空间规范 |
| BFF/业务 Hook | `makerkit/next-supabase-saas-kit/src/modules` | 组织、账单、通知等模块化 Hook | 可作为业务模块参考，按需引入 |
| Turbo 复用包 | `makerkit/next-supabase-saas-kit-turbo/packages/*` | `ui`、`features/auth`、`features/notifications` 等库 | 若后续使用 pnpm workspace，可抽取到 shared packages |
| 邮件模版 | `makerkit/makerkit-emails-starter` | 通知邮件主题、布局 | 与 Go 服务邮件通知联动，统一 Supabase 触发流程 |
| Cypress/E2E | `makerkit/next-supabase-saas-kit/cypress` | 登录、Dashboard、Admin 示例测试 | Stage 5 迁移到 AutoAds E2E，验证 Supabase 登录链路 |

> 注意：部分模板（例如 `src/lib/organizations`）包含多组织逻辑，迁移时需裁剪以符合单账号模型；环境变量需改为 AutoAds Supabase 项目的键值。

## 7. 风险与对策
| 风险 | 描述 | 对策 |
| --- | --- | --- |
| **功能回归风险** | 大规模改动可能引入回归 | 建立 E2E 冒烟脚本（登录、Dashboard、核心操作），在每个阶段完成后执行 |
| **进度延误** | 多团队协同导致依赖等待 | 冻结旧分支，仅在重构分支上开发；每日 Standup 跟踪阻塞项 |
| **配置错乱** | Supabase/Cloud Build 密钥同步可能遗漏 | 制作 `.env.example`、`deployments/supabase/README`，CI 强制校验必备变量 |
| **文档缺失** | 新组件/Hook 说明不足影响后续维护 | 在 `docs/SupabaseGo/` 内补充 BFF 接口、前端模块说明；迁移完成后更新 README |

## 8. 交付验收
- 📦 `apps/frontend` 仅包含 Supabase Makerkit 结构
- 📦 所有 `services/*` 通过 `go test ./...`
- 📦 `npm run lint && npm run typecheck` 全量通过
- 📦 Cloud Build 成功跑通 Supabase 冒烟脚本
- 📦 `docs/` 中 Firebase 相关内容全部移除
- 📦 所有 Secrets/Env 已切换为 Supabase 版本

## 9. 行动计划（高优先级）
1. Fork Makerkit Supabase 模板，梳理需要迁移的组件列表。
2. 创建 `feature/supabase-rebuild` 分支，将现有 `apps/frontend` 迁至 `apps/frontend-legacy` 以防回滚。
3. 完成 Stage 1 骨架后，与业务方确认页面 UI 与路径是否保持一致。
4. 并行推进 Go 服务 Supabase 中间件与前端页面迁移，确保契约同步。
5. Cloud Build/CI 修改与 Secrets 调整排在 Stage 4 完成后执行。
6. 迁移完成后执行 lint/typecheck/E2E，更新文档并发起合并。

---

> 若后续需要拆分子任务，请基于以上阶段/步骤创建具体 Issue 或工单，以便跟踪进度。
