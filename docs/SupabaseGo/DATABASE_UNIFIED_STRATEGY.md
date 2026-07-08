# 数据库管理统一策略

## 概述

本文档制定 AdsAI 项目的数据库管理统一策略，旨在解决当前数据库管理分散、架构不一致的问题，实现统一的数据库管理目标。

## 🔍 当前问题分析

### 严重的架构不一致问题

#### 1. 分散的 DDL 代码
**发现的问题**:
- **useractivity 服务**: `internal/handlers/ddl.go` 包含完整的表创建逻辑
- **offer 服务**: `internal/handlers/ddl.go` 包含独立的 DDL 管理
- **siterank 服务**: `internal/handlers/ddl.go` 包含复杂的表结构定义
- **billing 服���**: 拥有独立的迁移工具 `cmd/migrator/main.go`
- **adscenter 服务**: 拥有独立的迁移工具 `cmd/migrator/main.go`
- **console 服务**: 拥有独立的迁移工具 `cmd/migrate/main.go`

**影响**:
- 维护成本高：每个服务都需要维护自己的 DDL 逻辑
- 容易出现 Schema 不一致：不同服务可能对同一表有不同的定义
- 难以统一管理：无法集中监控和管理所有数据库变更

#### 2. 多种迁移管理模式
**发现的三种模式**:
1. **代码内嵌 DDL** (Pattern 2): useractivity, offer, siterank
2. **独立迁移文件** (Pattern 1): billing (15个迁移文件), adscenter (5个迁移文件)
3. **混合模式**: console (既有迁移文件又有内嵌 DDL)

#### 3. 重复的数据库连接和初始化逻辑
每个服务都有自己的数据库连接代码，导致：
- 代码重复
- 配置分散
- 难以统一监控和优化

## 🎯 统一策略目标

### 核心目标
1. **统一管理**: 所有数据库操作通过 db-admin 服务统一管理
2. **消除分散**: 移除各服务中的分散 DDL 代码和迁移工具
3. **标准化流程**: 建立标准的数据库变更流程
4. **提升安全性**: 集中权限管理和审计
5. **提高效率**: 减少重复工作，提升开发效率

### 成功指标
- ✅ 零分散 DDL 代码：所有服务内不再包含 DDL 逻辑
- ✅ 统一接口：100% 的数据库操作通过 db-admin API
- ✅ 自动化流程：CI/CD 自动执行数据库变更
- ✅ 零停机迁移：所有变更通过事务性迁移执行

## 📋 统一策略实施细则

### Phase 1: 立即执行 (本周)

#### 1.1 禁止新增分散代码
**强制规定**:
- ❌ 禁止在任何服务中新增内嵌 DDL 代码
- ❌ 禁止创建新的独立迁移工具
- ❌ 禁止在服务代码中直接执行 `CREATE/ALTER/DROP` 语句

**替代方案**:
- ✅ 使用 db-admin API 执行所有 DDL 操作
- ✅ 通过 dbctl CLI 工具管理数据库变更
- ✅ 使用 db-admin Web 界面进行数据库操作

#### 1.2 现有代码处理原则
**处理原则**:
- **保留读取**: 现有的查询代码保持不变
- **标记废弃**: 在所有 DDL 函数上添加废弃注释
- **逐步迁移**: 制定迁移计划，逐步移除 DDL 代码

**标记模板**:
```go
// DEPRECATED: DDL operations should be performed through db-admin service
// This function will be removed in v2.0. Use dbctl CLI tool instead.
// Deprecated: use db-admin API POST /api/v1/databases/{service}/execute
func EnsureDDL(db *sql.DB) error {
    log.Printf("WARNING: This DDL function is deprecated. Use db-admin service instead.")
    // 现有代码保持不变
}
```

### Phase 2: 短期优化 (2-4周)

#### 2.1 创建 db-admin 工具生态
**OpenAPI 规范**:
- 为 db-admin 创建完整的 OpenAPI 3.0 规范
- 包含所有数据库管理接口
- 支持自动 SDK 生成

**CLI 工具开发**:
```bash
# dbctl 基础功能
dbctl connect <service>          # 连接到指定服务数据库
dbctl status                    # 检查所有数据库状态
dbctl schema <service>          # 获取数据库 Schema
dbctl migrate <service>         # 执行迁移
dbctl validate <service>        # 验证 Schema
dbctl query <service> <sql>     # 执行查询
dbctl backup <service>          # 创建备份
dbctl restore <service> <file>  # 恢复备份
```

#### 2.2 统一迁移文件格式
**标准化格式**:
```yaml
# migrations/{service}/001_create_table.yaml
version: "001"
service: "useractivity"
description: "Create user notifications table"
author: "db-admin@adsai.dev"
created_at: "2024-01-15T10:00:00Z"

up: |
  CREATE TABLE IF NOT EXISTS user_notifications (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS ix_user_notifications_user_time
  ON user_notifications(user_id, id DESC);

down: |
  DROP TABLE IF EXISTS user_notifications;
  DROP INDEX IF EXISTS ix_user_notifications_user_time;

dependencies: []
check_sql: |
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_name = 'user_notifications';
```

### Phase 3: 中期重构 (1-2个月)

#### 3.1 服务迁移计划
**迁移优先级**:

| 优先级 | 服务 | 复杂度 | 预计时间 | 状态 |
|--------|------|--------|----------|------|
| P0 | useractivity | 低 | 3天 | 🟡 计划中 |
| P0 | offer | 低 | 2天 | 🟡 计划中 |
| P1 | siterank | 中 | 5天 | ⚪ 待开始 |
| P1 | billing | 高 | 10天 | ⚪ 待开始 |
| P1 | adscenter | 高 | 8天 | ⚪ 待开始 |
| P2 | console | 中 | 5天 | ⚪ 待开始 |

**迁移步骤**:
1. **备份现有 Schema**: 使用 db-admin 创建完整备份
2. **创建迁移文件**: 将现有 DDL 转换为标准格式
3. **测试验证**: 在预发环境验证迁移正确性
4. **执行迁移**: 通过 db-admin 执行迁移
5. **移除旧代码**: 删除服务中的 DDL 代码
6. **更新文档**: 更新服务文档和部署指南

#### 3.2 具体迁移示例

**useractivity 服务迁移**:

**步骤 1**: 创建迁移文件
```yaml
# migrations/useractivity/001_initial_schema.yaml
version: "001"
service: "useractivity"
description: "Initial schema migration from embedded DDL"
up: |
  -- User notifications
  CREATE TABLE IF NOT EXISTS user_notifications (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS ix_user_notifications_user_time
  ON user_notifications(user_id, id DESC);

  -- User notification state
  CREATE TABLE IF NOT EXISTS user_notification_state (
      user_id TEXT PRIMARY KEY,
      last_read_id BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ... 其他表
```

**步骤 2**: 使用 dbctl 执行迁移
```bash
# 在预发环境测试
dbctl migrate useractivity --dry-run
dbctl migrate useractivity --env=preview

# 在生产环境执行
dbctl migrate useractivity --env=production --confirm
```

**步骤 3**: 移除服务中的 DDL 代码
```bash
# 标记废弃
git mv services/useractivity/internal/handlers/ddl.go \
    services/useractivity/internal/handlers/ddl.go.deprecated

# 更新调用代码
# 在 main.go 中移除 EnsureDDL 调用
```

### Phase 4: 长期治理 (持续)

#### 4.1 建立治理体系
**审批流程**:
```yaml
# Schema 变更审批流程
1. 开发者提交变更请求
   ├── 创建迁移文件
   ├── 添加变更说明
   └── 提交 PR

2. 自动化检查
   ├── 语法验证
   ├── Schema 冲突检查
   └── 性能影响评估

3. 代码审查
   ├── 技术负责人审查
   ├── DBA 审查 (复杂变更)
   └── 安全审查

4. 执行部署
   ├── 预发环境自动执行
   ├── 生产环境手动确认
   └── 部署后验证
```

**审计和监控**:
- 记录所有数据库变更操作
- 监控 Schema 变更对性能的影响
- 定期审计数据库访问权限
- 生成月度数据库变更报告

#### 4.2 CI/CD 集成
**GitHub Actions 工作流**:
```yaml
name: Database Schema Management

on:
  push:
    paths:
      - 'migrations/**'
      - 'specs/openapi/db-admin.yaml'

jobs:
  validate-migrations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate migration files
        run: |
          dbctl validate-all --dry-run

      - name: Check schema conflicts
        run: |
          dbctl check-conflicts --base=main --head=${{ github.sha }}

  deploy-migrations:
    needs: validate-migrations
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to preview
        run: |
          dbctl deploy-all --env=preview
        env:
          DB_ADMIN_TOKEN: ${{ secrets.DB_ADMIN_TOKEN }}
```

## 🔧 技术实现方案

### db-admin 服务增强

#### 1. 迁移管理器增强
```go
type MigrationManager struct {
    db           *sql.DB
    migrations   map[string][]Migration
    validators   []Validator
    auditLogger  AuditLogger
}

func (mm *MigrationManager) ApplyMigration(service, version string) error
func (mm *MigrationManager) RollbackMigration(service, version string) error
func (mm *MigrationManager) ValidateMigration(service string) error
func (mm *MigrationManager) GetMigrationHistory(service string) ([]Migration, error)
```

#### 2. Schema 比较工具
```go
type SchemaComparator struct {
    sourceDB *sql.DB
    targetDB *sql.DB
}

func (sc *SchemaComparator) CompareSchemas() (*SchemaDiff, error)
func (sc *SchemaComparator) GenerateMigration(diff *SchemaDiff) (string, error)
func (sc *SchemaComparator) ValidateSchema(schema *Schema) error
```

#### 3. 备份恢复系统
```go
type BackupManager struct {
    db          *sql.DB
    storage     StorageBackend
    compression bool
}

func (bm *BackupManager) CreateBackup(service string) (*Backup, error)
func (bm *BackupManager) RestoreBackup(service string, backup *Backup) error
func (bm *BackupManager) ScheduleBackup(service string, schedule string) error
```

### CLI 工具架构

#### 1. 命令结构
```bash
dbctl <command> [flags]

Commands:
  connect     Connect to a service database
  status      Show database status
  schema      Manage database schemas
  migrate     Run database migrations
  query       Execute SQL queries
  backup      Create and restore backups
  validate    Validate database schemas
  diff        Compare database schemas
  logs        Show audit logs
```

#### 2. 配置管理
```yaml
# ~/.dbctl/config.yaml
profiles:
  preview:
    db_admin_url: "https://db-admin-preview.run.app"
    token: "${DB_ADMIN_PREVIEW_TOKEN}"
    default_services: ["useractivity", "offer", "siterank"]

  production:
    db_admin_url: "https://db-admin.run.app"
    token: "${DB_ADMIN_PROD_TOKEN}"
    default_services: ["useractivity", "offer", "siterank", "billing", "adscenter"]

settings:
  timeout: 30s
  confirm_dangerous_operations: true
  audit_log_file: "~/.dbctl/audit.log"
```

## 📊 监控和指标

### 关键指标
1. **迁移成功率**: 99.9% 目标
2. **迁移执行时间**: 平均 < 30秒
3. **Schema 一致性**: 100% 符合���准
4. **故障恢复时间**: < 5分钟

### 告警规则
```yaml
alerts:
  - name: MigrationFailure
    condition: migration_success_rate < 99%
    action: 通知开发团队

  - name: LongRunningMigration
    condition: migration_duration > 5min
    action: 立即调查

  - name: SchemaDrift
    condition: schema_diff_count > 0
    action: 自动调查和修复
```

## 🚀 实施时间线

### Week 1: 基础设施
- [x] 完成现状分析
- [ ] 制定统一策略文档
- [ ] 创建 OpenAPI 规范
- [ ] 禁止新增分散代码

### Week 2-3: 工具开发
- [ ] 开发 dbctl CLI 工具
- [ ] 增强 db-admin API
- [ ] 创建迁移文件模板
- [ ] 设置 CI/CD 流程

### Week 4-8: 服务迁移
- [ ] 迁移 useractivity 和 offer 服务
- [ ] 迁移 siterank 服务
- [ ] 迁移 billing 和 adscenter 服务
- [ ] 迁移 console 服务

### Week 9-12: 完善治理
- [ ] 建立完整审批流程
- [ ] 实施监控和告警
- [ ] 完善文档和培训
- [ ] 性能优化和测试

## 🎖️ 成功标准

### 技术标准
- ✅ 零分散 DDL 代码
- ✅ 100% 统一管理
- ✅ 自动化部署
- ✅ 完整的审计日志

### 业务标准
- ✅ 开发效率提升 50%
- ✅ 数据库错误减少 80%
- ✅ 部署时间缩短 60%
- ✅ 安全性提升 90%

## 📞 联系和支持

**负责团队**: 基础设施团队
**技术支持**: db-admin@adsai.dev
**紧急联系**: @db-admin-team
**文档更新**: 每月定期更新

---

*本策略文档将根据实施情况持续更新和完善。最后更新时间: 2024-01-15*