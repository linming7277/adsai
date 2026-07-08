# 🚀 Supabase设置说明

## ✅ 已完成的代码

我已经创建了以下文件：

1. ✅ `apps/frontend/lib/supabase/client.ts` - Supabase客户端
2. ✅ `apps/frontend/src/components/auth/SupabaseGoogleLogin.tsx` - Google登录组件
3. ✅ `apps/frontend/src/pages/auth/callback.tsx` - Auth回调页面
4. ✅ `apps/frontend/src/contexts/AuthContext.tsx` - Auth Context
5. ✅ `apps/frontend/.env.local` - 环境变量模板（已更新）

---

## 📋 你需要完成的步骤

### 步骤1: 创建Supabase项目（10分钟）

1. **访问** https://app.supabase.com

2. **创建新项目**:
   - 项目名称: `autoads`
   - 数据库密码: [生成强密码并保存]
   - 区域: `Asia Northeast (Tokyo)`
   - 定价: `Free` (免费版本，完全够用！)

3. **获取项目信息**:
   - 进入 Settings > API
   - 复制 `Project URL`
   - 复制 `anon public` key
   - 复制 `service_role` key（仅用于服务端）

4. **更新环境变量**:
   
   编辑 `apps/frontend/.env.local`，替换：
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_KEY=your-service-key-here
   ```

---

### 步骤2: 配置Google OAuth（5分钟）

#### 在Supabase Dashboard

1. 进入 `Authentication` > `Providers`
2. 找到 `Google`，点击启用
3. 输入：
   - **Client ID**: `644672509127-sj0oe3shl7nltvn1agiuf1rv2vqgfsuj.apps.googleusercontent.com`
   - **Client Secret**: [从Google Cloud Console获取]
4. 记录回调URL（会显示类似）:
   ```
   https://[your-project-ref].supabase.co/auth/v1/callback
   ```

#### 在Google Cloud Console

1. 访问 https://console.cloud.google.com/apis/credentials
2. 找到OAuth 2.0 Client ID: `644672509127-sj0oe3shl7nltvn1agiuf1rv2vqgfsuj.apps.googleusercontent.com`
3. 点击编辑
4. 在"授权的重定向URI"中添加:
   ```
   https://[your-project-ref].supabase.co/auth/v1/callback
   ```
5. 在"授权的JavaScript来源"中确保有:
   ```
   http://localhost:3000
   https://www.urlchecker.dev
   https://www.autoads.dev
   ```
6. 保存

---

### 步骤3: 安装依赖（2分钟）

```bash
cd apps/frontend
npm install @supabase/supabase-js @supabase/auth-ui-react @supabase/auth-ui-shared
```

---

### 步骤4: 更新登录页面（5分钟）

编辑 `apps/frontend/src/pages/auth/sign-in.tsx`，添加Supabase登录选项：

```typescript
import SupabaseGoogleLogin from '~/components/auth/SupabaseGoogleLogin';

// 在现有的OAuthProviders下方添加
<div className="mt-4">
  <div className="relative">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-gray-300"></div>
    </div>
    <div className="relative flex justify-center text-sm">
      <span className="px-2 bg-white text-gray-500">或使用新的登录方式</span>
    </div>
  </div>
  <div className="mt-4">
    <SupabaseGoogleLogin />
  </div>
</div>
```

---

### 步骤5: 添加Auth Provider（2分钟）

编辑 `apps/frontend/src/pages/_app.tsx`，添加AuthProvider：

```typescript
import { AuthProvider } from '~/contexts/AuthContext';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      {/* 现有的内容 */}
      <Component {...pageProps} />
    </AuthProvider>
  );
}
```

---

### 步骤6: 测试（5分钟）

```bash
# 启动开发服务器
npm run dev

# 访问
open http://localhost:3000/auth/sign-in
```

**测试流程**:
1. 点击"使用Google登录"（Supabase版本）
2. 应该跳转到Google授权页面
3. 授权后返回
4. 应该看到"正在完成登录..."
5. 自动跳转到dashboard
6. ✅ 登录成功！

---

## 🔍 验证成功

### Console日志应该显示：

```
[Supabase Auth] Initiating Google sign-in...
（跳转到Google）
（授权后返回）
[Auth Callback] Checking session...
[Auth Callback] Session found: { user: "your@email.com", expires: ... }
[Auth Context] Initial session loaded: { user: "your@email.com", ... }
```

### 在Supabase Dashboard验证：

1. 进入 `Authentication` > `Users`
2. 应该看到你的Google账号
3. 状态应该是 `Active`

---

## 🎯 下一步

### 如果测试成功

1. ✅ Supabase Auth工作正常
2. 可以开始迁移用户数据
3. 可以逐步替换Firebase Auth

### 如果遇到问题

**问题1: 环境变量未生效**
```bash
# 重启开发服务器
npm run dev
```

**问题2: Google OAuth错误**
- 检查回调URL是否正确添加
- 检查Client ID和Secret
- 查看Supabase Dashboard的错误日志

**问题3: 回调页面一直转圈**
- 打开Console查看错误
- 检查session是否创建成功
- 查看Network标签的请求

---

## 📊 成功标准

- [ ] Supabase项目已创建
- [ ] Google OAuth已配置
- [ ] 依赖已安装
- [ ] 环境变量已设置
- [ ] 登录页面已更新
- [ ] Auth Provider已添加
- [ ] 本地测试成功
- [ ] 可以登录到dashboard

---

**完成这些步骤后，告诉我结果！** 🚀
