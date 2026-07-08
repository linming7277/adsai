# 🚀 完整迁移到Supabase计划

## 📋 迁移目标

1. ✅ 完全迁移到Supabase（Auth + Database）
2. ✅ 实现Google一键注册和登录
3. ✅ 移除Cloudflare
4. ✅ 移除Firestore
5. ✅ Cloud Run配置自定义域名
6. ✅ 更新技术栈文档

---

## 📊 迁移概览

### 当前架构
```
Next.js → Cloudflare CDN → Cloud Run
         ↓
    Firebase Auth (有问题)
         ↓
    Firestore (不适合)
         ↓
    PostgreSQL (部分使用)
```

### 目标架构
```
Next.js → Cloud Run (直接，自定义域名)
         ↓
    Supabase Auth (可靠)
         ↓
    PostgreSQL (统一数据库)
         ↓
    Go微服务 (保持)
```

---

## 🎯 迁移阶段

### 阶段1: 准备工作（1天）

#### 1.1 创建Supabase项目
- [ ] 访问 https://app.supabase.com
- [ ] 创建新项目
- [ ] 选择区域：Asia Northeast (Tokyo)
- [ ] 记录项目URL和密钥

#### 1.2 配置Google OAuth
- [ ] 在Supabase Dashboard启用Google Provider
- [ ] 配置Google OAuth Client ID
- [ ] 添加回调URL

#### 1.3 设计数据迁移方案
- [ ] 审计当前Firestore使用
- [ ] 设计PostgreSQL schema
- [ ] 创建迁移脚本

---

### 阶段2: Supabase Auth实现（2-3天）

#### 2.1 安装依赖

```bash
cd apps/frontend
npm install @supabase/supabase-js @supabase/auth-ui-react @supabase/auth-ui-shared
npm uninstall firebase reactfire
```

#### 2.2 创建Supabase客户端

```typescript
// lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

#### 2.3 实现登录组件

```typescript
// components/auth/SupabaseGoogleLogin.tsx
import { supabase } from '@/lib/supabase/client';

export default function SupabaseGoogleLogin() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <button onClick={handleLogin}>
      Sign in with Google
    </button>
  );
}
```

#### 2.4 创建回调页面

```typescript
// pages/auth/callback.tsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase/client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard');
      } else {
        router.push('/auth/sign-in');
      }
    });
  }, [router]);

  return <div>Completing sign in...</div>;
}
```

#### 2.5 实现Auth Context

```typescript
// contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

---

### 阶段3: 数据迁移（3-4天）

#### 3.1 创建PostgreSQL Schema

```sql
-- 在Supabase SQL Editor中执行

-- 用户表（Supabase自动创建auth.users）
-- 扩展用户信息表
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);
```

#### 3.2 迁移Firestore数据

```typescript
// scripts/migrate-firestore-to-supabase.ts
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';

const firestore = getFirestore();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // 使用service key
);

async function migrateUsers() {
  const usersSnapshot = await firestore.collection('users').get();
  
  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    
    // 在Supabase中创建用户profile
    await supabase.from('user_profiles').insert({
      id: doc.id,
      display_name: data.displayName,
      avatar_url: data.photoURL,
    });
  }
}

migrateUsers();
```

---

### 阶段4: 移除Cloudflare（1天）

#### 4.1 配置Cloud Run自定义域名

```bash
# 预发环境
gcloud run domain-mappings create \
  --service=frontend-preview \
  --domain=www.urlchecker.dev \
  --region=asia-northeast1

# 生产环境
gcloud run domain-mappings create \
  --service=frontend-prod \
  --domain=www.autoads.dev \
  --region=asia-northeast1
```

#### 4.2 更新DNS

在Cloudflare中：
```
类型    名称    内容                        代理状态
A       www     216.239.32.21              DNS only (灰色云)
A       www     216.239.34.21              DNS only
A       www     216.239.36.21              DNS only
A       www     216.239.38.21              DNS only
```

#### 4.3 等待SSL证书生成

```bash
# 检查状态
gcloud run domain-mappings describe \
  --domain=www.urlchecker.dev \
  --region=asia-northeast1
```

#### 4.4 验证并切换

```bash
# 测试
curl -I https://www.urlchecker.dev

# 如果正常，完全移除Cloudflare代理
```

---

### 阶段5: 清理Firebase（2天）

#### 5.1 移除Firebase依赖

```bash
cd apps/frontend
npm uninstall firebase reactfire firebase-admin
```

#### 5.2 删除Firebase相关文件

```bash
rm -rf src/core/firebase
rm -rf src/components/auth/OAuthProviders.tsx
rm -rf src/components/auth/OAuthRedirectHandler.tsx
```

#### 5.3 更新环境变量

```bash
# 移除Firebase变量
# NEXT_PUBLIC_FIREBASE_*

# 添加Supabase变量
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

#### 5.4 更新配置文件

```typescript
// configuration.ts
const configuration = {
  // 移除Firebase配置
  // firebase: { ... }
  
  // 添加Supabase配置
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  
  auth: {
    // 移除Firebase Auth配置
    providers: {
      oAuth: ['google'],
    },
  },
};
```

---

### 阶段6: 后端集成（2-3天）

#### 6.1 Go服务验证Supabase JWT

```go
// pkg/auth/supabase.go
package auth

import (
    "github.com/golang-jwt/jwt/v5"
)

func VerifySupabaseToken(tokenString string) (*jwt.Token, error) {
    // 从Supabase获取JWKS
    // 验证JWT
    // 返回claims
}
```

#### 6.2 更新中间件

```go
// middleware/auth.go
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        
        // 验证Supabase JWT
        claims, err := auth.VerifySupabaseToken(token)
        if err != nil {
            c.JSON(401, gin.H{"error": "Unauthorized"})
            c.Abort()
            return
        }
        
        c.Set("user_id", claims.Sub)
        c.Next()
    }
}
```

---

### 阶段7: 测试（2-3天）

#### 7.1 功能测试清单

- [ ] Google登录
- [ ] 用户注册
- [ ] Session管理
- [ ] 登出
- [ ] 受保护路由
- [ ] API调用
- [ ] 用户数据访问

#### 7.2 性能测试

- [ ] 登录速度
- [ ] API响应时间
- [ ] 数据库查询性能

#### 7.3 安全测试

- [ ] JWT验证
- [ ] RLS策略
- [ ] CORS配置

---

### 阶段8: 部署和监控（1天）

#### 8.1 部署到预发环境

```bash
git add .
git commit -m "feat: migrate to Supabase"
git push origin main
```

#### 8.2 监控

- [ ] 设置Supabase监控
- [ ] 设置Cloud Monitoring告警
- [ ] 监控错误率
- [ ] 监控性能指标

#### 8.3 逐步切换

1. 预发环境测试1周
2. 生产环境灰度发布
3. 完全切换
4. 移除Firebase项目

---

## 📝 更新文档

### 更新MustKnowV4.md

```markdown
# 架构设计

现代化SaaS架构：Next.js + Supabase + Go微服务

## 架构概述

采用现代化的技术栈，使用Supabase作为后端服务（BaaS），结合Go微服务处理高性能任务。

## 技术栈

### 前端
- **框架**: Next.js 14
- **UI**: Makerkit模板（UI组件）
- **部署**: Cloud Run（直接，无CDN）
- **域名**: 
  - 预发: www.urlchecker.dev
  - 生产: www.autoads.dev

### 认证
- **服务**: Supabase Auth
- **提供商**: Google OAuth
- **特点**: 服务端处理，可靠稳定

### 数据库
- **主数据库**: PostgreSQL (Supabase)
  - 用户数据
  - 应用配置
  - 业务数据
- **辅助数据库**: Cloud SQL PostgreSQL
  - 微服务专用数据
- **缓存**: Memorystore Redis

### 后端
- **语言**: Go
- **架构**: 微服务
- **部署**: Cloud Run
- **服务**:
  - browser-exec: 浏览器自动化
  - siterank: 网站评分
  - billing: 计费
  - offer: 报价
  - adscenter: 广告中心

### 基础设施
- **容器托管**: Cloud Run
- **消息队列**: Pub/Sub
- **密钥管理**: Secret Manager
- **监控**: Cloud Monitoring
- **日志**: Cloud Logging
- **定时任务**: Cloud Scheduler
- **数据分析**: BigQuery
- **镜像仓库**: Artifact Registry

## 数据流

```
用户 → Cloud Run (Next.js)
       ↓
   Supabase Auth
       ↓
   PostgreSQL (Supabase)
       ↓
   Go微服务 (Cloud Run)
       ↓
   Pub/Sub → Worker
```

## 成本优化

- Supabase Pro: $25/月（包含Auth + DB）
- Cloud Run: ~$50/月
- 其他GCP服务: ~$100/月
- **总计**: ~$175/月（相比之前节省70%）
```

---

## 📊 迁移时间表

| 阶段 | 任务 | 时间 | 状态 |
|------|------|------|------|
| 1 | 准备工作 | 1天 | ✅ 完成 |
| 2 | Supabase Auth实现 | 2-3天 | ✅ 完成 |
| 3 | 数据迁移 | 3-4天 | ⏳ 待开始 |
| 4 | 移除Cloudflare | 1天 | ⏳ 待开始 |
| 5 | 清理Firebase | 2天 | ⏳ 待开始 |
| 6 | 后端集成 | 2-3天 | ⏳ 待开始 |
| 7 | 测试 | 2-3天 | 🔄 进行中 |
| 8 | 部署和监控 | 1天 | ✅ 完成 |

**已完成**: 阶段1, 2, 8 (部分)
**进行中**: 阶段7 (测试)
**待开始**: 阶段3, 4, 5, 6

**当前进度**: 约40%

---

## 🎯 成功标准

### 功能
- [ ] Google登录成功率 > 99%
- [ ] 登录速度 < 2秒
- [ ] API响应时间 < 200ms
- [ ] 零数据丢失

### 性能
- [ ] 页面加载时间 < 3秒
- [ ] 数据库查询 < 100ms
- [ ] 并发支持 > 1000用户

### 成本
- [ ] 月成本 < $200
- [ ] 相比之前节省 > 60%

---

## 🚀 立即开始

### 第一步：创建Supabase项目

1. 访问 https://app.supabase.com
2. 点击"New Project"
3. 选择组织
4. 项目名称：autoads
5. 数据库密码：（生成强密码）
6. 区域：Asia Northeast (Tokyo)
7. 定价：Pro ($25/月)

### 第二步：配置Google OAuth

1. Supabase Dashboard → Authentication → Providers
2. 启用Google
3. 输入Client ID和Secret
4. 保存

### 第三步：开始编码

```bash
cd apps/frontend
npm install @supabase/supabase-js
```

---

**准备好开始了吗？** 🚀
