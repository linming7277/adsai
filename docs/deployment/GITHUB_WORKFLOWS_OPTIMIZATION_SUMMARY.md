# GitHub Workflows 优化总结

## 完成日期
2025-09-30

## 修复的紧急问题

### 🔴 1. deploy-backend.yml - 严重YAML结构错误
**问题**: Jobs 定义混乱，`deploy-services` 和 `db-migrate` 交叉定义
- Line 182-185: `deploy-services` 声明但无 steps
- Line 186-210: `db-migrate` 完整定义
- Line 211-236: `deploy-services` 的实际配置（重复的 if 和 strategy）

**影响**: Workflow 无法正常解析和执行

**修复**:
```yaml
# 正确的顺序
db-migrate:
  name: DB Migrate (Cloud Run Job)
  needs: [meta, changes, tag-images]
  if: ${{ needs.changes.outputs.has_services == 'true' }}
  # ... steps

deploy-services:
  name: Deploy to Cloud Run
  needs: [meta, changes, tag-images, db-migrate]
  if: ${{ needs.changes.outputs.has_services == 'true' }}
  strategy:
    fail-fast: false
    matrix:
      service: ${{ fromJSON(needs.changes.outputs.services) }}
  # ... steps
```

### 🔴 2. console-frontend.yml - Job名称重复
**问题**: `e2e-after-prod-tags` 定义了3次（lines 27, 87, 148）

**影响**: Workflow 解析失败

**修复**: 移除重复的 job 定义，保留唯一的 `e2e-after-prod-tags`

### 🔴 3. sbom-generation.yml - 依赖不存在的Workflow
**问题**: 依赖 "Optimized Docker Build with CI/CD Pipeline" workflow，但该 workflow 不存在

**影响**: SBOM 生成功能完全无法使用

**修复**: 注释掉 `workflow_run` 触发器，改为仅支持手动触发
```yaml
on:
  # 已禁用自动触发，因为依赖的 workflow 不存在
  # workflow_run:
  #   workflows: ["Deploy Backend (Cloud Build → Cloud Run)"]
  #   types: [completed]
  workflow_dispatch:
    # ... inputs
```

### 🔴 4. console-frontend.yml - 错误使用 secrets
**问题**: `${{ secrets.GCP_PROJECT_ID }}` 应该使用 `vars`

**影响**: 配置不一致，Project ID 不是敏感信息

**修复**:
```yaml
- uses: google-github-actions/setup-gcloud@v2
  with:
    project_id: ${{ vars.GCP_PROJECT_ID }}  # 使用 vars 而非 secrets
```

## 之前修复的问题

### ✅ apps/frontend/Dockerfile 不存在
**修复时间**: 2025-09-30 12:10

**问题**: Cloud Build 失败，找不到 Dockerfile
```
unable to prepare context: unable to evaluate symlinks in Dockerfile path:
lstat /workspace/apps/frontend/Dockerfile: no such file or directory
```

**修复**:
1. 创建 `apps/frontend/Dockerfile`（基于 console 的配置）
2. 在 `next.config.mjs` 中添加 `output: 'standalone'` 配置

### ✅ 敏感文件排除优化
**修复时间**: 2025-09-30 12:01

**优化内容**:
- 更新 `.gitignore`: 排除 GCP 凭证、临时文件
- 优化 `.dockerignore`: 重构为清晰的分区结构
- 优化 `.gcloudignore`: 减少 Cloud Build 上传大小
- 从 Git 移除 `gcloud-config/` 目录（包含敏感 ADC 凭证）

## 完整的 Workflows 分析报告

详细的分析报告已生成，包含：

### 发现的所有问题
- 🔴 高优先级（安全/阻塞）: 5个 - **已修复 4个**
- 🟡 中优先级（性能/维护）: 12个
- 🟢 低优先级（优化建议）: 6个

### 核心改进建议

#### A. 可复用组件（待实施）
- GCP 认证 Composite Action
- Node.js + Prisma Setup
- OpenAPI 工具设置
- 可复用的 E2E 测试 Workflow

#### B. 性能优化（待实施）
- 统一 Prisma 生成，使用 artifacts 共享
- 合并重复的 OpenAPI workflows
- 优化缓存策略（npm, Go modules, Docker layers）
- 添加 `timeout-minutes` 避免挂起

#### C. 安全性增强（待实施）
- 为所有 workflows 添加 `permissions` 声明
- 固定 Actions 版本到特定 SHA
- 考虑使用 OIDC 替代长期密钥
- 改进 Docker Bench Security 错误处理

#### D. 可靠性改进（待实施）
- 添加部署验证和健康检查
- 实现渐进式流量切换（Canary 部署）
- 添加统一的失败通知机制
- 改进并发控制

## 优先修复路线图

### ✅ Phase 1: 紧急修复（已完成）
- [x] 修复 deploy-backend.yml 的 YAML 结构错误
- [x] 修复 console-frontend.yml 的重复 job 名称
- [x] 修复 sbom-generation.yml 的 workflow 依赖
- [x] 统一 GCP_PROJECT_ID 使用 vars

### 🔄 Phase 2: 安全增强（1周）
- [ ] 为所有 workflows 添加 `permissions` 声明
- [ ] 统一 Actions 版本并固定到特定版本
- [ ] 改进 security.yml 的错误处理
- [ ] 设置 Dependabot 自动更新

### 📋 Phase 3: 性能优化（1-2周）
- [ ] 创建可复用的 composite actions
- [ ] 优化 Prisma 生成逻辑
- [ ] 统一 OpenAPI workflows
- [ ] 为所有 jobs 设置合理的超时

### 📊 Phase 4: 可观测性增强（1-2周）
- [ ] 添加统一的失败通知机制
- [ ] 改进部署验证和回滚策略
- [ ] 添加 deployment tracking
- [ ] 创建 workflow 执行 dashboard

## 当前状态

### 正在运行的 Workflows
- Deploy Frontend (Firebase Hosting) - in_progress
- OpenAPI CI - in_progress
- Console Frontend CI/CD - in_progress

### 预期结果
修复了关键的 YAML 错误后，所有 workflows 应该能够正常执行。前端部署应该会成功，因为已经：
1. 创建了 `apps/frontend/Dockerfile`
2. 添加了 `output: 'standalone'` 配置
3. 修复了 Cloud Build 配置

## 监控建议

### 关键指标
1. **Workflow 执行时间**
   - Deploy Frontend: 目标 < 10分钟
   - Deploy Backend: 目标 < 15分钟
   - E2E Tests: 目标 < 5分钟

2. **成功率**
   - 目标: >95% 成功率
   - 监控 flaky tests

3. **部署频率**
   - Preview: 每次 push to main
   - Production: tags 和 production branch

### 告警设置
- Workflow 失败连续 2次
- 部署时间超过阈值 1.5倍
- E2E 测试成功率 <90%

## 最佳实践总结

### 1. Workflow 文件组织
```
.github/
├── actions/              # Composite actions
│   ├── gcp-auth/
│   ├── node-prisma-setup/
│   └── openapi-setup/
└── workflows/
    ├── reusable-*.yml   # Reusable workflows
    ├── deploy-*.yml     # 部署 workflows
    ├── test-*.yml       # 测试 workflows
    └── security-*.yml   # 安全扫描 workflows
```

### 2. 标准配置模式
```yaml
# 使用统一的环境变量
env:
  PROJECT_ID: ${{ vars.GCP_PROJECT_ID }}
  REGION: ${{ vars.GCP_REGION }}

# 显式声明权限
permissions:
  contents: read
  packages: write

# 设置超时
jobs:
  job-name:
    timeout-minutes: 30

# 使用严格模式
    run: |
      set -euo pipefail
      # commands
```

### 3. 错误处理
```yaml
- name: Critical operation
  id: critical
  continue-on-error: false
  run: |
    set -euo pipefail
    # commands

- name: Upload artifacts on failure
  if: failure()
  uses: actions/upload-artifact@v4
```

## 参考文档

- [GitHub Actions 最佳实践](https://docs.github.com/en/actions/learn-github-actions/security-hardening-for-github-actions)
- [Composite Actions 文档](https://docs.github.com/en/actions/creating-actions/creating-a-composite-action)
- [Reusable Workflows 文档](https://docs.github.com/en/actions/using-workflows/reusing-workflows)
- [GCP GitHub Actions](https://github.com/google-github-actions)

## 联系人
如有问题，请查看：
- GitHub Actions 运行日志
- Cloud Build 日志
- 本项目的 docs/deployment/ 目录