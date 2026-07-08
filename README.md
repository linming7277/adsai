# AutoAds SaaS Platform

基于 **Go + Next.js 14** 的现代化 SaaS 平台，提供广告链接自动化管理服务。

## 架构概览

### 前端架构
- **框架**: Next.js 14 (App Router) + Makerkit UI
- **架构模式**: 用户直连 (User-centric) - 每个用户独立数据命名空间
- **认证**: Supabase Auth (仅支持 Google OAuth)
- **权限**: RBAC 基于用户角色
- **路由**: 简化路由结构，移除组织 UUID，URL 减少 47%
- **部署**: Cloud Run Standalone 模式

### 后端架构
- **Go 微服务**: billing, offer, adscenter, siterank, browser-exec
- **数据库**: Supabase PostgreSQL (认证) + Cloud SQL PostgreSQL (业务数据)
- **缓存**: Cloud Memorystore for Redis
- **基础设施**: Cloud Run + Pub/Sub + API Gateway + Secret Manager

### 重要架构变更 (2025-10-11)
✅ **前端重构**: 移除组织模式，改为用户直连
  - 删除 3000+ 行组织相关代码
  - 路由简化: `/dashboard/offers` (原 `/dashboard/[org-uuid]/offers`)
  - Context 层级减少 66% (3层→1层)
  - 数据库查询减少 60%
  - 详见: `docs/SupabaseGo/重构记录-无组织模式.md`

> 架构优化（AO-06）已生效：
> - Next 不再内置 Admin；后台统一走 `/ops/console/*`（反代 Go 控制台）。
> - 生产禁止 Next 写入业务数据（仅认证相关表可写）；业务写入走 Go 原子端点。
> - API 统一入口 `/go/*`；`/api/go/*` 与 `/api/(siterank|adscenter)/*` 为兼容层，将逐步下线。
> - 数据迁移集中到 Go：启动前执行 `npm run migrate:backend`。
> - 支付/充值入口默认隐藏（`NEXT_PUBLIC_PAYMENTS_ENABLED=false`）。

## 运维速查卡（Cheatsheet）

- 定时任务（推荐 Pub/Sub 分发器）
  - 部署函数：`deployments/scripts/create-pubsub-dispatcher.sh`
  - 创建作业：`deployments/scripts/create-scheduler-pubsub-dispatch.sh`（设置 `URL`/`HEADERS_JSON='{"X-Service-Token":"ENV"}'`）
  - 说明与示例：见 docs/productrefactoring-v2/Operations.md 的“定时任务（推荐方案）”
- 内部自动化鉴权
  - AdminOnly 支持 `X-Service-Token` 与环境变量 `INTERNAL_SERVICE_TOKEN` 放行（仅用于内部作业）
  - 分发器载荷中设置 `X-Service-Token=ENV` 自动注入内部令牌
- OpenAPI 契约
  - 规范路径：`.kiro/specs/addictive-ads-management-system/openapi/*.yaml`
  - 校验/生成：`scripts/openapi/ci-check.sh`；GitHub Actions `OpenAPI CI` 已启用
  - 单一事实来源（CI 保护）：禁止直接修改 `services/*/openapi.yaml`；改动请提交到 `.kiro/specs/.../openapi/*.yaml`，CI 会阻断不合规修改
  - 镜像检查（非阻断）：`scripts/openapi/check-mirrors.sh` 比对服务内镜像与上游规范，仅做警告
  - 镜像同步（手动可选）：`scripts/openapi/sync-mirrors.sh [service...]` 将 `.kiro/specs` 的规范同步到 `services/*/openapi.yaml`（仅方便查阅，非事实来源）
- 构建（Kaniko）
  - 使用 Kaniko 时移除 `cloudbuild.yaml` 的 `images:` 字段，仅保留 `--destination=${_IMAGE}`
- 数据库迁移
  - 路径：`schemas/sql/*.sql`（按字典序应用，例如 012/013/014）
  - 执行：`DATABASE_URL=... ./scripts/db/apply-sql.sh`
- 看板体验
  - KPI 预热串行节流（默认前 3 条，每 300ms 一次），占位→真实自动聚合与刷新
  - SSE 解析按空行分帧，拼接完整 `data:` 后再 JSON 解析

更多常见问题与解决方案：docs/productrefactoring-v2/BugFix.md

## 项目结构

```
autoads/
├── apps/                  # 应用程序
│   ├── backend/          # Go 后端服务
│   └── frontend/         # Next.js 前端应用
│       └── src/
│           └── app/      # Next.js App Router
│               ├── auth/              # 认证页面 (Google OAuth)
│               ├── dashboard/         # 用户 Dashboard
│               │   ├── offers/       # Offers 管理
│               │   ├── tasks/        # Tasks 管理
│               │   └── ads-center/   # 广告中心
│               ├── settings/          # 独立 Settings 路由
│               │   ├── profile/      # 个人资料
│               │   ├── tokens/       # Token 管理
│               │   └── subscription/ # 订阅管理
│               └── manage/            # 后台管理 (RBAC - 仅管理员)
├── configs/              # 配置文件
│   ├── environments/     # 环境配置
│   └── docker/           # Docker 配置
├── deployments/          # 部署相关
│   ├── scripts/         # 部署脚本
│   └── docker-compose/  # Docker Compose 配置
├── docs/               # 文档
│   └── SupabaseGo/     # 重构文档
│       ├── 重构记录-无组织模式.md         # 完整重构记录
│       ├── 架构对比-组织vs用户模式.md     # 架构对比图
│       └── MustKnowV6.md                 # 项目架构文档
├── scripts/            # 通用脚本
└── .github/            # GitHub Actions 工作流
```

## 快速开始

### 环境要求

- Node.js >= 22.0.0
- Go >= 1.21.0
- Docker & Docker Compose
- Redis（Google Cloud Memorystore for Redis）
- MySQL 8.0+

### 安装依赖

```bash
# 安装所有依赖
npm run setup

# 或者分别安装
npm install
npm run setup:frontend
npm run setup:backend
```

### 开发环境

```bash
# 启动前端开发服务器
npm run dev:frontend

# 启动后端开发服务器
npm run dev:backend

# 同时启动前后端（需要安装 concurrently）
npm run dev
```

### 生产部署

```bash
# 构建应用
npm run build

# 使用 Docker 部署
npm run docker:prod
```

### 运行时域名配置（ClawCloud）

CI 会根据分支注入预发/生产域名信息，并在容器启动时渲染 CORS 与 OAuth 回调：
- 覆盖变量：`ALLOW_ORIGINS`（CORS 允许来源，逗号分隔）
- 覆盖变量：`GOOGLE_REDIRECT_URI`（Google OAuth 回调地址）

示例：
- 预发：`ALLOW_ORIGINS=https://urlchecker.dev,https://www.urlchecker.dev`，`GOOGLE_REDIRECT_URI=https://www.urlchecker.dev/auth/google/callback`
- 生产：`ALLOW_ORIGINS=https://autoads.dev,https://www.autoads.dev`，`GOOGLE_REDIRECT_URI=https://www.autoads.dev/auth/google/callback`

注意：不注入 301 跳转相关开关（已在域名层实现）。详见《README-deployment.md》的“ClawCloud 运行时覆盖域名元信息”。

### 管理后台访问与新前缀

- 管理后台仅支持 URL 直达（Next 前端不提供入口）：
  - 直达 URL：`/ops/console/login` 或 `/ops/console/panel`
  - `/ops/*` 是 Next 的管理网关，内部反向代理至 Go 的 `/console/*`（管理前端）与 `/api/v1/console/*`（管理 API），并统一加 `X-Robots-Tag: noindex, nofollow`。
- 业务 API 通过 `/go/*` 访问（Next 网关），后台管理 API 通过 `/ops/*` 访问（权限由 Go 的 AdminJWT 严格判定）。
- 旧前缀 `/admin/*` 与 `/api/v1/admin/*` 已下线，**请改用** `/console/*` 与 `/api/v1/console/*`。
  - React Admin（Next 内置管理台）已彻底下线，相关代码与路由已移除；唯一后台为 GoFly Admin，经 `/ops/console/*` 访问。
  - 如需本地验证管理 API，请使用 `/ops/api/v1/console/*`（由 Next BFF 反代至 Go）。

### 一次性联调（冒烟）

建议使用脚本 `scripts/e2e-smoke.sh`（见脚本内注释）进行冒烟：
- 验证 siterank `:check/:execute` 幂等（重复请求返回 `duplicate=true`）
- 验证响应头 `X-Request-Id` 与 `X-RateLimit-*` 存在
- 验证系统配置热更新（`/ops/console/config/v1` 的 ETag/Version 随更新变化）

## 环境配置

统一的环境变量管理流程见 [`docs/operations/environment-management.md`](docs/operations/environment-management.md)。关键步骤如下：

1. **变量清单**：`configs/environment/variables.json` 记录所有变量的用途、作用域与依赖服务。
2. **Secret Manager 审计**：
   ```bash
   python scripts/env/audit_secrets.py --project gen-lang-client-0944935873
   ```
3. **本地导出**（可选）：
   ```bash
   scripts/env/export-secrets.sh gen-lang-client-0944935873 .env.preview.generated
   cp .env.preview.generated .env.local
   ```
4. **构建/部署**：Cloud Build 通过 `availableSecrets` 注入公开配置；Cloud Run 部署统一使用 `--update-secrets` 绑定敏感凭据。

> 旧版脚本（如 `scripts/update-supabase-secrets.sh`）已弃用，请切换到上述流程。

### Feature Flags

- NEXT_PUBLIC_PAYMENTS_ENABLED
  - 作用：控制前端支付/Stripe 相关入口与界面显示。
  - 默认：`false`（隐藏支付配置、支付记录、订阅变更、账单/付款方式等模块）。
  - 设置为 `true` 时，将在管理后台与用户订阅页显示相关功能入口与模块。
  - 注意：该开关仅控制前端展示，若未正确配置支付后端或第三方账号，开启后功能仍不可用。

## 开发指南

### 核心文档
- [项目架构 MustKnowV6](docs/SupabaseGo/MustKnowV6.md) - **必读**：完整项目架构说明
- [后端开发文档](docs/development/backend.md)
- [前端开发文档](docs/development/frontend.md)
- [API 文档](docs/api/README.md)
- [部署指南](docs/deployment/README.md)
- [契约先行与生成脚本](docs/development/api-contracts.md)
- [写操作幂等策略](docs/development/idempotency.md)

### 架构重构文档 (2025-10-11)
- [重构记录-无组织模式](docs/SupabaseGo/重构记录-无组织模式.md) - 完整重构记录
- [架构对比-组织vs用户模式](docs/SupabaseGo/架构对比-组织vs用户模式.md) - Before/After 架构对比
- [重构任务清单](docs/SupabaseGo/重构任务清单.md) - 128 任务清单 (75% 完成)

### RBAC 权限控制
- [RBAC 实现指南](docs/SupabaseGo/RBAC-Implementation-Guide.md) - 技术实现细节
- [RBAC 快速测试](docs/SupabaseGo/RBAC-Quick-Test.md) - 快速验证指南
- [Google OAuth 指南](docs/SupabaseGo/RBAC-Google-OAuth-Guide.md) - OAuth 登录说明

## 贡献

欢迎提交 Issue 和 Pull Request。

## 许可证

MIT License
## 运行时限流与缓存配置

为便于运营与排障，Next 侧提供轻量限流与缓存控制。注意：最终限流以后端/Go 为权威；Next 侧用于提示/保护。

### 速率限制（每分钟配额）

通过环境变量热调：

- `RATE_LIMIT_API_PER_MINUTE`（默认 100）
- `RATE_LIMIT_SITERANK_PER_MINUTE`（默认 30）
- `RATE_LIMIT_ADSCENTER_PER_MINUTE`（默认 20）
- `RATE_LIMIT_BATCHOPEN_PER_MINUTE`（默认 10）
- `RATE_LIMIT_AUTH_PER_MINUTE`（默认 5）

路由返回头包含 `X-RateLimit-*`（提示用途），配合中间件 `withApiProtection` 使用。

### SiteRank 缓存控制

- 成功结果缓存 7 天，错误结果缓存 1 小时；命中缓存仅用于提速，“命中缓存仍全额扣费”。
- 可用 `SITERANK_CACHE_DISABLED=true` 临时禁用 SiteRank 缓存（用于应急回滚与排障）。
- `forceRefresh=true` 参数可强制刷新单个域名缓存（Rank 路由）。

### 可观测

- 全局注入/透传 `X-Request-Id`；核心路由返回 `Server-Timing: upstream;dur=<ms>`。
- SiteRank 返回 `X-Cache-Hit: <hit>/<total>`（提示用途）。
# Build status: Fri Nov 14 21:03:50 CST 2025
# Build status: Fri Nov 14 21:09:42 CST 2025
