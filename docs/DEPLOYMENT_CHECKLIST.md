# AutoAds 部署检查清单

**版本**: V1.0
**最后更新**: 2025-10-16
**状态**: ✅ 核心功能就绪（89%完成）

---

## 📋 部署前检查

### 1. 代码完成度

| 模块 | 状态 | 备注 |
|------|------|------|
| Offer评估系统 | ✅ 就绪 | 后端100%，前端100% |
| 用户端Dashboard | ✅ 就绪 | BFF服务已完成 |
| 签到系统 | ✅ 就绪 | 后端+前端100% |
| 邀请系统 | ✅ 就绪 | 后端+前端100%，含Auth集成 |
| 后台管理系统 | ✅ 就绪 | Console Service 9大模块完成 |
| 单元测试 | ⚠️ 部分 | 覆盖率~60%，可先部署 |
| 集成测试 | ⏳ 待补充 | 可在预发环境进行 |

**部署建议**: ✅ 可以部署到预发环境（Staging）

---

## 🔐 环境变量检查清单

### Frontend (Next.js)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# API Gateway
NEXT_PUBLIC_API_GATEWAY_URL=https://gateway.autoads.dev

# Environment
NEXT_PUBLIC_ENVIRONMENT=production

# Base URLs
NEXT_PUBLIC_SITE_URL=https://www.autoads.dev
NEXT_PUBLIC_MANAGE_BASE_URL=https://www.autoads.dev/manage
```

### Backend Services (共同变量)

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/autoads
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Redis
REDIS_URL=10.0.0.3:6379  # Cloud Memorystore内网地址

# Admin Config
SUPER_ADMIN_EMAIL=admin@autoads.com
ADMIN_EMAILS=admin1@autoads.com,admin2@autoads.com
ADMIN_UIDS=uid_123,uid_456

# Service Discovery (Cloud Run内网)
BILLING_SERVICE_URL=http://billing:8080
OFFER_SERVICE_URL=http://offer:8080
SITERANK_SERVICE_URL=http://siterank:8080
ADSCENTER_SERVICE_URL=http://adscenter:8080
USERACTIVITY_SERVICE_URL=http://useractivity:8080
BFF_SERVICE_URL=http://bff:8080
```

### Siterank Service (特有)

```bash
# Browser-Exec
BROWSER_EXEC_URL=http://browser-exec:8080

# Vertex AI
GCP_PROJECT_ID=autoads-prod
VERTEX_AI_LOCATION=us-central1
GEMINI_MODEL=gemini-1.5-flash

# Pub/Sub
EVALUATION_TOPIC=projects/autoads-prod/topics/siterank-evaluate
```

### Browser-Exec Service (特有)

```bash
# SimilarWeb (从Secret Manager获取)
SIMILARWEB_API_KEY=projects/autoads-prod/secrets/similarweb-api-key/versions/latest

# Proxy (可选)
HTTP_PROXY=http://proxy.example.com:8080
```

### BFF Service (特有)

```bash
# 下游服务URLs (同上Service Discovery)
OFFER_SERVICE_URL=http://offer:8080
SITERANK_SERVICE_URL=http://siterank:8080
BILLING_SERVICE_URL=http://billing:8080
ADSCENTER_SERVICE_URL=http://adscenter:8080
USERACTIVITY_SERVICE_URL=http://useractivity:8080
```

---

## 🗄️ 数据库迁移检查

### 必需的表结构

**Siterank Service**:
- [ ] `offer_evaluations` - Offer评估结果
- [ ] `similarweb_global_cache` - SimilarWeb全局缓存
- [ ] `evaluation_aggregations` - 评估聚合数据

**Useractivity Service**:
- [ ] `user_notifications` - 用户通知
- [ ] `checkins` - 签到记录
- [ ] `user_checkin_stats` - 签到统计
- [ ] `referrals` - 邀请关系
- [ ] `trial_subscriptions` - 试用订阅

**Console Service**:
- [ ] `User` - 用户表（ensureUserTable自动创建）
- [ ] `notifications_broadcast` - 广播通知
- [ ] `notification_templates` - 通知模板

**Billing Service**:
- [ ] `UserToken` - Token余额
- [ ] `TokenTransaction` - Token交易记录
- [ ] `Subscription` - 订阅记录

**Offer Service**:
- [ ] `Offer` - Offer表

**Adscenter Service**:
- [ ] `ads_accounts` - 广告账号
- [ ] `bulk_operations` - 批量操作

**运行迁移**:
```bash
# 各服务使用embedded DDL模式，启动时自动创建表
# 或手动执行SQL文件：
psql $DATABASE_URL < database/migrations/xxx.sql
```

---

## ☁️ Cloud Run部署检查

### 服务列表

| 服务名称 | 镜像 | 端口 | 最小副本 | 最大副本 | 内存 | CPU |
|---------|------|------|---------|---------|------|-----|
| frontend | gcr.io/autoads-prod/frontend:latest | 3000 | 1 | 10 | 512Mi | 1 |
| offer | gcr.io/autoads-prod/offer:latest | 8080 | 1 | 5 | 256Mi | 1 |
| siterank | gcr.io/autoads-prod/siterank:latest | 8080 | 1 | 5 | 512Mi | 1 |
| billing | gcr.io/autoads-prod/billing:latest | 8080 | 1 | 5 | 256Mi | 1 |
| useractivity | gcr.io/autoads-prod/useractivity:latest | 8080 | 1 | 5 | 256Mi | 1 |
| console | gcr.io/autoads-prod/console:latest | 8080 | 1 | 3 | 256Mi | 1 |
| adscenter | gcr.io/autoads-prod/adscenter:latest | 8080 | 1 | 5 | 256Mi | 1 |
| bff | gcr.io/autoads-prod/bff:latest | 8080 | 1 | 5 | 256Mi | 1 |
| browser-exec | gcr.io/autoads-prod/browser-exec:latest | 8080 | 1 | 3 | 2Gi | 2 |

### 部署命令示例

```bash
# Frontend
gcloud run deploy frontend \
  --image gcr.io/autoads-prod/frontend:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=xxx,NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx" \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10

# Backend Services (以offer为例)
gcloud run deploy offer \
  --image gcr.io/autoads-prod/offer:latest \
  --platform managed \
  --region us-central1 \
  --no-allow-unauthenticated \
  --set-env-vars "DATABASE_URL=xxx,BILLING_SERVICE_URL=http://billing:8080" \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 5
```

---

## 🔒 Secret Manager配置

### 必需的Secrets

```bash
# 创建Secrets
gcloud secrets create similarweb-api-key \
  --data-file=- <<< "YOUR_API_KEY"

gcloud secrets create supabase-service-role-key \
  --data-file=- <<< "YOUR_SERVICE_ROLE_KEY"

gcloud secrets create redis-url \
  --data-file=- <<< "10.0.0.3:6379"

# 授予服务访问权限
gcloud secrets add-iam-policy-binding similarweb-api-key \
  --member="serviceAccount:browser-exec@autoads-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 📡 Cloud Pub/Sub配置

### Topics

```bash
# Siterank评估主题
gcloud pubsub topics create siterank-evaluate

# 创建订阅
gcloud pubsub subscriptions create siterank-evaluate-sub \
  --topic=siterank-evaluate \
  --ack-deadline=600 \
  --message-retention-duration=7d
```

---

## 🗂️ Cloud Memorystore (Redis)配置

```bash
# 创建Redis实例
gcloud redis instances create autoads-cache \
  --region=us-central1 \
  --tier=basic \
  --size=1 \
  --redis-version=redis_6_x

# 获取内网IP
gcloud redis instances describe autoads-cache \
  --region=us-central1 \
  --format="get(host)"
```

---

## 🤖 Vertex AI配置

### 启用API

```bash
gcloud services enable aiplatform.googleapis.com
```

### 服务账号权限

```bash
# 授予Vertex AI权限
gcloud projects add-iam-policy-binding autoads-prod \
  --member="serviceAccount:siterank@autoads-prod.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

---

## 🌐 API Gateway / Load Balancer配置

### 路由规则

```yaml
# Cloud Run Backend Services
- path: /api/v1/offers/*
  service: offer

- path: /api/v1/evaluations/*
  service: siterank

- path: /api/v1/domains/*
  service: siterank

- path: /api/v1/billing/*
  service: billing

- path: /api/v1/notifications/*
  service: useractivity

- path: /api/v1/check-in/*
  service: useractivity

- path: /api/v1/referral/*
  service: useractivity

- path: /api/v1/trial/*
  service: useractivity

- path: /api/v1/console/*
  service: console

- path: /api/v1/ads/*
  service: adscenter

- path: /api/v1/dashboard/*
  service: bff

- path: /*
  service: frontend
```

---

## 📊 Cloud Monitoring配置

### 创建Alert Policies

```bash
# 高错误率告警
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High Error Rate" \
  --condition-threshold-value=5 \
  --condition-threshold-duration=300s \
  --condition-filter='metric.type="run.googleapis.com/request_count" AND metric.label.response_code_class="5xx"'

# 高延迟告警
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High Latency" \
  --condition-threshold-value=1000 \
  --condition-threshold-duration=300s \
  --condition-filter='metric.type="run.googleapis.com/request_latencies"'
```

---

## 🧪 预发环境测试清单

### 功能测试

- [ ] 用户注册/登录（含邀请码）
- [ ] Offer创建和评估（Starter/Pro/Elite套餐）
- [ ] 签到功能（Token奖励）
- [ ] Dashboard数据聚合（5个服务）
- [ ] Token消耗和充值
- [ ] 后台管理功能（订阅调整、Offer管理）

### 性能测试

- [ ] API响应时间 < 500ms (P95)
- [ ] Frontend LCP < 2.5s
- [ ] 并发用户测试（100 CCU）

### 监控验证

- [ ] Cloud Monitoring Dashboard配置
- [ ] 错误日志收集（Cloud Logging）
- [ ] Alert触发测试

---

## 🚀 生产发布流程

### 1. 最终检查

```bash
# 确认所有服务镜像已构建
gcloud builds list --limit=10

# 确认所有环境变量已配置
gcloud run services describe frontend --format="value(spec.template.spec.containers.env)"
```

### 2. 发布顺序

推荐按依赖顺序发布：

1. ✅ Database (Supabase)
2. ✅ Redis (Cloud Memorystore)
3. ✅ Pub/Sub Topics
4. ✅ Backend Services (offer, billing, siterank, useractivity, adscenter, console)
5. ✅ BFF Service
6. ✅ Browser-Exec Service
7. ✅ Frontend

### 3. 灰度发布

```bash
# 先发布10%流量
gcloud run services update-traffic frontend \
  --to-revisions=LATEST=10,PREVIOUS=90

# 监控30分钟无异常后，切换100%
gcloud run services update-traffic frontend \
  --to-latest
```

### 4. 回滚方案

```bash
# 快速回滚到上一版本
gcloud run services update-traffic frontend \
  --to-revisions=PREVIOUS=100
```

---

## 📞 紧急联系方式

| 角色 | 姓名 | 联系方式 |
|------|------|---------|
| 技术负责人 | - | - |
| 后端负责人 | - | - |
| 前端负责人 | - | - |
| DevOps | - | - |
| 值班工程师 | - | - |

---

## ✅ 部署完成验证

部署完成后，验证以下端点：

```bash
# 健康检查
curl https://www.autoads.dev/healthz
curl https://api.autoads.dev/api/v1/offers/health
curl https://api.autoads.dev/api/v1/billing/health
curl https://api.autoads.dev/api/v1/console/health

# 功能验证
# 1. 访问前端首页
open https://www.autoads.dev

# 2. 登录并访问Dashboard
# 3. 创建Offer并触发评估
# 4. 执行签到
# 5. 访问后台管理（需管理员账号）
open https://www.autoads.dev/manage
```

---

**检查清单完成日期**: _____________
**部署执行人**: _____________
**部署完成时间**: _____________
**验证通过**: ☐ 是 ☐ 否

---

**附注**:
- 首次部署建议在业务低峰期（如周末凌晨）进行
- 准备好回滚方案，并在发布前进行演练
- 发布后持续监控24小时
