# AI评估v2.5.0数据库迁移指南

## 概述

本文档说明如何执行AI评估v2.5.0的数据库迁移，添加新的AI分析维度字段。

## 迁移文件

### 024_add_missing_ai_fields.sql
添加AI评估的完整字段（v2.4 + v2.5）：
- `ai_product_type` - 产品类型
- `ai_estimated_aov` - 客单价估算
- `ai_search_insights` - 搜索洞察
- `ai_geo_insights` - 地理洞察
- `ai_risk_assessment` - 风险评估
- `ai_seasonality_insights` - 季节性洞察
- `ai_conversion_insights` - 转化路径分析
- `ai_ltv_insights` - 客户终身价值
- `ai_profitability_insights` - 盈利能力分析
- `ai_competitor_insights` - 竞争对手分析
- `ai_budget_recommendation` - 智能预算建议

### 025_evaluation_trends.sql
创建历史趋势分析视图：
- `offer_evaluation_trends` VIEW - 评估趋势对比
- `offer_evaluation_summary` VIEW - 评估统计摘要
- `get_evaluation_trend_comparison()` FUNCTION - 趋势对比函数

## 执行方式

### 方式1: 使用Cloud SQL Proxy（推荐本地开发）

```bash
# 1. 启动Cloud SQL Proxy
cloud-sql-proxy gen-lang-client-0944935873:asia-northeast1:autoads

# 2. 在另一个终端执行迁移
psql "host=127.0.0.1 port=5432 user=postgres dbname=autoads_db" \
  -f schemas/sql/024_add_missing_ai_fields.sql

psql "host=127.0.0.1 port=5432 user=postgres dbname=autoads_db" \
  -f schemas/sql/025_evaluation_trends.sql
```

### 方式2: 使用gcloud命令（快速）

```bash
# 执行024迁移
gcloud sql connect autoads --user=postgres --database=autoads_db < schemas/sql/024_add_missing_ai_fields.sql

# 执行025迁移
gcloud sql connect autoads --user=postgres --database=autoads_db < schemas/sql/025_evaluation_trends.sql
```

### 方式3: 使用Cloud Run Job（生产推荐）

```bash
# 1. 提交代码到GitHub
git add schemas/sql/024_add_missing_ai_fields.sql schemas/sql/025_evaluation_trends.sql scripts/run-migrations.sh
git commit -m "feat(db): add AI evaluation v2.5 migration"
git push origin main

# 2. 创建Cloud Run Job（一次性）
gcloud run jobs create db-migration-ai-v25 \
  --image=gcr.io/gen-lang-client-0944935873/db-migrator:latest \
  --region=asia-northeast1 \
  --set-env-vars="DATABASE_URL=postgresql://user:pass@/cloudsql/gen-lang-client-0944935873:asia-northeast1:autoads/autoads_db" \
  --set-cloudsql-instances=gen-lang-client-0944935873:asia-northeast1:autoads \
  --service-account=codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com \
  --command="/app/scripts/run-migrations.sh"

# 3. 执行Job
gcloud run jobs execute db-migration-ai-v25 --region=asia-northeast1 --wait
```

## 验证迁移

执行以下SQL验证迁移成功：

```sql
-- 1. 检查新增字段
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'offer_evaluations'
  AND column_name IN (
    'ai_competitor_insights',
    'ai_budget_recommendation',
    'ai_seasonality_insights',
    'ai_conversion_insights',
    'ai_ltv_insights',
    'ai_profitability_insights'
  )
ORDER BY column_name;

-- 2. 检查视图
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN (
    'offer_evaluation_trends',
    'offer_evaluation_summary'
  );

-- 3. 检查函数
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_evaluation_trend_comparison';
```

预期结果：
- 11个新字段全部存在
- 2个视图已创建
- 1个函数已创建

## 回滚（如需要）

```sql
-- 删除v2.5字段
ALTER TABLE offer_evaluations DROP COLUMN IF EXISTS ai_competitor_insights;
ALTER TABLE offer_evaluations DROP COLUMN IF EXISTS ai_budget_recommendation;

-- 删除v2.4字段
ALTER TABLE offer_evaluations DROP COLUMN IF EXISTS ai_seasonality_insights;
ALTER TABLE offer_evaluations DROP COLUMN IF EXISTS ai_conversion_insights;
ALTER TABLE offer_evaluations DROP COLUMN IF EXISTS ai_ltv_insights;
ALTER TABLE offer_evaluations DROP COLUMN IF EXISTS ai_profitability_insights;

-- 删除视图
DROP VIEW IF EXISTS offer_evaluation_trends;
DROP VIEW IF EXISTS offer_evaluation_summary;

-- 删除函数
DROP FUNCTION IF EXISTS get_evaluation_trend_comparison(UUID, VARCHAR);
```

## 注意事项

1. **无数据丢失**: 所有字段使用`ADD COLUMN IF NOT EXISTS`，安全幂等
2. **向后兼容**: 新字段允许NULL，不影响现有数据
3. **视图性能**: 趋势视图使用窗口函数，建议在评估数据量<10万时使用
4. **索引优化**: 如评估记录超过1万条，建议添加索引：
   ```sql
   CREATE INDEX IF NOT EXISTS idx_evaluations_trend
   ON offer_evaluations(offer_id, evaluation_type, created_at DESC);
   ```

## 后续工作

迁移完成后：
1. ✅ 重启siterank服务，使新字段生效
2. ✅ 监控Gemini API响应，确保新维度数据正常返回
3. ✅ 验证前端显示新的AI洞察
4. ✅ 观察数据库性能，必要时添加索引

## 相关文档

- [AI Evaluation v2.5 Feature Summary](/docs/MarkerkitGo/AI_Evaluation_V2_5_Summary.md)
- [Siterank Implementation Guide](/docs/MarkerkitGo/Siterank_Implementation_Summary.md)
- [Database Schema Documentation](/schemas/README.md)
