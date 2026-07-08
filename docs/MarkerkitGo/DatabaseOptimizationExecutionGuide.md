# 数据库索引优化执行指南

**创建日期**: 2025-10-07
**执行环境**: Google Cloud Shell
**预期收益**: Console Dashboard 延迟降低 50% (500ms → 250ms)

---

## 一、前提条件

### 1.1 准备工作

```bash
# 1. 在 Cloud Console 打开 Cloud Shell
# https://console.cloud.google.com/?cloudshell=true&project=gen-lang-client-0944935873

# 2. 克隆仓库（如果尚未克隆）
git clone https://github.com/xxrenzhe/autoads.git
cd autoads
```

### 1.2 验证 Cloud SQL 实例状态

```bash
gcloud sql instances list --project=gen-lang-client-0944935873

# 预期输出:
# NAME     CONNECTION_NAME                                          STATUS
# autoads  gen-lang-client-0944935873:asia-northeast1:autoads       RUNNABLE
```

---

## 二、执行步骤

### 2.1 连接到 Cloud SQL 实例

```bash
# 方式1: 使用 gcloud sql connect（推荐）
gcloud sql connect autoads \
  --user=postgres \
  --project=gen-lang-client-0944935873 \
  --quiet
# 提示输入密码时，从 Secret Manager 获取
```

**获取数据库密码**:
```bash
# 在另一个 Cloud Shell 标签页中运行
gcloud secrets versions access latest \
  --secret="DATABASE_URL" \
  --project=gen-lang-client-0944935873

# 输出: postgresql://postgres:$GL(~x]T2Q[M@uX4@10.6.0.2:5432/autoads_db
# 密码是: $GL(~x]T2Q[M@uX4
```

### 2.2 验证数据库列表

连接成功后，在 psql 中运行：

```sql
-- 查看所有数据库
\l

-- 预期包含:
-- offer_db
-- billing_db
-- adscenter_db
-- siterank_db
-- shared_db
```

### 2.3 对每个数据库执行索引创建

#### Step 1: 连接到 offer_db

```sql
\c offer_db

-- 查看执行前的索引统计
SELECT
  schemaname,
  tablename,
  COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'Offer'
GROUP BY schemaname, tablename;
```

#### Step 2: 创建 Offer 表索引

```sql
-- 1.1 Offer 表: userId + status 复合索引
CREATE INDEX IF NOT EXISTS "idx_offer_userid_status"
  ON "Offer"("userId", status);

-- 1.2 Offer 表: userId + createdAt 复合索引
CREATE INDEX IF NOT EXISTS "idx_offer_userid_created"
  ON "Offer"("userId", "createdAt" DESC);

-- 1.3 Offer 表: userId + updatedAt 复合索引
CREATE INDEX IF NOT EXISTS "idx_offer_userid_updated"
  ON "Offer"("userId", "updatedAt" DESC);

-- 1.4 Offer 表: status 单列索引
CREATE INDEX IF NOT EXISTS "idx_offer_status"
  ON "Offer"(status)
  WHERE status IN ('active', 'paused', 'evaluating');

-- 添加注释
COMMENT ON INDEX "idx_offer_userid_status" IS 'Console Dashboard: 用户+状态筛选查询优化';
COMMENT ON INDEX "idx_offer_userid_created" IS 'Console Dashboard: 最近创建 offers 列表优化';
COMMENT ON INDEX "idx_offer_status" IS 'Admin Dashboard: 全局状态统计优化';
```

#### Step 3: 验证索引创建结果

```sql
-- 查看新建的索引
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'Offer'
  AND indexname LIKE 'idx_offer_%';

-- 查看索引大小
SELECT
  schemaname,
  tablename,
  COUNT(*) as index_count,
  pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_size
FROM pg_indexes
JOIN pg_class ON pg_class.relname = indexname
WHERE schemaname = 'public'
  AND tablename = 'Offer'
GROUP BY schemaname, tablename;
```

#### Step 4: 连接到 billing_db 并创建索引

```sql
\c billing_db

-- 2.1 UserToken 表: userId 索引（确保存在）
CREATE INDEX IF NOT EXISTS "idx_user_token_userid"
  ON "UserToken"("userId");

-- 2.2 TokenTransaction 表: userId + amount + createdAt 复合索引
CREATE INDEX IF NOT EXISTS "idx_token_tx_userid_amount_created"
  ON "TokenTransaction"("userId", amount, "createdAt" DESC)
  WHERE amount < 0;

-- 2.3 TokenTransaction 表: operationType 索引
CREATE INDEX IF NOT EXISTS "idx_token_tx_operation_type"
  ON "TokenTransaction"("operationType", "createdAt" DESC);

COMMENT ON INDEX "idx_token_tx_userid_amount_created" IS 'Console Dashboard: 月度 Token 消耗统计优化';
COMMENT ON INDEX "idx_token_tx_operation_type" IS 'Admin Dashboard: 按服务类型统计 Token 消耗';

-- 验证
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename IN ('UserToken', 'TokenTransaction')
  AND schemaname = 'public';
```

#### Step 5: 连接到 adscenter_db 并创建索引

```sql
\c adscenter_db

-- 3.1 UserAdsConnection 表: userId + status 复合索引
CREATE INDEX IF NOT EXISTS "idx_user_ads_conn_userid_status"
  ON "UserAdsConnection"("userId", status);

-- 3.2 UserAdsConnection 表: userId + createdAt 复合索引
CREATE INDEX IF NOT EXISTS "idx_user_ads_conn_userid_created"
  ON "UserAdsConnection"("userId", "createdAt" DESC);

-- 3.3 UserAdsConnection 表: status 单列索引
CREATE INDEX IF NOT EXISTS "idx_user_ads_conn_status"
  ON "UserAdsConnection"(status)
  WHERE status IN ('active', 'suspended', 'pending');

COMMENT ON INDEX "idx_user_ads_conn_userid_status" IS 'Console Dashboard: 用户广告账户状态筛选优化';
COMMENT ON INDEX "idx_user_ads_conn_userid_created" IS 'Console Dashboard: 最近添加账户列表优化';

-- 验证
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'UserAdsConnection'
  AND schemaname = 'public';
```

#### Step 6: 连接到 siterank_db 并创建索引

```sql
\c siterank_db

-- 4.1 SiterankAnalysis 表: offerId 索引
CREATE INDEX IF NOT EXISTS "idx_siterank_analysis_offerid"
  ON "SiterankAnalysis"("offerId");

-- 4.2 SiterankAnalysis 表: userId + createdAt 复合索引
CREATE INDEX IF NOT EXISTS "idx_siterank_analysis_userid_created"
  ON "SiterankAnalysis"("userId", "createdAt" DESC);

-- 4.3 SiterankAnalysis 表: status 索引
CREATE INDEX IF NOT EXISTS "idx_siterank_analysis_status"
  ON "SiterankAnalysis"(status, "createdAt" DESC);

COMMENT ON INDEX "idx_siterank_analysis_offerid" IS 'Console Dashboard: Offer-Siterank 关联查询优化';
COMMENT ON INDEX "idx_siterank_analysis_status" IS 'Admin Dashboard: Siterank 任务状态监控优化';

-- 验证
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'SiterankAnalysis'
  AND schemaname = 'public';
```

---

## 三、验证效果

### 3.1 使用 EXPLAIN ANALYZE 验证查询计划

```sql
-- 连接到 offer_db
\c offer_db

-- 示例查询: Console Dashboard - 用户的活跃 Offers
EXPLAIN ANALYZE
SELECT id, name, status, "createdAt"
FROM "Offer"
WHERE "userId" = 'test-user-id' AND status = 'active'
ORDER BY "createdAt" DESC
LIMIT 10;

-- 预期看到: Index Scan using idx_offer_userid_status
-- 执行时间应该从 ~100ms 降低到 ~20ms
```

```sql
-- 连接到 billing_db
\c billing_db

-- 示例查询: Console Dashboard - 月度 Token 消耗
EXPLAIN ANALYZE
SELECT SUM(amount) as total_consumed
FROM "TokenTransaction"
WHERE "userId" = 'test-user-id'
  AND "createdAt" >= '2025-10-01'
  AND "createdAt" < '2025-11-01'
  AND amount < 0;

-- 预期看到: Index Scan using idx_token_tx_userid_amount_created
-- 执行时间应该从 ~80ms 降低到 ~15ms
```

### 3.2 监控 Cloud SQL Insights

```bash
# 在浏览器中打开 Cloud SQL Insights
echo "https://console.cloud.google.com/sql/instances/autoads/insights?project=gen-lang-client-0944935873"

# 关注指标:
# - 慢查询数量下降
# - 平均查询延迟降低
# - 索引命中率提升
```

### 3.3 测试 Console Dashboard 加载时间

```bash
# 在浏览器中打开 Console Dashboard
# 使用浏览器 DevTools Network 标签测试加载时间

# 预期效果:
# - Dashboard API 响应时间: 500ms → 250ms (50% 提升)
# - Offer 列表查询: 100ms → 20ms (80% 提升)
# - Token 余额查询: 80ms → 15ms (80% 提升)
```

---

## 四、索引创建总结

### 创建的索引列表

| 数据库 | 表名 | 索引名 | 字段 | 用途 |
|--------|------|--------|------|------|
| offer_db | Offer | idx_offer_userid_status | userId, status | 用户筛选活跃/暂停 offers |
| offer_db | Offer | idx_offer_userid_created | userId, createdAt | 最近创建 offers 列表 |
| offer_db | Offer | idx_offer_userid_updated | userId, updatedAt | 最近更新 offers 列表 |
| offer_db | Offer | idx_offer_status | status | 全局状态统计 |
| billing_db | UserToken | idx_user_token_userid | userId | Token 余额查询 |
| billing_db | TokenTransaction | idx_token_tx_userid_amount_created | userId, amount, createdAt | 月度消耗统计 |
| billing_db | TokenTransaction | idx_token_tx_operation_type | operationType, createdAt | 按服务类型统计 |
| adscenter_db | UserAdsConnection | idx_user_ads_conn_userid_status | userId, status | 用户账户状态筛选 |
| adscenter_db | UserAdsConnection | idx_user_ads_conn_userid_created | userId, createdAt | 最近添加账户 |
| adscenter_db | UserAdsConnection | idx_user_ads_conn_status | status | 全局账户状态统计 |
| siterank_db | SiterankAnalysis | idx_siterank_analysis_offerid | offerId | Offer-Siterank 关联 |
| siterank_db | SiterankAnalysis | idx_siterank_analysis_userid_created | userId, createdAt | 最近评分记录 |
| siterank_db | SiterankAnalysis | idx_siterank_analysis_status | status, createdAt | 任务状态监控 |

**总计**: 14 个复合索引

---

## 五、回滚方案（如果需要）

如果索引导致意外问题，可以删除：

```sql
-- offer_db
\c offer_db
DROP INDEX IF EXISTS "idx_offer_userid_status";
DROP INDEX IF EXISTS "idx_offer_userid_created";
DROP INDEX IF EXISTS "idx_offer_userid_updated";
DROP INDEX IF EXISTS "idx_offer_status";

-- billing_db
\c billing_db
DROP INDEX IF EXISTS "idx_token_tx_userid_amount_created";
DROP INDEX IF EXISTS "idx_token_tx_operation_type";

-- adscenter_db
\c adscenter_db
DROP INDEX IF EXISTS "idx_user_ads_conn_userid_status";
DROP INDEX IF EXISTS "idx_user_ads_conn_userid_created";
DROP INDEX IF EXISTS "idx_user_ads_conn_status";

-- siterank_db
\c siterank_db
DROP INDEX IF EXISTS "idx_siterank_analysis_offerid";
DROP INDEX IF EXISTS "idx_siterank_analysis_userid_created";
DROP INDEX IF EXISTS "idx_siterank_analysis_status";
```

---

## 六、注意事项

1. **索引创建时间**: 每个索引创建可能需要几秒到几分钟（取决于表大小）
2. **锁定影响**: `CREATE INDEX IF NOT EXISTS` 会获取 SHARE 锁，不会阻塞读取，但会阻塞写入
3. **建议执行时间**: 业务低峰期（如凌晨或周末）
4. **磁盘空间**: 索引会占用额外磁盘空间（每个索引约占表大小的 5-10%）
5. **维护成本**: 索引会增加 INSERT/UPDATE/DELETE 的开销（但对于读多写少的场景收益明显）

---

## 七、后续监控

### 7.1 Cloud SQL Insights 监控指标

- 慢查询数量（目标：下降 80%）
- 平均查询延迟（目标：下降 50%）
- 索引命中率（目标：> 90%）

### 7.2 应用层监控

- Console Dashboard API 响应时间
- Offer 列表查询延迟
- Token 余额查询延迟
- UserAdsConnection 查询延迟

### 7.3 定期维护

```sql
-- 每月执行一次 ANALYZE 更新统计信息
ANALYZE "Offer";
ANALYZE "TokenTransaction";
ANALYZE "UserAdsConnection";
ANALYZE "SiterankAnalysis";

-- 查看索引使用情况
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

---

**执行完成后，请在此文档顶部标记**:
✅ **执行日期**: [填写日期]
✅ **执行人**: [填写姓名]
✅ **验证结果**: [Console Dashboard 延迟从 ___ ms 降低到 ___ ms]
