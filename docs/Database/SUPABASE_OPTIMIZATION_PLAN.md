# AutoAds Supabase数据库优化方案

**优化目标**: 充分利用Supabase特性，提升实时功能和用户体验
**优化范围**: 用户域、活动域、推荐域的Supabase表设计
**实施时机**: 与数据库彻底重构同步进行

---

## 🎯 **Supabase优化核心原则**

### **数据分布策略**
```yaml
Supabase适合:
  ✅ 用户认证和授权
  ✅ 实时数据同步
  ✅ 用户配置和偏好
  ✅ 通知和消息系统
  ✅ 轻量级业务数据
  ✅ API密钥和会话管理
  ✅ 推荐缓存
  ✅ 活动日志

Cloud SQL适合:
  ✅ 大容量业务数据
  ✅ 复杂分析查询
  ✅ 事务性强的操作
  ✅ 批处理任务
  ✅ 历史数据归档
```

### **Supabase特性充分利用**
```yaml
实时功能:
  - 数据库实时订阅
  - 自动API生成
  - 实时UI更新

安全功能:
  - Row Level Security (RLS)
  - 细粒度权限控制
  - JWT集成

开发效率:
  - 自动API文档
  - 实时数据库备份
  - 内置认证系统
```

---

## 🏗️ **优化后的Supabase架构设计**

### **1. 用户域 - 全面增强**

#### **1.1 用户资料表 (user_profiles)**
```sql
-- 增强版用户资料表
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    company TEXT,
    website TEXT,
    location TEXT,
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    phone TEXT,

    -- 增强字段
    preferences JSONB DEFAULT '{}', -- 用户偏好设置
    settings JSONB DEFAULT '{}', -- 用户设置
    notification_settings JSONB DEFAULT '{
        "email": true,
        "push": true,
        "marketing": false
    }',
    privacy_settings JSONB DEFAULT '{
        "profile_visible": true,
        "email_visible": false,
        "activity_visible": true
    }',
    metadata JSONB DEFAULT '{}', -- 扩展元数据

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 约束
    CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id),
    CONSTRAINT user_profiles_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- 索引优化
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_display_name ON public.user_profiles(display_name);
CREATE INDEX idx_user_profiles_created_at ON public.user_profiles(created_at);
CREATE INDEX idx_user_profiles_company ON public.user_profiles(company) WHERE company IS NOT NULL;
```

#### **1.2 用户订阅表 (user_subscriptions)**
```sql
-- 增强版订阅管理表
CREATE TABLE public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'starter', 'premium', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'suspended')),
    price_cents INTEGER NOT NULL DEFAULT 0,
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),

    -- 订阅周期管理
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    trial_end TIMESTAMP WITH TIME ZONE,

    -- 第三方集成
    subscription_source TEXT DEFAULT 'web', -- 'web', 'mobile', 'admin'
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,

    -- 元数据
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 约束
    CONSTRAINT user_subscriptions_user_id_unique UNIQUE (user_id)
);

-- 索引优化
CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_plan_type ON public.user_subscriptions(plan_type);
CREATE INDEX idx_user_subscriptions_current_period_end ON public.user_subscriptions(current_period_end);
CREATE INDEX idx_user_subscriptions_stripe_customer_id ON public.user_subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
```

#### **1.3 用户活动统计表 (user_activity_stats) - 新增**
```sql
-- 用户活动统计聚合表
CREATE TABLE public.user_activity_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- 活动指标
    login_count INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    offers_created INTEGER DEFAULT 0,
    evaluations_completed INTEGER DEFAULT 0,
    time_spent_minutes INTEGER DEFAULT 0,

    -- 时间戳
    last_activity_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 约束
    CONSTRAINT user_activity_stats_user_date_unique UNIQUE (user_id, date)
);

-- 索引优化
CREATE INDEX idx_user_activity_stats_user_id ON public.user_activity_stats(user_id);
CREATE INDEX idx_user_activity_stats_date ON public.user_activity_stats(date);
CREATE INDEX idx_user_activity_stats_login_count ON public.user_activity_stats(login_count DESC);
CREATE INDEX idx_user_activity_stats_last_activity ON public.user_activity_stats(last_activity_at DESC);
```

#### **1.4 用户API密钥表 (user_api_keys) - 新增**
```sql
-- 用户API密钥管理表
CREATE TABLE public.user_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL, -- 哈希存储API密钥
    key_prefix TEXT NOT NULL, -- 显示前几位，如 "sk_live_..."
    permissions TEXT[] DEFAULT ARRAY['read'], -- 'read', 'write', 'admin'

    -- 使用管理
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,

    -- 审计
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 约束
    CONSTRAINT user_api_keys_key_hash_unique UNIQUE (key_hash)
);

-- 索引优化
CREATE INDEX idx_user_api_keys_user_id ON public.user_api_keys(user_id);
CREATE INDEX idx_user_api_keys_key_prefix ON public.user_api_keys(key_prefix);
CREATE INDEX idx_user_api_keys_is_active ON public.user_api_keys(is_active);
CREATE INDEX idx_user_api_keys_expires_at ON public.user_api_keys(expires_at);
```

#### **1.5 用户会话表 (user_sessions) - 新增**
```sql
-- 用户会话管理表
CREATE TABLE public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,

    -- 设备和位置信息
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,

    -- 会话管理
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引优化
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON public.user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions(expires_at);
CREATE INDEX idx_user_sessions_last_accessed ON public.user_sessions(last_accessed_at DESC);
```

### **2. 活动域 - 实时通知优化**

#### **2.1 用户通知表 (user_notifications)**
```sql
-- 实时通知系统表
CREATE TABLE public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 通知内容
    type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',

    -- 交互元素
    action_url TEXT,
    action_text TEXT,

    -- 状态管理
    read_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,

    -- 优先级和分类
    priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
    category TEXT, -- 'offer', 'billing', 'system', 'security'
    source TEXT, -- 'app', 'admin', 'automation'

    -- 扩展元数据
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 约束
    CONSTRAINT user_notifications_priority_check CHECK (priority >= 1 AND priority <= 5)
);

-- 索引优化
CREATE INDEX idx_user_notifications_user_id ON public.user_notifications(user_id);
CREATE INDEX idx_user_notifications_read_at ON public.user_notifications(read_at);
CREATE INDEX idx_user_notifications_type ON public.user_notifications(type);
CREATE INDEX idx_user_notifications_priority ON public.user_notifications(priority DESC);
CREATE INDEX idx_user_notifications_created_at ON public.user_notifications(created_at DESC);
CREATE INDEX idx_user_notifications_category ON public.user_notifications(category);
CREATE INDEX idx_user_notifications_unread ON public.user_notifications(user_id, read_at) WHERE read_at IS NULL;
```

#### **2.2 用户签到表 (user_checkins)**
```sql
-- 用户签到系统表
CREATE TABLE public.user_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,

    -- 签到统计
    streak_days INTEGER DEFAULT 1,
    points_earned INTEGER DEFAULT 0,
    bonus_points INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,

    -- 签到详情
    checkin_time TIME DEFAULT CURRENT_TIME,
    rewards_claimed JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 约束
    CONSTRAINT user_checkins_user_date_unique UNIQUE (user_id, checkin_date)
);

-- 索引优化
CREATE INDEX idx_user_checkins_user_id ON public.user_checkins(user_id);
CREATE INDEX idx_user_checkins_date ON public.user_checkins(checkin_date);
CREATE INDEX idx_user_checkins_streak_days ON public.user_checkins(streak_days DESC);
CREATE INDEX idx_user_checkins_total_points ON public.user_checkins(total_points DESC);
```

#### **2.3 用户事件表 (user_events) - 轻量级**
```sql
-- 用户事件日志表
CREATE TABLE public.user_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',

    -- 请求信息
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,

    -- 审计
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引优化
CREATE INDEX idx_user_events_user_id ON public.user_events(user_id);
CREATE INDEX idx_user_events_type ON public.user_events(event_type);
CREATE INDEX idx_user_events_created_at ON public.user_events(created_at DESC);
CREATE INDEX idx_user_events_session_id ON public.user_events(session_id) WHERE session_id IS NOT NULL;
```

### **3. 推荐域 - 实时推荐缓存**

#### **3.1 用户推荐缓存表 (user_recommendations)**
```sql
-- 实时推荐缓存表
CREATE TABLE public.user_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 推荐内容
    recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('offer', 'content', 'similar_users', 'trending')),
    item_id UUID NOT NULL,
    item_type TEXT NOT NULL, -- 'offer', 'article', 'user'

    -- 推荐算法信息
    score DECIMAL(5,4) NOT NULL,
    algorithm_version TEXT NOT NULL,
    context JSONB DEFAULT '{}',

    -- 状态管理
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'clicked', 'dismissed', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE,

    -- 扩展信息
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引优化
CREATE INDEX idx_user_recommendations_user_id ON public.user_recommendations(user_id);
CREATE INDEX idx_user_recommendations_type ON public.user_recommendations(recommendation_type);
CREATE INDEX idx_user_recommendations_score ON public.user_recommendations(score DESC);
CREATE INDEX idx_user_recommendations_status ON public.user_recommendations(status);
CREATE INDEX idx_user_recommendations_expires_at ON public.user_recommendations(expires_at);
CREATE INDEX idx_user_recommendations_active ON public.user_recommendations(user_id, status) WHERE status = 'active';
```

#### **3.2 推荐反馈表 (recommendation_feedback)**
```sql
-- 推荐反馈收集表
CREATE TABLE public.recommendation_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recommendation_id UUID NOT NULL REFERENCES public.user_recommendations(id) ON DELETE CASCADE,

    -- 反馈类型
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('click', 'like', 'dislike', 'share', 'convert', 'hide')),
    feedback_data JSONB DEFAULT '{}',

    -- 审计
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引优化
CREATE INDEX idx_recommendation_feedback_user_id ON public.recommendation_feedback(user_id);
CREATE INDEX idx_recommendation_feedback_recommendation_id ON public.recommendation_feedback(recommendation_id);
CREATE INDEX idx_recommendation_feedback_type ON public.recommendation_feedback(feedback_type);
CREATE INDEX idx_recommendation_feedback_created_at ON public.recommendation_feedback(created_at DESC);
```

---

## 🔒 **Row Level Security (RLS) 安全策略**

### **用户数据访问控制**
```sql
-- 启用RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的数据
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications" ON public.user_notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update notification read status" ON public.user_notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own checkins" ON public.user_checkins
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own recommendations" ON public.user_recommendations
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can provide feedback" ON public.recommendation_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 匿名用户可以查看公开数据
CREATE POLICY "Anonymous users can view public recommendations" ON public.user_recommendations
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.user_id = public.user_recommendations.user_id
        AND up.privacy_settings->>'activity_visible' = true
    ));
```

### **API密钥访问控制**
```sql
-- API密钥只能通过认证用户管理
CREATE POLICY "Users can manage own API keys" ON public.user_api_keys
    FOR ALL USING (auth.uid() = user_id);

-- 禁止直接访问敏感字段
CREATE POLICY "Hide sensitive API key data" ON public.user_api_keys
    FOR SELECT USING (
        NOT (current_setting('request.jwt.claims', true)::json->>'role' = 'service')
        OR auth.uid() = user_id
    );
```

---

## ⚡ **实时订阅功能实现**

### **通知实时订阅**
```sql
-- 通知变更触发器
CREATE OR REPLACE FUNCTION public.notify_notification_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 发送实时通知到客户端
    PERFORM pg_notify(
        'notification_change',
        json_build_object(
            'id', NEW.id,
            'user_id', NEW.user_id,
            'type', NEW.type,
            'title', NEW.title,
            'unread', NEW.read_at IS NULL,
            'priority', NEW.priority,
            'action_url', NEW.action_url
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
CREATE TRIGGER notification_change_trigger
    AFTER INSERT OR UPDATE ON public.user_notifications
    FOR EACH ROW EXECUTE FUNCTION public.notify_notification_change();
```

### **推荐更新实时订阅**
```sql
-- 推荐更新触发器
CREATE OR REPLACE FUNCTION public.notify_recommendation_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 发送推荐更新通知
    PERFORM pg_notify(
        'recommendation_change',
        json_build_object(
            'id', NEW.id,
            'user_id', NEW.user_id,
            'type', NEW.recommendation_type,
            'score', NEW.score,
            'action', 'new',
            'expires_at', NEW.expires_at
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
CREATE TRIGGER recommendation_change_trigger
    AFTER INSERT ON public.user_recommendations
    FOR EACH ROW EXECUTE FUNCTION public.notify_recommendation_change();
```

### **用户活动实时统计**
```sql
-- 活动统计更新触发器
CREATE OR REPLACE FUNCTION public.update_activity_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- 更新当日活动统计
    INSERT INTO public.user_activity_stats (
        user_id,
        date,
        login_count,
        page_views,
        offers_created,
        evaluations_completed,
        last_activity_at
    ) VALUES (
        NEW.user_id,
        CURRENT_DATE,
        CASE WHEN NEW.event_type = 'login' THEN 1 ELSE 0 END,
        CASE WHEN NEW.event_type = 'page_view' THEN 1 ELSE 0 END,
        CASE WHEN NEW.event_type = 'offer_created' THEN 1 ELSE 0 END,
        CASE WHEN NEW.event_type = 'evaluation_completed' THEN 1 ELSE 0 END,
        CASE WHEN NEW.event_type = 'evaluation_completed' THEN 0 ELSE 0 END,
        NEW.created_at
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
        login_count = user_activity_stats.login_count +
            CASE WHEN NEW.event_type = 'login' THEN 1 ELSE 0 END,
        page_views = user_activity_stats.page_views +
            CASE WHEN NEW.event_type = 'page_view' THEN 1 ELSE 0 END,
        offers_created = user_activity_stats.offers_created +
            CASE WHEN NEW.event_type = 'offer_created' THEN 1 ELSE 0 END,
        evaluations_completed = user_activity_stats.evaluations_completed +
            CASE WHEN NEW.event_type = 'evaluation_completed' THEN 1 ELSE 0 END,
        last_activity_at = GREATEST(user_activity_stats.last_activity_at, NEW.created_at),
        updated_at = NOW()
    WHERE user_activity_stats.user_id = NEW.user_id
    AND user_activity_stats.date = CURRENT_DATE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
CREATE TRIGGER update_activity_stats_trigger
    AFTER INSERT ON public.user_events
    FOR EACH ROW EXECUTE FUNCTION public.update_activity_stats();
```

---

## 🚀 **性能优化策略**

### **索引优化总结**
```yaml
用户域索引:
  - user_profiles: user_id, email, display_name, created_at
  - user_subscriptions: user_id, status, plan_type, current_period_end
  - user_activity_stats: user_id, date, login_count, last_activity
  - user_api_keys: user_id, is_active, expires_at
  - user_sessions: user_id, session_token, expires_at

活动域索引:
  - user_notifications: user_id, read_at, type, priority, created_at
  - user_checkins: user_id, date, streak_days, total_points
  - user_events: user_id, type, created_at, session_id

推荐域索引:
  - user_recommendations: user_id, type, score, status, expires_at
  - recommendation_feedback: user_id, recommendation_id, type, created_at
```

### **查询优化**
```sql
-- 复合索引支持常用查询组合
CREATE INDEX idx_notifications_user_unread_priority
ON public.user_notifications(user_id, read_at IS NULL, priority DESC);

CREATE INDEX idx_recommendations_user_active_score
ON public.user_recommendations(user_id, status, score DESC)
WHERE status = 'active';

CREATE INDEX idx_activity_stats_user_recent
ON public.user_activity_stats(user_id, date DESC)
WHERE date >= CURRENT_DATE - INTERVAL '30 days';
```

### **数据清理策略**
```sql
-- 自动清理过期通知
CREATE OR REPLACE FUNCTION public.cleanup_expired_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM public.user_notifications
    WHERE expires_at < NOW()
    OR (read_at IS NOT NULL AND read_at < NOW() - INTERVAL '30 days');

    RAISE NOTICE 'Cleaned up % expired notifications',
                  (SELECT COUNT(*) FROM public.user_notifications
                   WHERE expires_at < NOW()
                   OR (read_at IS NOT NULL AND read_at < NOW() - INTERVAL '30 days'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 自动清理过期推荐
CREATE OR REPLACE FUNCTION public.cleanup_expired_recommendations()
RETURNS void AS $$
BEGIN
    DELETE FROM public.user_recommendations
    WHERE expires_at < NOW();

    RAISE NOTICE 'Cleaned up % expired recommendations',
                  (SELECT COUNT(*) FROM public.user_recommendations
                   WHERE expires_at < NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建定时清理任务（需要pg_cron扩展）
-- SELECT cron.schedule('cleanup-expired-data', '0 2 * * *', 'SELECT cleanup_expired_notifications(); SELECT cleanup_expired_recommendations();');
```

---

## 📈 **监控和维护**

### **关键性能指标**
```yaml
Supabase性能监控:
  - 数据库连接数
  - 查询响应时间
  - 实时订阅连接数
  - RLS策略执行效率

业务指标监控:
  - 通知到达率
  - 推荐命中率
  - 用户活跃度
  - API调用成功率
```

### **备份策略**
```yaml
实时备份:
  - 自动增量备份
  - 实时恢复能力
  - 跨区域复制

数据保护:
  - 定期全量备份
  - 加密存储
  - 备份数据完整性验证
```

---

## 🎯 **实施计划**

### **阶段1: 准备和设计 (2天)**
- Day 1: 详细表结构设计评审
- Day 2: 索引策略和RLS策略制定

### **阶段2: 表结构实施 (3天)**
- Day 1: 创建Supabase表结构
- Day 2: 实施索引和约束
- Day 3: 配置RLS策略

### **阶段3: 实时功能实现 (2天)**
- Day 1: 实现触发器和实时订阅
- Day 2: 前端实时更新集成

### **阶段4: 性能优化 (2天)**
- Day 1: 查询性能测试和优化
- Day 2: 数据清理策略实施

### **阶段5: 测试和验证 (1天)**
- 功能测试
- 性能测试
- 安全测试

**总预计时间**: 10天

---

## ✅ **预期收益**

### **用户体验提升**
```yaml
实时性:
  - 通知即时送达
  - 推荐实时更新
  - 用户活动实时统计

性能提升:
  - 查询响应时间改善50%+
  - 实时更新延迟 < 100ms
  - 用户界面流畅度提升
```

### **开发效率提升**
```yaml
API自动生成:
  - 减少API开发工作量80%
  - 自动生成API文档
  - 减少前后端协调成本

实时功能:
  - 简化实时功能开发
  - 减少轮询查询
  - 提升开发效率
```

### **安全和管理**
```yaml
数据安全:
  - 细粒度权限控制
  - 用户数据隔离
  - API访问控制

运维简化:
  - 自动备份恢复
  - 实时监控告警
  - 减少运维复杂度
```

---

**结论**: 通过充分优化Supabase数据表设计，AutoAds将获得强大的实时功能、优秀的用户体验和高效的开发流程。这个优化方案将显著提升平台的技术架构水平和用户满意度。

*文档版本: v1.0*
*最后更新: 2025-10-19*