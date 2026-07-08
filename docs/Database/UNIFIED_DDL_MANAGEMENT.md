# 统一DDL管理系统设计方案

## 问题分析

### 当前DDL模式混乱现状
根据MustKnowV7.md，当前系统存在两种DDL模式：

1. **Mode 1: 独立迁移文件**
   - 使用服务：billing, siterank
   - 特点：独立的SQL迁移文件
   - 优点：版本控制清晰，适合复杂schema变更
   - 缺点：需要额外工具管理

2. **Mode 2: 代码内嵌DDL**
   - 使用服务：offer, useractivity
   - 特点：DDL直接写在Go代码中
   - 优点：简单直接
   - 缺点：难以版本控制，缺乏迁移管理

### 统一DDL管理的必要性
1. **开发效率**: 不同团队需要掌握不同的DDL管理方式
2. **部署一致性**: 缺乏统一的部署和回滚策略
3. **版本控制**: DDL变更历史分散，难以追踪
4. **安全审计**: 缺乏统一的DDL变更审批流程

## 解决方案：统一DDL管理系统

### 架构设计
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   开发者        │    │  db-admin服务   │    │   所有数据库     │
│   (CLI/Web)     │───▶│  DDL Manager    │───▶│  (Cloud SQL)    │
│                 │    │                 │    │                 │
│ • 编写DDL       │    │ • 验证DDL      │    │ • 执行DDL       │
│ • 提交变更       │    │ • 版本管理      │    │ • 回滚DDL       │
│ • 部署发布       │    │ • 审计记录      │    │ • 状态追踪      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   迁移仓库       │
                       │  (Git)          │
                       │                 │
                       │ • DDL文件       │
                       │ • 版本历史      │
                       │ • 配置文件      │
                       └─────────────────┘
```

### 核心组件

#### 1. 统一DDL格式标准
```yaml
# migrations/{service}/{version}.yaml
version: "001"
service: "useractivity"
description: "Initial user activity schema"
author: "developer@autoads.dev"
created_at: "2024-01-01T00:00:00Z"
dependencies: []
risk_level: "low"

# DDL变更
changes:
  - type: "create_table"
    name: "user_notifications"
    sql: |
      CREATE TABLE IF NOT EXISTS user_notifications (
          id BIGSERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

  - type: "create_index"
    name: "ix_user_notifications_user_time"
    sql: |
      CREATE INDEX IF NOT EXISTS ix_user_notifications_user_time
      ON user_notifications(user_id, id DESC);

# 回滚SQL
rollback:
  - type: "drop_index"
    name: "ix_user_notifications_user_time"
    sql: "DROP INDEX IF EXISTS ix_user_notifications_user_time;"

  - type: "drop_table"
    name: "user_notifications"
    sql: "DROP TABLE IF EXISTS user_notifications;"

# 验证SQL（可选）
validation:
  - type: "table_exists"
    name: "user_notifications"

  - type: "index_exists"
    name: "ix_user_notifications_user_time"
```

#### 2. DDL管理服务 (db-admin扩展)
```go
// internal/ddl/manager.go
type DDLManager struct {
    db           *sql.DB
    migrationStore MigrationStore
    validator     *DDLValidator
    auditor       *AuditLogger
}

type Migration struct {
    Version     string            `yaml:"version"`
    Service     string            `yaml:"service"`
    Description string            `yaml:"description"`
    Author      string            `yaml:"author"`
    CreatedAt   time.Time         `yaml:"created_at"`
    Changes     []DDLChange       `yaml:"changes"`
    Rollback    []DDLChange       `yaml:"rollback"`
    Validation  []ValidationStep  `yaml:"validation"`
    Dependencies []string         `yaml:"dependencies"`
    RiskLevel   string            `yaml:"risk_level"`
}

// 核心方法
func (m *DDLManager) ApplyMigration(service, version string) error
func (m *DDLManager) RollbackMigration(service, version string) error
func (m *DDLManager) GetMigrationStatus(service string) (*MigrationStatus, error)
func (m *DDLManager) ValidateDDL(migration *Migration) (*ValidationResult, error)
func (m *DDLManager) GetMigrationHistory(service string) ([]Migration, error)
```

#### 3. CLI工具 (dbctl扩展)
```bash
# DDL管理命令
dbctl ddl create useractivity 001_initial_schema  # 创建新DDL
dbctl ddl validate useractivity 001_initial_schema  # 验证DDL
dbctl ddl list useractivity                       # 列出所有DDL
dbctl ddl apply useractivity 001                  # 应用DDL
dbctl ddl rollback useractivity 001               # 回滚DDL
dbctl ddl status useractivity                    # 查看状态
dbctl ddl plan useractivity                      # 查看执行计划

# 批量操作
dbctl ddl deploy all                            # 部署所有服务的DDL
dbctl ddl validate all                          # 验证所有DDL
dbctl ddl sync useractivity                     # 同步DDL到本地
```

#### 4. Web管理界面
- **DDL编辑器**: 在线DDL编写和语法检查
- **版本管理**: DDL版本历史和差异对比
- **执行计划**: DDL执行前预览和风险评估
- **审批流程**: 高风险DDL需要管理员审批
- **状态监控**: 实时DDL执行状态和进度

### 统一DDL管理流程

#### 开发阶段
1. **创建DDL文件**
   ```bash
   cd migrations/useractivity
   dbctl ddl create useractivity 002_add_notification_priority
   ```

2. **编写DDL变更**
   ```yaml
   version: "002"
   service: "useractivity"
   description: "Add priority column to user_notifications"
   changes:
     - type: "add_column"
       table: "user_notifications"
       column: "priority"
       definition: "INTEGER DEFAULT 0"
   ```

3. **本地验证**
   ```bash
   dbctl ddl validate useractivity 002
   ```

4. **测试环境应用**
   ```bash
   dbctl ddl apply useractivity 002 --env=preview
   ```

#### 部署阶段
1. **预检查**
   ```bash
   dbctl ddl plan useractivity 002 --env=production
   ```

2. **审批流程**（高风险DDL）
   - 自动风险评级
   - 管理员审批
   - 变更记录

3. **生产部署**
   ```bash
   dbctl ddl apply useractivity 002 --env=production
   ```

4. **验证结果**
   ```bash
   dbctl ddl status useractivity --env=production
   ```

### 迁移策略

#### 从现有DDL模式迁移

##### Phase 1: Mode 2服务迁移 (代码内嵌 → 迁移文件)
**目标服务**: useractivity, offer

**步骤**:
1. **提取现有DDL**
   ```bash
   # 从代码中提取DDL并转换为标准格式
   dbctl ddl extract useractivity
   ```

2. **创建初始迁移文件**
   ```bash
   dbctl ddl init useractivity --from-code
   ```

3. **验证和测试**
   ```bash
   dbctl ddl validate useractivity
   dbctl ddl apply useractivity --env=preview
   ```

4. **更新服务代码**
   ```go
   // 移除EnsureDDL调用
   // 改为在启动时检查迁移状态
   func (h *UserActivityHandler) InitializeSchema(ctx context.Context) error {
       return h.ddlManager.EnsureMigrationsApplied(ctx)
   }
   ```

##### Phase 2: Mode 1服务标准化 (迁移文件 → 统一格式)
**目标服务**: billing, siterank

**步骤**:
1. **转换现有迁移文件**
   ```bash
   dbctl ddl convert billing --from-migration-files
   ```

2. **验证转换结果**
   ```bash
   dbctl ddl validate billing
   ```

3. **部署统一格式**
   ```bash
   dbctl ddl deploy billing --env=preview
   ```

### 配置管理

#### 服务DDL配置
```yaml
# config/ddl/services.yaml
services:
  useractivity:
    database: "cloudsql"
    migrations_path: "migrations/useractivity"
    current_version: "002"
    auto_apply: false

  billing:
    database: "cloudsql"
    migrations_path: "migrations/billing"
    current_version: "005"
    auto_apply: false

  offer:
    database: "cloudsql"
    migrations_path: "migrations/offer"
    current_version: "001"
    auto_apply: false

# 全局DDL配置
global:
  max_concurrent_migrations: 3
  timeout_per_migration: "30m"
  require_approval_for_risk_level: ["high", "critical"]
  backup_before_risky_operations: true
```

#### 风险级别定义
```yaml
# config/ddl/risk_levels.yaml
risk_levels:
  low:
    description: "安全的schema变更"
    examples:
      - "添加索引"
      - "添加非关键列"
      - "修改表注释"
    require_approval: false
    auto_backup: false

  medium:
    description: "中等风险的schema变更"
    examples:
      - "添加关键列"
      - "修改列类型"
      - "创建新表"
    require_approval: false
    auto_backup: true

  high:
    description: "高风险的schema变更"
    examples:
      - "删除列"
      - "修改主键"
      - "重命名表"
    require_approval: true
    auto_backup: true

  critical:
    description: "极高风险的schema变更"
    examples:
      - "删除表"
      - "修改核心数据结构"
      - "大量数据迁移"
    require_approval: true
    auto_backup: true
    requires_maintenance_window: true
```

### 监控和审计

#### DDL执行监控
```go
type DDLMetrics struct {
    TotalMigrations       int
    SuccessfulMigrations  int
    FailedMigrations      int
    RollbackMigrations    int
    AverageExecutionTime  time.Duration
    LastMigrationTime     time.Time
    ServicesStatus        map[string]ServiceDDLStatus
}
```

#### 审计日志
```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "user_id": "developer-001",
  "service": "useractivity",
  "operation": "apply_migration",
  "version": "002",
  "description": "Add priority column to user_notifications",
  "risk_level": "medium",
  "status": "success",
  "execution_time": "45s",
  "changes_applied": 1,
  "rollback_available": true
}
```

### 最佳实践

#### DDL编写规范
1. **向后兼容**: 优先使用增量变更而非破坏性变更
2. **性能考虑**: 大表操作在低峰期执行
3. **备份策略**: 高风险操作前必须备份
4. **测试充分**: 在preview环境充分测试后再部署到生产
5. **文档完善**: 每个DDL变更都要有详细说明

#### 变更管理流程
1. **需求分析**: 明确变更需求和影响范围
2. **风险评估**: 使用工具评估变更风险
3. **方案设计**: 制定详细的变更方案
4. **代码审查**: DDL变更需要代码审查
5. **测试验证**: 在测试环境充分验证
6. **生产部署**: 在维护窗口执行部署
7. **结果验证**: 部署后验证变更结果
8. **文档更新**: 更新相关技术文档

### 实施计划

#### Phase 1: 基础设施 (2周)
- [ ] 实现DDL Manager核心功能
- [ ] 创建统一DDL格式标准
- [ ] 开发CLI工具基础命令
- [ ] 配置迁移仓库

#### Phase 2: 服务迁移 (3周)
- [ ] 迁移useractivity和offer服务
- [ ] 标准化billing和siterank服务
- [ ] 更新所有服务启动逻辑
- [ ] 全面测试验证

#### Phase 3: Web界面 (2周)
- [ ] 开发DDL管理Web界面
- [ ] 实现审批流程
- [ ] 添加实时监控
- [ ] 集成审计日志

#### Phase 4: 优化完善 (1周)
- [ ] 性能优化
- [ ] 监控告警
- [ ] 文档完善
- [ ] 团队培训

### 预期效果

#### 开发效率提升
- **统一工具**: 所有服务使用相同的DDL管理工具
- **简化流程**: 标准化的DDL编写和部署流程
- **减少错误**: 自动验证和检查减少人为错误

#### 运维效率提升
- **自动化部署**: 一键部署和回滚
- **风险控制**: 自动风险评估和审批流程
- **监控告警**: 实时监控DDL执行状态

#### 安全性提升
- **权限控制**: 细粒度的DDL操作权限
- **审计追踪**: 完整的DDL变更审计日志
- **备份保护**: 自动备份和回滚机制

这个统一的DDL管理系统将彻底解决当前DDL模式混乱的问题，为AutoAds项目提供标准化、安全、高效的数据库变更管理能力。