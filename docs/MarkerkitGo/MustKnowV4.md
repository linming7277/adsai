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
3. 优先访问Secret Manager，获得所有的环境变量，可以根据需要自动补充新的环境变量
4. 若遇到不清楚的地方，或需要申请网络访问权限的，请向我申请
5. 完成阶段性的功能迭代后，及时进行功能测试，确保功能正常，且符合预期
6. 完成阶段性的功能迭代后，及时编译对应服务镜像，确保构建成功
7. 阅读 docs/monorepo-build-best-practices.md 文档，了解Monorepo构建最佳实践
8. 完成阶段性的功能迭代后，及时更新进展文档，只标注完成状态，不要修改任务内容，也可以根据需要补充新的任务
9. 发布相关的配置请放置在deployments目录下
10. secrets目录和其下的所有文件都不能上传Github，也不能打包进入镜像
11. 执行过程中生成的文档请放置在 docs/MarketkitGo/目录下
12. 请自行完成各种GCP和Supabase操作，使用服务账号codex-dev完成构建和部署，若缺少权限，请说明并申请
13. 遵循KISS原则，在确保实现业务需求的情况下，简化代码实现，提高可维护性
14. 如果一个问题反复修改3次都无法解决，就需要跳出来，重新思考真正的问题是什么，从全局的角度思考最佳的解决方案，包括架构优化、技术栈选型、数据结构优化、业务功能简化等，不要陷在错误的细节修改中

# 项目重要信息

1. GCP服务账号：codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com
2. GCP Project ID：gen-lang-client-0944935873
3. Supabase项目：
   - Project URL: https://jzzvizacfyipzdyiqfzb.supabase.co
   - 认证方式：Google OAuth
   - 数据库：PostgreSQL (Supabase托管)
4. Cloud SQL for PostgreSQL数据库：数据库实例autoads，数据库autoads_db，通过VPC Connector（cr-conn-default-ane1）进行内网访问数据库（微服务专用）
5. Cloud Run 都部署在 asia-northeast1 地区
6. 域名和服务名
   - 预发环境：https://www.urlchecker.dev
     - Frontend服务：frontend-preview
     - Offer服务：offer-preview
   - 生产环境：https://www.autoads.dev
     - Frontend服务：frontend
     - Offer服务：offer
7. 代码分支和部署流程（Github Actions）
   部署流程主要分两步，第一步：推送代码到Github；第二步，触发Github Actions，通过Cloud Build生成不同环境的镜像并部署到Cloud Run
   - 代码推送到main分支，触发preview环境Cloud Build镜像构建和Cloud Run部署：标注 docker image tag 为 preview-latest 和 preview-[commitid]
   - 代码推送到production分支，触发production环境Cloud Build镜像构建和Cloud Run部署：标注 docker image tag 为 prod-latest 和 prod-[commitid]
   - 当production分支打了tag（如v3.0.0），触发production环境Cloud Build镜像构建和Cloud Run部署：标注 docker image tag 为 prod-[tag] 和 prod-[commitid]
8. 代理IP服务商，初始配置美国代理IP服务商：Proxy_URL_US="https://api.iprocket.io/api?username=YOUR_USERNAME&password=YOUR_PASSWORD&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt"
9. 技术栈

### 前端
- Next.js 14 + Makerkit UI
- 部署: Cloud Run (frontend/frontend-preview)
- 域名: www.autoads.dev (生产) / www.urlchecker.dev (预发)

### 认证
- Supabase Auth (Google OAuth)
- JWT验证 + Row Level Security

### 数据库
- Supabase PostgreSQL: 用户认证、应用数据
- Cloud SQL PostgreSQL: 微服务数据 (通过VPC Connector)
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

### 成本
- Supabase Pro: $25/月
- Cloud Run + Cloud SQL + 其他: ~$250/月
- 总计: ~$275/月

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
