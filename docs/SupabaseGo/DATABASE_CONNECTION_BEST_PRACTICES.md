# 数据库连接最佳实践方案

## 问题分析

当前系统面临的核心数据库问题：
1. **双数据库架构复杂**: Supabase PostgreSQL (用户认证) + Cloud SQL PostgreSQL (应用数据)
2. **连接方式混乱**: 每次变更都需要重新查找连接方式
3. **环境变量分散**: 数据库配置散布��多个地方
4. **初始化模式不统一**: 不同服务使用不同的DDL模式
5. **缺乏统一的数据库管理工具**

## 解决方案架构

### 1. 统一数据库连接层

创建 `pkg/database/` 包，统一管理所有数据库连接：

```go
// pkg/database/config.go
type DatabaseConfig struct {
    Type         string // "supabase" | "cloudsql"
    Connection   string // 连接字符串
    MaxOpenConns int
    MaxIdleConns int
    MaxLifetime  time.Duration
}

// pkg/database/manager.go
type DatabaseManager struct {
    Supabase *sql.DB
    CloudSQL *sql.DB
    configs  map[string]DatabaseConfig
}
```

### 2. 环境变量标准化

制定统一的环境变量命名规范：

```bash
# Supabase连接 (用户认证)
SUPABASE_DB_URL=postgresql://postgres.jzzvizacfyipzdyiqfzb:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
SUPABASE_SERVICE_KEY=[SERVICE_ROLE_KEY]

# Cloud SQL连接 (应用数据)
CLOUDSQL_DB_URL=postgresql://user:password@10.6.0.2:5432/autoads_db
CLOUDSQL_DB_HOST=10.6.0.2
CLOUDSQL_DB_PORT=5432
CLOUDSQL_DB_NAME=autoads_db
CLOUDSQL_DB_USER=[USERNAME]
CLOUDSQL_DB_PASSWORD=[PASSWORD]
```

### 3. 数据库初始化标准化

根据MustKnowV7.md，统一DDL模式：

```go
// pkg/database/init.go
type DatabaseInitializer interface {
    EnsureSchema(db *sql.DB) error
    GetVersion() string
    Migrate(from, to string) error
}
```

### 4. 服务数据库映射

明确每个服务使用的数据库：

| 服务 | 数据库类型 | 主要表 | DDL模式 |
|------|-----------|--------|---------|
| useractivity | Cloud SQL | user_notifications, checkins, referrals | Mode2: 代码内嵌 |
| billing | Cloud SQL | subscriptions, trial_subscriptions | Mode1: 迁移文件 |
| offer | Cloud SQL | offers, campaigns | Mode2: 代码内嵌 |
| siterank | Cloud SQL | sites, rankings | Mode1: 迁移文件 |
| Frontend | Supabase | auth.users, profiles | Supabase内置 |

## 实施计划

### Phase 1: 创建数据库管理包

1. **创建pkg/database结构**
   ```
   pkg/database/
   ├── config.go          # 配置管理
   ├── manager.go         # 数据库管理器
   ├── supabase.go        # Supabase连接管理
   ├── cloudsql.go        # Cloud SQL连接管理
   ├── init.go           # 初始化接口
   └── health.go         # 健康检查
   ```

2. **实现统一连接逻辑**
   ```go
   func ConnectSupabase() (*sql.DB, error)
   func ConnectCloudSQL() (*sql.DB, error)
   func GetDatabase(service, dbType string) (*sql.DB, error)
   ```

### Phase 2: 环境变量统一

1. **更新configs/environment/variables.json**
   - 添加CLOUDSQL_DB_URL等标准变量
   - 标记每个服务使用的数据库类型

2. **创建.env.example模板**
   ```bash
   # Database Configuration
   SUPABASE_DB_URL=postgresql://...
   CLOUDSQL_DB_URL=postgresql://...

   # Service Database Mapping
   USERACTIVITY_DB=cloudsql
   BILLING_DB=cloudsql
   OFFER_DB=cloudsql
   FRONTEND_DB=supabase
   ```

### Phase 3: DDL标准化

1. **创建统一的DDL执行器**
   ```go
   func EnsureDatabaseSchema(service string, db *sql.DB) error
   func ValidateDatabaseSchema(service string, db *sql.DB) error
   ```

2. **为每个服务创建DDL清单**
   ```yaml
   # services/useractivity/database.yaml
   service: useractivity
   database: cloudsql
   tables:
     - user_notifications
     - checkins
     - referrals
   ddl_mode: embedded
   version: "1.0.0"
   ```

### Phase 4: 工具和脚本

1. **数据库管理CLI工具**
   ```bash
   ./scripts/db/manage init useractivity    # 初始化数据库
   ./scripts/db/manage migrate billing      # 运行迁移
   ./scripts/db/manage status              # 检查所有数据库状态
   ./scripts/db/manage connect useractivity # 连接到服务数据库
   ```

2. **健康检查和监控**
   ```go
   func CheckAllDatabases() map[string]DatabaseStatus
   func MonitorDatabaseConnections()
   ```

### Phase 5: 文档和培训

1. **创建数据库操作手册**
   - 连接方式快速参考卡
   - 常见问题排查指南
   - 变更操作检查清单

2. **自动化验证**
   ```yaml
   # .github/workflows/db-validation.yml
   name: Database Schema Validation
   on: [push, pull_request]
   jobs:
     validate-schemas:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - name: Validate Database Schemas
           run: ./scripts/db/validate-all.sh
   ```

## 立即可执行的临时解决方案

在完整方案实施前，立即创建一个快速参考工具：

### 1. 创建数据库连接参考脚本
```bash
#!/bin/bash
# scripts/db/quick-connect.sh

SERVICE=$1
DB_TYPE=${2:-"auto"}

case $SERVICE in
  "useractivity"|"billing"|"offer"|"siterank"|"adscenter")
    echo "🔗 Connecting to Cloud SQL for $SERVICE..."
    gcloud sql connect autoads --user=postgres --database=autoads_db
    ;;
  "frontend"|"auth")
    echo "🔗 Connecting to Supabase..."
    psql "postgresql://postgres.jzzvizacfyipzdyiqfzb:\${SUPABASE_DB_PASSWORD}@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
    ;;
  *)
    echo "❓ Unknown service: $SERVICE"
    echo "Available services: useractivity, billing, offer, siterank, adscenter, frontend, auth"
    ;;
esac
```

### 2. 创建��据库状态检查脚本
```bash
#!/bin/bash
# scripts/db/status-check.sh

echo "📊 Database Status Overview"
echo "========================="

echo "🔍 Cloud SQL Services:"
gcloud run services list --filter="useractivity OR billing OR offer" --format="table(service.name, status.latestReadyRevisionName, status.url)"

echo ""
echo "🔍 Supabase Connection:"
psql "postgresql://postgres.jzzvizacfyipzdyiqfzb:\${SUPABASE_DB_PASSWORD}@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres" -c "SELECT current_database(), current_user, version();"

echo ""
echo "🔍 Cloud SQL Connection:"
gcloud sql connect autoads --user=postgres --database=autoads_db -c "SELECT current_database(), current_user, version();"
```

### 3. 更新文档参考卡
```markdown
# 数据库连接快速参考卡

## Cloud SQL (应用数据)
- **Host**: 10.6.0.2:5432 (VPC内部)
- **Database**: autoads_db
- **连接命令**: `gcloud sql connect autoads --user=postgres --database=autoads_db`
- **使用服务**: useractivity, billing, offer, siterank, adscenter

## Supabase (用户认证)
- **Host**: aws-1-ap-northeast-1.pooler.supabase.com:5432
- **Database**: postgres
- **连接命令**: `psql "postgresql://postgres.jzzvizacfyipzdyiqfzb:[PASSWORD]@.../postgres"`
- **使用服务**: frontend, auth

## 环境变量
- **CLOUDSQL_DB_URL**: postgresql://user:password@10.6.0.2:5432/autoads_db
- **SUPABASE_DB_URL**: postgresql://postgres.project_ref@pooler.supabase.com:5432/postgres
```

## 预期效果

实施这个方案后：
1. **统一接口**: 所有数据库连接通过统一的管理器
2. **自动配置**: 环境变量自动加载，无需记忆
3. **标准化DDL**: 统一的数据库初始化和迁移流程
4. **工具支持**: 提供CLI工具简化操作
5. **监控保障**: 自动化健康检查和状态监控
6. **文档完善**: 快速参考卡和详细操作指南

## 优先级建议

**立即执行** (今天就能完成):
1. 创建快速参考脚本
2. 更新环境变量配置文档
3. 创建连接状态检查脚本

**短期实施** (本周内完成):
1. 实施pkg/database统一管理包
2. 标准化所有服务的数据库连接
3. 创建DDL清单和验证工具

**长期优化** (下周完成):
1. 完整的CLI管理工具
2. 自动化监控和告警
3. 完善的文档和培训材料

这个方案将彻底解决数据库连接和变更的问题，让开发者能够专注于业务逻辑而不是数据库基础设施的复杂性。