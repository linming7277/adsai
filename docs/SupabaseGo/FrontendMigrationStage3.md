# AutoAds 前端迁移阶段3 - 认证流程切换

## 本阶段目标
- 将前端登录/重置密码/邀请流程从 Firebase 迁移到 Supabase。
- 建立 Supabase Session 驱动的路由守卫，逐步替换 Reactfire/Firebase 依赖。
- 清理组织邀请与邮箱链接登录等已下线场景，避免旧流程干扰迁移。

## 完成事项
- **登录页** (`pages/auth/sign-in.tsx`)
  - 使用 Supabase Auth Context 监测 Session，已登录用户自动跳转 Dashboard。
  - 仅保留 `SupabaseGoogleLogin` 登录入口，并统一通过 Supabase `signOut` 处理退出。
- **找回密码** (`pages/auth/password-reset.tsx`)
  - 改为调用 `supabase.auth.resetPasswordForEmail`，异常时给出统一提示。
- **邮件链接 / 组织邀请**
  - `auth/link`、`auth/invite/[code]` 显示停用提示并自动返回登录页，避免旧 Firebase 流程干扰。
- **路由守卫** (`components/RouteShell.tsx`)
  - 移除 `GuardedPage`、`FirebaseFirestoreProvider` 等 Firebase 依赖，改为 Supabase Session 控制访问。
  - Header / Sidebar / 移动导航同样使用 Supabase Session 与登出逻辑。
- **个人设置页面**
  - `settings/profile` 使用 Supabase 更新 `full_name`，邮箱/密码/认证子页改为指引信息，暂时关闭 Firebase 功能模块。
- **服务端 Props** (`lib/props/with-auth-props.ts`)
  - 精简为仅返回 i18n 与 CSRF Token，不再调用 Firebase Admin。
- **基础设施**
  - Secret Manager 补充 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_KEY` 新版本。
  - `tsconfig.json` 新增 `~/contexts/*` 别名，对应 Supabase Auth Context。

## 待办 / 下一阶段
- 重构 Profile、Organizations、Admin 模块的 Reactfire 调用，接入 Supabase / Go API。
- 后端 `with-authed-user` 改为校验 Supabase JWT，逐步移除 Firebase Admin。
- 梳理多因素认证、邮箱/密码注册等组件，明确保留或下线策略。
- 更新测试脚本与类型定义，彻底剔除 Firebase SDK 依赖。
- 编写 Supabase 登录与密码重置操作手册并同步运维文档。

> 本阶段完成后，登录/退出核心流程已切换至 Supabase，主路由守卫与服务端 Props 不再依赖 Firebase。下一步将围绕用户资料、Profile 设置、Admin 功能继续替换 Firebase 调用。
