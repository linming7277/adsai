# CI/CD（Cloud Run + Supabase + API Gateway）

本文档说明如何配置 GitHub Actions 与 Cloud Build，使后端服务和前端 BFF 构建/部署至 Cloud Run，并在流水线中完成 Supabase 冒烟与 API Gateway 同步。Firebase Hosting 流程已下线，可参考历史文档 `docs/deployment/FINAL_SUMMARY.md`。

## 必要的 GitHub Secrets

- `GCP_PROJECT_ID`: `gen-lang-client-0944935873`
- `GCP_REGION`: `asia-northeast1`（可选，默认该值）
- `GCP_SA_KEY`: 一个具备 Cloud Build / Artifact Registry / Cloud Run / API Gateway / Service Usage 权限的服务账号 JSON（推荐最小权限：`run.admin`、`cloudbuild.builds.editor`、`artifactregistry.admin`、`apigateway.admin`、`serviceusage.serviceUsageAdmin`）
- `SUPABASE_PROJECT_URL`: `https://<project-ref>.supabase.co`
- `SUPABASE_ANON_KEY`: Supabase 匿名 Key（提供给冒烟脚本）
- `SUPABASE_SERVICE_KEY`: Supabase Service Role Key（供运维脚本访问）
- `SUPABASE_ACCESS_TOKEN`: Supabase 管理 API Token（可选）
- `SUPABASE_PROJECT_REF`: Supabase Project Ref（例：`jzzvizacfyipzdyiqfzb`）
- `SUPABASE_DB_HOST / PORT / USER / PASSWORD / NAME`: 若需在流水线中验证 PgBouncer 连接，可注入这些变量
\- （可选）Repository Variables：
  - `GCP_REGION`: `asia-northeast1`
  - `ARTIFACT_REPO`: `autoads-services`（Artifact Registry 代码库名）

> 注意：业务数据库等敏感配置不写入 GitHub Secrets，全部放在 Google Cloud Secret Manager 中，部署时依赖 `--set-secrets` 与 `DATABASE_URL_SECRET_NAME` 注入。

## 工作流说明

### 后端（Cloud Run + Artifact Registry）
- 文件：`.github/workflows/deploy-backend.yml`
- 触发：
  - 推送到 `main` → 环境：preview；镜像标签：`preview-latest`、`preview-<commit>`；部署到 Cloud Run（`asia-northeast1`）
  - 推送到 `production` → 环境：prod；镜像标签：`prod-latest`、`prod-<commit>`；部署到 Cloud Run（`asia-northeast1`）
  - 推送 tag（`v*`）→ 环境：prod；镜像标签：`prod-<tag>`、`prod-<commit>`；部署到 Cloud Run（`asia-northeast1`）
\- 镜像仓库：Google Cloud Artifact Registry，仓库名 `autoads-services`，镜像前缀：`<REGION>-docker.pkg.dev/<PROJECT_ID>/autoads-services/<service>`
\- 分阶段 Job：
  - meta：计算环境与镜像标签（primary/secondary）
  - changes：检测变更服务，输出矩阵
  - build-images：使用 Cloud Build 构建主标签镜像
  - tag-images：添加第二标签（避免重建）
  - deploy-services：使用主标签镜像部署到 Cloud Run（不覆盖运行时 env/secrets）
\- 变更检测：仅对变更过的服务进行构建与部署（脚本 `scripts/deploy/detect-changed-services.sh` 动态生成矩阵）
\- 版本发布：当触发 Tag（`v*`）构建时，强制全量部署所有服务（忽略变更检测）

### 网关（API Gateway）
- 文件：`.github/workflows/deploy-gateway.yml`
- 触发：推送到 `main/production` 或发布 Tag（`v*`），且任一变更命中 `deployments/api-gateway/gateway.yaml`、`scripts/gateway/**` 或 `services/**`
- 环境映射：`main` → preview（`autoads-api-preview`/`autoads-gw-preview`），`production`/Tag → prod（`autoads-api-prod`/`autoads-gw`）
- 动作：
  - 发现各 Cloud Run 服务 URL（`gcloud run services describe`）
  - 渲染 gateway.yaml（替换 `*-REPLACE_WITH_RUN_URL` 占位符）
  - 创建/更新 API 与 Gateway 实例
  - 可观测性：在 Job Summary 中输出 Gateway 默认域名，便于回溯

### 服务级构建（Build Service Docker）
- 文件：`.github/workflows/build-service-docker.yml`
- 触发：
  - PR 触发（仅当 `services/**`、`pkg/**` 等发生变更）
  - 手动 `workflow_dispatch`
- 动作：
  - 检测受影响服务矩阵并执行 `go test ./...`
  - 可选 Supabase 冒烟（当注入 Supabase Secrets 时运行 `scripts/test-supabase-connection.sh`）
  - 预留扩展位：后续可接入 API Smoke / E2E（Settings）
- 作用：在合并前确保服务编译通过，且核心 Supabase 依赖正常。

## 本地一键部署脚本（可选）

- `scripts/deploy/cloudrun-deploy.sh`: 云端构建镜像并部署 Cloud Run。
- `scripts/gcp/grant-run-sa.sh`: 自动为 Cloud Run 运行时服务账号授予常用权限（SecretManager/CloudSQL/PubSub）。
- `scripts/gateway/render-gateway-config.sh`: 渲染 API Gateway OpenAPI（替换 Cloud Run URL 占位符）。
- `scripts/gateway/deploy-gateway.sh`: 创建/更新 API 与 Gateway。

## 受保护路由联测

渲染/发布网关后，使用 `scripts/tests/gateway-smoke.sh` 做冒烟：

```bash
GATEWAY_HOST=<your-gateway-hostname> bash scripts/tests/gateway-smoke.sh
GATEWAY_HOST=<your-gateway-hostname> bash scripts/tests/gateway-smoke.sh <FIREBASE_ID_TOKEN>
```

未带 JWT 访问受保护路由应返回 401，带合法 ID Token 返回 200。
