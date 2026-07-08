# Siterank服务部署和测试指南

> **目标**: 部署siterank评估服务到preview和production环境
> **前置条件**: 已完成代码开发和本地测试
> **部署时间**: 约30-45分钟

---

## 📋 部署前检查清单

### 1. 环境变量准备

需要在Secret Manager中创建/更新以下环境变量：

```bash
# 检查现有secrets
gcloud secrets list --project=gen-lang-client-0944935873

# 需要的secrets:
# - DATABASE_URL (已存在)
# - DATABASE_URL_PROD (已存在)
# - SIMILARWEB_BASE_URL (需创建)
```

#### 创建SIMILARWEB_BASE_URL secret:

```bash
# 创建secret
gcloud secrets create SIMILARWEB_BASE_URL \
  --project=gen-lang-client-0944935873 \
  --replication-policy="automatic"

# 添加版本
echo -n "https://data.similarweb.com/api/v1" | \
  gcloud secrets versions add SIMILARWEB_BASE_URL \
  --project=gen-lang-client-0944935873 \
  --data-file=-

# 授予服务账号访问权限
gcloud secrets add-iam-policy-binding SIMILARWEB_BASE_URL \
  --project=gen-lang-client-0944935873 \
  --member="serviceAccount:codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 2. 数据库迁移

```bash
# 方法1: 使用kubectl执行db-migrator job（推荐）
kubectl apply -f k8s/jobs/db-migrator.yaml

# 方法2: 直接连接数据库执行
psql $DATABASE_URL -f schemas/sql/019_offer_evaluations.sql

# 验证表结构
psql $DATABASE_URL -c "\d offer_evaluations"
psql $DATABASE_URL -c "\d ai_evaluation_history"
psql $DATABASE_URL -c "\dv offer_evaluations_latest"
```

### 3. Redis验证

```bash
# 验证Redis连接（需要通过有VPC访问权限的实例）
# 1. 创建临时Cloud Run服务测试Redis连接
# 2. 或通过现有browser-exec服务验证

# Redis实例信息
# - Preview: 10.0.0.3:6379 (autoads-redis实例)
# - Production: 10.0.0.4:6379 (根据实际配置)
```

### 4. 服务依赖检查

确认以下服务已部署且正常运行：

- ✅ Browser-exec服务
  - Preview: `https://browser-exec-preview-885pd7lz.a.run.app`
  - Production: `https://browser-exec-production-885pd7lz.a.run.app`

```bash
# 测试browser-exec健康检查
curl https://browser-exec-preview-885pd7lz.a.run.app/healthz
```

---

## 🚀 部署流程

### Preview环境部署

#### Step 1: 构建镜像

```bash
# 方法1: 使用Cloud Build（推荐）
cd /Users/jason/Documents/Kiro/autoads
gcloud builds submit \
  --config=services/siterank/cloudbuild.yaml \
  --project=gen-lang-client-0944935873 \
  --substitutions=COMMIT_SHA=$(git rev-parse --short HEAD)

# 方法2: 本地构建推送
docker build -t asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/siterank:preview-latest \
  -f services/siterank/Dockerfile .
docker push asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/siterank:preview-latest
```

#### Step 2: 部署到Cloud Run

```bash
# 使用部署配置文件
gcloud run services replace deployments/siterank/preview-deploy.yaml \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873

# 等待部署完成
gcloud run services describe siterank-preview \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873 \
  --format="value(status.url)"
```

#### Step 3: 验证部署

```bash
# 1. 健康检查
SERVICE_URL=$(gcloud run services describe siterank-preview \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873 \
  --format="value(status.url)")

curl $SERVICE_URL/healthz

# 2. 查看日志
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=siterank-preview" \
  --limit=50 \
  --project=gen-lang-client-0944935873 \
  --format=json

# 3. 检查指标
gcloud monitoring dashboards list \
  --project=gen-lang-client-0944935873 \
  --filter="displayName:siterank"
```

### Production环境部署

⚠️ **重要**: Production部署需要先在Preview环境充分测试

#### Step 1: 构建Production镜像

```bash
# 确保代码已合并到production分支
git checkout production
git pull origin production

# 构建镜像
gcloud builds submit \
  --config=services/siterank/cloudbuild-prod.yaml \
  --project=gen-lang-client-0944935873 \
  --substitutions=COMMIT_SHA=$(git rev-parse --short HEAD)
```

#### Step 2: 部署到Cloud Run

```bash
# 使用部署配置文件
gcloud run services replace deployments/siterank/production-deploy.yaml \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873

# 验证部署
SERVICE_URL=$(gcloud run services describe siterank-production \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873 \
  --format="value(status.url)")

curl $SERVICE_URL/healthz
```

---

## 🧪 功能测试

### 1. 基础评估测试

```bash
# 设置环境变量
export API_BASE_URL="https://autoads-gw-preview-885pd7lz.an.gateway.dev/api/v1"
export FIREBASE_TOKEN="<从前端获取的ID Token>"

# 创建评估任务（基础评估）
EVALUATION_RESPONSE=$(curl -X POST "$API_BASE_URL/offers/{offerId}/evaluate" \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "includeAI": false,
    "forceRefresh": false
  }')

echo $EVALUATION_RESPONSE
# 期望输出:
# {
#   "evaluationId": "uuid",
#   "status": "pending",
#   "estimatedTokens": 1,
#   "message": "评估任务已创建，正在处理中"
# }

# 提取evaluationId
EVAL_ID=$(echo $EVALUATION_RESPONSE | jq -r '.evaluationId')

# 轮询评估结果
while true; do
  RESULT=$(curl -s "$API_BASE_URL/evaluations/$EVAL_ID" \
    -H "Authorization: Bearer $FIREBASE_TOKEN")

  STATUS=$(echo $RESULT | jq -r '.status')
  echo "状态: $STATUS"

  if [ "$STATUS" = "success" ] || [ "$STATUS" = "failed" ]; then
    echo $RESULT | jq .
    break
  fi

  sleep 3
done
```

### 2. AI评估测试

```bash
# 创建AI评估任务
AI_EVAL_RESPONSE=$(curl -X POST "$API_BASE_URL/offers/{offerId}/evaluate" \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "includeAI": true,
    "forceRefresh": false
  }')

echo $AI_EVAL_RESPONSE
# 期望输出:
# {
#   "evaluationId": "uuid",
#   "status": "pending",
#   "estimatedTokens": 3,
#   "message": "评估任务已创建，正在处理中"
# }

# 获取结果
AI_EVAL_ID=$(echo $AI_EVAL_RESPONSE | jq -r '.evaluationId')

# 等待30-60秒后查询结果
sleep 60
curl "$API_BASE_URL/evaluations/$AI_EVAL_ID" \
  -H "Authorization: Bearer $FIREBASE_TOKEN" | jq .

# 验证AI评估结果包含:
# - aiRecommendationScore (0-100)
# - aiReasons (数组，3条理由)
# - aiIndustry (行业分类)
# - similarwebData (流量数据)
```

### 3. SimilarWeb数据查询测试

```bash
# 查询域名的SimilarWeb数据
curl "$API_BASE_URL/domains/nike.com/similarweb" \
  -H "Authorization: Bearer $FIREBASE_TOKEN" | jq .

# 期望输出:
# {
#   "domain": "nike.com",
#   "data": {
#     "globalRank": 123,
#     "totalVisits": 15300000,
#     ...
#   },
#   "cached": true,
#   "cachedAt": "2025-10-04T..."
# }

# 强制刷新缓存
curl "$API_BASE_URL/domains/nike.com/similarweb?forceRefresh=true" \
  -H "Authorization: Bearer $FIREBASE_TOKEN" | jq .
```

### 4. 缓存验证

```bash
# 第一次请求（缓存未命中）
time curl "$API_BASE_URL/domains/example.com/similarweb" \
  -H "Authorization: Bearer $FIREBASE_TOKEN" -o /dev/null -s -w "%{time_total}\n"

# 第二次请求（缓存命中，应该更快）
time curl "$API_BASE_URL/domains/example.com/similarweb" \
  -H "Authorization: Bearer $FIREBASE_TOKEN" -o /dev/null -s -w "%{time_total}\n"

# 验证Redis中的缓存
# 需要通过有权限的服务访问Redis
```

### 5. 错误场景测试

```bash
# 测试Token余额不足（需要修改billing服务模拟）
# 期望返回: 402 INSUFFICIENT_TOKENS

# 测试非Elite用户请求AI评估（需要修改用户订阅模拟）
# 期望返回: 403 ELITE_REQUIRED

# 测试无效的Offer ID
curl -X POST "$API_BASE_URL/offers/invalid-uuid/evaluate" \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"includeAI": false}'
# 期望返回: 400 或 404
```

---

## 📊 监控和日志

### 1. 查看实时日志

```bash
# Preview环境
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=siterank-preview" \
  --project=gen-lang-client-0944935873

# Production环境
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=siterank-production" \
  --project=gen-lang-client-0944935873

# 过滤错误日志
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=siterank-preview AND severity>=ERROR" \
  --limit=20 \
  --project=gen-lang-client-0944935873 \
  --format=json
```

### 2. 性能监控

```bash
# 查看服务指标
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count" AND resource.labels.service_name="siterank-preview"' \
  --project=gen-lang-client-0944935873

# 查看延迟
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_latencies" AND resource.labels.service_name="siterank-preview"' \
  --project=gen-lang-client-0944935873
```

### 3. 数据库监控

```bash
# 查询评估记录统计
psql $DATABASE_URL -c "
SELECT
  evaluation_type,
  status,
  COUNT(*) as count,
  AVG(tokens_consumed) as avg_tokens
FROM offer_evaluations
GROUP BY evaluation_type, status;
"

# 查询最近的评估
psql $DATABASE_URL -c "
SELECT id, evaluation_type, status, domain, brand_name,
       ai_recommendation_score, tokens_consumed, created_at
FROM offer_evaluations
ORDER BY created_at DESC
LIMIT 10;
"

# 查询Redis缓存命中率（需要自定义指标）
```

---

## 🔧 故障排查

### 问题1: 服务启动失败

```bash
# 检查Cloud Run日志
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=siterank-preview" \
  --limit=100 \
  --project=gen-lang-client-0944935873 \
  --format=json | jq '.[] | select(.severity=="ERROR")'

# 常见原因:
# 1. DATABASE_URL连接失败 → 检查VPC Connector
# 2. Redis连接失败 → 检查REDIS_ADDR配置
# 3. Secret访问失败 → 检查IAM权限
```

### 问题2: 评估一直处于pending状态

```bash
# 检查browser-exec服务是否正常
curl https://browser-exec-preview-885pd7lz.a.run.app/healthz

# 检查Pub/Sub消息积压
gcloud pubsub subscriptions list \
  --project=gen-lang-client-0944935873

# 检查评估服务日志
gcloud logging read "resource.labels.service_name=siterank-preview AND jsonPayload.evaluationId=\"<EVAL_ID>\"" \
  --project=gen-lang-client-0944935873 \
  --limit=50
```

### 问题3: AI评估失败

```bash
# 检查Gemini API调用
gcloud logging read "resource.labels.service_name=siterank-preview AND textPayload=~\"gemini\"" \
  --project=gen-lang-client-0944935873 \
  --limit=20

# 常见原因:
# 1. Firebase AI Logic配置错误
# 2. Gemini API quota超限
# 3. Prompt解析失败
```

### 问题4: SimilarWeb数据获取失败

```bash
# 测试直接访问SimilarWeb API
curl "https://data.similarweb.com/api/v1/data?domain=nike.com"

# 检查Redis缓存
# 需要通过有权限的服务执行Redis命令

# 检查错误缓存
gcloud logging read "resource.labels.service_name=siterank-preview AND textPayload=~\"similarweb\"" \
  --project=gen-lang-client-0944935873 \
  --limit=20
```

---

## 🎯 性能优化建议

### 1. Redis缓存优化

```bash
# 监控缓存命中率
# 添加自定义指标记录cache hit/miss

# 优化TTL策略
# 根据实际使用情况调整：
# - 成功: 当前7天，可根据域名流行度动态调整
# - 失败: 当前1小时，可根据错误类型调整
```

### 2. 数据库性能

```bash
# 检查慢查询
psql $DATABASE_URL -c "
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE query LIKE '%offer_evaluations%'
ORDER BY total_time DESC
LIMIT 10;
"

# 添加更多索引（如果需要）
# 当前已有索引：user_id, offer_id, url_hash, status, evaluation_type
```

### 3. Cloud Run实例优化

```yaml
# 根据实际负载调整:
# Preview环境:
#   minScale: 1 → 可根据使用模式调整
#   maxScale: 10 → 可根据峰值需求调整
#   cpu: 2 → 评估任务是CPU密集型
#   memory: 2Gi → 足够处理大量并发评估

# Production环境:
#   minScale: 2 → 确保高可用
#   maxScale: 20 → 应对流量峰值
```

---

## ✅ 部署完成检查

部署完成后，确认以下项目：

- [ ] Preview环境服务正常运行
- [ ] Production环境服务正常运行（如已部署）
- [ ] 数据库迁移成功
- [ ] Redis连接正常
- [ ] Browser-exec集成正常
- [ ] 基础评估功能测试通过
- [ ] AI评估功能测试通过（如有Elite用户）
- [ ] SimilarWeb数据查询正常
- [ ] 缓存机制验证通过
- [ ] 日志和监控配置完成
- [ ] API Gateway路由配置完成（如需要）

---

## 📞 支持和反馈

### 相关文档：
- `/docs/MarkerkitGo/Siterank_Implementation_Summary.md` - 后端实现
- `/docs/MarkerkitGo/Frontend_Integration_Summary.md` - 前端集成
- `/docs/MarkerkitGo/Siterank_Feature_Complete.md` - 功能总结

### 常用命令速查：

```bash
# 快速部署Preview
gcloud builds submit --config=services/siterank/cloudbuild.yaml
gcloud run services replace deployments/siterank/preview-deploy.yaml --region=asia-northeast1

# 查看日志
gcloud logging tail "resource.labels.service_name=siterank-preview"

# 数据库查询
psql $DATABASE_URL -c "SELECT * FROM offer_evaluations ORDER BY created_at DESC LIMIT 5;"

# 健康检查
curl $(gcloud run services describe siterank-preview --region=asia-northeast1 --format="value(status.url)")/healthz
```

---

**部署完成后，请及时更新进展文档并标注完成状态！** ✅
