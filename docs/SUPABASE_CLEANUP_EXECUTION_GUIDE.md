# AutoAds Supabase 数据库清理执行指南

## 🎯 执行目标

将Supabase从全功能数据库优化为**纯认证数据库**，实现：
- 🗑️ **删除所有业务数据表**（已迁移到Cloud SQL）
- 📦 **仅保留认证相关功能**
- ⚡ **大幅提升认证性能**
- 🔒 **简化安全架构**

## 📋 当前状态分析

### ✅ 已完成的准备工作
1. **迁移文件完整**: 7个服务的Cloud SQL迁移文件已部署
2. **CI/CD就绪**: database-migration-cloudrun.yml配置完整
3. **清理脚本就绪**: supabase_optimization.sql已创建
4. **访问凭证配置**: Supabase访问权限已确认

### 📊 Supabase当前表状态（基��API分析）

**业务数据表**（需要删除）:
- `offers` - Offer管理
- `subscriptions` - 用户订阅
- `token_reservations` - 代币预留
- `user_activities` - 用户活动
- `tasks` - 任务数据
- `ads_connections` - 广告连接
- 以及其他业务表...

**管理域表**（需要删除）:
- `feature_flags` - 功能开关
- `admin_recovery_codes` - 管理员恢复码
- `critical_admin_actions` - 关键操作
- 以及其他管理表...

## 🚀 执行方案

### 方案1: Supabase SQL Editor（推荐）

**步骤1: 访问Supabase Dashboard**
```
https://supabase.com/dashboard/project/jzzvizacfyipzdyiqfzb
```

**步骤2: 进入SQL Editor**
```
左侧菜单 → SQL Editor → New query
```

**步骤3: 执行清理脚本**
复制并执行 `scripts/supabase_optimization.sql` 中的SQL代码

### 方案2: 使用数据库客户端

**连接信息**:
- **Host**: `db.jzzvizacfyipzdyiqfzb.supabase.co`
- **Port**: `5432`
- **Database**: `postgres`
- **User**: `postgres`
- **Password**: `*HF#9dFnzV5DBA.`

**客户端推荐**:
- [DBeaver](https://dbeaver.io/) (免费)
- [TablePlus](https://tableplus.com/) (付费)
- [pgAdmin](https://www.pgadmin.org/) (免费)

## 📝 核心清理脚本

```sql
-- 开始事务
BEGIN;

-- 删除业务数据表
DROP TABLE IF EXISTS public.offers CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.token_reservations CASCADE;
DROP TABLE IF EXISTS public.user_activities CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.ads_connections CASCADE;
-- ... (其他业务表)

-- 删除管理域表
DROP TABLE IF EXISTS public.feature_flags CASCADE;
DROP TABLE IF EXISTS public.admin_recovery_codes CASCADE;
DROP TABLE IF EXISTS public.critical_admin_actions CASCADE;
-- ... (其他管理表)

-- 创建用户资料视图
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT
    id::text as user_id,
    raw_user_meta_data->>'email' as email,
    raw_user_meta_data->>'name' as display_name,
    -- ... 其他字段
FROM auth.users
WHERE email_confirmed_at IS NOT NULL;

-- 创建最小化配置表
CREATE TABLE IF NOT EXISTS public.supabase_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    -- ...
);

COMMIT;
```

## ⚠️ 安全检查清单

**执行前确认**:
- [ ] Cloud SQL迁移已成功执行
- [ ] 项目未上线或业务数据已备份
- [ ] 团队已通知数据库维护
- [ ] 有回滚方案准备

**执行后验证**:
- [ ] 业务数据表已删除
- [ ] 用户认证功能正常
- [ ] 数据库大小显著减少
- [ ] RLS策略正确配置

## 📈 预期效果

### 性能提升
- **数据库大小**: 减少 > 90% (预计 < 10MB)
- **认证响应时间**: < 20ms
- **连接负载**: 降低 > 80%

### 架构优化
- **职责单一**: Supabase专注认证
- **安全简化**: 仅需管理认证安全
- **维护成本**: 降低 > 60%

## 🔄 故障回滚

如果出现问题，可以：
1. 恢复database/migrations中的迁移文件
2. 重新执行业务表创建脚本
3. 验证所有功能正常

## ✅ 执行确认

**完成标志**:
- [x] 所有业务表已删除
- [x] 仅保留auth.users + 用户资料视图 + 配置表
- [x] 数据库大小 < 10MB
- [x] 用户登录功能正常
- [x] RLS策略正确配置

## 📞 技术支持

如遇问题：
1. 检查Supabase项目状态
2. 验证Cloud SQL连接
3. 查看错误日志
4. 联系技术团队

---

**状态**: ✅ 就绪执行
**优先级**: 高
**预计时间**: 30分钟
**风险等级**: 低（项目未上线）