# 策略B执行指南 - 数据库全量重建

**文档版本**: 1.0
**创建日期**: 2025-10-21
**风险等级**: 🚨 高风险

## 📋 概述

策略B是一个**高风险**的数据库重建方案，将完全清空并重建 `adsai_db` 数据库。此操作适用于以下场景：

- 数据库结构严重混乱，无法通过增量迁移修复
- 需要从干净状态重新开始
- 测试环境的完整重置

⚠️ **警告**: 此操作将删除所有数据，仅在充分准备后执行。

## 🎯 执行流程

### 阶段1: 安全检查
- 验证确认文本
- 验证目标环境
- 显示警告信息

### 阶段2: 构建镜像
- 构建包含所有脚本的迁移镜像
- 推送到Artifact Registry

### 阶段3: 创建备份
- 使用 `pg_dump` 创建完整备份
- 验证备份文件完整性
- 生成备份报告

### 阶段4: 重置数据库
- 删除所有自定义Schema
- 重置public schema
- 创建schema_migrations表

### 阶段5: 执行迁移
- 按顺序执行各服务迁移：
  1. billing（基础用户数据）
  2. adscenter（广告账户）
  3. offer（Offer管理）
  4. console（管理视图）

### 阶段6: 验证结果
- 验证所有Schema存在
- 验证所有表存在
- 测试基本CRUD操作
- 检查数据库健康状态

### 阶段7: 生成报告
- 生成完整的执行报告
- 记录所有操作结果

### 阶段8: 失败回滚（如需要）
- 自动检测执行失败
- 提供回滚指导

## 🚀 执行步骤

### 前置条件

1. **权限确认**
   - 拥有GCP项目的Cloud Run Admin权限
   - 拥有Secret Manager访问权限
   - 拥有Artifact Registry推送权限

2. **环境准备**
   - 确认目标环境（仅支持preview）
   - 通知相关团队成员
   - 准备监控工具

3. **风险评估**
   - 确认可以接受短暂的服务中断
   - 确认有足够的回滚时间
   - 确认备份存储空间充足

### 执行命令

#### 方式1: 通过GitHub Actions UI

1. 访问 GitHub Actions 页面
2. 选择 "数据库全量重建 (策略B - 高风险操作)" 工作流
3. 点击 "Run workflow"
4. 填写参数：
   - **environment**: 选择 `preview`
   - **confirmation_text**: 输入 `REBUILD DATABASE`
   - **backup_name**: 留空（自动生成）或自定义
   - **skip_backup**: 保持 `false`（不要跳过备份）
5. 点击 "Run workflow" 确认执行

#### 方式2: 通过GitHub CLI

```bash
gh workflow run database-rebuild-strategy-b.yml \
  -f environment=preview \
  -f confirmation_text="REBUILD DATABASE" \
  -f backup_name="" \
  -f skip_backup=false
```

### 监控执行

1. **实时监控**
   ```bash
   # 查看工作流执行状态
   gh run list --workflow=database-rebuild-strategy-b.yml

   # 查看特定运行的日志
   gh run view <run-id> --log
   ```

2. **GCP Console监控**
   - 访问 Cloud Run Jobs 页面
   - 查看各个Job的执行状态
   - 检查日志输出

3. **数据库监控**
   ```bash
   # 连接到数据库查看状态
   gcloud sql connect adsai --user=postgres --database=adsai_db

   # 查看Schema列表
   \dn

   # 查看表列表
   \dt billing.*
   \dt offers.*
   \dt adscenter.*
   ```

## 📊 预期结果

### 成功标志

- ✅ 所有Job状态为 `SUCCEEDED`
- ✅ 备份文件已创建并验证
- ✅ 所有Schema已创建
- ✅ 所有表已创建
- ✅ 迁移版本记录正确
- ✅ 基本CRUD测试通过

### 验证检查清单

```sql
-- 1. 检查Schema
SELECT schema_name FROM information_schema.schemata
WHERE schema_name IN ('billing', 'offers', 'adscenter', 'siterank', 'useractivity', 'console');

-- 2. 检查表数量
SELECT schemaname, COUNT(*) as table_count
FROM pg_catalog.pg_tables
WHERE schemaname IN ('billing', 'offers', 'adscenter', 'siterank', 'useractivity', 'console')
GROUP BY schemaname;

-- 3. 检查迁移版本
SELECT version, dirty FROM schema_migrations ORDER BY version;

-- 4. 检查数据库大小
SELECT pg_size_pretty(pg_database_size('adsai_db'));
```

## 🔄 回滚流程

### 何时需要回滚

- 迁移执行失败
- 验证检查未通过
- 发现数据完整性问题
- 服务无法正常连接数据库

### 回滚步骤

1. **停止所有服务**
   ```bash
   # 缩减服务实例到0
   for service in billing-service offer-service adscenter-service; do
     gcloud run services update $service \
       --region=asia-northeast1 \
       --min-instances=0 \
       --max-instances=0
   done
   ```

2. **执行数据库恢复**
   ```bash
   # 创建恢复Job
   gcloud run jobs create db-restore-strategy-b-preview \
     --region=asia-northeast1 \
     --image=asia-northeast1-docker.pkg.dev/your-gcp-project-id/adsai-services/db-migrator:latest \
     --set-env-vars="BACKUP_FILE=<备份文件名>.dump" \
     --set-secrets="DATABASE_URL=DATABASE_URL:latest" \
     --set-cloudsql-instances=your-gcp-project-id:asia-northeast1:adsai \
     --max-retries=0 \
     --task-timeout=30m \
     --command="/restore.sh"

   # 执行恢复
   gcloud run jobs execute db-restore-strategy-b-preview \
     --region=asia-northeast1 \
     --wait
   ```

3. **验证恢复结果**
   ```bash
   # 连接数据库验证
   gcloud sql connect adsai --user=postgres --database=adsai_db

   # 检查数据
   SELECT COUNT(*) FROM billing.users;
   SELECT COUNT(*) FROM offers.offers;
   ```

4. **重启服务**
   ```bash
   # 恢复服务实例
   for service in billing-service offer-service adscenter-service; do
     gcloud run services update $service \
       --region=asia-northeast1 \
       --min-instances=1 \
       --max-instances=10
   done
   ```

## 📝 执行检查清单

### 执行前（T-1天）

- [ ] 与团队确认执行时间
- [ ] 通知所有相关人员
- [ ] 准备监控工具和仪表板
- [ ] 在开发环境测试完整流程
- [ ] 准备回滚脚本和文档
- [ ] 确认备份存储空间充足
- [ ] 确认有足够的执行时间窗口

### 执行当天（T-0）

- [ ] 再次确认执行时间
- [ ] 发送执行开始通知
- [ ] 检查数据库当前状态
- [ ] 检查活动连接数
- [ ] 执行工作流
- [ ] 实时监控执行进度
- [ ] 记录所有异常情况

### 执行后（T+0）

- [ ] 验证所有Schema和表
- [ ] 运行基本功能测试
- [ ] 检查服务健康状态
- [ ] 监控应用日志（至少2小时）
- [ ] 验证数据完整性
- [ ] 生成执行报告
- [ ] 发送完成通知
- [ ] 归档备份文件

### 执行后（T+1天）

- [ ] 检查过去24小时的错误日志
- [ ] 验证所有功能正常
- [ ] 收集团队反馈
- [ ] 更新文档（如有需要）
- [ ] 清理临时资源

## 🔧 故障排查

### 问题1: 备份创建失败

**症状**: backup job执行失败

**可能原因**:
- 磁盘空间不足
- 数据库连接失败
- 权限不足

**解决方案**:
```bash
# 检查磁盘空间
df -h

# 测试数据库连接
gcloud sql connect adsai --user=postgres

# 检查Secret Manager权限
gcloud secrets versions access latest --secret=DATABASE_URL
```

### 问题2: 数据库重置失败

**症状**: reset job执行失败

**可能原因**:
- 存在活动连接
- Schema依赖关系
- 权限不足

**解决方案**:
```bash
# 检查活动连接
psql "$DATABASE_URL" -c "
  SELECT pid, usename, application_name, state
  FROM pg_stat_activity
  WHERE datname = 'adsai_db'
  AND pid != pg_backend_pid();
"

# 强制断开连接（谨慎使用）
psql "$DATABASE_URL" -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'adsai_db'
  AND pid != pg_backend_pid();
"
```

### 问题3: 迁移执行失败

**症状**: migrate job执行失败

**可能原因**:
- 迁移文件语法错误
- 依赖关系未满足
- 数据类型不兼容

**解决方案**:
```bash
# 查看详细错误日志
gcloud logging read \
  "resource.type=cloud_run_job AND resource.labels.job_name=db-migrate-*" \
  --limit=100

# 手动测试迁移文件
psql "$DATABASE_URL" -f services/billing/migrations/000001_create_billing_schema.up.sql
```

### 问题4: 验证失败

**症状**: validate job报告缺失表或Schema

**可能原因**:
- 迁移未完全执行
- 迁移文件不完整
- 顺序执行问题

**解决方案**:
```bash
# 检查迁移版本
psql "$DATABASE_URL" -c "SELECT * FROM schema_migrations ORDER BY version;"

# 手动执行缺失的迁移
migrate -path /migrations/<service> -database "$DATABASE_URL" up

# 重新运行验证
psql "$DATABASE_URL" -f deployments/db-migrator/validate-database.sql
```

## 📞 支持联系

### 紧急情况

如果遇到严重问题：

1. **立即停止执行**
   - 取消正在运行的Job
   - 停止所有服务

2. **评估影响**
   - 检查数据库当前状态
   - 确认备份可用性

3. **决策**
   - 继续修复
   - 或执行回滚

4. **通知团队**
   - 发送紧急通知
   - 说明当前状态和计划

### 技术支持

- **数据库问题**: 联系DBA团队
- **GCP问题**: 联系DevOps团队
- **应用问题**: 联系开发团队

## 📚 相关文档

- [STRATEGY_B_EXECUTION_PLAN.md](./STRATEGY_B_EXECUTION_PLAN.md) - 详细执行计划
- [WORKFLOW_ANALYSIS_STRATEGY_B.md](./WORKFLOW_ANALYSIS_STRATEGY_B.md) - 工作流分析
- [MIGRATION_GROUND_TRUTH_STATUS.md](./MIGRATION_GROUND_TRUTH_STATUS.md) - 当前状态
- [DATABASE_MIGRATION_BEST_PRACTICES.md](./DATABASE_MIGRATION_BEST_PRACTICES.md) - 最佳实践

## 🎓 经验教训

### 成功案例

记录成功执行的经验：
- 执行时间
- 遇到的问题
- 解决方案
- 改进建议

### 失败案例

记录失败的教训：
- 失败原因
- 影响范围
- 恢复过程
- 预防措施

---

**最后更新**: 2025-10-21
**维护者**: DevOps团队
**审核者**: DBA团队

**重要提示**: 此文档应定期更新，反映最新的执行经验和最佳实践。
