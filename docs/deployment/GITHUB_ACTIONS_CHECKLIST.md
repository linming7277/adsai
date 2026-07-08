# GitHub Actions 部署配置检查清单

## 必需的 GitHub Secrets

在 GitHub 仓库设置中配置以下 Secrets：
https://github.com/xxrenzhe/autoads/settings/secrets/actions

### 1. GCP_SA_KEY
**用途**: GCP 服务账号密钥，用于认证 Cloud Build、Artifact Registry、Cloud Run 等服务

**获取方式**:
```bash
# 方法 1: 使用现有的 codex-dev 服务账号
cat /Users/jason/Documents/Kiro/autoads/secrets/gcp_codex_dev.json

# 方法 2: 创建新的服务账号（推荐用于 CI/CD）
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions CI/CD" \
  --project=gen-lang-client-0944935873

# 授予必要权限
gcloud projects add-iam-policy-binding gen-lang-client-0944935873 \
  --member="serviceAccount:github-actions@gen-lang-client-0944935873.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding gen-lang-client-0944935873 \
  --member="serviceAccount:github-actions@gen-lang-client-0944935873.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding gen-lang-client-0944935873 \
  --member="serviceAccount:github-actions@gen-lang-client-0944935873.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# 创建密钥
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@gen-lang-client-0944935873.iam.gserviceaccount.com

# 复制密钥内容到 GitHub Secrets
cat github-actions-key.json
```

**当前可用**: ✅ 可以使用 `secrets/gcp_codex_dev.json`

### 2. FIREBASE_SERVICE_ACCOUNT
**用途**: Firebase Hosting 部署认证

**获取方式**:
```bash
# 使用现有的 Firebase Admin SDK 服务账号
cat /Users/jason/Documents/Kiro/autoads/secrets/firebase-adminsdk.json
```

**当前可用**: ✅ 可以使用 `secrets/firebase-adminsdk.json`

### 3. GITHUB_TOKEN
**用途**: GitHub API 访问（自动提供，无需配置）

**状态**: ✅ GitHub 自动提供

## 必需的 GitHub Variables

在 GitHub 仓库设置中配置以下 Variables：
https://github.com/xxrenzhe/autoads/settings/variables/actions

### 1. GCP_PROJECT_ID
**值**: `gen-lang-client-0944935873`
**用途**: GCP 项目 ID

### 2. GCP_REGION
**值**: `asia-northeast1`
**用途**: GCP 区域

### 3. ARTIFACT_REPO (可选)
**值**: `autoads-services`（默认值）
**用途**: Artifact Registry 仓库名称

## 配置验证脚本

```bash
#!/bin/bash
# 验证 GitHub Actions 所需的 GCP 资源

PROJECT_ID="gen-lang-client-0944935873"
REGION="asia-northeast1"
ARTIFACT_REPO="autoads-services"

echo "=== 验证 GCP 资源 ==="
echo

# 1. 检查 Artifact Registry 仓库
echo "1. 检查 Artifact Registry 仓库..."
gcloud artifacts repositories describe "$ARTIFACT_REPO" \
  --location="$REGION" \
  --project="$PROJECT_ID" \
  --format="value(name)" 2>/dev/null && echo "✅ 存在" || echo "❌ 不存在 - 需要创建"

# 2. 检查 Cloud Run 服务
echo
echo "2. 检查 Cloud Run 服务..."
gcloud run services describe frontend \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format="value(status.url)" 2>/dev/null && echo "✅ 存在" || echo "⚠️  不存在 - 首次部署将创建"

# 3. 检查 Firebase Hosting 目标
echo
echo "3. 检查 Firebase Hosting..."
cd apps/frontend
firebase target:list --project="$PROJECT_ID" 2>/dev/null && echo "✅ 已配置" || echo "⚠️  需要配置 Hosting targets"

# 4. 检查 Cloud Build 日志桶
echo
echo "4. 检查 Cloud Build 日志桶..."
gsutil ls "gs://autoads-build-logs-$REGION" 2>/dev/null && echo "✅ 存在" || echo "⚠️  不存在 - 将使用默认日志"

# 5. 验证服务账号权限
echo
echo "5. 验证服务账号权限..."
echo "检查 codex-dev 服务账号的角色..."
gcloud projects get-iam-policy "$PROJECT_ID" \
  --flatten="bindings[].members" \
  --filter="bindings.members:codex-dev@$PROJECT_ID.iam.gserviceaccount.com AND bindings.role~(cloudbuild|artifactregistry|run)" \
  --format="table(bindings.role)" 2>/dev/null

echo
echo "=== 验证完成 ==="
```

## Firebase Hosting 配置

### 配置 Hosting Targets

```bash
cd apps/frontend

# 配置 Preview 目标
firebase target:apply hosting autoads-preview autoads-preview \
  --project=gen-lang-client-0944935873

# 配置 Production 目标
firebase target:apply hosting autoads-prod autoads-prod \
  --project=gen-lang-client-0944935873

# 验证配置
firebase target:list --project=gen-lang-client-0944935873
```

### 更新 firebase.json

确保 `apps/frontend/firebase.json` 包含 Hosting targets 配置：

```json
{
  "hosting": [
    {
      "target": "autoads-preview",
      "public": ".next",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ]
    },
    {
      "target": "autoads-prod",
      "public": ".next",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ]
    }
  ]
}
```

## Artifact Registry 创建

如果 Artifact Registry 仓库不存在，创建它：

```bash
gcloud artifacts repositories create autoads-services \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="AutoAds services Docker images" \
  --project=gen-lang-client-0944935873
```

## 部署工作流验证

### 手动触发测试

```bash
# 方法 1: 推送到 main 分支（Preview 部署）
git checkout main
git push origin main

# 方法 2: 手动触发工作流
# 访问: https://github.com/xxrenzhe/autoads/actions/workflows/deploy-frontend.yml
# 点击 "Run workflow"

# 方法 3: 推送到 production 分支（Production 部署）
git checkout -b production
git push origin production

# 方法 4: 创建版本标签（Production 部署）
git tag v1.0.0
git push origin v1.0.0
```

### 查看部署状态

1. **GitHub Actions 日志**:
   https://github.com/xxrenzhe/autoads/actions

2. **Cloud Build 日志**:
   https://console.cloud.google.com/cloud-build/builds?project=gen-lang-client-0944935873

3. **Cloud Run 服务**:
   https://console.cloud.google.com/run?project=gen-lang-client-0944935873

4. **Firebase Hosting**:
   https://console.firebase.google.com/project/gen-lang-client-0944935873/hosting/sites

## 常见问题排查

### 1. "Permission denied" 错误

**原因**: 服务账号权限不足

**解决**:
```bash
# 检查当前权限
gcloud projects get-iam-policy gen-lang-client-0944935873 \
  --flatten="bindings[].members" \
  --filter="bindings.members:YOUR_SA@gen-lang-client-0944935873.iam.gserviceaccount.com" \
  --format="table(bindings.role)"

# 添加缺失权限
gcloud projects add-iam-policy-binding gen-lang-client-0944935873 \
  --member="serviceAccount:YOUR_SA@gen-lang-client-0944935873.iam.gserviceaccount.com" \
  --role="roles/REQUIRED_ROLE"
```

### 2. "Repository not found" 错误

**原因**: Artifact Registry 仓库不存在

**解决**:
```bash
# 创建仓库
gcloud artifacts repositories create autoads-services \
  --repository-format=docker \
  --location=asia-northeast1 \
  --project=gen-lang-client-0944935873
```

### 3. Firebase Hosting 部署失败

**原因**: Hosting target 未配置

**解决**:
```bash
cd apps/frontend
firebase target:apply hosting autoads-preview autoads-preview
firebase target:apply hosting autoads-prod autoads-prod
```

### 4. Cloud Build 超时

**原因**: 构建时间超过默认超时（10 分钟）

**解决**:
在 `deployments/cloudbuild/build-frontend-docker.yaml` 中增加超时：
```yaml
timeout: '1800s'  # 30 minutes
```

## 部署检查清单

### 部署前检查
- [ ] GitHub Secrets 已配置（GCP_SA_KEY, FIREBASE_SERVICE_ACCOUNT）
- [ ] GitHub Variables 已配置（GCP_PROJECT_ID, GCP_REGION）
- [ ] Artifact Registry 仓库已创建
- [ ] Firebase Hosting targets 已配置
- [ ] 环境变量文件已更新（.env.preview, .env.production）
- [ ] Stripe 配置已完成

### 部署后验证
- [ ] GitHub Actions 工作流成功完成
- [ ] Cloud Build 构建成功
- [ ] Docker 镜像推送到 Artifact Registry
- [ ] Cloud Run 服务部署成功
- [ ] Firebase Hosting 部署成功
- [ ] Preview 环境可访问（www.urlchecker.dev）
- [ ] Production 环境可访问（www.autoads.dev）

## 相关链接

- **GitHub Actions 工作流**: https://github.com/xxrenzhe/autoads/actions
- **GCP Console**: https://console.cloud.google.com/?project=gen-lang-client-0944935873
- **Firebase Console**: https://console.firebase.google.com/project/gen-lang-client-0944935873
- **部署文档**: docs/deployment/DEPLOYMENT_CONFIGURATION_COMPLETE.md
- **架构对比**: docs/deployment/GITHUB_ACTIONS_VS_CLOUD_BUILD.md

---

**文档更新日期**: 2025-09-30
**状态**: 准备就绪，等待配置 GitHub Secrets/Variables