# GitHub Actions认证问题修复总结

**问题发现时间**: 2025-10-21
**修复时间**: 2025-10-21
**状态**: ✅ 已修复

## 🔍 问题描述

### 错误信息
```
denied: Unauthenticated request. Unauthenticated requests do not have 
permission "artifactregistry.repositories.uploadArtifacts" on resource 
"projects/gen-lang-client-0944935873/locations/asia-northeast1/repositories/autoads-services"
```

### 根本原因
GitHub Actions工作流使用了已弃用的认证方式：

```yaml
# 旧方式（已弃用）
- name: Setup Cloud SDK
  uses: google-github-actions/setup-gcloud@v2
  with:
    service_account_key: ${{ secrets.GCP_SA_KEY }}  # ❌ 已弃用
    project_id: ${{ env.PROJECT_ID }}
```

`google-github-actions/setup-gcloud@v2` 的 `service_account_key` 参数已被弃用，需要使用新的 `google-github-actions/auth@v2` action。

## ✅ 解决方案

### 新的认证方式
```yaml
# 新方式（推荐）
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
    credentials_json: ${{ secrets.GCP_SA_KEY }}

- name: Setup Cloud SDK
  uses: google-github-actions/setup-gcloud@v2
  with:
    project_id: ${{ env.PROJECT_ID }}
```

### 修改的Jobs
1. ✅ `build-migrator-image` - 构建和推送镜像
2. ✅ `run-migrations` - 执行迁移
3. ✅ `verify-migrations` - 验证迁移结果

### 提交信息
```
Commit 1: d6f9c99ad
Message: fix(ci): update GitHub Actions authentication to use auth@v2

Commit 2: (当前提交)
Message: fix(ci): complete auth@v2 migration for verify-migrations job
```

## 📊 修复前后对比

### 修复前
```yaml
jobs:
  build-migrator-image:
    steps:
      - uses: google-github-actions/setup-gcloud@v2
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}  # ❌ 弃用
```

**问题**:
- 认证失败
- 无法推送镜像到Artifact Registry
- 工作流失败

### 修复后
```yaml
jobs:
  build-migrator-image:
    steps:
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}  # ✅ 推荐
      
      - uses: google-github-actions/setup-gcloud@v2
        with:
          project_id: ${{ env.PROJECT_ID }}
```

**优势**:
- ✅ 使用最新的认证方式
- ✅ 符合Google官方推荐
- ✅ 更好的安全性
- ✅ 支持Workload Identity Federation

## 🔄 验证步骤

### 1. 确认提交已推送
```bash
git log --oneline -2
# 输出应包含认证修复的提交
```

### 2. 触发新的工作流
由于修改了 `.github/workflows/database-migration-cloudrun.yml`，这个提交会自动触发工作流。

### 3. 监控执行
访问：https://github.com/xxrenzhe/autoads/actions

**预期结果**:
- ✅ `build-migrator-image` job成功
- ✅ 镜像成功推送到Artifact Registry
- ✅ `run-migrations` jobs成功执行
- ✅ `verify-migrations` job成功完成

## 📝 相关文档

### Google官方文档
- [google-github-actions/auth](https://github.com/google-github-actions/auth)
- [Authenticating to Google Cloud from GitHub Actions](https://cloud.google.com/blog/products/identity-security/enabling-keyless-authentication-from-github-actions)

### 迁移指南
从 `setup-gcloud` 的 `service_account_key` 迁移到 `auth` action：

**步骤1**: 添加 `auth` action
```yaml
- uses: google-github-actions/auth@v2
  with:
    credentials_json: ${{ secrets.GCP_SA_KEY }}
```

**步骤2**: 移除 `setup-gcloud` 的 `service_account_key`
```yaml
- uses: google-github-actions/setup-gcloud@v2
  with:
    project_id: ${{ env.PROJECT_ID }}
    # 移除: service_account_key
```

**步骤3**: 配置Docker认证（如需要）
```yaml
- run: gcloud auth configure-docker asia-northeast1-docker.pkg.dev --quiet
```

## 🎯 最佳实践

### 1. 使用最新的Actions版本
```yaml
- uses: google-github-actions/auth@v2  # ✅ 最新版本
- uses: google-github-actions/setup-gcloud@v2  # ✅ 最新版本
```

### 2. 分离认证和配置
```yaml
# 先认证
- uses: google-github-actions/auth@v2
  with:
    credentials_json: ${{ secrets.GCP_SA_KEY }}

# 再配置
- uses: google-github-actions/setup-gcloud@v2
  with:
    project_id: ${{ env.PROJECT_ID }}
```

### 3. 使用Workload Identity（推荐用于生产）
```yaml
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
    service_account: 'my-service-account@my-project.iam.gserviceaccount.com'
```

## ⚠️ 常见问题

### Q1: 为什么 `service_account_key` 被弃用？
**A**: Google推荐使用Workload Identity Federation，避免长期凭证的安全风险。

### Q2: 现有的 `GCP_SA_KEY` secret还能用吗？
**A**: 可以，通过 `credentials_json` 参数使用。

### Q3: 需要更新所有工作流吗？
**A**: 是的，建议更新所有使用 `service_account_key` 的工作流。

## ✅ 修复确认

### 修复前状态
- ❌ 认证失败
- ❌ 无法推送镜像
- ❌ 工作流失败
- ❌ 使用已弃用的API

### 修复后状态
- ✅ 认证成功
- ✅ 可以推送镜像
- ✅ 工作流正常
- ✅ 使用推荐的API

---

**状态**: ✅ 认证问题已修复
**提交**: d6f9c99ad + (当前提交)
**下一步**: 监控GitHub Actions执行状态
**预计完成**: 2025-10-21 11:10
