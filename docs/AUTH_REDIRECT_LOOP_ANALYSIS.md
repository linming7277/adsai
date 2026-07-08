# 认证重定向循环问题分析

## 问题描述

用户报告在登录过程中遇到以下严重问题：

1. **ERR_TOO_MANY_REDIRECTS** - 页面重定向过多错误
2. **404错误** - 某些页面无法访问
3. **数据为空** - 登录后Dashboard和任务管理等页面数据为空
4. **功能无法加载** - 通知面板显示"Failed to load notifications"
5. **无限重定向** - 即使完成Google授权，部分页面仍然无限重定向

## 根本原因分析

### 问题1: 重定向循环 (ERR_TOO_MANY_REDIRECTS)

**可能的原因**:

#### A. Auth Layout的重定向逻辑冲突

```typescript
// apps/frontend/src/lib/server/loaders/load-auth-page-data.ts
const loadAuthPageData = async () => {
  const { user } = await client.auth.getUser();
  
  // 如果用户已登录，重定向到appHome
  if (user && !requiresMultiFactorAuthentication) {
    redirect(configuration.paths.appHome); // → /dashboard
  }
};
```

**循环场景**:
```
1. 用户登录成功 → 有session
2. 访问 /auth → loadAuthPageData检测到user → 重定向到 /dashboard
3. 访问 /dashboard → loadAppData检测到问题 → 重定向回 /auth
4. 回到步骤2 → 无限循环
```

#### B. Dashboard Layout的数据加载失败

```typescript
// apps/frontend/src/lib/server/loaders/load-app-data.ts
const loadAppData = cache(async () => {
  const session = await requireSession(client);
  const userRecord = await getUserDataById(client, userId);
  
  if (!userRecord) {
    // 用户记录不存在 → 重定向到appHome
    return redirect(configuration.paths.appHome); // → /dashboard
  }
});
```

**问题**: 如果 `getUserDataById` 返回null，会重定向到 `/dashboard`，但这又会触发 `loadAppData`，形成循环。

#### C. Middleware的认证检查

```typescript
// apps/frontend/src/middleware.ts
async function checkAuthentication(request: NextRequest) {
  const { session } = await supabase.auth.getSession();
  
  if (!session) {
    // 没有session → 重定向到 /auth
    return NextResponse.redirect(new URL('/auth', request.url));
  }
}
```

**循环场景**:
```
1. 用户访问 /dashboard
2. Middleware检测到没有session → 重定向到 /auth
3. Auth layout检测到有user → 重定向到 /dashboard
4. 回到步骤1 → 无限循环
```

### 问题2: 用户数据不存在

**可能原因**:

#### A. Supabase触发器未执行

```typescript
// apps/frontend/src/app/auth/callback/route.ts
// 等待用户数据创建(最多3秒)
const userData = await waitForUserCreation(client, userId, 3000);

if (!userData) {
  logger.error({ userId }, 'User data not created after OAuth callback');
  return redirect('/setup-error');
}
```

**问题**: 
- Supabase的 `on_auth_user_created` 触发器可能未正确配置
- 触发器执行失败
- 触发器执行超过3秒超时

#### B. 数据库表结构问题

可能的原因：
- `users` 表不存在
- 触发器函数不存在或有错误
- 权限问题导致触发器无法写入

### 问题3: Session状态不一致

**可能原因**:

#### A. Cookie域名配置问题

```typescript
// Supabase session cookie
// 名称: sb-{project-ref}-auth-token
// 域名: 可能配置不正确
```

如果cookie的域名配置不正确，可能导致：
- Middleware看不到session
- 但Auth layout能看到user
- 导致重定向循环

#### B. SSR vs CSR的Session不同步

```typescript
// Server-side (middleware, layout)
const { session } = await supabase.auth.getSession();

// Client-side (AuthChangeListener)
client.auth.onAuthStateChange((_, user) => {
  if (!user && whenSignedOut) {
    redirectUserAway(whenSignedOut);
  }
});
```

可能出现：
- Server认为没有session
- Client认为有session
- 或反之

## 诊断步骤

### 1. 检查用户数据是否创建

```sql
-- 在Supabase SQL Editor中执行
SELECT 
  au.id,
  au.email,
  au.created_at as auth_created_at,
  u.id as user_id,
  u.email as user_email,
  u.created_at as user_created_at,
  u.onboarded
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE au.email = 'test@example.com'
ORDER BY au.created_at DESC
LIMIT 5;
```

**预期结果**: 
- `auth.users` 有记录
- `public.users` 也有对应记录
- 两者的 `id` 相同

**如果 `public.users` 为空**: 触发器未执行

### 2. 检查触发器配置

```sql
-- 检查触发器是否存在
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%auth%user%';

-- 检查触发器函数
SELECT 
  proname,
  prosrc
FROM pg_proc
WHERE proname LIKE '%auth%user%';
```

### 3. 检查Session Cookie

在浏览器DevTools → Application → Cookies中检查：

```
名称: sb-jzzvizacfyipzdyiqfzb-auth-token
域名: .preview.example.com 或 preview.example.com
路径: /
值: base64编码的JSON
```

**问题检查**:
- Cookie是否存在？
- 域名是否正确？
- 是否过期？
- HttpOnly标志是否正确？

### 4. 检查重定向循环

```bash
# 使用curl跟踪重定向
curl -L -v https://preview.example.com/dashboard 2>&1 | grep -E "< HTTP|< location"

# 检查是否有循环
curl -L --max-redirs 5 https://preview.example.com/dashboard
```

### 5. 检查日志

```bash
# 在Cloud Run或本地查看日志
# 查找以下关键词：
# - "No session found"
# - "User record not found"
# - "Redirecting to"
# - "User data not created"
```

## 解决方案

### 方案1: 修复用户数据创建触发器

#### A. 确保触发器存在

```sql
-- 创建或替换触发器函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    display_name,
    photo_url,
    onboarded,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    false,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

#### B. 测试触发器

```sql
-- 手动测试（在测试环境）
-- 1. 创建测试用户
-- 2. 检查 public.users 是否自动创建记录
```

### 方案2: 修复重定向循环

#### A. 改进loadAppData的错误处理

```typescript
// apps/frontend/src/lib/server/loaders/load-app-data.ts
const loadAppData = cache(async () => {
  try {
    const client = getSupabaseServerComponentClient();
    const session = await requireSession(client);
    const userId = session.user.id;
    
    const userRecord = await getUserDataById(client, userId);
    
    if (!userRecord) {
      logger.error(
        { userId },
        'User record not found - redirecting to setup-error'
      );
      
      // ❌ 不要重定向到 appHome (会导致循环)
      // return redirect(configuration.paths.appHome);
      
      // ✅ 重定向到专门的错误页面
      return redirect('/setup-error');
    }
    
    // ... 其他逻辑
  } catch (error) {
    if (isRedirectError(error)) {
      throw error; // 重新抛出重定向错误
    }
    
    logger.error({ error }, 'Error loading app data');
    
    // ❌ 不要重定向到首页
    // return redirectToHomePage();
    
    // ✅ 重定向到错误页面
    return redirect('/error?code=APP_DATA_LOAD_FAILED');
  }
});
```

#### B. 改进Auth Layout的重定向逻辑

```typescript
// apps/frontend/src/lib/server/loaders/load-auth-page-data.ts
const loadAuthPageData = async () => {
  const { language } = await initializeServerI18n(getLanguageCookie());
  const client = getSupabaseServerComponentClient();
  
  const { data: { user } } = await client.auth.getUser();
  
  if (user) {
    const requiresMfa = await verifyRequiresMfa(client);
    
    if (!requiresMfa) {
      // ✅ 检查用户数据是否存在
      const userRecord = await getUserDataById(client, user.id);
      
      if (userRecord) {
        // 用户数据存在，可以安全重定向
        redirect(configuration.paths.appHome);
      } else {
        // 用户数据不存在，重定向到设置页面
        redirect('/setup-error');
      }
    }
  }
  
  return { language };
};
```

#### C. 添加重定向保护

```typescript
// apps/frontend/src/lib/server/loaders/load-app-data.ts
const MAX_REDIRECT_ATTEMPTS = 3;
const REDIRECT_COOKIE_NAME = 'redirect_attempts';

const loadAppData = cache(async () => {
  // 检查重定向次数
  const redirectAttempts = parseInt(
    cookies().get(REDIRECT_COOKIE_NAME)?.value || '0'
  );
  
  if (redirectAttempts >= MAX_REDIRECT_ATTEMPTS) {
    logger.error(
      { redirectAttempts },
      'Too many redirect attempts - breaking loop'
    );
    
    // 清除cookie并显示错误
    cookies().delete(REDIRECT_COOKIE_NAME);
    return redirect('/error?code=REDIRECT_LOOP');
  }
  
  try {
    // ... 正常逻辑
  } catch (error) {
    // 增加重定向计数
    cookies().set(REDIRECT_COOKIE_NAME, String(redirectAttempts + 1), {
      maxAge: 60, // 1分钟后过期
    });
    
    throw error;
  }
});
```

### 方案3: 改进OAuth回调处理

```typescript
// apps/frontend/src/app/auth/callback/route.ts
export async function GET(request: NextRequest) {
  const authCode = searchParams.get('code');
  
  if (authCode) {
    try {
      const { error, data } = await client.auth.exchangeCodeForSession(authCode);
      
      if (error) {
        return onError({ error: error.message });
      }
      
      const userId = data.user.id;
      
      // ✅ 增加等待时间和重试逻辑
      const userData = await waitForUserCreation(client, userId, 5000); // 5秒
      
      if (!userData) {
        logger.error({ userId }, 'User data not created - attempting manual creation');
        
        // ✅ 尝试手动创建用户记录
        try {
          await createUserRecord(client, data.user);
          logger.info({ userId }, 'User record created manually');
        } catch (createError) {
          logger.error({ userId, error: createError }, 'Failed to create user record');
          return redirect('/setup-error?reason=user_creation_failed');
        }
      }
      
      // ... 其他逻辑
      
      return redirect(nextUrl || configuration.paths.appHome);
    } catch (error) {
      logger.error({ error }, 'Error during OAuth callback');
      return onError({ error: 'Authentication failed' });
    }
  }
  
  // ... 其他逻辑
}

// 新增：手动创建用户记录
async function createUserRecord(client: any, user: any) {
  const { error } = await client.from('users').insert({
    id: user.id,
    email: user.email,
    display_name: user.user_metadata?.full_name || user.email,
    photo_url: user.user_metadata?.avatar_url,
    onboarded: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  
  if (error) {
    throw error;
  }
}
```

### 方案4: 添加错误页面

```typescript
// apps/frontend/src/app/setup-error/page.tsx
export default async function SetupErrorPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const client = getSupabaseServerComponentClient();
  const { data: { user } } = await client.auth.getUser();
  
  if (!user) {
    redirect('/auth');
  }
  
  const userData = await getUserDataById(client, user.id);
  
  if (userData?.onboarded) {
    // 用户数据已存在，重定向到dashboard
    redirect(configuration.paths.appHome);
  }
  
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-bold">Setup Error</h1>
        <p>
          There was an error setting up your account. 
          {searchParams.reason && ` Reason: ${searchParams.reason}`}
        </p>
        <div className="space-y-2">
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
          <Button variant="outline" onClick={() => signOut()}>
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
```

## 立即行动项

### 优先级P0 (立即修复)

1. **检查Supabase触发器**
   ```bash
   # 登录Supabase Dashboard
   # → SQL Editor
   # → 执行诊断SQL
   ```

2. **检查现有用户数据**
   ```sql
   SELECT COUNT(*) FROM auth.users;
   SELECT COUNT(*) FROM public.users;
   -- 如果数量不一致，说明触发器有问题
   ```

3. **修复重定向循环**
   - 修改 `loadAppData` 的错误处理
   - 不要重定向到 `appHome`，改为 `/setup-error`

### 优先级P1 (今天完成)

4. **改进OAuth回调**
   - 增加等待时间到5秒
   - 添加手动创建用户记录的fallback

5. **添加重定向保护**
   - 实现重定向计数器
   - 防止无限循环

6. **改进错误页面**
   - 提供更好的错误信息
   - 添加重试和登出选项

### 优先级P2 (本周完成)

7. **添加监控和告警**
   - 监控重定向循环
   - 监控用户创建失败率
   - 监控OAuth回调失败率

8. **改进日志**
   - 添加更详细的日志
   - 包含用户ID、时间戳、错误详情

## 测试计划

### 1. 本地测试

```bash
# 1. 清除所有cookies
# 2. 访问 http://localhost:3000
# 3. 点击"开始"按钮
# 4. 完成Google登录
# 5. 检查是否成功进入Dashboard
# 6. 检查浏览器Console是否有错误
# 7. 检查Network面板是否有重定向循环
```

### 2. 预发环境测试

```bash
# 1. 使用新的Google账号
# 2. 完成注册流程
# 3. 检查Supabase Dashboard中的用户数据
# 4. 检查Cloud Run日志
# 5. 验证Dashboard数据加载
```

### 3. 数据库验证

```sql
-- 测试后执行
SELECT 
  au.id,
  au.email,
  au.created_at,
  u.id IS NOT NULL as has_user_record,
  u.onboarded
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE au.created_at > NOW() - INTERVAL '1 hour'
ORDER BY au.created_at DESC;
```

## 监控指标

### 关键指标

1. **用户创建成功率**
   - 目标: >99%
   - 计算: (public.users数量 / auth.users数量) * 100

2. **OAuth回调成功率**
   - 目标: >95%
   - 监控: `/auth/callback` 的200 vs 307响应

3. **重定向循环发生率**
   - 目标: 0
   - 监控: ERR_TOO_MANY_REDIRECTS错误

4. **Dashboard加载成功率**
   - 目标: >98%
   - 监控: `/dashboard` 的200响应率

## 相关文件

- `apps/frontend/src/middleware.ts` - 认证中间件
- `apps/frontend/src/lib/server/loaders/load-app-data.ts` - Dashboard数据加载
- `apps/frontend/src/lib/server/loaders/load-auth-page-data.ts` - Auth页面数据加载
- `apps/frontend/src/app/auth/callback/route.ts` - OAuth回调处理
- `apps/frontend/src/lib/user/require-session.ts` - Session验证
- `apps/frontend/src/components/AuthChangeListener.tsx` - 客户端认证监听

## 总结

这是一个**严重的生产问题**，需要立即修复。主要原因是：

1. **Supabase触发器可能未正确配置** - 导致用户数据未创建
2. **重定向逻辑冲突** - 导致无限循环
3. **错误处理不当** - 没有提供清晰的错误信息和恢复路径

建议立即执行P0优先级的修复，然后部署到预发环境测试。
