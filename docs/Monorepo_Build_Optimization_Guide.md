# Monorepo 镜像构建优化指南

**问题**: 单仓库多服务架构下，Cloud Build上传源代码过大（1.6GB），导致构建缓慢（10分钟+）

**解决方案**: 针对不同服务类型使用专用的构建脚本，减少上传体积到10-30MB

---

## 📊 优化成果对比

| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| 上传大小 | 1.6 GB | 13 MB | **↓ 99.2%** |
| 上传时间 | ~10 分钟 | ~5 秒 | **↓ 99%** |
| 构建时间 | 10+ 分钟 | 3-4 分钟 | **↓ 60%** |
| 文件数量 | 5602 个 | ~100 个 | **↓ 98%** |

---

## 🏗️ 服务分类与优化方案

### 1️⃣ Go 后端服务（推荐方案）

**适用服务**:
- `siterank` - Site评分服务
- `billing` - 计费服务
- `adscenter` - 广告中心
- `recommendations` - 推荐服务
- `identity` - 身份认证
- `notifications` - 通知服务

**优化脚本**: `scripts/build/build-go-service.sh`

```bash
#!/bin/bash
# Go服务统一构建脚本
# 用法: ./build-go-service.sh <service-name> <environment>
# 示例: ./build-go-service.sh siterank preview

set -e

SERVICE_NAME="${1}"
ENVIRONMENT="${2:-preview}"
PROJECT_ID="gen-lang-client-0944935873"
REGION="asia-northeast1"

if [ -z "${SERVICE_NAME}" ]; then
  echo "用法: $0 <service-name> <environment>"
  echo "示例: $0 siterank preview"
  exit 1
fi

SERVICE_DIR="services/${SERVICE_NAME}"

if [ ! -d "${SERVICE_DIR}" ]; then
  echo "❌ 服务目录不存在: ${SERVICE_DIR}"
  exit 1
fi

echo "========================================="
echo "构建 Go 服务: ${SERVICE_NAME}"
echo "环境: ${ENVIRONMENT}"
echo "========================================="

# 步骤 1: 创建精简源代码包
echo ""
echo "步骤 1/3: 创建源代码包..."

TARBALL="/tmp/${SERVICE_NAME}-source.tar.gz"

tar -czf "${TARBALL}" \
  --exclude='apps' \
  --exclude='makerkit' \
  --exclude='docs' \
  --exclude='schemas' \
  --exclude='scripts' \
  --exclude='deployments' \
  --exclude='autoads-mirror' \
  --exclude='hosting' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='*.log' \
  go.work go.work.sum services/"${SERVICE_NAME}" pkg

TARBALL_SIZE=$(du -sh "${TARBALL}" | cut -f1)
echo "✅ 源代码包已创建: ${TARBALL_SIZE}"

# 步骤 2: 构建 Docker 镜像
echo ""
echo "步骤 2/3: 构建 Docker 镜像..."

if [ ! -f "${SERVICE_DIR}/cloudbuild.yaml" ]; then
  echo "❌ 缺少 cloudbuild.yaml: ${SERVICE_DIR}/cloudbuild.yaml"
  exit 1
fi

gcloud builds submit "${TARBALL}" \
  --config="${SERVICE_DIR}/cloudbuild.yaml" \
  --project="${PROJECT_ID}" \
  --substitutions=_ENVIRONMENT="${ENVIRONMENT}"

IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/autoads-services/${SERVICE_NAME}:${ENVIRONMENT}-latest"
echo "✅ 镜像已推送: ${IMAGE_TAG}"

# 步骤 3: 部署到 Cloud Run
echo ""
echo "步骤 3/3: 部署到 Cloud Run..."

gcloud run deploy "${SERVICE_NAME}-${ENVIRONMENT}" \
  --image="${IMAGE_TAG}" \
  --platform=managed \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300 \
  --concurrency=80 \
  --max-instances=10 \
  --min-instances=1 \
  --set-env-vars="ENVIRONMENT=${ENVIRONMENT}" \
  --allow-unauthenticated \
  --quiet

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}-${ENVIRONMENT}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='value(status.url)')

echo ""
echo "========================================="
echo "✅ 部署成功！"
echo "========================================="
echo "服务名称: ${SERVICE_NAME}-${ENVIRONMENT}"
echo "服务URL: ${SERVICE_URL}"
echo ""
echo "验证命令:"
echo "  curl ${SERVICE_URL}/health"
echo ""

# 清理临时文件
rm -f "${TARBALL}"
```

**使用方法**:
```bash
# 在项目根目录执行
./scripts/build/build-go-service.sh siterank preview
./scripts/build/build-go-service.sh billing production
```

---

### 2️⃣ Node.js 服务

**适用服务**:
- `functions` - Cloud Functions
- `browser-exec` - Playwright浏览器服务

**优化脚本**: `scripts/build/build-node-service.sh`

```bash
#!/bin/bash
# Node.js服务统一构建脚本
# 用法: ./build-node-service.sh <service-name> <environment>

set -e

SERVICE_NAME="${1}"
ENVIRONMENT="${2:-preview}"
PROJECT_ID="gen-lang-client-0944935873"
REGION="asia-northeast1"

echo "========================================="
echo "构建 Node.js 服务: ${SERVICE_NAME}"
echo "========================================="

# 创建精简源代码包
TARBALL="/tmp/${SERVICE_NAME}-source.tar.gz"

tar -czf "${TARBALL}" \
  --exclude='apps/frontend' \
  --exclude='makerkit' \
  --exclude='services/siterank' \
  --exclude='services/billing' \
  --exclude='services/adscenter' \
  --exclude='pkg' \
  --exclude='.git' \
  --exclude='*.log' \
  services/"${SERVICE_NAME}" package.json package-lock.json

TARBALL_SIZE=$(du -sh "${TARBALL}" | cut -f1)
echo "✅ 源代码包: ${TARBALL_SIZE}"

# 构建镜像
gcloud builds submit "${TARBALL}" \
  --config="services/${SERVICE_NAME}/cloudbuild.yaml" \
  --project="${PROJECT_ID}"

rm -f "${TARBALL}"
```

---

### 3️⃣ Next.js 前端

**适用服务**:
- `apps/frontend` - 前端应用

**优化脚本**: `scripts/build/build-frontend.sh`

```bash
#!/bin/bash
# 前端构建脚本
# 用法: ./build-frontend.sh <environment>

set -e

ENVIRONMENT="${1:-preview}"
PROJECT_ID="gen-lang-client-0944935873"

echo "========================================="
echo "构建前端应用"
echo "环境: ${ENVIRONMENT}"
echo "========================================="

# 前端构建需要保留 node_modules，但排除后端代码
TARBALL="/tmp/frontend-source.tar.gz"

tar -czf "${TARBALL}" \
  --exclude='services' \
  --exclude='pkg' \
  --exclude='makerkit/documentation' \
  --exclude='makerkit/makerkit-emails-starter' \
  --exclude='docs' \
  --exclude='.git' \
  --exclude='*.log' \
  apps/frontend packages turbo.json package.json package-lock.json

TARBALL_SIZE=$(du -sh "${TARBALL}" | cut -f1)
echo "✅ 源代码包: ${TARBALL_SIZE}"

# 使用 Firebase Hosting 部署
cd apps/frontend
npm run build
firebase deploy --only hosting:"${ENVIRONMENT}"

rm -f "${TARBALL}"
```

---

## 📁 目录结构

创建统一的构建脚本目录：

```
autoads/
├── scripts/
│   ├── build/
│   │   ├── build-go-service.sh          # Go服务构建（通用）
│   │   ├── build-node-service.sh        # Node.js服务构建
│   │   ├── build-frontend.sh            # 前端构建
│   │   └── README.md                    # 构建脚本说明
│   └── deploy/
│       └── deploy-all-services.sh       # 批量部署脚本
├── .gcloudignore                        # 默认（前端）
├── .gcloudignore.backend                # 后端Go服务专用
└── services/
    ├── siterank/
    │   ├── Dockerfile
    │   └── cloudbuild.yaml
    ├── billing/
    ├── adscenter/
    └── ...
```

---

## 🔧 每个服务的 cloudbuild.yaml 模板

### Go 服务模板

`services/<service-name>/cloudbuild.yaml`:

```yaml
steps:
  - name: gcr.io/kaniko-project/executor:latest
    args:
      - --dockerfile=services/<service-name>/Dockerfile
      - --destination=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/<service-name>:${_ENVIRONMENT}-latest
      - --context=.
      - --cache=true
      - --cache-ttl=6h

options:
  logging: CLOUD_LOGGING_ONLY
  machineType: 'E2_HIGHCPU_8'

substitutions:
  _ENVIRONMENT: preview

timeout: 1800s
```

### Node.js 服务模板

```yaml
steps:
  # 安装依赖
  - name: 'node:20'
    entrypoint: npm
    args: ['ci']
    dir: 'services/<service-name>'

  # 构建镜像
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - -t
      - asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/<service-name>:${_ENVIRONMENT}-latest
      - -f
      - services/<service-name>/Dockerfile
      - .

  # 推送镜像
  - name: gcr.io/cloud-builders/docker
    args:
      - push
      - asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/<service-name>:${_ENVIRONMENT}-latest

options:
  logging: CLOUD_LOGGING_ONLY
  machineType: 'E2_HIGHCPU_8'

substitutions:
  _ENVIRONMENT: preview

timeout: 1800s
```

---

## 🚀 批量部署脚本

`scripts/deploy/deploy-all-services.sh`:

```bash
#!/bin/bash
# 批量部署所有服务
# 用法: ./deploy-all-services.sh <environment>

set -e

ENVIRONMENT="${1:-preview}"

echo "========================================="
echo "批量部署所有服务到 ${ENVIRONMENT} 环境"
echo "========================================="

# Go 后端服务列表
GO_SERVICES=(
  "siterank"
  "billing"
  "adscenter"
  "recommendations"
  "identity"
  "notifications"
)

# Node.js 服务列表
NODE_SERVICES=(
  "browser-exec"
  "functions"
)

echo ""
echo "Go 服务 (${#GO_SERVICES[@]} 个):"
for service in "${GO_SERVICES[@]}"; do
  echo "  - ${service}"
done

echo ""
echo "Node.js 服务 (${#NODE_SERVICES[@]} 个):"
for service in "${NODE_SERVICES[@]}"; do
  echo "  - ${service}"
done

echo ""
read -p "是否继续部署? (yes/no): " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
  echo "取消部署"
  exit 0
fi

# 部署 Go 服务
echo ""
echo "========================================="
echo "部署 Go 服务..."
echo "========================================="

for service in "${GO_SERVICES[@]}"; do
  echo ""
  echo ">>> 部署 ${service}..."
  ./scripts/build/build-go-service.sh "${service}" "${ENVIRONMENT}" || echo "⚠️ ${service} 部署失败"
done

# 部署 Node.js 服务
echo ""
echo "========================================="
echo "部署 Node.js 服务..."
echo "========================================="

for service in "${NODE_SERVICES[@]}"; do
  echo ""
  echo ">>> 部署 ${service}..."
  ./scripts/build/build-node-service.sh "${service}" "${ENVIRONMENT}" || echo "⚠️ ${service} 部署失败"
done

echo ""
echo "========================================="
echo "✅ 批量部署完成！"
echo "========================================="
```

---

## 📝 使用示例

### 1. 部署单个服务

```bash
# 部署 siterank 到 preview 环境
cd /Users/jason/Documents/Kiro/autoads
./scripts/build/build-go-service.sh siterank preview

# 部署 billing 到 production 环境
./scripts/build/build-go-service.sh billing production

# 部署 browser-exec
./scripts/build/build-node-service.sh browser-exec preview
```

### 2. 批量部署所有服务

```bash
# 部署所有服务到 preview 环境
./scripts/deploy/deploy-all-services.sh preview

# 部署到 production
./scripts/deploy/deploy-all-services.sh production
```

### 3. 只构建不部署（调试用）

```bash
# 只创建 tarball，不构建镜像
SERVICE=siterank
tar -czf /tmp/${SERVICE}-source.tar.gz \
  --exclude='apps' --exclude='makerkit' --exclude='docs' \
  go.work go.work.sum services/${SERVICE} pkg

# 检查 tarball 大小
du -sh /tmp/${SERVICE}-source.tar.gz

# 检查 tarball 内容
tar -tzf /tmp/${SERVICE}-source.tar.gz | head -20
```

---

## 🔍 故障排查

### 问题 1: 上传仍然很慢

**原因**: 本地有大型缓存文件未清理

**解决**:
```bash
# 清理所有构建缓存
find . -name "node_modules" -type d -prune -exec rm -rf {} +
find . -name ".next" -type d -prune -exec rm -rf {} +
find . -name "dist" -type d -prune -exec rm -rf {} +

# 检查目录大小
du -sh . apps/ makerkit/ services/
```

### 问题 2: Dockerfile 找不到文件

**原因**: Dockerfile 中的 COPY 路径假设从根目录开始

**解决**: 确保 Dockerfile 使用正确的相对路径
```dockerfile
# ✅ 正确
COPY go.work ./go.work
COPY services/siterank ./services/siterank
COPY pkg ./pkg

# ❌ 错误（假设当前目录在 services/siterank）
COPY . .
```

### 问题 3: cloudbuild.yaml 执行失败

**检查清单**:
```bash
# 1. 验证 cloudbuild.yaml 语法
cat services/siterank/cloudbuild.yaml

# 2. 检查 Dockerfile 是否存在
ls -la services/siterank/Dockerfile

# 3. 测试本地构建（Docker Desktop）
docker build -f services/siterank/Dockerfile -t test .
```

---

## ⚡ 性能优化技巧

### 1. 使用 Kaniko 缓存

所有 Go 服务的 cloudbuild.yaml 都启用了缓存：
```yaml
- --cache=true
- --cache-ttl=6h
```

这样第二次构建时，Go依赖下载会从缓存读取，节省~2分钟。

### 2. 并行构建多个服务

```bash
# 并行构建 3 个服务
./scripts/build/build-go-service.sh siterank preview &
./scripts/build/build-go-service.sh billing preview &
./scripts/build/build-go-service.sh adscenter preview &
wait

echo "所有服务构建完成"
```

### 3. 使用更快的机器类型

在 `cloudbuild.yaml` 中指定：
```yaml
options:
  machineType: 'E2_HIGHCPU_8'  # 8核CPU，构建速度提升50%
```

---

## 📊 各服务预估构建时间

| 服务 | 源码大小 | 构建时间 | 首次/缓存后 |
|------|----------|----------|-------------|
| siterank | 13 MB | 3m 20s | 3m / 1m 30s |
| billing | ~10 MB | 3m | 3m / 1m 20s |
| adscenter | ~15 MB | 3m 40s | 3m 40s / 1m 40s |
| browser-exec | ~50 MB | 5m | 5m / 2m |
| frontend | ~200 MB | 8m | 8m / 3m |

---

## ✅ 检查清单

部署新服务前，确保：

- [ ] 创建 `services/<service>/Dockerfile`
- [ ] 创建 `services/<service>/cloudbuild.yaml`
- [ ] 测试本地构建: `docker build -f services/<service>/Dockerfile .`
- [ ] 检查tarball大小: `< 50MB`
- [ ] 验证镜像启动: `docker run -p 8080:8080 <image>`
- [ ] 配置环境变量和Secrets
- [ ] 设置健康检查endpoint (`/health` 或 `/healthz`)
- [ ] 添加到批量部署脚本

---

## 🎓 最佳实践总结

1. **服务分类构建** - Go/Node.js/Frontend 使用不同的构建脚本
2. **最小化上传** - 只包含必需文件（10-30MB目标）
3. **启用Kaniko缓存** - 减少重复构建时间
4. **使用高性能机器** - E2_HIGHCPU_8 提升50%速度
5. **自动化脚本** - 统一接口，减少人为错误
6. **并行构建** - 多服务同时构建节省时间
7. **定期清理** - 删除本地 node_modules/.next 缓存

---

**维护者**: DevOps Team
**最后更新**: 2025-10-05
**相关文档**:
- `docs/runbooks/AI_Evaluation_v2.1_Deployment.md`
- `.gcloudignore.backend`
