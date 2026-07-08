# 数据库迁移文件总结

## 优化完成时间
2025-10-21

## 优化目标
✅ 完整：所有服务的schema都有完整定义  
✅ 无重复：每个表只在一个服务中定义  
✅ 无遗漏：所有必要的表、索引、触发器都已包含  
✅ 清晰：每个服务管理自己的schema  

## 迁移文件结构

### 1. Billing服务
**路径**: `services/billing/migrations/`

**文件**:
- `000001_create_billing_schema.up.sql`
- `000001_create_billing_schema.down.sql`

**包含Schema**:
- `billing`: 用户、订阅、代币管理
- `useractivity`: 用户活动、签到、推荐

**主要表**:
- billing.users
- billing.subscriptions
- billing.token_balances
- billing.token_transactions
- billing.token_reservations
- useractivity.checkins
- useractivity.referrals
- useractivity.notifications

**特性**:
- ✅ 完整的索引优化
- ✅ updated_at触发器
- ✅ 数据完整性约束
- ✅ 表注释
- ✅ 初始化数据

---

### 2. Adscenter服务
**路径**: `services/adscenter/migrations/`

**文件**:
- `000001_initial_schema.up.sql`
- `000001_initial_schema.down.sql`

**包含Schema**:
- `adscenter`: Google Ads集成

**主要表**:
- adscenter.user_ads_connections
- adscenter.idempotency_keys
- adscenter.bulk_action_operations
- adscenter.bulk_action_audits
- adscenter.mcc_links
- adscenter.audit_events

**特性**:
- ✅ 完整的索引优化
- ✅ updated_at触发器
- ✅ 幂等性支持
- ✅ 批量操作审计
- ✅ Demo模式支持

---

### 3. Offer服务
**路径**: `services/offer/migrations/`

**文件**:
- `000001_initial_schema.up.sql`
- `000001_initial_schema.down.sql`

**包含Schema**:
- `offers`: Offer管理和性能
- `siterank`: 网站评估和分析

**主要表**:
- offers.offers
- offers.offer_metrics
- offers.offer_status_history
- offers.offer_preferences
- offers.offer_dead_letter_queue
- siterank.analyses
- siterank.website_info
- siterank.evaluation_aggregations
- siterank.website_info_cache

**特性**:
- ✅ 完整的索引优化
- ✅ updated_at触发器
- ✅ 状态历史追踪
- ✅ 死信队列
- ✅ 评估缓存

---

### 4. Console服务
**路径**: `services/console/migrations/`

**文件**:
- `000001_create_audit_log_table.up.sql`
- `000001_create_audit_log_table.down.sql`
- `000002_create_token_rules_table.up.sql`
- `000002_create_token_rules_table.down.sql`
- `000003_create_recovery_codes_table.up.sql`
- `000003_create_recovery_codes_table.down.sql`
- `000004_create_export_and_feature_flags_tables.up.sql`
- `000004_create_export_and_feature_flags_tables.down.sql`
- `000005_create_read_only_views.up.sql`
- `000005_create_read_only_views.down.sql`
- `000006_create_system_metadata.up.sql`
- `000006_create_system_metadata.down.sql`

**包含Schema**:
- `public`: Console专用表
- `system`: 系统元数据

**主要表**:
- audit_log (public)
- token_consumption_rules (public)
- admin_recovery_codes (public)
- admin_audit_log (public)
- export_history (public)
- feature_flags (public)
- feature_flag_history (public)
- notification_templates (public)
- notification_broadcasts (public)
- nps_feedback (public)
- system.system_metadata
- system.domain_mappings

**视图**:
- console_subscriptions_with_users
- console_dashboard_summary
- console_user_overview

**特性**:
- ✅ 审计日志
- ✅ Token消耗规则
- ✅ 恢复码机制
- ✅ 导出历史
- ✅ 功能开关
- ✅ 跨服务只读视图
- ✅ 系统元数据管理

---

## 迁移执行顺序

由于存在外键依赖关系，必须按以下顺序执行迁移：

```
1. billing (000001)      # 创建users表，其他服务依赖
   ↓
2. adscenter (000001)    # 依赖billing.users
   ↓
3. offer (000001)        # 依赖billing.users
   ↓
4. console (000001-000006) # 视图依赖其他服务的表
```

## Schema所有权

| Schema | 所属服务 | 说明 |
|--------|---------|------|
| billing | billing | 用户、订阅、代币 |
| useractivity | billing | 用户活动（签到、推荐） |
| offers | offer | Offer管理和性能 |
| siterank | offer | 网站评估（逻辑上属于offer） |
| adscenter | adscenter | Google Ads集成 |
| system | console | 系统元数据和配置 |
| public | console | Console专用表 |

## 外键依赖关系

```
billing.users (基础)
    ↓
    ├─→ billing.subscriptions
    ├─→ billing.token_balances
    ├─→ billing.token_transactions
    ├─→ billing.token_reservations
    ├─→ useractivity.checkins
    ├─→ useractivity.referrals
    ├─→ useractivity.notifications
    ├─→ adscenter.user_ads_connections
    ├─→ offers.offers
    └─→ siterank.analyses

offers.offers
    ↓
    ├─→ offers.offer_metrics
    ├─→ offers.offer_status_history
    ├─→ offers.offer_preferences
    ├─→ offers.offer_dead_letter_queue
    └─→ siterank.analyses

adscenter.user_ads_connections
    ↓
    ├─→ adscenter.bulk_action_operations
    └─→ adscenter.audit_events
```

## 历史文件处理

历史迁移文件已移至 `internal/migrations/` 目录，并添加了README说明：

- `services/billing/internal/migrations/README.md`
- `services/adscenter/internal/migrations/README.md`

这些文件保留作为历史参考，但不再用于数据库迁移。

## 验证清单

- [x] 所有迁移文件都有对应的down文件
- [x] 没有重复的表定义
- [x] 外键引用正确（schema.table格式）
- [x] 索引命名一致（idx_tablename_column）
- [x] 触发器完整（updated_at）
- [x] 约束合理（CHECK, UNIQUE, NOT NULL）
- [x] 注释完整（COMMENT ON）
- [x] 迁移顺序正确（依赖关系）
- [x] 历史文件已归档

## 使用方法

### 1. 完全重置数据库

```bash
# 使用完整重置脚本
./scripts/db/complete-database-reset.sh
```

### 2. 执行迁移

```bash
# 按顺序执行迁移
./scripts/db/migrate-unix-socket.sh billing
./scripts/db/migrate-unix-socket.sh adscenter
./scripts/db/migrate-unix-socket.sh offer
./scripts/db/migrate-unix-socket.sh console
```

### 3. 验证迁移

```bash
# 检查所有schema
psql -h /cloudsql/autoads-440902:us-central1:autoads-db \
     -U autoads_admin -d autoads_db \
     -c "\dn+"

# 检查所有表
psql -h /cloudsql/autoads-440902:us-central1:autoads-db \
     -U autoads_admin -d autoads_db \
     -c "\dt billing.* offers.* siterank.* adscenter.* useractivity.* system.*"
```

## 注意事项

1. **执行顺序很重要**：必须按照依赖关系顺序执行
2. **测试环境先行**：在生产环境执行前，先在测试环境验证
3. **备份数据**：执行迁移前务必备份数据
4. **监控日志**：执行过程中监控错误日志
5. **回滚准备**：确保down迁移文件可用

## 相关文档

- [迁移优化计划](./MIGRATION_OPTIMIZATION_PLAN.md)
- [最终迁移方案](./FINAL_MIGRATION_SOLUTION.md)
- [迁移执行计划](./MIGRATION_EXECUTION_PLAN.md)
- [数据库最佳实践](./DATABASE_MIGRATION_BEST_PRACTICES.md)
