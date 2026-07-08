# Schema不匹配问题 - 彻底修复方案

**日期**: 2025-10-13
**优先级**: P0 (阻塞性问题)

---

## 问题诊断

### 根本原因

系统设计使用 **`public.users`** 表存储用户业务数据,但前端代码错误地查询 **`user_profiles`** 表。

### 表结构对比

#### ✅ `public.users` (正确的表 - 包含subscription字段)
```sql
-- 定义于: supabase/migrations/20251011_create_users_table.sql
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    display_name TEXT,
    photo_url TEXT,
    onboarded BOOLEAN DEFAULT false,
    subscription_tier TEXT DEFAULT 'trial',           -- ✅ 前端需要
    monthly_token_allocation INTEGER DEFAULT 0,       -- ✅ 前端需要
    token_balance INTEGER DEFAULT 0,                  -- ✅ 前端需要
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### ❌ `public.user_profiles` (错误的表 - 只有基础字段)
```sql
-- 实际存在于数据库中
CREATE TABLE public.user_profiles (
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    locale TEXT DEFAULT 'zh-CN',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 前端代码查询错误

**文件**: `apps/frontend/src/core/hooks/use-user-subscription.ts:44`

```typescript
// ❌ 错误: 查询user_profiles表
const { data, error } = await client
  .from('user_profiles')
  .select('*')
  .eq('user_id', user.id)
  .maybeSingle();

// data中不包含: subscription_tier, token_balance, monthly_token_allocation
```

---

## 修复方案

### 方案A: 修改前端代码改用正确的表 (推荐)

#### 优点
- 符合原系统设计
- migration脚本已存在
- 无需重构数据库

#### 缺点
- 需要创建 `public.users` 表(如果不存在)
- 需要迁移现有数据

#### 执行步骤

**Step 1**: 在Supabase创建 `public.users` 表
```bash
# 方法1: Supabase Dashboard手动执行
# URL: https://supabase.com/dashboard/project/jzzvizacfyipzdyiqfzb/sql/new
# 复制并执行: supabase/migrations/20251011_create_users_table.sql

# 方法2: 使用PostgreSQL客户端
psql -h db.jzzvizacfyipzdyiqfzb.supabase.co -U postgres -d postgres \
  -f supabase/migrations/20251011_create_users_table.sql
```

**Step 2**: 修改前端代码
```typescript
// 文件: apps/frontend/src/core/hooks/use-user-subscription.ts

// 改为查询 users 表而不是 user_profiles
const { data, error } = await client
  .from('users')  // ✅ 改这里
  .select('*')
  .eq('id', user.id)  // ✅ 注意: users表的主键是id,不是user_id
  .maybeSingle();
```

**Step 3**: 查找并修改所有查询 `user_profiles` 的地方
```bash
# 搜索所有引用
grep -r "\.from('user_profiles')" apps/frontend/src/
grep -r '\.from("user_profiles")' apps/frontend/src/
```

**Step 4**: 创建test user记录
```typescript
// 使用Supabase API创建
INSERT INTO public.users (
  id,
  display_name,
  onboarded,
  subscription_tier,
  monthly_token_allocation,
  token_balance
) VALUES (
  '37fd3629-a06a-47c8-b33a-31944afaa14c',
  'Test User',
  true,
  'trial',
  10000,
  10000
);
```

---

### 方案B: 在 `user_profiles` 表添加subscription字段 (不推荐)

#### 优点
- 前端代码改动最小

#### 缺点
- 违背原系统设计
- 需要修改已有表结构
- 可能影响其他代码

#### 执行步骤 (不推荐,仅供参考)
```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS monthly_token_allocation INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS token_balance INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;
```

---

## 推荐执行计划

### 立即执行 (今天)

1. ✅ **确认 `public.users` 表是否存在**
   ```bash
   curl -s "https://jzzvizacfyipzdyiqfzb.supabase.co/rest/v1/users?limit=1" \
     -H "apikey: SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer SERVICE_ROLE_KEY"
   ```

2. ⏳ **如果不存在,创建 `public.users` 表**
   - 方法: 在Supabase Dashboard SQL编辑器执行migration
   - 文件: `supabase/migrations/20251011_create_users_table.sql`
   - URL: https://supabase.com/dashboard/project/jzzvizacfyipzdyiqfzb/sql/new

3. ⏳ **修改前端代码**
   - 搜索所有 `.from('user_profiles')` 和 `.from("user_profiles")`
   - 改为 `.from('users')`
   - 注意主键改为 `id` 而不是 `user_id`

4. ⏳ **为test user创建记录**
   ```sql
   INSERT INTO public.users (id, display_name, subscription_tier, token_balance, monthly_token_allocation, onboarded)
   VALUES (
     '37fd3629-a06a-47c8-b33a-31944afaa14c',
     'Test User',
     'trial',
     10000,
     10000,
     true
   );
   ```

5. ⏳ **构建并部署**
   ```bash
   cd apps/frontend
   npm run build
   git add -A
   git commit -m "fix: Use correct table name 'users' instead of 'user_profiles'"
   git push
   ```

6. ⏳ **重新运行E2E测试验证**
   ```bash
   PREVIEW_BASE=https://www.urlchecker.dev node scripts/tests/run-all-tests.mjs
   ```

---

## 影响范围分析

### 需要修改的文件 (预估)

基于搜索结果,以下文件可能需要修改:

1. ✅ **`apps/frontend/src/core/hooks/use-user-subscription.ts`** (已确认)
   - 将 `from('user_profiles')` 改为 `from('users')`
   - 将 `.eq('user_id', ...)` 改为 `.eq('id', ...)`

2. ⏳ **`apps/frontend/src/lib/server/queries.ts`**
   - 确认 `getUserDataById` 函数使用的表名

3. ⏳ **其他可能的文件**
   - 搜索: `grep -r "user_profiles" apps/frontend/src/`
   - 逐一确认并修改

### 数据库变更

- **新表**: `public.users` (如果不存在)
- **迁移数据**: 从 `auth.users` 和 `user_profiles` 合并到 `users`
- **RLS策略**: 已在migration中定义

---

## 验证清单

修复完成后,验证以下内容:

- [ ] `public.users` 表已创建
- [ ] Test user记录已存在于 `users` 表
- [ ] 前端代码已修改为查询 `users` 表
- [ ] 构建成功无TypeScript错误
- [ ] 部署成功
- [ ] 浏览器访问dashboard无406错误
- [ ] E2E测试通过率提升
- [ ] Console日志无subscription相关错误

---

## 回滚计划

如果修复出现问题:

1. **代码回滚**:
   ```bash
   git revert HEAD
   git push
   ```

2. **数据库回滚**:
   ```sql
   -- 删除users表(如果新创建)
   DROP TABLE IF EXISTS public.users CASCADE;
   ```

3. **前端代码恢复**:
   - 恢复使用 `user_profiles` 表
   - 恢复 `maybeSingle()` 和fallback逻辑

---

## 相关文件

- Migration脚本: `supabase/migrations/20251011_create_users_table.sql`
- 前端Hook: `apps/frontend/src/core/hooks/use-user-subscription.ts`
- 诊断报告: `docs/TestAll/P0-DIAGNOSIS-2025-10-12.md`
- 状态报告: `docs/TestAll/P0_FIX_STATUS_2025-10-12.md`

---

**下一步**: 执行修复计划,从步骤1开始
