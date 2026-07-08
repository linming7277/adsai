# DB-Admin替代方案设计

**文档版本**: v1.0
**创建日期**: 2025-10-20
**设计目标**: 移除db-admin服务，实现更简洁高效的数据库管理架构

---

## 🎯 **核心设计原则**

```yaml
设计理念:
  - 云原生优先: 利用云厂商提供的数据库管理能力
  - 自动化驱动: 通过CI/CD和工具链实现自动化管理
  - 去中心化: 各服务负责自己的数据库管理
  - 可观测性: 完善的监控和追踪机制

技术选择:
  - 迁移工具: Flyway/Liquibase/自定义Go工具
  - Schema管理: YAML定义 + 版本控制
  - 执行管理: CI/CD集成 + 环境隔离
  - 监控观测: OpenTelemetry + Prometheus
```

---

## 📋 **替代方案总览**

### **方案架构对比**
```yaml
当前架构:
  各服务 → db-admin → 数据库

目标架构:
  各服务 → UnifiedDatabaseAdapter → 数据库
           ↓
  迁移工具 → 数据库 (Schema管理)
           ↓
  CI/CD → 数据库 (执行管理)
```

---

## 🏗️ **1. 数据库Schema统一管理**

### **方案A: 版本化YAML定义 + Go迁移工具**

#### **1.1 Schema定义结构**
```
migrations/
├── user-domain/           # 用户域Schema
│   ├── 001_create_user_profiles.yaml
│   ├── 002_create_user_subscriptions.yaml
│   └── 003_create_user_notifications.yaml
├── activity-domain/        # 活动域Schema
│   ├── 001_create_user_notifications.yaml
│   ├── 002_create_checkins.yaml
│   └── 003_create_referrals.yaml
├── offer-domain/          # Offer域Schema
│   ├── 001_create_offers.yaml
│   ├── 002_create_offer_analyses.yaml
│   └── 003_create_offer_keywords.yaml
└── billing-domain/        # 计费域Schema
    ├── 001_create_accounts.yaml
    ├── 002_create_transactions.yaml
    └── 003_create_subscriptions.yaml
```

#### **1.2 Schema定义示例**
```yaml
# migrations/user-domain/001_create_user_profiles.yaml
version: "001"
domain: "user-domain"
database: "supabase"
description: "创建用户基础信息表"

tables:
  - name: "user_profiles"
    description: "用户基础信息表"
    columns:
      - name: "user_id"
        type: "UUID"
        primary_key: true
        description: "用户唯一标识"
      - name: "email"
        type: "VARCHAR(255)"
        not_null: true
        unique: true
        description: "用户邮箱"
      - name: "display_name"
        type: "VARCHAR(100)"
        description: "显示名称"
      - name: "photo_url"
        type: "TEXT"
        nullable: true
        description: "头像URL"
      - name: "created_at"
        type: "TIMESTAMPTZ"
        not_null: true
        default: "NOW()"
        description: "创建时间"
      - name: "updated_at"
        type: "TIMESTAMPTZ"
        not_null: true
        default: "NOW()"
        description: "更新时间"

indexes:
  - name: "idx_user_profiles_email"
    columns: ["email"]
    unique: true
  - name: "idx_user_profiles_created_at"
    columns: ["created_at"]

constraints:
  - name: "ck_user_profiles_email_format"
    check: "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'"
```

#### **1.3 Schema管理工具**
```go
// pkg/migrator/schema_manager.go
package migrator

import (
    "fmt"
    "gopkg.in/yaml.v2"
    "io/ioutil"
    "path/filepath"
)

type SchemaManager struct {
    migrationsDir string
    schemas       map[string]*DomainSchema
}

type DomainSchema struct {
    Version    string        `yaml:"version"`
    Domain     string        `yaml:"domain"`
    Database   string        `yaml:"database"`
    Tables     []TableDef    `yaml:"tables"`
    Indexes    []IndexDef    `yaml:"indexes"`
    Constraints []ConstraintDef `yaml:"constraints"`
}

func NewSchemaManager(migrationsDir string) *SchemaManager {
    return &SchemaManager{
        migrationsDir: migrationsDir,
        schemas:       make(map[string]*DomainSchema),
    }
}

func (sm *SchemaManager) LoadSchemas() error {
    // 加载所有域的Schema定义
    domains := []string{"user-domain", "activity-domain", "offer-domain", "billing-domain"}

    for _, domain := range domains {
        domainDir := filepath.Join(sm.migrationsDir, domain)
        files, err := ioutil.ReadDir(domainDir)
        if err != nil {
            return fmt.Errorf("failed to read domain directory %s: %w", domainDir, err)
        }

        for _, file := range files {
            if filepath.Ext(file.Name()) != ".yaml" {
                continue
            }

            schemaPath := filepath.Join(domainDir, file.Name())
            schemaData, err := ioutil.ReadFile(schemaPath)
            if err != nil {
                return fmt.Errorf("failed to read schema file %s: %w", schemaPath, err)
            }

            var schema DomainSchema
            if err := yaml.Unmarshal(schemaData, &schema); err != nil {
                return fmt.Errorf("failed to parse schema file %s: %w", schemaPath, err)
            }

            sm.schemas[domain+"_"+schema.Version] = &schema
        }
    }

    return nil
}

func (sm *SchemaManager) GetDomainSchemas(domain string) []*DomainSchema {
    var schemas []*DomainSchema
    prefix := domain + "_"

    for key, schema := range sm.schemas {
        if strings.HasPrefix(key, prefix) {
            schemas = append(schemas, schema)
        }
    }

    // 按版本排序
    sort.Slice(schemas, func(i, j int) bool {
        return schemas[i].Version < schemas[j].Version
    })

    return schemas
}
```

### **方案B: 数据库即代码 (Database-as-Code)**

#### **2.1 使用Terraform管理数据库资源**
```hcl
# terraform/database/supabase/main.tf
resource "supabase_database" "adsai" {
  name = "adsai_db"
  project_id = var.supabase_project_id
}

resource "supabase_table" "user_profiles" {
  database_id = supabase_database.adsai.id
  name = "user_profiles"
  schema = "public"

  columns = [
    {
      name = "user_id"
      type = "uuid"
      primary_key = true
      default = "uuid_generate_v4()"
    },
    {
      name = "email"
      type = "varchar(255)"
      not_null = true
      unique = true
    },
    {
      name = "display_name"
      type = "varchar(100)"
      nullable = true
    },
    {
      name = "created_at"
      type = "timestamptz"
      not_null = true
      default = "now()"
    }
  ]
}

resource "supabase_index" "user_profiles_email" {
  database_id = supabase_database.adsai.id
  table_id = supabase_table.user_profiles.id
  columns = ["email"]
  unique = true
}
```

---

## 🔄 **2. 迁移操作集中化**

### **方案A: 统一迁移工具**

#### **2.1 迁移工具架构**
```go
// pkg/migrator/migrator.go
package migrator

import (
    "context"
    "database/sql"
    "fmt"
    "time"

    "github.com/linming7277/adsai/pkg/database"
)

type Migrator struct {
    adapter       *database.UnifiedDatabaseAdapter
    schemaManager *SchemaManager
    executor      *MigrationExecutor
}

type Migration struct {
    Version     string
    Domain      string
    Database    string
    Description string
    SQL         string
    Checksum    string
    AppliedAt   *time.Time
}

type MigrationExecutor struct {
    db *sql.DB
}

func NewMigrator(adapter *database.UnifiedDatabaseAdapter, migrationsDir string) *Migrator {
    schemaManager := NewSchemaManager(migrationsDir)

    return &Migrator{
        adapter:       adapter,
        schemaManager: schemaManager,
        executor:      NewMigrationExecutor(adapter),
    }
}

func (m *Migrator) ExecuteMigrations(ctx context.Context, domains ...string) error {
    // 1. 加载Schema定义
    if err := m.schemaManager.LoadSchemas(); err != nil {
        return fmt.Errorf("failed to load schemas: %w", err)
    }

    // 2. 为每个域执行迁移
    for _, domain := range domains {
        schemas := m.schemaManager.GetDomainSchemas(domain)

        for _, schema := range schemas {
            // 3. 确定目标数据库
            dbType := m.getDatabaseType(schema.Database)

            // 4. 生成SQL
            sql, err := m.generateSQL(schema)
            if err != nil {
                return fmt.Errorf("failed to generate SQL for %s: %w", domain, err)
            }

            // 5. 执行迁移
            if err := m.executeMigration(ctx, dbType, schema, sql); err != nil {
                return fmt.Errorf("failed to execute migration for %s: %w", domain, err)
            }
        }
    }

    return nil
}

func (m *Migrator) getDatabaseType(dbName string) database.DatabaseType {
    switch dbName {
    case "supabase":
        return database.DatabaseTypeSupabase
    case "cloudsql":
        return database.DatabaseTypeCloudSQL
    default:
        return database.DatabaseTypeCloudSQL
    }
}

func (m *Migrator) generateSQL(schema *DomainSchema) (string, error) {
    // 将YAML Schema转换为SQL
    var sqlBuilder strings.Builder

    // 创建表
    for _, table := range schema.Tables {
        tableSQL := m.generateCreateTableSQL(table)
        sqlBuilder.WriteString(tableSQL)
        sqlBuilder.WriteString(";\n")
    }

    // 创建索引
    for _, index := range schema.Indexes {
        indexSQL := m.generateCreateIndexSQL(index)
        sqlBuilder.WriteString(indexSQL)
        sqlBuilder.WriteString(";\n")
    }

    // 创建约束
    for _, constraint := range schema.Constraints {
        constraintSQL := m.generateConstraintSQL(constraint)
        sqlBuilder.WriteString(constraintSQL)
        sqlBuilder.WriteString(";\n")
    }

    return sqlBuilder.String(), nil
}
```

#### **2.2 迁移状态管理**
```go
// pkg/migrator/migration_table.go
package migrator

type MigrationTracker struct {
    db *sql.DB
}

// 创建迁移记录表
func (mt *MigrationTracker) CreateMigrationTable(ctx context.Context) error {
    query := `
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(20) PRIMARY KEY,
            domain VARCHAR(50) NOT NULL,
            database VARCHAR(20) NOT NULL,
            description TEXT,
            checksum VARCHAR(64) NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_schema_migrations_domain
        ON schema_migrations(domain, applied_at);
    `

    _, err := mt.db.ExecContext(ctx, query)
    return err
}

// 检查迁移是否已应用
func (mt *MigrationTracker) IsMigrationApplied(ctx context.Context, version, domain string) (bool, error) {
    var applied bool
    query := `SELECT EXISTS(
        SELECT 1 FROM schema_migrations
        WHERE version = $1 AND domain = $2
    )`

    err := mt.db.QueryRowContext(ctx, query, version, domain).Scan(&applied)
    return applied, err
}

// 记录迁移应用
func (mt *MigrationTracker) RecordMigration(ctx context.Context, migration *Migration) error {
    query := `
        INSERT INTO schema_migrations
        (version, domain, database, description, checksum, applied_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (version, domain) DO UPDATE SET
        applied_at = EXCLUDED.applied_at,
        checksum = EXCLUDED.checksum
    `

    _, err := mt.db.ExecContext(ctx, query,
        migration.Version,
        migration.Domain,
        migration.Database,
        migration.Description,
        migration.Checksum,
        time.Now(),
    )

    return err
}
```

### **方案B: 使用成熟迁移工具**

#### **2.3 Flyway集成**
```yaml
# flyway.conf
flyway.url=jdbc:postgresql://localhost:5432/adsai_db
flyway.user=${DB_USER}
flyway.password=${DB_PASSWORD}
flyway.locations=classpath:db/migration
flyway.baselineOnMigrate=true
flyway.validateOnMigrate=true
```

```sql
-- V1__Create_user_profiles.sql
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(100),
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- I1__User_profiles_indexes.sql
CREATE INDEX IF NOT EXISTS idx_user_profiles_email
ON user_profiles(email);

CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at
ON user_profiles(created_at);
```

---

## ⚙️ **3. 迁移执行管理**

### **方案A: CI/CD集成**

#### **3.1 GitHub Actions工作流**
```yaml
# .github/workflows/database-migration.yml
name: Database Migration

on:
  push:
    paths:
      - 'migrations/**'
    branches: [main, develop]
  pull_request:
    paths:
      - 'migrations/**'
  workflow_dispatch:

env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
  CLOUDSQL_CONNECTION_STRING: ${{ secrets.CLOUDSQL_CONNECTION_STRING }}

jobs:
  validate-migrations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.25'

      - name: Validate Schema Definitions
        run: |
          go run ./tools/schema-validator \
            --migrations-dir migrations \
            --validate-only

      - name: Check Migration Syntax
        run: |
          go run ./tools/migrator \
            --dry-run \
            --migrations-dir migrations

  migrate-staging:
    needs: validate-migrations
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: staging

    steps:
      - uses: actions/checkout@v3

      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.25'

      - name: Execute Staging Migrations
        run: |
          go run ./tools/migrator \
            --environment staging \
            --migrations-dir migrations \
            --domains user-domain,activity-domain,offer-domain,billing-domain

      - name: Verify Migration Results
        run: |
          go run ./tools/health-checker \
            --environment staging

  migrate-production:
    needs: validate-migrations
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - uses: actions/checkout@v3

      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.25'

      - name: Backup Production Database
        run: |
          ./scripts/backup-production-db.sh

      - name: Execute Production Migrations (Manual Approval)
        run: |
          go run ./tools/migrator \
            --environment production \
            --migrations-dir migrations \
            --domains user-domain,activity-domain,offer-domain,billing-domain

      - name: Verify Production Migration
        run: |
          go run ./tools/health-checker \
            --environment production
```

#### **3.2 迁移工具CLI**
```go
// tools/migrator/main.go
package main

import (
    "flag"
    "log"
    "os"

    "github.com/linming7277/adsai/pkg/database"
    "github.com/linming7277/adsai/pkg/migrator"
)

func main() {
    var (
        migrationsDir = flag.String("migrations-dir", "migrations", "Migrations directory")
        environment   = flag.String("environment", "development", "Target environment")
        domains       = flag.String("domains", "", "Comma-separated list of domains to migrate")
        dryRun        = flag.Bool("dry-run", false, "Only show what would be executed")
        validateOnly  = flag.Bool("validate-only", false, "Only validate schema definitions")
    )
    flag.Parse()

    // 加载环境配置
    config := loadEnvironmentConfig(*environment)

    // 创建统一数据库适配器
    adapter, err := database.NewUnifiedDatabaseAdapter(config)
    if err != nil {
        log.Fatalf("Failed to create database adapter: %v", err)
    }
    defer adapter.Close()

    // 创建迁移器
    migratorInstance := migrator.NewMigrator(adapter, *migrationsDir)

    if *validateOnly {
        if err := migratorInstance.ValidateSchemas(); err != nil {
            log.Fatalf("Schema validation failed: %v", err)
        }
        log.Println("✅ All schemas are valid")
        return
    }

    // 解析域列表
    var targetDomains []string
    if *domains != "" {
        targetDomains = strings.Split(*domains, ",")
        for i, domain := range targetDomains {
            targetDomains[i] = strings.TrimSpace(domain)
        }
    } else {
        targetDomains = []string{"user-domain", "activity-domain", "offer-domain", "billing-domain"}
    }

    if *dryRun {
        if err := migratorInstance.DryRun(context.Background(), targetDomains); err != nil {
            log.Fatalf("Dry run failed: %v", err)
        }
        log.Println("✅ Dry run completed successfully")
        return
    }

    // 执行迁移
    log.Printf("🚀 Starting database migration for environment: %s", *environment)
    log.Printf("📋 Target domains: %v", targetDomains)

    if err := migratorInstance.ExecuteMigrations(context.Background(), targetDomains...); err != nil {
        log.Fatalf("Migration failed: %v", err)
    }

    log.Println("✅ Migration completed successfully")
}
```

### **方案B: 容器化迁移服务**

#### **3.3 Docker迁移容器**
```dockerfile
# tools/migrator/Dockerfile
FROM golang:1.25-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o migrator ./tools/migrator

FROM alpine:latest
RUN apk --no-cache add ca-certificates postgresql-client

WORKDIR /app
COPY --from=builder /app/migrator .
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts

CMD ["./migrator"]
```

```yaml
# docker-compose.migration.yml
version: '3.8'

services:
  migrator:
    build:
      context: .
      dockerfile: tools/migrator/Dockerfile
    environment:
      - ENVIRONMENT=${ENVIRONMENT:-development}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - CLOUDSQL_CONNECTION_STRING=${CLOUDSQL_CONNECTION_STRING}
    volumes:
      - ./migrations:/app/migrations
      - ./logs:/app/logs
    depends_on:
      - postgres
      - supabase
    command: ["./migrator", "--domains", "user-domain,activity-domain,offer-domain,billing-domain"]
```

---

## 📊 **监控和观测**

### **4.1 迁移监控指标**
```go
// pkg/migrator/metrics.go
package migrator

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    migrationDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "database_migration_duration_seconds",
            Help: "Duration of database migrations",
            Buckets: prometheus.DefBuckets,
        },
        []string{"domain", "database", "status"},
    )

    migrationCount = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "database_migrations_total",
            Help: "Total number of database migrations",
        },
        []string{"domain", "database", "status"},
    )

    schemaVersion = promauto.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "database_schema_version",
            Help: "Current schema version for each domain",
        },
        []string{"domain", "database"},
    )
)

func (m *Migrator) recordMigrationMetrics(domain, database, status string, duration time.Duration) {
    migrationDuration.WithLabelValues(domain, database, status).Observe(duration.Seconds())
    migrationCount.WithLabelValues(domain, database, status).Inc()
}
```

### **4.2 健康检查接口**
```go
// pkg/migrator/health.go
package migrator

type HealthChecker struct {
    migrator *Migrator
}

type HealthStatus struct {
    Overall     string                    `json:"overall"`
    Domains     map[string]DomainStatus   `json:"domains"`
    Timestamp   time.Time                 `json:"timestamp"`
}

type DomainStatus struct {
    Status       string    `json:"status"`
    Version      string    `json:"version"`
    LastMigration time.Time `json:"last_migration"`
    Error        string    `json:"error,omitempty"`
}

func (hc *HealthChecker) CheckHealth(ctx context.Context) (*HealthStatus, error) {
    status := &HealthStatus{
        Overall:   "healthy",
        Domains:   make(map[string]DomainStatus),
        Timestamp: time.Now(),
    }

    domains := []string{"user-domain", "activity-domain", "offer-domain", "billing-domain"}

    for _, domain := range domains {
        domainStatus, err := hc.checkDomainHealth(ctx, domain)
        if err != nil {
            status.Domains[domain] = DomainStatus{
                Status: "error",
                Error:  err.Error(),
            }
            status.Overall = "degraded"
            continue
        }

        status.Domains[domain] = *domainStatus
        if domainStatus.Status != "healthy" {
            status.Overall = "degraded"
        }
    }

    return status, nil
}
```

---

## 🎯 **实施建议**

### **推荐技术栈**
```yaml
Schema管理:
  - 主要方案: YAML定义 + Go迁移工具
  - 备选方案: Flyway/Liquibase (如果团队熟悉Java生态)

执行管理:
  - CI/CD: GitHub Actions (与现有工作流集成)
  - 容器化: Docker (可选，用于特定场景)
  - 环境隔离: 分环境配置管理

监控观测:
  - 指标: Prometheus + Grafana
  - 日志: 结构化日志 + ELK Stack
  - 追踪: OpenTelemetry
```

### **实施路线图**
```yaml
第1周: 工具开发
  - 开发Schema定义YAML格式
  - 实现Go迁移工具核心功能
  - 创建基础的CLI工具

第2周: CI/CD集成
  - 设计GitHub Actions工作流
  - 实现环境配置管理
  - 添加迁移验证和测试

第3周: 监控和测试
  - 集成Prometheus指标
  - 实现健康检查
  - 端到端测试验证

第4周: 部署和迁移
  - 在staging环境验证
  - 逐步替换db-admin功能
  - 生产环境部署
```

---

## 📋 **总结**

### **替代方案优势**
1. **简化架构**: 移除中间层，减少故障点
2. **云原生**: 利用云厂商管理能力
3. **自动化**: CI/CD集成，减少人工操作
4. **可观测**: 完善的监控和追踪
5. **成本效益**: 降低运维复杂度和成本

### **风险评估**
1. **工具开发成本**: 需要开发定制工具
2. **学习成本**: 团队需要学习新工具
3. **迁移风险**: 从db-admin迁移需要谨慎规划

### **结论**
移除db-admin并采用基于YAML Schema定义 + Go迁移工具 + CI/CD自动化的方案，能够更好地满足现代云原生应用的需求，同时提供更好的可维护性和扩展性。
```

