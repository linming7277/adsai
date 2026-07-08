-- AdsAI Supabase user_profiles视图修正脚本
-- 基于DATABASE_ARCHITERCURE_CURRENT.md三层用户架构设计
-- 执行日期: 2025-10-22

-- =====================================
-- 1. 备份现有结构 (预防措施)
-- =====================================

-- 检查当前user_profiles视图结构
\d+ public.user_profiles

-- 备份当前数据 (如果有数据的话)
-- CREATE TABLE public.user_profiles_backup AS TABLE public.user_profiles;

-- =====================================
-- 2. 删除当前不符合要求的表结构
-- =====================================

-- 注意：由于表中没有数据，可以直接删除
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- =====================================
-- 3. 创建符合文档要求的user_profiles视图
-- =====================================

-- 基于DATABASE_ARCHITECTURE_CURRENT.md中的定义创建视图
CREATE VIEW public.user_profiles AS
SELECT
    -- 基础认证信息
    u.id,
    u.email,
    u.phone,
    u.created_at,
    u.updated_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    u.phone_confirmed_at,

    -- 用户元数据 (raw_user_meta_data JSONB)
    u.raw_user_meta_data,

    -- 管理员权限标识
    u.is_super_admin,

    -- 从metadata中提取常用字段，提升查询性能
    COALESCE(u.raw_user_meta_data->>'name', u.email) as display_name,
    u.raw_user_meta_data->>'avatar_url' as avatar_url,
    COALESCE(u.raw_user_meta_data->>'language', 'en') as language,
    COALESCE(u.raw_user_meta_data->>'timezone', 'UTC') as timezone,

    -- 预计算的状态字段 (减少前端计算负担)
    CASE
        WHEN u.last_sign_in_at > NOW() - INTERVAL '30 days' THEN true
        ELSE false
    END as is_active,

    -- 用户角色标识
    CASE
        WHEN u.is_super_admin THEN 'admin'
        ELSE 'user'
    END as user_role,

    -- 账户相关计算字段
    EXTRACT(days FROM NOW() - u.created_at) as account_age_days,

    -- 邮箱验证状态
    CASE
        WHEN u.email_confirmed_at IS NOT NULL THEN 'verified'
        ELSE 'unverified'
    END as email_status,

    -- 电话验证状态
    CASE
        WHEN u.phone_confirmed_at IS NOT NULL THEN 'verified'
        ELSE 'unverified'
    END as phone_status,

    -- 最后活动时间
    CASE
        WHEN u.last_sign_in_at IS NOT NULL THEN EXTRACT(epoch FROM u.last_sign_in_at)
        ELSE NULL
    END as last_sign_in_timestamp,

    -- 注册渠道 (从raw_app_meta_data提取)
    COALESCE(u.raw_app_meta_data->>'provider', 'email') as registration_source,

    -- 用户类型判断
    CASE
        WHEN u.is_sso_user = true THEN 'sso'
        WHEN u.is_anonymous = true THEN 'anonymous'
        ELSE 'email'
    END as user_type,

    -- 账户状态检查
    CASE
        WHEN u.banned_until > NOW() THEN 'banned'
        WHEN u.deleted_at IS NOT NULL THEN 'deleted'
        WHEN u.email_confirmed_at IS NULL THEN 'unverified'
        ELSE 'active'
    END as account_status

FROM auth.users u;

-- =====================================
-- 4. 设置视图权限 (遵循最小权限原则)
-- =====================================

-- 授权认证用户可以查看所有用户资料（根据业务需求调整）
GRANT SELECT ON public.user_profiles TO authenticated;

-- 授权匿名用户可以查看基本用户信息（可选，根据安全需求调整）
-- GRANT SELECT ON public.user_profiles TO anon;

-- =====================================
-- 5. 创建索引以提升视图查询性能
-- =====================================

-- 由于PostgreSQL不支持直接在视图上创建索引，
-- 我们通过创建索引化的物化视图来提升性能

CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_profiles_indexed AS
SELECT * FROM public.user_profiles;

-- 为物化视图创建索引
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
    idx_user_profiles_indexed_id
ON public.user_profiles_indexed (id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_user_profiles_indexed_email
ON public.user_profiles_indexed (email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_user_profiles_indexed_active
ON public.user_profiles_indexed (is_active, last_sign_in_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_user_profiles_indexed_role
ON public.user_profiles_indexed (user_role, account_age_days);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_user_profiles_indexed_status
ON public.user_profiles_indexed (account_status);

-- 授予物化视图权限
GRANT SELECT ON public.user_profiles_indexed TO authenticated;
-- GRANT SELECT ON public.user_profiles_indexed TO anon;

-- =====================================
-- 6. 创建视图刷新函数
-- =====================================

CREATE OR REPLACE FUNCTION public.refresh_user_profiles()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
BEGIN
    -- 刷新物化视图
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_profiles_indexed;

    -- 记录刷新时间
    RAISE LOG 'User profiles materialized view refreshed at %', NOW();
END;
$$;

-- =====================================
-- 7. 创建用户统计增强视图 (基于user_profiles)
-- =====================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_profiles_enhanced_stats AS
SELECT
    -- 基础统计
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE is_active = true) as active_users_30d,
    COUNT(*) FILTER (WHERE is_active = false) as inactive_users,
    COUNT(*) FILTER (WHERE user_role = 'admin') as admin_users,
    COUNT(*) FILTER (WHERE user_role = 'user') as regular_users,

    -- 按注册时间统计
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as new_users_today,
    COUNT(*) FILTER (WHERE created_at >= date_trunc('week', CURRENT_DATE)) as new_users_this_week,
    COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) as new_users_this_month,

    -- 按用户类型统计
    COUNT(*) FILTER (WHERE user_type = 'email') as email_users,
    COUNT(*) FILTER (WHERE user_type = 'sso') as sso_users,
    COUNT(*) FILTER (WHERE user_type = 'anonymous') as anonymous_users,

    -- 按账户状态统计
    COUNT(*) FILTER (WHERE account_status = 'active') as active_accounts,
    COUNT(*) FILTER (WHERE account_status = 'unverified') as unverified_accounts,
    COUNT(*) FILTER (WHERE account_status = 'banned') as banned_accounts,
    COUNT(*) FILTER (WHERE account_status = 'deleted') as deleted_accounts,

    -- 按验证状态统计
    COUNT(*) FILTER (WHERE email_status = 'verified') as email_verified,
    COUNT(*) FILTER (WHERE phone_status = 'verified') as phone_verified,
    COUNT(*) FILTER (WHERE email_status = 'verified' AND phone_status = 'verified') as fully_verified,

    -- 时间相关统计
    EXTRACT(days FROM AVG(created_at)) as avg_account_age_days,
    EXTRACT(days FROM MAX(created_at)) as oldest_account_age_days,
    EXTRACT(days FROM MIN(created_at)) as newest_account_age_days,

    -- 更新时间
    NOW() as updated_at

FROM public.user_profiles;

-- 为增强统计视图创建索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_user_profiles_enhanced_stats_single
ON public.user_profiles_enhanced_stats ((true));

-- 授予权限
GRANT SELECT ON public.user_profiles_enhanced_stats TO authenticated;
GRANT SELECT ON public.user_profiles_enhanced_stats TO anon;

-- =====================================
-- 8. 创建增强统计刷新函数
-- =====================================

CREATE OR REPLACE FUNCTION public.refresh_user_profiles_stats()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
BEGIN
    -- 刷新增强统计物化视图
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_profiles_enhanced_stats;

    -- 记录刷新时间
    RAISE LOG 'User profiles enhanced statistics refreshed at %', NOW();
END;
$$;

-- =====================================
-- 9. 创建便捷查询函数
-- =====================================

-- 获取用户完整信息
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id_param UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    phone TEXT,
    display_name TEXT,
    avatar_url TEXT,
    language TEXT,
    timezone TEXT,
    is_active BOOLEAN,
    user_role TEXT,
    account_age_days BIGINT,
    email_status TEXT,
    phone_status TEXT,
    account_status TEXT,
    registration_source TEXT,
    user_type TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    email_confirmed_at TIMESTAMPTZ,
    phone_confirmed_at TIMESTAMPTZ,
    raw_user_meta_data JSONB,
    is_super_admin BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT
    u.id,
    u.email,
    u.phone,
    u.display_name,
    u.avatar_url,
    u.language,
    u.timezone,
    u.is_active,
    u.user_role,
    u.account_age_days,
    u.email_status,
    u.phone_status,
    u.account_status,
    u.registration_source,
    u.user_type,
    u.created_at,
    u.updated_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    u.phone_confirmed_at,
    u.raw_user_meta_data,
    u.is_super_admin
FROM public.user_profiles_indexed u
WHERE u.id = user_id_param;
$$;

-- 获取活跃用户列表
CREATE OR REPLACE FUNCTION public.get_active_users(limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
    id UUID,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    user_role TEXT,
    account_age_days BIGINT,
    last_sign_in_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT
    u.id,
    u.email,
    u.display_name,
    u.avatar_url,
    u.user_role,
    u.account_age_days,
    u.last_sign_in_at
FROM public.user_profiles_indexed u
WHERE u.is_active = true
ORDER BY u.last_sign_in_at DESC
LIMIT limit_count;
$$;

-- 获取管理员用户列表
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE (
    id UUID,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    account_age_days BIGINT,
    created_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT
    u.id,
    u.email,
    u.display_name,
    u.avatar_url,
    u.account_age_days,
    u.created_at,
    u.last_sign_in_at
FROM public.user_profiles_indexed u
WHERE u.user_role = 'admin'
ORDER BY u.created_at DESC;
$$;

-- =====================================
-- 10. 创建监控和维护查询
-- =====================================

-- 验证视图创建成功
DO $$
BEGIN
    RAISE NOTICE '=== User Profiles View Optimization Complete ===';
    RAISE NOTICE '1. ✅ Deleted old user_profiles table structure';
    RAISE NOTICE '2. ✅ Created new user_profiles view based on auth.users';
    RAISE NOTICE '3. ✅ Created indexed materialized view for performance';
    RAISE NOTICE '4. ✅ Created enhanced statistics view';
    RAISE NOTICE '5. ✅ Created utility functions for easy access';
    RAISE NOTICE '6. ✅ Set proper permissions and security';
    RAISE NOTICE '7. ✅ Optimization completed at: %', NOW();
    RAISE NOTICE '================================================';
END $$;

-- 验证视图结构
SELECT
    'user_profiles_view' as object_name,
    'view' as object_type,
    pg_size_pretty(pg_total_relation_size('public.user_profiles')) as size;

SELECT
    'user_profiles_indexed' as object_name,
    'materialized view' as object_type,
    pg_size_pretty(pg_total_relation_size('public.user_profiles_indexed')) as size;

SELECT
    'user_profiles_enhanced_stats' as object_name,
    'materialized view' as object_type,
    pg_size_pretty(pg_total_relation_size('public.user_profiles_enhanced_stats')) as size;

-- 显示创建的函数
SELECT
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'refresh_user_profiles',
    'refresh_user_profiles_stats',
    'get_user_profile',
    'get_active_users',
    'get_admin_users'
)
ORDER BY routine_name;

-- 显示基础统计
SELECT * FROM public.user_profiles_enhanced_stats;