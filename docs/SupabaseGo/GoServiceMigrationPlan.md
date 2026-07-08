# Go 微服务 Supabase 化改造计划（Stage 2）

## 目标
- 所有面向前端的 Go 服务统一使用 Supabase JWT 做鉴权，不再依赖 Firebase Admin。
- 服务对外提供以 `user_id` 为粒度的 API，自动按用户隔离数据。
- 管理后台/运营接口继续通过 Service Key 调用 Supabase Admin API，并记录审计日志。

## 共用组件

| 组件 | 说明 | 后续动作 |
| --- | --- | --- |
| `services/internal/auth/supabase_jwt.go` | 公共 Supabase JWT 验证器（基于 JWKS 缓存） | ✅ 已提供示例实现，可编译进任意服务 |
| `pkg/middleware/supabase.go` | HTTP 中间件，验证 Header 中的 Bearer Token，写入 `context` | 需在各服务 HTTP 入口启用 |
| `pkg/auth/supabase.go` | 兼容原有工具函数，逐步删除 Firebase 相关逻辑 | 拆分完成后可收敛为调用新验证器 |

> 建议在 `services/internal/auth` 中补充单元测试（针对 JWKS 缓存、过期刷新等场景）。

## 服务改造任务（进度）

### 1. Console（运营后台）
- [x] 在 `services/console/main.go` 中注入 `SupabaseTokenVerifier`，替换 `middleware.AuthMiddleware` 为新的 Supabase 校验逻辑；管理员权限继续沿用 `AdminOnly`。
- [x] `internal/handlers/http.go` 内所有 `middleware.AuthMiddleware` 调用改为 `middleware.SupabaseAuth()`；控制器中通过 `middleware.GetUserIDFromContext` 读取 `user_id`。
- [ ] 后端访问 Supabase Admin API 的模块保持 Service Key，但须在日志中记录 `admin_id` 与 `target_user_id`。

### 2. AdsCenter 服务
- [ ] HTTP 入口（通常在 `cmd/server` 或 `main.go`）添加 Supabase JWT 中间件。
- [ ] 所有需要用户身份的处理器，根据 `user_id` 拉取 Supabase `ads_connections` 表或内部缓存。
- [ ] 校验外部请求中带来的 `user_id`，禁止直接信任客户端传入值。

### 3. Offers 服务
- [ ] 写入接口：创建/更新 Offer 时将 `user_id` 设置为当前会话；读取接口按 `user_id` 过滤。
- [ ] 如果服务内仍写入 Firestore，改为调用新的 Supabase 表（参考 Stage1 SQL）。
- [ ] 统一错误结构，返回 JSON `{success:false,error:{code,...}}`，供前端 `useApiRequest` 解析。

### 4. Billing 服务
- [ ] 现有 Token 余额接口改为读取 Supabase `token_wallets` 与 `token_transactions` 表；保留 Stripe Webhook，但映射至 `user_id`。
- [ ] 对接控制台的 `/api/v1/console/tokens/**` 端点时，先校验管理员权限再执行。

### 5. 通用任务
- [ ] 移除所有 `firebase-admin`、`firestore` 依赖（`go.mod`），清理旧的 session 验证函数。
- [ ] 将配置项统一为 `SUPABASE_URL`、`SUPABASE_JWT_AUD`（默认 `authenticated`），通过 Secret Manager 管理 Service Key。
- [ ] 在 `deployments/` 或 Cloud Run 配置中注入上述环境变量。

## 中间件接入示例

```go
verifier := auth.NewSupabaseTokenVerifier(cfg.SupabaseURL)
supabaseMiddleware := middleware.SupabaseAuthWithVerifier(verifier)

mux := http.NewServeMux()
// 按需包裹路由
mux.Handle("/api/v1/offers", supabaseMiddleware(http.HandlerFunc(offersHandler)))
```

> 若服务内有 gRPC，需要额外封装 gRPC Unary Interceptor，实现相同的 JWT 校验逻辑。

## 验收要点
- 所有对外 API 在未携带或携带错误 Token 时返回 `401`；携带正确 Token 时只返回当前用户数据。
- 管理后台调用需要设置 `Authorization: Bearer <Admin Supabase JWT>`；使用 Service Key 的接口需限制在后台调用范围。
- 日志中打印请求 `trace_id`、`user_id`/`admin_id`，便于后续审计。

## 接口联调与发布
- 先在 Dev/Preview 环境部署更新后的服务，前端切换 `NEXT_PUBLIC_API_BASE_URL` 指向新服务。
- 使用 Supabase 生成测试用户，验证 Dashboard/Offers/Tasks 等功能；同时检查 Admin 操作（禁用/代登录）。
- 发布前确保现有 Firebase Admin 入口已禁用或重定向，避免并行写入。
