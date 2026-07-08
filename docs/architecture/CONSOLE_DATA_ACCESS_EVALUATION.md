# Console服务数据访问模式评估

**日期**: 2025-10-17
**评估对象**: Console后台管理系统
**问题**: 直接查询数据库 vs 调用服务API

---

## 执行摘要

**推荐方案**: **混合模式** - 针对不同场景选择不同策略

- **聚合统计查询**: 直接数据库访问（性能优势明显）
- **单资源CRUD**: 调用服务API（保持业务逻辑封装）
- **跨域复杂查询**: 创建专用Read Model视图

**理由**: Console是特殊的管理系统，其需求与业务服务不同，需要灵活性和性能的平衡。

---

## 当前状态分析

### Console现有实现

```
services/console/
├── internal/handlers/
│   ├── tokens_handlers.go      # 直接查询 UserToken, TokenTransaction
│   ├── subscriptions_handlers.go # 直接查询 Subscription, User (JOIN)
│   └── ...
└── internal/clients/
    ├── billing.go              # HTTP client (未使用)
    ├── offer.go                # HTTP client (未使用)
    ├── siterank.go             # HTTP client (未使用)
    └── adscenter.go            # HTTP client (未使用)
```

**发现**:
- ✅ 已经实现了4个HTTP clients
- ❌ 但实际代码使用的是直接SQL查询
- ❌ 存在跨域JOIN查询 (`Subscription LEFT JOIN User`)

---

## 方案对比

### 方案A: 直接数据库查询

#### 优点 ✅

1. **性能优势**
   ```sql
   -- 单次查询完成聚合统计
   SELECT
     COUNT(DISTINCT s.id) as subscriptions,
     COUNT(DISTINCT o.id) as offers,
     SUM(t.balance) as total_tokens
   FROM "Subscription" s
   LEFT JOIN "Offer" o ON s."userId" = o."userId"
   LEFT JOIN "UserToken" t ON s."userId" = t."userId"
   -- vs 调用3个API + 内存聚合
   ```
   - 减少网络往返：1次查询 vs N次API调用
   - 数据库优化器处理JOIN和聚合
   - 延迟：~10-50ms vs ~100-500ms

2. **查询灵活性**
   ```sql
   -- 管理员需要的复杂查询
   SELECT DATE(created_at), COUNT(*), SUM(balance)
   FROM "TokenTransaction"
   WHERE created_at > NOW() - INTERVAL '30 days'
   GROUP BY DATE(created_at)
   ORDER BY DATE(created_at)
   ```
   - API通常不提供如此灵活的查询能力
   - 避免为每个管理需求创建新API

3. **开发速度快**
   - SQL查询直接写，无需协调服务团队
   - 快速响应管理需求变化
   - 原型开发效率高

4. **事务一致性**
   - 单个事务内读取多表数据
   - 避免分布式查询的一致性问题

#### 缺点 ❌

1. **违反服务边界**
   - Console直接访问billing、offer、siterank的表
   - 破坏bounded context隔离
   - 紧耦合到数据库schema

2. **绕过业务逻辑**
   ```go
   // 错误：跳过了业务层的RLS、权限检查、数据过滤
   SELECT * FROM "Subscription" WHERE userId = $1

   // 正确：通过service API会执行所有业务规则
   billingClient.GetSubscription(userId)
   ```

3. **Schema耦合风险**
   ```
   Billing Service修改表结构
   ↓
   Console的SQL查询全部失败
   ↓
   需要同步更新Console代码
   ```
   - 无API版本控制保护
   - 破坏服务独立部署

4. **无法利用服务层缓存**
   - Billing service缓存了subscription数据
   - Console绕过缓存，直接查DB → 增加DB负载

5. **测试困难**
   - 需要完整数据库环境
   - 无法mock服务API
   - 集成测试复杂

---

### 方案B: 调用服务API

#### 优点 ✅

1. **遵循微服务原则**
   ```go
   // 尊重服务边界
   subscriptions := billingClient.ListSubscriptions(ctx, filters)
   offers := offerClient.ListOffers(ctx, userID)
   ```
   - 保持bounded context隔离
   - 服务拥有数据完整性

2. **业务逻辑封装**
   ```go
   // Billing service的GetSubscription()包含：
   // - RLS权限检查
   // - 数据脱敏（如隐藏支付方式）
   // - 派生字段计算（如剩余天数）
   // - 审计日志记录
   ```
   - Console自动继承所有业务规则
   - 数据一致性由service保证

3. **Schema解耦**
   ```
   Billing修改表结构
   ↓
   只需更新Billing service API实现
   ↓
   Console无感知（API contract不变）
   ```
   - API版本控制保护
   - 服务独立演进

4. **利用服务缓存**
   ```
   Console → Billing API → Redis Cache → DB
                           ↑ 缓存命中，无DB查询
   ```
   - 减少数据库负载
   - 提升响应速度

5. **测试友好**
   ```go
   // 单元测试：mock HTTP client
   mockBilling := &MockBillingClient{
       GetSubscription: func() {...}
   }
   ```
   - 无需数据库
   - 快速测试

#### 缺点 ❌

1. **性能开销**
   ```
   Dashboard需要显示：
   - 用户总数
   - Offer总数
   - 订阅数
   - Token总额

   直接查询：1次SQL JOIN (~20ms)
   API调用：4次HTTP请求 (~400ms)
   ```
   - N+1查询问题
   - 网络延迟累加

2. **聚合查询困难**
   ```go
   // 需求：查询过去30天每天的token消费趋势
   // API通常不提供时间维度聚合
   for day := 0; day < 30; day++ {
       transactions := billingClient.GetTransactions(startDate, endDate)
       // 在内存中聚合 → 低效
   }
   ```

3. **API能力限制**
   ```
   // 管理员需要：按多个维度过滤+自定义排序
   SELECT * FROM "Subscription"
   WHERE plan IN ('pro', 'enterprise')
     AND status = 'active'
     AND currentPeriodEnd < NOW() + INTERVAL '7 days'
   ORDER BY currentPeriodEnd, userId
   LIMIT 100

   // API可能不支持如此灵活的查询组合
   ```

4. **开发效率低**
   - 每个新查询需求要协调服务团队
   - 等待API开发完成
   - 管理需求响应慢

5. **API调用失败**
   ```
   Billing service宕机
   ↓
   Console Dashboard完全无法显示订阅数据
   ```
   - 单点故障传播
   - 降级策略复杂

---

## 推荐方案：混合模式

### 决策矩阵

| 场景 | 推荐方式 | 理由 |
|------|---------|------|
| **聚合统计** (如Dashboard总数) | 直接SQL | 性能关键，无业务逻辑 |
| **跨域JOIN查询** | Read Model视图 | 解耦+性能 |
| **单资源CRUD** | 服务API | 保持业务逻辑 |
| **实时数据** | 服务API | 利用缓存 |
| **历史数据分析** | 直接SQL | 只读，不修改 |
| **管理员操作** (如强制取消订阅) | 服务API | 必须执行业务规则 |

### 实施策略

#### 1. 创建Console专用Read Model

```sql
-- services/console/migrations/
CREATE MATERIALIZED VIEW console_dashboard_stats AS
SELECT
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT o.id) as total_offers,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status='active') as active_subscriptions,
    COALESCE(SUM(t.balance), 0) as total_token_balance,
    MAX(u."createdAt") as last_user_signup,
    COUNT(DISTINCT o.id) FILTER (WHERE o."createdAt" > NOW() - INTERVAL '24 hours') as offers_24h
FROM "User" u
LEFT JOIN "Offer" o ON u.id = o."userId"
LEFT JOIN "Subscription" s ON u.id = s."userId"
LEFT JOIN "UserToken" t ON u.id = t."userId";

-- 每5分钟刷新一次
CREATE INDEX idx_console_stats_refresh ON console_dashboard_stats USING btree ((1));
```

**优势**:
- 读写分离：不影响业务表
- 预聚合：查询极快 (~1ms)
- 解耦：可以自由JOIN跨域表
- 可控：明确哪些数据被Console访问

#### 2. 使用API处理写操作和业务规则

```go
// ❌ 错误：直接UPDATE跳过业务规则
func (h *Handler) cancelSubscription(w http.ResponseWriter, r *http.Request) {
    db.Exec(`UPDATE "Subscription" SET status='cancelled' WHERE id=$1`, subID)
}

// ✅ 正确：通过API执行，包含所有业务逻辑
func (h *Handler) cancelSubscription(w http.ResponseWriter, r *http.Request) {
    h.billingClient.CancelSubscription(ctx, subID, reason)
    // 包含：退款逻辑、通知、审计日志、webhook等
}
```

#### 3. 针对只读查询，允许直接SQL

```go
// ✅ 允许：聚合统计（只读，无业务逻辑）
func (h *Handler) getTokenStats(w http.ResponseWriter, r *http.Request) {
    var stats struct {
        TotalUsers  int
        TotalTokens int64
    }
    db.QueryRow(`
        SELECT COUNT(DISTINCT "userId"), COALESCE(SUM(balance), 0)
        FROM "UserToken"
    `).Scan(&stats.TotalUsers, &stats.TotalTokens)
}

// ✅ 允许：复杂时间序列查询
func (h *Handler) getTokenTrend(w http.ResponseWriter, r *http.Request) {
    rows := db.Query(`
        SELECT DATE(created_at), SUM(amount)
        FROM "TokenTransaction"
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
    `)
}
```

#### 4. 建立清晰的表所有权规则

```
┌─────────────────────────────────────────────┐
│ Console Service 可读表                      │
├─────────────────────────────────────────────┤
│ ✅ Read-only via SQL (aggregation only):   │
│    • User (基础信息)                        │
│    • UserToken (统计)                       │
│    • TokenTransaction (统计)                │
│    • Subscription (统计)                    │
│    • Offer (统计)                           │
│    • SiterankHistory (统计)                 │
│                                             │
│ ❌ NEVER write directly to these tables    │
│    → Use service APIs for mutations        │
│                                             │
│ ✅ Console-owned tables (full access):     │
│    • console_dashboard_stats (materialized) │
│    • admin_audit_log                        │
│    • admin_feature_flags                    │
└─────────────────────────────────────────────┘
```

---

## 具体修改建议

### 修改1: 保留聚合统计的直接查询

**文件**: `services/console/internal/handlers/tokens_handlers.go:47`

```go
// ✅ 保留 - 这是简单的聚合统计，性能关键
func (h *Handler) getTokenStats(w http.ResponseWriter, r *http.Request) {
    var count, sum int64
    err := h.DB.QueryRow(r.Context(),
        `SELECT COUNT(*), COALESCE(SUM(balance),0) FROM "UserToken"`
    ).Scan(&count, &sum)
    // ...
}
```

**理由**:
- 只读聚合查询
- 无业务逻辑
- 性能优势明显 (1次查询 vs N次API)

---

### 修改2: 删除跨域JOIN，改用API或视图

**文件**: `services/console/internal/handlers/subscriptions_handlers.go:95-96`

```sql
-- ❌ 当前：跨域JOIN查询
FROM "Subscription" s
LEFT JOIN "User" u ON s."userId" = u.id

-- ✅ 方案1：创建视图 (推荐)
CREATE VIEW console_subscriptions_with_users AS
SELECT
    s.*,
    u.email as user_email,
    u.name as user_name
FROM "Subscription" s
LEFT JOIN "User" u ON s."userId" = u.id;

-- ✅ 方案2：调用API
subscriptions := h.billingClient.ListSubscriptions(ctx, filters)
for _, sub := range subscriptions {
    // 可能需要N+1查询user信息
    // 或者让billing API返回user信息
}
```

**推荐**: 使用视图，因为：
- 这是只读查询
- 需要JOIN两个表的数据
- Dashboard性能要求高

---

### 修改3: 删除表创建逻辑

**文件**: `services/console/internal/handlers/tokens_handlers.go:17-34`

```go
// ❌ 删除 - Console不应创建业务表
func ensureTokenTables(ctx context.Context, db PgxPool) {
    db.Exec(ctx, `CREATE TABLE IF NOT EXISTS "UserToken"(...)`)
    db.Exec(ctx, `CREATE TABLE IF NOT EXISTS "TokenTransaction"(...)`)
}
```

**理由**:
- `UserToken` 属于 Billing service
- `TokenTransaction` 属于 Billing service
- Console不应该拥有其他服务的表

---

### 修改4: 使用API处理修改操作

如果Console有类似这样的代码（当前没有，但未来可能有）：

```go
// ❌ 错误：直接修改订阅状态
func (h *Handler) adjustSubscription(w http.ResponseWriter, r *http.Request) {
    db.Exec(`UPDATE "Subscription" SET "planName"=$1 WHERE id=$2`, newPlan, subID)
}

// ✅ 正确：通过API修改
func (h *Handler) adjustSubscription(w http.ResponseWriter, r *http.Request) {
    err := h.billingClient.UpdateSubscription(ctx, subID, newPlan)
    // 会触发：billing逻辑、webhook、审计日志等
}
```

---

## 架构决策记录 (ADR)

### ADR-006: Console Service Data Access Strategy

**Status**: Proposed
**Date**: 2025-10-17
**Decision Makers**: Architecture Team

#### Context

Console是admin管理系统，需要：
1. 跨服务聚合数据展示
2. 灵活的查询能力（筛选、排序、分组）
3. 快速响应管理员需求
4. 同时需要遵循微服务原则

#### Decision

采用**混合模式**：

1. **读操作分类**:
   - 聚合统计 → 直接SQL
   - 单资源查询 → 服务API
   - 跨域JOIN → 专用视图

2. **写操作**:
   - 所有修改 → 必须调用服务API

3. **清晰的边界**:
   - Console可以READ跨域表（仅聚合统计）
   - Console不能WRITE其他服务的表
   - 创建Console专用Read Model视图

#### Consequences

**Positive**:
- ✅ 保持Dashboard性能
- ✅ 开发效率高
- ✅ 尊重服务边界（写操作）
- ✅ 灵活的查询能力

**Negative**:
- ⚠️ Schema耦合（需要文档管理）
- ⚠️ 需要维护视图
- ⚠️ 测试需要完整DB

**Mitigation**:
- 文档化所有Console的SQL查询
- 定期review跨域依赖
- 服务schema变更时通知Console团队

---

## 对比其他系统的实践

### 1. Netflix - Zuul + Admin Portal

Netflix的做法：
- Zuul (Gateway) → 只做路由
- Admin Portal → 直接查询聚合数据库（不是业务DB）
- 使用CDC (Change Data Capture) 同步数据

**启示**: 大规模系统使用专用数据库给管理系统

### 2. Uber - Admin API + Read Replicas

Uber的做法：
- Admin APIs → 专用API层，聚合多个服务
- Read from replicas → 管理查询不影响业务DB
- CQRS pattern → 读写分离

**启示**: Admin系统可以有特殊权限访问read replicas

### 3. Airbnb - Superset + Data Warehouse

Airbnb的做法：
- Apache Superset → 数据可视化工具
- ETL pipeline → 业务数据同步到数据仓库
- Admin查询 → 查数据仓库，不查业务DB

**启示**: 大量历史数据分析应该在数据仓库完成

---

## 实施计划

### Phase 1: 清理违规直接写操作 (如果存在)

```bash
# 搜索所有UPDATE/DELETE/INSERT到其他服务表的操作
grep -r "UPDATE.*Subscription\|DELETE.*Offer\|INSERT.*UserToken" services/console/
```

**修复**: 全部替换为服务API调用

### Phase 2: 创建Console专用视图

```sql
-- services/console/migrations/001_read_models.sql
CREATE VIEW console_subscription_summary AS ...;
CREATE MATERIALIZED VIEW console_dashboard_stats AS ...;
```

### Phase 3: 重构跨域JOIN查询

将现有的JOIN查询：
1. 简单JOIN → 改用视图
2. 复杂JOIN → 改用API + 内存聚合
3. 统计聚合 → 保持直接SQL（文档化）

### Phase 4: 文档化所有SQL查询

创建 `services/console/docs/SQL_QUERIES.md`:
```markdown
## Console Service SQL Queries

### Read-only queries to other services' tables:

1. **UserToken statistics**
   - Query: `SELECT COUNT(*), SUM(balance) FROM "UserToken"`
   - Purpose: Dashboard token stats
   - Service: Billing
   - Impact: If Billing changes UserToken schema, update this query

2. **Subscription count**
   - Query: `SELECT COUNT(*) FROM "Subscription" WHERE status='active'`
   - Purpose: Dashboard subscription stats
   - Service: Billing
   - Impact: If Billing changes status values, update this query
```

---

## 结论

**最终建议**: **混合模式**

1. **Dashboard聚合统计**: 保持直接SQL查询
   - 性能关键
   - 只读，无副作用
   - 无业务逻辑

2. **单资源CRUD**: 使用服务API
   - 保持业务逻辑封装
   - 利用缓存
   - 版本控制保护

3. **跨域JOIN**: 创建Console专用视图
   - 解耦服务schema
   - 保持查询性能
   - 明确依赖关系

4. **所有修改操作**: 必须调用服务API
   - 确保业务规则执行
   - 审计和通知
   - 数据一致性

**Trade-offs accepted**:
- ✅ 接受一定的schema耦合（仅限只读聚合统计）
- ✅ 接受Console需要了解部分业务表结构
- ✅ 接受通过文档管理跨域依赖

**Trade-offs rejected**:
- ❌ 不接受Console绕过业务规则直接修改数据
- ❌ 不接受Console创建其他服务的表
- ❌ 不接受无文档的SQL查询

---

**审核**: 待架构委员会批准
**实施**: Phase 1优先，Phase 2-4视资源情况逐步实施
