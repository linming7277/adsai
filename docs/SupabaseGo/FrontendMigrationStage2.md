# AdsAI 前端迁移阶段2 - Supabase 基础接入

## 本阶段目标
- 在 Next.js 全局入口挂载 Supabase Auth Provider，为后续页面迁移准备上下文。
- 更新前端 API 客户端，优先使用 Supabase Access Token 与后端 Go 微服务通信，并保留 Firebase 兼容路径。
- 补充 `.env` 模板，确保本地/测试/生产环境均具备 Supabase 所需的公开配置项。

## 已完成功能
- **`pages/_app.tsx`**：以 `SupabaseAuthProvider` 作为唯一顶层 Provider，移除原有 Firebase Provider；Supabase Session 成为全局状态来源。
- **`lib/api/client.ts`**：
  - 新增 `resolveAuthToken`，优先获取 Supabase Access Token；无法获取时回退使用 Firebase ID Token。
  - 标准化请求头：`Authorization` 统一携带 Bearer Token，同时根据来源附加 `X-Supabase-Access-Token` 或 `X-Firebase-ID-Token` 便于后端判别。
- **`lib/supabase/client.ts` & Auth 相关组件**：引入延迟初始化、缺失配置告警，避免在未配置 Supabase 时直接崩溃；`AuthContext`、`SupabaseGoogleLogin` 与 `/auth/callback` 统一走 `getSupabaseClient()`。
- **环境变量模板**：为开发、测试、生产模板加入 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` 占位符，提醒开发者补全配置。

## 使用说明
1. 在 `apps/frontend/.env.local`（或对应环境变量管理平台）中设置：
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<public-anon-key>
   ```
   > 生产环境应通过 Secret Manager / GitHub Actions Secrets 等安全渠道注入。
2. 运行 `npm run dev`（或 `pnpm dev`）时，如果未配置 Supabase，会在控制台看到警告提示，功能保持可用但不会建立 Supabase 会话。
3. 后端需更新 API 网关（或各微服务）支持 Supabase JWT 校验：
   - `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>`
   - `X-Supabase-Access-Token: <同上>`
   - 保留对 Firebase `X-Firebase-ID-Token` 的兼容，迁移期间不影响旧用户。

## 后续规划
- **认证页面迁移**：重写 `/auth/sign-in`、`/auth/password-reset` 等视图，改用 Supabase OAuth / 邮箱登录流程。
- **用户 Session 统一**：调整 `UserSessionContext` 与后端 `with-authed-user`，逐步脱离 Firebase Admin。
- **业务 Hook 更新**：待后端完成 Supabase 鉴权后，逐步验证 Dashboard/Offers/Tasks 等模块可以完全使用 Supabase Token。
- **监控与调试**：在 Go 微服务侧增加对 Supabase Token 的日志记录与错误告警，便于排查迁移初期问题。

> 阶段2完成后，前端已经具备 Supabase 鉴权基础设施，可逐步迁移认证和业务数据访问逻辑，并在迁移过渡期保持 Firebase 路径可用。
