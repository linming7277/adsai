# 预发环境Firebase问题分析报告

## 问题描述

访问预发环境 https://www.urlchecker.dev/en/auth/sign-in 时，发现仍在使用Firebase认证流程，而非预期的Supabase认证。

## 根本原因分析

### 1. 部署的是错误的前端应用

**当前部署情况**:
```yaml
# .github/workflows/deploy-frontend.yml
# GitHub Actions 打包的是 apps/frontend
tar -czf "$TARBALL" \
  package.json package-lock.json apps/frontend packages
```

**问题**:
- ✅ 打包的是 `apps/frontend` (Supabase版本)
- ❌ 但Dockerfile和Cloud Build配置仍在使用Firebase环境变量

### 2. Cloud Build配置使用Firebase密钥

**当前配置** (`deployments/cloudbuild/build-frontend-docker.yaml`):

```yaml
availableSecrets:
  secretManager:
  - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_FIREBASE_API_KEY/versions/latest
    env: 'FIREBASE_API_KEY'
  - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_FIREBASE_APP_ID/versions/latest
    env: 'FIREBASE_APP_ID'
  - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN/versions/latest
    env: 'FIREBASE_AUTH_DOMAIN'
  - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_FIREBASE_PROJECT_ID/versions/latest
    env: 'FIREBASE_PROJECT_ID'
  - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET/versions/latest
    env: 'FIREBASE_STORAGE_BUCKET'
  # ❌ 缺少 Supabase 相关密钥
```

**问题**:
- 配置中只有Firebase密钥
- 没有Supabase URL和Anon Key
- 构建时传递的是Firebase环境变量

### 3. Dockerfile接收Firebase环境变量

**当前Dockerfile** (`apps/frontend/Dockerfile`):

```dockerfile
ARG NEXT_PUBLIC_FIREBASE_API_KEY=""
ARG NEXT_PUBLIC_FIREBASE_APP_ID=""
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=""
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=""
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=""
# ❌ 缺少 Supabase 环境变量定义

ENV NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}
ENV NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}
# ... 其他Firebase环境变量
# ❌ 没有设置 Supabase 环境变量
```

### 4. 代码库中存在两个前端应用

```
apps/
├── frontend/              # ✅ Supabase版本（新）
│   ├── src/
│   │   ├── core/supabase/
│   │   └── app/auth/
│   └── package.json       # 依赖 @supabase/ssr
│
└── frontend-legacy/       # ❌ Firebase版本（旧）
    ├── src/
    │   ├── core/firebase/
    │   └── pages/auth/
    └── package.json       # 依赖 firebase
```

**混淆点**:
- 代码审查时看的是 `apps/frontend` (Supabase版本)
- 但部署配置仍在使用Firebase密钥
- 导致即使部署了Supabase版本的代码，也无法正常工作

## 问题影响

### 当前状态

| 组件 | 预期 | 实际 | 状态 |
|------|------|------|------|
| 前端代码 | Supabase | Supabase | ✅ 正确 |
| 环境变量 | Supabase | Firebase | ❌ 错误 |
| 认证流程 | Supabase | Firebase/失败 | ❌ 错误 |
| 用户体验 | 正常登录 | 无法登录 | ❌ 错误 |

### 用户影响

1. **无法登录**: 前端代码尝试使用Supabase，但环境变量是Firebase的
2. **错误提示**: 可能显示"Supabase URL was not provided"
3. **功能不可用**: 所有需要认证的功能都无法使用

## 解决方案

### 方案1: 更新Cloud Build配置使用Supabase（推荐）

#### 步骤1: 在Secret Manager中添加Supabase密钥

```bash
# 添加Supabase URL
echo -n "https://jzzvizacfyipzdyiqfzb.supabase.co" | \
  gcloud secrets create NEXT_PUBLIC_SUPABASE_URL \
  --data-file=- \
  --project=gen-lang-client-0944935873

# 添加Supabase Anon Key
echo -n "YOUR_SUPABASE_ANON_KEY" | \
  gcloud secrets create NEXT_PUBLIC_SUPABASE_ANON_KEY \
  --data-file=- \
  --project=gen-lang-client-0944935873

# 添加Supabase Service Key（可选，用于服务端）
echo -n "YOUR_SUPABASE_SERVICE_KEY" | \
  gcloud secrets create SUPABASE_SERVICE_KEY \
  --data-file=- \
  --project=gen-lang-client-0944935873

# 授权服务账号访问
gcloud secrets add-iam-policy-binding NEXT_PUBLIC_SUPABASE_URL \
  --member="serviceAccount:codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=gen-lang-client-0944935873

gcloud secrets add-iam-policy-binding NEXT_PUBLIC_SUPABASE_ANON_KEY \
  --member="serviceAccount:codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=gen-lang-client-0944935873.iam.gserviceaccount.com
```

#### 步骤2: 更新Cloud Build配置

创建新文件：`deployments/cloudbuild/build-frontend-supabase.yaml`

```yaml
timeout: "3600s"
serviceAccount: 'projects/gen-lang-client-0944935873/serviceAccounts/codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com'
options:
  logging: GCS_ONLY
  machineType: 'E2_HIGHCPU_8'
logsBucket: gs://autoads-build-logs-asia-northeast1/logs
substitutions:
  _IMAGE: "asia-northeast1-docker.pkg.dev/PROJECT/REPO/frontend:dev"
  _SITE_URL: "https://www.urlchecker.dev"
availableSecrets:
  secretManager:
  # Supabase配置
  - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_SUPABASE_URL/versions/latest
    env: 'SUPABASE_URL'
  - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_SUPABASE_ANON_KEY/versions/latest
    env: 'SUPABASE_ANON_KEY'
  - versionName: projects/$PROJECT_ID/secrets/SUPABASE_SERVICE_KEY/versions/latest
    env: 'SUPABASE_SERVICE_KEY'
  # Stripe配置
  - versionName: projects/$PROJECT_ID/secrets/STRIPE_PUBLISHABLE_KEY/versions/latest
    env: 'STRIPE_PUBLISHABLE_KEY'
  # API配置
  - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_API_BASE_URL/versions/latest
    env: 'API_BASE_URL'
steps:
  - name: 'gcr.io/cloud-builders/docker'
    id: Build frontend image
    secretEnv: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY', 'STRIPE_PUBLISHABLE_KEY', 'API_BASE_URL']
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        docker build \
          -f apps/frontend/Dockerfile \
          -t ${_IMAGE} \
          --build-arg NEXT_PUBLIC_SUPABASE_URL="$$SUPABASE_URL" \
          --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$$SUPABASE_ANON_KEY" \
          --build-arg SUPABASE_SERVICE_KEY="$$SUPABASE_SERVICE_KEY" \
          --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="$$STRIPE_PUBLISHABLE_KEY" \
          --build-arg NEXT_PUBLIC_API_BASE_URL="$$API_BASE_URL" \
          --build-arg NEXT_PUBLIC_SITE_URL="${_SITE_URL}" \
          .
images:
  - '${_IMAGE}'
```

#### 步骤3: 更新Dockerfile

修改 `apps/frontend/Dockerfile`:

```dockerfile
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Install workspace dependencies
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages ./packages

RUN npm install --no-audit --no-fund

FROM deps AS builder
WORKDIR /app

# ✅ Supabase环境变量
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=""
ARG SUPABASE_SERVICE_KEY=""

# Stripe和其他配置
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
ARG NEXT_PUBLIC_API_BASE_URL=""
ARG NEXT_PUBLIC_SITE_URL=""

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY} \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

COPY apps/frontend ./apps/frontend

RUN npm run --workspace apps/frontend build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080

COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./.next/static
COPY --from=builder /app/apps/frontend/public ./public

EXPOSE 8080

CMD ["node", "server.js"]
```

#### 步骤4: 更新GitHub Actions

修改 `.github/workflows/deploy-frontend.yml`:

```yaml
- name: Cloud Build submit
  id: cb
  shell: bash
  run: |
    set -euo pipefail
    AR_HOST="${ARTIFACT_LOCATION:-asia-northeast1}-docker.pkg.dev"
    IMAGE="${AR_HOST}/${PROJECT_ID}/${ARTIFACT_REPO}/frontend:${{ needs.meta.outputs.primary_tag }}"
    TARBALL="${{ env.tarball_path }}"

    echo "Submitting Cloud Build for ${IMAGE}"
    # ✅ 使用新的Supabase配置文件
    CONFIG_PATH="$GITHUB_WORKSPACE/deployments/cloudbuild/build-frontend-supabase.yaml"
    
    # ... 其余代码保持不变
```

### 方案2: 临时回退到frontend-legacy（不推荐）

如果需要快速恢复服务，可以临时回退到Firebase版本：

```yaml
# 修改 .github/workflows/deploy-frontend.yml
tar -czf "$TARBALL" \
  package.json package-lock.json apps/frontend-legacy packages
```

```yaml
# 修改 Cloud Build 配置
docker build \
  -f apps/frontend-legacy/Dockerfile \
  # ...
```

**缺点**:
- 无法使用Supabase功能
- 与架构设计不符
- 需要再次迁移

## 验证步骤

### 1. 验证Secret Manager配置

```bash
# 列出所有secrets
gcloud secrets list --project=gen-lang-client-0944935873

# 验证Supabase secrets存在
gcloud secrets describe NEXT_PUBLIC_SUPABASE_URL --project=gen-lang-client-0944935873
gcloud secrets describe NEXT_PUBLIC_SUPABASE_ANON_KEY --project=gen-lang-client-0944935873

# 查看secret值（仅用于验证，不要在生产环境执行）
gcloud secrets versions access latest --secret=NEXT_PUBLIC_SUPABASE_URL --project=gen-lang-client-0944935873
```

### 2. 本地测试构建

```bash
# 设置环境变量
export NEXT_PUBLIC_SUPABASE_URL="https://jzzvizacfyipzdyiqfzb.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
export NEXT_PUBLIC_SITE_URL="https://www.urlchecker.dev"

# 构建Docker镜像
docker build \
  -f apps/frontend/Dockerfile \
  -t frontend-test \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --build-arg NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" \
  .

# 运行容器
docker run -p 8080:8080 frontend-test

# 访问 http://localhost:8080/auth/sign-in 验证
```

### 3. 部署后验证

```bash
# 检查Cloud Run环境变量
gcloud run services describe frontend-preview \
  --region=asia-northeast1 \
  --format='value(spec.template.spec.containers[0].env)' \
  --project=gen-lang-client-0944935873

# 访问预发环境
curl -I https://www.urlchecker.dev

# 检查页面源代码中的环境变量
curl https://www.urlchecker.dev | grep -i "supabase\|firebase"
```


## 实施计划

### 阶段1: 准备工作（30分钟）

#### 任务1: 获取Supabase密钥

```bash
# 从 secrets/supabase-credentials.json 获取
cat secrets/supabase-credentials.json

# 或从Supabase Dashboard获取
# 访问: https://supabase.com/dashboard/project/jzzvizacfyipzdyiqfzb/settings/api
```

需要的密钥：
- `NEXT_PUBLIC_SUPABASE_URL`: https://jzzvizacfyipzdyiqfzb.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
- `SUPABASE_SERVICE_KEY`: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (service_role key)

#### 任务2: 添加到Secret Manager

```bash
#!/bin/bash
set -euo pipefail

PROJECT_ID="gen-lang-client-0944935873"
SERVICE_ACCOUNT="codex-dev@${PROJECT_ID}.iam.gserviceaccount.com"

# 读取Supabase配置
SUPABASE_URL="https://jzzvizacfyipzdyiqfzb.supabase.co"
SUPABASE_ANON_KEY="<从secrets文件获取>"
SUPABASE_SERVICE_KEY="<从secrets文件获取>"

# 创建secrets
echo -n "$SUPABASE_URL" | gcloud secrets create NEXT_PUBLIC_SUPABASE_URL \
  --data-file=- \
  --project="$PROJECT_ID" \
  --replication-policy="automatic"

echo -n "$SUPABASE_ANON_KEY" | gcloud secrets create NEXT_PUBLIC_SUPABASE_ANON_KEY \
  --data-file=- \
  --project="$PROJECT_ID" \
  --replication-policy="automatic"

echo -n "$SUPABASE_SERVICE_KEY" | gcloud secrets create SUPABASE_SERVICE_KEY \
  --data-file=- \
  --project="$PROJECT_ID" \
  --replication-policy="automatic"

# 授权服务账号访问
for SECRET in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_KEY; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT_ID"
done

echo "✅ Secrets created and authorized"
```

### 阶段2: 更新配置文件（1小时）

#### 任务1: 创建新的Cloud Build配置

```bash
# 创建文件
cat > deployments/cloudbuild/build-frontend-supabase.yaml << 'EOF'
# ... (使用上面提供的完整配置)
EOF

# 提交到Git
git add deployments/cloudbuild/build-frontend-supabase.yaml
git commit -m "feat: add Supabase Cloud Build configuration for frontend"
```

#### 任务2: 更新Dockerfile

```bash
# 备份原文件
cp apps/frontend/Dockerfile apps/frontend/Dockerfile.backup

# 更新Dockerfile（使用上面提供的配置）
# 编辑 apps/frontend/Dockerfile

# 提交到Git
git add apps/frontend/Dockerfile
git commit -m "feat: update frontend Dockerfile to use Supabase env vars"
```

#### 任务3: 更新GitHub Actions

```bash
# 编辑 .github/workflows/deploy-frontend.yml
# 修改 CONFIG_PATH 指向新的配置文件

git add .github/workflows/deploy-frontend.yml
git commit -m "feat: update frontend deployment to use Supabase configuration"
```

### 阶段3: 测试和部署（1小时）

#### 任务1: 本地测试

```bash
# 1. 设置环境变量
export NEXT_PUBLIC_SUPABASE_URL="https://jzzvizacfyipzdyiqfzb.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="<your-anon-key>"

# 2. 本地构建
cd apps/frontend
npm install
npm run build

# 3. 验证构建产物
ls -la .next/

# 4. 本地运行
npm run start

# 5. 测试登录页面
open http://localhost:3000/auth/sign-in
```

#### 任务2: 部署到预发环境

```bash
# 1. 推送代码到main分支
git push origin main

# 2. 监控GitHub Actions
# 访问: https://github.com/xxrenzhe/autoads/actions

# 3. 等待部署完成（约10-15分钟）

# 4. 验证部署
curl -I https://www.urlchecker.dev
```

#### 任务3: 功能验证

```bash
# 验证清单
- [ ] 访问 https://www.urlchecker.dev/auth/sign-in
- [ ] 检查页面是否正常加载
- [ ] 点击"Google登录"按钮
- [ ] 验证重定向到Google OAuth页面
- [ ] 完成授权后验证回调处理
- [ ] 检查浏览器控制台无错误
- [ ] 验证可以正常访问Dashboard
```

### 阶段4: 监控和回滚准备（持续）

#### 监控指标

```bash
# 1. 查看Cloud Run日志
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=frontend-preview" \
  --limit=50 \
  --format=json \
  --project=gen-lang-client-0944935873

# 2. 查看错误日志
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=frontend-preview AND severity>=ERROR" \
  --limit=20 \
  --format=json \
  --project=gen-lang-client-0944935873

# 3. 监控请求成功率
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count"' \
  --project=gen-lang-client-0944935873
```

#### 回滚步骤

如果部署后发现问题：

```bash
# 方案A: 回滚到上一个版本
gcloud run services update-traffic frontend-preview \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873

# 方案B: 回滚代码
git revert HEAD
git push origin main

# 方案C: 临时禁用新配置
# 修改 .github/workflows/deploy-frontend.yml
# 改回使用旧的 build-frontend-docker.yaml
```

## 时间表

| 阶段 | 任务 | 预计时间 | 负责人 |
|------|------|----------|--------|
| 阶段1 | 获取Supabase密钥 | 10分钟 | DevOps |
| 阶段1 | 添加到Secret Manager | 20分钟 | DevOps |
| 阶段2 | 创建Cloud Build配置 | 20分钟 | Backend |
| 阶段2 | 更新Dockerfile | 20分钟 | Backend |
| 阶段2 | 更新GitHub Actions | 20分钟 | DevOps |
| 阶段3 | 本地测试 | 30分钟 | Frontend |
| 阶段3 | 部署到预发环境 | 15分钟 | DevOps |
| 阶段3 | 功能验证 | 15分钟 | QA |
| 阶段4 | 监控 | 持续 | DevOps |

**总预计时间**: 2.5小时

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Secret Manager权限不足 | 低 | 中 | 提前验证服务账号权限 |
| 环境变量配置错误 | 中 | 高 | 本地测试验证 |
| Supabase配置不正确 | 低 | 高 | 使用测试账号验证 |
| 部署失败 | 低 | 中 | 准备回滚方案 |
| 用户无法登录 | 中 | 高 | 快速回滚 + 监控告警 |

## 成功标准

### 功能验收

- [ ] 预发环境使用Supabase认证
- [ ] Google OAuth登录正常工作
- [ ] 用户可以完成注册和登录
- [ ] Dashboard正常访问
- [ ] 无Firebase相关错误

### 技术验收

- [ ] Cloud Build成功构建镜像
- [ ] Dockerfile使用Supabase环境变量
- [ ] Secret Manager配置正确
- [ ] Cloud Run服务正常运行
- [ ] 日志无错误

### 性能验收

- [ ] 页面加载时间 <3秒
- [ ] 登录流程完成时间 <5秒
- [ ] Cloud Run冷启动时间 <10秒

## 后续优化

完成基本迁移后，可以考虑以下优化：

1. **移除Firebase依赖**
   - 删除 `apps/frontend-legacy` 目录
   - 清理Firebase相关的Secret Manager密钥
   - 更新文档

2. **实施一键登录优化**
   - 参考 [一键Google登录优化方案.md](./一键Google登录优化方案.md)
   - 添加Database Trigger
   - 优化用户体验

3. **完善监控**
   - 添加Supabase Auth监控
   - 配置告警规则
   - 创建Dashboard

4. **文档更新**
   - 更新部署文档
   - 更新开发者指南
   - 更新故障排查文档

## 相关文档

- [用户登录流程分析报告](./用户登录流程分析报告.md)
- [一键Google登录优化方案](./一键Google登录优化方案.md)
- [架构设计文档](./MustKnowV6.md)

---

**文档版本**: v1.0  
**创建日期**: 2025-10-09  
**最后更新**: 2025-10-09  
**作者**: Kiro AI Assistant  
**状态**: ⏳ 待实施
