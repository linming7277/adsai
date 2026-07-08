# CI/CD数据库迁移执行指南

## 概述

本指南说明如何通过GitHub Actions CI/CD流程执行数据库迁移。

## 前提条件

### 1. GitHub Secrets配置

确保以下secrets已在GitHub仓库中配置：

- `GCP_SA_KEY`: GCP服务账号密钥（JSON格式）

### 2. GCP Secret Manager配置

确保以下secret已在GCP Secret Manager中配置：

- `DATABASE_URL`: 完整的数据库连接URL
  - 格式: `postgresql://user:password@/cloudsql/PROJECT:REGION:INSTANCE/dbname?sslmode=disable`
  - 示例: `postgresql://autoads_admin:password@/cloudsql/gen-lang-client-0944935873:asia-northeast1:autoads/autoads_db?sslmode=disable`

### 3. GCP权限

服务账号需要以下权限：
- Cloud SQL Client
- Secret Manager Secret Accessor
- Cloud Run Admin（如果需要更新服务配置）

## 执行方式

### 方式1: 手动触发（推荐）

1. 访问GitHub Actions页面：
   ```
   https://github.com/xxrenzhe/autoads/actions/workflows/database-migration.yml
   ```

2. 点击 "Run workflow" 按钮

3. 选择参数：
   - **Environment**: 选择 `preview` 或 `production`
   - **Dry run**: 选择是否只验证不执行

4. 点击 "Run workflow" 开始执行

### 方式2: 自动触发

当以下情况发生时，工作流会自动触发：

- 推送代码到 `main` 分支
- 修改了 `services/*/migrations/**` 目录下的文件

## 执行流程

### 阶段1: 验证（Validate）

```
validate-migrations
├── 验证迁移文件格式
├── 检查表引用问题
└── 确保所有up/down文件配对
```

**预计时间**: 1-2分钟

### 阶段2: 迁移（Migrate）

按依赖顺序执行迁移：

```
1. migrate-billing
   ├── 创建billing schema
   └── 创建useractivity schema

2. migrate-adscenter (并行)
   └── 创建adscenter schema

3. migrate-offer (并行)
   ├── 创建offers schema
   └── 创建siterank schema

4. migrate-console
   ├── 创建public schema表
   └── 创建system schema
```

**预计时间**: 5-10分钟

### 阶段3: 验证（Verify）

```
verify-all-schemas
├── 列出所有schemas
├── 列出所有tables
├── 统计表数量
└── 生成迁移报告
```

**预计时间**: 1-2分钟

### 阶段4: 通知（Notify）

```
notify-completion
└── 发送完成通知
```

## 迁移顺序说明

### 为什么按这个顺序？

1. **Billing先行**: 
   - 创建 `billing.users` 表
   - 其他服务依赖此表（外键引用）

2. **Adscenter和Offer并行**:
   - 两者都依赖 `billing.users`
   - 但彼此独立，可以并行执行

3. **Console最后**:
   - 创建跨服务的只读视图
   - 依赖其他服务的表已存在

## 监控和验证

### 1. 查看执行日志

在GitHub Actions页面查看详细日志：
```
Actions → Database Migration → 选择运行记录 → 查看各个job的日志
```

### 2. 下载迁移报告

执行完成后，可以下载迁移报告：
```
Actions → Database Migration → 选择运行记录 → Artifacts → migration-report
```

### 3. 验证数据库状态

连接到数据库验证：

```bash
# 通过Cloud SQL Proxy连接
./cloud_sql_proxy -instances=PROJECT_ID:REGION:INSTANCE_NAME=tcp:5432 &

# 查看所有schemas
psql -h localhost -U autoads_admin -d autoads_db -c "\dn+"

# 查看所有表
psql -h localhost -U autoads_admin -d autoads_db -c "
  SELECT schemaname, COUNT(*) as table_count
  FROM pg_tables 
  WHERE schemaname IN ('billing', 'useractivity', 'offers', 'siterank', 'adscenter', 'system')
  GROUP BY schemaname;
"
```

预期结果：
```
 schemaname    | table_count 
---------------+-------------
 billing       |           6
 useractivity  |           6
 offers        |           5
 siterank      |           5
 adscenter     |           6
 system        |           2
```

## 故障排查

### 问题1: 迁移失败 - 表已存在

**症状**: 
```
ERROR: relation "billing.users" already exists
```

**解决方案**:
1. 检查是否已经执行过迁移
2. 如果需要重新执行，先运行down迁移：
   ```bash
   migrate -path services/billing/migrations -database $DB_URL down
   ```

### 问题2: 外键约束失败

**症状**:
```
ERROR: foreign key constraint "fk_user_id" cannot be implemented
```

**解决方案**:
1. 确保billing服务先执行
2. 检查迁移顺序是否正确

### 问题3: Cloud SQL Proxy连接失败

**症状**:
```
ERROR: could not connect to server: Connection refused
```

**解决方案**:
1. 检查Cloud SQL实例是否运行
2. 检查服务账号权限
3. 检查网络配置

### 问题4: 权限不足

**症状**:
```
ERROR: permission denied for schema billing
```

**解决方案**:
1. 检查数据库用户权限
2. 确保用户有CREATE权限：
   ```sql
   GRANT CREATE ON DATABASE autoads_db TO autoads_admin;
   ```

## 回滚计划

### 自动回滚

如果迁移失败，可以使用down迁移回滚：

```bash
# 回滚顺序（与执行顺序相反）
migrate -path services/console/migrations -database $DB_URL down
migrate -path services/offer/migrations -database $DB_URL down
migrate -path services/adscenter/migrations -database $DB_URL down
migrate -path services/billing/migrations -database $DB_URL down
```

### 手动回滚

如果自动回滚失败，可以手动删除schemas：

```sql
-- 警告：这将删除所有数据！
DROP SCHEMA IF EXISTS system CASCADE;
DROP SCHEMA IF EXISTS adscenter CASCADE;
DROP SCHEMA IF EXISTS siterank CASCADE;
DROP SCHEMA IF EXISTS offers CASCADE;
DROP SCHEMA IF EXISTS useractivity CASCADE;
DROP SCHEMA IF EXISTS billing CASCADE;
```

## 最佳实践

### 1. 在测试环境先执行

```bash
# 先在preview环境测试
gh workflow run database-migration.yml -f environment=preview

# 验证成功后再在生产环境执行
gh workflow run database-migration.yml -f environment=production
```

### 2. 使用Dry Run模式

```bash
# 只验证不执行
gh workflow run database-migration.yml -f environment=preview -f dry_run=true
```

### 3. 监控执行过程

- 实时查看GitHub Actions日志
- 监控Cloud SQL性能指标
- 检查服务日志

### 4. 备份数据

在生产环境执行前：

```bash
# 创建Cloud SQL备份
gcloud sql backups create \
  --instance=autoads \
  --project=gen-lang-client-0944935873
```

## 快速命令参考

### 使用GitHub CLI触发

```bash
# 安装GitHub CLI
brew install gh

# 登录
gh auth login

# 触发迁移（preview环境）
gh workflow run database-migration.yml -f environment=preview

# 触发迁移（production环境）
gh workflow run database-migration.yml -f environment=production

# 查看运行状态
gh run list --workflow=database-migration.yml

# 查看最新运行的日志
gh run view --log
```

### 使用curl触发

```bash
# 获取GitHub Token
GITHUB_TOKEN="your_github_token"

# 触发工作流
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/xxrenzhe/autoads/actions/workflows/database-migration.yml/dispatches \
  -d '{"ref":"main","inputs":{"environment":"preview","dry_run":"false"}}'
```

## 相关文档

- [迁移文件总结](./MIGRATION_FILES_SUMMARY.md)
- [优化完成报告](./OPTIMIZATION_FINAL_STATUS.md)
- [快速参考指南](./QUICK_REFERENCE.md)
- [数据库最佳实践](./DATABASE_MIGRATION_BEST_PRACTICES.md)

## 支持

如有问题，请：
1. 查看GitHub Actions日志
2. 检查Cloud SQL日志
3. 参考故障排查部分
4. 联系DevOps团队

---

**最后更新**: 2025-10-21  
**维护者**: DevOps Team
