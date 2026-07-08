# 数据库迁移工作流修正方案

**发现日期**: 2025-10-21
**问题**: 当前触发的是错误的迁移工作流
**影响**: 未按照架构要求使用Cloud Run Job执行迁移

---

## 🔍 问题分析

### 当前状态

#### 存在的工作流文件

1. **database-migration.yml** ❌ 错误的实现
   - 触发方式: Push到main分支（已触发）
   - 执行方式: GitHub Actions Runner + Cloud SQL Proxy
   - 问题: 
     - 不符合架构要求
     - GitHub Actions无法访问内网Cloud SQL
     - 使用TCP连接而非Unix Socket

2. **database-migration-cloudrun.yml** ✅ 正确的实现
   - 触发方式: 仅workflow_dispatch（手动触发）
   - 执行方式: Cloud Run Job + Cloud SQL Proxy
   - 优势:
     - 符合架构要求
     - Cloud Run Job可以访问内网Cloud SQL
     - 使用Unix Socket连接
     - 完整的Cloud SQL Proxy集成

### 架构要求（来自DATABASE_MIGRATION_BEST_PRACTICES.md）

```yaml
正确的迁移架构:
  GitHub Actions → Cloud Build构建镜像 → Cloud Run Job部署 → golang-migrate执行

关键约束:
  - Cloud SQL数据库只有内网IP
  - 必须在Cloud Run容器内执行迁移
  - 使用Unix Socket连接: /cloudsql/PROJECT:REGION:INSTANCE
  - 通过Cloud SQL Proxy自动挂载
```

### Ground Truth验证

#### Cloud SQL实例配置
```bash
# 验证结果
实例名称: autoads
IP配置: 35.243.74.175 (公网IP)
内网访问: 需要Cloud SQL Proxy或VPC
```

**重要发现**: Cloud SQL实例有公网IP，所以GitHub Actions Runner方式理论上可以工作，但不符合最佳实践和架构设计要求。

---

## ✅ 修正方案

### 方案1: 禁用错误的工作流，使用正确的工作流（推荐）

#### 步骤1: 修改database-migration.yml
```yaml
# 移除push触发器，只保留workflow_dispatch
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment (DEPRECATED - Use database-migration-cloudrun.yml)'
        required: true
        type: choice
        options:
          - preview
          - production
        default: 'preview'
  # 移除push触发器
  # push:
  #   branches:
  #     - main
  #   paths:
  #     - 'services/*/migrations/**'
```

#### 步骤2: 更新database-migration-cloudrun.yml
```yaml
# 添加push触发器
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - preview
          - production
        default: 'preview'
  push:
    branches:
      - main
    paths:
      - 'services/*/migrations/**'
      - '.github/workflows/database-migration-cloudrun.yml'
      - 'deployments/db-migrator/**'
```

### 方案2: 完全替换工作流文件

#### 步骤1: 重命名文件
```bash
# 备份旧文件
mv .github/workflows/database-migration.yml .github/workflows/database-migration.yml.deprecated

# 使用正确的工作流
mv .github/workflows/database-migration-cloudrun.yml .github/workflows/database-migration.yml
```

---

## 🚀 立即执行的修正步骤

### 1. 停止当前错误的迁移（如果正在运行）

```bash
# 访问GitHub Actions页面
https://github.com/xxrenzhe/autoads/actions

# 找到正在运行的"Database Migration"工作流
# 点击"Cancel workflow"
```

### 2. 修改工作流配置

我将执行方案1，修改两个工作流文件：

#### 修改database-migration.yml
- 移除push触发器
- 添加弃用警告
- 保留workflow_dispatch用于紧急情况

#### 修改database-migration-cloudrun.yml
- 添加push触发器
- 设为默认迁移工作流
- 确保完整的Cloud Run Job配置

### 3. 手动触发正确的迁移

```bash
# 方式1: 通过GitHub UI
1. 访问: https://github.com/xxrenzhe/autoads/actions
2. 选择: "Database Migration (Cloud Run Job)"
3. 点击: "Run workflow"
4. 选择: environment = preview
5. 点击: "Run workflow"

# 方式2: 通过GitHub CLI
gh workflow run database-migration-cloudrun.yml \
  -f environment=preview
```

---

## 📊 两种方案对比

### GitHub Actions Runner + Cloud SQL Proxy（当前错误方式）

```yaml
优点:
  - 简单直接
  - 无需构建Docker镜像
  - 执行速度快

缺点:
  - ❌ 不符合架构设计
  - ❌ 依赖公网IP（安全风险）
  - ❌ 使用TCP连接而非Unix Socket
  - ❌ 无法利用Cloud Run的IAM认证
  - ❌ 不符合最佳实践
```

### Cloud Run Job + Cloud SQL Proxy（正确方式）

```yaml
优点:
  - ✅ 符合架构设计
  - ✅ 使用Unix Socket连接
  - ✅ 完整的IAM认证
  - ✅ 可以访问内网Cloud SQL
  - ✅ 符合最佳实践
  - ✅ 更好的安全性

缺点:
  - 需要构建Docker镜像（增加2-3分钟）
  - 稍微复杂一些
```

**结论**: 虽然当前方式可能可以工作（因为有公网IP），但必须使用Cloud Run Job方式以符合架构要求和最佳实践。

---

## 🔧 技术细节

### Cloud SQL Proxy在两种方式中的区别

#### GitHub Actions Runner方式
```bash
# 在GitHub Actions Runner上运行
./cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:5432 &

# 连接字符串
postgresql://user:pass@localhost:5432/dbname

# 问题:
- 使用TCP连接
- 需要公网IP或VPC
- 无法使用Unix Socket
```

#### Cloud Run Job方式
```bash
# Cloud Run自动挂载Cloud SQL Proxy
# 无需手动启动proxy

# 连接字符串
postgresql://user:pass@/dbname?host=/cloudsql/PROJECT:REGION:INSTANCE

# 优势:
- 使用Unix Socket
- 自动IAM认证
- 无需公网IP
- 更低延迟
```

### Dockerfile.migrate验证

```dockerfile
# ✅ 已验证存在并正确配置
FROM alpine:3.18

# ✅ 包含所有必需组件
- golang-migrate v4.17.0
- postgresql-client 15.4
- bash 5.2.15

# ✅ 包含所有迁移文件
COPY services/billing/migrations /migrations/billing
COPY services/adscenter/migrations /migrations/adscenter
COPY services/offer/migrations /migrations/offer
COPY services/console/migrations /migrations/console

# ✅ 正确的entrypoint
ENTRYPOINT ["/migrate.sh"]
```

---

## 📋 修正后的执行流程

### 正确的迁移流程

```mermaid
graph LR
    A[Push到main] --> B[GitHub Actions触发]
    B --> C[构建db-migrator镜像]
    C --> D[推送到Artifact Registry]
    D --> E[创建Cloud Run Job]
    E --> F[执行迁移]
    F --> G[验证结果]
    G --> H[生成报告]
```

### 详细步骤

1. **构建阶段** (2-3分钟)
   - Checkout代码
   - 构建Dockerfile.migrate
   - 推送到Artifact Registry

2. **部署阶段** (1分钟)
   - 为每个服务创建Cloud Run Job
   - 配置环境变量和secrets
   - 配置Cloud SQL Proxy连接

3. **执行阶段** (2-5分钟)
   - 并行执行4个服务的迁移
   - billing, adscenter, offer, console
   - 实时日志输出

4. **验证阶段** (1分钟)
   - 验证所有schema创建成功
   - 检查表结构和索引
   - 生成迁移报告

**总计**: 6-10分钟

---

## ⚠️ 风险评估

### 当前错误工作流的风险

1. **安全风险** (中)
   - 使用公网IP连接
   - TCP连接可能被拦截
   - 不符合零信任架构

2. **架构偏差** (高)
   - 与设计文档不一致
   - 未来可能无法工作（如果移除公网IP）
   - 技术债务

3. **维护风险** (中)
   - 两套迁移方式
   - 容易混淆
   - 增加维护成本

### 修正后的风险

1. **执行时间增加** (低)
   - 增加2-3分钟构建时间
   - 可接受的代价

2. **复杂度增加** (低)
   - Docker镜像构建
   - Cloud Run Job管理
   - 但更符合最佳实践

---

## 📝 下一步行动

### 立即执行（今天）

1. ✅ 创建本修正方案文档
2. ⏳ 停止当前错误的迁移（如果正在运行）
3. ⏳ 修改database-migration.yml（移除push触发器）
4. ⏳ 修改database-migration-cloudrun.yml（添加push触发器）
5. ⏳ 提交修改并推送
6. ⏳ 手动触发正确的迁移工作流

### 验证步骤

1. ⏳ 确认Cloud Run Job创建成功
2. ⏳ 监控迁移执行日志
3. ⏳ 验证所有schema创建成功
4. ⏳ 更新执行状态文档

---

## 🔗 相关文档

- [DATABASE_MIGRATION_BEST_PRACTICES.md](./DATABASE_MIGRATION_BEST_PRACTICES.md)
- [MustKnowV7.md](../BasicPrinciples/MustKnowV7.md)
- [MIGRATION_EXECUTION_STATUS.md](./MIGRATION_EXECUTION_STATUS.md)
- [TASK_COMPLETION_SUMMARY.md](./TASK_COMPLETION_SUMMARY.md)

---

**文档状态**: ✅ 完成
**下一步**: 执行修正方案
**最后更新**: 2025-10-21
