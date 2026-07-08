# Frontend环境配置分离 - 2025-10-15

## 问题背景

之前前端应用的API Gateway配置未区分环境，导致：
- Preview环境的frontend可能调用生产环境的API
- 存在数据污染和调试困难的风险

## 解决方案

实施**环境专用API Gateway配置**，确保preview和production环境完全隔离。

---

## 架构设计

### API Gateway配置

| 环境 | Gateway名称 | Gateway URL | 用途 |
|------|------------|-------------|------|
| **Preview** | adsai-gw-preview | https://adsai-gw-preview-885pd7lz.an.gateway.dev | 预发环境前端调用 |
| **Production** | adsai-gw | https://adsai-gw-885pd7lz.an.gateway.dev | 生产环境前端调用 |

**命名规范**：
- 生产环境：`adsai-gw`（无后缀）
- 预发环境：`adsai-gw-preview`（带`-preview`后缀）

### Secret Manager配置

创建了两个环境专用的secrets：

```bash
# Preview环境
NEXT_PUBLIC_API_BASE_URL_PREVIEW = https://adsai-gw-preview-885pd7lz.an.gateway.dev

# Production环境
NEXT_PUBLIC_API_BASE_URL_PROD = https://adsai-gw-885pd7lz.an.gateway.dev
```

---

## 实现细节

### 1. Cloud Build配置

**文件**: `deployments/cloudbuild/build-frontend-supabase.yaml`

**关键修改**：
```yaml
substitutions:
  _ENVIRONMENT: "preview"  # preview or prod

availableSecrets:
  secretManager:
  # 加载两个环境的secrets
  - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_API_BASE_URL_PREVIEW/versions/latest
    env: 'API_BASE_URL_PREVIEW'
  - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_API_BASE_URL_PROD/versions/latest
    env: 'API_BASE_URL_PROD'

steps:
  - name: 'gcr.io/cloud-builders/docker'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        # 根据环境选择对应的API_BASE_URL
        if [[ "${_ENVIRONMENT}" == "prod" ]]; then
          API_BASE_URL="$$API_BASE_URL_PROD"
        else
          API_BASE_URL="$$API_BASE_URL_PREVIEW"
        fi

        docker build \
          --build-arg NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL" \
          ...
```

### 2. GitHub Actions配置

**文件**: `.github/workflows/deploy-frontend.yml`

**关键修改**：
```yaml
# 传递_ENVIRONMENT参数给Cloud Build
BUILD_NAME=$(gcloud builds submit "$TARBALL" \
  --substitutions _IMAGE="${IMAGE}",_SITE_URL="${SITE_URL}",_ENVIRONMENT="${ENVIRONMENT}" \
  --async --format='value(name)')
```

### 3. 本地开发配置

**文件**: `apps/frontend/.env.local`

```bash
# 本地开发环境配置（默认使用preview环境）
NEXT_PUBLIC_API_BASE_URL=https://adsai-gw-preview-885pd7lz.an.gateway.dev

# Production环境API Gateway (本地开发不推荐使用)
# NEXT_PUBLIC_API_BASE_URL=https://adsai-gw-885pd7lz.an.gateway.dev
```

---

## 部署流程

### GitHub Actions自动化部署

| 分支/Tag | 环境 | Gateway | 服务名 |
|---------|------|---------|--------|
| `main` | preview | adsai-gw-preview | frontend-preview |
| `production` | prod | adsai-gw | frontend |
| `v*.*.*` (tag) | prod | adsai-gw | frontend |

**流程说明**：
1. GitHub Actions根据分支/tag自动判断environment（preview/prod）
2. 传递`_ENVIRONMENT`参数给Cloud Build
3. Cloud Build根据environment选择对应的API_BASE_URL secret
4. 构建frontend镜像并部署到Cloud Run

### 手动构建命令

```bash
# Preview环境
gcloud builds submit /tmp/frontend-source.tar.gz \
  --project=your-gcp-project-id \
  --config=deployments/cloudbuild/build-frontend-supabase.yaml \
  --substitutions _IMAGE="asia-northeast1-docker.pkg.dev/your-gcp-project-id/adsai-services/frontend:preview-latest",_SITE_URL="https://preview.example.com",_ENVIRONMENT="preview"

# Production环境
gcloud builds submit /tmp/frontend-source.tar.gz \
  --project=your-gcp-project-id \
  --config=deployments/cloudbuild/build-frontend-supabase.yaml \
  --substitutions _IMAGE="asia-northeast1-docker.pkg.dev/your-gcp-project-id/adsai-services/frontend:prod-latest",_SITE_URL="https://www.example.com",_ENVIRONMENT="prod"
```

---

## 验证方法

### 1. 验证Gateway配置

```bash
# 列出所有Gateway
gcloud api-gateway gateways list \
  --project=your-gcp-project-id \
  --format="table(name,displayName,defaultHostname,state)"
```

### 2. 验证Secret Manager配置

```bash
# 查看Preview环境secret
gcloud secrets versions access latest \
  --secret=NEXT_PUBLIC_API_BASE_URL_PREVIEW \
  --project=your-gcp-project-id

# 查看Production环境secret
gcloud secrets versions access latest \
  --secret=NEXT_PUBLIC_API_BASE_URL_PROD \
  --project=your-gcp-project-id
```

### 3. 验证前端应用

```bash
# 检查preview环境
curl -s https://preview.example.com | grep -o 'adsai-gw-preview'

# 检查production环境
curl -s https://www.example.com | grep -o 'adsai-gw[^-]'
```

---

## 注意事项

### ⚠️ 重要提醒

1. **本地开发默认使用preview环境**
   - 避免本地调试污染生产数据
   - 如需测试生产环境，手动修改`.env.local`

2. **Gateway命名规范**
   - 生产环境：`adsai-gw`（无后缀）
   - 预发环境：`adsai-gw-preview`（带后缀）
   - ❌ 不要使用`adsai-gw-prod`

3. **Secret Manager更新**
   - 使用`gcloud secrets versions add`而非`create`更新已有secret
   - 旧版本会保留，可随时回滚

4. **环境隔离**
   - Preview frontend → Preview微服务
   - Production frontend → Production微服务
   - 严格禁止跨环境调用

---

## 相关命令

### Secret Manager管理

```bash
# 列出所有API_BASE_URL相关secrets
gcloud secrets list \
  --project=your-gcp-project-id \
  --filter="name:NEXT_PUBLIC_API_BASE_URL"

# 更新Preview环境secret
echo "https://adsai-gw-preview-885pd7lz.an.gateway.dev" | \
  gcloud secrets versions add NEXT_PUBLIC_API_BASE_URL_PREVIEW \
  --project=your-gcp-project-id \
  --data-file=-

# 更新Production环境secret
echo "https://adsai-gw-885pd7lz.an.gateway.dev" | \
  gcloud secrets versions add NEXT_PUBLIC_API_BASE_URL_PROD \
  --project=your-gcp-project-id \
  --data-file=-
```

### Gateway管理

```bash
# 查看Gateway详情
gcloud api-gateway gateways describe adsai-gw-preview \
  --project=your-gcp-project-id \
  --location=asia-northeast1

# 列出Gateway API配置
gcloud api-gateway api-configs list \
  --api=adsai-api-preview \
  --project=your-gcp-project-id
```

---

## 修改记录

| 日期 | 修改内容 | 执行人 |
|------|---------|--------|
| 2025-10-15 | 创建环境专用Gateway配置 | Claude |
| 2025-10-15 | 创建Secret Manager环境专用secrets | Claude |
| 2025-10-15 | 修改Cloud Build和GitHub Actions配置 | Claude |

---

## 架构总结

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend应用                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Preview (preview.example.com)                            │
│    ↓                                                      │
│  NEXT_PUBLIC_API_BASE_URL_PREVIEW                        │
│    ↓                                                      │
│  adsai-gw-preview-885pd7lz.an.gateway.dev              │
│    ↓                                                      │
│  Console-preview, Offer-preview, Billing-preview等        │
│                                                           │
│  ─────────────────────────────────────────────────       │
│                                                           │
│  Production (www.example.com)                            │
│    ↓                                                      │
│  NEXT_PUBLIC_API_BASE_URL_PROD                           │
│    ↓                                                      │
│  adsai-gw-885pd7lz.an.gateway.dev                      │
│    ↓                                                      │
│  Console, Offer, Billing等                                │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**关键收益**：
- ✅ 环境完全隔离，避免数据污染
- ✅ 调试更方便（preview环境独立）
- ✅ 配置清晰，易于维护
- ✅ CI/CD自动化，减少人工错误
