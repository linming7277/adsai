-- ========================================
-- AutoAds 数据库迁移: Offer Schema
-- Layer 3: 业务域层 - Offer优惠管理
-- 迁移ID: 001
-- 版本: v2.0 (优化版)
-- 创建时间: 2025-10-21
-- 优化时间: 2025-10-22
-- 优先级: P0修复 - UUID类型一致性
-- ========================================
--
-- 优化内容:
-- ✅ 修复UUID类型不匹配 (offer_id: TEXT → UUID)
--    - offer.offer_variants.offer_id
--    - offer.offer_evaluations.offer_id
--    - offer.offer_simulations.offer_id
--    - offer.offer_activity_log.offer_id
-- ✅ 确保所有外键类型与主键一致
-- ✅ Layer 3依赖: 需要先创建 user.users (Layer 2)
--
-- ========================================

-- 开始事务
BEGIN;

-- 创建Offer域Schema
CREATE SCHEMA IF NOT EXISTS offer;

-- 设置Schema权限

-- ========================================
-- 1. Offer主表
-- ========================================
CREATE TABLE offer.offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "user".users(id) ON DELETE CASCADE,

    -- 基本信息
    title TEXT NOT NULL,
    description TEXT,
    brand_name TEXT,
    brand_logo_url TEXT,
    original_url TEXT NOT NULL,
    final_url TEXT,
    domain TEXT,
    product_category TEXT,

    -- 目标设定
    target_audience JSONB DEFAULT '{}'::jsonb,
    value_proposition TEXT,
    budget_range JSONB DEFAULT '{}'::jsonb,
    timeline JSONB DEFAULT '{}'::jsonb,
    success_metrics JSONB DEFAULT '{}'::jsonb,

    -- 投放设置
    target_countries TEXT[] DEFAULT '{}',
    daily_budget NUMERIC(10,2),
    target_cpc NUMERIC(10,2),
    max_cpc NUMERIC(10,2),
    targeting_keywords TEXT[] DEFAULT '{}',
    negative_keywords TEXT[] DEFAULT '{}',

    -- 状态管理
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'active', 'paused', 'completed', 'cancelled')),
    evaluation_status TEXT DEFAULT 'not_evaluated' CHECK (evaluation_status IN ('not_evaluated', 'evaluating', 'evaluated', 'failed')),
    simulation_status TEXT DEFAULT 'not_simulated' CHECK (simulation_status IN ('not_simulated', 'simulating', 'simulated', 'failed')),
    launch_status TEXT DEFAULT 'not_launched' CHECK (launch_status IN ('not_launched', 'launching', 'launched', 'failed')),

    -- 性能数据
    total_spend NUMERIC(10,2) DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    total_impressions BIGINT DEFAULT 0,
    avg_ctr NUMERIC(5,4) DEFAULT 0,
    avg_cpc NUMERIC(10,2) DEFAULT 0,
    conversion_rate NUMERIC(5,4) DEFAULT 0,
    roi NUMERIC(10,2) DEFAULT 0,

    -- 质量评分
    quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 10),
    relevance_score NUMERIC(5,2) CHECK (relevance_score BETWEEN 0 AND 10),
    performance_grade TEXT CHECK (performance_grade IN ('A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F')),

    -- 系统字段
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT REFERENCES "user".users(id) ON DELETE SET NULL,
    updated_by TEXT REFERENCES "user".users(id),
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- 数据完整性约束
    CONSTRAINT offers_daily_budget_positive CHECK (daily_budget IS NULL OR daily_budget > 0),
    CONSTRAINT offers_cpc_positive CHECK (target_cpc IS NULL OR target_cpc > 0),
    CONSTRAINT offers_spend_non_negative CHECK (total_spend >= 0),
    CONSTRAINT offers_clicks_non_negative CHECK (total_clicks >= 0),
    CONSTRAINT offers_expiry_future CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- ========================================
-- 2. Offer变体表
-- ========================================
CREATE TABLE offer.offer_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES offer.offers(id) ON DELETE CASCADE,
    variant_name TEXT NOT NULL,
    variant_type TEXT NOT NULL CHECK (variant_type IN ('headline', 'description', 'image', 'landing_page', 'call_to_action')),
    content TEXT NOT NULL,
    weight NUMERIC(3,2) DEFAULT 1.0 CHECK (weight > 0),
    is_active BOOLEAN DEFAULT true,
    performance_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,

    -- 唯一约束
    UNIQUE(offer_id, variant_name, variant_type)
);

-- ========================================
-- 3. Offer评估表
-- ========================================
CREATE TABLE offer.offer_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES offer.offers(id) ON DELETE CASCADE,

    -- 评估维度
    market_potential NUMERIC(5,2) CHECK (market_potential BETWEEN 0 AND 10),
    competition_level NUMERIC(5,2) CHECK (competition_level BETWEEN 0 AND 10),
    profitability_score NUMERIC(5,2) CHECK (profitability_score BETWEEN 0 AND 10),
    feasibility_score NUMERIC(5,2) CHECK (feasibility_score BETWEEN 0 AND 10),
    overall_score NUMERIC(5,2) CHECK (overall_score BETWEEN 0 AND 10),

    -- 评估结果
    recommendation TEXT NOT NULL,
    risks JSONB DEFAULT '[]'::jsonb,
    opportunities JSONB DEFAULT '[]'::jsonb,
    next_steps TEXT,

    -- 评估详情
    evaluation_details JSONB DEFAULT '{}'::jsonb,
    external_data_sources JSONB DEFAULT '[]'::jsonb,
    confidence_level NUMERIC(3,2) CHECK (confidence_level BETWEEN 0 AND 1),

    -- 评估元数据
    evaluated_by TEXT REFERENCES "user".users(id),
    evaluation_model TEXT,
    evaluation_version TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ========================================
-- 4. Offer模拟表
-- ========================================
CREATE TABLE offer.offer_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES offer.offers(id) ON DELETE CASCADE,

    -- 模拟参数
    simulation_type TEXT NOT NULL CHECK (simulation_type IN ('performance', 'budget_optimization', 'timing', 'geo_expansion')),
    simulation_parameters JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 模拟结果
    projected_clicks INTEGER,
    projected_conversions INTEGER,
    projected_spend NUMERIC(10,2),
    projected_impressions BIGINT,
    projected_ctr NUMERIC(5,4),
    projected_cpc NUMERIC(10,2),
    projected_conversion_rate NUMERIC(5,4),
    projected_roi NUMERIC(10,2),

    -- 置信区间
    confidence_interval JSONB DEFAULT '{}'::jsonb,
    sensitivity_analysis JSONB DEFAULT '{}'::jsonb,

    -- 模拟状态
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    error_message TEXT,

    -- 模拟元数据
    simulated_by TEXT REFERENCES "user".users(id),
    simulation_duration_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ========================================
-- 5. Offer活动日志表
-- ========================================
CREATE TABLE offer.offer_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES offer.offers(id) ON DELETE CASCADE,

    -- 活动信息
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'created', 'updated', 'submitted', 'approved', 'rejected', 'activated',
        'paused', 'resumed', 'completed', 'cancelled', 'evaluation_requested',
        'simulation_started', 'simulation_completed', 'launch_requested', 'launched'
    )),
    old_status TEXT,
    new_status TEXT,

    -- 活动详情
    description TEXT,
    changes JSONB DEFAULT '{}'::jsonb,
    reason TEXT,

    -- 执行信息
    performed_by TEXT REFERENCES "user".users(id),
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,

    -- 系统信息
    system_action BOOLEAN DEFAULT false,
    batch_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ========================================
-- 6. Offer模板表
-- ========================================
CREATE TABLE offer.offer_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT NOT NULL,

    -- 模板内容
    template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    default_settings JSONB DEFAULT '{}'::jsonb,

    -- 模板属性
    is_public BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    rating NUMERIC(3,2) CHECK (rating BETWEEN 0 AND 5),

    -- 管理字段
    created_by TEXT REFERENCES "user".users(id) ON DELETE SET NULL,
    updated_by TEXT REFERENCES "user".users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ========================================
-- 创建索引
-- ========================================

-- Offer主表索引
CREATE INDEX idx_offer_offers_user_id ON offer.offers(user_id);
CREATE INDEX idx_offer_offers_status ON offer.offers(status, updated_at DESC);
CREATE INDEX idx_offer_offers_category ON offer.offers(product_category, status);
CREATE INDEX idx_offer_offers_brand ON offer.offers(brand_name, created_at DESC);
CREATE INDEX idx_offer_offers_performance ON offer.offers(performance_grade, status);
CREATE INDEX idx_offer_offers_created_at ON offer.offers(created_at DESC);
CREATE INDEX idx_offer_offers_expires_at ON offer.offers(expires_at) WHERE expires_at IS NOT NULL;

-- Offer变体表索引
CREATE INDEX idx_offer_variants_offer ON offer.offer_variants(offer_id);
CREATE INDEX idx_offer_variants_type ON offer.offer_variants(variant_type, is_active);
CREATE INDEX idx_offer_variants_weight ON offer.offer_variants(weight DESC) WHERE is_active = true;

-- Offer评估表索引
CREATE INDEX idx_offer_evaluations_offer ON offer.offer_evaluations(offer_id);
CREATE INDEX idx_offer_evaluations_score ON offer.offer_evaluations(overall_score DESC);
CREATE INDEX idx_offer_evaluations_evaluated ON offer.offer_evaluations(evaluated_by, created_at DESC);

-- Offer模拟表索引
CREATE INDEX idx_offer_simulations_offer ON offer.offer_simulations(offer_id);
CREATE INDEX idx_offer_simulations_type ON offer.offer_simulations(simulation_type, status);
CREATE INDEX idx_offer_simulations_status ON offer.offer_simulations(status, created_at DESC);

-- Offer活动日志索引
CREATE INDEX idx_offer_activity_log_offer ON offer.offer_activity_log(offer_id, created_at DESC);
CREATE INDEX idx_offer_activity_log_type ON offer.offer_activity_log(activity_type, created_at DESC);
CREATE INDEX idx_offer_activity_log_performed ON offer.offer_activity_log(performed_by, created_at DESC);

-- Offer模板表索引
CREATE INDEX idx_offer_templates_category ON offer.offer_templates(category, is_active);
CREATE INDEX idx_offer_templates_public ON offer.offer_templates(is_public, rating DESC);
CREATE INDEX idx_offer_templates_usage ON offer.offer_templates(usage_count DESC);

-- ========================================
-- 创建触发器和函数
-- ========================================

-- 更新时间戳触发器函数
CREATE OR REPLACE FUNCTION offer.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为主要表创建更新时间戳触发器
CREATE TRIGGER update_offers_updated_at
    BEFORE UPDATE ON offer.offers
    FOR EACH ROW
    EXECUTE FUNCTION offer.update_updated_at_column();

CREATE TRIGGER update_offer_variants_updated_at
    BEFORE UPDATE ON offer.offer_variants
    FOR EACH ROW
    EXECUTE FUNCTION offer.update_updated_at_column();

CREATE TRIGGER update_offer_evaluations_updated_at
    BEFORE UPDATE ON offer.offer_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION offer.update_updated_at_column();

CREATE TRIGGER update_offer_templates_updated_at
    BEFORE UPDATE ON offer.offer_templates
    FOR EACH ROW
    EXECUTE FUNCTION offer.update_updated_at_column();

-- Offer活动日志自动记录触发器
CREATE OR REPLACE FUNCTION offer.log_offer_activity()
RETURNS TRIGGER AS $$
DECLARE
    activity_desc TEXT;
    changes_json JSONB;
BEGIN
    -- 记录状态变更
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        activity_desc := FORMAT('Offer status changed from %s to %s', OLD.status, NEW.status);
        changes_json := jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status);

        INSERT INTO offer.offer_activity_log (
            offer_id, activity_type, old_status, new_status,
            description, changes, performed_by, created_at
        ) VALUES (
            NEW.id, 'updated', OLD.status, NEW.status,
            activity_desc, changes_json, NEW.updated_by, now()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_offer_activity_trigger
    AFTER UPDATE ON offer.offers
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.updated_by IS DISTINCT FROM NEW.updated_by)
    EXECUTE FUNCTION offer.log_offer_activity();

-- 模板使用计数触发器
CREATE OR REPLACE FUNCTION offer.increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- 当offer使用模板创建时，增加模板使用计数
    IF NEW.metadata ? 'template_id' THEN
        UPDATE offer.offer_templates
        SET usage_count = usage_count + 1,
            updated_at = now()
        WHERE id = (NEW.metadata->>'template_id')::UUID;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_template_usage_trigger
    AFTER INSERT ON offer.offers
    FOR EACH ROW
    EXECUTE FUNCTION offer.increment_template_usage();

-- ========================================
-- 创建视图
-- ========================================

-- Offer概览视图
CREATE OR REPLACE VIEW offer.offer_overview AS
SELECT
    o.id,
    o.title,
    o.brand_name,
    o.product_category,
    o.status,
    o.performance_grade,
    o.total_spend,
    o.total_clicks,
    o.total_conversions,
    o.avg_ctr,
    o.avg_cpc,
    o.roi,
    o.quality_score,
    u.name as user_name,
    u.email as user_email,
    -- 评估信息
    ev.overall_score as evaluation_score,
    ev.recommendation as latest_recommendation,
    -- 模拟信息
    sim.projected_roi as best_projected_roi,
    sim.simulation_type as best_simulation_type,
    -- 活动统计
    activity_count,
    last_activity,
    o.created_at,
    o.updated_at
FROM offer.offers o
LEFT JOIN "user".users u ON o.user_id = u.id
LEFT JOIN LATERAL (
    SELECT e.*
    FROM offer.offer_evaluations e
    WHERE e.offer_id = o.id
    ORDER BY e.created_at DESC
    LIMIT 1
) ev ON true
LEFT JOIN LATERAL (
    SELECT s.*
    FROM offer.offer_simulations s
    WHERE s.offer_id = o.id AND s.status = 'completed'
    ORDER BY s.created_at DESC
    LIMIT 1
) sim ON true
LEFT JOIN (
    SELECT
        offer_id,
        COUNT(*) as activity_count,
        MAX(created_at) as last_activity
    FROM offer.offer_activity_log
    GROUP BY offer_id
) activity ON o.id = activity.offer_id
ORDER BY o.updated_at DESC;

-- Offer性能统计视图
CREATE OR REPLACE VIEW offer.offer_performance_stats AS
SELECT
    DATE_TRUNC('week', created_at) as week,
    product_category,
    COUNT(*) as total_offers,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_offers,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_offers,
    AVG(quality_score) as avg_quality_score,
    AVG(roi) as avg_roi,
    SUM(total_spend) as total_spend,
    SUM(total_clicks) as total_clicks,
    SUM(total_conversions) as total_conversions,
    AVG(avg_ctr) as avg_ctr,
    COUNT(CASE WHEN performance_grade IN ('A+', 'A', 'B+') THEN 1 END) as high_performing_offers
FROM offer.offers
WHERE created_at >= CURRENT_DATE - INTERVAL '12 weeks'
GROUP BY DATE_TRUNC('week', created_at), product_category
ORDER BY week DESC, product_category;

-- ========================================
-- 初始化数据
-- ========================================

-- 插入默认Offer模板
INSERT INTO offer.offer_templates (name, description, category, template_data, default_settings, is_public, created_by) VALUES
('电商产品推广模板', '适用于电商网站的产品推广Offer模板', 'ecommerce',
    '{"title": "【品牌名】【产品类别】推广", "description": "突出产品特色和卖点", "brand_name": "示例品牌", "product_category": "电子产品", "target_audience": {"age_range": "18-45", "interests": ["科技", "购物"]}}',
    '{"daily_budget": 100, "target_cpc": 1.5, "target_countries": ["US", "CA", "UK"]}',
    true, NULL),
('本地服务推广模板', '适用于本地服务提供商的推广模板', 'local_service',
    '{"title": "【城市名】【服务类型】专业服务", "description": "强调专业性和本地优势", "brand_name": "示例公司", "product_category": "本地服务", "target_audience": {"location": "本地", "needs": ["服务需求"]}}',
    '{"daily_budget": 50, "target_cpc": 2.0, "target_countries": ["US"]}',
    true, NULL),
('B2B企业服务模板', '适用于B2B企业服务推广的模板', 'b2b',
    '{"title": "【企业级】【服务类型】解决方案", "description": "突出企业级价值和ROI", "brand_name": "示例企业", "product_category": "企业服务", "target_audience": {"company_size": "100-1000", "industry": ["科技", "金融"]}}',
    '{"daily_budget": 200, "target_cpc": 5.0, "target_countries": ["US", "CA", "UK", "AU"]}',
    true, NULL)
ON CONFLICT (name) DO NOTHING;

-- ========================================
-- 提交事务
-- ========================================

COMMIT;

-- ========================================
-- 验证脚本执行结果
-- ========================================

-- 验证Schema创建
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'offer') THEN
        RAISE NOTICE '✅ offer schema created successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to create offer schema';
    END IF;
END $$;

-- 验证表创建
DO $$
BEGIN
    DECLARE table_count INTEGER;
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'offer'
    AND table_type = 'BASE TABLE';

    IF table_count = 6 THEN
        RAISE NOTICE '✅ All offer tables created successfully (6 tables)';
    ELSE
        RAISE EXCEPTION '❌ Expected 6 tables, found % tables', table_count;
    END IF;
END $$;

