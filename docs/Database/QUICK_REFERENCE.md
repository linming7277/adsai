# 数据库迁移快速参考指南

## 🚀 快速开始

### 完整重置并迁移

```bash
# 1. 完全重置数据库
./scripts/db/complete-database-reset.sh

# 2. 按顺序执行迁移
./scripts/db/migrate-unix-socket.sh billing
./scripts/db/migrate-unix-socket.sh adscenter
./scripts/db/migrate-unix-socket.sh offer
./scripts/db/migrate-unix-socket.sh console

# 3. 验证迁移
./scripts/db/verify-migration-files.sh
```

## 📁 迁移文件位置

```
services/billing/migrations/000001_create_billing_schema.up.sql
services/adscenter/migrations/000001_initial_schema.up.sql
services/offer/migrations/000001_initial_schema.up.sql
services/console/migrations/000001-000006_*.up.sql
```

## 🗂️ Schema所有权

| Schema | 服务 | 主要表 |
|--------|------|--------|
| billing | billing | users, subscriptions, token_balances |
| useractivity | billing | checkins, referrals, notifications |
| offers | offer | offers, offer_metrics |
| siterank | offer | analyses, website_info |
| adscenter | adscenter | user_ads_connections, bulk_action_operations |
| system | console | system_metadata, domain_mappings |
| public | console | audit_log, token_consumption_rules |

## 🔄 迁移顺序

**必须按此顺序执行**（有外键依赖）：

1. billing → 创建users表
2. adscenter → 依赖billing.users
3. offer → 依赖billing.users
4. console → 视图依赖其他服务

## ✅ 验证命令

```bash
# 验证迁移文件完整性
./scripts/db/verify-migration-files.sh

# 检查schema状态
./scripts/db/verify-schema-status.sh

# 查看所有schema
psql -h /cloudsql/autoads-440902:us-central1:autoads-db \
     -U autoads_admin -d autoads_db \
     -c "\dn+"

# 查看所有表
psql -h /cloudsql/autoads-440902:us-central1:autoads-db \
     -U autoads_admin -d autoads_db \
     -c "\dt billing.* offers.* siterank.* adscenter.* useractivity.* system.*"
```

## 🔧 常用操作

### 查看迁移状态

```bash
# 查看schema_migrations表
psql -h /cloudsql/autoads-440902:us-central1:autoads-db \
     -U autoads_admin -d autoads_db \
     -c "SELECT * FROM schema_migrations ORDER BY version;"
```

### 单独迁移某个服务

```bash
# 只迁移billing服务
./scripts/db/migrate-unix-socket.sh billing

# 只迁移console服务
./scripts/db/migrate-unix-socket.sh console
```

### 回滚迁移

```bash
# 使用migrate工具回滚（需要先安装migrate）
migrate -path services/console/migrations \
        -database "postgresql://autoads_admin:password@/cloudsql/instance/autoads_db" \
        down
```

## 📊 统计信息

- **总服务数**: 4个（billing, adscenter, offer, console）
- **总Schema数**: 7个
- **总表数**: 35个
- **总索引数**: 53个
- **迁移文件数**: 18个（9对up/down）

## 🐛 故障排查

### 问题：迁移失败

```bash
# 1. 检查数据库连接
./scripts/db/verify-db-config.sh

# 2. 检查管理员权限
./scripts/db/verify-db-admin.sh

# 3. 查看详细错误
./scripts/db/migrate-unix-socket.sh billing 2>&1 | tee migration.log
```

### 问题：表已存在

```bash
# 完全重置数据库
./scripts/db/complete-database-reset.sh
```

### 问题：外键约束失败

```bash
# 确保按正确顺序执行
# 1. billing (先创建users表)
# 2. adscenter
# 3. offer
# 4. console
```

## 📚 相关文档

- [迁移优化完成报告](./MIGRATION_OPTIMIZATION_COMPLETE.md)
- [迁移文件总结](./MIGRATION_FILES_SUMMARY.md)
- [最终迁移方案](./FINAL_MIGRATION_SOLUTION.md)
- [数据库最佳实践](./DATABASE_MIGRATION_BEST_PRACTICES.md)

## 💡 最佳实践

1. ✅ **总是先在测试环境验证**
2. ✅ **执行前备份数据**
3. ✅ **按正确顺序执行迁移**
4. ✅ **执行后验证结果**
5. ✅ **监控应用日志**

## 🎯 下次迁移清单

- [ ] 备份现有数据
- [ ] 在测试环境验证
- [ ] 检查迁移文件完整性
- [ ] 按顺序执行迁移
- [ ] 验证所有表创建成功
- [ ] 运行应用测试
- [ ] 检查性能指标
- [ ] 更新文档

## 🔗 快速链接

```bash
# 迁移脚本目录
cd scripts/db/

# 迁移文件目录
cd services/billing/migrations/
cd services/adscenter/migrations/
cd services/offer/migrations/
cd services/console/migrations/

# 文档目录
cd docs/Database/
```
