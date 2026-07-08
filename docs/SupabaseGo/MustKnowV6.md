# 架构设计

混合架构：Makerkit + Go 微服务（混合的、前端优先的策略）

架构概述
这是一种创新的混合策略，旨在集两家之长。它建议使用一个业界顶级的 Next.js/Supabase SaaS 模板（如 Makerkit）来快速构建功能丰富的前端、处理用户认证和支付等标准 SaaS 功能，然后用一个定制的 Go 微服务来替代其默认的后端逻辑，或处理对性能要求极高的特定任务。

功能完整性评估 (基于 Makerkit)
Makerkit 是一个功能极其全面的 SaaS 启动套件，专为 Next.js 和 Supabase 设计。  
- 核心功能：用户的所有核心需求几乎都已开箱即用地实现，包括：完整的用户认证流程（邮箱、社交媒体、魔法链接）、基于 Stripe 的订阅和支付管理、功能强大的后台管理面板、通过标准的 i18n 库实现的多语言支持、以及用户个人中心等。  
- AI 就绪：Makerkit 明确宣传其代码库是"LLM-Ready"，为 AI 代理和代码生成工具提供了专门的规则，旨在将 AI 集成到开发流程中。  

Go 后端实现评估
这部分是一项"构建"任务，而非"购买"。开发者需要使用一个轻量级的 Go Web 框架（如 Gin 或 Echo ）来创建一个全新的、独立的 Go 微服务。该服务将通过 RESTful API 或 gRPC 对外提供服务。  

Supabase 与 GCP 集成路径
策略：这是该混合模式的核心所在，流程清晰且优雅。
1. 由 Makerkit 构建的 Next.js 前端应用直接与 Supabase Auth 进行交互，处理用户的登录和注册（支持Google OAuth等多种方式）。
2. 用户成功登录后，前端从 Supabase 获取一个 JWT 格式的 Access Token。
3. 当需要调用高性能后端处理特定业务时，Next.js 前端向部署在 Cloud Run 上的 Go 微服务发起 API 请求，并在 Authorization 请求头中携带此 Access Token。
4. Go 微服务接收到请求后，使用 Supabase JWT 验证机制对 Access Token 进行验证。验证通过后，即可安全地识别用户身份，并执行后续的业务逻辑。
5. Supabase PostgreSQL 数据库存储用户数据、认证信息和应用配置，支持 Row Level Security (RLS) 确保数据安全。

AI 集成路线图
- 策略：Go 微服务将是所有 AI 逻辑的专属运行环境。
- 实施：整个 Go 微服务可以围绕 Genkit Go 来构建。前端应用通过调用 Go 服务上的特定 API 端点（例如 /api/v1/analyze-data）来触发相应的 Genkit Flow。这种架构将计算密集型、需要高并发处理的 AI 工作负载完美地隔离到了 Go 环境中，而 Go 正是处理这类任务的理想选择。

专家结论
这种混合策略为构建一个功能丰富、性能卓越的 SaaS 应用提供了最快的路径。它充分利用了成熟的 Next.js/Supabase 生态系统来解决前端和标准 SaaS 功能的复杂性，同时满足了用户对高性能 Go 后端的核心需求，特别是对于 AI 和数据处理任务。Supabase 提供了开箱即用的认证、数据库、实时订阅和存储功能，相比 Firebase 更加开放和灵活。这是一种高度务实的工程方法，最大限度地减少了重复造轮子的工作，显著缩短了产品上市时间（Time-to-Market）。


# 项目构建指令

1. 使用中文进行沟通和文档输出
2. 请自行访问GCP和Supabase并修改更新
   - GCP访问：使用secrets目录下的gcp_codex_dev.json密钥文件
   - Supabase访问：使用secrets目录下的supabase-credentials.json密钥文件（配置方法见secrets/SUPABASE_ACCESS_GUIDE.md）
3. 优先访问 Secret Manager，获得所有环境变量清单，根据需要自动补充新的环境变量到 Secret Manager 和 Cloud Run 服务配置中
4. 每当业务新增环境变量时，请你负责：先更新 configs/environment/variables.json，再在 Secret Manager 创建对应条目并运行 python scripts/env/
  audit_secrets.py --project gen-lang-client-0944935873 --warn-extra，最后使用 scripts/env/update-run-service.sh 或等效命令更新相关 Cloud Run 服务的--update-secrets
5. 若遇到不清楚的地方，或需要申请网络访问权限的，请向我申请
6. 完成阶段性的功能迭代后，及时进行功能测试，确保功能正常，且符合预期
7. 完成阶段性的功能迭代后，及时编译对应服务镜像，确保构建成功
8. 阅读 docs/monorepo-build-best-practices.md 文档，了解Monorepo构建最佳实践
9. 完成阶段性的功能迭代后，及时更新进展文档，只标注完成状态，不要修改任务内容，也可以根据需要补充新的任务
10. 发布相关的配置请放置在deployments目录下
11. secrets目录和其下的所有文件都不能上传Github，也不能打包进入镜像
12. 执行过程中生成的文档请放置在 docs/SupabaseGo/ 目录下
13. 请自行完成各种GCP和Supabase操作，使用服务账号codex-dev完成构建和部署，若缺少权限，请说明并申请
14. 遵循KISS原则，在确保实现业务需求的情况下，简化代码实现，提高可维护性
15. 代码文件大小强制约束：
- 任何单文件超过300行立即重构（重构后略超300行可以接受）
- Frontend: page.tsx只负责组装，逻辑拆分到hooks(<150行)和组件(<200行)
- Backend: handler只负责路由(<200行)，逻辑拆分到service(<300行)和repository(<200行)
- 共享逻辑提取到pkg/目录，实现跨服务复用
- CI检查：超过阈值的文件构建时警告
16. 如果一个问题反复修改3次都无法解决，就需要跳出来，重新思考真正的问题是什么，从全局的角度思考最佳的解决方案，包括架构优化、技术栈选型、数据结构优化、业务功能简化等，不要陷在错误的细节修改中
17. 在执行操作中，任何不在当前任务范围内的未提交或未追踪文件，都不触碰、不恢复、不删除，避免影响其他并行开发的内容
18. 解决问题，而不是逃避问题：禁止用redirect或删除代码或简化实现或stub实现来回避问题，必须通过搜索代码库找到现有实现并重建完整功能
19. 如果本地构建测试成功，但是预发/生产环境构建测试失败，则需要检查'.gitignore'和'.dockerignore'文件，看看是否有文件被意外排除
20. 充分利用本地已安装的MCP，比如 thinking，context7，fetch，chrome-devtools 等
21. i18n 强制规范：所有用户可见文本必须使用 react-i18next 的 t() 函数，禁止任何中英文硬编码字符串；编写代码时主动提示需要添加的翻译键，发现硬编码立即提醒修正
22. 为项目创建标准化的页面布局系统，确保所有页面使用统一的容器、间距和响应式设计
23. API端点开发三步法：
- 服务端实现：在 services/{service}/openapi.yaml 中定义OpenAPI规范
- Frontend定义：在 apps/frontend/src/lib/api/endpoints.ts 中添加常量
- Gateway自动生成：通过merge-openapi.sh自动生成Gateway配置
24.Ground Truth原则：提出架构优化方案前，必须先用 gcloud/grep/ls 命令验证实际部署状态和代码实现（Ground Truth），确认无误后再参考文档描述；遇到任何不一致立即停止并系统调查，禁止基于文档或单一证据做假设，所有结论必须有多重证据交叉验证


# 项目重要信息

1. GCP服务账号：codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com
2. GCP Project ID：gen-lang-client-0944935873
3. Supabase项目：
   - Project URL: https://jzzvizacfyipzdyiqfzb.supabase.co
   - 认证方式：Google OAuth
   - 数据库：PostgreSQL (Supabase托管)
4. Cloud SQL for PostgreSQL数据库：数据库实例autoads，数据库autoads_db，通过VPC Connector（cr-conn-default-ane1）进行内网访问数据库（微服务专用）
5. Supabase数据库连接方式（psql）：
   - **Transaction Pooler (推荐)**: `postgresql://postgres.jzzvizacfyipzdyiqfzb:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`
   - **Session Pooler**: `postgresql://postgres.jzzvizacfyipzdyiqfzb:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres`
   - **Direct Connection**: `postgresql://postgres:[PASSWORD]@db.jzzvizacfyipzdyiqfzb.supabase.co:5432/postgres?sslmode=require` (需配置IP白名单)
   - 账号格式：`postgres.<project_ref>` (Pooler) 或 `postgres` (Direct)
   - 强制：`sslmode=require` (Direct Connection)
6. Cloud Run 都部署在 asia-northeast1 地区
7. 域名和服务名
   - 预发环境：https://www.urlchecker.dev
     - Frontend服务：frontend-preview
     - Offer服务：offer-preview
   - 生产环境：https://www.autoads.dev
     - Frontend服务：frontend
     - Offer服务：offer
8. 代码分支和部署流程（Github Actions）
   部署流程主要分两步，第一步：推送代码到Github；第二步，触发Github Actions，通过Cloud Build生成不同环境的镜像并部署到Cloud Run
   - 代码推送到main分支，触发preview环境Cloud Build镜像构建和Cloud Run部署：标注 docker image tag 为 preview-latest 和 preview-[commitid]
   - 代码推送到production分支，触发production环境Cloud Build镜像构建和Cloud Run部署：标注 docker image tag 为 prod-latest 和 prod-[commitid]
   - 当production分支打了tag（如v3.0.0），触发production环境Cloud Build镜像构建和Cloud Run部署：标注 docker image tag 为 prod-[tag] 和 prod-[commitid]
   - 除了main分支和production分支外，不要创建额外的分支
   - 强制使用服务账号 codex-dev 进行构建和部署
9. 代理IP服务商，初始配置美国代理IP服务商：Proxy_URL_US="https://api.iprocket.io/api?username=YOUR_USERNAME&password=YOUR_PASSWORD&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt"
10. 技术栈
### 前端
- **框架**: Next.js 14 (App Router) + Makerkit UI
- **架构模式**: 用户直连模式 (User-centric)
- **认证**: Google OAuth 一键登录
- **部署**: Cloud Run (frontend/frontend-preview)
- **域名**: www.autoads.dev (生产) / www.urlchecker.dev (预发)
- **构建模式**: Standalone Output (优化部署体积)

### 认证与权限
- **认证方式**: Supabase Auth (仅支持 Google OAuth)
- **Token**: JWT验证
- **数据隔离**: Row Level Security (RLS) 基于 `user_id`
- **权限控制**: RBAC (Role-Based Access Control)
  - 普通用户: `UserRole.User`
  - 管理员: `UserRole.Admin` (映射自 Supabase `app_metadata.role = GlobalRole.SuperAdmin`)
  - 管理员专属路由: `/manage` (后台管理系统)

### 数据库
- Supabase PostgreSQL: 用户认证
- Cloud SQL PostgreSQL: 应用数据、微服务数据 (通过VPC Connector: cr-conn-default-ane1)
- Redis: 缓存 (autoads-redis)

### 后端微服务 (Go + Cloud Run)
- browser-exec: 浏览器自动化 (API + Worker拆分)
- siterank: 网站评分 (API + Worker拆分)
- billing, offer, adscenter等

### 基础设施
- Cloud Run: 容器托管
- Pub/Sub: 异步消息队列
- API Gateway: 统一入口
- Secret Manager: 密钥管理
- Artifact Registry: 镜像仓库

# Frontend 架构说明

## 架构模式：用户直连 (User-centric)

AutoAds 前端采用**用户直连模式**，每个用户拥有独立的数据命名空间，无需组织层概念。

### 核心特点
- ✅ **简化路由**: 移除组织 UUID，URL 平均减少 47%
- ✅ **直接隔离**: 数据基于 `user_id` 过滤，无需复杂的组织成员关系
- ✅ **更好性能**: RLS 策略简化，减少 60% 数据库查询
- ✅ **清晰权限**: RBAC 基于用户角色，而非组织成员角色

## 路由结构

### 新路由架构 (2025-10-11 重构后)

```
前端路由层级:
/
├── auth/                              # 认证页面
│   ├── sign-in                        # Google OAuth 登录
│   └── callback                       # OAuth 回调
├── dashboard/                         # ✅ 用户 Dashboard
│   ├── page.tsx                       # Dashboard 首页 (无组织选择)
│   ├── offers/                        # ✅ Offers 管理
│   │   ├── page.tsx                   # URL: /dashboard/offers
│   │   └── [id]/page.tsx              # URL: /dashboard/offers/{id}
│   ├── tasks/                         # ✅ Tasks 管理
│   │   └── page.tsx                   # URL: /dashboard/tasks
│   └── ads-center/                    # ✅ 广告中心
│       └── page.tsx                   # URL: /dashboard/ads-center
├── settings/                          # ✅ 独立 Settings 路由
│   ├── profile/page.tsx               # URL: /settings/profile
│   ├── tokens/page.tsx                # URL: /settings/tokens
│   └── subscription/page.tsx          # URL: /settings/subscription
└── manage/                            # ✅ 管理后台 (RBAC - 仅管理员)
    └── page.tsx                       # URL: /manage

特点:
✅ URL 简洁、语义化
✅ 登录后直接进入 Dashboard
✅ 路由层级浅 (2层)
✅ Settings 独立路由，符合用户直觉
✅ 无组织概念，一对一关系
```

### 示例 URL

```
旧架构 (已移除):
https://autoads.dev/dashboard/550e8400-e29b-41d4-a716-446655440000/offers
                              └──────────────┬──────────────┘
                                        组织 UUID (36字符)

新架构 (当前):
https://autoads.dev/dashboard/offers
                    └────┬─────┘
                      简洁路径
```

## 数据流架构

### 认证流程

```
1. 用户访问 /auth/sign-in
   ↓
2. 点击 "Sign in with Google"
   ↓
3. Google OAuth 授权
   ↓
4. Supabase Auth 回调 (/auth/callback)
   ↓
5. 创建 Session + JWT Token
   ↓
6. 跳转到 /dashboard (无组织选择)
   ↓
7. 直接加载用户数据 (基于 user_id)
```

### 数据查询流程

```
┌─────────────────────────────────────────────────────────────┐
│                      前端应用                                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User Authentication (Supabase Auth)                         │
│           ↓                                                   │
│  UserContext ✅                                               │
│           ↓                                                   │
│  直接基于 user_id 获取数据 ✅                                  │
│           ↓                                                   │
│  Dashboard / Offers / Tasks                                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
        ↓                         ↑
┌─────────────────────────────────────────────────────────────┐
│                    Supabase 数据库                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  users 表                                                     │
│    ├── id (user_id)                                          │
│    ├── email                                                  │
│    └── app_metadata.role (RBAC) ✅                           │
│                                                               │
│  RLS 策略 (所有业务表):                                        │
│    WHERE user_id = auth.uid() ✅                             │
│                                                               │
└─────────────────────────────────────────────────────────────┘

优势:
✅ 只需维护 users 表和业务表
✅ RLS 策略简单（直接 auth.uid()）
✅ 无需 Cookie 管理（无组织切换）
✅ 数据隔离更安全（用户级别）
✅ 代码更简洁（减少一层抽象）
```

## RBAC 权限控制

### 角色定义

```typescript
// 前端角色枚举
export enum UserRole {
  User = 'user',      // 普通用户
  Admin = 'admin',    // 管理员
}

// Supabase 全局角色
export enum GlobalRole {
  SuperAdmin = 'super-admin',  // 超级管理员
}
```

### 角色映射

```typescript
// 从 Supabase app_metadata.role 映射到前端 UserRole
const appMetadataRole = user?.app_metadata?.role;

if (appMetadataRole === GlobalRole.SuperAdmin) {
  return UserRole.Admin;  // 管理员
}

return UserRole.User;  // 普通用户
```

### 权限控制示例

```typescript
// 导航配置
const routes = [
  { label: '仪表盘', href: '/dashboard' },
  { label: 'Offers', href: '/dashboard/offers' },
  { label: 'Tasks', href: '/dashboard/tasks' },
  {
    label: '后台管理',
    href: '/manage',
    requiredRole: UserRole.Admin  // ✅ 仅管理员可见
  },
];

// 服务端路由保护
export default async function ManagePage() {
  const user = await getUser();

  if (!isUserSuperAdmin(user)) {
    redirect('/dashboard');  // 非管理员重定向
  }

  return <AdminDashboard />;
}
```

## Context 层级

### 简化后的 Context 架构

```typescript
// 唯一的 Context: UserProvider
<UserProvider user={user}>     {/* 用户信息 */}
  {children}
</UserProvider>

// ❌ 已移除:
// - OrganizationProvider (组织信息)
// - OrganizationContext (组织上下文)
```

## 重构记录

### 重构时间
- **开始**: 2025-10-10
- **完成**: 2025-10-11 (75% - 核心功能完成)

### 重构成果
- ✅ 删除代码: -3000+ 行
- ✅ 删除文件: -30+ 个
- ✅ URL 长度: -47%
- ✅ Context 层级: -66% (3层→1层)
- ✅ 数据库查询: -60%
- ✅ 开发效率: +2400% (24h预估→1h实际)

### 相关文档
- 📝 [重构记录-无组织模式](./重构记录-无组织模式.md)
- 🔄 [架构对比-组织vs用户模式](./架构对比-组织vs用户模式.md)
- 📋 [重构任务清单](./重构任务清单.md)

---

# Frontend服务CI/CD流程

## 部署架构

Frontend服务采用GitHub Actions + Cloud Build的双层CI/CD架构：

### 1. GitHub Actions工作流
- **配置文件**: `.github/workflows/deploy-frontend.yml`
- **触发条件**:
  - 推送到main分支 → 部署到preview环境
  - 推送到production分支 → 部署到生产环境
  - 打tag（如v3.0.0）→ 部署到生产环境并标记版本

### 2. 镜像标签策略
- **Preview环境**:
  - 主标签: `preview-{commit_sha}`
  - 次标签: `preview-latest`
  - 服务名: `frontend-preview`
- **生产环境**:
  - 主标签: `prod-{commit_sha}` 或 `prod-{tag}`
  - 次标签: `prod-latest`
  - 服务名: `frontend`

### 3. Cloud Build构建
- **配置文件**: `deployments/cloudbuild/build-frontend-docker.yaml`
- **构建参数**:
  - 使用E2_HIGHCPU_8机器类型
  - 超时时间: 3600秒
  - 日志存储: gs://autoads-build-logs-asia-northeast1/logs
- **环境变量来源**: Secret Manager
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_KEY
  - STRIPE_PUBLISHABLE_KEY
  - NEXT_PUBLIC_API_BASE_URL
  - NEXT_PUBLIC_SITE_URL (根据环境动态设置)

### 4. 部署到Cloud Run
- **服务配置**:
  - 服务账号: codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com
  - 区域: asia-northeast1
  - 资源: 1 CPU, 1Gi内存
  - 并发: 80
  - 最大实例: 20
  - 超时: 300秒
  - 访问: 允许未认证访问

### 5. 部署流程
```
代码推送 → GitHub Actions触发 → 创建源码tarball → 
提交到Cloud Build → 构建Docker镜像 → 推送到Artifact Registry → 
部署到Cloud Run → 更新域名映射
```

### 6. 环境URL
- **Preview**: https://www.urlchecker.dev
- **Production**: https://www.autoads.dev

## 手动部署命令

### 构建镜像
```bash
# Preview环境
gcloud builds submit \
  --config=deployments/cloudbuild/build-frontend-docker.yaml \
  --substitutions=_IMAGE="asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/frontend:preview-latest",_SITE_URL="https://www.urlchecker.dev"

# 生产环境
gcloud builds submit \
  --config=deployments/cloudbuild/build-frontend-docker.yaml \
  --substitutions=_IMAGE="asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/frontend:prod-latest",_SITE_URL="https://www.autoads.dev"
```

### 部署服务
```bash
# Preview环境
gcloud run deploy frontend-preview \
  --image=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/frontend:preview-latest \
  --region=asia-northeast1 \
  --service-account=codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com \
  --allow-unauthenticated

# 生产环境
gcloud run deploy frontend \
  --image=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/frontend:prod-latest \
  --region=asia-northeast1 \
  --service-account=codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com \
  --allow-unauthenticated
```

# 数据库架构与初始化策略

## 数据库初始化模式

项目中存在**三种数据库初始化模式**，根据服务特点选择使用：

### 模式1: 独立迁移文件 + DB Migrator Job

**适用服务**: billing, adscenter

**特征**:
- 迁移文件位于 `services/{service}/internal/migrations/*.sql`
- 使用专用 DB Migrator Job 执行迁移（Cloud Run Job）
- 幂等性追踪：`schema_migrations` 表记录已应用的迁移
- 服务启动时跳过迁移（设置 `{SERVICE}_SKIP_MIGRATIONS=1`）

**执行方式**:
```bash
# 1. 构建migrator镜像
gcloud builds submit \
  --config=deployments/cloudbuild/build-migrator.yaml \
  --substitutions=_SERVICE=billing,_ENV=preview

# 2. 执行迁移Job
gcloud run jobs execute db-migrator-preview \
  --region=asia-northeast1 --wait

# 3. 部署服务（跳过内嵌迁移）
gcloud run deploy billing-preview \
  --set-env-vars=BILLING_SKIP_MIGRATIONS=1
```

**优点**:
- ✅ 版本化管理，易于回溯
- ✅ 支持复杂的数据迁移逻辑
- ✅ 单实例执行，无竞争条件
- ✅ 可独立测试和回滚

**适用场景**:
- 核心业务表
- 表结构频繁变更
- 需要复杂数据迁移

### 模式2: 代码内嵌DDL（启动时创建）

**适用服务**: offer, siterank

**特征**:
- 在 `main.go` 或 `internal/handlers/ddl.go` 中定义DDL
- 服务启动时执行 `EnsureAllTables()` 函数
- 所有DDL使用 `CREATE TABLE IF NOT EXISTS`
- 天然幂等性，适合稳定schema

**示例** (offer服务):
```go
// services/offer/internal/handlers/ddl.go
func EnsureAllTables(ctx context.Context, db *sql.DB) error {
    tables := []struct {
        name string
        ddl  string
    }{
        {
            name: "OfferStatusHistory",
            ddl: `CREATE TABLE IF NOT EXISTS "OfferStatusHistory"(...)`,
        },
        // ...其他表
    }

    for _, table := range tables {
        if _, err := db.ExecContext(ctx, table.ddl); err != nil {
            return fmt.Errorf("ensure table %s: %w", table.name, err)
        }
    }
    return nil
}

// main.go
func main() {
    // 启动时创建所有表
    if err := handlers.EnsureAllTables(ctx, db); err != nil {
        log.Fatalf("Failed to ensure tables: %v", err)
    }
}
```

**优点**:
- ✅ 简单直观，代码即文档
- ✅ 适合表结构稳定的服务
- ✅ 无需维护独立迁移文件
- ✅ 天然幂等性

**缺点**:
- ❌ 不支持 ALTER TABLE 等复杂变更
- ❌ 无版本追踪
- ❌ 难以实现数据迁移

**适用场景**:
- 辅助/缓存表
- 表结构稳定
- 无复杂数据迁移需求

### 模式3: 外部ORM工具（未启用）

**状态**: 项目中有Prisma配置但未实际使用

**适用场景**: 大型项目、多团队协作

## 数据库表归属

### billing服务表

**核心表**:
- `User` - 用户表（共享）
- `Subscription` - 订阅管理
- `UserToken` - Token余额
- `TokenTransaction` - Token交易记录
- `UserTokenPool` - Token池
- `TokenCreditLot` - 积分批次
- `TokenCreditAllocation` - 积分分配
- `TokenRepairAudit` - 修复审计

**迁移方式**: 独立迁移文件（6个）

### offer服务表

**辅助表**:
- `OfferStatusHistory` - 状态历史
- `OfferPreferences` - 偏好设置
- `OfferKpiDeadLetter` - KPI死信队列
- `idempotency_keys` - 幂等性键

**迁移方式**: 代码内嵌DDL

### siterank服务表

**缓存表**:
- `domain_cache` - 域名缓存
- `domain_country_cache` - 域名国家缓存
- `User` - User stub表（与billing共享）
- `SiterankHistory` - 评分历史

**迁移方式**: 代码内嵌DDL

### adscenter服务表

**业务表**:
- `UserAdsConnection` - 用户广告连接
- `IdempotencyKeys` - 幂等性键
- `BulkAudit` - 批量审计
- `MccLink` - MCC链接
- `AuditEvents` - 审计事件

**迁移方式**: 独立迁移文件（5个）

## 注意事项

### 1. 表名冲突风险

**潜在冲突**:
- `idempotency_keys`: offer和其他服务可能重复创建
- `User`: billing和siterank都创建此表

**解决方案**:
- User表：确保siterank的stub结构与billing完全一致
- idempotency_keys：考虑统一为共享表设计（增加service列）

详见：`docs/MarkerkitGo/TableConflictAnalysis.md`

### 2. DB Migrator适用场景

**✅ 适用**:
- 全新环境部署
- 生产环境首次部署
- 增量迁移（schema已协调一致）

**❌ 不适用**:
- 已有数据库且schema未追踪
- Schema不一致的环境
- 需要复杂数据迁移的场景

### 3. 最佳实践

**SQL幂等性**:
- 所有 `CREATE TABLE` 使用 `IF NOT EXISTS`
- 所有 `CREATE INDEX` 使用 `IF NOT EXISTS`
- `ALTER TABLE` 使用 DO 块检查列是否存在

**迁移顺序**:
1. 先执行 DB Migrator Job（billing, adscenter）
2. 再启动服务（设置SKIP_MIGRATIONS环境变量）
3. 最后启动内嵌DDL的服务（offer, siterank）

**监控与告警**:
- 配置Cloud Monitoring监控迁移Job状态
- 失败时立即告警
- 保留迁移日志至少30天

详见：`docs/MarkerkitGo/DBMigratorDeploymentGuide.md`
