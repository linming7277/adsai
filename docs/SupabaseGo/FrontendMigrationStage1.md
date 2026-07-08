# AdsAI 前端迁移阶段1盘点（Firebase → Supabase）

## 前端目录与核心模块概览
- **`src/pages/`**：包含仪表盘、Offers、Tokens、Tasks、Settings、AdsCenter 等核心控制台页面，以及 `/auth`、`/api`、`/admin`、`/onboarding` 等入口。
- **`src/core/`**：集中 Makerkit 基础设施；其中 `core/firebase/*` 保存了所有 Firebase 客户端/服务端封装，`core/middleware` 将 Firebase Admin 会话注入 Next.js API Route。
- **`src/lib/`**：业务层 Hook 和 API 客户端，目前 `lib/api/client.ts` 仍通过 Firebase ID Token 调用 Go 微服务；`lib/hooks`、`lib/user`、`lib/organizations` 等围绕 Firestore/Firebase 构建。
- **`src/components/`**：UI 组件与业务组件，`components/auth`、`components/organizations`、`components/profile` 等依赖 Firebase Auth/Firestore。
- **`src/contexts/AuthContext.tsx`** 与 **`src/lib/supabase/client.ts`**：已经引入 Supabase Browser Client，但未在全局 `_app` 中启用。

## Firebase 耦合点盘点
- **全局入口**：`pages/_app.tsx` 嵌套 `FirebaseAppShell`、`FirebaseAuthProvider`、`FirebaseAppCheckProvider`、`FirebaseAnalyticsProvider`，所有页面初始化均依赖 Firebase。
- **认证与 Session**：`core/session/*`、`core/firebase/components/*`、`core/firebase/hooks/use-sign-in-with-provider.ts`、`components/auth/*` 处理登录、OAuth、MFA、AppCheck、CSRF；`lib/api/client.ts` 使用 `firebase/auth` 获取 ID Token 作为 API 鉴权。
- **服务端中间件**：`core/middleware/with-authed-user.ts`、`with-admin.ts`、`with-app-check.ts`、`core/firebase/admin/*` 在 Next.js API route 中初始化 Firebase Admin，并通过 `firebaseUser` 字段传递用户信息。
- **API Routes**：`pages/api/**/*` 基于 Firebase Admin 校验或写入 Firestore（如 `api/session/sign-in.ts`、`api/user/*`、`api/organizations/*`、`api/admin/users/*`、`api/stripe/*`）。
- **业务 Hook/页面**：
  - `lib/organizations/*`、`components/organizations/*`、`pages/settings/organization/*` 读写 Firestore。
  - `lib/profile/hooks/use-update-profile.ts`、`components/profile/*` 调用 Firebase Auth/Storage。
  - `components/admin/users/ImpersonateUserModal.tsx`、`lib/admin/*` 依赖 Firebase Custom Token。
  - `RouteShell` 延迟加载 `FirebaseFirestoreProvider`、`GuardedPage` 来保护路由。
- **分析与跟踪**：`core/firebase/hooks/use-track-screen-views.ts`、`use-track-signed-in-user.ts` 调用 Firebase Analytics；`core/hooks/use-api.ts` 集成 Firebase App Check。
- **样式/配置**：`configuration.ts`、`styles/index.css` 中包含 Firebase 相关配置与样式（例如 Emulator 警告）。

## Supabase 现有集成基线
- 已存在 **`src/lib/supabase/client.ts`**（使用 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`）与 **`src/contexts/AuthContext.tsx`**（基于 `supabase.auth` 监听 Session）。
- `pages/_app.tsx` 尚未接入上述 Supabase Context，整体页面仍通过 Firebase Provider 渲染。
- 业务层数据请求 (`lib/hooks/*`) 已统一调用 `apiGet`/`apiPost`，因此只需在 API 客户端层改为附带 Supabase Access Token 即可衔接后端。
- `apps/frontend/package.json` 仍保留 `firebase`、`firebase-admin`、`reactfire` 依赖；尚未引入 Supabase Auth Helpers/SSR 支持配置。

## 控制台功能保留/移除清单
| 模块 | 主要路径 | 当前依赖 | 处理策略 |
| --- | --- | --- | --- |
| 仪表盘 Dashboard | `pages/dashboard`, `lib/hooks/useDashboard` | Go API + Firebase Token | **保留**：改用 Supabase Access Token 调用 Go API；沿用 SWR。
| Offers 管理 | `pages/offers`, `lib/hooks/useOffers` | Go Offers API + Firebase Token | **保留**：API 客户端改为 Supabase Token；校准所需后端接口。
| Tasks 工作流 | `pages/tasks`, `lib/hooks/useTasks` | Go Worker API + Firebase Token | **保留**：同上，统一鉴权。
| AdsCenter 接入 | `pages/adscenter/*` | Go AdsCenter API + Firebase Token | **保留**：迁移鉴权逻辑、保持页面结构。
| Tokens/Billing | `pages/settings/tokens`, `lib/user/useTokenBalance`, `pages/settings/subscription` | Firebase Token 调用 Billing API | **保留**：改为 Supabase Token，联合 Stripe 功能。
| Profile 设置 | `pages/settings/profile/*`, `components/profile/*` | Firebase Auth/Storage | **迁移**：替换为 Supabase Profiles 表+Storage/Go API；重写头像/密码修改流程。
| Auth 流程 | `pages/auth/*`, `components/auth/*`, `core/firebase/hooks/*` | Firebase Auth/OAuth/MFA | **迁移**：使用 Supabase Auth (`supabase-js`)，精简 MFA & AppCheck 逻辑。
| 组织/团队 | `pages/settings/organization`, `components/organizations/*`, `lib/organizations/*`, `pages/api/organizations/*` | Firestore | **移除**：按迁移方案删除页面、Hook 与 API。
| Admin 面板 | `pages/admin/*`, `lib/admin/*`, `components/admin/*` | Firebase Admin, Firestore | **待确认**：若保留需要改写为 Supabase 管理视图；若预发布阶段可禁用需产品确认。
| API 中间层 | `pages/api/**/*`, `core/middleware/*`, `core/firebase/admin/*` | Firebase Admin、Firestore | **迁移/精简**：替换为调用后端 Go 服务或 Supabase Edge Function；移除 Firebase 会话注入。
| Firebase 基础库 | `core/firebase/*`, `configuration.ts`, `core/hooks/use-api.ts` | Firebase SDK | **移除**：逐步删除相关组件与工具，改写 AppShell/Analytics 等逻辑。

## 下一步任务拆解（针对本仓库）
1. **功能清单确认**：
   - 输出《保留功能 vs 移除项》清单（当前文档草案）并评审确认。
   - 对 `pages/admin/*`、`adscenter` 等模块的保留/禁用做产品决策。
2. **Supabase 基线补全**：
   - 在 `_app.tsx` 中切换到 `AuthProvider`（Supabase）与统一 SWR 配置。
   - 补充 `lib/api/client.ts` 对 Supabase Access Token 的支持，梳理后端鉴权需求。
3. **认证/Session 迁移**：
   - 重写 `/auth/sign-in`、`/auth/callback`、`/auth/password-reset` 等页面。
   - 替换多因素认证、OAuth 提供方逻辑；移除 App Check / ReactFire。
4. **控制台页面回迁**：
   - Dashboard、Offers、Tokens、AdsCenter、Tasks、Profile 等核心页面接入 Supabase/Go API，验证数据格式。
   - Profile 相关上传/更新改用 Supabase Storage/Edge Function 或 Go 微服务。
5. **组织/团队移除**：
   - 删除 `pages/settings/organization` 与相关组件/Hook/API。
   - 清理导航入口与权限校验。
6. **Firebase 依赖清理**：
   - 删除 `core/firebase/*`、`reactfire` 相关代码。
   - 更新 `package.json` 移除 Firebase 依赖，确保构建通过。
7. **文档与配置**：
   - 更新 `.env.example`、部署脚本、README，记录 Supabase 环境变量需求。
   - 对应更新 `docs/MarkerkitGo/*` 进展记录。

> 文档若需补充或调整，请在评审后更新。后续阶段将依据本清单逐步替换 Firebase 依赖，并接入 Supabase + Go 微服务。
