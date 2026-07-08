# 逻辑数据库隔离 - 准备就绪报告

**创建时间**: 2025-10-07
**状态**: ✅ **准备就绪，待执行**
**预计执行时间**: 5天（第1天执行完成）
**风险等级**: 中（有完整回滚方案）

---

## 一、准备工作完成情况

### ✅ 已完成

1. **详细实施计划文档**
   - `docs/SupabaseGo/LogicalDatabaseIsolationPlan.md`
   - 包含完整的迁移策略、步骤、监控、回滚方案

2. **SQL迁移脚本**
   - `scripts/db/create-logical-databases.sql` - 创建5个逻辑数据库
   - `scripts/db/migrate-schema-to-database.sh` - Schema数据迁移工具

3. **Cloud Run Job迁移工具**
   - Dockerfile: `scripts/db/Dockerfile.logical-db-migrator`
   - 入口脚本: `scripts/db/logical-db-migrator-entrypoint.sh`
   - Cloud Build配置: `deployments/cloudbuild/build-logical-db-migrator.yaml`
   - **镜像已构建**: `asia-northeast1-docker.pkg.dev/.../logical-db-migrator:latest`
   - **Job已创建**: `logical-db-migrator` (asia-northeast1)

### 📋 待执行

按照计划的5天时间线执行：

**第1天**: 准备工作 ✅ **已完成**

**第2-3天**: 预发环境迁移
```bash
# 步骤1: 创建逻辑数据库
gcloud run jobs execute logical-db-migrator \
  --region=asia-northeast1 \
  --args="create-databases" \
  --wait

# 步骤2: 迁移各schema
for schema in offer_db billing_db siterank_db adscenter_db shared_db; do
  gcloud run jobs execute logical-db-migrator \
    --region=asia-northeast1 \
    --args="migrate $schema" \
    --wait
done

# 步骤3: 验证迁移结果
gcloud run jobs execute logical-db-migrator \
  --region=asia-northeast1 \
  --args="verify" \
  --wait
```

**第4天**: 更新服务配置（预发环境）
```bash
# 创建各服务专用的DATABASE_URL Secret
./scripts/db/create-database-url-secrets.sh

# 更新服务配置
./scripts/deploy/update-database-urls-preview.sh
```

**第5天**: 生产环境迁移（维护窗口）

---

## 二、迁移工具使用说明

### 2.1 logical-db-migrator Cloud Run Job

**支持的操作**:

1. **创建逻辑数据库**
   ```bash
   gcloud run jobs execute logical-db-migrator \
     --region=asia-northeast1 \
     --args="create-databases" \
     --wait
   ```
   创建5个数据库：`offer_db`, `billing_db`, `siterank_db`, `adscenter_db`, `shared_db`

2. **迁移单个schema**
   ```bash
   gcloud run jobs execute logical-db-migrator \
     --region=asia-northeast1 \
     --args="migrate offer_db" \
     --wait
   ```
   将`autoads_db.offer_db` schema迁移到`offer_db`数据库

3. **验证迁移结果**
   ```bash
   gcloud run jobs execute logical-db-migrator \
     --region=asia-northeast1 \
     --args="verify" \
     --wait
   ```
   检查所有新数据库的表数量

### 2.2 查看执行日志

```bash
# 查看最近的Job执行
gcloud run jobs executions list \
  --job=logical-db-migrator \
  --region=asia-northeast1 \
  --limit=5

# 查看特定执行的日志
gcloud logging read \
  "resource.type=cloud_run_job AND resource.labels.job_name=logical-db-migrator" \
  --limit=100 \
  --format="value(textPayload)" \
  --freshness=10m
```

---

## 三、数据库架构对比

### 3.1 迁移前（当前）

```
Cloud SQL实例: autoads (db-custom-2-8192, 250GB)
  ├─ postgres (默认数据库)
  └─ autoads_db (所有服务共享)
      ├─ Schema: offer_db (Offer, OfferStatusHistory, OfferPreferences, OfferKpiDeadLetter)
      ├─ Schema: billing_db (7张表：TokenTransaction, UserToken等)
      ├─ Schema: siterank_db (4张表：SiterankAnalysis, domain_cache等)
      ├─ Schema: adscenter_db (4张表：UserAdsConnection, BulkAudit等)
      ├─ Schema: shared_db (User, schema_migrations)
      └─ Schema: public (兼容性视图层)
```

**连接配置**:
- 所有服务: `DATABASE_URL=postgresql://postgres:PWD@10.6.0.2:5432/autoads_db`

### 3.2 迁移后（目标）

```
Cloud SQL实例: autoads (不变)
  ├─ offer_db (独立数据库，CONNECTION_LIMIT=50)
  │   └─ Schema: offer_db (或public)
  ├─ billing_db (独立数据库，CONNECTION_LIMIT=100)
  │   └─ Schema: billing_db
  ├─ siterank_db (独立数据库，CONNECTION_LIMIT=30)
  │   └─ Schema: siterank_db
  ├─ adscenter_db (独立数据库，CONNECTION_LIMIT=80)
  │   └─ Schema: adscenter_db
  ├─ shared_db (独立数据库，CONNECTION_LIMIT=20)
  │   └─ Schema: shared_db
  └─ autoads_db (保留，用于回滚)
```

**连接配置**（新）:
- offer服务: `DATABASE_URL_OFFER=postgresql://postgres:PWD@10.6.0.2:5432/offer_db`
- billing服务: `DATABASE_URL_BILLING=postgresql://postgres:PWD@10.6.0.2:5432/billing_db`
- 其他服务类似...

---

## 四、预期收益

### 4.1 性能隔离

| 服务 | 迁移前 | 迁移后 | 改善 |
|------|--------|--------|------|
| **billing大查询** | 影响所有服务 | 仅影响billing_db | ✅ 隔离 |
| **offer高并发** | 共享连接池 | 独立50连接 | ✅ 保障 |
| **siterank worker** | 与API抢连接 | 独立30连接 | ✅ 稳定 |

### 4.2 运维能力

| 能力 | 迁移前 | 迁移后 |
|------|--------|--------|
| **独立备份** | ❌ 只能全库备份 | ✅ 按服务备份 |
| **独立恢复** | ❌ 必须全库恢复 | ✅ 按服务恢复 |
| **连接池调优** | ❌ 全局调整 | ✅ 按服务调整 |
| **性能监控** | 🟡 混杂数据 | ✅ 清晰隔离 |

### 4.3 扩展性

- ✅ 未来可迁移到物理独立实例（如billing_db单独实例）
- ✅ 为数据库分片（Sharding）奠定基础
- ✅ 支持按服务配置不同的PostgreSQL参数

---

## 五、风险与回滚

### 5.1 风险矩阵

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| **迁移数据丢失** | 低 | 高 | pg_dump+验证；autoads_db保留作为源 |
| **连接池耗尽** | 中 | 中 | 预设CONNECTION_LIMIT；监控连接数 |
| **服务启动失败** | 低 | 高 | 逐个服务滚动更新；立即回滚机制 |
| **SQL兼容性问题** | 低 | 中 | Schema名称保留；search_path配置 |

### 5.2 快速回滚（< 5分钟）

```bash
# 恢复所有服务到autoads_db
for service in offer-preview billing-preview siterank-preview adscenter-preview; do
  gcloud run services update $service \
    --region=asia-northeast1 \
    --update-secrets=DATABASE_URL=DATABASE_URL:latest \
    --quiet
done

# 验证健康状态
./scripts/tests/smoke-test-all-services.sh preview
```

### 5.3 数据回滚（如有数据写入新库）

```sql
-- 从新数据库导出增量数据
pg_dump -d offer_db --data-only --inserts > /tmp/offer_incremental.sql

-- 导入回autoads_db
psql -d autoads_db -c "SET search_path TO offer_db,public;"
psql -d autoads_db -f /tmp/offer_incremental.sql
```

---

## 六、执行检查清单

### 6.1 执行前检查

- [x] ✅ Schema级隔离已完成（2025-10-07）
- [x] ✅ 迁移脚本已创建并测试
- [x] ✅ Cloud Run Job镜像已构建
- [x] ✅ 详细实施计划已review
- [ ] ⏳ 获得执行批准
- [ ] ⏳ 确定维护窗口时间
- [ ] ⏳ 通知相关团队

### 6.2 执行步骤清单（预发环境）

- [ ] 1. 创建逻辑数据库（5个）
- [ ] 2. 迁移offer_db schema
- [ ] 3. 迁移billing_db schema
- [ ] 4. 迁移siterank_db schema
- [ ] 5. 迁移adscenter_db schema
- [ ] 6. 迁移shared_db schema
- [ ] 7. 验证数据完整性
- [ ] 8. 创建DATABASE_URL Secrets
- [ ] 9. 更新offer-preview服务
- [ ] 10. 更新billing-preview服务
- [ ] 11. 更新siterank-preview服务
- [ ] 12. 更新adscenter-preview服务
- [ ] 13. 验证所有服务健康状态
- [ ] 14. 观察3天（监控指标）

### 6.3 生产环境执行前检查

- [ ] ⏳ 预发环境稳定运行3天
- [ ] ⏳ 无性能问题或连接池耗尽
- [ ] ⏳ 备份生产环境autoads_db
- [ ] ⏳ 确认回滚脚本已就绪
- [ ] ⏳ 确定维护窗口（建议：周六凌晨2:00-3:00）

---

## 七、监控指标

迁移后监控7天：

### 7.1 数据库层指标

```sql
-- 1. 各数据库连接数
SELECT datname, COUNT(*) as connections
FROM pg_stat_activity
WHERE datname IN ('offer_db', 'billing_db', 'siterank_db', 'adscenter_db', 'shared_db')
GROUP BY datname;

-- 2. 各数据库大小
SELECT datname, pg_size_pretty(pg_database_size(datname)) as size
FROM pg_database
WHERE datname IN ('offer_db', 'billing_db', 'siterank_db', 'adscenter_db', 'shared_db')
ORDER BY pg_database_size(datname) DESC;

-- 3. 查询延迟统计
SELECT datname, AVG(mean_exec_time) as avg_ms, MAX(max_exec_time) as max_ms
FROM pg_stat_statements s
JOIN pg_database d ON s.dbid = d.oid
WHERE d.datname IN ('offer_db', 'billing_db', 'siterank_db', 'adscenter_db', 'shared_db')
GROUP BY datname;
```

### 7.2 服务层指标

- Cloud Run服务错误率 (< 1%)
- P95响应延迟 (无显著增加)
- 连接池使用率 (< 80%)

---

## 八、下一步行动

### 选项A: 立即执行（推荐）

**理由**:
- ✅ 所有准备工作已完成
- ✅ Schema隔离已验证稳定
- ✅ 完整的迁移和回滚方案
- ✅ 低风险（保留autoads_db作为回滚路径）

**行动**:
```bash
# 第1步：执行预发环境迁移
./scripts/deploy/migrate-preview-logical-db.sh

# 第2步：观察3天
# 第3步：执行生产环境迁移（如预发稳定）
```

### 选项B: 延后执行

**理由**:
- 需要更多时间review计划
- 等待更合适的维护窗口

**建议时间**: 2025-10-14（下周一）

---

## 九、相关文档

1. **实施计划**: `docs/SupabaseGo/LogicalDatabaseIsolationPlan.md` - 完整的迁移策略和步骤
2. **Schema隔离总结**: `docs/SupabaseGo/Phase2ExecutionSummary_20251007.md` - Schema级隔离执行记录
3. **架构审查**: `docs/MarkerkitGo/MicroserviceArchitectureReview.md` - 微服务架构问题分析

---

## 十、联系方式

**技术支持**: Claude Code (AI Assistant)
**批准人**: TBD
**执行窗口**: TBD
**状态更新**: 每天汇报进度

---

**状态**: ✅ **所有准备工作已完成，等待执行批准**

**建议**: 尽快执行预发环境迁移，验证后再上生产

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
