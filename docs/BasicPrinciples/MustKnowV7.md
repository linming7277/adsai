# AutoAds 架构设计

**文档版本**: v7.2
**适用范围**: AutoAds项目架构参考和开发指南

## 混合架构概述

AutoAds 采用创新的混合架构策略，结合 Next.js/Supabase 前端与 Go 微服务后端，实现功能丰富且性能卓越的 SaaS 应用。

**核心设计理念**：
- **前端优先**：使用 Makerkit (Next.js + Supabase) 快速构建前端功能
- **Go 后端**：定制 Go 微服务处理高性能任务和 AI 工作负载
- **混合数据**：Supabase 专注认证，Cloud SQL 统一业务数据
- **共享数据库**：开发、预发、生产环境共用同一数据库实例，确保数据一致性

## 项目构建指令

1. **使用中文进行沟通和文档输出**
2. **请自行访问GCP和Supabase并修改更新**
   - GCP访问：使用secrets/gcp_codex_dev.json密钥文件
   - Supabase访问：使用secrets/supabase-credentials.json密钥文件（配置方法见secrets/SUPABASE_ACCESS_GUIDE.md）
3. **优先访问 Secret Manager，获得所有环境变量清单**，根据需要自动补充新的环境变量到 Secret Manager 和 Cloud Run 服务配置中
4. **每当业务新增环境变量时**，请你负责：先更新 configs/environment/variables.json，再在 Secret Manager 创建对应条目并运行 python scripts/env/audit_secrets.py --project gen-lang-client-0944935873 --warn-extra，最后使用 scripts/env/update-run-service.sh 或等效命令更新相关 Cloud Run 服务的--update-secrets
5. **如果有不清楚的地方，直接问我，不要假设**
6. **完成阶段性的功能迭代后，及时进行功能测试**，确保功能正常，且符合预期
7. **完成阶段性的功能迭代后，及时编译对应服务镜像**，确保构建成功
8. **阅读 docs/monorepo-build-best-practices.md 文档**，了解Monorepo构建��佳实践
9. **完成阶段性的功能迭代后，及时更新进展文档**，只标注完成状态，不要修改任务内容，也可以根据需要补充新的任务
10. 发布相关的配置请放置在deployments目录下
11. **secrets目录和其下的所有文件都不能上传Github**，也不能打包进入镜像
12. **执行过程中生成的文档请放置在 docs/SupabaseGo/ 目录下**
13. **请自行完成各种GCP和Supabase操作**，使用服务账号codex-dev完成构建和部署，若缺少权限，请说明并申请
14. **遵循KISS原则**，在确保实现业务需求的情况下，简化代码实现，提高可维护性
15. **代码文件大小强制约束**：
   - 任何单文件超过300行立即重构（重构后略超300行可以接受）
   - Frontend: page.tsx只负责组装，逻辑拆分到hooks(<150行)和组件(<200行)
   - Backend: handler只负责路由(<200行)，逻辑拆分到service(<300行)和repository(<200行)
   - 共享逻辑提取到pkg/目录，实现跨服务复用
   - CI检查：超过阈值的文件构建时警告
16. 如果一个问题上反复修改3次都无法解决，就需要跳出来，重新思考真正的问题是什么，从全局的角度思考最佳的解决方案，包括架构优化、技术栈选型、数据结构优化、业务功能简化等，不要陷在错误的细节修改中
17. 在执行操作中，任何不在当前任务范围内的未提交或未追踪文件，都不触碰、不恢复、不删除，避免影响其他并行开发的内容
18. **解决问题，而不是逃避问题**：禁止用redirect或删除代码或简化实现或stub实现来回避问题，必须通过搜索代码库找到现有实现并重建完整功能
19. **如果本地构建测试成功，但是预发/生产环境构建测试失败**，则需要检查'.gitignore'和'.dockerignore'文件，看看是否有文件被意外排除
20. **充分利用本地已安装的MCP**，比如 thinking，context7，fetch，chrome-devtools 等
21. **i18n 强制规范**：所有用户可见文本必须使用 react-i18next 的 t() 函数，禁止任何中英文硬编码字符串；编写代码时主动提示需要添加的翻译键，发现硬编码立即提醒修正
22. **为项目创建标准化的页面布局系统**，确保所有页面使用统一的容器、间距和响应式设计
23. **OpenAPI开发规范（强制）**：
   - **唯一真实来源**：只能编辑 `specs/openapi/{service}.yaml` 定义 OpenAPI 规范
   - **禁止修改**：`services/*/openapi.yaml` 是只读镜像，仅供参考，修改会被 CI 拒绝
   - **代码生成**：运行 `./scripts/openapi/generate.sh` 生成 Go stubs (`internal/oapi/*.gen.go`) 和 TS types (`packages/shared-types/`)
   - **Frontend端点**：自动生成到 `apps/frontend/src/lib/api/endpoints.ts`（部分服务需手动添加，如 USERACTIVITY）
24. **Ground Truth原则**：提出架构优化方案前，必须先用 gcloud/grep/ls 命令验证实际部署状态和代码实现（Ground Truth），确认无误后再参考文档描述；遇到任何不一致立即停止并系统调查，禁止基于文档或单一证据做假设，所有结论必须有多重证据交叉验证

## 项目重要信息

### 1. GCP和Supabase基础配置
- **GCP服务账号**：codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com
- **GCP Project ID**：gen-lang-client-0944935873
- **部署区域**：asia-northeast1

### 2. Supabase项目
- **Project URL**: https://jzzvizacfyipzdyiqfzb.supabase.co
- **认证方式**: Google OAuth
- **数据库**: PostgreSQL (纯认证数据库，高性能优化)
- **连接方式**: Management API (推荐) + Supabase CLI + psql直连 (备用)
- **核心特性**:
  - user_profiles视图（22字段）
  - 高性能物化视图
  - 便捷查询函数
  - 查询响应时间90%+提升

### 3. Cloud SQL数据库
- **实例**: autoads (PostgreSQL 17)
- **数据库**: autoads_db (统一数据库，包含8个业务域schema)
- **架构**: 微服务Schema自治 (1:1映射)
- **环境配置**:
  - **开发环境**: 无独立数据库，直接连接预发环境数据库
  - **预发环境**: 与生产环境共用同一数据库实例
  - **生产环境**: 主数据库实例

### 4. 数据库访问方式
#### Cloud SQL访问 (HybridDatabaseManager)
- **连接方式**: Cloud SQL Proxy + pgxpool直连 (内网) / 公网IP直连 (开发环境)
- **连接模式**: Unix Socket (`/cloudsql/PROJECT:REGION:INSTANCE`) / 公网IP (`35.243.74.175:5432`)
- **连接池**: pgxpool标准连接池（MaxConns: 50, MinConns: 10）
- **迁移工具**: golang-migrate标准SQL迁移（.up.sql/.down.sql）
- **迁移架构**:
  - **开发环境迁移**: 本地直连预发环境数据库执行 (30秒完成)
  - **生产环境迁移**: 本地直连预发环境数据库执行 (与预发共用)
  - **说明**: 所有迁移操作都在预发环境数据库上执行，确保数据一致性
- **便捷脚本**: `scripts/db/setup-local-db-access.sh` (自动配置IP授权和连接脚本)

### 本地开发环境操作Cloud SQL数据库指南

**说明**: 开发环境无独立数据库，通过本地公网访问直接操作预发环境数据库

**适用场景**：本地开发、调试数据库、快速验证迁移

#### 快速配置 (推荐)

使用自动化脚本一键配置：
```bash
./scripts/db/setup-local-db-access.sh
```

该脚本会自动：
- 获取当前公网IP并添加到Cloud SQL授权列表
- 从Secret Manager获取数据库连接信息
- 测试数据库连接（连接预发环境数据库）
- 生成便捷连接脚本：`scripts/db/connect-local-db.sh`
- 生成清理脚本：`scripts/db/clean-migrations.sh`

#### 手动配置步骤

1. **获取当前公网IP并授权**
```bash
CURRENT_IP=$(curl -s ifconfig.me)
gcloud sql instances patch autoads --authorized-networks="$CURRENT_IP/32" --project=gen-lang-client-0944935873
```

2. **连接数据库**
```bash
# 使用生成的便捷脚本
./scripts/db/connect-local-db.sh

# 或直接使用psql
psql "postgresql://postgres:PASSWORD@35.243.74.175:5432/autoads_db?sslmode=require"
```

3. **执行迁移**
```bash
# 直接执行迁移文件
psql "postgresql://postgres:PASSWORD@35.243.74.175:5432/autoads_db?sslmode=require" -f services/user/migrations/000001_create_user_domain_schema.up.sql
```

4. **清理迁移状态（如需要）**
```bash
./scripts/db/clean-migrations.sh
```

**开发效率**：本地直接执行迁移从10分钟缩短到30秒，支持标准数据库工具调试。

#### 🔐 安全和权限管理

**IP白名单管理**:
- **动态授权**: 使用`scripts/db/setup-local-db-access.sh`自动添加当前IP
- **定期清��**: 定期检查和清理不再需要的IP授权
- **团队访问**: 多人开发时考虑使用VPN固定IP

**访问权限控制**:
- **开发环境**: 开发者个人IP，权限限制在必要范围
- **生产环境**: 严格权限控制，只有授权人员可访问
- **审计日志**: 启用Cloud SQL审计日志，记录所有数据库操作

**连接安全**:
- **强制SSL**: 所有连接必须使用SSL加密
- **密码管理**: 通过Secret Manager管理，定期轮换
- **连接超时**: 设置合理的连接和查询超时时间

**操作规范**:
```bash
# 安全操作流程示例
./scripts/db/setup-local-db-access.sh  # 1. 安全配置访问权限
psql "postgresql://postgres:PASSWORD@35.243.74.175:5432/autoads_db?sslmode=require" \
    -c "SELECT version();"  # 2. 测试连接
# 3. 执行必要操作
# 4. 及时清理不再需要的权限（可选）
```

#### Supabase访问
- **SDK**: Supabase Go SDK v0.0.4（官方SDK）
- **认证方式**: JWT Token验证
- **数据库状态**: 纯认证数据库，高性能优化
- **核心表**: auth.users, auth.identities, public.user_profiles（视图）, public.supabase_config
- **优化特性**: user_profiles视图（22字段）, 高性能物化视图, 便捷查询函数
- **性能提升**: 查询响应时间90%+提升

### 5. 服务部署
- **预发环境**: https://www.urlchecker.dev
  - Frontend服务：frontend-preview
  - Offer服务：offer-preview
  - 数据库：与生产环境共用 Cloud SQL 实例
- **生产环境**: https://www.autoads.dev
  - Frontend服务：frontend
  - Offer服务：offer
  - 数据库：主 Cloud SQL 实例（与预发共用）

### 6. 代码分支和部署流程
- **main分支**: 触发preview环境Cloud Build镜像构建和Cloud Run部署
- **production分支**: 触发production环境Cloud Build镜像构建和Cloud Run部署
- **tag标记**: 当production分支打tag时，触发production环境部署
- **强制使用**: 服务账号codex-dev进行构建和部署
- **API+Worker架构**: CPU密集型服务拆分为API实例和Worker实例，通过Pub/Sub解耦
- **环境差异化**: Preview环境允许激进策略，Production环境使用严格的golang-migrate SQL迁移机制

## 前端架构

### 架构模式：用户直连 (User-centric)
AutoAds 前端采用**用户直连模式**，每个用户拥有独立的数据命名空间，无需组织层概念。

### 核心特点
- **简化路由**: 移除组织 UUID，URL 平均减少 47%
- **直接隔离**: 数据基于 `user_id` 过滤，无需复杂的组织成员关系
- **更好性能**: RLS 策略简化，减少 60% 数据库查询
- **清晰权限**: RBAC 基于用户角色，而非组织成员角色

### 路由结构
采用扁平化路由架构，URL 简洁直观：
```
/
├── auth/              # 认证页面 (Google OAuth)
├── dashboard/         # 用户仪表盘
├── offers/            # Offers 管理
├── tasks/             # Tasks 管理
├── adscenter/         # 广告中心
├── settings/          # 设置 (profile, tokens, subscription)
└── manage/            # 管理后台 (仅管理员)
```

### 认证与权限
- **认证方式**: Supabase Auth (仅支持 Google OAuth)
- **Token**: JWT验证
- **数据隔离**: Row Level Security (RLS) 基于 `user_id`
- **权限控制**: RBAC (Role-Based Access Control)
  - 普通用户: `UserRole.User`
  - 管理员: `UserRole.Admin` (映射自 Supabase `app_metadata.role = GlobalRole.SuperAdmin`)
  - 管理员专属路由: `/manage` (后台管理系统)

## 数据库架构

### 用户数据三层架构
```
Layer 1: Supabase auth.users (认证层)
  ↓ 权威认证数据源
  • Google OAuth认证
  • JWT Token签发
  • 会话管理
  • 用户资料视图 (public.user_profiles, 22字段)

Layer 2: Cloud SQL user.users (业务用户层)
  ↓ 业务用户主域
  • 用户基础信息、状态管理、个性化设置

Layer 3: Cloud SQL billing.accounts (计费层)
  ↓ 计费域数据
  • 订阅管理、代币余额、交易记录、支付方式
```

**数据流向**: Supabase认证 → Cloud SQL业务数据，单向数据流避免冲突

### Supabase PostgreSQL (认证专用数据库)
- **用途**: 用户认证、JWT管理、OAuth集成
- **数据库**: PostgreSQL (高性能优化)
- **连接方式**: Management API (推荐) + Supabase CLI + psql直连 (备用)
- **表结构**:
  - `auth.users` - 用户认证数据 (Supabase自动管理，权威数据源)
  - `auth.identities` - 身份验证数据 (Supabase自动管理)
  - `public.user_profiles` - 用户资料视图 (基于auth.users，22字段)
  - `public.user_profiles_indexed` - 高性能物化视图
  - `public.user_profiles_stats` - 统计物化视图
  - `public.supabase_config` - 系统配置表
- **优化特性**:
  - 查询性能提升90%+
  - 便捷查询函数: get_user_profile(), get_active_users(), get_admin_users()
  - 完整的权限控制和安全配置
  - 符合三层用户架构设计

### Cloud SQL PostgreSQL (统一业务数据存储)
- **实例信息**: autoads (PostgreSQL 17)
- **数据库**: autoads_db (统一业务数据库)
- **区域**: asia-northeast1
- **连接方式**: Cloud SQL Proxy + Unix Socket
- **架构**: 微服务Schema自治 (1:1映射)

### 微服务Schema架构 (8个独立域)
**服务-Schema映射关系**:
```
服务名称          →  Schema名称       →  迁移文件位置
────────────────────────────────────────────────────────────
user             →  user            →  services/user/migrations/
billing          →  billing         →  services/billing/migrations/
useractivity     →  useractivity    →  services/useractivity/migrations/
offer            →  offer           →  services/offer/migrations/
siterank         →  siterank        →  services/siterank/migrations/
console          →  console         →  services/console/migrations/
adscenter        →  adscenter       →  services/adscenter/migrations/
batchopen        →  batchopen       →  services/batchopen/migrations/
```

**核心Schema详情**:
- **user**: 业务用户主域 (Layer 2: 业务用户层)
- **billing**: 计费订阅域 (Layer 3: 计费层，8个表)
- **useractivity**: 用户活动分析、通知管理 (10个表)
- **offer**: Offer管理系统 (6个表)
- **siterank**: 网站评估分析 (5个表)
- **console**: 管理后台、系统配置 (12个表)
- **adscenter**: 广告账户管理 (9个表)
- **batchopen**: 补点击任务系统 (7个表)

## 后端微服务架构

### API+Worker架构拆分
- **siterank-api**: HTTP API服务 (0.5 CPU, 512MB)
  - 接受评估请求，发布任务到Pub/Sub
  - 响应时间: <50ms (异步模式)
- **siterank-worker**: 后台Worker服务 (1 CPU, 1GB)
  - 监听Pub/Sub任务队列
  - 执行CPU密集型评估任务
- **browser-exec + browser-exec-worker**: 浏览器自动化 (API + Worker拆分)
- **其他服务**: billing, offer, adscenter, console, useractivity, batchopen等

### 数据库适配器模式
**推荐模式**: HybridDatabaseManager + pgxpool直连 + Supabase直连
- **HybridDatabaseManager**: 混合管理Cloud SQL (pgxpool) + Supabase (官方SDK + psql直连)
- **DatabaseManager**: 标准化的Cloud SQL连接池管理器 (pkg/database)
- **SupabaseClient**: 官方Supabase Go SDK包装器 (pkg/supabase) + 直接psql连接能力
- **错误处理**: 完整的错误处理、重试机制、超时控制

**Supabase连接特性**:
- **推荐方式**: Management API (认证用户管理) + Supabase CLI (数据库管理)
- **备用方式**: psql直连 + PgBouncer (网络连接不稳定)
- **API管理**: 使用service_role_key进行用户CRUD操作
- **性能优化**: 物化视图查询响应时间 < 5ms
- **安全配置**: PgBouncer连接池 + SSL加密 + JWT验证
- **权限控制**: authenticated用户权限控制

#### 本地Supabase数据库操作

**项目信息**:
- Project Ref: `jzzvizacfyipzdyiqfzb`
- Project URL: `https://jzzvizacfyipzdyiqfzb.supabase.co`
- 凭证密钥: `secrets/supabase-credentials.json`

**操作方法 (按优先级)**:

**1. Management API** - 用户管理 (推荐)
```bash
# 获取用户列表
curl -X GET "https://jzzvizacfyipzdyiqfzb.supabase.co/auth/v1/admin/users" \
  -H "Authorization: Bearer $SERVICE_KEY" -H "apikey: $ANON_KEY"

# 删除用户
curl -X DELETE "https://jzzvizacfyipzdyiqfzb.supabase.co/auth/v1/admin/users/USER_ID" \
  -H "Authorization: Bearer $SERVICE_KEY" -H "apikey: $ANON_KEY"
```

**2. Supabase CLI** - 数据库管理 (推荐)
```bash
supabase login
supabase link --project-ref jzzvizacfyipzdyiqfzb
supabase db shell
```

**3. psql直连** - 备用方案 (网络不稳定)
```bash
psql "postgresql://postgres:$PASSWORD@db.jzzvizacfyipzdyiqfzb.supabase.co:5432/postgres"
```

**使用原则**:
- ✅ 用户操作: Management API (稳定)
- ✅ 数据库操作: Supabase CLI (官方)
- ❌ psql直连: 仅作备用

## 数据库初始化和操作管理

### 🚀 完整数据库初始化（推荐）

**一键式初始化脚本**（3-5分钟完成）：
```bash
# 执行完整数据库初始化
./scripts/db/optimized-db-initialization.sh
```

**自动化流程**：
- ✅ 环境预检查（GCP认证、Secret Manager、数据库连接）
- ✅ 创建初始化前备份
- ✅ 智能迁移（跳过已存在的Schema）
- ✅ 创建初始化后备份
- ✅ 执行性能健康检查
- ✅ 生成详细初始化报告

**预期结果**（基于2025-10-23实际执行）：
- Schema数量：9个
- 表数量：79张表
- 索引数量：264个索引
- 数据库大小：约14MB

### 🔧 日常数据库操作工具

AutoAds提供完整的数据库操作工具集，支持快速DML/DDL操作、变更管理和安全保护。

#### 核心工具概览
| 工具 | 功能 | 适用场景 |
|------|------|----------|
| **quick-db-ops.sh** | 快速DML/DDL操作 | 日常开发、数据调试、快速变更 |
| **db-safety-net-simple.sh** | 安全检查点和回滚 | 重要操作保护、快速恢复 |
| **optimized-db-initialization.sh** | 完整数据库初始化 | 新环境部署、数据库重建 |

#### 快速操作示例
```bash
# 1. 创建安全检查点
./scripts/db/db-safety-net-simple.sh checkpoint "dev_session"

# 2. 快速数据查询
./scripts/db/quick-db-ops.sh query "SELECT COUNT(*) FROM user.users;"

# 3. JSON格式数据插入
./scripts/db/quick-db-ops.sh dml users INSERT '{
  "name": "测试用户",
  "email": "test@example.com",
  "status": "active"
}'

# 4. Schema变更
./scripts/db/quick-db-ops.sh ddl CREATE INDEX idx_user_email ON user.users(email)

# 5. 验证操作结果
./scripts/db/quick-db-ops.sh query "EXPLAIN ANALYZE SELECT * FROM user.users WHERE email='test@example.com';"

# 6. 清理检查点
./scripts/db/db-safety-net-simple.sh cleanup 1  # 清理1天前的检查点
```

### 📋 数据库迁移管理

#### 迁移文件结构
**迁移文件位置**: `services/*/migrations/`

**文件命名规范**:
```
000001_create_user_domain_schema.up.sql
000001_create_user_domain_schema.down.sql
000002_add_indexes.up.sql
000002_add_indexes.down.sql
```

#### CI/CD自动化迁移（生产环境）

**触发条件**：
- Push到`main`分支
- 修改了`services/*/migrations/**`文件

**执行流程**：
1. GitHub Actions自动检测迁移文件变更
2. 构建db-migrator镜像
3. 并行执行所有服务迁移（user优先，其他并行）
4. 生成迁移报告和验证

**手动触发迁移**：
```bash
# 访问GitHub Actions页面
# https://github.com/xxrenzhe/autoads/actions/workflows/database-migration-cloudrun.yml
# 点击 "Run workflow" → 选择环境 → 执行
```

#### 本地开发迁移

**快速配置访问权限**：
```bash
# 自动配置本地访问权限
./scripts/db/setup-local-db-access.sh
```

**直接执行迁移**：
```bash
# 使用便捷连接脚本
./scripts/db/connect-local-db.sh "SELECT version();"

# 执行单个迁移文件
./scripts/db/connect-local-db.sh -f services/user/migrations/000001_create_user_domain_schema.up.sql
```

### 🛡️ 安全网关和备份系统

#### 安全检查点管理
```bash
# 创建检查点
./scripts/db/db-safety-net-simple.sh checkpoint "before_major_update"

# 查看所有检查点
./scripts/db/db-safety-net-simple.sh list

# 回滚到指定检查点
./scripts/db/db-safety-net-simple.sh rollback CKP20231023_143022_before_major_update

# 清理过期检查点
./scripts/db/db-safety-net-simple.sh cleanup 7  # 清理7天前的检查点
```

#### 自动备份机制
- **初始化前备份**: 自动创建pre_initialization备份
- **初始化后备份**: 自动创建post_initialization备份
- **操作前备份**: 重要操作前自动创建检查点
- **智能清理**: 自动清理过期备份节省存储空间

### 📊 完整工具生态系统

#### 工具选择指南
| 操作类型 | 推荐工具 | 命令示例 |
|---------|----------|----------|
| **完整初始化** | optimized-db-initialization.sh | `./scripts/db/optimized-db-initialization.sh` |
| **快速查询** | quick-db-ops.sh | `./scripts/db/quick-db-ops.sh query "SELECT * FROM users;"` |
| **数据插入** | quick-db-ops.sh | `./scripts/db/quick-db-ops.sh dml users INSERT '{"name":"test"}'` |
| **Schema变更** | quick-db-ops.sh | `./scripts/db/quick-db-ops.sh ddl ALTER TABLE users "ADD COLUMN test VARCHAR(100)"` |
| **安全检查点** | db-safety-net-simple.sh | `./scripts/db/db-safety-net-simple.sh checkpoint "操作名称"` |

#### 高级功能
- **JSON格式支持**: 支持JSON格式数据进行批量操作
- **多种输出格式**: 表格、JSON、CSV格式查询结果
- **交互式SQL**: 实时SQL执行环境
- **批量操作**: 支持文件执行和批量数据处理
- **事务保护**: 所有操作都在事务中执行，失败自动回滚

### 📁 文件结构

```
scripts/db/
├── optimized-db-initialization.sh    # 完整数据库初始化
├── quick-db-ops.sh                   # 快速DML/DDL操作
├── db-safety-net-simple.sh           # 安全检查点和回滚
├── setup-local-db-access.sh          # 本地访问配置
├── connect-local-db.sh               # 便捷连接脚本
├── COMPLETE_DATABASE_INITIALIZATION_GUIDE.md  # 完整使用指南
├── logs/                             # 操作日志目录
└── backups/                          # 备份文件目录
```

### ⚠️ 重要注意事项

#### 环境共享
- **开发环境**: 直接连接预发环境数据库，无独立开发数据库
- **预发/生产**: 共用同一Cloud SQL实例，确保数据一致性
- **操作影响**: 所有环境操作都会影响预发和生产环境

#### 安全原则
- ✅ **操作前检查点**: 重要操作前创建安全检查点
- ✅ **Secret管理**: 使用Secret Manager管理凭据，禁止硬编码
- ✅ **权限最小化**: 只授予必要的数据库访问权限
- ✅ **审计追踪**: 完整记录所有操作和状态变更

#### 性能优化
- **连接管理**: 使用pgxpool连接池，支持高并发
- **索引优化**: 264个优化索引，查询响应时间<10ms
- **批量操作**: 支持批量数据处理，避免长事务
- **监控告警**: 集成性能监控和慢查询告警

### 迁移最佳实践

#### 📁 文件规范
- **迁移文件必须幂等** (`IF NOT EXISTS`, `CREATE OR REPLACE`)
- **每个`.up.sql`必须有对应的`.down.sql`
- **使用事务确保原子性**
- **遵循PostgreSQL关键字规范** (如user需要加引号)

#### 🧪 测试流程
- **本地语法验证**: 使用本地公网访问测试SQL语法
- **开发环境验证**: 直接执行验证功能正确性
- **数据一致性检查**: 验证迁移前后数据完整性
- **性能影响评估**: 评估迁移对现有数据的影响

#### 👥 团队协作
- **Code Review**: 所有迁移文件必须经过code review
- **影响评估**: 评估对其他服务和功能的影响
- **时间窗口**: 选择合适的业务低峰期执行生产迁移
- **回滚准备**: 准备完整的回滚方案和`.down.sql`脚本

#### 🔒 安全原则
- **权限控制**: 只有授权人员可以执行生产环境迁移
- **网络环境**: 确保执行迁移的网络环境安全
- **备份策略**: 重要迁移前必须创建数据备份
- **操作记录**: 详细记录迁移操作的时间、内容、执行人

#### 📋 执行检查清单
**开发环境迁移** (影响预发和生产环境):
- [ ] SQL语法正确性验证
- [ ] 迁移文件幂等性检查
- [ ] 本地测试通过
- [ ] 评估对现有环境的影响
- [ ] 团队内部确认无风险

**生产环境迁移** (影响预发和生产环境):
- [ ] 团队确认和审批完成
- [ ] 数据库备份已完成
- [ ] 网络环境安全确认
- [ ] 迁移脚本review通过
- [ ] 执行时间和窗口确认
- [ ] 预发和生产环境监控准备就绪
- [ ] 回滚方案准备完毕
- [ ] 应急联系人和响应计划确认

## 技术栈总结

### 前端技术栈
- **框架**: Next.js 14 (App Router) + Makerkit UI
- **认证**: Supabase Auth (Google OAuth)
- **部署**: Cloud Run (frontend/frontend-preview)
- **域名**: www.autoads.dev (生产) / www.urlchecker.dev (预发)
- **构建模式**: Standalone Output (优化部署体积)
- **路由规范**: 扁平化路由（/offers, /tasks, /adscenter）

### 后端技术栈
- **语言**: Go (微服务)
- **部署**: Cloud Run (容器托管)
- **数据库**: Cloud SQL (PostgreSQL)
- **认证**: Supabase Go SDK + JWT验证
- **AI集成**: Genkit Go框架

### 基础设施
- **云平台**: Google Cloud Platform
- **容器**: Cloud Run (无服务器容器)
- **数据库**: Cloud SQL + Supabase PostgreSQL
- **存储**: Artifact Registry (镜像仓库)
- **密钥**: Secret Manager (密钥管理)
- **网络**:
  - **内网访问**: Cloud SQL Proxy + Unix Socket (生产环境容器内)
  - **公网访问**: 直接IP连接 (开发/本地环境)
- **CI/CD**: GitHub Actions + Cloud Build
- **数据库迁移**: 本地直接执行 (30秒完成)

## 🚀 v4.0 用户认证流程状态 (2025-10-23更新)

### 最终状态

AutoAds在v4.0中完成了用户认证流程的关键优化，确保用户注册和登录的可靠性：

### ✅ 核心特性

1. **智能业务数据检查**: 不再依赖Supabase元数据，通过API验证业务数据完整性
2. **自动初始化**: 检测到缺失数据时自动创建完整的三层架构数据
3. **增强错误处理**: 用户友好的错误提示和国际化支持
4. **数据一致性**: 事务性数据创建，确保Layer 1-2-3数据完整性

### 🎯 用户登录状态

用户登录后会自动进入以下状态之一：

- **🟢 正常状态**: 业务数据完整，直接进入Dashboard
- **🟡 初始化状态**: 自动创建缺失的业务数据，完成后进入Dashboard
- **🔴 错误状态**: 显示用户友好错误信息，支持重试操作

### 🔄 v4.0 认证流程图

**简化版流程图**:
```
用户登录请求
  ↓
1️⃣ Supabase OAuth认证
  ↓
2️⃣ JWT获取 + Session创建
  ↓
3️⃣ 业务数据完整性检查
  ↓
┌─────────────────────┐
│  数据存在？      │
├─────────────────────┤
│ ✓ 是 → 正常登录  │
│ ✗ 否 → 自动初始化 │
└─────────────────────┘
  ↓
4️⃣ 自动数据创建 (事务性三层架构)
  ↓
5️⃣ 用户进入Dashboard
```

**关键优化**:
- ❌ 不再依赖 `user_metadata.new_user`
- ✅ 智能业务数据完整性检查
- ✅ 自动三层架构数据创建
- ✅ 增强错误处理和国际化

### 📊 关键改进

| 改进方面 | 状态 | 说明 |
|------------|------|------|
| **可靠性** | ✅ 完成 | 移除不可靠的Supabase元数据依赖 |
| **用户体验** | ✅ 完成 | 智能检测和自动初始化流程 |
| **错误处理** | ✅ 完成 | 完整的错误边界和国际化支持 |
| **数据一致性** | ✅ 完成 | 事务性三层数据创建保证 |

用户现在可以享受流畅、可靠的注册和登录体验。

---

**架构原则**: KISS 简化原则、混合架构优势、标准化工具、高性能优化