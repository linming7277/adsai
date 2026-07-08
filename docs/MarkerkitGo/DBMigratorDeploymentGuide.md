# DB Migrator 部署指南

**目的**: 使用专用 Cloud Run Job 执行数据库迁移，解决多实例启动时的竞争条件问题
**适用服务**: billing, adscenter
**创建日期**: 2025-10-05

---

## 一、架构设计

### 1.1 问题背景

**旧架构** (存在问题):
```
Cloud Run 服务启动 (5个实例并发)
  ├─→ 实例1: runMigrations() 执行中...
  ├─→ 实例2: runMigrations() 执行中...  ❌ 冲突
  ├─→ 实例3: runMigrations() 执行中...  ❌ 冲突
  ├─→ 实例4: runMigrations() 执行中...  ❌ 冲突
  └─→ 实例5: runMigrations() 执行中...  ❌ 冲突
```

**风险**:
- 即使 SQL 有 `IF NOT EXISTS`，仍可能触发死锁
- 事务冲突导致部分实例启动失败
- 日志混乱，难以排查问题

### 1.2 新架构 (DB Migrator Job)

```
部署流程:
  1. 构建通用 Migrator 镜像 (独立于各业务服务)
  2. 运行 Cloud Run Job `db-migrator-preview`
     └─→ 单实例执行，保证串行
  3. Job 成功后，部署服务 (设置 SKIP_MIGRATIONS=1)
```

**优点**:
- ✅ 单实例执行，无竞争条件
- ✅ 迁移可独立回滚和调试
- ✅ 符合 GitOps 最佳实践
- ✅ 可在 CI/CD 中强制依赖顺序

---

## 二、文件结构

```
schemas/sql/
├── 000_extensions.sql              # 全局扩展（pgcrypto 等）
├── 001_event_store.sql             # 共享表
└── ...                             # 其余幂等 SQL

scripts/db/
├── apply-sql.go                    # Cloud Run Job 入口
├── go.mod / go.sum                  # 独立Go模块
└── ...

deployments/db-migrator/
├── Dockerfile                      # 通用 migrator 镜像
├── cloudbuild.yaml                 # Cloud Build 配置
├── job.preview.yaml                # Cloud Run Job (预发)
└── job.prod.yaml                   # Cloud Run Job (生产)
```

---

## 三、部署流程

### 3.1 首次部署 (设置 Cloud Run Job)

#### Step 1: 构建 Migrator 镜像

```bash
# 精简构建上下文（可重复使用 preview/prod）
rm -rf tmp/db-migrator-build && \
  mkdir -p tmp/db-migrator-build && \
  rsync -a scripts/db tmp/db-migrator-build/scripts && \
  rsync -a schemas/sql tmp/db-migrator-build/schemas && \
  rsync -a deployments/db-migrator tmp/db-migrator-build/deployments

# 预发镜像
gcloud builds submit tmp/db-migrator-build \
  --config=deployments/db-migrator/cloudbuild.yaml \
  --substitutions=_IMAGE=asia-northeast1-docker.pkg.dev/${PROJECT_ID}/autoads-services/db-migrator:preview-$(git rev-parse --short HEAD)

# 生产镜像
gcloud builds submit tmp/db-migrator-build \
  --config=deployments/db-migrator/cloudbuild.yaml \
  --substitutions=_IMAGE=asia-northeast1-docker.pkg.dev/${PROJECT_ID}/autoads-services/db-migrator:prod-$(git rev-parse --short HEAD)
```

#### Step 2: 创建 Cloud Run Job

```bash
# 预发
gcloud run jobs replace deployments/db-migrator/job.preview.yaml \
  --region=asia-northeast1

# 生产
gcloud run jobs replace deployments/db-migrator/job.prod.yaml \
  --region=asia-northeast1
```

#### Step 3: 执行迁移

```bash
# 预发环境
gcloud run jobs execute db-migrator-preview \
  --region=asia-northeast1 \
  --wait

# 生产环境（上线前请再次确认）
gcloud run jobs execute db-migrator-prod \
  --region=asia-northeast1 \
  --wait
```

#### Step 4: 部署服务 (跳过内嵌迁移)

修改服务部署配置，添加环境变量：

```yaml
# deployments/<service>/preview-deploy.yaml
env:
- name: BILLING_SKIP_MIGRATIONS
  value: "1"
```

然后部署服务：

```bash
gcloud run deploy billing-preview \
  --image=asia-northeast1-docker.pkg.dev/.../billing:preview-latest \
  --region=asia-northeast1
```

### 3.2 日常部署流程 (GitHub Actions 集成)

修改 `.github/workflows/deploy-backend.yml`，在服务部署前执行迁移：

```yaml
jobs:
  migrate-db:
    runs-on: ubuntu-latest
    steps:
      - name: Build preview migrator image
        run: |
          gcloud builds submit tmp/db-migrator-build \
            --config=deployments/db-migrator/cloudbuild.yaml \
            --substitutions=_IMAGE=asia-northeast1-docker.pkg.dev/${{ env.PROJECT_ID }}/autoads-services/db-migrator:preview-${{ github.sha }}

      - name: Update Cloud Run job spec
        run: |
          gcloud run jobs update db-migrator-preview \
            --image=asia-northeast1-docker.pkg.dev/${{ env.PROJECT_ID }}/autoads-services/db-migrator:preview-${{ github.sha }} \
            --region=asia-northeast1 \
            --set-secrets DATABASE_URL=DATABASE_URL:latest \
            --set-cloudsql-instances ${{ env.PROJECT_ID }}:asia-northeast1:autoads \
            --vpc-connector cr-conn-default-ane1

      - name: Run migration job
        run: |
          gcloud run jobs execute db-migrator-preview \
            --region=asia-northeast1 \
            --wait

  deploy-services:
    needs: migrate-db
```

---

## 四、迁移器实现细节

### 4.1 核心功能

**文件**: `scripts/db/apply-sql.go`

```go
func runMigrations(ctx context.Context, db *sql.DB, dir string) error {
    // 1. 创建迁移追踪表
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )

    // 2. 读取已应用的迁移
    SELECT version FROM schema_migrations

    // 3. 按文件名排序所有 .sql 文件
    sort.Strings(migrations)

    // 4. 逐个应用未执行的迁移
    for _, filename := range migrations {
        if applied[filename] { continue }

        // 读取文件，按分号分割执行
        statements := strings.Split(string(content), ";")
        for _, stmt := range statements {
            tx.ExecContext(ctx, stmt)
        }

        // 记录已应用
        INSERT INTO schema_migrations (version) VALUES (filename)
    }
}
```

### 4.2 幂等性保证

- **迁移追踪**: `schema_migrations` 表记录已执行的文件名
- **跳过重复**: 已应用的迁移自动跳过
- **事务保护**: 所有迁移在单个事务中执行，失败自动回滚
- **日志清晰**:
  ```
  📝 Applying migration: 000001_create_initial_tables.up.sql
  ✅ Applied: 000001_create_initial_tables.up.sql
  ⏭️  Skipping already applied: 000002_create_user_token_pool.up.sql
  ```

### 4.3 错误处理

```go
// 数据库连接重试 (最多60秒)
retries := 12
for i := 0; i < retries; i++ {
    if err := db.PingContext(ctx); err == nil { break }
    time.Sleep(5 * time.Second)
}

// 迁移失败自动回滚
defer func() {
    if err := tx.Rollback(); err != nil && err != sql.ErrTxDone {
        log.Printf("WARN: failed to rollback: %v", err)
    }
}()
```

---

## 五、监控和调试

### 5.1 查看 Job 执行历史

```bash
# 列出最近的执行
gcloud run jobs executions list \
  --job=db-migrator-preview \
  --region=asia-northeast1 \
  --limit=10

# 查看特定执行的日志
gcloud run jobs executions describe <EXECUTION_NAME> \
  --region=asia-northeast1

# 流式查看日志
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="db-migrator-preview"' \
  --limit=50 \
  --format=json
```

### 5.2 常见问题排查

#### 问题1: Job 超时 (300s)

**症状**: `DEADLINE_EXCEEDED`

**原因**: 迁移执行时间过长

**解决**:
```yaml
# 增加超时时间
spec:
  template:
    spec:
      template:
        spec:
          timeoutSeconds: 600  # 改为10分钟
```

#### 问题2: 数据库连接失败

**症状**: `connection refused`

**检查**:
```bash
# 验证 Secret 是否存在
gcloud secrets versions access latest --secret=database-url-preview

# 测试连接
gcloud run jobs execute db-migrator-preview \
  --region=asia-northeast1 \
  --wait \
  --command='psql $DATABASE_URL -c "SELECT 1"'
```

#### 问题3: 迁移 SQL 语法错误

**症状**: `execute migration XXX: syntax error`

**解决**:
1. 本地验证 SQL:
   ```bash
   psql $DATABASE_URL < schemas/sql/000xxx.sql
   ```

2. 修复后重新构建镜像：
   ```bash
   gcloud builds submit --config=deployments/cloudbuild/build-migrator.yaml ...
   ```

3. 重新执行 Job (会跳过已成功的迁移)

#### 问题4: `gen_random_uuid()` 函数不存在

**症状**: `pq: function gen_random_uuid() does not exist`

**原因**: Cloud SQL 默认未启用 `pgcrypto` 扩展，迁移中引用 `gen_random_uuid()` 会失败。

**解决**:
1. 在 `schemas/sql/000_extensions.sql` 中创建扩展：
   ```sql
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```
2. 重新构建并部署 DB Migrator。
3. 若仍失败，可使用 psql 手动执行：
   ```bash
   psql $DATABASE_URL -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'
   ```

---

## 六、回滚策略

### 6.1 迁移失败回滚

**场景**: 迁移 Job 执行失败，需要回滚

**步骤**:
```bash
# 1. 查看失败的迁移
gcloud logging read \
  'resource.type="cloud_run_job" AND severity=ERROR' \
  --limit=50

# 2. 手动回滚 SQL (如果已部分执行)
psql $DATABASE_URL << EOF
-- 假设 000003_xxx.sql 失败，手动清理
DROP TABLE IF EXISTS "NewTable";
DELETE FROM schema_migrations WHERE version = '000003_xxx.up.sql';
EOF

# 3. 修复迁移文件后重新执行
gcloud run jobs execute db-migrator-preview --wait
```

### 6.2 服务回滚

**场景**: 服务部署后发现问题，需要回滚

**步骤**:
```bash
# 1. 回滚服务到上一个版本
gcloud run services update-traffic billing-preview \
  --to-revisions=billing-preview-00042-abc=100 \
  --region=asia-northeast1

# 2. 检查数据库 schema 是否兼容
# 如果不兼容，需要回滚迁移 (见上一节)
```

---

## 七、adscenter 服务配置

adscenter 使用完全相同的配置，只需替换服务名：

```bash
# 构建 adscenter migrator 镜像
gcloud builds submit \
  --config=deployments/cloudbuild/build-migrator.yaml \
  --substitutions=_SERVICE=adscenter,_ENV=preview,_COMMIT_SHA=$(git rev-parse --short HEAD)

# 创建 Cloud Run Job
gcloud run jobs replace \
  deployments/db-migrator/job.preview.yaml \
  --region=asia-northeast1

# 执行迁移
gcloud run jobs execute db-migrator-preview \
  --region=asia-northeast1 \
  --wait
```

---

## 八、最佳实践总结

### 8.1 迁移脚本开发

- ✅ 所有 DDL 使用 `IF NOT EXISTS`
- ✅ 文件名按时间戳排序 (`000001_xxx.up.sql`)
- ✅ 每个迁移文件只做一件事
- ✅ 本地测试执行两次验证幂等性

### 8.2 部署流程

- ✅ 先执行迁移 Job，成功后再部署服务
- ✅ 在 GitHub Actions 中强制依赖顺序
- ✅ 生产环境迁移需要手动确认
- ✅ 保留迁移 Job 执行日志至少30天

### 8.3 监控告警

建议配置 Cloud Monitoring 告警：

```yaml
# 迁移 Job 失败告警
condition:
  resource.type = "cloud_run_job"
  metric.type = "run.googleapis.com/job/completed_execution_count"
  filter: status != "Succeeded"
```

---

## 九、参考资料

- [Cloud Run Jobs 文档](https://cloud.google.com/run/docs/create-jobs)
- [Monorepo构建最佳实践](./monorepo-build-best-practices.md)
- [SQL迁移幂等性审查](./SQLMigrationIdempotencyAudit.md)

---

**维护者**: AutoAds 团队
**最后更新**: 2025-10-05
