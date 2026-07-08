# Browser-Exec 标准部署流程

**更新时间**: 2025-10-02
**服务名称**: browser-exec (Playwright 浏览器自动化服务)

---

## 一、部署架构

### 部署流程概述

```
┌─────────────────┐
│  开发者推送代码   │
│  git push       │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Github Actions                     │
│  (.github/workflows/deploy-backend.yml) │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Cloud Build                        │
│  构建 Docker 镜像                    │
│  (services/browser-exec/cloudbuild.yaml) │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Artifact Registry                  │
│  存储镜像                            │
│  asia-northeast1-docker.pkg.dev/... │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Cloud Run (拆分架构)                                │
│  ┌─────────────────────┐  ┌───────────────────────┐ │
│  │ browser-exec-preview│  │ browser-exec-preview- │ │
│  │ (API)               │  │ worker (Worker)       │ │
│  │ 接收请求，发布队列    │  │ 消费队列，浏览器任务   │ │
│  └─────────────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**架构说明 (2025-10-02 更新)**:
- **API 实例**: browser-exec-preview (1Gi/1CPU, 1-5实例)
  - 接收 HTTP 请求
  - 发布消息到 Pub/Sub
- **Worker 实例**: browser-exec-preview-worker (2Gi/2CPU, 5-20实例)
  - 消费 Pub/Sub 队列
  - 执行浏览器自动化任务

---

## 二、触发条件

### 自动部署

browser-exec 服务会在以下情况下自动部署：

#### 1. **代码推送到 main 分支** → 部署到预发环境
```bash
git push origin main
```
**触发条件**:
- `services/browser-exec/` 目录下的文件发生变化
- 或共享代码（`pkg/`, `go.work` 等）发生变化

**部署目标**: `browser-exec-preview`（预发环境）
**镜像标签**: `preview-<commit-sha>` 和 `preview-latest`

#### 2. **代码推送到 production 分支** → 部署到生产环境
```bash
git push origin production
```
**部署目标**: `browser-exec`（生产环境）
**镜像标签**: `prod-<commit-sha>` 和 `prod-latest`

#### 3. **打 Tag** → 正式版本发布
```bash
git tag v1.0.0
git push origin v1.0.0
```
**部署目标**: `browser-exec`（生产环境）
**镜像标签**: `prod-v1.0.0` 和 `prod-<commit-sha>`

### 手动触发

在 Github Actions 页面可以手动触发 `workflow_dispatch`：
1. 访问：https://github.com/YOUR_ORG/autoads/actions/workflows/deploy-backend.yml
2. 点击 "Run workflow"
3. 选择分支
4. 点击 "Run workflow" 按钮

---

## 三、配置文件

### 3.1 cloudbuild.yaml

**文件路径**: `services/browser-exec/cloudbuild.yaml`

```yaml
timeout: "3600s"
options:
  logging: GCS_ONLY
logsBucket: gs://autoads-build-logs-asia-northeast1/logs
substitutions:
  _SERVICE: "browser-exec"
  _IMAGE: "asia-northeast1-docker.pkg.dev/PROJECT/REPO/browser-exec:preview-latest"
steps:
  - name: 'gcr.io/cloud-builders/docker'
    id: Build
    args:
      - build
      - '-f'
      - 'services/${_SERVICE}/Dockerfile'
      - '-t'
      - '${_IMAGE}'
      - '.'
images:
  - '${_IMAGE}'
```

**说明**:
- 只负责构建 Docker 镜像
- 不包含部署步骤（部署由 Github Actions 处理）
- 与其他后端服务保持一致

### 3.2 Github Actions Workflow

**文件路径**: `.github/workflows/deploy-backend.yml`

**关键配置**:

#### 服务检测列表（第 77 行）:
```yaml
services='["billing","offer","siterank","adscenter","batchopen","console","recommendations","notifications","browser-exec"]'
```

#### browser-exec 拆分架构部署配置（第 289-324 行）:

**更新时间**: 2025-10-02
**架构**: API + Worker 分离

```bash
if [[ "$SERVICE" == "browser-exec" ]]; then
  echo "Deploying browser-exec with split architecture: API + Worker"

  # 1. Deploy API instance (接收请求，发布到队列)
  echo "Deploying ${TARGET_SERVICE} (API instance)"
  gcloud run deploy "${TARGET_SERVICE}" \
    --image "${IMAGE}" \
    --region "${REGION:-asia-northeast1}" \
    --platform managed \
    --allow-unauthenticated \
    --project "${PROJECT_ID}" \
    --memory 1Gi \
    --cpu 1 \
    --concurrency 10 \
    --max-instances 5 \
    --min-instances 1 \
    --timeout 60s \
    --execution-environment gen2 \
    --set-env-vars "PLAYWRIGHT=1,ENABLE_QUEUE_WORKER=0,BROWSER_MAX_CONCURRENCY=4,BROWSER_MAX_CONTEXTS=12,BROWSER_MAX_MEMORY_MB=1536,NODE_ENV=production"

  # 2. Deploy Worker instance (消费队列，处理浏览器任务)
  echo "Deploying ${TARGET_SERVICE}-worker (Worker instance)"
  gcloud run deploy "${TARGET_SERVICE}-worker" \
    --image "${IMAGE}" \
    --region "${REGION:-asia-northeast1}" \
    --platform managed \
    --no-allow-unauthenticated \
    --project "${PROJECT_ID}" \
    --memory 2Gi \
    --cpu 2 \
    --concurrency 1 \
    --max-instances 20 \
    --min-instances 5 \
    --timeout 600s \
    --execution-environment gen2 \
    --set-env-vars "PLAYWRIGHT=1,ENABLE_QUEUE_WORKER=1,BROWSER_MAX_CONCURRENCY=10,BROWSER_MAX_CONTEXTS=20,BROWSER_MAX_MEMORY_MB=1536,NODE_ENV=production"
fi
```

**关键变更**:
- ✅ 拆分为 2 个独立服务: API 和 Worker
- ✅ API: 1Gi/1CPU, concurrency=10, ENABLE_QUEUE_WORKER=0
- ✅ Worker: 2Gi/2CPU, min=5, max=20, ENABLE_QUEUE_WORKER=1
- ✅ Worker 不对外开放 (--no-allow-unauthenticated)

### 3.3 服务检测脚本

**文件路径**: `scripts/deploy/detect-changed-services.sh`

**更新**（第 26 行）:
```bash
echo '["billing","offer","siterank","adscenter","batchopen","console","recommendations","notifications","browser-exec"]'
```

---

## 四、browser-exec 特殊配置

### Cloud Run 资源配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| **Memory** | 2Gi | Playwright + Chromium 需要大内存 |
| **CPU** | 2 | 并发浏览器实例需要多核 |
| **Concurrency** | 80 | 每个实例最多处理 80 个并发请求 |
| **Max Instances** | 10 | 最多 10 个实例（自动扩展） |
| **Min Instances** | 0 | 无流量时缩容到 0 |
| **Timeout** | 300s | 5 分钟超时（处理复杂的浏览器任务） |
| **Execution Env** | gen2 | 使用第二代执行环境 |

### 环境变量

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `PLAYWRIGHT` | 1 | 启用 Playwright |
| `BROWSER_MAX_CONCURRENCY` | 4 | 最大并发任务数 |
| `BROWSER_MAX_CONTEXTS` | 12 | 最大浏览器上下文数 |
| `BROWSER_MAX_MEMORY_MB` | 1536 | 最大内存使用（MB） |
| `NODE_ENV` | production | 生产环境模式 |

---

## 五、部署操作指南

### 5.1 正常开发流程（推荐）

1. **在本地开发和测试**:
```bash
cd services/browser-exec
npm install
npm test
```

2. **提交代码到本地分支**:
```bash
git add services/browser-exec/
git commit -m "feat(browser-exec): 优化 Cloudflare 绕过逻辑"
```

3. **推送到 main 分支触发预发部署**:
```bash
git push origin main
```

4. **监控部署进度**:
   - Github Actions: https://github.com/YOUR_ORG/autoads/actions
   - Cloud Build: https://console.cloud.google.com/cloud-build/builds
   - Cloud Run: https://console.cloud.google.com/run

5. **测试预发环境**:
```bash
curl https://browser-exec-preview-644672509127.asia-northeast1.run.app/healthz
```

6. **验证通过后，合并到 production 分支**:
```bash
git checkout production
git merge main
git push origin production
```

### 5.2 紧急修复流程

如果需要快速手动部署（绕过 Github Actions）:

```bash
# 1. 构建并部署（一步完成）
gcloud builds submit \
  --config services/browser-exec/cloudbuild.yaml \
  --substitutions _SERVICE=browser-exec,_IMAGE=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/browser-exec:hotfix-$(git rev-parse --short HEAD)

# 2. 手动部署到 Cloud Run
gcloud run deploy browser-exec-preview \
  --image asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/browser-exec:hotfix-$(git rev-parse --short HEAD) \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --concurrency 80 \
  --max-instances 10 \
  --timeout 300s \
  --execution-environment gen2 \
  --set-env-vars "PLAYWRIGHT=1,BROWSER_MAX_CONCURRENCY=4,BROWSER_MAX_CONTEXTS=12,BROWSER_MAX_MEMORY_MB=1536,NODE_ENV=production"
```

⚠️ **注意**: 手动部署仅用于紧急情况，日常开发请使用标准的 Github Actions 流程。

---

## 六、验证部署

### 6.1 检查服务状态

```bash
# 检查预发环境
gcloud run services describe browser-exec-preview --region=asia-northeast1 --format="value(status.url,status.latestReadyRevisionName)"

# 检查生产环境
gcloud run services describe browser-exec --region=asia-northeast1 --format="value(status.url,status.latestReadyRevisionName)"
```

### 6.2 健康检查

```bash
# 预发环境
curl https://browser-exec-preview-644672509127.asia-northeast1.run.app/healthz
curl https://browser-exec-preview-644672509127.asia-northeast1.run.app/api/v1/browser/stats

# 生产环境
curl https://browser-exec-644672509127.asia-northeast1.run.app/healthz
```

### 6.3 功能测试

运行完整的测试脚本：
```bash
node test-bonusarrive-debug.js
node test-final-validation.js
```

---

## 七、故障排查

### 7.1 构建失败

**查看 Cloud Build 日志**:
```bash
gcloud builds list --limit=5
gcloud builds log <BUILD_ID>
```

**常见问题**:
- Dockerfile 路径错误 → 检查 `cloudbuild.yaml` 中的 `-f` 参数
- 依赖安装失败 → 检查 `package.json` 和网络连接
- 内存不足 → 增加 Cloud Build 的资源配置

### 7.2 部署失败

**查看 Cloud Run 日志**:
```bash
gcloud run services logs read browser-exec-preview --region=asia-northeast1 --limit=50
```

**常见问题**:
- 镜像拉取失败 → 检查 Artifact Registry 权限
- 服务启动超时 → 检查健康检查端点
- 内存不足 → 增加 `--memory` 配置

### 7.3 运行时错误

**实时查看日志**:
```bash
gcloud run services logs tail browser-exec-preview --region=asia-northeast1
```

**Playwright 相关问题**:
- `Error: Failed to launch browser` → 检查 `PLAYWRIGHT=1` 环境变量
- `net::ERR_PROXY_CONNECTION_FAILED` → 检查代理配置
- `net::ERR_SSL_PROTOCOL_ERROR` → 检查 SSL 证书和代理

---

## 八、优化建议

### 8.1 .gcloudignore 优化

确保 `.gcloudignore` 排除不必要的文件，减少上传时间：
```
apps/
hosting/
autoads-mirror/
node_modules/
makerkit/
docs/
```

### 8.2 构建缓存

使用 Docker 层缓存加速构建：
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - build
      - '--cache-from'
      - 'asia-northeast1-docker.pkg.dev/.../browser-exec:preview-latest'
      - '-t'
      - '${_IMAGE}'
      - '.'
```

### 8.3 并发控制

根据实际负载调整 `--concurrency` 和 `--max-instances`：
- 高流量：增加 `--max-instances`
- 低延迟：增加 `--min-instances` 到 1

---

## 九、总结

✅ **已完成配置**:
1. ✅ `services/browser-exec/cloudbuild.yaml` - 标准构建配置
2. ✅ `.github/workflows/deploy-backend.yml` - 添加 browser-exec 到部署流程
3. ✅ `scripts/deploy/detect-changed-services.sh` - 添加到服务检测列表
4. ✅ `.gcloudignore` - 优化上传大小（从 1.5GB → ~330MB）

✅ **部署方式**:
- **标准流程**: `git push origin main` → Github Actions → Cloud Build → Cloud Run
- **紧急修复**: 手动 `gcloud builds submit` + `gcloud run deploy`

✅ **特殊配置**:
- 2GB 内存、2 CPU
- Playwright 环境变量
- 5 分钟超时
- 自动扩展（0-10 实例）

---

**文档维护**: codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com
**最后更新**: 2025-10-02
