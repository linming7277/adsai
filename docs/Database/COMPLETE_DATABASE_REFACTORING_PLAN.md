# AutoAds 数据库彻底重构方案

**重要信息**: 项目未上线，可进行彻底重构
**重构策略**: 清空重建，无需考虑历史数据兼容性
**预期完成时间**: 2-3周
**重构目标**: 从零构建完美的数据库架构

---

## 🎯 **重构原则和优势**

### **核心原则**
1. **清空重建**: 删除所有现有表和数据，从零开始
2. **微服务边界**: 严格按业务域分离数据
3. **无历史包袱**: 无需考虑向后兼容
4. **最优设计**: 从第一行代码就是最佳实践
5. **统一标准**: 所有服务使用相同的数据库访问模式

### **重构优势**
```yaml
数据迁移:
  旧方案: 复杂的数据迁移脚本，风险高
  新方案: 直接清空重建，风险为零

架构设计:
  旧方案: 受现有结构限制
  新方案: 完全自由的理想架构

性能优化:
  旧方案: 受历史数据约束
  新方案: 从零开始的最优索引策略

开发效率:
  旧方案: 需要维护兼容性
  新方案: 统一标准，简化开发
```

---

## 🏗️ **全新数据库架构设计**

### **数据库分布策略**

```yaml
Supabase PostgreSQL:
  用途: 用户认证和轻量级数据
  优势: 内置认证，实时功能
  schema:
    - auth.users (用户认证主表)
    - public.user_profiles (用户资料)
    - public.user_subscriptions (订阅状态)
    - public.feature_flags (功能开关)

GCP Cloud SQL:
  用途: 核心业务数据和重量级操作
  优势: 高性能，企业级
  数据库分布:
    - autoads_db (主应用数据库)
    - 6个独��schema对应6个业务域
```

### **六大业务域架构**

#### **1. 用户域 (User Domain)**
```sql
-- 在 Supabase public schema
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    plan_type TEXT NOT NULL, -- 'free', 'premium', 'enterprise'
    status TEXT NOT NULL, -- 'active', 'cancelled', 'expired'
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引策略
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
```

#### **2. Offer域 (Offer Domain)**
```sql
-- 在 Cloud SQL autoads_db 中
CREATE SCHEMA offer_domain;

CREATE TABLE offer_domain.offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- 关联用户域
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'paused', 'archived'
    category TEXT,
    tags TEXT[],
    budget_cents INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE offer_domain.offer_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES offer_domain.offers(id),
    event_date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    revenue_cents INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引策略
CREATE INDEX idx_offers_user_id ON offer_domain.offers(user_id);
CREATE INDEX idx_offers_status ON offer_domain.offers(status);
CREATE INDEX idx_offers_category ON offer_domain.offers(category);
CREATE INDEX idx_offers_created_at ON offer_domain.offers(created_at);
CREATE INDEX idx_offer_analytics_offer_id ON offer_domain.offer_analytics(offer_id);
CREATE INDEX idx_offer_analytics_date ON offer_domain.offer_analytics(event_date);
```

#### **3. 计费域 (Billing Domain)**
```sql
-- 在 Cloud SQL autoads_db 中
CREATE SCHEMA billing_domain;

CREATE TABLE billing_domain.user_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- 关联用户域
    balance_cents INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'active', -- 'active', 'suspended', 'closed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE billing_domain.token_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    amount_cents INTEGER NOT NULL, -- 正数为充值，负数为消费
    transaction_type TEXT NOT NULL, -- 'purchase', 'consumption', 'refund', 'bonus'
    reference_id TEXT, -- 关联的订单或操作ID
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE billing_domain.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    plan_type TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    billing_cycle TEXT NOT NULL, -- 'monthly', 'yearly'
    status TEXT NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引策略
CREATE INDEX idx_user_accounts_user_id ON billing_domain.user_accounts(user_id);
CREATE INDEX idx_token_transactions_user_id ON billing_domain.token_transactions(user_id);
CREATE INDEX idx_token_transactions_created_at ON billing_domain.token_transactions(created_at);
CREATE INDEX idx_subscriptions_user_id ON billing_domain.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON billing_domain.subscriptions(status);
```

#### **4. 广告域 (Ads Domain)**
```sql
-- 在 Cloud SQL autoads_db 中
CREATE SCHEMA ads_domain;

CREATE TABLE ads_domain.ad_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    platform TEXT NOT NULL, -- 'google_ads', 'facebook', 'tiktok'
    account_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- 'active', 'inactive', 'error'
    credentials JSONB, -- 加密存储的API凭证
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ads_domain.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_account_id UUID NOT NULL REFERENCES ads_domain.ad_accounts(id),
    platform_campaign_id TEXT NOT NULL,
    campaign_name TEXT NOT NULL,
    status TEXT NOT NULL,
    budget_cents INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引策略
CREATE INDEX idx_ad_accounts_user_id ON ads_domain.ad_accounts(user_id);
CREATE INDEX idx_ad_accounts_platform ON ads_domain.ad_accounts(platform);
CREATE INDEX idx_campaigns_ad_account_id ON ads_domain.campaigns(ad_account_id);
CREATE INDEX idx_campaigns_status ON ads_domain.campaigns(status);
```

#### **5. 评估域 (Evaluation Domain)**
```sql
-- 在 Cloud SQL autoads_db 中
CREATE SCHEMA evaluation_domain;

CREATE TABLE evaluation_domain.evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    offer_id UUID, -- 可选，关联具体Offer
    url TEXT NOT NULL,
    evaluation_type TEXT NOT NULL, -- 'seo', 'performance', 'content'
    score DECIMAL(5,2),
    metrics JSONB, -- 评估指标详情
    recommendations JSONB, -- 改进建议
    status TEXT DEFAULT 'completed', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE evaluation_domain.evaluation_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    url TEXT NOT NULL,
    priority INTEGER DEFAULT 1, -- 1=低, 2=中, 3=高
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- 索引策略
CREATE INDEX idx_evaluations_user_id ON evaluation_domain.evaluations(user_id);
CREATE INDEX idx_evaluations_offer_id ON evaluation_domain.evaluations(offer_id);
CREATE INDEX idx_evaluations_type ON evaluation_domain.evaluations(evaluation_type);
CREATE INDEX idx_evaluations_status ON evaluation_domain.evaluations(status);
CREATE INDEX idx_evaluation_queues_status ON evaluation_domain.evaluation_queues(status);
CREATE INDEX idx_evaluation_queues_priority ON evaluation_domain.evaluation_queues(priority);
```

#### **6. 活动域 (Activity Domain)**
```sql
-- 在 Cloud SQL autoads_db 中
CREATE SCHEMA activity_domain;

CREATE TABLE activity_domain.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type TEXT NOT NULL, -- 'info', 'warning', 'success', 'error'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB, -- 额外数据
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE activity_domain.user_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    event_type TEXT NOT NULL, -- 'login', 'offer_created', 'campaign_updated'
    event_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE activity_domain.checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    checkin_date DATE NOT NULL,
    streak_days INTEGER DEFAULT 1,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引策略
CREATE INDEX idx_user_notifications_user_id ON activity_domain.user_notifications(user_id);
CREATE INDEX idx_user_notifications_read_at ON activity_domain.user_notifications(read_at);
CREATE INDEX idx_user_notifications_created_at ON activity_domain.user_notifications(created_at);
CREATE INDEX idx_user_events_user_id ON activity_domain.user_events(user_id);
CREATE INDEX idx_user_events_type ON activity_domain.user_events(event_type);
CREATE INDEX idx_user_events_created_at ON activity_domain.user_events(created_at);
CREATE INDEX idx_checkins_user_id ON activity_domain.checkins(user_id);
CREATE INDEX idx_checkins_date ON activity_domain.checkins(checkin_date);
```

#### **7. 推荐域 (Recommendation Domain) - 新增**
```sql
-- 在 Cloud SQL autoads_db 中
CREATE SCHEMA recommendation_domain;

CREATE TABLE recommendation_domain.user_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    recommendation_type TEXT NOT NULL, -- 'offer', 'content', 'campaign'
    item_id UUID NOT NULL, -- 推荐的Offer或其他内容ID
    score DECIMAL(5,4) NOT NULL, -- 推荐分数
    algorithm_version TEXT NOT NULL, -- 算法版本
    context JSONB, -- 推荐上下文信息
    status TEXT DEFAULT 'active', -- 'active', 'clicked', 'dismissed', 'expired'
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE recommendation_domain.recommendation_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    recommendation_id UUID NOT NULL REFERENCES recommendation_domain.user_recommendations(id),
    feedback_type TEXT NOT NULL, -- 'click', 'like', 'dislike', 'share', 'convert'
    feedback_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE recommendation_domain.recommendation_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    model_type TEXT NOT NULL, -- 'collaborative', 'content_based', 'hybrid'
    parameters JSONB,
    performance_metrics JSONB,
    status TEXT DEFAULT 'active', -- 'active', 'training', 'deprecated'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引策略
CREATE INDEX idx_user_recommendations_user_id ON recommendation_domain.user_recommendations(user_id);
CREATE INDEX idx_user_recommendations_type ON recommendation_domain.user_recommendations(recommendation_type);
CREATE INDEX idx_user_recommendations_score ON recommendation_domain.user_recommendations(score DESC);
CREATE INDEX idx_user_recommendations_status ON recommendation_domain.user_recommendations(status);
CREATE INDEX idx_recommendation_feedback_user_id ON recommendation_domain.recommendation_feedback(user_id);
CREATE INDEX idx_recommendation_feedback_recommendation_id ON recommendation_domain.recommendation_feedback(recommendation_id);
CREATE INDEX idx_recommendation_models_status ON recommendation_domain.recommendation_models(status);
```

#### **8. 事件投影域 (Event Projection Domain) - 新增**
```sql
-- 在 Cloud SQL autoads_db 中
CREATE SCHEMA event_projection_domain;

CREATE TABLE event_projection_domain.event_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id TEXT NOT NULL, -- 事件流标识
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    event_version INTEGER NOT NULL,
    causation_id UUID, -- 因果事件ID
    correlation_id UUID, -- 关联ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE event_projection_domain.projections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projection_name TEXT NOT NULL,
    projection_key TEXT NOT NULL,
    projection_data JSONB NOT NULL,
    last_event_id UUID,
    version INTEGER NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE event_projection_domain.projection_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projection_name TEXT NOT NULL,
    projection_key TEXT NOT NULL,
    snapshot_data JSONB NOT NULL,
    event_count INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引策略
CREATE INDEX idx_event_streams_stream_id ON event_projection_domain.event_streams(stream_id);
CREATE INDEX idx_event_streams_type ON event_projection_domain.event_streams(event_type);
CREATE INDEX idx_event_streams_created_at ON event_projection_domain.event_streams(created_at);
CREATE INDEX idx_projections_name_key ON event_projection_domain.projections(projection_name, projection_key);
CREATE INDEX idx_projections_updated_at ON event_projection_domain.projections(updated_at);
CREATE INDEX idx_projection_snapshots_name ON event_projection_domain.projection_snapshots(projection_name);
```

#### **9. 批处理域 (Batch Processing Domain) - 新增**
```sql
-- 在 Cloud SQL autoads_db 中
CREATE SCHEMA batch_processing_domain;

CREATE TABLE batch_processing_domain.batch_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    job_type TEXT NOT NULL, -- 'data_sync', 'analytics', 'cleanup', 'export'
    job_config JSONB,
    status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    priority INTEGER DEFAULT 5, -- 1-10, 1为最高优先级
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE batch_processing_domain.job_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES batch_processing_domain.batch_jobs(id),
    execution_number INTEGER NOT NULL,
    status TEXT NOT NULL,
    progress INTEGER DEFAULT 0, -- 0-100
    processed_records INTEGER DEFAULT 0,
    total_records INTEGER DEFAULT 0,
    execution_logs JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE batch_processing_domain.job_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_execution_id UUID NOT NULL REFERENCES batch_processing_domain.job_executions(id),
    result_type TEXT NOT NULL, -- 'summary', 'details', 'errors', 'statistics'
    result_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引策略
CREATE INDEX idx_batch_jobs_status ON batch_processing_domain.batch_jobs(status);
CREATE INDEX idx_batch_jobs_type ON batch_processing_domain.batch_jobs(job_type);
CREATE INDEX idx_batch_jobs_scheduled_at ON batch_processing_domain.batch_jobs(scheduled_at);
CREATE INDEX idx_batch_jobs_priority ON batch_processing_domain.batch_jobs(priority DESC);
CREATE INDEX idx_job_executions_job_id ON batch_processing_domain.job_executions(job_id);
CREATE INDEX idx_job_executions_status ON batch_processing_domain.job_executions(status);
CREATE INDEX idx_job_results_execution_id ON batch_processing_domain.job_results(job_execution_id);
```

---

## 🔄 **重构实施计划**

### **Phase 1: 准备和备份 (第1天)**

```yaml
上午:
  - 备份当前所有数据库 (以防万一)
  - 创建重构分支
  - 准备迁移脚本

下午:
  - 通知所有开发人员
  - 冻结数据库写入
  - 最终数据备份
```

### **Phase 2: 彻底清空和重建 (第2-3天)**

```yaml
第2天:
  - 清空所有现有表和数据
  - 创建新的schema结构
  - 实施所有6个业务域
  - 创建所有索引和约束

第3天:
  - 验证schema完整性
  - 测试跨域查询
  - 优化性能
```

### **Phase 3: 服务适配器统一 (第4-5天)**

```yaml
服务更新优先级:
  1. user-service (用户域)
  2. offer-service (Offer域)
  3. billing-service (计费域)
  4. adscenter-service (广告域)
  5. siterank-service (评估域)
  6. useractivity-service (活动域)

每个服务更新内容:
  - 删除运行时DDL代码
  - 实现db-admin适配器
  - 更新数据模型
  - 编写单元测试
```

### **Phase 4: 测试和验证 (第6-7天)**

```yaml
集成测试:
  - 跨服务数据访问测试
  - API接口测试
  - 性能基准测试
  - 安全性测试

用户验收测试:
  - 核心功能测试
  - 用户体验测试
  - 边界情况测试
```

### **Phase 5: 性能优化 (第8-10天)**

```yaml
Redis缓存集成:
  - 用户信息缓存 (TTL: 15分钟)
  - Offer列表缓存 (TTL: 5分钟)
  - 计费余额缓存 (TTL: 2分钟)
  - 评估结果缓存 (TTL: 1小时)

数据库优化:
  - 查询性能分析
  - 索引优化调整
  - 连接池配置
  - 监控指标设置
```

---

## 🛡️ **安全和合规**

### **数据安全**
```yaml
访问控制:
  - 微服务独立数据库用户
  - 最小权限原则
  - 网络隔离

数据加密:
  - 传输加密 (TLS)
  - 敏感字段加密存储
  - 备份数据加密

审计日志:
  - 完整的数据访问日志
  - 变更操作记录
  - 异常行为监控
```

### **业务连续性**
```yaml
备份策略:
  - 每日自动备份
  - 异地备份存储
  - 备份恢复测试

灾难恢复:
  - RTO < 1小时
  - RPO < 15分钟
  - 故障转移计划
```

---

## 📊 **预期收益**

### **技术收益**
```yaml
架构清晰度:
  - 6个独立业务域，边界清晰
  - 微服务数据完全解耦
  - 代码可维护性提升200%

性能提升:
  - 查询性能提升50%+ (无历史数据拖累)
  - 缓存命中率85%+
  - 并发支持能力提升300%

开发效率:
  - 统一数据库访问模式
  - 减少数据兼容性问题
  - 新功能开发速度提升100%
```

### **业务收益**
```yaml
用户体验:
  - 响应速度提升60%
  - 系统稳定性显著提升
  - 功能扩展更容易

运营效率:
  - 数据查询和分析更高效
  - 运维成本降低40%
  - 业务决策支持更准确
```

---

## ⚠️ **风险控制**

### **技术风险**
```yaml
风险: 重构过程中可能出现意外
缓解:
  - 完整的备份策略
  - 分阶段实施
  - 快速回滚机制

风险: 性能可能不如预期
缓解:
  - 充分的性能测试
  - 索引策略优化
  - 缓存机制补充
```

### **业务风险**
```yaml
风险: 重构时间可能超出预期
缓解:
  - 详细的时间规划
  - 专人专职负责
  - 每日进度跟踪

风险: 团队适应新架构需要时间
缓解:
  - 详细的文档说明
  - 技术培训
  - 渐进式部署
```

---

## 📋 **执行检查清单**

### **重构前准备**
- [ ] 完整数据备份
- [ ] 重构计划评审
- [ ] 团队沟通会议
- [ ] 开发环境准备

### **重构执行**
- [ ] 清空所有现有数据
- [ ] 创建新schema结构
- [ ] 实施所有业务域
- [ ] 创建索引和约束
- [ ] 更新所有服务适配器
- [ ] 编写单元测试

### **测试验证**
- [ ] 功能测试通过
- [ ] 性能测试达标
- [ ] 安全测试通过
- [ ] 集成测试完成

### **上线部署**
- [ ] 生产环境部署
- [ ] 监控配置完成
- [ ] 团队培训完成
- [ ] 文档更新完成

---

**重构负责人**: [待指定]
**技术支持**: 数据库团队 + 架构团队
**预期完成时间**: 2025-11-10
**成功标准**: 所有功能正常运行，性能指标达到预期

---

*本重构方案基于项目未上线的前提，采用彻底清空重建的策略，确保AutoAds项目拥有完美的数据库架构基础。*