# 数据库迁移工作流触发确认

**更新时间**: 2025-10-21
**状态**: ✅ 已修正并触发

---

## ✅ 问题已解决

### 原始问题
- ❌ `database-migration.yml` 使用GitHub Actions Runner + TCP连接
- ❌ 不符合Cloud Run Job + Unix Socket架构要求
- ❌ 被push触发器自动触发了错误的工作流

### 修正方案
1. ✅ 禁用`database-migration.yml`的push触发器
2. ✅ 启用`database-migration-cloudrun.yml`的push触发器
3. ✅ 添加`TARGET_ENV`环境变量支持push触发
4. ✅ 确保push触发时默认使用preview环境

---

## 🔧 技术修正详情

### 修改1: 添加TARGET_ENV环境变量

```yaml
env:
  PROJECT_ID: your-gcp-project-id
  REGION: asia-northeast1
  CLOUDSQL_INSTANCE: adsai
  IMAGE_NAME: asia-northeast1-docker.pkg.dev/your-gcp-project-id/adsai-services/db-migrator
  # Default to preview environment when triggered by push
  TARGET_ENV: ${{ inputs.environment || 'preview' }}
```

**说明**: 
- 当通过workflow_dispatch手动触发时，使用`inputs.environment`
- 当通过push触发时，`inputs.environment`为空，默认使用`'preview'`

### 修改2: 替换所有environment引用

```yaml
# 修改前
JOB_NAME="db-migrate-${{ matrix.service }}-${{ inputs.environment }}"

# 修改后
JOB_NAME="db-migrate-${{ matrix.service }}-${{ env.TARGET_ENV }}"
```

**影响的位置**:
- Create/Update Cloud Run Job步骤
- Execute migration job步骤
- Get job execution logs步骤
- Create verification job步骤
- Migration report生成

---

## 📊 工作流触发方式对比

### 方式1: Push触发（自动）

```yaml
触发条件:
  - Push到main分支
  - 修改了以下路径:
    - services/*/migrations/**
    - .github/workflows/database-migration-cloudrun.yml
    - deployments/db-migrator/**

环境: preview (默认)
执行方式: Cloud Run Job + Unix Socket
```

### 方式2: 手动触发（workflow_dispatch）

```yaml
触发方式: GitHub UI或CLI手动触发
环境: 可选择 preview 或 production
执行方式: Cloud Run Job + Unix Socket
```

---

## 🚀 当前执行状态

### 最新的Push记录

```bash
Commit: 7e99c9378
Message: fix(database): ensure Cloud Run Job migration works with push trigger
Date: 2025-10-21
Status: ✅ 已推送到origin/main
```

### 预期触发的工作流

```yaml
工作流名称: Database Migration (Cloud Run Job)
触发方式: Push到main分支
目标环境: preview
执行步骤:
  1. Build Migrator Image (2-3分钟)
  2. Run Migrations via Cloud Run Job (3-5分钟)
     - billing
     - adscenter
     - offer
     - console
  3. Verify All Migrations (1分钟)
```

### 监控地址

- **GitHub Actions**: https://github.com/linming7277/adsai/actions
- **工作流**: "Database Migration (Cloud Run Job)"
- **预计完成时间**: 6-10分钟

---

## ✅ 验证清单

### 工作流配置验证

- [x] `database-migration.yml` push触发器已移除
- [x] `database-migration-cloudrun.yml` push触发器已添加
- [x] TARGET_ENV环境变量已配置
- [x] 所有environment引用已替换为TARGET_ENV
- [x] 默认环境设置为preview

### 执行验证（待确认）

- [ ] GitHub Actions已触发
- [ ] Cloud Run Job已创建
- [ ] 迁移镜像构建成功
- [ ] 4个服务的迁移Job执行成功
- [ ] 所有schema创建成功
- [ ] 迁移报告生成成功

---

## 📋 Cloud Run Job配置

### Job命名规则

```bash
# 迁移Job
db-migrate-{service}-{environment}

# 示例
db-migrate-billing-preview
db-migrate-adscenter-preview
db-migrate-offer-preview
db-migrate-console-preview

# 验证Job
db-verify-{environment}

# 示例
db-verify-preview
```

### Job配置参数

```yaml
Image: asia-northeast1-docker.pkg.dev/your-gcp-project-id/adsai-services/db-migrator:{sha}
Region: asia-northeast1
Environment Variables:
  - SERVICE_NAME: {service}
Secrets:
  - DATABASE_URL: DATABASE_URL:latest
Cloud SQL Instances:
  - your-gcp-project-id:asia-northeast1:adsai
Max Retries: 0
Task Timeout: 10m
```

---

## 🔍 执行流程详解

### 阶段1: 构建迁移镜像

```bash
1. Checkout代码
2. 配置GCP认证
3. 配置Docker for Artifact Registry
4. 构建Dockerfile.migrate
   - Base: alpine:3.18
   - Tools: golang-migrate v4.17.0, postgresql-client 15.4
   - Migrations: 所有服务的迁移文件
5. 推送镜像到Artifact Registry
   - Tag 1: {sha}
   - Tag 2: latest
```

### 阶段2: 执行迁移（并行）

```bash
For each service in [billing, adscenter, offer, console]:
  1. 创建/更新Cloud Run Job
     - Job名称: db-migrate-{service}-preview
     - 配置Cloud SQL Proxy连接
     - 设置环境变量和secrets
  
  2. 执行迁移Job
     - 运行migrate.sh脚本
     - 连接方式: Unix Socket
     - 执行: migrate -path /migrations/{service} -database $DATABASE_URL up
  
  3. 获取执行日志
     - 从Cloud Logging读取
     - 显示迁移详情
```

### 阶段3: 验证结果

```bash
1. 创建验证Job
   - Job名称: db-verify-preview
   - 执行数据库schema验证

2. 生成迁移报告
   - 包含所有迁移结果
   - 上传为GitHub Artifact

3. 通知完成状态
```

---

## 📊 预期结果

### 成功标准

```yaml
构建阶段:
  - ✅ 镜像构建成功
  - ✅ 推送到Artifact Registry成功

执行阶段:
  - ✅ 4个Cloud Run Job创建成功
  - ✅ 4个迁移Job执行成功
  - ✅ 无错误日志

验证阶段:
  - ✅ 所有schema存在
  - ✅ 所有表创建成功
  - ✅ 索引和触发器正常
```

### 预期创建的数据库对象

```sql
-- Schemas (5个)
billing, useractivity, offers, siterank, adscenter

-- Tables (35+个)
billing schema: 6个表
useractivity schema: 6个表
offers schema: 5个表
siterank schema: 5个表
adscenter schema: 6个表
system schema: 2个表
public schema: 5个管理表

-- Indexes (50+个)
-- Triggers (10+个)
-- Constraints (20+个)
```

---

## 🎯 下一步行动

### 立即执行

1. ✅ 监控GitHub Actions执行
   - 访问: https://github.com/linming7277/adsai/actions
   - 确认工作流已触发
   - 查看执行日志

2. ⏳ 验证Cloud Run Job
   - 检查Job创建状态
   - 查看执行日志
   - 确认迁移成功

3. ⏳ 验证数据库结构
   - 检查所有schema
   - 验证表结构
   - 确认索引和触发器

### 后续任务

1. 更新DB_CONNECTION_MODE为"cloudsql"
2. 更新服务代码使用新表结构
3. 实现数据同步机制
4. 配置监控和告警

---

## 📁 相关文档

- [MIGRATION_WORKFLOW_FIX.md](./MIGRATION_WORKFLOW_FIX.md) - 工作流修正方案
- [MIGRATION_EXECUTION_STATUS.md](./MIGRATION_EXECUTION_STATUS.md) - 执行状态
- [DATABASE_MIGRATION_BEST_PRACTICES.md](./DATABASE_MIGRATION_BEST_PRACTICES.md) - 最佳实践
- [MustKnowV7.md](../BasicPrinciples/MustKnowV7.md) - 架构设计

---

**状态**: ✅ 工作流已修正并触发
**触发方式**: Push到main分支
**目标环境**: preview
**预计完成**: 2025-10-21 12:00

**最后更新**: 2025-10-21 11:50
