-- AdsAI Supabase数据库优化脚本 (权限适配版)
-- 基于三层用户架构设计
-- 执行日期: 2025-10-22
-- 项目: AdsAI
-- 数据库: jzzvizacfyipzdyiqfzb

-- =====================================
-- 1. 检查现有状态
-- =====================================

-- 查看当前表状态
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname IN ('auth', 'public')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 查看用户统计
SELECT
    'Total Users' as metric,
    COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 'Active Users (Last 30 days)',
    COUNT(*)
FROM auth.users
WHERE last_sign_in_at > NOW() - INTERVAL '30 days'
UNION ALL
SELECT 'Email Verified Users',
    COUNT(*)
FROM auth.users
WHERE email_confirmed_at IS NOT NULL;

-- =====================================
-- 2. 优化public schema (可操作部分)
-- =====================================

-- 检查user_profiles是否已存在
SELECT viewname, viewowner, definition
FROM information_schema.views
WHERE table_schema = 'public' AND table_name = 'user_profiles';

-- 如果user_profiles视图不存在，创建它
-- 注意：如果���存在，跳过此步骤
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
        EXECUTE '
        CREATE VIEW public.user_profiles AS
        SELECT
            u.id,
            u.email,
            u.phone,
            u.created_at,
            u.updated_at,
            u.last_sign_in_at,
            u.email_confirmed_at,
            u.phone_confirmed_at,
            u.raw_user_meta_data,
            u.is_super_admin,
            -- 从metadata中提取常用字段
            COALESCE(u.raw_user_meta_data->>''name'', u.email) as display_name,
            u.raw_user_meta_data->>''avatar_url'' as avatar_url,
            COALESCE(u.raw_user_meta_data->>''language'', ''en'') as language,
            COALESCE(u.raw_user_meta_data->>''timezone'', ''UTC'') as timezone,
            -- 活跃状态计算
            CASE
                WHEN u.last_sign_in_at > NOW() - INTERVAL ''30 days'' THEN true
                ELSE false
            END as is_active,
            -- 用户类型
            CASE
                WHEN u.is_super_admin THEN ''admin''
                ELSE ''user''
            END as user_role,
            -- 账户年龄（天）
            EXTRACT(days FROM NOW() - u.created_at) as account_age_days
        FROM auth.users u';

        EXECUTE 'GRANT SELECT ON public.user_profiles TO authenticated, anon';

        RAISE NOTICE 'user_profiles视图已创建';
    ELSE
        RAISE NOTICE 'user_profiles视图已存在，跳过创建';
    END IF;
END $$;

-- =====================================
-- 3. 创建用户统计物化视图
-- =====================================

-- 创建用户统计物化视图
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_stats_materialized AS
SELECT
    -- 总用户数
    COUNT(*) as total_users,
    -- 活跃用户数（近30天）
    COUNT(*) FILTER (WHERE last_sign_in_at > NOW() - INTERVAL '30 days') as active_users_30d,
    -- 活跃用户数（近7天）
    COUNT(*) FILTER (WHERE last_sign_in_at > NOW() - INTERVAL '7 days') as active_users_7d,
    -- 邮箱已验证用户数
    COUNT(*) FILTER (WHERE email_confirmed_at IS NOT NULL) as verified_users,
    -- 管理员用户数
    COUNT(*) FILTER (WHERE is_super_admin = true) as admin_users,
    -- 今日新注册用户数
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as new_users_today,
    -- 本周新注册用户数
    COUNT(*) FILTER (WHERE created_at >= date_trunc('week', CURRENT_DATE)) as new_users_week,
    -- 本月新注册用户数
    COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) as new_users_month,
    -- 更新时间
    NOW() as updated_at
FROM auth.users;

-- 创建唯一索引
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_user_stats_materialized_single
ON public.user_stats_materialized ((true));

-- 授予权限
GRANT SELECT ON public.user_stats_materialized TO authenticated, anon;

-- =====================================
-- 4. 创建数据库函数 (public schema)
-- =====================================

-- 刷新物化视图函数
CREATE OR REPLACE FUNCTION public.refresh_user_stats_materialized()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_stats_materialized;
END;
$$;

-- 获取用户统计数据函数
CREATE OR REPLACE FUNCTION public.get_user_statistics()
RETURNS TABLE (
    metric TEXT,
    value BIGINT,
    description TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT
    'total_users' as metric,
    total_users as value,
    '总用户数' as description
FROM public.user_stats_materialized
UNION ALL
SELECT
    'active_users_30d' as metric,
    active_users_30d as value,
    '近30天活跃用户' as description
FROM public.user_stats_materialized
UNION ALL
SELECT
    'active_users_7d' as metric,
    active_users_7d as value,
    '近7天活跃用户' as description
FROM public.user_stats_materialized
UNION ALL
SELECT
    'verified_users' as metric,
    verified_users as value,
    '邮箱已验证用户' as description
FROM public.user_stats_materialized
UNION ALL
SELECT
    'admin_users' as metric,
    admin_users as value,
    '管理员用户数' as description
FROM public.user_stats_materialized
UNION ALL
SELECT
    'new_users_today' as metric,
    new_users_today as value,
    '今日新用户' as description
FROM public.user_stats_materialized
UNION ALL
SELECT
    'new_users_week' as metric,
    new_users_week as value,
    '本周新用户' as description
FROM public.user_stats_materialized
UNION ALL
SELECT
    'new_users_month' as metric,
    new_users_month as value,
    '本月新用户' as description
FROM public.user_stats_materialized;
$$;

-- =====================================
-- 5. 数据库清理和维护
-- =====================================

-- 清理过期会话（保留7天）
-- 注意：需要适当权限
-- DELETE FROM auth.sessions WHERE created_at < NOW() - INTERVAL '7 days';

-- 更新表统计信息
ANALYZE auth.users;

-- =====================================
-- 6. 验证优化结果
-- =====================================

-- 验证物化视图创建成功
SELECT 'user_stats_materialized' as object_name, 'materialized view' as object_type, pg_size_pretty(pg_total_relation_size('public.user_stats_materialized')) as size;

-- 验证user_profiles视图
SELECT 'user_profiles' as object_name, 'view' as object_type, pg_size_pretty(pg_total_relation_size('public.user_profiles')) as size;

-- 验证函数创建成功
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('refresh_user_stats_materialized', 'get_user_statistics');

-- 测试物化视图数据
SELECT * FROM public.user_stats_materialized;

-- =====================================
-- 7. 优化完成确认
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '=== AdsAI Supabase数据库优化完成 ===';
    RAISE NOTICE '1. 已检查现有数据库状态';
    RAISE NOTICE '2. 已创建/验证user_profiles视图';
    RAISE NOTICE '3. 已创建用户统计物化视图';
    RAISE NOTICE '4. 已创建public schema数据库函数';
    RAISE NOTICE '5. 已更新表统计信息';
    RAISE NOTICE '6. 已验证优化结果';
    RAISE NOTICE '优化完成时间: %', NOW();
    RAISE NOTICE '=========================================';
END $$;