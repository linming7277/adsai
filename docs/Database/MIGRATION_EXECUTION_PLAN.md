# Cloud SQL Proxy 数据库迁移执行计划

**执行日期**: 2025-10-21
**执行人**: Kiro AI Assistant
**目标**: 完成Cloud SQL Proxy迁移和数据库结构优化

## ✅ 前置条件验证（已完成）

### 1. 环境配置
- ✅ DATABASE_URL: Unix Socket格式 (`/cloudsql/gen-lang-client-0944935873:asia-northeast1:autoads`)
- ✅ DB_CONNECTION_MODE: `cloudsql`
- ✅ Cloud SQL实例: `autoads` (RUNNABLE)
- ✅ 服务账号: `codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com`

### 2. 迁移文件
- ✅ 000001_initial_schema.up.sql (3.3KB)
- ✅ 000002_add_user_sync_fields.up.sql (2.6KB)
- ✅ 000003_create_simplified_schema.up.sql (32.4KB) - **核心迁移**

### 3. 基础设施
- ✅ Dockerfile.migrator (Alpine + golang-migrate)
- ✅ migrate-unix-socket.sh (迁移执行脚本)
- ✅ GitHub工作流: database-migration.yml

## 📋 执行步骤

### 阶段1: 数据库迁移执行 ⏳

#### 步骤1.1: 推送代码触发GitHub Actions
```bash
git add .
git commit -m "feat(database): trigger Cloud SQL Proxy migration with simplified schema"
git push origin main
```

**预期结果**:
- GitHub Actions自动触发 `database-migration.yml`
- Cloud Build构建迁移镜像
- Cloud Run Job执行迁移
- 所有表和索引创建成功

#### 步骤1.2: 监控迁移执行
- 访问: https://github.com/xxrenzhe/autoads/actions
- 查看工作流: `Database Migration (Cloud SQL Proxy Enabled)`
- 预计时间: 5-10分钟

#### 步骤1.3: 验证迁移结果
```bash
# 连接数据库验证
gcloud sql connect autoads --user=postgres --database=autoads_db

# 检查schema
\dn

# 检查表
\dt billing.*
\dt offers.*
\dt siterank.*
\dt adscenter.*
\dt useractivity.*
\dt system.*

# 检查迁移版本
SELECT * FROM schema_migrations;
```

### 阶段2: 服务配置更新 ⏳

#### 步骤2.1: 更新所有服务的Cloud Run配置
需要更新的服务（13个）：
1. billing-service
2. offer-service
3. siterank-api
4. siterank-worker
5. adscenter-service
6. useractivity-service
7. console-service
8. bff-service
9. gateway-middleware-service
10. projector-service
11. recommendations-service
12. batchopen-service
13. browser-exec-service

**配置更新内容**:
```yaml
annotations:
  run.googleapis.com/cloudsql-instances: "gen-lang-client-0944935873:asia-northeast1:autoads"

env:
  - name: DB_CONNECTION_MODE
    value: "cloudsql"
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: DATABASE_URL
        key: latest
```

#### 步骤2.2: 批量更新脚本
```bash
bash scripts/deploy/update-cloudsql-proxy-configs.sh preview
```

### 阶段3: 服务部署验证 ⏳

#### 步骤3.1: 验证服务健康状态
```bash
# 检查所有preview服务
gcloud run services list --region=asia-northeast1 --filter="metadata.name:preview" --format="table(metadata.name,status.url,status.conditions[0].status)"

# 测试健康检查端点
curl https://billing-preview-xxx.run.app/health
curl https://offer-preview-xxx.run.app/health
```

#### 步骤3.2: 验证数据库连接
- 检查服务日志中的数据库连接信息
- 确认使用Unix Socket连接
- 验证连接池正常工作

## 📊 迁移内容详情

### 新建Schema（6个）
1. **billing** - 用户计费域
2. **offers** - Offer管理域
3. **siterank** - 网站评估域
4. **adscenter** - 广告中心域
5. **useractivity** - 用户活动域
6. **system** - 系统管理域

### 新建表（30+个）
#### billing schema (5个表)
- users (用户基础信息)
- subscriptions (订阅管理)
- token_balances (代币余额)
- token_transactions (交易记录)
- token_reservations (代币预留)

#### offers schema (5个表)
- offers (Offer主表)
- offer_metrics (性能数据)
- offer_status_history (状态历史)
- offer_preferences (偏好设置)
- offer_dead_letter_queue (死信队列)

#### siterank schema (4个表)
- analyses (评估分析)
- website_info (网站信息)
- evaluation_aggregations (评估汇总)
- website_info_cache (信息缓存)

#### adscenter schema (2个表)
- user_connections (账户连接)
- accounts (账户信息)

#### useractivity schema (3个表)
- checkins (签到记录)
- referrals (推荐记录)
- notifications (通知记录)

#### system schema (2个表)
- system_metadata (系统元数据)
- domain_mappings (域映射)

### 新建索引（50+个）
- 单列索引: 主键、外键、状态字段
- 复合索引: 用户+状态、用户+日期、域+日期
- 条件索引: WHERE子句优化特定查询

### 新建视图（2个）
- user_summary (用户综合视图)
- offer_summary (Offer综合视图)

### 新建触发器（9个）
- updated_at自动更新触发器

## 🎯 成功标准

### 技术指标
- ✅ 所有迁移文件执行成功
- ✅ 所有表和索引创建成功
- ✅ 所有外键约束正确
- ✅ 所有触发器正常工作
- ✅ 所有视图可查询

### 服务指标
- ✅ 所有服务成功部署
- ✅ 健康检查端点响应正常
- ✅ 数据库连接使用Unix Socket
- ✅ 连接池配置正确
- ✅ 无错误日志

### 性能指标
- ✅ 查询响应时间 < 100ms
- ✅ 连接建立时间 < 10ms
- ✅ 连接池利用率 < 80%
- ✅ 无连接泄漏

## ⚠️ 风险和缓解

### 风险1: 迁移失败
- **概率**: 低
- **影响**: 中
- **缓解**: 完整的回滚脚本（.down.sql）
- **应急**: 使用000003_create_simplified_schema.down.sql回滚

### 风险2: 服务中断
- **概率**: 低
- **影响**: 高
- **缓解**: 分批部署，逐步验证
- **应急**: 快速回滚到previous revision

### 风险3: 性能下降
- **概率**: 极低
- **影响**: 中
- **缓解**: 详细的性能监控
- **应急**: 调整连接池参数

## 📝 执行日志

### 2025-10-21 11:00 - 开始迁移准备
- ✅ 验证环境配置完成
- ✅ 确认迁移文件存在
- ✅ 创建执行计划文档

### 2025-10-21 11:30 - 准备推送代码
- ✅ 所有迁移文件就绪
- ✅ GitHub工作流配置正确
- ✅ 准备触发自动迁移

### 待续...

## 🔗 相关文档

- [DATABASE_MIGRATION_BEST_PRACTICES.md](./DATABASE_MIGRATION_BEST_PRACTICES.md)
- [FINAL_DATABASE_OPTIMIZATION_STRATEGY.md](./FINAL_DATABASE_OPTIMIZATION_STRATEGY.md)
- [CLOUD_SQL_PROXY_MIGRATION_EXECUTION.md](./CLOUD_SQL_PROXY_MIGRATION_EXECUTION.md)
- [MIGRATION_STATUS_SUMMARY.md](./MIGRATION_STATUS_SUMMARY.md)

---

**注意**: 本文档会随着迁移进度实时更新。
