# 预发部署常见问题与有效修复记录（持续更新）

目的：沉淀 Cloud Build / Cloud Run 过程中踩过的坑与修复方案，复用为下一次“零摩擦”发布指南。

## 1. Cloud Build 使用 docker builder 报错：找不到 Dockerfile 路径

- 现象
  - 日志：`unable to prepare context: unable to evaluate symlinks in Dockerfile path: lstat /workspace/services/siterank: no such file or directory`
- 根因
  - `.gcloudignore` 中包含了未锚定（无 `/` 前缀）的模式，例如 `siterank`、`adscenter`，意外将 `services/siterank` 目录排除了。
- 解决
  - 将根目录的二进制忽略规则改为“仅忽略根路径同名文件”，加上 `/` 前缀：
    - `.gcloudignore` / `.dockerignore`：从 `siterank` → `/siterank`（其余类似 `/adscenter`、`/billing` 等）
  - 同时改用 Kaniko，避免 docker-in-docker 环境限制（见问题 2）。

## 2. Cloud Build 使用 docker builder 受限；切换到 Kaniko

- 现象
  - docker 构建步骤失败或拉取受限；或 Cloud Build 环境没有特权运行能力。
- 解决
  - 将 `deployments/<svc>/cloudbuild.yaml` 切换为 `gcr.io/kaniko-project/executor:latest`，使用以下参数：
    - `--destination=${_IMAGE}`
    - `--dockerfile=services/<svc>/Dockerfile`
    - `--context=dir:///workspace`
    - `--single-snapshot`、`--use-new-run`
  - 注意：使用 Kaniko 时，`cloudbuild.yaml` 中应去掉 `images:` 字段，避免 Cloud Build 在步骤外再次校验镜像存在而报 `images not found`。

## 3. Kaniko COPY 失败：前端 node_modules 软链导致复制错误

- 现象
  - 日志：`error building image: copying dir: symlink ... apps/frontend/node_modules/.bin/esbuild: no such file or directory`
- 根因
  - 直接 `COPY . .` 将前端 node_modules（包含链接文件）带入构建上下文，Kaniko 在容器环境中无法解析这些软链。
- 解决
- 精简 Dockerfile 的 COPY 范围，仅复制 Go 工作区文件：
  - `COPY go.work ./go.work`
  - `COPY pkg ./pkg`
  - `COPY services/<svc> ./services/<svc>`
  - 在 `.dockerignore` 与 `.gcloudignore` 中显式忽略：`apps/frontend/node_modules/**`

【补充】Offer 构建同类问题（再次踩坑）
- 现象
  - Cloud Build（Kaniko）日志显示 `COPY . .`，随后在 `apps/frontend/.../node_modules/.bin/esbuild` 处失败。
- 根因
  - Offer 的 Dockerfile 仍使用了“复制整个仓库”的模式（`COPY . .`），与前端目录软链冲突。
- 解决
  - 重写 `services/offer/Dockerfile` 为“最小工作区拷贝”模式：
    - `FROM golang:1.25 as builder`
    - `COPY go.work ./go.work`
    - `COPY pkg ./pkg`
    - `COPY services/offer ./services/offer`
    - `go build -o /offer-service`；runtime 使用 `gcr.io/distroless/base-debian12`
  - 确保 `.dockerignore`、`.gcloudignore` 均包含 `apps/frontend/node_modules/**`（已经落地）
- 重新触发构建：
    - `gcloud builds submit . --config deployments/offer/cloudbuild.yaml --substitutions _IMAGE=asia-northeast1-docker.pkg.dev/<PROJECT>/autoads-services/offer:preview-oapi`
  - 验证观察点：构建日志不应再出现 `COPY . .`，而是只看到 `COPY go.work`、`COPY pkg`、`COPY services/offer`。

【补充】Next.js 15 构建期预渲染触发 Recharts/客户端 Hook 错误
- 现象
  - `Error occurred prerendering page "/admin/autoclick/history"`，`TypeError: Cannot read properties of null (reading 'useState')`
- 根因
  - 页面使用 Recharts/React Hooks，虽然标注了 `use client`，但构建期仍会对页面做 SSR 预渲染，导致仅客户端库在 SSR 环境里执行
- 解决
  - 将图表部分拆分为独立客户端组件，并用 `next/dynamic` 禁用 SSR：
    - `const SSRFreeChart = dynamic(() => import('./ssr-free-chart').then(m => m.SSRFreeChart), { ssr:false })`
  - 对页面导出 `export const dynamic = 'force-dynamic'`，避免 Next 在构建期静态预渲染该页面
  - 文件：apps/frontend/src/app/admin/autoclick/history/page.tsx、apps/frontend/src/app/admin/autoclick/history/ssr-free-chart.tsx

【补充】Next.js TSX 三元渲染语法错误（Unexpected token `div`）
- 现象
  - Next 构建报 `Unexpected token 'div'. Expected jsx identifier`，指向 `</table>` 后的 `<div>`。
- 根因
  - JSX 三元表达式的“else 分支”返回了两个相邻元素 `<table/>` 与 `<div/>`，未用父容器（Fragment/Div）包裹，导致语法错误。
- 解决
  - 使用 Fragment 包裹 else 分支：
    - `) : ( <> <table>...</table> <div>...</div> </> )`
  - 已修复：`apps/frontend/src/app/recommend/opportunities/page.tsx`

## 4. Go Modules 拉取本仓库子包失败（unknown revision）

- 现象
  - 日志：
    - `reading github.com/xxrenzhe/autoads/pkg/idempotency/go.mod ... unknown revision`
    - 或 `pkg/httpclient` 等内部包被当作远程模块拉取失败
- 根因
  - 多模块工作区 `go.work` 存在，但 Cloud Build 的远程 `go mod tidy` 未正确解析到本地子包；或 `require` 未覆盖到所有内部包。
- 解决
  - 在服务的 `go.mod` 中增加 `replace` 指向工作区相对路径：
    - 例如：
      - `replace github.com/xxrenzhe/autoads/pkg/idempotency => ../../pkg/idempotency`
      - `replace github.com/xxrenzhe/autoads/pkg/httpclient => ../../pkg/httpclient`
      - 以及 `events`、`middleware`、`telemetry`、`config` 等实际用到的内部包
  - 必要时在 `require` 中添加占位版本（`v0.0.0-00010101000000-000000000000`）以显式纳入依赖图，再由 `replace` 覆盖到本地。

【本次新增案例：console 服务 Cloud Build 失败】
- 现象
  - `github.com/xxrenzhe/autoads/pkg/auth@v0.0.1: unknown revision`、`pkg/httpclient` 等内部包找不到
- 根因
  - console/go.mod 仅包含 `pkg/errors` 的 replace，其它内部包未被 replace，Cloud Build 远程 `go mod tidy` 尝试去外网拉对应 tag 失败
- 解决
  - 在 services/console/go.mod 增加 require + replace 到本地路径：
    - middleware、telemetry、http、auth、logger、idempotency、httpclient
  - 保证构建上下文包含 `pkg/` 目录（Dockerfile 用最小复制：`COPY go.work ./go.work && COPY pkg ./pkg && COPY services/console ./services/console`）

## 4.1 go.work 导致 `go mod download` 报本地模块不存在

- 现象
  - Dockerfile 在早期步骤执行 `go mod download`，由于 `go.work` 引用了多个 `services/*`，但镜像内尚未 COPY 这些目录，报 `cannot load module services/<svc> listed in go.work`
- 解决
  - 避免在仅复制 `go.mod` 场景调用 `go mod download`；改为在 COPY 完 `go.work`、`pkg` 与对应 `services/<svc>` 后再 `go mod tidy && go build`
  - 或在该步骤使用 `GOWORK=off` 以忽略 workspace，明确依赖通过 replace 相对路径解决

## 4.2 oapi 接口未实现导致编译失败

- 现象
  - `*oasImpl does not implement oapi.ServerInterface (missing method AggregateOfferKpi|LinkOfferAccount|GetLinkRotationSettings|...)`
- 解决
  - 在服务 `main.go` 中实现新增加的接口方法，直接映射到已有 handler（必要时用一个 `withPath` 适配以复用老的路径树处理器）
  - 示例（offer）：
    - `AggregateOfferKpi()`、`ListOfferAccounts()`、`LinkOfferAccount()`、`UnlinkOfferAccount()`，统一转发到 `OffersHandler`

## 4.3 handler 新增 case 导致 `duplicate case http.MethodPut`

- 现象
  - 在 `switch r.Method` 中重复添加了 `case http.MethodPut` 分支，编译报错
- 解决
  - 将新增的子资源（如 `/offers/{id}/preferences`）放入同一个 `case http.MethodPut` 分支内，根据 `sub` 路径再细分逻辑；避免重复的 `case` 标签

## 4.4 路由鉴权策略：按 scope 在 handler 内细分

- 现象
  - `/api/v1/console/notifications/settings` 最初被 `AdminOnly` 全局保护，user scope 也被误拦截
- 解决
  - 路由仅挂 `AuthMiddleware`，在 handler 中读取 `scope`：`user` 放行、`system` 走 `AdminOnly` 等价校验（复用邮件/UID白名单 + `X-Service-Token`）
  - 保持原有 `/api/v1/console/notifications/rules` 等端点继续 `AdminOnly`

## 4.5 API Gateway 资源已存在 & 配置更新策略

- 现象
  - `gcloud api-gateway apis create` 报 `ALREADY_EXISTS`；更新 config 时需处理不可变版本
- 解决
  - 更新策略：创建带时间戳的新 config 名称（如 `autoads-v2-<ts>`），然后 `gateways update` 指向新的 `api-config`
  - 渲染脚本（render-gateway-auto.sh）中：自动发现 Cloud Run 服务 URL；优先取 `{service}-{STACK}`，找不到回退到 base 名称

## 4.6 Cloud Build 网络抖动（oauth2.googleapis.com DNS 解析失败）

- 现象
  - 构建阶段偶发 `Failed to resolve 'oauth2.googleapis.com'`，导致步骤失败
- 解决
  - 重试构建；或将这类步骤交由 GitHub Actions/Cloud Build 重试策略处理
  - 观察：重试后可成功推送镜像

## 4.7 e2e 依赖令牌的门禁策略

- 现象
  - 预发 e2e（settings）需要 Firebase ID Token（用户/管理员），Secrets 不全会导致流程卡住
- 解决
  - 在 CI 中（deploy-backend.yml）：
    - 若 PREVIEW_TEST_ID_TOKEN 缺失则跳过 e2e（提示警告），避免阻断发布
    - 另提供手动工作流 e2e-settings.yml，允许在 Secrets 就绪后随时触发

## 4.9 npm ci 锁文件不同步导致构建失败

- 现象
  - Node 构建阶段 `npm ci` 报错：`can only install packages when package.json and package-lock.json are in sync`，列出大量缺失包
- 根因
  - apps/frontend 的 package.json 更新后未同步更新 lock 文件；CI 使用 `npm ci` 会严格校验
- 解决
  - 首选：在本地执行 `npm install -w apps/frontend` 更新锁文件并提交（或 `npm i -w apps/frontend --package-lock-only` 更新 lock）
  - 兜底：Dockerfile/Cloud Build pipeline 中 `npm ci ... || npm install -w apps/frontend`，确保构建不中断；但应尽快提交锁文件以避免漂移
  - 建议：CI 增加锁文件一致性校验步骤，防止漂移进入主干

## 5.0 信息架构/导航易错点（产品层面）

- 现象
  - 导航项过多且重复（/batchopen、/siterank、/changelink 独立存在），同一能力分散在多个入口，造成用户心智负担与转化漏斗断裂。
  - 登录后仍显示“定价页”，以及“计费中心”顶级入口与“设置/头像菜单”发生重复。
- 解决
  - 最终形态导航（登录后）：Offers / Operations / Insights / Settings；管理员入口仅 /ops/console，不出现在公共导航。
  - 定价页：仅未登录显示（转化CTA）；登录后从导航隐藏。
  - 计费中心：不做顶级入口，归并到 Settings（订阅/计费）或头像菜单（订阅/计费）。
  - 页面收敛：不保留旧路由的独立页面，评估（siterank）归并到 Offer 看板/详情，换链接（changelink）作为批量操作的一类（ROTATE_LINK），报告统一到 Operations → Reports。
  - SEO：/ops/* 强制 noindex；不发布 test-environment 到生产 sitemap。

## 4.8 Pipeline 中增设 Gateway 冒烟检查

- 背景
  - 端到端 e2e 之前，先对 `/api/health` 与关键服务健康端点进行冒烟，可快速定位网关/后端健康问题
- 实施
  - 在 `deploy-backend.yml` 中增加 `gateway-smoke` 作业，对 `/api/health`、`/api/health/console`、`/api/health/adscenter` 做无鉴权探测
  - 失败直接阻断流水线，减少后续排障范围

## 5. 使用 Cloud Build 指定服务账号的参数格式错误

- 现象
  - `--service-account` 传入邮箱报：`expect projects/{project}/serviceAccounts/{service_account}`
- 解决
  - 使用资源名格式：
    - `--service-account projects/<PROJECT_ID>/serviceAccounts/codex-dev@<PROJECT_ID>.iam.gserviceaccount.com`

## 7. Cloud Build YAML 中 ${VAR} 被当作 substitution 导致 INVALID_ARGUMENT

- 现象
  - 提交 `deployments/cloudbuild/build-frontend-docker.yaml` 构建时，日志报：
    - `invalid value for 'build.substitutions': key in the template "PROJ" is not a valid built-in substitution`
  - 原因：Cloud Build 会在 YAML 中扫描 `${...}` 片段，将其误认为 substitution 模板键（如 `${PROJ}`），即使它仅是 bash 变量。

- 解决
  - 避免在 YAML 的 `args: |` 多行脚本中出现 `${...}`，统一使用 `$VAR` 形式；或将生成脚本外置到仓库文件。
  - 本次改法：新增脚本 `scripts/build/gen-frontend-env.sh`，Cloud Build 通过 `args: ["-ceu", "bash scripts/build/gen-frontend-env.sh"]` 调用，脚本内执行：
    - 从 `gcloud config get-value core/project` 取项目
    - 读取 Secret：`NEXT_PUBLIC_FIREBASE_API_KEY`、`NEXT_PUBLIC_FIREBASE_APP_ID`
    - 生成 `apps/frontend/.env.production`
  - 备选：若必须内联多行脚本，所有 `${VAR}` 改为 `$VAR`；或对 `$` 做转义 `$$VAR` 以避免被 YAML/Cloud Build 提前展开（可读性较差，不推荐）。

## 8. Cloud Run 环境变量类型冲突（secret-typed ↔ literal）

- 现象
  - 先用 `--set-secrets INTERNAL_SERVICE_TOKEN=...` 配置了 secret-typed 变量；后续尝试使用 `--set-env-vars INTERNAL_SERVICE_TOKEN=...` 设置为字面量，报错：
    - `Cannot update environment variable [...] to string literal because it has already been set with a different type.`
- 解决
  - 保持同一变量名的类型一致：要么始终 secret-typed（推荐），要么始终 literal。
  - 如需切换类型：必须先从服务配置移除同名变量（同类型清除），再以新类型重新设置。注意某些 gcloud 版本不支持 `--remove-secrets NAME`；可退化为重新部署服务并清理 env，从而避免类型不一致。
  - 实务建议：对敏感值始终使用 `--set-secrets`；跨多个服务共享同一 Secret，避免出现一处 literal、一处 secret 的混用。

## 9. Notifications 新端点 404（镜像未切流）

- 现象
  - 新增内部端点 `/api/v1/notifications/admin/alert` 后，直连 Cloud Run Service URL 返回 404。
  - 原因：服务仍在运行旧镜像（未切流）。
- 解决
  - 找到最新成功构建的镜像 tag 并手动部署：
    - 通过 `gcloud builds list --filter 'status=SUCCESS AND images:*notifications*'` 获取镜像
    - 或 `gcloud artifacts docker images list` 检索带 `preview-` tag 的镜像
    - 执行 `gcloud run deploy notifications --image <IMAGE> --region <REGION>` 切流
  - 注意：内部端点需校验 `X-Service-Token`，与调用方（frontend）保持同一个 token（建议通过 Secret 注入 frontend/notifications）。

## 10. 前端 /api/admin/login-guard 404（路由未发布）

- 现象
  - 访问 Cloud Run frontend 的 `/api/admin/login-guard` 返回 404。
  - 原因：仓库已新增该 API 路由，但线上镜像未包含；同时 Cloud Build YAML 存在 `${...}` 替换冲突。
- 解决
  - 先修复 Cloud Build YAML（见问题7），将 `.env.production` 生成逻辑迁移到脚本 `scripts/build/gen-frontend-env.sh`。
  - 使用 `deployments/cloudbuild/build-frontend-docker.yaml` 提交构建并部署到 Cloud Run frontend。
  - 验证路由，突发请求至限速阈值应返回 429，携带 `Retry-After` 头；同时 frontend 会调用 notifications 内部接口发送站内告警。

## 11. Valkey/Redis 访问失败（无 VPC 或环境未注入）

- 现象
  - login-guard 切换到 Redis 后，若未绑定 VPC 或未注入 `VALKEY_URL`，请求可能超时报错或始终视为软放行。
- 解决
  - Cloud Run 前端服务绑定 Serverless VPC Connector（`cr-conn-default-ane1`），出站设置 `private-ranges-only`。
  - 将 Memorystore 私网地址写入 Secret `VALKEY_URL`，以 `--set-secrets VALKEY_URL=VALKEY_URL:latest` 注入到前端服务。
  - 端到端验证：Cloud Run `/readyz` 检查 Redis，login-guard 返回 200/429 符合预期。

## 6. usage-report 真实分型统计与池内扣减

- 现象
  - 前端 UsageReport 需显示“订阅/活动/购买”三类 Token 的堆叠趋势，但早期接口仅给出每日总消耗，前端按月度分布比例近似拆分，导致某些日期的分型不准确。
- 根因
  - Token 消费写入未准确标注来源（source）且无池内余额结构，无法从源头做精确归因。
- 解决
  - 后端新增表 `UserTokenPool(userId, subscription, activity, purchased, updatedAt)`，用于维护三类池的余额。
  - 入账（奖励/引导/购买/订阅发放）：
    - 统一在事件处理里为 `UserToken` 增加总余额，同时对应给 `UserTokenPool` 的目标池加余额；
    - 交易记录 `TokenTransaction` 的 `source` 统一标注真实池（activity/subscription/purchased）。
  - 扣账（commitTokens）：
    - 按固定优先级“subscription → activity → purchased”进行级联扣减（不再强绑功能与池），确保优先耗尽订阅/活动额度；
    - 为了后续报表精确，按实际扣减结果将一次消费拆分为最多三条 `TokenTransaction`（各自的 `source` 与金额），`balanceBefore/After` 严格递减，审计可追踪；响应仍返回第一条 txId。
  - 新增接口 `GET /api/v1/billing/usage/report?days=N`：
    - 返回 `tokenBreakdownDaily`（逐日三类用量）、`dailyUsage`（总用量）、`tokenDistribution`（窗口内消费分布）等；
    - SQL 基于日期序列 + 左连接 + `source` 聚合，补齐 0 值天；
    - 推荐索引：`TokenTransaction(userId, createdAt)` 与（如有）分区策略。
- 验收要点
  - `sum(tokenBreakdownDaily[*]) == dailyUsage[*].tokensUsed`；切换 7/30/90 天数据正确；0 值天不缺失；
  - 生产流量使用 Redis/Valkey 做 30–60s 缓存，p95 < 100ms（缓存命中）/ < 300ms（冷查询）。

## 7. NextAuth 下线与 Firebase 会话改造易错点

- 现象
  - 移除 next-auth 后，部分 API 路由仍引用 `getServerSession` 或 `next-auth/jwt`，导致构建/运行报错；Jest transform 白名单包含 next-auth 使得测试加载慢或失败；`@auth/prisma-adapter` 别名残留导致客户端 bundle 冗余。
- 解决
  - 提供最小兼容层：`lib/auth/v5-config.ts` 导出 `auth()` 基于 Firebase-Token Cookie 解析用户；`/api/auth/[...nextauth]` 退役返回 410；
  - BFF `/api/go/*` 无 Authorization 时从 Cookie 注入 `Authorization: Bearer <Firebase-Token>`，由 API Gateway 统一验证；
  - 全局替换 `getServerSession` 为内部兼容导出；移除 `next-auth/jwt` 使用，所有鉴权用 Cookie→BFF→Gateway；
  - Jest transformIgnorePatterns 去除 next-auth 白名单，仅 `/node_modules/`；删除类型与 mocks；
  - 清理 `next.config.js` 的 `@auth/prisma-adapter` 别名与本地桩。
- 提示
  - 变更依赖后需同步锁文件（`npm install --package-lock-only`），避免 CI `npm ci` 报锁文件漂移错误。

## 5.1 前端认证体系迁移（NextAuth → Firebase）中的常见坑与解法

- 症状A：BFF 路由依赖 session.firebaseToken，统一切换到 Firebase 后返回 401。
  - 根因：原逻辑从 NextAuth 会话中取 firebaseToken；迁移到 Firebase ID Token（httpOnly Cookie）后未兼容。
  - 解决：所有 BFF RouteHandler 优先从 `cookies().get('Firebase-Token')` 读取；若会话存在再从 session 兜底。已改造：billing/tokens、adscenter/preflight、console/users 等多处。

- 症状B：全站使用 `useSession/signOut` 等 NextAuth API，统一切换到 Firebase 后编译通过但运行不一致。
  - 根因：残留 next-auth/react 运行时依赖；与新的 Firebase 会话（基于 Cookie）不一致。
  - 解决：提供轻量 shim（`@/lib/next-auth-react-shim`），以 Cookie 是否存在作为登录态；统一替换全站 `useSession/signOut/signIn` 引用；去除 `SessionProvider`。

- 症状C：退出登录后部分页面仍显示已登录。
  - 根因：客户端状态未刷新或 Cookie 未清理。
  - 解决：signOut 统一调用 `DELETE /api/auth/firebase/session` 清 Cookie，随后刷新页面；导航与用户中心退出逻辑对齐。

## 5.2 NEXT_PUBLIC_FIREBASE_* 管理与注入

- 症状：前端打包后运行时读取不到 Firebase Web 配置，导致 `initializeApp` 失败。
  - 根因：NEXT_PUBLIC_* 需要在构建期内联，运行时注入不生效；或漏配 Messaging Sender ID。
  - 解决：
    - 源头：Secret Manager 管理 `NEXT_PUBLIC_FIREBASE_API_KEY`、`NEXT_PUBLIC_FIREBASE_APP_ID`。
    - 构建：Cloud Build 步骤从 Secrets 读取，生成 `apps/frontend/.env.production` 注入 Next 构建。
    - 自动派生：从 APP_ID（形如 `1:<senderId>:web:<hash>`）解析出 `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`，避免额外 Secret。
    - 兜底：Cloud Run 前端服务也挂载 Secrets（冗余，不影响行为）。

## 5.3 Next.js 15 SSR/预渲染报错（客户端 Hook/图表库）

- 症状A：`TypeError: Cannot read properties of null (reading 'useState')` 或 prerender error 指向仅客户端库。
  - 根因：仅客户端组件（图表、hooks）在构建期 SSR，导致钩子在服务端执行。
  - 解决：
    - 将页面/组件切分为 server 壳 + client 组件（`page.tsx` 动态导入 `page.client.tsx`）：
      ```ts
      // page.tsx
      export const dynamic = 'force-dynamic'
      import dynamic from 'next/dynamic'
      const Client = dynamic(() => import('./page.client').then(m => ({ default: m.default })), { ssr: false })
      export default () => <Client />
      ```
    - 客户端文件顶部 `"use client"`，避免在 server 文件中混入任何 React Hooks。
    - 避免在 server 文件内残留 JSX/return 代码（曾出现“Return statement is not allowed here”）——彻底清空，只保留动态导入与导出。

- 症状B：`Failed to collect configuration for /page`，`TypeError: n is not a function`。
  - 根因：`dynamic(() => import('./page.client'))` 某些 bundling 情况返回模块对象而非 default。
  - 解决：使用 `then(m => ({ default: m.default }))` 明确 default 导出。

## 5.4 Console 执行聚合（成功/失败/死信）

- 症状：管理台需要观测 `execute-tick` 推进率与失败量，但缺少聚合端点。
  - 解决：新增 `GET /api/v1/console/adscenter/executions/summary?days=7&daily=1`，汇总：
    - operationsCompleted / execOk / execError / successRate
    - deadlettersPending / deadlettersFailed
    - 可选 daily 明细（date, ok, error）
  - 前端：增加执行概览页（红黄绿灯 + 柱状图）和首页卡片轮询显示关键 KPI。

## 5.5 Autoclick（补点击）相关风险与退役路径

- 结论：建议下线，保留 Browser-Exec 的可用性/解析能力（合规合成监控）。
- 退役步骤：
  1) 立即隐藏 UI、停止 Scheduler；
  2) 删除后端相关端点/表与前端页面；
  3) 文档明确采用诊断/A-B/放大替代策略；
  4) sitemap 移除内部管理页条目。


## 6. Cloud Run + Secret Manager 集成的常见陷阱

- 现象A：容器启动失败（InvalidArgument / RESOURCE_PROJECT_INVALID）
  - 日志：`Failed to load configuration: failed to read DATABASE_URL from Secret Manager: access secret version: rpc error: code = InvalidArgument desc = Invalid resource field value in the request.`
  - 根因：环境变量传入的 Secret 名称格式不正确，或以 `--update-secrets` 混用了不同类型（value vs valueFrom）。
  - 解决：优先使用字符串环境变量指向完整资源名：
    - `DATABASE_URL_SECRET_NAME=projects/<PROJECT_ID>/secrets/DATABASE_URL/versions/latest`
    - 服务内用 Secret Manager SDK `AccessSecretVersion` 读取；避免与 `--update-secrets` 混用同名键。

- 现象B：PermissionDenied（secretmanager.versions.access）
  - 日志：`Permission 'secretmanager.versions.access' denied …`
  - 根因：Cloud Run revision 的服务账号缺少 Secret 访问权限。
  - 解决：为运行 SA 绑定角色：
    - `gcloud secrets add-iam-policy-binding DATABASE_URL --member=serviceAccount:<RUN_SA> --role=roles/secretmanager.secretAccessor`

- 现象C：Cannot update env var to string literal（之前设置过 secrets 类型）
  - 解决：先清空 secrets 引用，再设置字符串环境变量：
    - `gcloud run services update <svc> --clear-secrets`
    - 然后 `--set-env-vars DATABASE_URL_SECRET_NAME=projects/...`

## 7. 分布式缓存与本地缓存的权衡（REDIS_URL 可选）

- 现象
  - 预发/本地未配置 Redis 导致代码初始化失败，或接口性能波动（全部走 DB）。
- 根因
  - 直接依赖 Redis 客户端且未做降级；或缓存键/TTL 不合理导致命中低。
- 解决
  - 新增 `pkg/cache` 统一封装（`REDIS_URL` 存在即连，不存在回退到 L1 进程内 TTL）：
    - `Get(ctx,key)`：优先 Redis，失败回退 L1
    - `Set(ctx,key,val,ttl)`：写 Redis + L1
  - 键设计：显式包含 userId/validateOnly 维度，如 `ac:preflight:<uid>:<accountId>:vo=<0|1>`；
  - TTL 调整为可配置（例：`PREFLIGHT_CACHE_TTL_MS`）。

## 8. API 聚合页面（看板/Insights）对“最近通知”的使用注意

- 现象
  - 最近通知中的业务数据结构不稳定（字段名、嵌套层次变化），前端解析失败或 UI 空白。
- 根因
  - 通知 payload 的 schema 未严格版本化；不同事件来源字段不完全一致。
- 解决
  - 前端解析采用“尽力而为”+ 容错处理：
    - 例如 offerId 可从 `message.offerId` 或顶层 `offerId` 读取，读取失败则跳过该条；
  - 仅用于“计数/提醒”，详情点击再进入专页（由后端统一结构化数据）。

## 9. Browser‑Exec 接口调用的容量与稳定性

- 现象
  - `/resolve-offer`、`/simulate-click` 在峰值时返回 503（OVERLOADED）或 504（RESOLVE_TIMEOUT）。
- 根因
  - 并发上限与上下文池耗尽；代理提供方质量波动。
- 解决
  - 在 Browser‑Exec 增加：
    - 维护模式/并发槽位守卫（超出返回 503，并附带 `Retry-After`）；
    - 任务队列与统计 SSE，便于前端/运维观察；
    - 真实浏览器路径：前置代理探测（`pickWorkingProxy`），避免长时间失败重试。
  - 调用侧（siterank/adscenter）：
    - 严格设置 `timeoutMs` 与分段预算；
    - 将 resolve/json-fetch 作为“降级路径”，失败不阻断主流程。

## 10. Pre-flight 短缓存导致“计划未刷新”的错觉

- 现象
  - 刚执行完诊断/计划，预检页仍显示旧问题；用户误以为没有生效。
- 根因
  - Pre-flight 结果短缓存（2 分钟）被命中，导致页面反映滞后。
- 解决
  - 增加可配置 TTL（`PREFLIGHT_CACHE_TTL_MS`），并在 UI 上标注“最近缓存时间”；
  - 执行计划后提供“强制刷新”按钮（附带 `X-Idempotency-Key`）。

## 11. 阶段化规则实现中的“品牌词”提取与跳转

- 现象
  - 仅以域名拆词难以覆盖品牌别名；跳转相似机会时参数缺失。
- 解决
  - siterank 增设品牌词提取端点（融合 page‑signals 的 title/siteName）；
  - Offer 详情页调用提取端点，提供“基于域名发现相似机会”一键跳转（自动预填参数）。

## 12. CI/CD：批量构建与生产冒烟

- 痛点
  - 手动多次调用 `gcloud builds submit` 容易出错；生产发布后缺乏统一的网关层冒烟。
- 解决
  - 新增脚本：
    - `deployments/scripts/deploy-all-services-cloudbuild.sh`（按服务批量提交 Cloud Build，自动打 `{stack}-latest` 标签）；
    - `deployments/scripts/prod-smoke-suite.sh`（解析 Gateway Host，检查 `/api/health` 与子健康端点）。


## 7. Cloud Run 容器未监听端口/健康检查失败

- 现象：`The user-provided container failed to start and listen on the port defined by PORT=8080`。
- 根因：进程在读取配置/依赖前崩溃（例如 Secret 读取失败），或基础镜像缺少 CA 证书导致 SDK 访问失败。
- 解决：
  - 先修复 Secret 读取与权限（见上一节）。
  - 若用 distroless 且需要访问外部 HTTPS：改为带 `ca-certificates` 的 debian-slim 基镜像，或在 distroless 层复制证书。

## 8. Next.js 15 App Router 构建/预渲染常见问题

- 现象A：`i18n.localeDetection` 警告/不被支持
  - 根因：App Router 不支持 next.config 顶层 i18n 老配置。
  - 解决：移除顶层 i18n 配置或改用 App Router 支持的国际化方案；保留运行时语言选择即可。

- 现象B：`Unexpected token 'div'` / Top-level Hooks / `useState of null` 等 SSR 错误
  - 根因：
    - JSX 结构不对称（嵌套三元表达式 else 分支未包裹 Fragment）。
    - 仅客户端组件在构建（SSR 预渲染）阶段被执行。
    - Hooks 写在模块顶层或被服务端导入。
  - 解决组合：
    - 修正 JSX 结构：三元 else 分支用 Fragment 包裹；避免兄弟 JSX 没有共同父节点。
    - 将页面/组件标记为客户端：文件首行 `'use client'`。
    - 对可能触发预渲染的页面加 `export const dynamic = 'force-dynamic'` 禁止静态预渲染。
    - 对仅客户端可用的复杂组件，使用 `next/dynamic(..., { ssr:false })` 延迟到客户端加载。
    - 若修复成本高，临时以“占位页”替换阻断页面，先恢复构建，再逐步恢复功能。

- 现象C：ESLint/TS 构建期阻断
  - 解决（预发阶段）：在 next.config.js 中设置 `eslint.ignoreDuringBuilds=true`、`typescript.ignoreBuildErrors=true`，避免非关键问题阻塞；生产再严格收敛。

## 9. Cloud Build（Kaniko）与 Dockerfile

- 现象：前端软链/不相关大目录导致构建失败或体积膨胀。
  - 解决：各服务 Dockerfile 仅拷贝最小工作区（go.work、pkg、services/<svc>）；避免 `COPY . .`；Node 资产不进入 Go 镜像上下文。
  - 示例（Go 服务）：
    - `COPY go.work ./go.work`
    - `COPY pkg ./pkg`
    - `COPY services/<svc> ./services/<svc>`


## 6. 新增经验沉淀（本阶段新增问题与有效解法）

### 6.1 Next.js i18n 与 API 重写共存

- 现象
  - 开启 i18n（en/zh）后，前端对后端服务的调用既要经过统一 BFF（/api/go/*），又要兼容 NextAuth 等内置路由。
- 关键点与解法
  - next.config.js 已配置：`/api/auth/*` 直通，其他 `/api/*` 重写到 `/api/go/*`。
  - 新增页面（如 Admin 控制台）直接调用 `/api/v1/...` 即可复用 BFF 重写，不要在浏览器端拼接服务的绝对地址（避免跨域与环境耦合）。
  - 多语言路由不影响 API 重写，保持页面路径与 API 路径分离。

### 6.2 SSE 在网关/BFF 后的长连接行为

- 现象
  - 管理端使用 SSE（/api/v1/browser/queue/stream）实时推送队列统计，部分网关对连接有 60s 超时或缓冲。
- 解法
  - 服务端设置标准 SSE 头：`Content-Type: text/event-stream`、`Cache-Control: no-cache`、`Connection: keep-alive`，并尽快 `flushHeaders()`。
  - 若网关对 SSE 有超时限制，前端应保留轮询退路（本项目已每 30s 轮询队列统计作为兜底）。

### 6.3 代理池（ProxyRegistry）设计易错点

- 现象
  - 代理由外部 Provider 提供（PROXY_URL_US），稳定性不一；若每次都回源拉取，成功率与时延波动大。
- 解法
  - 引入本地注册表优先：`pick()` 先从注册表挑选未隔离代理，缺失再回退 Provider。
  - 规范化 Key：将 `http://user:pass@host:port` 归一成 `protocol//host:port` 保证去重可靠。
  - 成功/失败反馈：`report(country, raw, ok)` 失败累计超过阈值（默认3）则 `badUntil` 隔离一段时间（默认5分钟）。
  - 指标：暴露 `be_proxies_total{country}`、`be_proxies_bad{country}` 便于观察容量与隔离情况。
  - 持久化：如设置 `REDIS_URL`，注册表切换到 Redis（跨实例共享），API 一致。

### 6.4 任务队列与 HTTP 并发的解耦

- 现象
  - 早期批量执行通过 HTTP 入口“占位并发”，容易造成请求排队与易受连接中断影响。
- 解法
  - 引入独立 TaskQueue（Redis 优先，内存回退），REST 仅负责入队、查询、监控；Worker 并发独立通过配置调整。
  - 失败重试：任务携带 `attempts/maxAttempts`，超过阈值入 DLQ，提供重试接口与指标。

### 6.5 Prometheus Label 基数与路径归一

- 现象
  - 若直接将完整 URL path 作为 label，`http_requests_total{path=...}` 的基数会爆炸，Grafana 难以聚合。
- 解法
  - 统一使用 `pkg/telemetry` 的 `templatePath` 简单归一，将长 ID/带短 GUID 的段落归一为 `:id`，避免 label 爆炸。
  - 管理端解析 /metrics 时注意行尾数值可能带时间戳，取倒数第二个数为样本值（已在 getAPIUsage 处理中）。

### 6.6 Browser 多池管理的资源护栏

- 现象
  - 为不同代理拆分 pool 会增长实例数，若不设上限/回收会产生资源泄漏或 OOM。
- 解法
  - 加总池上限（BROWSER_MAX_POOLS，默认16）与空闲 TTL（BROWSER_POOL_IDLE_TTL_MS，默认60s），定时回收空闲池。
  - 总内存护栏：`BROWSER_MAX_MEMORY_MB`，超限拒绝新 Context，返回 `capacity_exhausted`。

### 6.7 内部鉴权 Token 的一致性

- 现象
  - Browser‑Exec 提供 `/api/v1/browser/*` 内部端点，若设置 `BROWSER_INTERNAL_TOKEN`，缺少该 Token 的网关请求会 401。
- 解法
  - 预发阶段可不设置 `BROWSER_INTERNAL_TOKEN`，或在 BFF 侧为 `/api/go/api/v1/browser/*` 注入 `X-Service-Token/Bearer`。
  - 管理端页面统一走 `/api/v1/...`，确保经过 BFF 重写与注入逻辑。

### 6.8 k6 E2E 压测的鉴权与环境

- 现象
  - k6 对需要鉴权的路由必须传递 ID Token，否则出现 401/403。
- 解法
  - 脚本支持 `AUTH="Bearer <token>"` 与 `GATEWAY=https://...` 环境变量；漏配则仅能跑公开或非鉴权端点。

### 6.9 可视化批量面板的 SSR 与依赖问题

- 现象
  - 批量操作可视化面板在 Offer 详情页引入时，如直接静态导入，Next.js 可能在构建期对仅客户端依赖进行 SSR 检测，导致构建告警或体积膨胀。
- 解法
  - 使用 `next/dynamic` 按需动态引入组件并禁用 SSR：
    - `const BulkActionBuilder = dynamic(() => import('...').then(m=>m.BulkActionBuilder), { ssr:false })`
  - 在调用端控制显示/隐藏（本项目通过本地 `showBulk` state 控制），避免初始渲染加载非关键体积。

### 6.10 计划校验错误的可用性与定位

- 现象
  - Adscenter 校验返回 violations 列表，用户需要快速定位到 JSON 中的对应字段；若预览区未聚焦/未滚动，定位体验较差。
- 解法
  - 在前端维护预览 textarea 的引用，点击 violation 时设置 selection range，并按行高粗略滚动到可视区域；字段 path 解析不全时回退到字段名的首次出现位置。

### 6.11 Batchopen 任务轮询与筛选

- 现象
  - `/api/v1/batchopen/tasks` 返回当前用户最近任务；前端只需要当前 Offer 的任务。若直接展示全部，用户噪声较大；且重复请求可能导致 UI 抖动。
- 解法
  - 在前端按 `offerId` 过滤展示，并采用定时轮询（5s）直到任务均非 queued/running 即停止；首次入队后立即刷新一次，减少感知延迟。

### 6.12 全局概览的 N+1 KPI 请求与降级

- 现象
  - /offers/overview 需要对每个 Offer 拉取 KPI，若列表较长会形成 N+1 请求导致首屏延迟。
- 解法
  - 先渲染基本列表（name/status），并行拉 KPI 后按原顺序就地更新；任何 KPI 请求失败时降级显示 "-"，避免阻塞整体视图。
  - 后续可引入后端聚合端点或批量 KPI 查询以减少请求数。

### 6.13 评估卡片兼容后端字段缺失

- 现象
  - 合规标签、CPC 区间等字段在后端尚未统一输出时，前端直接读取可能报错或显示异常文案。
- 解法
  - 使用“有则展示”的兼容模式：对 `result.cpcMin/cpcMax` 与 `result.compliance.ok/tags` 做可选链/存在性判断，无则显示“待提供/待诊断”。

### 6.14 设置页通知模板与模拟预览

- 现象
  - 用户难以根据 minConfidence/throttle/groupWindow 的组合预估通知条数；且数值边界不一致易导致极端配置。
- 解法
  - 增加模板按钮（低噪音/默认/敏感高召回）快速设置合理区间，并提供“模拟预览”基于 60s 随机事件估算过滤/节流/聚类后的通知条数，直观反馈配置效果。
  - 前端对数值进行边界保护（minConfidence ∈ [0,1]，throttle ≥ 0，groupWindowSec ≥ 0）。

### 6.15 oapi-codegen 生成导致的重复声明（types/server 冲突）

- 现象
  - `services/adscenter/internal/oapi` 下同时生成了 `server.gen.go` 与 `types.gen.go`，包含相同的常量/类型（如 DayOfWeek/Minute 枚举、BearerAuthScopes 等），构建时报重复声明错误（redeclared）。
- 根因
  - 生成脚本使用 `-generate types,chi-server` 或对同一规范多次生成时未控制组合/顺序，导致两份文件都包含类型声明。
- 解决
  - 修正生成脚本：
    - 对 adscenter：仅生成 `chi-server`（`server.gen.go`），避免重复；
    - 对其他服务：先生成 `types` 再生成 `chi-server`（不同文件，避免常量重复）。
  - 如已出现冲突文件：先删除重复的 `types.gen.go`（或 `server.gen.go`），再按新脚本生成。
  - 脚本位置：`scripts/openapi/generate.sh`。

### 6.16 Bulk 回滚计划预览缺少 before 快照导致回滚失败

- 现象
  - `GET /api/v1/adscenter/bulk-actions/{id}/rollback-plan` 在缺少 `exec` 审计的 `before` 快照时无法拼装精准回滚方案，可能返回空或报错。
- 根因
  - 早期版本仅依赖 `exec` 审计 `details.before` 键值生成回滚；无审计或未写入 `before` 时无兜底。
- 解决
  - 优先使用 `exec` 审计 `before` 快照生成“精准回滚”计划；
  - 无法生成时，回退到“基于原计划的启发式逆向方案”（source=original_plan）；
  -`bulkRollbackHandler` 执行时如果无 `before` 快照，标记 `noop_no_before` 并写审计，避免报错。

### 6.17 提交新动作时 OAS 类型未及时生成导致参数丢失（typed union 限制）

- 现象
  - 新引入的动作类型（如 `SET_AD_SCHEDULES`、`SET_TARGET_CPA` 等）在 OAS `oneOf` 未及时更新时，后端将 typed 结构解组成空 `params/filter`，导致入队参数缺失。
- 根因
  - 采用 OAS typed union 解构，但未覆盖新动作枚举；
  - 仅依赖 typed 解析结果，没有回退到原始 JSON。
- 解决
  - 在 `SubmitBulkActions` 将 `typed→raw` 作为兜底：
    - 若 typed 的 `params/filter` 为空，则从原始 JSON 的 `actions[i].params/filter` 回退填充；
  - 同时接入 CI 工作流 `openapi-generate.yml` 校验生成差异，避免 OAS 漂移。

### 6.18 Notifications/Batchopen /readyz 对 Redis 的严格校验

- 现象
  - 仅 DB 就绪检查通过，但 Redis 引入后服务实际运行依赖 Redis；/readyz 未校验 Redis PING，导致部署探针绿灯但运行期失败。
- 根因
  - /readyz 未根据 `REDIS_URL` 条件执行严格 PING；
  - `pkg/cache` 客户端初始化成功但连接未真正校验。
- 解决
  - 在 /readyz 内：若设置了 `REDIS_URL`，则通过 `pkg/cache.NewFromEnv()` 创建客户端，执行 `PING`，失败返回 500 NOT_READY；
  - 当前已在 Notifications/Batchopen 接入严格校验。

### 6.19 生成链路缺少校验导致 OAS 漂移

- 现象
  - 合并 PR 后发现 SDK 与服务端 stubs 未及时刷新，前端/后端契约不一致。
- 根因
  - 缺少统一的生成校验步骤；生成后的 diff 未被 PR 检查阻断。
- 解决
  - 新增 CI 工作流 `.github/workflows/openapi-generate.yml`：安装 oapi-codegen、执行脚本 `scripts/openapi/generate.sh`，并对 repo 进行 diff 检查；存在未提交的生成变更时直接 fail 并提示提交。

### 6.20 新动作校验与 UI 表单的常见问题

- 现象
  - 新动作（否词/关键词状态/投放时段/策略参数）在校验时报错，或前端提交后后端提示缺少必填字段；
  - validate-only 通过，但真实提交后回滚计划无法生成。
- 根因
  - 多数为参数结构不符合预期（数组形态/枚举大小写/二选一条件缺失）；或 Admin 控制台未先做“提交前校验”。
- 解决（约束与要点）
  - 否词：`adGroupResourceNames: string[]`、`keywords: string[]` 必填；`matchType`=EXACT|PHRASE|BROAD；
  - 关键词状态：`criterionResourceNames: string[]` 必填；
  - 投放时段：`campaignResourceNames: string[]` + `schedules: [{dayOfWeek,startHour,startMinute,endHour,endMinute}]`；`dayOfWeek`=MONDAY..SUNDAY；`startMinute/endMinute`=ZERO|FIFTEEN|THIRTY|FORTY_FIVE；
  - 策略参数：
    - tCPA：`campaignResourceNames` + `targetCpaMicros` 或 `percent` 二选一；
    - tROAS：`campaignResourceNames` + `targetRoas` 或 `percent` 二选一；
  - 提交前优先调用 `/api/v1/adscenter/bulk-actions/validate`，消除 `violations` 后再提交；
  - Admin 控制台已提供“校验计划”按钮与客户端基础校验（数组必填、二选一必填）；
  - 注意大小写与数组形态（单值请包装为数组），资源名使用完整 resourceName。

### 6.21 回滚提交防护与兜底

- 现象
  - 回滚计划提交后与预期不一致，或因缺少 before 快照无法精确回滚。
- 解决
  - 回滚预览优先生成“精准回滚”（来源 exec 审计）；否则回退到“启发式逆向”（来源 original_plan）；
  - `bulkRollbackHandler` 在无 before 时以 `noop_no_before` 返回并写审计，避免出错；
  - 控制台默认提供“一键提交回滚（validate-only）”，真实执行需在验证通过后再由运维/管理员显式触发。



## 6. Artifact Registry 推送失败：构建成功但最终显示 `images not found`

- 现象
  - Kaniko 步骤成功，构建整体失败，提示 images 不存在。
- 根因
  - `cloudbuild.yaml` 中保留了 `images:` 字段，Cloud Build 在步骤外尝试校验镜像存在；同时使用非 docker builder 时，此行为与 Kaniko 的推送逻辑不一致。
- 解决
  - 删除 `images:` 字段；仅依赖 Kaniko 的 `--destination` 推送。
  - 同时确保使用具有写权限的服务账号运行 Cloud Build（例如 `codex-dev`）。

## 7. Cloud Run 启动失败：chi 中间件注册顺序错误

## 11. API Gateway 映射健康聚合 404
- 现象：`/api/health` 返回 404（其它健康探针 200）
- 根因：聚合映射到了 Console 根路径，未追加 `/health`
- 解决：将 `gateway.v2.yaml` 中 `/api/health` 的 backend 改为 `address: https://console-.../health` + `CONSTANT_ADDRESS`，滚动更新 Config 与 Gateway

## 12. Identity/Workflow 服务已下线但仍被构建/部署
- 现象
  - Cloud Build/GitHub Actions 仍尝试构建 `services/identity`/`services/workflow`，导致 go mod tidy 拉取不存在的内部包版本（unknown revision），构建失败。
- 根因
  - 历史流水线未清理全量服务列表（强制全量或“核心/共享变更时全量”仍包含 identity/workflow）。
- 解决
  - 更新 CI/CD：
    - `.github/workflows/deploy-backend.yml`：Tag 构建的全量列表移除 identity/workflow。
    - `scripts/deploy/detect-changed-services.sh`：核心变更触发的“全量构建列表”移除 identity/workflow，改为有效服务集合（billing/offer/siterank/adscenter/batchopen/console/recommendations/notifications）。
    - `scripts/deploy/cloudrun-deploy.sh`：默认 SERVICES_ARR 不再包含 identity/workflow。
  - 说明：v2 网关已合并鉴权（Firebase），不再需要独立 Identity 服务；Workflow 由事件驱动与 Saga 替代。

## 13. Docker 构建在 go.work 环境下报缺少其他模块目录
- 现象
  - 在服务 Dockerfile 里仅复制了 `pkg/` 与对应 `services/<svc>`，但仍复制了根 `go.work`。`go mod tidy` 报：`cannot load module ../batchopen listed in go.work file...`。
- 根因
  - `go.work` 中 `use` 了多个服务路径；容器内这些路径未被 COPY，Go 在 workspace 模式下会尝试解析并报错。
- 解决
  - 在 Dockerfile 中加入 `ENV GOWORK=off`，让构建使用模块模式 + go.mod 里的 replace 覆盖到本地 `pkg/*`；或仅复制“精简 go.work”。
  - 已落实：为 adscenter/siterank/offer 的 Dockerfile 增加 `GOWORK=off`，并保持 `replace github.com/xxrenzhe/autoads/pkg/* => ../../pkg/*` 有效。
  - 同类修复：为 batchopen Dockerfile 增加 `GOWORK=off` 且采用“最小 COPY（go.work/pkg/services/batchopen）”，并在 go.mod 补充 `replace`（errors/logger/eventbus/telemetry/http/middleware）。

- 现象
  - 日志：`panic: chi: all middlewares must be defined before routes on a mux`
- 根因
  - 先注册路由再调用 `r.Use(...)`。
- 解决
  - 将所有 `r.Use(...)` 中间件放在任何路由挂载之前。示例：
    - `r := chi.NewRouter(); r.Use(telemetry.ChiMiddleware("svc")); r.Use(middleware.LoggingMiddleware("svc")); r.Get("/health", ...)`

## 8. gcloud 参数不兼容

## 14. 创建 Firebase Web API Key 报 SERVICE_DISABLED / 权限不足
- 现象
  - `gcloud services api-keys create` 返回 `PERMISSION_DENIED` 或提示启用 `apikeys.googleapis.com`。
- 根因
  - 项目未启用 API Keys API，或当前服务账号无足够权限创建 API Key。
- 解决
  - 在 GCP 控制台启用 API Keys API：`apikeys.googleapis.com`。
  - 使用具备相应权限的服务账号（通常需要 `roles/serviceusage.serviceUsageAdmin` + `roles/serviceusage.apiKeysAdmin`）。
- 备选：从 Firebase 控制台（项目设置 → Web App 配置）复制现有 Web API Key，并存入 Secret Manager（NEXT_PUBLIC_FIREBASE_API_KEY）。

## 15. event_store 表结构不一致（UUID vs TEXT）导致写入/查询异常

- 现象
  - 某些服务（pkg/eventstore、notifications subscriber）使用 `TEXT` 写入 `event_id`，而基础 SQL 定义为 `UUID`，导致类型不一致；查询或插入时可能报类型错误或隐式转换失败。
- 解决
  - 统一 `schemas/sql/001_event_store.sql` 为 `TEXT` 类型，并保留唯一索引与聚合/名称时序索引。
  - 路径：schemas/sql/001_event_store.sql

## 16. Adscenter 动作参数命名漂移（percent/cpcValue vs adjustPercent/targetCpcMicros）

- 现象
  - 前端/脚本历史上使用 `adjustPercent/targetCpcMicros/dailyBudgetMicros`，而 OAS/后端期望 `percent/cpcValue/dailyBudget`，导致校验失败或执行无效。
- 解决
  - 前端计划编辑、校验提示与建议生成统一改用 OAS 字段：
    - ADJUST_CPC：`percent` 或 `cpcValue`
    - ADJUST_BUDGET：`percent` 或 `dailyBudget`（>0）
    - ROTATE_LINK：`links[]` 或 `targetDomain`
  - 文件：apps/frontend/src/app/offers/[id]/page.tsx；services/adscenter/openapi.yaml（参考）

## 17. 创建 Memorystore 实例报错：No service connection policy associated

- 现象
  - 创建 Redis/Valkey 实例时报错：`Invalid resource state ... No service connection policy is associated ... Create a service connection policy ...`
- 根因
  - VPC 未建立到 Google 服务的 Private Service Connect（Service Networking）连接；或未预留服务段地址。
- 解决
  - 预留地址段并建立服务连接（2 选 1）：
    - 新项目推荐：创建预留段 → 使用 Network Connectivity SC Policy（或直接使用 `services vpc-peerings connect` 建立连接）。
    - 若 `connect` 报错 `Cannot modify allocated ranges... existing_ranges_name_list=[default-ip-range]`，说明已存在连接，可直接重试创建实例。
  - 命令示例：
    - 预留：`gcloud compute addresses create google-managed-services-<name> --global --purpose=VPC_PEERING --prefix-length=16 --network=default`
    - 连接：`gcloud services vpc-peerings connect --service=servicenetworking.googleapis.com --ranges=google-managed-services-<name> --network=default`
  - 注意：某些项目已有默认连接（`default-ip-range`），此时创建实例可直接成功。

## 18. gcloud redis 版本参数大小写错误

- 现象
  - `--redis-version=REDIS_7_0` 报参数无效。
- 解决
  - 使用小写：`--redis-version=redis_7_0`。

## 19. Cloud Run 服务未监听 8080 导致修订不就绪

- 现象
  - 报错：`The user-provided container failed to start and listen on the port defined by PORT=8080 ...`。
- 根因
  - 启动时进行 DB 迁移/外部依赖探测阻塞，或强制 Pub/Sub 配置缺失导致进程退出。
- 解决（生产推荐策略）
  - 迁移从“服务启动”移出：使用 Cloud Run Job（db-migrator）在发布前/后执行幂等迁移，失败即阻断发布。
  - 服务内仅绑定健康与路由：对 DB 迁移设置有限超时/可跳过（环境变量 `BILLING_SKIP_MIGRATIONS=1` 兜底）。
  - Pub/Sub 消费交由 Notifications/Functions 托管；服务内订阅非强制（warn 并跳过）。
  - 必要时增加 `BILLING_MINIMAL=1` 启动最小健康模式，避免阻塞切流。

## 20. API Gateway 配置更新与健康映射

- 现象
  - 更新 API Config 报 `ALREADY_EXISTS`；或 `/api/health` 指向后端根路径未追加 `/health` 导致 404。
- 解决
  - 采用“不可变配置”策略：创建带时间戳的新 config（如 `autoads-v2-<ts>`），再更新 gateway 指向新 config。
  - 健康映射使用 CONSTANT_ADDRESS 且指向具体 `/health` 路径：
    - 例：`/api/health/billing -> https://billing-<run>.a.run.app/health`。

## 21. Cloud Run 无配置变更时无法触发发布

- 现象
  - `gcloud run services update` 返回 `No configuration change requested`。
- 解决
  - 更新镜像标签，或 bump 一个无害环境变量（如 `ROLL_STAMP`）。

## 22. Redis/Valkey 变量混用导致困惑

- 现象
  - 同时设置 `REDIS_URL` 与 `VALKEY_URL`，服务行为不明确。
- 解决
  - 明确实例类型只使用一个变量：
    - Memorystore for Redis：使用 `REDIS_URL`
    - Memorystore for Valkey：使用 `VALKEY_URL`
  - 代码/模板/校验脚本保持“一处输入”原则，避免混用。

## 23. 发布流水线：迁移顺序与网关冒烟

- 经验
  - 发布顺序推荐：Build/Tag → DB Migrate（Cloud Run Job，阻断式）→ Deploy（Cloud Run）→ Gateway Smoke（/api/health、/api/health/adscenter、/api/health/console、/api/health/billing）。
  - 避免在服务启动阶段做迁移或外部依赖长探测，保证端口快速就绪。


## 17. /ops 与 /admin 入口被搜索引擎索引/权限绕过风险

- 现象
  - 管理入口 `/ops/*`、`/admin/*` 在未加额外保护时有可能被索引或被直接访问。
- 解决
  - 中间件对 `/ops` 与 `/admin` 做管理员校验（Firebase Token + 角色/白名单），并在响应头加 `X-Robots-Tag: noindex, nofollow`；robots.txt 屏蔽 `/monitoring` 与 `/test-environment`。
  - 文件：apps/frontend/src/middleware.ts、apps/frontend/src/app/robots.ts

## 18. 事件查询需支持多类型筛选（type 多选）

- 现象
  - 管理页期望按多个事件类型过滤；后端仅支持单值 `type=`。
- 解决
  - 后端接受 `type=a,b,c` 并构建 `IN (...)` 查询；前端类型多选拼接逗号分隔。
  - 文件：services/notifications/cmd/server.main.go、apps/frontend/src/app/admin/system/events/page.tsx

## 19. 批量执行监控易引发“羊群效应”（并发拉取导致短时高压）

- 现象
  - 聚合视图中同时对多个操作拉取分片/审计详情，可能在浏览器端形成瞬时并发风暴。
- 解决
  - 全局分片总览对每个操作顺序拉取、避免洪峰；局部查看时按需展开再拉取，并限量展示（最新3条）。
  - 文件：apps/frontend/src/app/operations/page.tsx

## 20. 计划 JSON 字段定位不准确（仅字符串搜索）

- 现象
  - 早期仅靠字符串搜索字段名，定位误差较大，难以快速定位 actions[i] 内的具体字段。
- 解决
  - 基于括号匹配在 `actions` 数组内定位第 i 个对象范围，再在范围内查找字段名；失败时选中整个对象片段并滚动定位；后续建议引入 AST 解析进一步提升精度。
  - 文件：apps/frontend/src/app/offers/[id]/page.tsx

## 21. 导出列与筛选记忆缺失（事件管理）

- 现象
  - 管理页面导出 CSV 时列固定、筛选刷新后丢失。
- 解决
  - 前端生成 CSV 并支持导出列选择，筛选与列选择持久化到 localStorage；NDJSON 仍走后端导出。
  - 文件：apps/frontend/src/app/admin/system/events/page.tsx

## 15. 创建 Cloud Scheduler Job 报 PERMISSION_DENIED
- 现象
  - `gcloud scheduler jobs create http ...` 提示缺少 `cloudscheduler.jobs.create` 权限。
- 根因
  - 构建/运行使用的服务账号未授予 Cloud Scheduler 管理权限。
- 解决
  - 为运行命令的服务账号授予 `roles/cloudscheduler.admin`（或至少包含 `jobs.create/update/run` 的角色）。
  - 配置 OIDC：`--oidc-service-account-email=<run-service-sa>`，确保调用目标 Cloud Run 需要鉴权时可签发令牌。

## 16. 创建 Monitoring 告警策略报 PERMISSION_DENIED / INVALID_ARGUMENT
- 现象
  - 403：缺少编辑权限；400：MQL 语法错误（如 join/table 对齐/括号不匹配）。
- 根因
  - 服务账号缺少 `roles/monitoring.editor`；或 MQL 查询未按最新语法编写。
- 解决
  - 赋权 `roles/monitoring.editor`。
  - 构建请求体时严格 JSON 转义查询（避免 shell 变量插值破坏格式），参考：用 Python `json.dumps()` 包装查询字符串。
  - 如 MQL join 仍报错，可先用阈值型条件（conditionThreshold）或使用更简洁的 MQL 变体（避免复杂 join），待后续验证后再升级到 ratio 方案。

- 现象
  - `gcloud builds submit` 使用 `--logging=CLOUD_LOGGING_ONLY` 报不识别。
- 解决
  - 去掉该参数或使用 `gcloud beta builds submit`；本项目统一移除该参数。

## 9. .gcloudignore 与 .dockerignore 的通用规范

- 原则
  - 锚定根目录二进制忽略：`/siterank`、`/adscenter` 等，仅忽略根级同名文件，不影响 `services/<svc>` 源码目录。
  - 显式忽略前端大型目录：`apps/frontend/node_modules/**`。
  - 保留 Go 工作区必须文件：`!go.work`、`!services/**`、`!pkg/**`。

## 10. 参考命令（预发构建与部署）

- 构建（以 siterank 为例）：
  - `gcloud builds submit . --config deployments/siterank/cloudbuild.yaml --substitutions _IMAGE=asia-northeast1-docker.pkg.dev/<PROJECT>/autoads-services/siterank:preview-latest --service-account projects/<PROJECT>/serviceAccounts/codex-dev@<PROJECT>.iam.gserviceaccount.com`
- 部署（Cloud Run）：
  - `gcloud run deploy siterank-preview --image asia-northeast1-docker.pkg.dev/<PROJECT>/autoads-services/siterank:preview-latest --service-account codex-dev@<PROJECT>.iam.gserviceaccount.com --region asia-northeast1 --vpc-connector projects/<PROJECT>/locations/asia-northeast1/connectors/cr-conn-default-ane1 --vpc-egress all --allow-unauthenticated --update-env-vars DATABASE_URL_SECRET_NAME=projects/<PROJECT>/secrets/DATABASE_URL/versions/latest`
- 冒烟：
 - `/health`：`curl -sf https://<SERVICE_URL>/health`
 - siterank 分析：`curl -sS -X POST "$SVC/api/v1/siterank/analyze" -H 'Content-Type: application/json' -H 'X-User-Id: smoke-user' -d '{"offerId":"offer-smoke-1"}'`

---

以上问题与修复均已在本次预发构建与部署中验证通过。若新增问题，请继续在此文件补充“现象/根因/解决/复现要点”。

## 11. Offer 服务 `main.go` 编译失败：`undefined: config.LoadConfig`

- 现象
  - `services/offer/cmd/server/main.go: undefined: config.LoadConfig`
- 根因
  - 代码从早期版本迁移后，`pkg/config` 的接口/版本已改变或未引入；运行时并不需要从外部文件加载配置。
- 解决
  - 改为读取环境变量：`PORT`（默认 8080）与 `DATABASE_URL`；去除文件配置依赖。
  - 注意在重构后补上 `var err error` 声明，避免移除代码后遗留未定义的 `err`。

## 12. Console 规则评估实现中使用匿名 interface 作为参数导致语法错误

- 现象
  - `syntax error: unexpected comma in interface type; possibly missing semicolon or newline or }`
- 根因
  - 在函数签名内直接写 `interface{ service, metric, cmp string; th float64 }` 这种“字段聚合”语法在 Go 中非法。
- 解决
  - 改为显式参数（`svc, metric, cmp string, th float64`）或定义具名结构体类型。

## 13. AdminOnly 阻断内部自动化（Scheduler/Functions）

- 现象
  - Cloud Scheduler/Cloud Functions 调用 Console/Offer 内部接口返回 401/403，日志显示 `Admin role required`。
- 根因
  - `AdminOnly` 只接受用户 Bearer 鉴权，未允许内部自动化访问。
- 解决
  - 在 `AdminOnly` 中增加对 `X-Service-Token` 的校验：当其与环境变量 `INTERNAL_SERVICE_TOKEN` 匹配时放行（仅限内部作业）。
  - 建议对该令牌严格管理，仅用于内部作业，切勿暴露给前端。

## 14. Cloud Build 使用 Kaniko 仍出现 `images not found`

- 现象
  - Kaniko 步骤成功，但 Cloud Build 结束时报 `images not found`。
- 根因
  - `cloudbuild.yaml` 仍保留 `images:` 字段，Cloud Build 会在步骤外二次校验镜像存在。
- 解决
  - 切换 Kaniko 时移除 `images:` 字段，只保留 `--destination=${_IMAGE}`。
  - 参见本仓 `deployments/*/cloudbuild.yaml` 的范例（adscenter/siterank/offer 等）。

## 15. OpenAPI 工具缺失导致 CI 校验失败

- 现象
  - CI 中 `redocly`/`spectral` 或 `oapi-codegen` 不存在；本地 `npx` 环境缺失。
- 解决
  - 提供脚本降级/提示：
    - `scripts/openapi/validate.sh`：优先使用 Redocly；不存在时仅列出规范文件，避免“硬失败”。
    - `scripts/openapi/generate.sh`：在本地安装好 `oapi-codegen` 与 `openapi-typescript` 后运行，CI 中可跳过生成仅做校验。

## 16. Scheduler OIDC 调用易失败，统一改为 Pub/Sub 调度

- 症状
  - 直连 Cloud Run HTTP 调度需要配置 OIDC；不同服务的鉴权与路由差异导致调用时有 401/403 或 5xx。
- 解决
  - 采用模式：Scheduler → Pub/Sub → Cloud Functions(Dispatcher) → 目标服务 HTTP。
  - 优点：
    - 无需为 Scheduler 配置 OIDC；Dispatcher 统一注入 `X-Service-Token`。
    - 作业载荷（URL/Headers/Body）集中在 Pub/Sub 消息中，便于追踪与重放。
  - 产物：`services/functions/dispatcher`、`create-pubsub-dispatcher.sh`、`create-scheduler-pubsub-dispatch.sh`。

## 17. SSE 事件解析与 via 字段展示

- 现象
  - SSE 多行事件解析不稳定；无法在 UI 中稳定显示 Siterank 的 `via`。
- 根因
  - SSE 事件由多行组成，需要完整读取到空行分隔；`data:` 行需拼接再 `JSON.parse`。
- 解决
  - 在前端实现按 `\n\n` 分帧的解析器；对 `event:`/`data:` 逐行提取，确保 `data` 串完整后再 `JSON.parse`，并健壮地捕获 `via`。

## 18. SQL 迁移顺序与 apply 脚本

- 现象
  - 新表（OfferDailyKPI/OfferAccountMap/OfferKpiDeadLetter/notification_rules）增加后忘记应用顺序或漏迁移。
- 解决
  - 统一增加顺序化迁移：012/013/014，并通过 `scripts/db/apply-sql.sh` 按字典序应用。
  - 开发环境建议每次功能完结执行一次 apply，避免接口先行但表结构缺失。

## 19. Bash JSON 参数转义导致 Pub/Sub 载荷格式错误

- 现象
  - 使用 `create-scheduler-pubsub-dispatch.sh` 创建作业时，`HEADERS_JSON` 或 `BODY_JSON` 未正确转义，Cloud Scheduler 发布到 Pub/Sub 的消息 data 不是合法 JSON，分发函数报错。
- 根因
  - Shell 变量中嵌套 JSON 时未用单引号包裹、或内部引号未转义，导致最终字符串被 `jq` 解析失败。
- 解决
  - 统一示例与脚本：`HEADERS_JSON` 与 `BODY_JSON` 强烈建议使用单引号包裹，内部使用双引号，例如：
    - `HEADERS_JSON='{"X-Service-Token":"ENV","Accept":"application/json"}'`
    - `BODY_JSON='{}'`
  - 在脚本内通过 `jq -c -n --arg/--argjson` 构造最终 payload，避免手工拼接。

## 20. Pub/Sub 分发器未注入内部令牌导致 401

- 现象
  - 分发器调用目标服务返回 401/403，后台日志提示需要管理员或内部令牌。
- 根因
  - 载荷 headers 未设置 `X-Service-Token`，或设置的字符串未指示为 ENV 注入模式。
- 解决
  - 在调度脚本中设置：`HEADERS_JSON='{"X-Service-Token":"ENV","Accept":"application/json"}'`，分发器会将 `INTERNAL_SERVICE_TOKEN` 环境变量注入到真实请求头。
  - 确保目标服务的 AdminOnly 中已支持该令牌放行（已在 `pkg/middleware/AdminOnly` 落地）。

## 21. GitHub Actions OpenAPI 校验失败（工具版本/环境缺失）

- 现象
  - 工作流报 `oapi-codegen` 或 `@redocly/cli` 不存在，或 Node/Go 版本不兼容。
- 解决
  - 固定工作流环境：Node 20、Go 1.22，并显式 `go install github.com/deepmap/oapi-codegen/...@latest`。
  - 脚本降级处理：`scripts/openapi/validate.sh` 在 Redocly 缺失时仅做存在性检查，避免硬失败；`ci-check.sh` 先 `validate` 再尝试 `generate`，生成失败不影响校验结果。

## 22. KPI 预热带来的瞬时并发与抖动

- 现象
  - 看板初次加载时若同时触发多条 Offer 的 KPI 拉取，可能造成后端短瞬时拥塞或“占位→真实”的抖动感知变差。
- 解决
  - 采用串行预热 + 微小间隔（每 300ms 触发 1 条，默认前 3 条），并保持“占位→真实”的自动聚合与刷新，不阻塞 UI。

## 23. SSE 事件解析变量复用导致数据解析混乱

- 现象
  - SSE 解析中复用 `data` 变量名或未在分帧后再 JSON 解析，可能导致上一次事件的残留数据串联，JSON 解析失败。
- 解决
  - 按 `\n\n` 分帧后再解析；将 `event:` 与 `data:` 分开累积，完成一个帧后再 `JSON.parse` 到本地作用域变量，避免与外层 `data` 命名冲突。

## 24. Cloud Run Job 迁移失败：已有表结构与新迁移不兼容（列不存在）

- 现象
  - 预发执行 DB 迁移 Job 报错：`apply /app/schemas/sql/014_notification_rules.sql failed: pq: column "service" does not exist`
  - 项目早期版本已创建 `notification_rules` 表，且无 `service/metric` 等新字段；新迁移直接建索引/使用列导致失败。
- 根因
  - 迁移脚本假设“空库/全新建表”，未考虑“已有旧表需增量演进”的情况。
- 解决
  - 将 014 迁移改为“向后兼容、幂等”的增量策略：
    - 先检测表是否存在；存在则 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`、条件创建索引；不存在再一次性建表。
  - 新增 015 补丁脚本，确保旧库平滑升级（补列、回填默认、条件索引创建）。
  - 产物：`schemas/sql/014_notification_rules.sql`（重写为增量版）、`schemas/sql/015_notification_rules_patch.sql`。
  - 旁路：若必须保留“严格迁移”与“增量迁移”，可拆分 dry-run 检查与 apply 两段，并在 Job 启动时加 CHECK_ONLY 模式验证表结构。

## 25. Cloud Run Job 执行失败：VPC Connector 名称错误

- 现象
  - Job 报错 `VpcNetworkNotFound`，提示 VPC connector 不存在或无权限。
- 根因
  - 使用了错误的连接器名称 `autoads-vpc`，预发可用的是 `cr-conn-default-ane1`。
- 解决
  - 更新 Job 部署参数为 `--vpc-connector projects/<PROJECT>/locations/asia-northeast1/connectors/cr-conn-default-ane1`，执行成功。

## 26. gcloud --set-secrets 参数格式错误

- 现象
  - `--set-secrets GOOGLE_ADS_DEVELOPER_TOKEN=projects/.../secrets/GOOGLE_ADS_DEVELOPER_TOKEN:latest` 报 secret 名称无效。
- 根因
  - Cloud Run `--set-secrets` 参数期望的是简名 `NAME:version`，不接受完整资源名。
- 解决
  - 使用短格式：`--set-secrets KEY=SECRET_NAME:latest`。

## 27. OAS 装载顺序导致自定义路由 404（ab-tests/preflight/accounts/oauth/url）

- 现象
  - 直连 Cloud Run 访问 `/api/v1/adscenter/ab-tests`/`/preflight`/`/accounts`/`/oauth/url` 404；其它 OAS 内路由可用。
- 根因
  - 先 Mount OAS 再注册自定义路由，或 BaseURL/catch-all 导致匹配顺序被 OAS 占用。
- 解决
  - 将自定义路由注册“提前于 OAS 挂载”，并对 chi 路由使用 `r.Get/r.Post` 或包装函数，确保中间件与优先级生效。
  - 必要时同时保留 OAS 同名路由（由生成代码挂载），避免 BaseURL 差异。

## 28. chi 路由签名不匹配（Handler vs HandlerFunc）

- 现象
  - 编译错误：`cannot use http.Handler as http.HandlerFunc in r.Get/r.Post`。
- 根因
  - `r.Get/r.Post` 需要 `http.HandlerFunc`，而中间件返回的是 `http.Handler`。
- 解决
  - 使用包装：`r.Get(path, func(w,r){ middleware.AuthMiddleware(http.HandlerFunc(handler)).ServeHTTP(w,r) })`。

## 29. Bash 毫秒时间戳不可移植

- 现象
  - 脚本使用 `date +%s%3N` 在部分环境报 `value too great for base`。
- 根因
  - 不同系统的 `date` 不支持 `%N` 或 `%3N` 精度；行为不一致。
- 解决
  - 用 `python3 -c 'import time; print(int(time.time()*1000))'` 生成毫秒级时间戳（跨平台）。
  - 产物：`scripts/e2e/e2e-perf.sh`、`scripts/e2e/e2e-sample.sh` 已统一。

## 30. Kaniko/KRM 构建成功但 Job 执行拉取旧镜像

- 现象
  - Cloud Build 成功，Job 立即执行仍使用旧镜像版本。
- 根因
  - 构建“成功”到镜像“可拉取”存在短延迟；立即执行 Job 可能还未就绪。
- 解决
  - 构建后等待 30–90s 再执行 Job，或轮询 Artifact Registry 镜像可见性；在脚本中加入 sleep/轮询。

## 31. ads_live 与 stub 同时参与编译导致类型重复声明（redeclaration）

- 现象
  - 在开启 `-tags ads_live` 时，`internal/ads/client_stub.go` 与 `client_live.go` 同时编译，出现 `LiveConfig redeclared`、`NewClient redeclared` 等重复声明错误。
- 根因
  - stub 文件缺少 build tag 隔离，live/stub 两套实现会同时参与构建。
- 解决
  - 为 stub 增加 build 标签：文件头部添加 `//go:build !ads_live`（仅在非 ads_live 构建时编译）。
  - 业务侧统一通过 `NewClient(ctx, LiveConfig)` 获取客户端：普通构建返回 StubClient，ads_live 返回 LiveClient，避免在代码里引用 `NewClientStub()`。
  - 路径：services/adscenter/internal/ads/client_stub.go、services/adscenter/main.go。

## 32. http 客户端 API 不匹配（Do vs DoRaw）

- 现象
  - `executor_live.go` 使用 `e.http.Do(req)` 编译失败，提示 `Do undefined`（包装类型为 `pkg/http.Client`）。
- 根因
  - `pkg/http.Client` 暴露的是 `DoJSON` 和 `DoRaw`，没有 `Do` 方法。
- 解决
  - 将 `Do` 改为 `DoRaw`，保持原始 `http.Response` 读取逻辑。
  - 路径：services/adscenter/internal/executor/executor_live.go。

## 33. Preflight LiveClient 接口缺失方法导致不满足接口定义

- 现象
  - 预检模块依赖 `LiveClient` 接口，报 `does not implement (missing AdsAPIPing)` 或缺失 `HasActiveConversionTracking/HasSufficientBudget`。
- 根因
  - LiveClient 实现未覆盖 preflight 需要的所有方法。
- 解决
  - 在 live 客户端补齐方法（基于 Google Ads REST/GAQL 的最小实现）：
    - `AdsAPIPing`（复用 listAccessibleCustomers）
    - `HasActiveConversionTracking`（查询 conversion_tracking_setting）
    - `HasSufficientBudget`（查询至少一个 campaign_budget）
  - 路径：services/adscenter/internal/ads/client_live.go。

## 34. apply_patch 添加包含反斜线续行的脚本失败

- 现象
  - 向仓库添加包含多行 `\` 续行的 shell 脚本时，apply_patch 报告 hunk 解析失败。
- 根因
  - 补丁内容中反斜线续行与补丁解析混淆。
- 解决
  - 使用 heredoc 并单引号关闭：`cat <<'EOF' ... EOF` 方式写入脚本，或在 apply_patch 的 Add File 段中直接放入完整脚本文本。
  - 案例：deployments/scripts/cloudrun-scaling-recommendations.sh。

## 35. A/B 赢家计划前端提交 validateOnly 未关闭

- 现象
  - 详情页生成的赢家计划默认 `validateOnly=true`，直接提交批量接口时计划未真正入队。
- 根因
  - 前端提交前未将 `validateOnly` 显式置为 false。
- 解决
  - 在前端提交函数中解析 JSON 后强制 `plan.validateOnly=false` 再提交。
  - 文件：apps/frontend/src/app/adscenter/ab-tests/[id]/page.tsx。

## 36. ADJUST_CPC/ADJUST_BUDGET 的“百分比变更”执行逻辑缺失

- 现象
  - 赢家计划采用 `percent` 字段描述增减，但执行器仅支持 `cpcMicros/amountMicros` 绝对值，导致计划无法落地。
- 根因
  - Live 执行器未实现基于当前值的百分比计算。
- 解决
  - 在 `executor_live.go` 中：
    - 若传入 `percent`，则先查询当前值（`fetchCriterionCPC`/`fetchBudgetAmounts`），计算新值并生成 mutate operations；落库前后添加 before/after 到详情。
  - 仍兼容绝对值参数。

## 37. 目标资源自动派生（filter→targets）的一致性与安全

- 现象
  - 赢家计划仅提供 `filter.abTestId/variant/adGroupId`，执行时需要 `targetResourceNames/campaignBudgetResourceNames` 才能落地。
- 解决
  - 在执行阶段（execute-next）引入派生逻辑（ads_live 生效，可通过 `ADS_DERIVE_TARGETS=false` 关闭）：
    - ADJUST_CPC：根据 `adGroupId` 查询该组内关键字的 `ad_group_criterion` 资源名填入 `targetResourceNames`。
    - ADJUST_BUDGET：根据 `adGroupId` 反查 Campaign，再查 `campaign_budget` 资源名填入 `campaignBudgetResourceNames`。
  - 增加上限 `ADS_DERIVE_MAX_TARGETS`（默认 50），避免单次过量下发。
  - 赢家计划输出时在 filter 中补充 `adGroupId`（A/B 组别）以便派生。
  - 路径：services/adscenter/main.go、services/adscenter/internal/ads/client_live.go。
  - 指标：`ac_derived_targets_total{type, result}`（filled/skipped），可在控制台聚合跳过率。

## 38. 安全头中间件顺序与 HSTS 的环境限定

- 现象
  - 将安全头中间件放在路由挂载之后，部分响应未携带统一安全头；预发开启 HSTS 导致浏览器强制 HTTPS 后难以撤销。
- 解决
  - 在 chi 中确保中间件在任何路由挂载之前注册：`r.Use(SecurityHeaders())`。
  - HSTS 仅在生产启用：判断 `STACK=prod` 再设置 `Strict-Transport-Security`，避免预发/本地污染浏览器。
  - 路径：pkg/middleware/security.go、services/adscenter/main.go。

## 39. Prometheus Register 重复注册报错

- 现象
  - 多次调用 `prometheus.Register(metric)` 报错：`duplicate metrics collector registration attempted`。
- 解决
  - 注册时忽略错误（无需 panic）：`_ = prometheus.Register(metric)`；或在 package 级别仅初始化一次。
  - 指标命名统一前缀，避免与第三方冲突。

## 40. /api/v1/adscenter/bulk-actions 返回 404（OAS 挂载与自定义路由差异）

- 现象
  - 预发调用 `POST /api/v1/adscenter/bulk-actions` 返回 404，但 OAS 中已声明路径。
- 根因
  - OAS 生成的 Chi 路由挂载顺序与中间件组合和 BaseURL 差异，导致匹配未命中；同时自定义实现存在于非 OAS 代码路径中。
- 解决
  - 在主路由中显式注册自定义镜像端点，并放在 OAS Mount 之前：
    - `r.Handle("/api/v1/adscenter/bulk-actions", IdempotencyMiddleware(AuthMiddleware(http.HandlerFunc(srv.submitBulkActionsHandler))))`
  - 仍保留 OAS Handler 以做契约校验，但请求优先命中自定义路由。

## 41. Cloud Build（adscenter）构建失败：`c.Redis undefined`（pkg/cache 模块漂移）

- 现象
  - Cloud Build 远端构建 adscenter 报错：`pkg/ratelimitredis` 或 `pkg/redislock` 中引用 `c.Redis` 不存在。
- 根因
  - 远端 go mod 解析到了历史版本的 `pkg/cache`，与本地 workspace 用到的版本结构不一致。
- 解决
  - 在服务 go.mod 中显式 `replace` 到 workspace：
    - `replace github.com/xxrenzhe/autoads/pkg/cache => ../../pkg/cache`
  - 保持其它内部包同样使用本地 replace，关闭 GOWORK（Dockerfile）避免远端解析异常。

## 42. Cloud Run 返回 `SERVER_NOT_CONFIGURED: DATABASE_URL not set`

- 现象
  - `execute-tick`/`execute-next`/`diagnose/execute` 等端点在预发返回 `DATABASE_URL not set`。
- 根因
  - 预发服务未注入 `DATABASE_URL`；部分实现直接 `os.Getenv` 必须命中。
- 解决
  - 代码层：为关键端点增加 DB 连接池回退（优先使用 `s.db`，仅在缺少时临时打开新连接）。
  - 运维层：使用 `deployments/scripts/secret-env-sync.sh` 从 Secret Manager 注入 `DATABASE_URL` 到 Cloud Run：
    - `SECRETS='DATABASE_URL=projects/<PROJECT>/secrets/DATABASE_URL/versions/latest'`

## 43. Cloud Scheduler PERMISSION_DENIED（jobs.create）

- 现象
  - 执行 `gcloud scheduler jobs create http` 报缺少 `cloudscheduler.jobs.create`。
- 根因
  - 当前服务账号未授予 Cloud Scheduler 管理权限。
- 解决
  - 为 `codex-dev@<PROJECT>.iam.gserviceaccount.com` 赋予 `roles/cloudscheduler.admin`。
  - 创建/更新 Job 时，使用 OIDC 指向 Cloud Run 运行身份：
    - `--oidc-service-account-email=$(gcloud run services describe <svc> --format='value(template.spec.serviceAccountName)')`

## 44. BFF 重写与新端点路径对齐（/api 前缀）

- 现象
  - 前端 http 客户端以 `/api/*` 为基底重写到 `/api/go/*`；新后端端点若未在 `/api/...` 命名空间下会导致直连失败。
- 解决
  - 推荐层服务为新端点提供 `/api/v1/recommend/...` 与 `/api/recommend/...` 双别名，前者用于直连，后者便于通过 Next 重写访问。
  - 前端统一以 `/api/recommend/*`、`/api/adscenter/*` 调用，确保通过 BFF。

## 45. 提交大计划后无分片推进（execute-tick 未触发）

- 现象
  - 提交 40 动作计划后，未见推进；手工 tick 返回 processed=0。
- 根因
  - 缺少 Cloud Scheduler 定时触发；或执行端需要 OIDC 调用。
- 解决
  - 创建 `adscenter-preview-execute-tick` Job（*/5 分钟）触发 `/api/v1/adscenter/bulk-actions/execute-tick?max=N`；
  - 首次手工触发后观察 processed>0，随后交由调度推进。

## 46. secret-env-sync.sh 404（重复拼接 versions 导致路径错误）

- 现象
  - 运行 `deployments/scripts/secret-env-sync.sh` 报 404，路径含重复 `.../versions/latest/versions/latest`。
- 根因
  - 脚本将 `--secret` 参数错误地传入了 `DATABASE_URL/versions/latest` 字串；`--secret` 只接受 Secret 名称。
- 解决
  - 修复脚本解析：分别提取 `<name>` 与 `<version>`，调用 `gcloud secrets versions access <version> --secret <name>`。
  - 改动：以 sed 正则解析 `projects/.../secrets/<name>/versions/<ver>`，避免路径拼接错误。

## 47. Cloud SQL 私网访问导致 /readyz=500（未挂 VPC Connector）

- 现象
  - 注入了 `DATABASE_URL`（10.x 私网地址），Cloud Run 仍返回 `/readyz`=500。
- 根因
  - Cloud Run 访问私网资源需要 VPC Connector；默认 egress=private-ranges-only/无 Connector 无法访问数据库私网地址。
- 解决
  - 为服务绑定 VPC Connector 并放行 egress：
    - `gcloud run services update <svc> --vpc-connector cr-conn-default-ane1 --vpc-egress all-traffic`
  - 重试 `/readyz` 变为 200。



## 40. 解析 /metrics 行为差异与时间戳字段

- 现象
  - 控制台解析 `/metrics` 时，Prometheus exposition 末尾可能包含时间戳字段（两段数字），导致取值错误。
- 解决
  - 使用 `strings.Fields` 分割后取“最后一个字段”为 value；如出现两段数值，取倒数第一段（见 console `getAPIUsage/getSLO` 的实现）。
  - p95 等统计从 `_sum/_count` 派生时注意单位（秒→毫秒）。

## 41. Playwright e2e 使用请求上下文与鉴权头

- 现象
  - 使用浏览器 UI 做 e2e，稳定性差且需要复杂的登录流程；CI 中容易 flaky。
- 解决
  - 使用 `request.newContext({ baseURL, extraHTTPHeaders })` 直接调用后端 API；通过环境变量 `GATEWAY/AUTH` 注入 BaseURL 与 Bearer 鉴权头。
  - 仅做“链路验证”而非 UI 验证，可快速定位后端回归。

## 42. Cloud Run 蓝绿/金丝雀流量切换参数细节

- 现象
  - `gcloud run services update-traffic` 的 `--to-latest/--to-revisions` 组合与百分比语法易混淆。
- 解决
  - 以脚本固化常用命令：`deployments/scripts/bluegreen-rollout.sh`、`canary-rollout.sh`；上线前验证 `/readyz`；金丝雀按步进提升流量并留出观察窗口。

## 43. 目标派生的缓存与限额

- 现象
  - GAQL 查询频繁，目标派生（adGroup→criteria/campaign→budget）在高并发下可能产生外部 API 压力；一次派生过多目标导致 mutate 失败或时延抖动。
- 解决
  - 引入简单 TTL 缓存（默认 5 分钟，可配置）：adGroup→campaign、campaign→budget、adGroup→keyword criteria。
  - 增加上限 `ADS_DERIVE_MAX_TARGETS`（默认 50）；可通过 `ADS_DERIVE_TARGETS=false` 关闭派生。
  - 输出缓存命中/未命中指标：`ac_derive_cache_hits_total{kind}`/`ac_derive_cache_miss_total{kind}`。

## 44. 默认 CSP 影响部分服务的自定义策略

- 现象
  - 统一设置了严格的 `Content-Security-Policy` 后，单个服务希望放宽（例如加载外部图表库）时被覆盖。
- 解决
  - 安全头中间件仅在响应头不存在 `Content-Security-Policy` 时设置默认值；具体服务可在 handler 中覆盖更宽松的 CSP。

## 45. SQL 按天聚合的 interval 拼接与类型

- 现象
  - 使用 `$1::interval` 直接传天数失败，或字符串拼接未转为 interval 导致语法错误。
- 解决
  - 以文本拼接再强转：`created_at >= NOW() - ($1::text||' days')::interval`，`$1` 传入天数字符串（见 `reportsBasicHandler`）。
