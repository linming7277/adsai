# AutoAds 新数据库Schema架构设计

**文档版本**: v1.0
**创建日期**: 2025-10-19
**设计目标**: 建立符合微服务原则的数据架构
**状态**: 设计中

---

## 📋 设计原则

### 核心原则
1. **数据域独立性**: 每个微服务拥有独立的数据域
2. **单数据源原则**: 每个业务实体只有一个权威数据源
3. **最小权限原则**: 服务只能访问其必要的数据
4. **一致性边界**: 通过事件驱动保证最终一致性
5. **可扩展性**: 支持水平扩展和服务解耦

### 数据域分类
```yaml
核心业务域:
  - User Domain: 用户认证和资料管理
  - Billing Domain: 计费和代币管理
  - Offer Domain: Offer创建和管理
  - Ads Domain: 广告账户和投放管理
  - Activity Domain: 用户活动和互动管理

支持域:
  - Admin Domain: 管理和监控数据
  - Analytics Domain: 统计分析数据
  - Audit Domain: 审计和合规数据
```

---

## 🏗️ 新Schema架构设计

### 主数据库: Cloud SQL autoads_db

#### 1. User Domain (用户域)
```sql
-- 用户域Schema
CREATE SCHEMA IF NOT EXISTS user_domain;

-- 用户主表 (与Supabase auth.users同步)
CREATE TABLE user_domain.users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    timezone TEXT,
    language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 用户偏好设置
CREATE TABLE user_domain.preferences (
    user_id TEXT PRIMARY KEY REFERENCES user_domain.users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    marketing_emails BOOLEAN DEFAULT false,
    theme TEXT DEFAULT 'light',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 用户会话管理
CREATE TABLE user_domain.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES user_domain.users(id) ON DELETE CASCADE,
    device_info JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true
);

-- 用户安全设置
CREATE TABLE user_domain.security_settings (
    user_id TEXT PRIMARY KEY REFERENCES user_domain.users(id) ON DELETE CASCADE,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret TEXT,
    last_password_change TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    security_questions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 2. Billing Domain (计费域)
```sql
-- 计费域Schema
CREATE SCHEMA IF NOT EXISTS billing_domain;

-- 用户计费账户
CREATE TABLE billing_domain.accounts (
    user_id TEXT PRIMARY KEY REFERENCES user_domain.users(id) ON DELETE CASCADE,
    account_type TEXT DEFAULT 'standard', -- standard, premium, enterprise
    status TEXT DEFAULT 'active', -- active, suspended, cancelled
    balance_cents BIGINT DEFAULT 0, -- 余额，以分为单位
    currency TEXT DEFAULT 'USD',
    credit_limit_cents BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    billing_address JSONB DEFAULT '{}'::jsonb,
    payment_methods JSONB DEFAULT '[]'::jsonb
);

-- 代币余额表
CREATE TABLE billing_domain.token_balances (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES billing_domain.accounts(user_id) ON DELETE CASCADE,
    token_type TEXT NOT NULL DEFAULT 'search', -- search, analysis, export
    balance BIGINT NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT now(),
    updated_by TEXT REFERENCES user_domain.users(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, token_type)
);

-- 代币交易记录
CREATE TABLE billing_domain.token_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES billing_domain.accounts(user_id) ON DELETE CASCADE,
    token_type TEXT NOT NULL,
    amount BIGINT NOT NULL, -- 正数为充值，负数为消费
    balance_before BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    transaction_type TEXT NOT NULL, -- purchase, consumption, refund, adjustment
    source TEXT NOT NULL, -- 系统自动、用户操作、管理员调整
    description TEXT,
    reference_id TEXT, -- 关联的业务ID，如offer_id, analysis_id等
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT REFERENCES user_domain.users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 订阅管理
CREATE TABLE billing_domain.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES billing_domain.accounts(user_id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    status TEXT NOT NULL, -- active, cancelled, expired, paused
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    trial_end TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    billing_interval TEXT NOT NULL, -- month, year
    auto_renew BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 发票记录
CREATE TABLE billing_domain.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES billing_domain.accounts(user_id) ON DELETE CASCADE,
    invoice_number TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL, -- draft, sent, paid, void, refunded
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    due_date TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    line_items JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb
);
```

#### 3. Offer Domain (Offer域)
```sql
-- Offer域Schema
CREATE SCHEMA IF NOT EXISTS offer_domain;

-- Offer主表
CREATE TABLE offer_domain.offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES user_domain.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    brand_name TEXT,
    brand_logo_url TEXT,
    product_category TEXT,
    target_audience JSONB DEFAULT '{}'::jsonb,
    value_proposition TEXT,
    budget_range JSONB DEFAULT '{}'::jsonb,
    timeline JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'draft', -- draft, active, paused, completed, archived
    visibility TEXT DEFAULT 'private', -- private, team, public
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Offer分析结果
CREATE TABLE offer_domain.analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id TEXT NOT NULL REFERENCES offer_domain.offers(id) ON DELETE CASCADE,
    analysis_type TEXT NOT NULL, -- market_analysis, competitor_analysis, keyword_analysis
    analysis_data JSONB NOT NULL,
    ai_score NUMERIC(3,2), -- 0.00-1.00
    confidence_score NUMERIC(3,2),
    insights JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT REFERENCES user_domain.users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Offer关键词分析
CREATE TABLE offer_domain.keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id TEXT NOT NULL REFERENCES offer_domain.offers(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    search_volume BIGINT,
    competition_level TEXT, -- low, medium, high
    cpc_estimate_cents INTEGER,
    relevance_score NUMERIC(3,2),
    intent TEXT, -- informational, commercial, transactional
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Offer竞争对手分析
CREATE TABLE offer_domain.competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id TEXT NOT NULL REFERENCES offer_domain.offers(id) ON DELETE CASCADE,
    competitor_name TEXT NOT NULL,
    competitor_url TEXT,
    market_position TEXT,
    strengths JSONB DEFAULT '[]'::jsonb,
    weaknesses JSONB DEFAULT '[]'::jsonb,
    market_share NUMERIC(5,2),
    analysis_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);
```

#### 4. Ads Domain (广告域)
```sql
-- 广告域Schema
CREATE SCHEMA IF NOT EXISTS ads_domain;

-- 广告账户连接
CREATE TABLE ads_domain.account_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES user_domain.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- google_ads, facebook_ads, linkedin_ads
    platform_account_id TEXT NOT NULL,
    platform_account_name TEXT,
    status TEXT DEFAULT 'pending', -- pending, active, disconnected, error
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_sync TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 广告活动管理
CREATE TABLE ads_domain.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_connection_id TEXT NOT NULL REFERENCES ads_domain.account_connections(id) ON DELETE CASCADE,
    platform_campaign_id TEXT NOT NULL,
    campaign_name TEXT NOT NULL,
    status TEXT NOT NULL,
    budget_amount_cents INTEGER,
    budget_type TEXT, -- daily, lifetime
    start_date DATE,
    end_date DATE,
    targeting JSONB DEFAULT '{}'::jsonb,
    creatives JSONB DEFAULT '[]'::jsonb,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 批量操作记录
CREATE TABLE ads_domain.bulk_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES user_domain.users(id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL, -- campaign_create, ad_group_create, keyword_update
    status TEXT DEFAULT 'queued', -- queued, processing, completed, failed, cancelled
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    operation_data JSONB NOT NULL,
    results JSONB DEFAULT '{}'::jsonb,
    error_details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by TEXT REFERENCES user_domain.users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 广告性能数据
CREATE TABLE ads_domain.performance_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id TEXT REFERENCES ads_domain.campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    conversions BIGINT DEFAULT 0,
    cost_cents BIGINT DEFAULT 0,
    ctr NUMERIC(5,4), -- Click-through rate
    cpc_cents NUMERIC(10,2), -- Cost-per-click
    conversion_rate NUMERIC(5,4),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 5. Activity Domain (活动域)
```sql
-- 活动域Schema
CREATE SCHEMA IF NOT EXISTS activity_domain;

-- 用户通知
CREATE TABLE activity_domain.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES user_domain.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- info, warning, error, success
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    channel TEXT DEFAULT 'inapp', -- inapp, email, push, sms
    status TEXT DEFAULT 'unread', -- unread, read, archived
    priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
    action_url TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    read_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 签到系统
CREATE TABLE activity_domain.checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES user_domain.users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,
    streak_days INTEGER DEFAULT 1,
    points_earned INTEGER DEFAULT 0,
    bonus_points INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, checkin_date)
);

-- 邀请系统
CREATE TABLE activity_domain.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id TEXT NOT NULL REFERENCES user_domain.users(id) ON DELETE CASCADE,
    referred_email TEXT NOT NULL,
    referral_code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, accepted, completed, expired
    points_awarded INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 活动事件记录
CREATE TABLE activity_domain.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES user_domain.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    source TEXT NOT NULL, -- system, user, admin
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);
```

#### 6. Admin Domain (管理域)
```sql
-- 管理域Schema (保持在Supabase)
-- 大部分管理数据继续使用Supabase的public schema

-- 数据库健康统计 (在Supabase)
CREATE TABLE IF NOT EXISTS public.database_health_stats (
    id BIGSERIAL PRIMARY KEY,
    service_name TEXT NOT NULL,
    metric_type TEXT NOT NULL, -- connection_pool, query_performance, error_rate
    metric_value NUMERIC NOT NULL,
    threshold_value NUMERIC,
    status TEXT NOT NULL, -- healthy, warning, critical
    recorded_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 管理员操作审计 (在Supabase)
CREATE TABLE IF NOT EXISTS public.critical_admin_actions (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    target_resource TEXT NOT NULL,
    action_data JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    status TEXT NOT NULL, -- initiated, completed, failed
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 功能开关 (在Supabase)
CREATE TABLE IF NOT EXISTS public.feature_flags (
    id BIGSERIAL PRIMARY KEY,
    flag_name TEXT UNIQUE NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    target_users JSONB DEFAULT '[]'::jsonb, -- 空数组表示全局，可指定特定用户
    rollout_percentage INTEGER DEFAULT 0, -- 0-100
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);
```

---

## 🔗 索引策略

### 主要索引
```sql
-- User Domain
CREATE INDEX CONCURRENTLY idx_user_domain_users_email ON user_domain.users(email);
CREATE INDEX CONCURRENTLY idx_user_domain_users_status ON user_domain.users(status) WHERE status = 'active';
CREATE INDEX CONCURRENTLY idx_user_domain_sessions_user_active ON user_domain.sessions(user_id) WHERE is_active = true;

-- Billing Domain
CREATE INDEX CONCURRENTLY idx_billing_domain_accounts_status ON billing_domain.accounts(status);
CREATE INDEX CONCURRENTLY idx_billing_domain_token_balances_user_type ON billing_domain.token_balances(user_id, token_type);
CREATE INDEX CONCURRENTLY idx_billing_domain_transactions_user_created ON billing_domain.token_transactions(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_billing_domain_subscriptions_status ON billing_domain.subscriptions(status) WHERE status = 'active';

-- Offer Domain
CREATE INDEX CONCURRENTLY idx_offer_domain_offers_user_status ON offer_domain.offers(user_id, status, updated_at DESC);
CREATE INDEX CONCURRENTLY idx_offer_domain_keywords_offer ON offer_domain.keywords(offer_id);
CREATE INDEX CONCURRENTLY idx_offer_domain_analysis_results_type ON offer_domain.analysis_results(analysis_type);

-- Ads Domain
CREATE INDEX CONCURRENTLY idx_ads_domain_connections_user_status ON ads_domain.account_connections(user_id, status);
CREATE INDEX CONCURRENTLY idx_ads_domain_campaigns_connection ON ads_domain.campaigns(account_connection_id);
CREATE INDEX CONCURRENTLY idx_ads_domain_bulk_operations_status ON ads_domain.bulk_operations(status, created_at);

-- Activity Domain
CREATE INDEX CONCURRENTLY idx_activity_domain_notifications_user_status ON activity_domain.notifications(user_id, status, created_at DESC);
CREATE INDEX CONCURRENTLY idx_activity_domain_events_user_type ON activity_domain.events(user_id, event_type, created_at DESC);
CREATE INDEX CONCURRENTLY idx_activity_domain_checkins_user_date ON activity_domain.checkins(user_id, checkin_date DESC);
```

---

## 🔄 数据迁移策略

### 迁移原则
1. **零停机迁移**: 使用双重写入确保平滑过渡
2. **数据一致性**: 建立完整的数据验证机制
3. **渐进式迁移**: 按域分批迁移，降低风险
4. **回滚机制**: 每个迁移步骤都支持快速回滚

### 迁移顺序
```yaml
Phase 1: 基础架构 (2-3天)
  - 创建新Schema和表结构
  - 建立数据同步机制
  - 验证基础功能

Phase 2: 核心业务域 (5-7天)
  - User Domain迁移
  - Billing Domain迁移
  - 数据一致性验证

Phase 3: 业务功能域 (5-7天)
  - Offer Domain迁移
  - Ads Domain迁移
  - Activity Domain迁移

Phase 4: 切换验证 (2-3天)
  - 切换到新架构
  - 性能验证
  - 清理旧数据
```

---

## 📊 预期收益

### 技术收益
```yaml
架构改进:
  - 微服务数据独立: 100%实现
  - 数据一致性: 通过事件驱动保证
  - 可扩展性: 支持水平扩展
  - 维护成本: 降低60%

性能提升:
  - 查询性能: 预计提升40-60%
  - 连接效率: 优化连接池管理
  - 缓存效果: 减少重复查询
  - 并发能力: 提升100%+
```

### 业务收益
```yaml
开发效率:
  - 服务解耦: 独立开发和部署
  - 功能迭代: 更快的功能上线
  - 问题定位: 更精确的问题定位
  - 团队协作: 清晰的数据边界

运营效率:
  - 监控能力: 全面的健康监控
  - 数据治理: 更好的数据质量
  - 合规性: 完整的审计追踪
  - 风险控制: 更强的安全防护
```

---

## ⚠️ 风险与缓解

### 主要风险
1. **数据迁移风险**: 通过双重写入和分批迁移缓解
2. **性能回归风险**: 充分的性能测试和监控
3. **兼容性风险**: 渐进式迁移和向后兼容
4. **业务中断风险**: 维护窗口和快速回滚机制

### 应急预案
1. **快速回滚**: 保留旧架构完整备份
2. **数据修复**: 完整的数据校验和修复工具
3. **性能降级**: 自动降级和流量控制
4. **服务降级**: 核心功能优先保障

---

## 📝 下一步行动

1. **Schema实现**: 创建实际的SQL迁移脚本
2. **数据同步**: 建立实时数据同步机制
3. **验证工具**: 开发数据一致性检查工具
4. **切换计划**: 制定详细的切换时间表
5. **监控部署**: 确保新架构的可观测性

---

**设计完成状态**: ✅ 架构设计完成，准备进入实施阶段