# Supabase 完整配置指南

本文档提供 AutoAds 项目中 Supabase 的完整配置步骤，确保开发人员可以独立完成环境搭建。

---

## 一、Supabase 项目创建

### 1.1 创建项目

1. 访问 [https://supabase.com](https://supabase.com)
2. 点击 "New Project"
3. 填写项目信息：
   - **Name**: `autoads-production`（生产环境）或 `autoads-dev`（开发环境）
   - **Database Password**: 生成强密码（保存到密码管理器）
   - **Region**: 选择 `us-west-1`（靠近目标用户）
   - **Pricing Plan**: 选择 `Pro`（支持更高并发和存储）

4. 等待 2-3 分钟，项目创建完成

### 1.2 获取项目凭证

创建完成后，进入 **Settings → API**：

```bash
# 记录以下信息（需要保存到环境变量）
Project URL:     https://xxxxxxxxxxxxx.supabase.co
anon key:        eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**重要**：
- `anon key`：前端使用（公开可见，受 RLS 保护）
- `service_role key`：后端使用（绕过 RLS，需保密）

### 1.3 环境变量配置

在项目根目录创建 `.env.local` 文件：

```bash
# apps/frontend/.env.local

# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service Role Key（仅后端使用，不要暴露到前端）
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# NextAuth 配置
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-here  # 运行 openssl rand -base64 32 生成

# 数据库连接（用于迁移脚本）
DATABASE_URL=postgresql://postgres:your-db-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
```

**安全提示**：
- 将 `.env.local` 添加到 `.gitignore`
- 使用 [Secret Manager](https://cloud.google.com/secret-manager) 管理生产环境密钥

---

## 二、数据库表结构创建

### 2.1 执行 SQL 脚本

进入 Supabase Dashboard → **SQL Editor**，执行以下脚本：

#### 脚本 1: User 表（扩展 auth.users）

```sql
-- 用户扩展表（存储业务字段）
CREATE TABLE "User" (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100),
  avatar_url TEXT,
  company VARCHAR(100),
  
  -- 订阅相关字段
  subscription_tier VARCHAR(20) DEFAULT 'trial', -- trial, pro, max, elite
  subscription_start_date TIMESTAMP WITH TIME ZONE,
  subscription_end_date TIMESTAMP WITH TIME ZONE,
  trial_end_date TIMESTAMP WITH TIME ZONE,
  
  -- Token 相关字段
  token_balance INTEGER DEFAULT 100,
  monthly_token_allocation INTEGER DEFAULT 1000,
  
  -- 签到相关字段
  current_checkin_streak INTEGER DEFAULT 0,
  last_checkin_date DATE,
  total_checkin_days INTEGER DEFAULT 0,
  
  -- 邀请相关字段
  referred_by UUID REFERENCES "User"(id),
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_user_email ON "User"(email);
CREATE INDEX idx_user_subscription ON "User"(subscription_tier, subscription_end_date);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_updated_at
  BEFORE UPDATE ON "User"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 策略
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON "User" FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON "User" FOR UPDATE
  USING (auth.uid() = id);
```

#### 脚本 2: Offer 表

```sql
-- Offer 表
CREATE TABLE "Offer" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  
  -- 基本信息
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  network VARCHAR(100),
  payout DECIMAL(10, 2),
  status VARCHAR(20) DEFAULT 'active', -- active, paused, pending
  description TEXT,
  
  -- 品牌信息（自动提取）
  brand_name VARCHAR(100),
  brand_logo TEXT,
  final_domain VARCHAR(255),
  favicon TEXT,
  
  -- 评估相关字段
  url_hash VARCHAR(64), -- SHA-256 hash for aggregation
  evaluation_score INTEGER, -- 0-100
  ai_recommendation_score INTEGER, -- 0-100（仅 Elite 用户）
  ai_recommendation_reasons JSONB,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_offer_user_id ON "Offer"(user_id);
CREATE INDEX idx_offer_status ON "Offer"(status);
CREATE INDEX idx_offer_url_hash ON "Offer"(url_hash);
CREATE INDEX idx_offer_user_status ON "Offer"(user_id, status);
CREATE INDEX idx_offer_filters ON "Offer"(user_id, status, network, payout, ai_recommendation_score);

-- 更新时间触发器
CREATE TRIGGER update_offer_updated_at
  BEFORE UPDATE ON "Offer"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 策略
ALTER TABLE "Offer" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own offers"
  ON "Offer" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own offers"
  ON "Offer" FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own offers"
  ON "Offer" FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own offers"
  ON "Offer" FOR DELETE
  USING (auth.uid() = user_id);
```

#### 脚本 3: OfferEvaluation 表

```sql
-- Offer 评估记录表
CREATE TABLE "OfferEvaluation" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES "Offer"(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  
  -- 评估信息
  url_hash VARCHAR(64) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, success, failed
  
  -- 评估结果
  evaluation_score INTEGER,
  ai_recommendation_score INTEGER,
  ai_recommendation_reasons JSONB,
  
  -- SimilarWeb 数据（完整 JSON 存储）
  similarweb_data JSONB,
  
  -- Token 消耗
  tokens_consumed INTEGER DEFAULT 1,
  
  -- 错误信息
  error_message TEXT,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX idx_evaluation_offer_id ON "OfferEvaluation"(offer_id, created_at DESC);
CREATE INDEX idx_evaluation_user_id ON "OfferEvaluation"(user_id, created_at DESC);
CREATE INDEX idx_evaluation_url_hash ON "OfferEvaluation"(url_hash);
CREATE INDEX idx_evaluation_status ON "OfferEvaluation"(status);

-- RLS 策略
ALTER TABLE "OfferEvaluation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own evaluations"
  ON "OfferEvaluation" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own evaluations"
  ON "OfferEvaluation" FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

#### 脚本 4: TokenConsumptionLog 表

```sql
-- Token 消耗日志表
CREATE TABLE "TokenConsumptionLog" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  
  -- 消耗信息
  amount INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL, -- evaluation, checkin_reward, referral_reward
  
  -- 详细信息
  basic_evaluation_tokens INTEGER DEFAULT 0,
  ai_evaluation_tokens INTEGER DEFAULT 0,
  
  -- 关联记录
  offer_id UUID REFERENCES "Offer"(id),
  evaluation_id UUID REFERENCES "OfferEvaluation"(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_token_log_user_date ON "TokenConsumptionLog"(user_id, created_at DESC);
CREATE INDEX idx_token_log_action ON "TokenConsumptionLog"(action);

-- RLS 策略
ALTER TABLE "TokenConsumptionLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own token logs"
  ON "TokenConsumptionLog" FOR SELECT
  USING (auth.uid() = user_id);
```

#### 脚本 5: UserCheckin 表

```sql
-- 用户签到记录表
CREATE TABLE "UserCheckin" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  
  -- 奖励信息
  tokens_earned INTEGER NOT NULL DEFAULT 10,
  bonus_tokens INTEGER DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 1,
  milestone VARCHAR(50),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, checkin_date)
);

-- 创建索引
CREATE INDEX idx_user_checkin_user_date ON "UserCheckin"(user_id, checkin_date DESC);

-- RLS 策略
ALTER TABLE "UserCheckin" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own checkin records"
  ON "UserCheckin" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own checkin records"
  ON "UserCheckin" FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

#### 脚本 6: UserReferralCode 和 ReferralRecord 表

```sql
-- 用户邀请码表
CREATE TABLE "UserReferralCode" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) NOT NULL UNIQUE,
  
  -- 统计字段
  total_invites INTEGER DEFAULT 0,
  successful_invites INTEGER DEFAULT 0,
  total_rewards_days INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 邀请记录表
CREATE TABLE "ReferralRecord" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) NOT NULL,
  
  -- 奖励信息
  referee_reward_days INTEGER NOT NULL DEFAULT 30,
  referrer_reward_days INTEGER NOT NULL DEFAULT 30,
  
  -- 状态
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, completed
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(referee_id) -- 一个用户只能被邀请一次
);

-- 创建索引
CREATE INDEX idx_referral_code_user ON "UserReferralCode"(user_id);
CREATE INDEX idx_referral_code_code ON "UserReferralCode"(referral_code);
CREATE INDEX idx_referral_record_referrer ON "ReferralRecord"(referrer_id, created_at DESC);
CREATE INDEX idx_referral_record_referee ON "ReferralRecord"(referee_id);

-- RLS 策略
ALTER TABLE "UserReferralCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReferralRecord" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referral code"
  ON "UserReferralCode" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view referral records where they are referrer"
  ON "ReferralRecord" FOR SELECT
  USING (auth.uid() = referrer_id);
```

#### 脚本 7: SimilarWebCache 表（可选）

```sql
-- SimilarWeb 缓存表（如果不使用 Redis）
CREATE TABLE "SimilarWebCache" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) NOT NULL UNIQUE,
  
  -- 缓存数据
  response_data JSONB NOT NULL,
  status VARCHAR(20) NOT NULL, -- success, failed
  
  -- 缓存时间
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 创建索引
CREATE INDEX idx_similarweb_cache_domain ON "SimilarWebCache"(domain);
CREATE INDEX idx_similarweb_cache_expires ON "SimilarWebCache"(expires_at);

-- 自动清理过期缓存（定时任务）
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM "SimilarWebCache" WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

### 2.2 验证表结构

执行以下查询验证所有表已创建：

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

应该看到：
- User
- Offer
- OfferEvaluation
- TokenConsumptionLog
- UserCheckin
- UserReferralCode
- ReferralRecord
- SimilarWebCache（可选）

---

## 三、Row Level Security (RLS) 策略详解

### 3.1 为什么需要 RLS？

RLS 确保：
1. 用户只能看到自己的数据
2. 防止越权访问（即使前端代码被篡改）
3. 简化后端权限检查逻辑

### 3.2 RLS 工作原理

当前端使用 `anon key` 访问数据库时：

```typescript
// 前端代码
const { data } = await supabase
  .from('Offer')
  .select('*')
  // 不需要手动添加 .eq('user_id', currentUserId)
  // RLS 策略会自动过滤
```

Supabase 自动执行：

```sql
-- 实际执行的 SQL（RLS 自动添加 WHERE 条件）
SELECT * FROM "Offer" WHERE user_id = auth.uid();
```

### 3.3 测试 RLS 策略

#### 测试工具 1：Supabase SQL Editor

```sql
-- 切换到特定用户身份（使用他们的 JWT）
SET request.jwt.claims.sub = 'user-uuid-here';

-- 测试查询（应该只返回该用户的数据）
SELECT * FROM "Offer";
```

#### 测试工具 2：前端代码

```typescript
// apps/frontend/src/lib/test/rls-test.ts
import { createClient } from '@/lib/supabase/client';

export async function testRLS() {
  const supabase = createClient();
  
  // 登录用户 A
  await supabase.auth.signInWithPassword({
    email: 'userA@example.com',
    password: 'password123',
  });
  
  // 查询 Offers（应该只返回用户 A 的数据）
  const { data: offersA } = await supabase.from('Offer').select('*');
  console.log('User A Offers:', offersA);
  
  // 登出
  await supabase.auth.signOut();
  
  // 登录用户 B
  await supabase.auth.signInWithPassword({
    email: 'userB@example.com',
    password: 'password456',
  });
  
  // 查询 Offers（应该只返回用户 B 的数据）
  const { data: offersB } = await supabase.from('Offer').select('*');
  console.log('User B Offers:', offersB);
  
  // 验证：offersA 和 offersB 应该没有交集
  const intersection = offersA.filter(a => 
    offersB.some(b => b.id === a.id)
  );
  
  if (intersection.length === 0) {
    console.log('✅ RLS 策略工作正常');
  } else {
    console.error('❌ RLS 策略失败：用户数据泄露');
  }
}
```

### 3.4 常见 RLS 问题排查

#### 问题 1：查询返回空数据

**原因**：RLS 策略过于严格，或者用户未登录

**排查步骤**：
```sql
-- 1. 检查用户是否已登录
SELECT auth.uid(); -- 应该返回 UUID，不是 NULL

-- 2. 检查 RLS 策略是否启用
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- 3. 查看当前用户的策略
SELECT * FROM pg_policies WHERE tablename = 'Offer';
```

#### 问题 2：Service Role Key 绕过 RLS

**现象**：后端使用 `service_role key` 时，可以访问所有数据

**说明**：这是**正常行为**，`service_role key` 专门用于后端服务，绕过 RLS

**最佳实践**：
- 前端：使用 `anon key`（受 RLS 保护）
- 后端：使用 `service_role key`（手动检查权限）

```typescript
// ❌ 错误：前端使用 service_role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 危险！
);

// ✅ 正确：前端使用 anon key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

---

## 四、Supabase 客户端配置

### 4.1 前端客户端（受 RLS 保护）

```typescript
// apps/frontend/src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### 4.2 服务端客户端（Server Components）

```typescript
// apps/frontend/src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}
```

### 4.3 后端服务客户端（Go - Service Role）

```go
// services/siterank/internal/database/supabase.go
package database

import (
    "os"
    "github.com/supabase-community/supabase-go"
)

func NewSupabaseClient() *supabase.Client {
    client, err := supabase.NewClient(
        os.Getenv("SUPABASE_URL"),
        os.Getenv("SUPABASE_SERVICE_ROLE_KEY"), // 使用 Service Role Key
        &supabase.ClientOptions{},
    )
    
    if err != nil {
        panic(err)
    }
    
    return client
}
```

---

## 五、Middleware 自动注入 user_id

### 5.1 Middleware 实现

```typescript
// apps/frontend/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );
  
  // 获取当前用户
  const { data: { user } } = await supabase.auth.getUser();
  
  // 如果是受保护路由且未登录，重定向到登录页
  if (!user && isProtectedRoute(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url));
  }
  
  // 如果已登录，将 user_id 注入到 headers（供 Server Components 使用）
  if (user) {
    response.headers.set('x-user-id', user.id);
  }
  
  return response;
}

function isProtectedRoute(pathname: string): boolean {
  const protectedRoutes = [
    '/dashboard',
    '/offers',
    '/adscenter',
    '/tasks',
    '/userinfo',
  ];
  
  return protectedRoutes.some(route => pathname.startsWith(route));
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### 5.2 在 Server Components 中使用 user_id

```typescript
// apps/frontend/src/app/dashboard/page.tsx
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const headersList = headers();
  const userId = headersList.get('x-user-id');
  
  if (!userId) {
    redirect('/auth/sign-in');
  }
  
  const supabase = createClient();
  
  // RLS 会自动过滤，但也可以显式指定
  const { data: offers } = await supabase
    .from('Offer')
    .select('*')
    .eq('user_id', userId);
  
  return <DashboardClient offers={offers} />;
}
```

---

## 六、常见配置问题排查

### 问题 1：CORS 错误

**错误信息**：
```
Access to fetch at 'https://xxx.supabase.co/rest/v1/Offer' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**原因**：Supabase 项目未添加前端域名到白名单

**解决方案**：
1. 进入 Supabase Dashboard → **Settings → API**
2. 在 "**Allowed domains**" 中添加：
   - `http://localhost:3000`（开发环境）
   - `https://your-app.vercel.app`（生产环境）

---

### 问题 2：RLS 策略导致查询失败

**错误信息**：
```
new row violates row-level security policy for table "Offer"
```

**原因**：INSERT 操作时，RLS 策略中的 `WITH CHECK` 条件不满足

**解决方案**：
检查 INSERT 策略：

```sql
-- 确保策略允许用户插入自己的数据
CREATE POLICY "Users can insert their own offers"
  ON "Offer" FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

前端代码确保传入 `user_id`：

```typescript
const { data, error } = await supabase
  .from('Offer')
  .insert({
    user_id: user.id, // 必须传入
    name: 'Nike Shoes',
    url: 'https://example.com',
  });
```

---

### 问题 3：JWT 过期导致 401 错误

**错误信息**：
```
JWT expired
```

**原因**：用户 Token 过期（默认 1 小时）

**解决方案**：
实现自动刷新 Token：

```typescript
// apps/frontend/src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  // 监听 Token 过期事件
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') {
      console.log('Token refreshed successfully');
    }
  });
  
  return supabase;
}
```

Supabase 会自动刷新 Token，无需手动处理。

---

### 问题 4：数据库连接池耗尽

**错误信息**：
```
remaining connection slots are reserved for non-replication superuser connections
```

**原因**：并发连接数超过限制（Free Plan 限制 60 个连接）

**解决方案**：
1. 升级到 Pro Plan（支持 200 个连接）
2. 使用连接池（Supavisor）：

进入 Supabase Dashboard → **Settings → Database** → 启用 **Connection Pooling**

使用池化连接字符串：
```bash
DATABASE_URL=postgresql://postgres.xxxxx:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

---

### 问题 5：环境变量未生效

**现象**：代码中读取环境变量为 `undefined`

**排查步骤**：

1. **检查文件位置**：
   - Next.js 项目：`.env.local` 应该在项目根目录
   - Go 服务：使用 `godotenv` 加载 `.env` 文件

2. **检查变量命名**：
   - 前端可访问：必须以 `NEXT_PUBLIC_` 开头
   - 服务端私密变量：不需要前缀

3. **重启开发服务器**：
   ```bash
   # 停止服务
   Ctrl + C
   
   # 重新启动
   npm run dev
   ```

4. **验证变量加载**：
   ```typescript
   console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
   ```

---

## 七、生产环境配置清单

### 7.1 安全检查清单

- [ ] **Service Role Key** 未暴露到前端代码
- [ ] `.env.local` 已添加到 `.gitignore`
- [ ] 生产环境密钥已保存到 Secret Manager
- [ ] 数据库密码强度 > 16 位
- [ ] RLS 策略已启用并测试
- [ ] CORS 白名单仅包含信任域名

### 7.2 性能优化清单

- [ ] 数据库索引已创建
- [ ] 启用 Connection Pooling
- [ ] 启用 Supabase CDN（自动启用）
- [ ] 配置 Database Replication（高可用）

### 7.3 监控配置清单

- [ ] 启用 Supabase Logs（Dashboard → Logs）
- [ ] 配置 Webhook 监控（数据库错误告警）
- [ ] 集成 Sentry 错误追踪
- [ ] 配置 Uptime Robot 监控数据库可用性

---

## 八、快速验证脚本

### 8.1 测试数据库连接

```typescript
// apps/frontend/src/lib/test/db-connection-test.ts
import { createClient } from '@/lib/supabase/client';

export async function testDatabaseConnection() {
  const supabase = createClient();
  
  console.log('Testing Supabase connection...');
  
  // 1. 测试基本连接
  const { data, error } = await supabase.from('User').select('count');
  
  if (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
  
  console.log('✅ Database connection successful');
  
  // 2. 测试 RLS 策略
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.warn('⚠️  User not logged in, skipping RLS test');
    return true;
  }
  
  const { data: offers } = await supabase.from('Offer').select('*');
  console.log(`✅ RLS test passed: Found ${offers?.length || 0} offers`);
  
  return true;
}
```

运行测试：
```bash
npm run test:db-connection
```

---

## 九、参考资源

| 资源 | 链接 |
|------|------|
| Supabase 官方文档 | https://supabase.com/docs |
| RLS 策略指南 | https://supabase.com/docs/guides/auth/row-level-security |
| Next.js + Supabase | https://supabase.com/docs/guides/getting-started/quickstarts/nextjs |
| Supabase Go 客户端 | https://github.com/supabase-community/supabase-go |
| 数据库迁移工具 | https://github.com/supabase/cli |

---

**文档版本**: v1.0  
**最后更新**: 2025-10-09  
**维护者**: 后端开发团队
