# 数据库迁移监控指南

**创建时间**: 2025-10-21
**状态**: 迁移已触发

## 🚀 迁移触发确认

### Git提交信息
```
Commit: 8c5e360d3
Message: feat(database): execute Cloud SQL Proxy migration with unified schema
Branch: main
Push Time: 2025-10-21
```

### 触发的工作流
- **工作流名称**: Database Migration (Cloud Run Job)
- **文件**: `.github/workflows/database-migration-cloudrun.yml`
- **触发条件**: Push到main分支，修改了迁移相关文件

## 📊 监控方式

### 1. GitHub Actions监控

**访问地址**:
```
https://github.com/xxrenzhe/autoads/actions
```

**查看内容**:
- 工作流执行状态
- 各个job的执行进度
- 详细的构建日志
- 迁移执行结果

**预期流程**:
1. `build-migrator-image` - 构建迁移镜像（约2-3分钟）
2. `run-migrations` - 并行执行4个服务迁移（约3-5分钟）
   - billing
   - adscenter
   - offer
   - console
3. `verify-migrations` - 验证迁移结果（约1分钟）

### 2. Cloud Run Jobs监控

**查看所有迁移Job**:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="secrets/gcp_codex_dev.json"

gcloud run jobs list \
  --region=asia-northeast1 \
  --filter="name:db-migrate" \
  --format="table(name,status.latestCreatedExecution.completionStatus)"
```

**查看特定Job详情**:
```bash
# Billing迁移
gcloud run jobs describe db-migrate-billing-preview --region=asia-northeast1

# Adscenter迁移
gcloud run jobs describe db-migrate-adscenter-preview --region=asia-northeast1

# Offer迁移
gcloud run jobs describe db-migrate-offer-preview --region=asia-northeast1

# Console迁移
gcloud run jobs describe db-migrate-console-preview --region=asia-northeast1
```

### 3. Cloud Logging监控

**查看迁移日志**:
```bash
# 查看所有迁移相关日志
gcloud logging read \
  "resource.type=cloud_run_job AND resource.labels.job_name:db-migrate" \
  --limit=200 \
  --format="table(timestamp,resource.labels.job_name,textPayload)" \
  --freshness=1h

# 查看特定服务的迁移日志
gcloud logging read \
  "resource.type=cloud_run_job AND resource.labels.job_name=db-migrate-billing-preview" \
  --limit=100 \
  --format="value(textPayload)" \
  --freshness=1h
```

**日志访问地址**:
```
https://console.cloud.google.com/logs/query?project=gen-lang-client-0944935873
```

**查询语句**:
```
resource.type="cloud_run_job"
resource.labels.job_name=~"db-migrate.*"
timestamp>="2025-10-21T00:00:00Z"
```

### 4. Artifact Registry监控

**查看迁移镜像**:
```bash
gcloud artifacts docker images list \
  asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/db-migrator \
  --format="table(package,version,createTime)" \
  --limit=10
```

**预期结果**:
- 新镜像标签: `8c5e360d3` (commit SHA)
- 新镜像标签: `latest`
- 创建时间: 2025-10-21

## ✅ 成功标准

### GitHub Actions成功标准
- ✅ `build-migrator-image` job成功
- ✅ 所有4个`run-migrations` job成功
- ✅ `verify-migrations` job成功
- ✅ 整体工作流状态为绿色✓

### Cloud Run Jobs成功标准
- ✅ 所有job的`completionStatus`为`EXECUTION_SUCCEEDED`
- ✅ 日志中显示"Migration completed successfully"
- ✅ 没有错误日志

### 数据库验证标准
- ✅ 所有schema创建成功
- ✅ 所有表创建成功
- ✅ 所有索引创建成功
- ✅ schema_migrations表记录正确

## 🔍 验证步骤

### 步骤1: 等待GitHub Actions完成
预计时间: 5-10分钟

**检查命令**:
```bash
# 在浏览器中打开
open https://github.com/xxrenzhe/autoads/actions
```

### 步骤2: 检查Cloud Run Jobs状态
```bash
export GOOGLE_APPLICATION_CREDENTIALS="secrets/gcp_codex_dev.json"

# 检查所有迁移job
gcloud run jobs list \
  --region=asia-northeast1 \
  --filter="name:db-migrate-*-preview" \
  --format="table(name,status.latestCreatedExecution.completionStatus,status.latestCreatedExecution.completionTimestamp)"
```

**预期输出**:
```
NAME                          COMPLETION_STATUS        COMPLETION_TIME
db-migrate-billing-preview    EXECUTION_SUCCEEDED      2025-10-21T...
db-migrate-adscenter-preview  EXECUTION_SUCCEEDED      2025-10-21T...
db-migrate-offer-preview      EXECUTION_SUCCEEDED      2025-10-21T...
db-migrate-console-preview    EXECUTION_SUCCEEDED      2025-10-21T...
```

### 步骤3: 验证数据库Schema
由于数据库只有内网IP，需要通过Cloud Run Job验证：

```bash
# 创建临时验证job
gcloud run jobs create db-verify-temp \
  --region=asia-northeast1 \
  --image=postgres:15-alpine \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest" \
  --set-cloudsql-instances=gen-lang-client-0944935873:asia-northeast1:autoads \
  --max-retries=0 \
  --task-timeout=5m \
  --command=/bin/sh \
  --args=-c \
  --args='
    for i in $(seq 1 30); do
      if [ -S "/cloudsql/gen-lang-client-0944935873:asia-northeast1:autoads/.s.PGSQL.5432" ]; then
        break
      fi
      sleep 1
    done
    
    psql "$DATABASE_URL" -c "\dn" && \
    psql "$DATABASE_URL" -c "SELECT table_schema, COUNT(*) FROM information_schema.tables WHERE table_schema IN ('"'"'billing'"'"', '"'"'useractivity'"'"', '"'"'offers'"'"', '"'"'siterank'"'"', '"'"'adscenter'"'"') GROUP BY table_schema;" && \
    psql "$DATABASE_URL" -c "SELECT * FROM schema_migrations ORDER BY version;"
  ' \
  --execute-now \
  --wait

# 查看验证结果
gcloud logging read \
  "resource.type=cloud_run_job AND resource.labels.job_name=db-verify-temp" \
  --limit=50 \
  --format="value(textPayload)"

# 清理临时job
gcloud run jobs delete db-verify-temp --region=asia-northeast1 --quiet
```

### 步骤4: 检查迁移版本
预期的schema_migrations记录：
```
version | dirty
--------|------
1       | false  (billing schema)
1       | false  (adscenter schema)
1       | false  (offer schema)
5       | false  (console views)
```

## ⚠️ 常见问题和解决方案

### 问题1: 镜像构建失败
**症状**: `build-migrator-image` job失败

**可能原因**:
- Dockerfile语法错误
- 迁移文件路径错误
- Artifact Registry权限问题

**解决方案**:
1. 检查GitHub Actions日志
2. 验证Dockerfile语法
3. 确认服务账号权限

### 问题2: 迁移执行失败
**症状**: `run-migrations` job失败

**可能原因**:
- SQL语法错误
- 外键约束冲突
- 表已存在（非幂等）
- Cloud SQL连接失败

**解决方案**:
1. 查看Cloud Run Job日志
2. 检查SQL语法
3. 验证幂等性语句
4. 检查Cloud SQL Proxy配置

### 问题3: Socket连接超时
**症状**: 日志显示"Cloud SQL socket not found"

**可能原因**:
- Cloud SQL实例未运行
- Cloud SQL Proxy配置错误
- 服务账号权限不足

**解决方案**:
1. 检查Cloud SQL实例状态
2. 验证cloudsql-instances配置
3. 确认服务账号有cloudsql.client权限

### 问题4: 迁移版本冲突
**症状**: "Dirty database version"错误

**可能原因**:
- 上次迁移未完成
- schema_migrations表状态异常

**解决方案**:
```bash
# 修复dirty状态
gcloud run jobs create db-fix-dirty-temp \
  --region=asia-northeast1 \
  --image=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/db-migrator:latest \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest" \
  --set-cloudsql-instances=gen-lang-client-0944935873:asia-northeast1:autoads \
  --command=/bin/sh \
  --args=-c \
  --args='migrate -path /migrations/billing -database "$DATABASE_URL" force 0' \
  --execute-now \
  --wait
```

## 📈 性能指标

### 预期执行时间
- 镜像构建: 2-3分钟
- 单个服务迁移: 30-60秒
- 并行迁移总时间: 3-5分钟
- 验证: 30秒
- **总计**: 5-10分钟

### 资源使用
- CPU: 1 core per job
- Memory: 512MB per job
- 并发job数: 4个（billing, adscenter, offer, console）

## 📝 后续步骤

### 迁移成功后
1. ✅ 验证所有schema和表
2. ✅ 更新服务代码
3. ✅ 部署到preview环境
4. ✅ 运行集成测试
5. ✅ 性能基准测试

### 文档更新
1. 更新MIGRATION_EXECUTION_SUMMARY.md状态
2. 记录实际执行时间
3. 记录遇到的问题和解决方案
4. 更新Ground Truth状态

## 🔗 相关链接

- GitHub Actions: https://github.com/xxrenzhe/autoads/actions
- Cloud Run Jobs: https://console.cloud.google.com/run/jobs?project=gen-lang-client-0944935873
- Cloud Logging: https://console.cloud.google.com/logs?project=gen-lang-client-0944935873
- Artifact Registry: https://console.cloud.google.com/artifacts?project=gen-lang-client-0944935873

---

**状态**: 🚀 迁移已触发，正在执行
**下一步**: 监控GitHub Actions执行状态
