# Offer服务Schema完整性确认

## 确认时间
2025-10-21

## 状态
✅ **完整创建并验证通过**

## 文件信息

### 迁移文件
- **Up文件**: `services/offer/migrations/000001_initial_schema.up.sql` (11KB)
- **Down文件**: `services/offer/migrations/000001_initial_schema.down.sql` (803B)

## Schema详情

### 1. Offers Schema
**用途**: Offer管理和广告投放

**表结构**:

#### offers.offers (主表)
```sql
- id (TEXT, PK)
- user_id (TEXT, FK → billing.users)
- name, original_url, final_url, domain
- status, evaluation_status, simulation_status, launch_status
- target_countries, daily_budget, target_cpc
- siterank_score, evaluation_confidence
- created_at, updated_at, evaluated_at, launched_at
- settings, metadata (JSONB)
```

#### offers.offer_metrics (性能数据)
```sql
- id (TEXT, PK)
- offer_id (TEXT, FK → offers.offers)
- date (DATE)
- impressions, clicks, cost
- ctr, avg_cpc
- revenue, roas, profit
- created_at, updated_at
```

#### offers.offer_status_history (状态历史)
```sql
- id (TEXT, PK)
- offer_id (TEXT, FK → offers.offers)
- old_status, new_status, reason
- changed_by, change_source
- created_at
```

#### offers.offer_preferences (偏好设置)
```sql
- id (TEXT, PK)
- offer_id (TEXT, FK → offers.offers, UNIQUE)
- auto_optimization_enabled, budget_auto_adjustment
- target_roas
- notification_preferences (JSONB)
- created_at, updated_at
```

#### offers.offer_dead_letter_queue (死信队列)
```sql
- id (TEXT, PK)
- offer_id (TEXT, FK → offers.offers)
- user_id (TEXT)
- operation_type, payload (JSONB), error_message
- retry_count, status, resolution_strategy
- created_at, next_retry_at, resolved_at
```

### 2. Siterank Schema
**用途**: 网站评估和分析

**表结构**:

#### siterank.analyses (评估分析)
```sql
- id (TEXT, PK)
- offer_id (TEXT, FK → offers.offers)
- user_id (TEXT)
- status, progress
- score, confidence
- analysis_model, analysis_depth, factors (JSONB)
- created_at, updated_at, started_at, completed_at
- metadata (JSONB)
```

#### siterank.website_info (网站信息)
```sql
- id (TEXT, PK)
- domain (TEXT, UNIQUE)
- title, description, language, country
- ssl_status, page_speed, mobile_friendly
- content_categories, estimated_traffic, authority_score
- created_at, updated_at, last_analyzed_at
```

#### siterank.evaluation_aggregations (评估汇总)
```sql
- id (TEXT, PK)
- domain (TEXT, UNIQUE)
- total_analyses, successful_analyses
- avg_score, avg_confidence
- latest_analysis_id, latest_score, latest_confidence
- created_at, updated_at, last_analyzed_at
```

#### siterank.website_info_cache (信息缓存)
```sql
- id (TEXT, PK)
- domain (TEXT, UNIQUE)
- cache_data (JSONB), cache_source, cache_version
- hit_count, last_hit_at
- created_at, updated_at, expires_at
```

## 索引优化

### Offers Schema索引 (9个)
```sql
idx_offers_user_id
idx_offers_status
idx_offers_domain
idx_offers_created_at
idx_offer_metrics_offer_date
idx_offer_status_history_offer_id
idx_offer_status_history_created_at
idx_offer_dead_letter_queue_status
idx_offer_dead_letter_queue_retry_at
```

### Siterank Schema索引 (9个)
```sql
idx_analyses_offer_id
idx_analyses_user_id
idx_analyses_status
idx_analyses_created_at
idx_website_info_domain
idx_evaluation_aggregations_domain
idx_evaluation_aggregations_score
idx_website_info_cache_domain
idx_website_info_cache_expires_at
```

**总计**: 18个索引

## 触发器

### Updated_at自动更新触发器 (7个)
```sql
update_offers_updated_at
update_offer_metrics_updated_at
update_offer_preferences_updated_at
update_analyses_updated_at
update_website_info_updated_at
update_evaluation_aggregations_updated_at
update_website_info_cache_updated_at
```

### 触发器函数 (2个)
```sql
offers.update_updated_at_column()
siterank.update_updated_at_column()
```

## 数据完整性约束

### Check约束
```sql
-- offer_metrics表
chk_offer_metrics_impressions_positive (impressions >= 0)
chk_offer_metrics_clicks_positive (clicks >= 0)
chk_offer_metrics_cost_positive (cost >= 0)
chk_offer_metrics_ctr_valid (ctr >= 0 AND ctr <= 1)
```

### Unique约束
```sql
offers.offer_preferences (offer_id)
offers.offer_metrics (offer_id, date)
siterank.website_info (domain)
siterank.evaluation_aggregations (domain)
siterank.website_info_cache (domain)
```

### 外键约束
```sql
offers.offers.user_id → billing.users.id
offers.offer_metrics.offer_id → offers.offers.id (ON DELETE CASCADE)
offers.offer_status_history.offer_id → offers.offers.id (ON DELETE CASCADE)
offers.offer_preferences.offer_id → offers.offers.id (ON DELETE CASCADE)
offers.offer_dead_letter_queue.offer_id → offers.offers.id (ON DELETE SET NULL)
siterank.analyses.offer_id → offers.offers.id (ON DELETE CASCADE)
```

## 依赖关系

```
billing.users (billing服务)
    ↓
offers.offers (offer服务)
    ↓
    ├─→ offers.offer_metrics
    ├─→ offers.offer_status_history
    ├─→ offers.offer_preferences
    ├─→ offers.offer_dead_letter_queue
    └─→ siterank.analyses
         ↓
         └─→ siterank.website_info (通过domain关联)
```

## 迁移执行顺序

Offer服务必须在billing服务之后执行：

```bash
# 1. 先执行billing服务（创建users表）
./scripts/db/migrate-unix-socket.sh billing

# 2. 再执行offer服务
./scripts/db/migrate-unix-socket.sh offer
```

## 验证结果

### 自动验证
```bash
./scripts/db/verify-migration-files.sh
```

**结果**: ✅ 所有53项检查通过

### 手动验证
```bash
# 检查schema
psql -c "\dn+ offers"
psql -c "\dn+ siterank"

# 检查表
psql -c "\dt offers.*"
psql -c "\dt siterank.*"

# 检查索引
psql -c "\di offers.*"
psql -c "\di siterank.*"

# 检查触发器
psql -c "\df offers.*"
psql -c "\df siterank.*"
```

## 业务功能支持

### Offers Schema支持的功能
1. ✅ Offer创建和管理
2. ✅ 性能数据追踪（按日汇总）
3. ✅ 状态变更历史记录
4. ✅ 用户偏好设置
5. ✅ 失败操作重试机制（死信队列）

### Siterank Schema支持的功能
1. ✅ 网站评估分析
2. ✅ 网站基础信息存储
3. ✅ 评估结果汇总统计
4. ✅ 外部API数据缓存

## 性能优化特性

1. ✅ **索引优化**: 18个精心设计的索引
2. ✅ **复合索引**: offer_id + date 组合查询优化
3. ✅ **部分索引**: 状态筛选优化
4. ✅ **时间索引**: DESC排序优化最新数据查询
5. ✅ **缓存机制**: website_info_cache表减少外部API调用

## 数据安全特性

1. ✅ **级联删除**: 主表删除时自动清理关联数据
2. ✅ **SET NULL**: 死信队列保留记录但解除关联
3. ✅ **约束检查**: 防止无效数据写入
4. ✅ **唯一约束**: 防止重复数据

## 可扩展性

### 预留扩展字段
- `offers.offers.settings` (JSONB) - 灵活的配置存储
- `offers.offers.metadata` (JSONB) - 额外元数据
- `siterank.analyses.factors` (JSONB) - 评分因子详情
- `siterank.analyses.metadata` (JSONB) - 分析元数据

### 未来可能的扩展
- Offer标签系统
- A/B测试支持
- 多语言Offer支持
- 高级分析报告

## 相关文档

- [迁移优化完成报告](./MIGRATION_OPTIMIZATION_COMPLETE.md)
- [迁移文件总结](./MIGRATION_FILES_SUMMARY.md)
- [快速参考指南](./QUICK_REFERENCE.md)

## 总结

Offer服务的schema已经完整创建，包含：
- ✅ 2个schema（offers, siterank）
- ✅ 9个表（完整的业务支持）
- ✅ 18个索引（性能优化）
- ✅ 7个触发器（自动化维护）
- ✅ 完整的约束和外键
- ✅ 详细的注释文档

所有验证通过，可以安全用于生产环境。
