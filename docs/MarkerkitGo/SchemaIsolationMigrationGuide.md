# Schema 级隔离迁移执行指南

**创建时间**: 2025-10-06
**状态**: ⏳ 待执行
**优先级**: P1 (短期规划)
**预计执行时间**: 30 分钟
**风险等级**: 中 (有回滚方案)

---

## 一、迁移概述

### 1.1 目标

将所有微服务的表从 `public` schema 迁移到专用 schema，实现数据逻辑隔离：

```
当前架构:
autoads_db
  └─ public (所有表混在一起)

目标架构:
autoads_db
  ├─ offer_db (Offer, OfferStatusHistory, ...)
  ├─ billing_db (TokenTransaction, UserToken, ...)
  ├─ siterank_db (SiterankAnalysis, domain_cache, ...)
  ├─ adscenter_db (UserAdsConnection, BulkAudit, ...)
  └─ shared_db (User, schema_migrations, ...)
```

### 1.2 兼容性策略

**零停机迁移**：在 `public` schema 中保留视图别名，确保现有代码无需修改

```sql
-- 表迁移到 offer_db
ALTER TABLE public."Offer" SET SCHEMA offer_db;

-- 创建视图别名保持兼容性
CREATE VIEW public."Offer" AS SELECT * FROM offer_db."Offer";
```

### 1.3 影响范围

- **数据库**: autoads_db (主库)
- **服务**: 所有微服务（通过视图别名保持兼容）
- **停机时间**: 0 秒（迁移期间服务正常运行）

---

## 二、前置条件检查

### 2.1 权限验证

```bash
# 验证当前用户是否有足够权限
gcloud sql instances describe autoads \
  --format="value(serviceAccountEmailAddress)"

# 确认当前 gcloud 账号
gcloud config get-value account
```

**要求**: 需要 Cloud SQL Admin 权限或 postgres 超级用户权限

### 2.2 备份验证

```bash
# 检查最近的自动备份
gcloud sql backups list --instance=autoads \
  --limit=1 \
  --format="table(id,windowStartTime,status)"

# 如果没有最近备份，手动创建
gcloud sql backups create --instance=autoads \
  --description="Pre-schema-isolation backup"
```

### 2.3 安装 PostgreSQL 客户端

```bash
# macOS
brew install postgresql@17

# Ubuntu/Debian
sudo apt-get install postgresql-client-17

# 验证安装
psql --version
```

---

## 三、执行步骤

### 3.1 获取数据库凭证

```bash
# 获取 DATABASE_URL
export DATABASE_URL=$(gcloud secrets versions access latest --secret=DATABASE_URL)

# 验证连接
psql "$DATABASE_URL" -c "SELECT current_database(), current_schema();"
```

**预期输出**:
```
 current_database | current_schema
------------------+----------------
 autoads_db       | public
(1 row)
```

### 3.2 检查当前表分布

```bash
# 列出 public schema 中的所有表
psql "$DATABASE_URL" -c "\dt public.*" > /tmp/tables_before.txt
cat /tmp/tables_before.txt

# 统计表数量
psql "$DATABASE_URL" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
```

### 3.3 执行迁移脚本

```bash
# 定位迁移脚本
cd /Users/jason/Documents/Kiro/autoads

# 执行迁移
psql "$DATABASE_URL" -f schemas/sql/020_schema_isolation_with_views.up.sql
```

**预期输出**:
```
CREATE SCHEMA
CREATE SCHEMA
CREATE SCHEMA
CREATE SCHEMA
CREATE SCHEMA
COMMENT
COMMENT
...
NOTICE:  Schema isolation migration completed successfully
NOTICE:  Tables moved to dedicated schemas with compatibility views in public schema
NOTICE:  Next step: Update services to use schema-specific DATABASE_URL or set search_path
```

### 3.4 验证迁移结果

```bash
# 1. 检查新 schema 是否创建
psql "$DATABASE_URL" -c "\dn+"

# 预期输出：
# offer_db, billing_db, siterank_db, adscenter_db, shared_db

# 2. 检查表是否迁移
psql "$DATABASE_URL" -c "
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname IN ('offer_db', 'billing_db', 'siterank_db', 'adscenter_db', 'shared_db')
ORDER BY schemaname, tablename;
"

# 3. 检查视图是否创建
psql "$DATABASE_URL" -c "\dv public.*"

# 4. 验证视图可查询
psql "$DATABASE_URL" -c 'SELECT id FROM public."Offer" LIMIT 1;'
```

### 3.5 服务健康检查

```bash
# 检查所有服务是否正常运行（通过视图别名访问表）
for service in offer billing siterank adscenter; do
  echo "=== Checking $service-preview ==="
  gcloud run services logs read ${service}-preview \
    --region=asia-northeast1 \
    --limit=10 \
    --format="value(textPayload)" | grep -i "error\|fail" || echo "OK"
done
```

---

## 四、回滚方案

如果迁移后发现问题，执行回滚脚本：

```bash
# 回滚到迁移前状态
psql "$DATABASE_URL" -f schemas/sql/020_schema_isolation_with_views.down.sql
```

**回滚脚本功能**:
1. 删除所有视图别名
2. 将表从专用 schema 移回 public
3. 保留专用 schema（可选删除）

**回滚时间**: < 1 分钟

---

## 五、迁移后优化

迁移成功后，可以逐步优化服务配置：

### 5.1 设置服务级 search_path（可选）

为每个服务设置专用的 search_path，避免依赖视图别名：

```bash
# 示例：offer-preview 服务
gcloud run services update offer-preview \
  --region=asia-northeast1 \
  --set-env-vars="PGOPTIONS=-c search_path=offer_db,public"
```

**优势**:
- 查询性能略微提升（避免视图层）
- 明确服务的数据边界

**验证**:
```bash
# 查看服务日志，确认 search_path 生效
gcloud run services logs read offer-preview --limit=5
```

### 5.2 删除视图别名（长期目标）

当所有服务都配置了 search_path 后，可以删除 public schema 中的视图别名：

```sql
DROP VIEW IF EXISTS public."Offer" CASCADE;
DROP VIEW IF EXISTS public."TokenTransaction" CASCADE;
-- ... 删除所有视图
```

**注意**: 删除视图前必须确保所有服务都已更新配置

---

## 六、监控指标

迁移后监控以下指标（7天）：

| 指标 | 监控方式 | 阈值 | 说明 |
|------|---------|------|------|
| **服务错误率** | Cloud Run Metrics | < 1% | 确保视图别名正常工作 |
| **数据库连接数** | Cloud SQL Metrics | 无显著变化 | Schema 迁移不应影响连接池 |
| **查询延迟 (P95)** | Cloud SQL Insights | < 100ms | 视图别名有轻微性能开销 |
| **Schema 大小** | pg_catalog.pg_namespace | 监控增长趋势 | 确保迁移后无异常表创建 |

### 监控查询

```sql
-- 查看各 schema 的表数量
SELECT schemaname, COUNT(*)
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
GROUP BY schemaname;

-- 查看视图使用情况（通过日志分析）
SELECT schemaname, viewname, definition
FROM pg_views
WHERE schemaname = 'public';
```

---

## 七、常见问题排查

### Q1: 迁移失败 "relation does not exist"

**原因**: 表可能已经在之前的迁移中被移动或删除

**解决**:
```sql
-- 检查表是否存在于其他 schema
SELECT schemaname, tablename
FROM pg_tables
WHERE tablename = 'Offer';

-- 如果表已在 offer_db，跳过该表的迁移
```

### Q2: 服务报错 "permission denied for schema offer_db"

**原因**: 数据库用户缺少新 schema 的访问权限

**解决**:
```sql
-- 授予所有服务用户访问权限
GRANT USAGE ON SCHEMA offer_db TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA offer_db TO postgres;

-- 设置默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA offer_db GRANT ALL ON TABLES TO postgres;
```

### Q3: 视图查询比直接查询表慢

**原因**: PostgreSQL 视图会增加轻微的查询计划开销（通常 < 1ms）

**解决**: 配置服务的 search_path 直接访问 schema，避免视图层

---

## 八、执行检查清单

- [ ] ✅ 验证 Cloud SQL 最近备份存在
- [ ] ✅ 安装 psql 客户端
- [ ] ✅ 获取 DATABASE_URL 凭证
- [ ] ✅ 检查当前表分布（记录基线）
- [ ] ✅ 执行迁移脚本
- [ ] ✅ 验证新 schema 创建成功
- [ ] ✅ 验证表迁移成功
- [ ] ✅ 验证视图别名创建成功
- [ ] ✅ 测试视图可查询
- [ ] ✅ 检查所有服务健康状态
- [ ] ✅ 监控服务错误率（24小时）
- [ ] 🔄 (可选) 配置服务 search_path
- [ ] 🔄 (长期) 删除视图别名

---

## 九、参考资料

- **迁移脚本**: `schemas/sql/020_schema_isolation_with_views.up.sql`
- **回滚脚本**: `schemas/sql/020_schema_isolation_with_views.down.sql`
- **架构文档**: `docs/MarkerkitGo/MicroserviceArchitectureReview.md` 第 2.8 节
- **PostgreSQL Schema 文档**: https://www.postgresql.org/docs/current/ddl-schemas.html

---

**执行人**: TBD
**计划执行时间**: 2025-10-07 (周一上午，流量低谷期)
**风险评估**: 中 (有回滚方案，零停机迁移)
**批准人**: TBD

🤖 Generated with [Claude Code](https://claude.com/claude-code)
