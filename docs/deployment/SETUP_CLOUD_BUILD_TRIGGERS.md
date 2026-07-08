# Cloud Build 触发器设置指南

## 问题说明

当前 `codex-dev` 服务账号缺少以下权限：
- `cloudbuild.connections.list`
- `cloudbuild.connections.create`
- `cloudbuild.triggers.create`

这些权限需要以下角色之一：
- `roles/cloudbuild.connectionAdmin`
- `roles/cloudbuild.integrations.owner`

## 解决方案

### 方案 1: 授予服务账号权限（推荐）

使用具有 Owner 或 Project IAM Admin 权限的账号执行：

```bash
# 添加 Cloud Build 连接管理员角色
gcloud projects add-iam-policy-binding gen-lang-client-0944935873 \
  --member="serviceAccount:codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.connectionAdmin"

# 然后使用 codex-dev 账号创建触发器
gcloud auth activate-service-account \
  --key-file=/Users/jason/Documents/Kiro/autoads/secrets/gcp_codex_dev.json

cd /Users/jason/Documents/Kiro/autoads
deployments/scripts/setup-frontend-triggers.sh
```

### 方案 2: 通过 GCP Console 手动创建

#### 步骤 1: 连接 GitHub 仓库

1. 访问 Cloud Build 连接页面：
   https://console.cloud.google.com/cloud-build/triggers/connect?project=gen-lang-client-0944935873

2. 选择 "GitHub (Cloud Build GitHub App)"

3. 授权并选择仓库：
   - Organization: xxrenzhe
   - Repository: autoads

4. 完成连接配置

#### 步骤 2: 创建触发器

访问：https://console.cloud.google.com/cloud-build/triggers?project=gen-lang-client-0944935873

**触发器 1: Preview 环境**
- 名称: `frontend-preview`
- 描述: `Deploy frontend to Firebase Hosting (Preview)`
- 区域: `asia-northeast1`
- 事件: 推送到分支
- 源:
  - 代码库: `xxrenzhe/autoads` (1st gen)
  - 分支: `^main$`
- 配置:
  - 类型: Cloud Build 配置文件（yaml 或 json）
  - 位置: 代码库
  - Cloud Build 配置文件位置: `deployments/cloudbuild/frontend-preview.yaml`
- 高级:
  - 包含的文件过滤器（glob）: `apps/frontend/**`

**触发器 2: Production 环境**
- 名称: `frontend-production`
- 描述: `Deploy frontend to Firebase Hosting (Production)`
- 区域: `asia-northeast1`
- 事件: 推送到分支
- 源:
  - 代码库: `xxrenzhe/autoads` (1st gen)
  - 分支: `^production$`
- 配置:
  - 类型: Cloud Build 配置文件（yaml 或 json）
  - 位置: 代码库
  - Cloud Build 配置文件位置: `deployments/cloudbuild/frontend-production.yaml`
- 高级:
  - 包含的文件过滤器（glob）: `apps/frontend/**`

**触发器 3: Production Tag**
- 名称: `frontend-production-tag`
- 描述: `Deploy frontend to Firebase Hosting (Production Tag)`
- 区域: `asia-northeast1`
- 事件: 推送新标记
- 源:
  - 代码库: `xxrenzhe/autoads` (1st gen)
  - 标记: `^v[0-9]+\.[0-9]+\.[0-9]+$`
- 配置:
  - 类型: Cloud Build 配置文件（yaml 或 json）
  - 位置: 代码库
  - Cloud Build 配置文件位置: `deployments/cloudbuild/frontend-production.yaml`

### 方案 3: 使用 REST API 创建

如果服务账号已有权限，可以使用 REST API：

```bash
# 设置变量
PROJECT_ID="gen-lang-client-0944935873"
REGION="asia-northeast1"
ACCESS_TOKEN=$(gcloud auth print-access-token)

# 创建 GitHub 连接（如果不存在）
curl -X POST \
  "https://cloudbuild.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/connections" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "github-connection",
    "githubConfig": {
      "appInstallationId": "YOUR_INSTALLATION_ID",
      "authorizerCredential": {
        "oauthTokenSecretVersion": "projects/PROJECT_NUMBER/secrets/github-token/versions/latest"
      }
    }
  }'

# 创建触发器
curl -X POST \
  "https://cloudbuild.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/triggers" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @deployments/triggers/frontend-preview-trigger.yaml
```

## 验证触发器创建

```bash
# 列出所有触发器
gcloud builds triggers list --region=asia-northeast1 \
  --format="table(name,description,filename,triggerTemplate.branchName,triggerTemplate.tagName)"

# 查看特定触发器详情
gcloud builds triggers describe frontend-preview --region=asia-northeast1
```

## 测试触发器

### 测试 Preview 部署
```bash
cd /Users/jason/Documents/Kiro/autoads
git add .
git commit -m "test: 测试 Preview 自动部署"
git push origin main
```

### 测试 Production 部署
```bash
# 创建 production 分支
git checkout -b production
git push origin production

# 或创建标签
git tag v1.0.0
git push origin v1.0.0
```

## 监控构建

```bash
# 查看最近的构建
gcloud builds list --limit=5 --region=asia-northeast1

# 查看构建日志
gcloud builds log <BUILD_ID> --region=asia-northeast1

# 实时查看构建日志
gcloud builds log <BUILD_ID> --region=asia-northeast1 --stream
```

## 常见问题

### 1. GitHub App 未安装

**错误**: "GitHub App not installed for repository"

**解决**:
1. 访问 https://github.com/apps/google-cloud-build
2. 点击 "Configure"
3. 选择 xxrenzhe organization
4. 授权 autoads 仓库访问权限

### 2. 触发器未触发

**检查清单**:
- ✅ 触发器已启用
- ✅ 分支/标签模式匹配正确
- ✅ 文件过滤器包含变更文件
- ✅ GitHub App 有仓库访问权限
- ✅ Cloud Build API 已启用

### 3. 构建失败

**常见原因**:
- Firebase 镜像不存在：确保 `gcr.io/gen-lang-client-0944935873/firebase` 已构建
- 权限不足：确保 Cloud Build 服务账号有 Firebase Hosting 部署权限
- 配置文件错误：检查 YAML 语法和路径

## 相关链接

- **Cloud Build 触发器**: https://console.cloud.google.com/cloud-build/triggers?project=gen-lang-client-0944935873
- **Cloud Build 历史**: https://console.cloud.google.com/cloud-build/builds?project=gen-lang-client-0944935873
- **GitHub App**: https://github.com/apps/google-cloud-build
- **Cloud Build 文档**: https://cloud.google.com/build/docs/automating-builds/github/build-repos-from-github

## 触发器配置文件位置

已准备好的配置文件：
- `deployments/triggers/frontend-preview-trigger.yaml`
- `deployments/triggers/frontend-production-trigger.yaml`
- `deployments/triggers/frontend-production-tag-trigger.yaml`

Cloud Build 配置文件：
- `deployments/cloudbuild/frontend-preview.yaml`
- `deployments/cloudbuild/frontend-production.yaml`

---

**文档更新日期**: 2025-09-30
**状态**: codex-dev 服务账号权限不足，需要手动配置或授予额外权限