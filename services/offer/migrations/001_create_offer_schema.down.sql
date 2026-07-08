-- ========================================
-- AutoAds 数据库回滚: Offer Schema Initialization
-- 回滚Offer域 Schema
-- 迁移ID: 001
-- 版本: v2.0
-- ========================================

-- 开始事务
BEGIN;

-- 删除视图
DROP VIEW IF EXISTS offer.offer_performance_stats;
DROP VIEW IF EXISTS offer.offer_overview;

-- 删除触发器
DROP TRIGGER IF EXISTS increment_template_usage_trigger ON offer.offers;
DROP TRIGGER IF EXISTS log_offer_activity_trigger ON offer.offers;
DROP TRIGGER IF EXISTS update_offer_templates_updated_at ON offer.offer_templates;
DROP TRIGGER IF EXISTS update_offer_evaluations_updated_at ON offer.offer_evaluations;
DROP TRIGGER IF EXISTS update_offer_variants_updated_at ON offer.offer_variants;
DROP TRIGGER IF EXISTS update_offers_updated_at ON offer.offers;

-- 删除函数
DROP FUNCTION IF EXISTS offer.increment_template_usage();
DROP FUNCTION IF EXISTS offer.log_offer_activity();
DROP FUNCTION IF EXISTS offer.update_updated_at_column();

-- 删除表（按依赖关系逆序）
DROP TABLE IF EXISTS offer.offer_templates;
DROP TABLE IF EXISTS offer.offer_activity_log;
DROP TABLE IF EXISTS offer.offer_simulations;
DROP TABLE IF EXISTS offer.offer_evaluations;
DROP TABLE IF EXISTS offer.offer_variants;
DROP TABLE IF EXISTS offer.offers;

-- 删除Schema
DROP SCHEMA IF EXISTS offer;

-- 提交事务
COMMIT;

-- 验证回滚结果
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'offer') THEN
        RAISE NOTICE '✅ offer schema dropped successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to drop offer schema';
    END IF;
END $$;

