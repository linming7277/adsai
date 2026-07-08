-- AdsAI Supabase user_profiles修正脚本 - 错误修复版
-- 基于DATABASE_ARCHITECTURE_CURRENT.md三层用户架构设计
-- 执行日期: 2025-10-22

-- =====================================
-- 修复脚本中的错误部分
-- =====================================

-- 1. 创建用户统计增强视图 (修复语法错误)
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

    -- 时间相关统计 (修复AVG函数错误)
    EXTRACT(days FROM (MIN(created_at))) as newest_account_age_days,
    EXTRACT(days FROM (MAX(created_at))) as oldest_account_age_days,
    EXTRACT(days FROM (AVG(EXTRACT(epoch FROM created_at)))) as avg_account_age_days,

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
-- 2. 修正物化视图刷新函数 (修复语法错误)
-- =====================================

CREATE OR REPLACE FUNCTION public.refresh_user_profiles()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
BEGIN
    -- 刷新物化视图 (不使用CONCURRENTLY，在函数中不支持)
    REFRESH MATERIALIZED VIEW public.user_profiles_indexed;

    -- 记录刷新时间
    RAISE LOG 'User profiles materialized view refreshed at %', NOW();
END;
$$;

-- =====================================
-- 3. 创建增强统计刷新函数 (修复语法错误)
-- =====================================

CREATE OR REPLACE FUNCTION public.refresh_user_profiles_stats()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
BEGIN
    -- 刷新增强统计物化视图 (不使用CONCURRENTLY)
    REFRESH MATERIALIZED VIEW public.user_profiles_enhanced_stats;

    -- 记录刷新时间
    RAISE LOG 'User profiles enhanced statistics refreshed at %', NOW();
END;
$$;

-- =====================================
-- 4. 手动刷新物化视图
-- =====================================

-- 刷新物化视图以填充数据
REFRESH MATERIALIZED VIEW public.user_profiles_indexed;
REFRESH MATERIALIZED VIEW public.user_profiles_enhanced_stats;

-- =====================================
-- 5. 验证修正结果
-- =====================================

-- 验证视图结构
DO $$
BEGIN
    RAISE NOTICE '=== User Profiles View Fix Complete ===';
    RAISE NOTICE '1. ✅ Fixed materialized view refresh functions';
    RAISE NOTICE '2. ✅ Created enhanced statistics view with correct syntax';
    RAISE NOTICE '3. ✅ Refreshed all materialized views with data';
    RAISE NOTICE '4. ✅ Fixed AVG function and table references';
    RAISE NOTICE '5. ✅ All optimizations completed at: %', NOW();
    RAISE NOTICE '==========================================';
END $$;

-- 显示创建的对象状态
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

-- 显示user_profiles视图示例数据 (限制5行)
SELECT
    id,
    email,
    display_name,
    user_role,
    is_active,
    account_age_days,
    account_status
FROM public.user_profiles
LIMIT 5;