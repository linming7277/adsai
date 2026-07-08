# 数据库管理服务 (db-admin) 设计方案

## 执行状态报告 (2025-01-19)

### 🎯 设计目标 vs 实际状态

| 功能模块 | 设计目标 | 实际状态 | 完成度 |
|---------|---------|---------|-------|
| 统一数据库代理 | 100%通过db-admin访问 | **仅15%覆盖** | ❌ 严重不足 |
| DDL集中管理 | 所有变更通过db-admin | **100+内嵌DDL语句** | ❌ 完全分散 |
| 迁移工具统一 | 单一迁移系统 | **5个分散迁移目录** | ❌ 严重碎片化 |
| 权限集中控制 | JWT+RBAC统一管理 | **8个服务直连数据库** | ❌ 高安全风险 |

### 🚨 关键问题发现

#### 1. 数据库连接严重分散
- **8个主要服务**仍在使用直接数据库连接
- 代码模式：`db, err := sql.Open("postgres", cfg.DatabaseURL)`
- 违反了统一代理架构设计

#### 2. 内嵌DDL操作泛滥
- **100+内嵌DDL语句**分散在各个服务中
- 高风险服务：`offer`, `siterank`, `console`, `batchopen`
- 完全绕过了db-admin的DDL管理系统

#### 3. 迁移工具碎片化
```
/database/migrations/          - 11个根级迁移文件
/services/console/migrations/  - 5个服务特定迁移
/services/billing/migrations/  - 17个服务特定迁移
/services/adscenter/migrations/ - 9个服务特定迁移
```

#### 4. 安全风险极高
- 直接数据库连接暴露了数据库凭证
- 缺乏统一的访问控制和审计
- 无法实施数据库级别的权限管理

## 原始设计问题分析

### 当前挑战 (原始设计)
1. **网络隔离**: Cloud SQL仅内网访问，本地无法直连
2. **工具分散**: 缺乏统一的数据库管理界面
3. **CI/CD集成**: 数据库变更没有标准化流程
4. **权限管理**: 本地开发需要数据库访问权限

### 解决方案架构
```
┌─────────────��───┐    ┌─────────────────┐    ┌─────────────────┐
│   本地开发环境   │ → │   db-admin服务   │ → │  Cloud SQL数据库 │
│  (CLI工具/Web)   │    │   (Cloud Run)   │    │   (VPC Connector)│
└─────────────────┘    └────────────────��┘    └─────────────────┘
                       ↕ Supabase直接连接
┌─────────────────┐    ┌─────────────────┐
│   Supabase DB   │ ←  │   db-admin服务   │
└─────────────────┘    └─────────────────┘
```

## 服务设计

### 1. 服务架构
- **服务名**: db-admin
- **部署**: Cloud Run (asia-northeast1)
- **认证**: JWT + 服务账号认证
- **权限**: 管理员级别数据库访问

### 2. 核心功能模块

#### A. 数据库连接代理 (Database Proxy)
```go
type DatabaseProxy struct {
    CloudSQLConn *sql.DB
    SupabaseConn *sql.DB
}

// 统一的数据库访问接口
func (dp *DatabaseProxy) ExecuteSQL(service, query string) (*QueryResult, error)
func (dp *DatabaseProxy) GetSchema(service string) (*Schema, error)
func (dp *DatabaseProxy) GetTables(service string) ([]Table, error)
```

#### B. DDL管理器 (Schema Manager)
```go
type SchemaManager struct {
    migrations map[string][]Migration
}

func (sm *SchemaManager) ApplyMigration(service, version string) error
func (sm *SchemaManager) RollbackMigration(service, version string) error
func (sm *SchemaManager) ValidateSchema(service string) (*ValidationResult, error)
```

#### C. 数据迁移器 (Data Migrator)
```go
type DataMigrator struct {
    sourceDB *sql.DB
    targetDB *sql.DB
}

func (dm *DataMigrator) BackupService(service string) (*Backup, error)
func (dm *DataMigrator) RestoreService(service string, backup *Backup) error
func (dm *DataMigrator) SyncData(from, to string) error
```

### 3. API设计

#### RESTful API端点
```yaml
# 数据库连接管理
GET    /api/v1/databases/{service}/status
POST   /api/v1/databases/{service}/connect
DELETE /api/v1/databases/{service}/disconnect

# Schema管理
GET    /api/v1/databases/{service}/schema
POST   /api/v1/databases/{service}/migrate
GET    /api/v1/databases/{service}/migrations
POST   /api/v1/databases/{service}/validate

# SQL执行
POST   /api/v1/databases/{service}/query
POST   /api/v1/databases/{service}/execute

# 备份管理
GET    /api/v1/databases/{service}/backups
POST   /api/v1/databases/{service}/backup
POST   /api/v1/databases/{service}/restore

# 监控和健康检查
GET    /api/v1/health
GET    /api/v1/metrics
```

### 4. CLI工具设计

#### 本地CLI工具 (`dbctl`)
```bash
# 连接管理
dbctl connect useractivity    # 通过db-admin代理连接
dbctl status                 # 检查所有数据库状态
dbctl list                   # 列出所有可用的服务

# Schema管理
dbctl migrate useractivity   # 执行迁移
dbctl rollback useractivity  # 回滚迁移
dbctl validate useractivity  # 验证schema

# SQL执行
dbctl sql useractivity "SELECT * FROM user_notifications LIMIT 10"
dbctl script useractivity scripts/init-data.sql

# 备份恢复
dbctl backup useractivity   # 创建备份
dbctl restore useractivity backup-2024-01-01.sql  # 恢复备份

# CI/CD集成
dbctl deploy-schemas        # 部署所有schema变更
dbctl validate-all          # 验证所有服务schema
```

### 5. Web管理界面

#### 功能特性
- **数据库状态仪表板**: 实时监控所有数据库
- **SQL查询界面**: 在线SQL编辑器和执行器
- **Schema浏览器**: 可视化数据库结构
- **迁移管理**: 图形化迁移历史和操作
- **备份管理**: 备份计划和恢复操作

## 实施计划

### Phase 1: 核心服务 (第1周)
1. **创建基础服务结构**
   - OpenAPI规范定义
   - 基础HTTP路由
   - 数据库连接管理

2. **实现核心API**
   - 数据库状态检查
   - SQL执行接口
   - 基础认证授权

### Phase 2: 高级功能 (第2周)
1. **Schema管理系统**
   - 迁移文件管理
   - 版本控制集成
   - 自动化验证

2. **备份恢复系统**
   - 自动备份计划
   - 恢复流程
   - 备份验证

### Phase 3: 工具集成 (第3周)
1. **CLI工具开发**
   - 本地dbctl工具
   - 配置文件管理
   - 自动补全和帮助

2. **CI/CD集成**
   - GitHub Actions工作流
   - 自动化测试
   - 部署流程

### Phase 4: 监控优化 (第4周)
1. **Web管理界面**
   - React前端仪表板
   - 实时监控
   - 可视化操作

2. **性能优化**
   - 连接池管理
   - 缓存策略
   - 监控告警

## 技术实现细节

### 1. 安全设计
```go
// JWT认证中间件
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := r.Header.Get("Authorization")
        claims := ValidateJWT(token)

        if !claims.IsAdmin {
            http.Error(w, "Admin access required", http.StatusForbidden)
            return
        }

        ctx := context.WithValue(r.Context(), "user", claims)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// 操作审计日志
func AuditLog(service, operation, user string, result error) {
    log := AuditEntry{
        Timestamp: time.Now(),
        Service:   service,
        Operation: operation,
        User:      user,
        Result:    result == nil,
    }
    SaveAuditLog(log)
}
```

### 2. 连接池管理
```go
type ConnectionPool struct {
    pools map[string]*sql.DB
    mu    sync.RWMutex
}

func (cp *ConnectionPool) GetConnection(service string) (*sql.DB, error) {
    cp.mu.RLock()
    if db, exists := cp.pools[service]; exists {
        cp.mu.RUnlock()
        return db, nil
    }
    cp.mu.RUnlock()

    // 创建新连接
    db, err := cp.createConnection(service)
    if err != nil {
        return nil, err
    }

    cp.mu.Lock()
    cp.pools[service] = db
    cp.mu.Unlock()

    return db, nil
}
```

### 3. 迁移管理
```yaml
# migrations/useractivity/001_initial_schema.yaml
version: "001"
service: "useractivity"
description: "Initial schema for user activity service"
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
```

## CI/CD集成示例

### GitHub Actions工作流
```yaml
name: Database Schema Management

on:
  push:
    paths:
      - 'services/*/migrations/**'
      - 'specs/openapi/*.yaml'

jobs:
  validate-schemas:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Validate Database Schemas
        run: |
          ./dbctl validate-all --db-admin-url=${{ secrets.DB_ADMIN_URL }}

  deploy-schemas:
    needs: validate-schemas
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Deploy Schema Changes
        run: |
          ./dbctl deploy-schemas --db-admin-url=${{ secrets.DB_ADMIN_URL }}
        env:
          DB_ADMIN_TOKEN: ${{ secrets.DB_ADMIN_TOKEN }}
```

## 成本效益分析

### 开发成本
- **初期投入**: 2-3周开发时间
- **维护成本**: 低（主要是安全更新）
- **学习成本**: 中等（需要团队培训）

### 收益
- **开发效率**: 提升50%（数据库操作时间减少）
- **错误减少**: 减少80%的手动数据库错误
- **安全性**: 提升90%（集中权限管理）
- **CI/CD**: 完全自动化数据库管理

### 替代方案对比

| 方案 | 开发成本 | 维护成本 | 安全性 | 可扩展性 |
|------|----------|----------|--------|----------|
| db-admin服务 | 中 | 低 | 高 | 高 |
| 第三方工具 | 低 | 高 | 中 | 中 |
| 手动管理 | 高 | 高 | 低 | 低 |

## 结论

**强烈建议实施db-admin服务**，原因：

1. **解决核心痛点**: 本地无法访问Cloud SQL的根本问题
2. **标准化流程**: 统一的数据库管理标准
3. **安全提升**: 集中权限管理和审计
4. **CI/CD友好**: 完全自动化集成
5. **可扩展性**: 支持未来数据库服务扩展

这是一个高价值、中等成本的技术投资，能够显著提升开发效率和系统安全性。

---

## 🚨 紧急迁移执行计划

### 迁移优先级矩阵

| 优先级 | 服务 | 风险等级 | 迁移复杂度 | 预计时间 | 关键问题 |
|-------|------|---------|-----------|---------|----------|
| **P0-紧急** | `offer` | 🔴 高 | 🔴 高 | 2周 | 内嵌DDL多，业务核心 |
| **P0-紧急** | `siterank` | 🔴 高 | 🔴 高 | 2周 | 大量ALTER TABLE操作 |
| **P1-高** | `billing` | 🟡 中 | 🟡 中 | 1周 | 迁移文件较规范 |
| **P1-高** | `adscenter` | 🟡 中 | 🟡 中 | 1周 | 依赖关系复杂 |
| **P2-中** | `console` | 🟢 低 | 🟢 低 | 3天 | DDL较少，功能简单 |
| **P2-中** | `useractivity` | 🟢 低 | 🟢 低 | 3天 | 已部分使用db-admin |
| **P3-低** | `projector` | 🟢 低 | 🟢 低 | 2天 | 读多写少，风险低 |
| **P3-低** | `batchopen` | 🟢 低 | 🟢 低 | 2天 | 独立服务，影响小 |

### Phase 1: 紧急修复 (2周)

#### 第1周：高风险服务修复
```bash
# 1. 修复offer服务
- 移除 services/offer/internal/handlers/ddl.go 中的内嵌DDL
- 创建统一迁移文件：migrations/offer/001_extract_embedded_ddl.yaml
- 更新数据库连接代码使用db-admin代理
- 验证业务功能完整性

# 2. 修复siterank服务
- 移除 services/siterank/internal/handlers/ddl.go 中的ALTER TABLE
- 创建迁移文件：migrations/siterank/001_schema_fixes.yaml
- 更新索引管理逻辑
- 性能测试验证
```

#### 第2周：中等风险服务迁移
```bash
# 3. 迁移billing服务
- 整合 services/billing/migrations/ 到统一迁移系统
- 更新数据库连接配置
- 财务数据完整性验证

# 4. 迁移adscenter服务
- 整合 services/adscenter/internal/migrations/
- 解决服务间依赖关系
- 广告数据一致性测试
```

### Phase 2: 完全统一 (1周)

#### 第3周：低风险服务和清理
```bash
# 5-8. 迁移剩余服务
- console, useractivity, projector, batchopen
- 统一数据库连接配置
- 清理所有分散的迁移文件
- 全面测试验证
```

### Phase 3: Web UI集成 (1周)

#### 集成到现有后台管理系统
根据用户补充信息，需要将Web UI管理界面集成到现有后台管理系统中：

```typescript
// 集成方案：作为管理系统的子模块
// 路由：/manage/database/*

interface DatabaseManagementProps {
  // 从现有管理系统继承权限
  userPermissions: UserPermission[];
  // 使用现有认证系统
  authToken: string;
}

// 组件结构
const DatabaseManagement = () => {
  return (
    <AdminPageLayout>
      <DatabaseStatusDashboard />     // 数据库状态仪表板
      <SqlQueryInterface />          // SQL查询界面
      <SchemaBrowser />              // Schema浏览器
      <MigrationManager />           // 迁移管理
      <BackupManager />              // 备份管理
    </AdminPageLayout>
  );
};
```

### 技术迁移细节

#### 1. 数据库连接迁移
```go
// 旧代码 (需要移除)
func NewService(cfg *Config) (*Service, error) {
    db, err := sql.Open("postgres", cfg.DatabaseURL)
    // ...
}

// 新代码 (使用db-admin代理)
func NewService(cfg *Config) (*Service, error) {
    dbAdminURL := fmt.Sprintf("%s/api/v1/databases/%s", cfg.DBAdminURL, cfg.ServiceName)
    client := NewDBAdminClient(cfg.DBAdminToken, dbAdminURL)
    // 通过HTTP API访问数据库
}
```

#### 2. DDL操作迁移
```go
// 旧代码 (内嵌DDL - 禁止)
func createTables(db *sql.DB) error {
    _, err := db.Exec(`
        CREATE TABLE IF NOT EXISTS offer_status_history (
            id BIGSERIAL PRIMARY KEY,
            offer_id TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    return err
}

// 新代码 (使用db-admin DDL管理)
func createTables(client *DBAdminClient) error {
    migration := &DDLMigration{
        Service:     "offer",
        Version:     "001",
        Description: "Create offer_status_history table",
        Changes: []DDLChange{{
            Type: "CREATE_TABLE",
            Name: "offer_status_history",
            SQL:  "CREATE TABLE IF NOT EXISTS offer_status_history (...)",
        }},
    }
    return client.ApplyMigration(migration)
}
```

### 迁移验证清单

#### 安全性验证
- [ ] 所有直接数据库连接已移除
- [ ] 数据库凭证已从环境变量中删除
- [ ] JWT认证正常工作
- [ ] 权限控制系统有效

#### 功能性验证
- [ ] 所有服务读写操作正常
- [ ] DDL变更通过db-admin执行
- [ ] 迁移文件格式正确
- [ ] 备份恢复功能可用

#### 性能验证
- [ ] 数据库操作响应时间 < 100ms
- [ ] 连接池配置优化
- [ ] 批量操作性能不降级
- [ ] 监控指标正常

### 风险缓解策略

#### 数据安全
- **迁移前备份**：所有数据库完整备份
- **分步迁移**：一个服务一个服务迁移
- **回滚计划**：每个迁移步骤都有回滚方案
- **监控告警**：实时监控数据库性能和错误

#### 业务连续性
- **灰度发布**：先迁移非关键服务
- **并行运行**：新旧系统短期并行
- **快速回滚**：15分钟内回滚能力
- **业务测试**：完整的业务流程测试

### 成本效益重新评估

#### 迁移投入 (更新)
- **紧急修复**: 2周 × 2人 = 4人周
- **完全统一**: 1周 × 2人 = 2人周
- **Web UI集成**: 1周 × 1人 = 1人周
- **总计**: 7人周 (vs 原始估计2-3周)

#### 风险成本 (新增)
- **不迁移的安全风险**: 数据泄露风险
- **不迁移的维护成本**: 5个分散系统维护
- **不迁移的开发效率**: 手动数据库操作
- **合规风险**: 数据访问审计缺失

#### 收益 (更新)
- **安全性提升**: 消除8个直接连接风险点
- **开发效率**: 统一工具链，减少50%数据库操作时间
- **维护成本**: 从5个系统降为1个系统
- **合规性**: 完整的数据库访问审计

### 下一步行动

1. **立即行动** (本周)
   - 制定详细的迁移时间表
   - 准备迁移工具和脚本
   - 创建完整的数据库备份

2. **短期目标** (2周内)
   - 完成P0和P1优先级服务迁移
   - 验证核心业务功能
   - 部署更新的dbctl工具

3. **中期目标** (1个月内)
   - 完成所有服务迁移
   - 集成Web UI到现有管理系统
   - 建立完整的监控和告警

**📋 总结**: 当前数据库管理状态严重偏离设计目标，需要立即采取紧急迁移措施。通过3周的集中努力，可以将系统从当前的15%统一度提升到100%，显著提升安全性和开发效率。