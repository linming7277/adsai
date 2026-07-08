# 🚀 Supabase迁移快速开始指南

## 📋 第一步：创建Supabase项目（10分钟）

### 1. 注册/登录Supabase

访问：https://app.supabase.com

### 2. 创建新项目

```
项目名称: autoads
组织: 选择或创建
数据库密码: [生成强密码并保存]
区域: Asia Northeast (Tokyo)
定价: Pro ($25/月)
```

### 3. 记录项目信息

创建完成后，在Settings > API中找到：

```bash
# 添加到 apps/frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_KEY=[your-service-key]  # 仅用于服务端
```

---

## 📋 第二步：配置Google OAuth（5分钟）

### 1. 在Supabase Dashboard

1. 进入 Authentication > Providers
2. 找到Google，点击启用
3. 输入：
   - Client ID: `644672509127-sj0oe3shl7nltvn1agiuf1rv2vqgfsuj.apps.googleusercontent.com`
   - Client Secret: [从Google Cloud Console获取]

### 2. 在Google Cloud Console

访问：https://console.cloud.google.com/apis/credentials

1. 找到OAuth 2.0 Client ID
2. 添加授权的重定向URI：
   ```
   https://[your-project-ref].supabase.co/auth/v1/callback
   ```
3. 添加授权的JavaScript来源：
   ```
   https://www.urlchecker.dev
   https://www.autoads.dev
   http://localhost:3000
   ```

---

## 📋 第三步：安装依赖（2分钟）

```bash
cd apps/frontend

# 安装Supabase
npm install @supabase/supabase-js @supabase/auth-ui-react @supabase/auth-ui-shared

# 移除Firebase（可选，先保留以便回滚）
# npm uninstall firebase reactfire
```

---

## 📋 第四步：创建Supabase客户端（5分钟）

### 创建文件：`lib/supabase/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## 📋 第五步：创建登录组件（10分钟）

### 创建文件：`components/auth/SupabaseGoogleLogin.tsx`

```typescript
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function SupabaseGoogleLogin() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error('Login error:', error);
      alert('登录失败，请重试');
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      className="flex items-center justify-center gap-2 w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      {loading ? '登录中...' : '使用Google登录'}
    </button>
  );
}
```

---

## 📋 第六步：创建回调页面（5分钟）

### 创建文件：`pages/auth/callback.tsx`

```typescript
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase/client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // 登录成功，跳转到dashboard
        router.push('/dashboard');
      } else {
        // 登录失败，返回登录页
        router.push('/auth/sign-in');
      }
    });
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">正在完成登录...</p>
      </div>
    </div>
  );
}
```

---

## 📋 第七步：更新登录页面（5分钟）

### 修改：`pages/auth/sign-in.tsx`

```typescript
import SupabaseGoogleLogin from '@/components/auth/SupabaseGoogleLogin';
import AuthPageLayout from '@/components/auth/AuthPageLayout';

export default function SignIn() {
  return (
    <AuthPageLayout heading="登录到AutoAds">
      <div className="w-full max-w-md mx-auto">
        <SupabaseGoogleLogin />
      </div>
    </AuthPageLayout>
  );
}
```

---

## 📋 第八步：创建Auth Context（10分钟）

### 创建文件：`contexts/AuthContext.tsx`

```typescript
import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 获取初始session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 监听auth变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### 在 `_app.tsx` 中使用：

```typescript
import { AuthProvider } from '@/contexts/AuthContext';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
```

---

## 📋 第九步：测试（5分钟）

```bash
# 启动开发服务器
npm run dev

# 访问
open http://localhost:3000/auth/sign-in

# 测试登录流程
```

**期望结果**:
1. 点击"使用Google登录"
2. 跳转到Google授权页面
3. 授权后返回
4. 自动跳转到dashboard
5. ✅ 登录成功！

---

## 📋 第十步：部署（10分钟）

### 1. 更新环境变量

在Cloud Run中添加：
```bash
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
```

### 2. 部署

```bash
git add .
git commit -m "feat: integrate Supabase Auth"
git push origin main
```

### 3. 验证

访问：https://www.urlchecker.dev/auth/sign-in

测试登录功能。

---

## 🎯 完成！

**总耗时**: 约1小时

**你现在有了**:
- ✅ 可靠的Google登录
- ✅ Supabase Auth集成
- ✅ 现代化的认证流程

---

## 📊 下一步

### 短期（本周）
- [ ] 测试所有功能
- [ ] 监控错误率
- [ ] 收集用户反馈

### 中期（下周）
- [ ] 迁移用户数据
- [ ] 配置Cloud Run自定义域名
- [ ] 移除Cloudflare

### 长期（下月）
- [ ] 迁移Firestore数据到PostgreSQL
- [ ] 完全移除Firebase
- [ ] 优化性能

---

## 🆘 遇到问题？

### 问题1: 登录后没有跳转

**检查**:
```typescript
// 确认回调URL配置正确
console.log(window.location.origin); // 应该是你的域名
```

### 问题2: Google OAuth错误

**检查**:
1. Google Cloud Console中的重定向URI
2. Supabase Dashboard中的Google配置
3. Client ID和Secret是否正确

### 问题3: 环境变量未生效

**解决**:
```bash
# 重启开发服务器
npm run dev
```

---

**准备好开始了吗？** 🚀

从第一步开始，一步一步来！
