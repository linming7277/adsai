# 数据库表名冲突分析

**分析日期**: 2025-10-05
**分析方法**: 代码静态分析 + DDL提取

---

## 一、表名冲突检查结果

### 1.1 潜在冲突表

#### 冲突1: idempotency_keys

**发现位置**:
- `services/offer/internal/handlers/ddl.go` - offer服务创建
- `services/billing/internal/migrations/000001_create_initial_tables.up.sql` - billing可能创建（待验证）

**offer版本**:
```sql
CREATE TABLE IF NOT EXISTS idempotency_keys(
    key TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    target_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
```

**风险级别**: 🟡 中等
**影响**: 如果两个服务都创建此表，schema可能不一致

**建议解决方案**:
1. **短期**: 重命名为服务特定表名
   - offer: `offer_idempotency_keys`
   - billing: `billing_idempotency_keys`

2. **长期**: 创建共享的IdempotencyKeys表
   ```sql
   CREATE TABLE IF NOT EXISTS "IdempotencyKeys" (
       key TEXT PRIMARY KEY,
       service TEXT NOT NULL,  -- 'offer', 'billing', 'adscenter'
       user_id TEXT NOT NULL,
       scope TEXT NOT NULL,
       target_id TEXT NOT NULL,
       created_at TIMESTAMPTZ NOT NULL,
       expires_at TIMESTAMPTZ NOT NULL
   );
   CREATE INDEX idx_idempotency_keys_service_expires
       ON "IdempotencyKeys"(service, expires_at);
   ```

#### 冲突2: User表

**发现位置**:
- `services/billing/internal/migrations/000001_create_initial_tables.up.sql` - billing的User表
- `services/siterank/main.go` - siterank的User stub表

**billing版本**:
```sql
CREATE TABLE IF NOT EXISTS "User" (
    id TEXT NOT NULL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMPTZ NOT NULL,
    "lastLoginAt" TIMESTAMPTZ,
    "notificationPreferences" JSONB
);
```

**siterank版本** (待确认):
```sql
CREATE TABLE IF NOT EXISTS "User" (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'USER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**差异**:
- 列名大小写不同：`createdAt` vs `created_at`
- siterank缺少 `lastLoginAt` 和 `notificationPreferences` 列

**风险级别**: 🔴 高
**影响**: Schema不一致，可能导致查询失败

**建议解决方案**:
1. **立即**: 对齐siterank的User表结构与billing一致
   ```go
   // services/siterank/main.go
   func ensureUserTableStubDDL(db *sql.DB) error {
       ddl := `
   CREATE TABLE IF NOT EXISTS "User" (
       id TEXT PRIMARY KEY,
       email TEXT NOT NULL UNIQUE,
       name TEXT,
       role TEXT NOT NULL DEFAULT 'USER',
       "createdAt" TIMESTAMPTZ NOT NULL,
       "lastLoginAt" TIMESTAMPTZ,
       "notificationPreferences" JSONB
   );
   `
       _, err := db.Exec(ddl)
       return err
   }
   ```

2. **长期**: siterank不直接引用User表，改为：
   - 通过事件订阅UserCreated事件
   - 维护本地UserProjection表

### 1.2 无冲突但需注意的表

#### OfferStatusHistory

**发现位置**: 仅 `services/offer/internal/handlers/ddl.go`

**状态**: ✅ 无冲突

#### OfferPreferences

**发现位置**: 仅 `services/offer/internal/handlers/ddl.go`

**状态**: ✅ 无冲突

#### OfferKpiDeadLetter

**发现位置**: 仅 `services/offer/internal/handlers/ddl.go`

**状态**: ✅ 无冲突

#### TokenTransaction, UserToken, Subscription

**发现位置**: 仅 `services/billing/internal/migrations/`

**状态**: ✅ 无冲突

#### domain_cache, domain_country_cache

**发现位置**: 仅 `services/siterank/main.go`

**状态**: ✅ 无冲突

---

## 二、服务表归属清单

### 2.1 billing服务

**迁移文件**: `services/billing/internal/migrations/000001_create_initial_tables.up.sql`

**核心表**:
- `Event` - 事件存储
- `User` - 用户表（核心）
- `Subscription` - 订阅
- `UserToken` - 用户Token余额
- `TokenTransaction` - Token交易记录
- `Offer` - Offer聚合根（读模型）

**后续迁移表** (000002-000006):
- `UserTokenPool` - Token池
- `TokenCreditLot` - 积分批次
- `TokenCreditAllocation` - 积分分配
- `TokenRepairAudit` - 修复审计

**特征**: 严格的版本化迁移，完整的业务表

### 2.2 offer服务

**DDL文件**: `services/offer/internal/handlers/ddl.go`

**辅助表**:
- `OfferStatusHistory` - 状态历史
- `OfferPreferences` - 偏好设置
- `OfferKpiDeadLetter` - KPI死信队列
- `idempotency_keys` - 幂等性键（⚠️ 潜在冲突）

**特征**: 代码内嵌DDL，辅助表为主

### 2.3 siterank服务

**DDL位置**: `services/siterank/main.go`

**缓存表**:
- `domain_cache` - 域名缓存
- `domain_country_cache` - 域名国家缓存
- `User` - User stub表（⚠️ 冲突）
- `SiterankHistory` - 评分历史

**特征**: 启动时创建，主要为缓存表

### 2.4 adscenter服务

**迁移文件**: `services/adscenter/internal/migrations/`

**业务表**:
- `UserAdsConnection` - 用户广告连接
- `IdempotencyKeys` - 幂等性键
- `BulkAudit` - 批量审计
- `MccLink` - MCC链接
- `AuditEvents` - 审计事件

**特征**: 版本化迁移，业务表为主

---

## 三、冲突影响评估

### 3.1 idempotency_keys冲突

**当前状态**: offer服务使用小写表名 `idempotency_keys`

**潜在问题**:
1. 如果billing也创建此表，schema可能不同
2. 不同服务的幂等性键可能冲突（key重复）

**影响范围**:
- offer服务: CreateOffer操作的幂等性
- billing服务: （待确认是否使用）

**缓解措施** (已实施):
- offer的idempotency_keys增加了scope字段区分不同操作
- 包含user_id, scope, target_id, expires_at

**推荐行动**:
1. 检查billing是否创建idempotency_keys表
2. 如是，统一为共享表设计（增加service列）
3. 如否，保持现状但文档化

### 3.2 User表冲突

**当前状态**: billing创建完整User表，siterank创建stub

**确认问题**:
- siterank的User表缺少列（`lastLoginAt`, `notificationPreferences`）
- 列名大小写不一致（`created_at` vs `createdAt`）

**影响范围**:
- siterank依赖User表的外键引用
- 如果billing先创建，siterank的stub无法覆盖
- 如果siterank先创建，billing的完整表会失败

**严重性**: 🔴 高 - 可能导致服务启动失败

**推荐行动** (立即):
1. **对齐stub结构**: 修改siterank的User DDL与billing完全一致
2. **测试顺序**: 确保billing先启动（创建完整User表）
3. **长期解耦**: siterank不直接引用User，改用事件订阅

---

## 四、Schema隔离方案

### 4.1 短期方案: 表名前缀

为每个服务的表添加前缀，避免冲突：

```sql
-- billing服务
billing_user_token
billing_subscription
billing_token_transaction

-- offer服务
offer_status_history
offer_preferences
offer_kpi_dead_letter
offer_idempotency_keys  -- 明确前缀

-- siterank服务
siterank_domain_cache
siterank_domain_country_cache
siterank_history

-- adscenter服务
adscenter_user_ads_connection
adscenter_bulk_audit
```

**优点**:
- 实施简单，修改DDL即可
- 明确归属，易于识别

**缺点**:
- 需要更新所有SQL查询
- 破坏现有数据

### 4.2 中期方案: PostgreSQL Schema隔离

创建独立schema namespace：

```sql
-- 创建schema
CREATE SCHEMA IF NOT EXISTS billing_schema;
CREATE SCHEMA IF NOT EXISTS offer_schema;
CREATE SCHEMA IF NOT EXISTS siterank_schema;
CREATE SCHEMA IF NOT EXISTS adscenter_schema;
CREATE SCHEMA IF NOT EXISTS shared_schema;

-- 迁移表
ALTER TABLE "UserToken" SET SCHEMA billing_schema;
ALTER TABLE "Offer" SET SCHEMA shared_schema;  -- 多服务共享的读模型
ALTER TABLE "User" SET SCHEMA shared_schema;   -- 共享用户表

-- 更新search_path
-- billing: search_path=billing_schema,shared_schema,public
-- offer: search_path=offer_schema,shared_schema,public
```

**优点**:
- 逻辑隔离，物理共享
- 成本低，迁移相对简单
- 保留跨schema查询能力

**缺点**:
- 需要更新所有服务的连接配置
- 跨schema查询需要显式指定

### 4.3 长期方案: 物理数据库隔离

每个服务使用独立的数据库实例：

```
billing-db (Cloud SQL实例)
  └─ billing_schema.*

offer-db (Cloud SQL实例)
  └─ offer_schema.*

shared-db (Cloud SQL实例)
  └─ shared_schema.* (Offer, User等投影表)
```

**优点**:
- 完全隔离，符合微服务原则
- 可独立扩展和优化
- 故障隔离

**缺点**:
- 成本高（多个实例）
- 跨库查询需要应用层聚合
- 分布式事务复杂

---

## 五、推荐实施路径

### Phase 1: 立即修复 (本周)

1. **对齐User表结构**:
   ```bash
   # 修改services/siterank/main.go中的ensureUserTableStubDDL
   # 使其与billing的User表完全一致
   ```

2. **检查idempotency_keys使用**:
   ```bash
   # 搜索billing代码确认是否创建此表
   grep -r "idempotency_keys" services/billing/
   ```

3. **文档化表归属**:
   - 更新MustKnowV4.md，添加"数据库表归属"章节
   - 明确每个服务拥有的表

### Phase 2: Schema隔离 (2周内)

1. **创建schema namespace**:
   ```sql
   CREATE SCHEMA IF NOT EXISTS billing_schema;
   CREATE SCHEMA IF NOT EXISTS offer_schema;
   CREATE SCHEMA IF NOT EXISTS siterank_schema;
   CREATE SCHEMA IF NOT EXISTS adscenter_schema;
   CREATE SCHEMA IF NOT EXISTS shared_schema;
   ```

2. **迁移表到schema**:
   - billing表 → billing_schema
   - offer辅助表 → offer_schema
   - 共享表(User, Offer) → shared_schema

3. **更新服务配置**:
   ```yaml
   # billing/preview-deploy.yaml
   env:
   - name: DATABASE_URL
     value: "postgresql://...?options=-c search_path=billing_schema,shared_schema,public"
   ```

### Phase 3: 解耦依赖 (1个月内)

1. **siterank解耦User表**:
   - 订阅UserCreated事件
   - 维护本地UserProjection表
   - 移除对shared User表的直接引用

2. **统一idempotency设计**:
   - 创建共享IdempotencyKeys表（带service列）
   - 迁移offer和billing到统一表

3. **完善文档**:
   - Schema设计文档
   - 迁移指南
   - 回滚方案

---

## 六、行动检查清单

### 立即执行
- [ ] 修复siterank User表结构，与billing对齐
- [ ] 确认billing是否创建idempotency_keys表
- [ ] 更新MustKnowV4.md数据库章节

### 2周内
- [ ] 创建PostgreSQL schema namespace
- [ ] 迁移表到对应schema
- [ ] 更新所有服务的DATABASE_URL配置
- [ ] 测试跨schema查询

### 1个月内
- [ ] siterank解耦User表依赖
- [ ] 统一idempotency_keys设计
- [ ] 完善Schema管理文档

---

**分析人**: Claude AI架构顾问
**复审日期**: 2025-11-05
