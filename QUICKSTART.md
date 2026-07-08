# Autoads 快速开始指南

欢迎使用 autoads！本指南将帮助您在 2 小时内快速了解项目架构、搭建开发环境并运行整个系统。

---

## 📋 目录

1. [项目概览](#项目概览)
2. [架构概览](#架构概览)
3. [前置条件](#前置条件)
4. [环境配置](#环境配置)
5. [服务启动顺序](#服务启动顺序)
6. [验证部署](#验证部署)
7. [常见问题](#常见问题)
8. [下一步](#下一步)

---

## 项目概览

### 什么是 Autoads？

Autoads 是一个基于 AI 的 Google Ads 自动化管理平台，帮助用户优化广告投放、提高 ROI。

### 核心功能

- ✅ **Google Ads 集成**: 自动化广告管理
- ✅ **智能优化**: AI 驱动的广告优化建议
- ✅ **批量操作**: 高效的批量广告操作
- ✅ **网站评估**: 自动评估网站质量
- ✅ **计费系统**: 基于 Token 的计费
- ✅ **用户管理**: 完整的用户认证和订阅管理

---

## 架构概览

### 技术栈

```
Frontend (Makerkit + Next.js 14)
    ↓ (JWT Token)
Go 微服务 (Cloud Run)
    ├── adscenter (Google Ads 集成)
    ├── offer (产品管理, DDD/CQRS)
    ├── billing (计费系统, 两阶段提交)
    ├── browser-exec (浏览器自动化, Node.js)
    ├── siterank (网站评分)
    └── recommendations (推荐算法)
    ↓
基础设施 (GCP)
    ├── Supabase PostgreSQL (认证 + 应用数据)
    ├── Cloud SQL PostgreSQL (微服务数据)
    ├── Redis (autoads-redis)
    ├── Pub/Sub (异步消息)
    └── Secret Manager (密钥管理)
```

### 服务职责

| 服务 | 职责 | 技术栈 | 端口 |
|------|------|--------|------|
| **frontend** | 用户界面 | Next.js 14 | 3000 |
| **adscenter** | Google Ads 集成 | Go | 8080 |
| **offer** | 产品管理 | Go (DDD/CQRS) | 8080 |
| **billing** | 计费系统 | Go | 8080 |
| **browser-exec** | 浏览器自动化 | Node.js | 8080 |
| **siterank** | 网站评分 | Go | 8080 |
| **recommendations** | 推荐算法 | Go | 8080 |

---

## 前置条件

### 必需工具

- ✅ **Go 1.25+**: 后端服务
- ✅ **Node.js 20+**: frontend 和 browser-exec
- ✅ **Docker**: 容器化（可选）
- ✅ **Git**: 版本控制
- ✅ **gcloud CLI**: GCP 操作

### GCP 访问

- ✅ **GCP 项目**: gen-lang-client-0944935873
- ✅ **服务账号**: codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com
- ✅ **密钥文件**: `secrets/gcp_codex_dev.json`

### 安装工具

```bash
# macOS
brew install go node gcloud

# 验证安装
go version      # 应该 >= 1.25
node --version  # 应该 >= 20
gcloud version
```

---

## 环境配置

### 1. 克隆项目

```bash
git clone https://github.com/xxrenzhe/autoads.git
cd autoads
```

### 2. 配置 GCP 认证

```bash
# 设置 GCP 项目
gcloud config set project gen-lang-client-0944935873

# 使用服务账号认证
gcloud auth activate-service-account \
  codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com \
  --key-file=secrets/gcp_codex_dev.json

# 验证认证
gcloud auth list
```

### 3. 获取环境变量

所有环境变量存储在 GCP Secret Manager 中：

```bash
# 查看所有 secrets
gcloud secrets list

# 获取特定 secret
gcloud secrets versions access latest --secret="DATABASE_URL"
gcloud secrets versions access latest --secret="REDIS_URL"
gcloud secrets versions access latest --secret="SUPABASE_URL"
```

### 4. 创建本地环境文件

为每个服务创建 `.env` 文件（可选，用于本地开发）：

```bash
# services/adscenter/.env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SUPABASE_URL=https://jzzvizacfyipzdyiqfzb.supabase.co
SUPABASE_ANON_KEY=...
GOOGLE_ADS_DEVELOPER_TOKEN=...
BILLING_SERVICE_URL=http://localhost:8081
BROWSER_EXEC_SERVICE_URL=http://localhost:8082
SITERANK_SERVICE_URL=http://localhost:8083
```

**注意**: 不要提交 `.env` 文件到 Git！

---

## 服务启动顺序

### 推荐启动顺序

```
1. 基础设施 (数据库、Redis)
2. billing (计费系统)
3. siterank (网站评分)
4. browser-exec (浏览器自动化)
5. recommendations (推荐算法)
6. offer (产品管理)
7. adscenter (核心服务)
8. frontend (用户界面)
```

### 方式 1: 本地开发（推荐）

#### 1. 启动基础设施

```bash
# 使用 Cloud SQL 和 Redis (已部署)
# 或使用 Docker 本地运行

# 本地 PostgreSQL (可选)
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15

# 本地 Redis (可选)
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7
```

#### 2. 启动 billing 服务

```bash
cd services/billing
go mod download
go run main.go
# 监听 8081 端口
```

#### 3. 启动 siterank 服务

```bash
cd services/siterank
go mod download
go run main.go
# 监听 8083 端口
```

#### 4. 启动 browser-exec 服务

```bash
cd services/browser-exec
npm install
npx playwright install chromium
npm start
# 监听 8082 端口
```

#### 5. 启动 recommendations 服务

```bash
cd services/recommendations
go mod download
go run main.go
# 监听 8084 端口
```

#### 6. 启动 offer 服务

```bash
cd services/offer
go mod download
go run main.go
# 监听 8085 端口
```

#### 7. 启动 adscenter 服务

```bash
cd services/adscenter
go mod download
go run main.go
# 监听 8080 端口
```

#### 8. 启动 frontend

```bash
cd apps/web
npm install
npm run dev
# 访问 http://localhost:3000
```

### 方式 2: 使用 Docker Compose（简化）

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止所有服务
docker-compose down
```

### 方式 3: 使用 Cloud Run（生产环境）

```bash
# 部署到 Preview 环境
git push origin main

# 部署到生产环境
git push origin production

# 查看服务状态
gcloud run services list --region=asia-northeast1
```

---

## 验证部署

### 1. 检查服务健康

```bash
# billing
curl http://localhost:8081/health

# siterank
curl http://localhost:8083/health

# browser-exec
curl http://localhost:8082/health

# recommendations
curl http://localhost:8084/health

# offer
curl http://localhost:8085/health

# adscenter
curl http://localhost:8080/health

# frontend
curl http://localhost:3000
```

### 2. 测试 API 端点

```bash
# 获取 JWT Token (从 Supabase)
# 访问 https://jzzvizacfyipzdyiqfzb.supabase.co
# 使用 Google OAuth 登录

# 测试 billing API
curl -H "Authorization: Bearer <jwt_token>" \
  http://localhost:8081/api/v1/billing/tokens/balance

# 测试 siterank API
curl -H "Authorization: Bearer <jwt_token>" \
  -X POST http://localhost:8083/api/v1/siterank/evaluate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# 测试 adscenter API
curl -H "Authorization: Bearer <jwt_token>" \
  http://localhost:8080/api/v1/adscenter/accounts
```

### 3. 查看日志

```bash
# 本地开发
# 日志直接输出到终端

# Cloud Run
gcloud run services logs read adscenter-preview \
  --region=asia-northeast1 \
  --limit=100
```

### 4. 监控指标

```bash
# Prometheus 指标
curl http://localhost:8080/metrics
curl http://localhost:8081/metrics
curl http://localhost:8083/metrics
```

---

## 常见问题

### Q1: 数据库连接失败

```bash
# 检查 DATABASE_URL
echo $DATABASE_URL

# 测试连接
psql $DATABASE_URL

# 检查 VPC Connector (Cloud Run)
gcloud compute networks vpc-access connectors describe cr-conn-default-ane1 \
  --region=asia-northeast1
```

### Q2: Redis 连接失败

```bash
# 检查 REDIS_URL
echo $REDIS_URL

# 测试连接
redis-cli -h <redis-host> -p 6379 ping

# 检查 Redis 实例
gcloud redis instances describe autoads-redis \
  --region=asia-northeast1
```

### Q3: 服务启动失败

```bash
# 检查端口占用
lsof -i :8080

# 检查依赖
go mod verify
npm list

# 查看详细日志
go run main.go 2>&1 | tee service.log
```

### Q4: 认证失败

```bash
# 检查 Supabase 配置
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# 测试 Supabase 连接
curl https://jzzvizacfyipzdyiqfzb.supabase.co/rest/v1/

# 验证 JWT Token
# 使用 https://jwt.io/ 解码 token
```

### Q5: Google Ads API 错误

```bash
# 检查 Developer Token
echo $GOOGLE_ADS_DEVELOPER_TOKEN

# 检查 OAuth Token
# 查看数据库中的 UserAdsConnection 表

# 常见错误
# - AUTHENTICATION_ERROR: OAuth token 过期
# - AUTHORIZATION_ERROR: 权限不足
# - QUOTA_ERROR: API 配额超限
```

---

## 下一步

### 学习资源

1. **架构文档**
   - [架构审查报告](docs/ArchitectureReviewV1/FINAL-ARCHITECTURE-REVIEW.md)
   - [执行摘要](docs/ArchitectureReviewV1/EXECUTIVE-SUMMARY.md)
   - [服务依赖关系](docs/ArchitectureReviewV1/service-dependencies.md)

2. **服务文档**
   - [adscenter README](services/adscenter/README.md)
   - [offer README](services/offer/README.md) - DDD/CQRS 典范
   - [billing README](services/billing/README.md) - 两阶段提交典范
   - [browser-exec README](services/browser-exec/README.md)
   - [siterank README](services/siterank/README.md)
   - [recommendations README](services/recommendations/README.md)

3. **开发指南**
   - [项目构建指令](docs/SupabaseGo/MustKnowV6.md)
   - [Monorepo 最佳实践](docs/monorepo-build-best-practices.md)
   - [数据库迁移指南](docs/SupabaseGo/MustKnowV6.md#数据库架构与初始化策略)

### 开发任务

1. **熟悉代码库**
   - 阅读各服务的 README
   - 理解服务间的依赖关系
   - 查看 OpenAPI 规范

2. **本地开发**
   - 配置开发环境
   - 运行所有服务
   - 测试 API 端点

3. **贡献代码**
   - 创建功能分支
   - 编写代码和测试
   - 提交 Pull Request

### 获取帮助

- **文档**: 查看 `docs/` 目录
- **代码**: 查看各服务的 README
- **问题**: 创建 GitHub Issue
- **讨论**: 团队 Slack 频道

---

## 🎉 恭喜！

您已经完成了 autoads 的快速开始！现在您可以：

- ✅ 理解项目架构
- ✅ 配置开发环境
- ✅ 运行所有服务
- ✅ 测试 API 端点
- ✅ 开始开发

**祝您开发愉快！** 🚀

---

## 附录

### 有用的命令

```bash
# 查看所有服务状态
gcloud run services list --region=asia-northeast1

# 查看服务日志
gcloud run services logs read <service-name> \
  --region=asia-northeast1 \
  --limit=100

# 部署服务
gcloud run deploy <service-name> \
  --image=<image-url> \
  --region=asia-northeast1

# 查看 Secret Manager
gcloud secrets list
gcloud secrets versions access latest --secret="<secret-name>"

# 数据库操作
psql $DATABASE_URL
psql $DATABASE_URL -c "SELECT * FROM users LIMIT 10;"

# Redis 操作
redis-cli -h <redis-host> -p 6379
redis-cli -h <redis-host> -p 6379 KEYS "*"
```

### 环境 URL

**Preview 环境**:
- Frontend: https://www.urlchecker.dev
- Services: https://<service>-preview-...run.app

**生产环境**:
- Frontend: https://www.autoads.dev
- Services: https://<service>-...run.app

### 重要链接

- **GitHub**: https://github.com/xxrenzhe/autoads
- **GCP Console**: https://console.cloud.google.com/
- **Supabase**: https://jzzvizacfyipzdyiqfzb.supabase.co
- **Cloud Run**: https://console.cloud.google.com/run?project=gen-lang-client-0944935873

---

**最后更新**: 2025-10-08  
**维护者**: 开发团队  
**版本**: 1.0
