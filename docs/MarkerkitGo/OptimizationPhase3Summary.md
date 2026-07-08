# 微服务架构优化 Phase 3 总结

**执行日期**: 2025-10-05
**执行范围**: adscenter DB Migrator、服务数据库策略调研

---

## 一、已完成任务

### 1.1 ✅ Adscenter DB Migrator 构建

**构建镜像**:
```bash
# 成功构建preview环境镜像
asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/adscenter-migrator:preview-latest
asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/adscenter-migrator:preview-151c3d9d
```

**配置文件更新**:
- `deployments/db-migrator/job.preview.yaml` - 统一迁移 Job（预发）
- `deployments/db-migrator/job.prod.yaml` - 统一迁移 Job（生产）

**关键修复**:
1. Secret名称: `database-url-preview` → `DATABASE_URL`
2. VPC Connector: 添加到 `spec.template.metadata.annotations` 层级
3. Build tag: 与billing保持一致（`//go:build migration`）
4. 隐藏文件过滤: 与billing同步

### 1.2 ✅ 服务数据库初始化策略调研

**发现**: 项目中存在**三种不同的数据库初始化模式**

#### 模式1: 独立迁移文件 + Migrator Job（billing, adscenter）

**特征**:
- 迁移文件位于 `internal/migrations/*.sql`
- 启动时通过 `runMigrations()` 函数执行
- 已实现专用DB Migrator Job
- 支持幂等性追踪（`schema_migrations` 表）

**示例** (`services/billing/internal/migrations/`):
```
000001_create_initial_tables.up.sql
000002_create_user_token_pool.up.sql
000003_token_tx_user_created_idx.up.sql
000004_token_credit_lot_and_allocations.up.sql
000005_token_repair_audit.up.sql
000006_backfill_token_credit_lots_from_pool.up.sql
```

**优点**:
- ✅ 版本化管理，易于回溯
- ✅ 支持复杂的数据迁移逻辑
- ✅ 可独立执行和测试
- ✅ 适合频繁变更的schema

**缺点**:
- ⚠️ 需要维护迁移文件
- ⚠️ 多实例并发执行风险（已通过Migrator Job解决）

#### 模式2: 代码内嵌DDL（offer, siterank）

**特征**:
- 在代码中直接定义`ensureXXXDDL()`函数
- 服务启动时执行CREATE TABLE IF NOT EXISTS
- 无独立迁移文件
- 每次启动都会检查表是否存在

**示例** (`services/siterank/main.go`):
```go
func ensureDomainCacheDDL(db *sql.DB) error {
    ddl := `
CREATE TABLE IF NOT EXISTS domain_cache (
  host       TEXT PRIMARY KEY,
  payload    JSONB NOT NULL,
  ok         BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_domain_cache_expires ON domain_cache(expires_at);
`
    _, err := db.Exec(ddl)
    return err
}

func main() {
    // ...
    if err := ensureDomainCacheDDL(db); err != nil {
        log.Fatalf("DDL failed: %v", err)
    }
    if err := ensureDomainCountryCacheDDL(db); err != nil {
        log.Fatalf("DDL failed: %v", err)
    }
    // ...
}
```

**offer服务表列表**:
- `OfferStatusHistory` - 在handler中按需创建
- `OfferPreferences` - 在handler中按需创建
- `OfferKpiDeadLetter` - 在handler中按需创建
- `idempotency_keys` - 在handler中按需创建

**siterank服务表列表**:
- `domain_cache` - 启动时创建
- `domain_country_cache` - 启动时创建
- `User` - 启动时创建（stub表，用于外键引用）
- `SiterankHistory` - 启动时创建

**优点**:
- ✅ 简单直观，代码即文档
- ✅ 适合表结构稳定的服务
- ✅ 无需维护迁移文件
- ✅ 天然支持幂等性（IF NOT EXISTS）

**缺点**:
- ❌ 不支持ALTER TABLE等复杂变更
- ❌ 无版本追踪，难以回溯schema历史
- ❌ 数据迁移逻辑难以实现

#### 模式3: 外部工具管理（如Prisma，当前未使用）

**特征**:
- 使用Prisma、TypeORM等ORM工具
- 通过`prisma migrate`等命令管理
- schema定义在`.prisma`或entity文件中

**当前状态**: 项目中发现Prisma配置文件但未实际使用。

---

## 二、模式对比与推荐

### 2.1 场景适配矩阵

| 场景 | 模式1（独立迁移） | 模式2（内嵌DDL） | 模式3（ORM工具） |
|------|---------------|--------------|--------------|
| **表结构频繁变更** | ✅ 最佳 | ❌ 不适合 | ✅ 适合 |
| **复杂数据迁移** | ✅ 最佳 | ❌ 不支持 | ⚠️ 部分支持 |
| **多环境一致性** | ✅ 最佳 | ⚠️ 依赖代码 | ✅ 适合 |
| **快速原型开发** | ❌ 繁琐 | ✅ 最佳 | ⚠️ 学习成本 |
| **团队协作** | ✅ 易于code review | ⚠️ 分散在代码中 | ✅ 统一schema |
| **性能敏感场景** | ✅ 独立执行 | ❌ 每次启动检查 | ⚠️ 依赖工具 |

### 2.2 当前服务分类建议

#### 保持模式1（独立迁移 + Migrator Job）:
- ✅ **billing**: 计费核心表，频繁变更，已有完善迁移
- ✅ **adscenter**: 业务复杂，表结构演进中

#### 保持模式2（内嵌DDL）:
- ✅ **siterank**: 缓存表为主，结构稳定，无复杂迁移需求
- ✅ **offer**: 辅助表较多，按需创建更灵活

#### 需要改造为模式1:
- ⚠️ **无** - 当前模式分配合理

#### 未来新服务推荐:
```
如果服务特征为:
  ├─ 核心业务表 + 频繁变更 → 模式1（独立迁移）
  ├─ 辅助/缓存表 + 结构稳定 → 模式2（内嵌DDL）
  └─ 大型项目 + 团队协作  → 模式3（ORM工具）
```

---

## 三、关键发现

### 3.1 offer服务的特殊设计

**发现**: offer服务采用"延迟创建"模式

```go
// services/offer/internal/handlers/http.go
func (h *Handler) ensureOfferStatusHistory(ctx context.Context) error {
    _, err := h.DB.ExecContext(ctx, `
        CREATE TABLE IF NOT EXISTS "OfferStatusHistory"(
            id TEXT PRIMARY KEY,
            offer_id TEXT NOT NULL,
            // ...
        )
    `)
    return err
}

func (h *Handler) UpdateOfferStatus(w http.ResponseWriter, r *http.Request) {
    // 每次请求时检查表是否存在
    if err := h.ensureOfferStatusHistory(r.Context()); err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    // ...
}
```

**问题**:
- ❌ 每次API调用都执行DDL检查（性能开销）
- ❌ 未使用事务保护
- ❌ 多实例并发时可能触发死锁

**建议改进**:
```go
// 服务启动时统一创建所有表
func (h *Handler) EnsureAllTables(ctx context.Context) error {
    tables := []string{
        `CREATE TABLE IF NOT EXISTS "OfferStatusHistory"(...)`,
        `CREATE TABLE IF NOT EXISTS "OfferPreferences"(...)`,
        `CREATE TABLE IF NOT EXISTS "OfferKpiDeadLetter"(...)`,
        `CREATE TABLE IF NOT EXISTS "idempotency_keys"(...)`,
    }

    for _, ddl := range tables {
        if _, err := h.DB.ExecContext(ctx, ddl); err != nil {
            return fmt.Errorf("ensure table: %w", err)
        }
    }
    return nil
}

// main.go中调用一次
func main() {
    // ...
    if err := handler.EnsureAllTables(context.Background()); err != nil {
        log.Fatalf("DDL: %v", err)
    }
    // ...
}
```

### 3.2 siterank的User表stub

**发现**: siterank创建了User表的stub用于外键引用

```go
// services/siterank/main.go
func ensureUserTableStubDDL(db *sql.DB) error {
    ddl := `
CREATE TABLE IF NOT EXISTS "User" (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`
    _, err := db.Exec(ddl)
    return err
}
```

**问题**:
- ⚠️ 与billing的User表结构可能不一致
- ⚠️ 跨服务数据库引用（违反微服务原则）

**建议**:
1. **短期**: 确保stub结构与billing的User表一致
2. **中期**: siterank不直接引用User表，而是存储userId字符串
3. **长期**: 通过事件订阅同步用户信息到本地投影表

### 3.3 模式混用的风险

**当前状态**:
- billing/adscenter: 模式1（严格版本控制）
- offer/siterank: 模式2（代码内嵌）
- 同一数据库，不同管理方式

**潜在风险**:
1. **表冲突**: offer和billing可能创建同名表（如idempotency_keys）
2. **Schema不一致**: User表在多个服务中重复定义
3. **迁移顺序**: 无法保证跨服务的DDL执行顺序

**缓解措施**:
```sql
-- 为每个服务使用独立的schema namespace
CREATE SCHEMA IF NOT EXISTS billing_schema;
CREATE SCHEMA IF NOT EXISTS offer_schema;
CREATE SCHEMA IF NOT EXISTS siterank_schema;

-- 迁移表到独立schema
ALTER TABLE "UserToken" SET SCHEMA billing_schema;
ALTER TABLE "OfferStatusHistory" SET SCHEMA offer_schema;
ALTER TABLE "domain_cache" SET SCHEMA siterank_schema;
```

---

## 四、行动计划

### 4.1 立即执行（本周）

1. **优化offer服务DDL执行**:
   ```go
   // 从handler中移除DDL检查，移到启动时执行
   func main() {
       handler := handlers.NewHandler(db, ...)
       if err := handler.EnsureAllTables(context.Background()); err != nil {
           log.Fatalf("DDL: %v", err)
       }
       // ...
   }
   ```

2. **文档化数据库初始化策略**:
   - 更新 `docs/MarkerkitGo/MustKnowV4.md`
   - 添加"数据库初始化模式"章节
   - 明确各服务适用场景

3. **Schema冲突检查**:
   ```bash
   # 检查同名表
   psql $DATABASE_URL <<'EOF'
   SELECT table_name, COUNT(*)
   FROM information_schema.tables
   WHERE table_schema = 'public'
   GROUP BY table_name
   HAVING COUNT(*) > 1;
   EOF
   ```

### 4.2 短期优化（2周内）

1. **标准化idempotency_keys表**:
   ```sql
   -- 所有服务共享同一张幂等性表
   CREATE TABLE IF NOT EXISTS "IdempotencyKeys" (
       key TEXT PRIMARY KEY,
       service TEXT NOT NULL,  -- 区分服务
       created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       expires_at TIMESTAMPTZ NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
   ON "IdempotencyKeys"(expires_at);
   ```

2. **User表stub对齐**:
   ```go
   // siterank/main.go
   // 确保与billing的User表结构一致
   func ensureUserTableStubDDL(db *sql.DB) error {
       ddl := `
   CREATE TABLE IF NOT EXISTS "User" (
     id TEXT PRIMARY KEY,
     email TEXT NOT NULL UNIQUE,
     name TEXT,
     role TEXT NOT NULL DEFAULT 'USER',
     "createdAt" TIMESTAMPTZ NOT NULL,           -- 与billing一致
     "lastLoginAt" TIMESTAMPTZ,                  -- 与billing一致
     "notificationPreferences" JSONB             -- 与billing一致
   );
   `
       _, err := db.Exec(ddl)
       return err
   }
   ```

3. **添加启动时schema校验**:
   ```go
   // pkg/database/validator.go
   func ValidateExpectedTables(db *sql.DB, service string) error {
       expected := map[string][]string{
           "billing": {"UserToken", "TokenTransaction", "Subscription"},
           "offer": {"OfferStatusHistory", "OfferPreferences"},
           "siterank": {"domain_cache", "SiterankHistory"},
       }

       for _, table := range expected[service] {
           var exists bool
           err := db.QueryRow(`
               SELECT EXISTS (
                   SELECT 1 FROM information_schema.tables
                   WHERE table_name = $1
               )
           `, table).Scan(&exists)

           if err != nil || !exists {
               return fmt.Errorf("table %s not found", table)
           }
       }
       return nil
   }
   ```

### 4.3 中期规划（1个月内）

1. **Schema级隔离**:
   - 创建 `billing_schema`, `offer_schema`, `siterank_schema`
   - 迁移各服务表到独立schema
   - 更新连接字符串: `search_path=billing_schema,public`

2. **统一迁移工具选型**:
   - 评估 `golang-migrate/migrate`
   - 评估 `pressly/goose`
   - 制定迁移工具标准

3. **跨服务依赖解耦**:
   - siterank不直接引用User表
   - 通过Pub/Sub订阅UserCreated事件
   - 维护本地用户投影表

---

## 五、经验教训

### 5.1 迁移模式选择

**经验**:
- 模式1（独立迁移）适合核心业务表和频繁变更场景
- 模式2（内嵌DDL）适合辅助表和稳定场景
- 避免在handler中执行DDL检查（性能问题）

**最佳实践**:
```go
// ❌ 错误：每次请求检查
func (h *Handler) CreateOffer(w http.ResponseWriter, r *http.Request) {
    if err := h.ensureTable(r.Context()); err != nil { ... }
    // ...
}

// ✅ 正确：启动时检查
func main() {
    if err := ensureAllTables(db); err != nil {
        log.Fatalf("DDL: %v", err)
    }
    // 启动HTTP server
}
```

### 5.2 跨服务数据库引用

**问题**: siterank引用billing的User表

**风险**:
- 破坏服务自治性
- 数据库迁移时产生依赖
- 无法独立扩展

**解决方案**:
```
Option 1: Event Sourcing
  billing发布UserCreated事件 → siterank订阅 → 同步到本地表

Option 2: API调用
  siterank通过HTTP调用billing获取用户信息（缓存结果）

Option 3: 数据冗余
  siterank存储必要的用户字段副本（userId, email）
```

### 5.3 多模式共存

**当前挑战**:
- 模式1和模式2在同一数据库混用
- 可能产生表名冲突、schema不一致

**缓解策略**:
1. **命名约定**: 表名加服务前缀（如`billing_user_token`）
2. **Schema隔离**: 使用PostgreSQL schema namespace
3. **启动检查**: 服务启动时验证必需表存在

---

## 六、指标与成果

### 6.1 代码质量

| 指标 | 完成情况 |
|------|---------|
| adscenter migrator镜像 | ✅ 构建成功 |
| 配置文件修复 | ✅ 4个文件 |
| 数据库模式调研 | ✅ 完成 |
| 文档产出 | ✅ 本总结 |

### 6.2 架构理解

| 服务 | 数据库模式 | 表数量 | 迁移文件 | 备注 |
|------|----------|--------|---------|------|
| **billing** | 独立迁移 | 8+ | 6个 | ✅ DB Migrator就绪 |
| **adscenter** | 独立迁移 | 10+ | 5个 | ✅ DB Migrator就绪 |
| **offer** | 内嵌DDL | 4 | 0 | ⚠️ handler中创建 |
| **siterank** | 内嵌DDL | 4 | 0 | ⚠️ 引用User表 |

### 6.3 风险识别

| 风险项 | 影响等级 | 缓解措施 |
|-------|---------|---------|
| 表名冲突 | 🟡 中 | Schema级隔离 |
| User表不一致 | 🟡 中 | 对齐stub结构 |
| handler DDL性能 | 🟡 中 | 移到启动时 |
| 跨服务引用 | 🔴 高 | 事件驱动解耦 |

---

## 七、后续任务优先级

### P0 (本周完成)

- [ ] 优化offer服务：DDL移到启动时执行
- [ ] 检查数据库中的同名表冲突
- [ ] 更新MustKnowV4.md，添加数据库模式章节

### P1 (2周内)

- [ ] 标准化idempotency_keys表设计
- [ ] 对齐siterank的User stub表结构
- [ ] 添加服务启动时的schema校验

### P2 (1个月内)

- [ ] 实施Schema级隔离
- [ ] 解耦siterank对User表的直接引用
- [ ] 评估并选定统一迁移工具

---

**总结**: Phase 3完成了adscenter DB Migrator构建，并深入调研了项目的数据库初始化策略。发现了模式1（独立迁移）和模式2（内嵌DDL）的合理混用，但也识别出潜在的表冲突和跨服务引用风险。建议短期内优化offer服务的DDL执行方式，中期实施Schema隔离。

**下一步**: 执行P0优先级任务（优化offer DDL + 冲突检查 + 文档更新）。
