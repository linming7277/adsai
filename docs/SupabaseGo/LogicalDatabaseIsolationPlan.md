# 数据库逻辑隔离实施计划

**创建时间**: 2025-10-07
**优先级**: P1 (Phase 3核心任务)
**预计执行时间**: 3-5天
**风险等级**: 中 (需要迁移数据)
**前置条件**: ✅ Schema级隔离已完成 (2025-10-07)

---

## 一、背景与目标

### 1.1 当前架构问题

**现状**: 所有微服务共享单一数据库`autoads_db`

```
Cloud SQL实例: autoads
  └─ 数据库: autoads_db (所有服务共享)
      ├─ Schema: offer_db
      ├─ Schema: billing_db
      ├─ Schema: siterank_db
      ├─ Schema: adscenter_db
      └─ Schema: shared_db
```

**问题**:
1. ❌ **连接池共享** - 无法独立控制各服务的连接数
2. ❌ **性能干扰** - billing的大查询影响offer的实时响应
3. ❌ **备份恢复复杂** - 无法单独备份某个服务的数据
4. ❌ **扩展受限** - 无法为不同服务使用不同的数据库配置

### 1.2 目标架构

**目标**: 每个服务使用独立的逻辑数据库

```
Cloud SQL实例: autoads (保持单实例，降低成本)
  ├─ 数据库: offer_db (Offer服务专用)
  ├─ 数据库: billing_db (Billing服务专用)
  ├─ 数据库: siterank_db (Siterank服务专用)
  ├─ 数据库: adscenter_db (Adscenter服务专用)
  ├─ 数据库: shared_db (共享数据：User表等)
  └─ 数据库: autoads_db (保留，用于向后兼容)
```

**收益**:
- ✅ **独立连接池** - 每个服务独立配置max_connections
- ✅ **性能隔离** - billing查询不影响offer
- ✅ **独立备份** - 可单独备份/恢复某个服务
- ✅ **渐进式迁移** - 保留autoads_db作为回滚路径

---

## 二、迁移策略

### 2.1 零停机迁移方案

**核心思路**: 利用已完成的Schema隔离，通过`pg_dump`+`pg_restore`跨数据库迁移

#### 阶段1: 创建新数据库（0停机）

```sql
-- 在autoads实例中创建5个新数据库
CREATE DATABASE offer_db WITH ENCODING='UTF8' LC_COLLATE='en_US.UTF8' LC_CTYPE='en_US.UTF8' TEMPLATE=template0;
CREATE DATABASE billing_db WITH ENCODING='UTF8' LC_COLLATE='en_US.UTF8' LC_CTYPE='en_US.UTF8' TEMPLATE=template0;
CREATE DATABASE siterank_db WITH ENCODING='UTF8' LC_COLLATE='en_US.UTF8' LC_CTYPE='en_US.UTF8' TEMPLATE=template0;
CREATE DATABASE adscenter_db WITH ENCODING='UTF8' LC_COLLATE='en_US.UTF8' LC_CTYPE='en_US.UTF8' TEMPLATE=template0;
CREATE DATABASE shared_db WITH ENCODING='UTF8' LC_COLLATE='en_US.UTF8' LC_CTYPE='en_US.UTF8' TEMPLATE=template0;
```

#### 阶段2: 迁移Schema数据（维护窗口：5-10分钟）

**方法**: 使用`pg_dump`的`--schema`选项

```bash
# 示例：迁移offer_db schema到offer_db数据库
pg_dump -h 10.6.0.2 -U postgres -d autoads_db \
  --schema=offer_db \
  --no-owner --no-privileges \
  | psql -h 10.6.0.2 -U postgres -d offer_db

# 迁移后，schema名称从offer_db变为public（默认）
# 或保留offer_db schema名称（需要设置search_path）
```

#### 阶段3: 更新服务DATABASE_URL（滚动发布）

```bash
# 示例：更新offer-preview服务
gcloud run services update offer-preview \
  --region=asia-northeast1 \
  --update-env-vars=DATABASE_URL="postgresql://postgres:PASSWORD@10.6.0.2:5432/offer_db"

# 或通过Secret Manager更新
gcloud secrets versions add DATABASE_URL_OFFER --data-file=-  <<EOF
postgresql://postgres:PASSWORD@10.6.0.2:5432/offer_db
EOF
```

#### 阶段4: 验证与回滚（按需）

```bash
# 验证新数据库连接
curl https://offer-preview-*.run.app/healthz

# 如有问题，立即回滚到autoads_db
gcloud run services update offer-preview \
  --update-env-vars=DATABASE_URL="postgresql://postgres:PASSWORD@10.6.0.2:5432/autoads_db"
```

### 2.2 数据一致性保证

**关键点**: 迁移期间不丢失数据

1. **维护模式** (可选)
   ```bash
   # 迁移前：将服务设为只读模式（修改业务逻辑）
   gcloud run services update offer-preview \
     --set-env-vars=READ_ONLY_MODE=1
   ```

2. **最终一致性检查**
   ```sql
   -- 比对记录数
   SELECT COUNT(*) FROM autoads_db.offer_db."Offer";
   SELECT COUNT(*) FROM offer_db.public."Offer";

   -- 比对最新记录
   SELECT MAX("updatedAt") FROM autoads_db.offer_db."Offer";
   SELECT MAX("updatedAt") FROM offer_db.public."Offer";
   ```

3. **增量同步**（如维护窗口不够）
   ```bash
   # 使用逻辑复制或CDC工具（如Debezium）
   # 本项目规模较小，建议直接使用短维护窗口
   ```

---

## 三、详细实施步骤

### 3.1 准备阶段（第1天）

#### 步骤1: 创建迁移脚本

**文件**: `scripts/db/create-logical-databases.sql`

```sql
-- 创建5个逻辑数据库
\c postgres

CREATE DATABASE offer_db
  WITH ENCODING='UTF8'
       LC_COLLATE='en_US.UTF8'
       LC_CTYPE='en_US.UTF8'
       TEMPLATE=template0
       CONNECTION LIMIT=50;  -- 为offer服务预留50个连接

CREATE DATABASE billing_db
  WITH ENCODING='UTF8'
       LC_COLLATE='en_US.UTF8'
       LC_CTYPE='en_US.UTF8'
       TEMPLATE=template0
       CONNECTION LIMIT=100;  -- billing服务需要更多连接

CREATE DATABASE siterank_db
  WITH ENCODING='UTF8'
       LC_COLLATE='en_US.UTF8'
       LC_CTYPE='en_US.UTF8'
       TEMPLATE=template0
       CONNECTION LIMIT=30;

CREATE DATABASE adscenter_db
  WITH ENCODING='UTF8'
       LC_COLLATE='en_US.UTF8'
       LC_CTYPE='en_US.UTF8'
       TEMPLATE=template0
       CONNECTION LIMIT=80;

CREATE DATABASE shared_db
  WITH ENCODING='UTF8'
       LC_COLLATE='en_US.UTF8'
       LC_CTYPE='en_US.UTF8'
       TEMPLATE=template0
       CONNECTION LIMIT=20;

-- 验证创建结果
\l
```

**文件**: `scripts/db/migrate-schema-to-database.sh`

```bash
#!/bin/bash
# 迁移单个schema到独立数据库

set -e

SCHEMA_NAME=$1  # offer_db, billing_db, etc.
TARGET_DB=$1    # 目标数据库名称与schema名称相同

echo "=== 迁移 $SCHEMA_NAME schema 到 $TARGET_DB 数据库 ==="

# 1. 导出schema
pg_dump -h 10.6.0.2 -U postgres -d autoads_db \
  --schema=$SCHEMA_NAME \
  --no-owner --no-privileges \
  --file=/tmp/${SCHEMA_NAME}_dump.sql

echo "✅ Schema导出完成: /tmp/${SCHEMA_NAME}_dump.sql"

# 2. 修改SQL文件：将schema名称改为public（可选）
# 或保留schema名称，后续通过search_path访问

# 3. 导入到新数据库
psql -h 10.6.0.2 -U postgres -d $TARGET_DB \
  -f /tmp/${SCHEMA_NAME}_dump.sql

echo "✅ Schema导入完成到数据库: $TARGET_DB"

# 4. 验证记录数
echo "验证数据完整性..."
psql -h 10.6.0.2 -U postgres -d autoads_db -c \
  "SELECT COUNT(*) as source_count FROM pg_tables WHERE schemaname='$SCHEMA_NAME';"
psql -h 10.6.0.2 -U postgres -d $TARGET_DB -c \
  "SELECT COUNT(*) as target_count FROM pg_tables WHERE schemaname='$SCHEMA_NAME' OR schemaname='public';"

echo "✅ 迁移完成"
```

#### 步骤2: 创建Cloud Run Job

**文件**: `deployments/cloudbuild/build-db-migrator-logical.yaml`

```yaml
steps:
  - name: gcr.io/kaniko-project/executor:latest
    args:
      - --dockerfile=scripts/db/Dockerfile.logical-db-migrator
      - --context=dir:///workspace
      - --destination=asia-northeast1-docker.pkg.dev/${PROJECT_ID}/autoads-services/logical-db-migrator:latest
      - --cache=true

  - name: gcr.io/google.com/cloudsdktool/cloud-sdk:slim
    entrypoint: gcloud
    args:
      - run
      - jobs
      - create
      - logical-db-migrator
      - --image=asia-northeast1-docker.pkg.dev/${PROJECT_ID}/autoads-services/logical-db-migrator:latest
      - --region=asia-northeast1
      - --vpc-connector=cr-conn-default-ane1
      - --service-account=codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com
      - --max-retries=0
      - --task-timeout=30m
      - --memory=1Gi
      - --cpu=2

timeout: 900s
options:
  logging: CLOUD_LOGGING_ONLY
```

### 3.2 执行阶段（第2-3天）

#### 执行步骤（预发环境）

```bash
# 1. 创建逻辑数据库
gcloud run jobs execute logical-db-migrator --args="create-databases"

# 2. 迁移offer_db schema
gcloud run jobs execute logical-db-migrator --args="migrate offer_db"

# 3. 迁移billing_db schema
gcloud run jobs execute logical-db-migrator --args="migrate billing_db"

# 4. 迁移siterank_db schema
gcloud run jobs execute logical-db-migrator --args="migrate siterank_db"

# 5. 迁移adscenter_db schema
gcloud run jobs execute logical-db-migrator --args="migrate adscenter_db"

# 6. 迁移shared_db schema
gcloud run jobs execute logical-db-migrator --args="migrate shared_db"

# 7. 更新服务DATABASE_URL
./scripts/deploy/update-database-urls.sh preview
```

#### 验证步骤

```bash
# 1. 检查服务健康状态
for svc in offer-preview billing-preview siterank-preview adscenter-preview; do
  echo "=== $svc ==="
  curl -s https://${svc}-*.run.app/healthz
done

# 2. 检查数据库连接分布
gcloud run jobs execute db-analyzer --args="connection-stats"

# 3. 执行smoke测试
./scripts/tests/smoke-test-all-services.sh preview
```

### 3.3 生产环境部署（第4-5天）

**前提条件**:
- ✅ 预发环境运行稳定3天
- ✅ 无数据丢失或连接池问题

**执行窗口**: 周六凌晨2:00-3:00 (流量最低)

```bash
# 1. 通知用户维护窗口（可选）
# 2. 设置服务为只读模式（可选）
# 3. 执行生产环境迁移
./scripts/deploy/migrate-production-logical-db.sh

# 4. 更新生产服务
./scripts/deploy/update-database-urls.sh production

# 5. 监控30分钟
watch -n 60 './scripts/monitor/check-all-services.sh'

# 6. 如无问题，解除维护模式
```

---

## 四、服务DATABASE_URL配置

### 4.1 新的Secret配置

为每个服务创建独立的DATABASE_URL Secret：

```bash
# Offer服务
gcloud secrets create DATABASE_URL_OFFER \
  --data-file=- <<EOF
postgresql://postgres:$GL(~x]T2Q[M@uX4@10.6.0.2:5432/offer_db?sslmode=disable
EOF

# Billing服务
gcloud secrets create DATABASE_URL_BILLING \
  --data-file=- <<EOF
postgresql://postgres:$GL(~x]T2Q[M@uX4@10.6.0.2:5432/billing_db?sslmode=disable
EOF

# Siterank服务
gcloud secrets create DATABASE_URL_SITERANK \
  --data-file=- <<EOF
postgresql://postgres:$GL(~x]T2Q[M@uX4@10.6.0.2:5432/siterank_db?sslmode=disable
EOF

# Adscenter服务
gcloud secrets create DATABASE_URL_ADSCENTER \
  --data-file=- <<EOF
postgresql://postgres:$GL(~x]T2Q[M@uX4@10.6.0.2:5432/adscenter_db?sslmode=disable
EOF

# 共享数据库（用于读取User表等）
gcloud secrets create DATABASE_URL_SHARED \
  --data-file=- <<EOF
postgresql://postgres:$GL(~x]T2Q[M@uX4@10.6.0.2:5432/shared_db?sslmode=disable
EOF
```

### 4.2 更新服务配置

```bash
# 示例：更新offer-preview
gcloud run services update offer-preview \
  --region=asia-northeast1 \
  --update-secrets=DATABASE_URL=DATABASE_URL_OFFER:latest

# 批量更新脚本
for env in preview prod; do
  for svc in offer billing siterank adscenter; do
    service_name="${svc}-${env}"
    secret_name="DATABASE_URL_${svc^^}"

    gcloud run services update $service_name \
      --region=asia-northeast1 \
      --update-secrets=DATABASE_URL=${secret_name}:latest \
      --quiet
  done
done
```

---

## 五、连接池配置

### 5.1 推荐配置

根据服务特点配置不同的连接池大小：

| 服务 | 数据库 | 连接限制 | Pool Size (Go) | 理由 |
|------|--------|---------|---------------|------|
| **billing** | billing_db | 100 | MaxOpenConns=50, MaxIdleConns=10 | 高并发查询/扣费 |
| **offer** | offer_db | 50 | MaxOpenConns=25, MaxIdleConns=5 | 中等并发 |
| **siterank** | siterank_db | 30 | MaxOpenConns=15, MaxIdleConns=3 | 低并发（worker模式） |
| **adscenter** | adscenter_db | 80 | MaxOpenConns=40, MaxIdleConns=8 | 高并发OAuth+执行 |
| **shared** | shared_db | 20 | MaxOpenConns=10, MaxIdleConns=2 | 只读User表 |

### 5.2 代码配置示例

```go
// services/billing/main.go
func main() {
    cfg, _ := config.Load(context.Background())
    db, _ := sql.Open("postgres", cfg.DatabaseURL)

    // 独立连接池配置
    db.SetMaxOpenConns(50)    // 最大连接数
    db.SetMaxIdleConns(10)    // 空闲连接数
    db.SetConnMaxLifetime(time.Hour)  // 连接最大生命周期
    db.SetConnMaxIdleTime(10 * time.Minute)  // 空闲连接超时

    // ...
}
```

---

## 六、监控指标

### 6.1 关键指标

迁移后监控7天：

| 指标 | 监控方式 | 阈值 | 说明 |
|------|---------|------|------|
| **连接数分布** | `pg_stat_activity` | 均衡分布 | 各数据库连接数应合理 |
| **查询延迟(P95)** | Cloud SQL Insights | < 100ms | 不应显著增加 |
| **连接池耗尽** | Go metrics | 无 | MaxOpenConns未达上限 |
| **数据库大小** | `pg_database_size` | 监控增长 | 各数据库独立监控 |

### 6.2 SQL查询示例

```sql
-- 查看各数据库连接分布
SELECT
    datname,
    COUNT(*) as active_connections,
    MAX(application_name) as sample_app
FROM pg_stat_activity
WHERE datname IN ('offer_db', 'billing_db', 'siterank_db', 'adscenter_db', 'shared_db')
GROUP BY datname
ORDER BY active_connections DESC;

-- 查看各数据库大小
SELECT
    datname,
    pg_size_pretty(pg_database_size(datname)) as size
FROM pg_database
WHERE datname IN ('offer_db', 'billing_db', 'siterank_db', 'adscenter_db', 'shared_db')
ORDER BY pg_database_size(datname) DESC;
```

---

## 七、回滚方案

如果迁移后出现问题（连接池耗尽、性能下降等）：

### 7.1 快速回滚（< 5分钟）

```bash
# 1. 恢复所有服务到autoads_db
for env in preview prod; do
  for svc in offer billing siterank adscenter; do
    gcloud run services update ${svc}-${env} \
      --region=asia-northeast1 \
      --update-secrets=DATABASE_URL=DATABASE_URL:latest \
      --quiet
  done
done

# 2. 验证服务恢复
./scripts/tests/smoke-test-all-services.sh preview
```

### 7.2 数据恢复（如有数据丢失）

```bash
# 从autoads_db恢复数据
pg_dump -h 10.6.0.2 -U postgres -d autoads_db \
  --schema=offer_db \
  | psql -h 10.6.0.2 -U postgres -d offer_db
```

---

## 八、成本影响

### 8.1 存储成本

- **当前**: 250GB (autoads_db)
- **迁移后**: ~250GB (分散到5个数据库，总量不变)
- **额外成本**: **$0** (同一实例，存储总量不变)

### 8.2 连接成本

- **当前**: 1个数据库，所有服务共享连接池
- **迁移后**: 5个数据库，独立连接池
- **影响**: 无额外成本（总连接数不变）

### 8.3 运维成本

- **备份**: 需要分别备份5个数据库（可脚本化）
- **监控**: 需要分别监控5个数据库（可自动化）
- **预计增加时间**: 每周1小时（可接受）

---

## 九、成功标准

- [ ] ✅ 5个逻辑数据库创建成功
- [ ] ✅ 所有Schema数据迁移完整（记录数一致）
- [ ] ✅ 服务DATABASE_URL更新完成
- [ ] ✅ 所有服务健康检查通过
- [ ] ✅ 连接池分布合理（无连接耗尽）
- [ ] ✅ P95查询延迟无显著增加（< 10%）
- [ ] ✅ 稳定运行7天无故障

---

## 十、时间线

| 天数 | 任务 | 负责人 | 状态 |
|------|------|--------|------|
| **第1天** | 创建迁移脚本、构建Cloud Run Job | TBD | 📋 待开始 |
| **第2天** | 预发环境：创建数据库、迁移schema | TBD | 📋 待开始 |
| **第3天** | 预发环境：更新服务URL、验证 | TBD | 📋 待开始 |
| **第4天** | 预发环境观察期（监控指标） | TBD | 📋 待开始 |
| **第5天** | 生产环境迁移（维护窗口） | TBD | 📋 待开始 |
| **第6-12天** | 生产环境观察期（7天稳定性） | TBD | 📋 待开始 |

**总计**: 5天执行 + 7天观察 = **12天**

---

## 十一、参考资料

- **Schema隔离文档**: `docs/SupabaseGo/Phase2ExecutionSummary_20251007.md`
- **架构审查**: `docs/MarkerkitGo/MicroserviceArchitectureReview.md` 第 3.1 节
- **PostgreSQL文档**: https://www.postgresql.org/docs/current/manage-ag-createdb.html

---

**创建人**: Claude Code (AI Assistant)
**批准人**: TBD
**预计开始时间**: 2025-10-08
**风险评估**: 中 (有回滚方案，逐步迁移)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
