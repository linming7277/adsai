# Token 系统部署指南

**创建日期**: 2025-10-07
**状态**: 准备部署
**版本**: 1.0

---

## 📋 部署前检查清单

### ✅ 已完成的准备工作

1. **代码实现** ✅
   - [x] 数据库迁移脚本: `schemas/sql/027_token_service_tracking.sql`
   - [x] Billing 服务 API 增强: `getTokenUsageSummary` 端点
   - [x] Offer 服务集成: ConsumeTokens 直接扣费
   - [x] Siterank 服务集成: Reserve-Commit 两阶段模式
   - [x] Token 消耗规则定义

2. **构建产物** ✅
   - [x] db-migrator 镜像构建成功 (Build ID: 90497298-4d1a-45a1-9717-1276988e2188)
   - [x] 使用优化 tarball (37KB)

3. **文档** ✅
   - [x] 服务集成指南
   - [x] Token 报表增强总结
   - [x] 系统实现总结

---

## 🚀 部署步骤

### 步骤1: 运行数据库迁移

#### 方式A: 使用 Cloud Run Job (推荐)

```bash
# 执行迁移 Job
gcloud run jobs execute db-migrator-preview \
  --region=asia-northeast1 \
  --wait

# 验证迁移成功
gcloud run jobs executions list \
  --job=db-migrator-preview \
  --region=asia-northeast1 \
  --limit=1

# 如果失败,查看日志
gcloud logging read \
  "resource.type=cloud_run_job AND resource.labels.job_name=db-migrator-preview" \
  --limit=50 \
  --format=json
```

#### 方式B: 直接 SQL 执行 (备选)

```bash
# 连接到数据库
psql $DATABASE_URL

# 手动执行迁移
\i schemas/sql/027_token_service_tracking.sql

# 验证列已创建
\d "TokenTransaction"

# 验证索引已创建
\di | grep token_transaction
```

#### 迁移验证

```sql
-- 检查列是否存在
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'TokenTransaction'
  AND column_name IN ('service', 'actionType');

-- 检查索引
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'TokenTransaction'
  AND indexname LIKE '%service%';

-- 检查约束
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'chk_token_transaction_service_required';
```

---

### 步骤2: 部署服务

#### 2.1 部署 Billing 服务

```bash
# 构建镜像
cd /Users/jason/Documents/Kiro/autoads
tar -czf /tmp/billing-source.tar.gz \
  --exclude='apps' --exclude='makerkit' --exclude='docs' \
  --exclude='node_modules' --exclude='.git' --exclude='.next' \
  go.work go.work.sum services/billing pkg schemas deployments scripts/db

# 提交构建
gcloud builds submit /tmp/billing-source.tar.gz \
  --config=deployments/cloudbuild/build-service-docker.yaml \
  --substitutions=_SERVICE=billing,_IMAGE=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/billing:preview-latest \
  --timeout=10m

# 部署到 Cloud Run (设置 SKIP_MIGRATIONS=1)
gcloud run deploy billing-preview \
  --image=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/billing:preview-latest \
  --region=asia-northeast1 \
  --set-env-vars=BILLING_SKIP_MIGRATIONS=1 \
  --platform=managed
```

#### 2.2 部署 Offer 服务

```bash
# 构建镜像
tar -czf /tmp/offer-source.tar.gz \
  --exclude='apps' --exclude='makerkit' --exclude='docs' \
  --exclude='node_modules' --exclude='.git' --exclude='.next' \
  go.work go.work.sum services/offer pkg schemas deployments scripts/db

gcloud builds submit /tmp/offer-source.tar.gz \
  --config=deployments/cloudbuild/build-service-docker.yaml \
  --substitutions=_SERVICE=offer,_IMAGE=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/offer:preview-latest \
  --timeout=10m

# 部署 (设置 SKIP_MIGRATIONS=1)
gcloud run deploy offer-preview \
  --image=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/offer:preview-latest \
  --region=asia-northeast1 \
  --set-env-vars=OFFER_SKIP_MIGRATIONS=1 \
  --platform=managed
```

#### 2.3 部署 Siterank 服务

```bash
# 构建镜像
tar -czf /tmp/siterank-source.tar.gz \
  --exclude='apps' --exclude='makerkit' --exclude='docs' \
  --exclude='node_modules' --exclude='.git' --exclude='.next' \
  go.work go.work.sum services/siterank pkg schemas deployments scripts/db

gcloud builds submit /tmp/siterank-source.tar.gz \
  --config=deployments/cloudbuild/build-service-docker.yaml \
  --substitutions=_SERVICE=siterank,_IMAGE=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/siterank:preview-latest \
  --timeout=10m

# 部署
gcloud run deploy siterank-preview \
  --image=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/siterank:preview-latest \
  --region=asia-northeast1 \
  --platform=managed
```

---

## 🧪 测试流程

### 测试1: Offer Token 扣费

```bash
# 获取测试用户 Token
export TEST_USER_TOKEN="<firebase-token>"
export API_BASE="https://autoads-gw-preview-885pd7lz.an.gateway.dev"

# 场景1: 成功创建 Offer (扣费 10 tokens)
curl -X POST "${API_BASE}/api/v1/offers" \
  -H "Authorization: Bearer ${TEST_USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Offer - Token Integration",
    "originalUrl": "https://example.com/offer"
  }'

# 预期结果:
# - HTTP 201 Created
# - 返回 Offer 对象
# - Token 余额减少 10

# 场景2: 余额不足
# (先消耗所有 Token,确保余额 < 10)

curl -X POST "${API_BASE}/api/v1/offers" \
  -H "Authorization: Bearer ${TEST_USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Should Fail",
    "originalUrl": "https://example.com/fail"
  }'

# 预期结果:
# - HTTP 402 Payment Required
# - 错误代码: INSUFFICIENT_TOKENS
# - Offer 未创建
```

### 测试2: Siterank Token 扣费

```bash
# 场景1: 缓存查询 (1 token)
curl -X GET "${API_BASE}/api/v1/domains/example.com/similarweb" \
  -H "Authorization: Bearer ${TEST_USER_TOKEN}"

# 预期结果:
# - HTTP 200 OK
# - 返回 SimilarWeb 数据
# - Token 余额减少 1

# 场景2: 实时查询 (5 tokens)
curl -X GET "${API_BASE}/api/v1/domains/example.com/similarweb?forceRefresh=true" \
  -H "Authorization: Bearer ${TEST_USER_TOKEN}"

# 预期结果:
# - HTTP 200 OK
# - Token 余额减少 5

# 场景3: AI 评估 (10 tokens)
curl -X POST "${API_BASE}/api/v1/offers/<offer-id>/evaluate" \
  -H "Authorization: Bearer ${TEST_USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "includeAI": true,
    "forceRefresh": false
  }'

# 预期结果:
# - HTTP 202 Accepted
# - 返回 evaluationId
# - Token 余额减少 10
```

### 测试3: Token 报表

```bash
# 获取用户 ID
export USER_ID="<user-id>"

# 查询服务级别使用情况
curl -X GET "${API_BASE}/api/v1/tokens/${USER_ID}/usage?startDate=2025-10-01T00:00:00Z&endDate=2025-10-31T23:59:59Z" \
  -H "Authorization: Bearer ${TEST_USER_TOKEN}"

# 预期结果:
{
  "userId": "user-123",
  "totalConsumed": 26,
  "totalTopUp": 100,
  "byService": {
    "offer": 10,
    "siterank": 16
  },
  "startDate": "2025-10-01T00:00:00Z",
  "endDate": "2025-10-31T23:59:59Z"
}
```

### 测试4: 验证数据库记录

```sql
-- 连接到数据库
psql $DATABASE_URL

-- 查看最近的 Token 交易
SELECT
  id,
  "userId",
  type,
  amount,
  service,
  "actionType",
  description,
  "createdAt"
FROM "TokenTransaction"
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
ORDER BY "createdAt" DESC
LIMIT 20;

-- 验证服务级别聚合
SELECT
  service,
  COUNT(*) as transaction_count,
  SUM(ABS(amount)) as total_consumed
FROM "TokenTransaction"
WHERE type IN ('consume', 'reserve')
  AND "createdAt" > NOW() - INTERVAL '1 day'
GROUP BY service
ORDER BY total_consumed DESC;
```

---

## 🔍 故障排查

### 问题1: db-migrator Job 失败

**症状**: `gcloud run jobs execute` 返回失败

**排查步骤**:
```bash
# 1. 查看最近的执行
gcloud run jobs executions list \
  --job=db-migrator-preview \
  --region=asia-northeast1 \
  --limit=5

# 2. 查看具体执行的详情
gcloud run jobs executions describe <execution-name> \
  --region=asia-northeast1 \
  --format=json

# 3. 查看日志
gcloud logging read \
  "resource.type=cloud_run_job AND resource.labels.job_name=db-migrator-preview" \
  --limit=100 \
  --format=json \
  | jq -r '.[] | select(.textPayload or .jsonPayload.message) | .textPayload // .jsonPayload.message'
```

**常见原因**:
1. 数据库连接失败 → 检查 VPC connector 配置
2. 权限不足 → 检查 Service Account 权限
3. SQL 语法错误 → 手动测试 SQL

**临时解决方案**: 使用方式B直接执行 SQL

### 问题2: 服务部署后 Token 扣费不工作

**排查步骤**:
```bash
# 1. 检查服务日志
gcloud run services logs read billing-preview \
  --region=asia-northeast1 \
  --limit=50

# 2. 测试 Token 余额查询
curl -X GET "${API_BASE}/api/v1/tokens/balance" \
  -H "Authorization: Bearer ${TEST_USER_TOKEN}"

# 3. 检查 service 字段是否传递
# 查看最近的交易记录
psql $DATABASE_URL -c "SELECT id, service, \"actionType\", amount FROM \"TokenTransaction\" ORDER BY \"createdAt\" DESC LIMIT 5;"
```

**常见原因**:
1. BillingClient 未初始化 → 检查 main.go
2. service 字段为空 → 检查 ConsumeTokensRequest
3. 数据库列不存在 → 重新运行迁移

### 问题3: Reserve-Commit 流程失败

**症状**: Siterank 查询成功但未扣费

**排查**:
```bash
# 查看 reserve 和 commit 记录
psql $DATABASE_URL -c "
SELECT
  id,
  type,
  amount,
  service,
  \"actionType\",
  metadata
FROM \"TokenTransaction\"
WHERE type IN ('reserve', 'commit', 'release')
  AND \"createdAt\" > NOW() - INTERVAL '10 minutes'
ORDER BY \"createdAt\" DESC;
"
```

---

## 📊 监控配置

### Prometheus 指标

待实现 (P1 任务):

```go
// services/billing/internal/metrics/token.go
var (
    TokenChargeTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "token_charge_total",
            Help: "Total number of token charges",
        },
        []string{"service", "action", "status"},
    )
)
```

### Cloud Monitoring 告警

待配置 (P1 任务):

```yaml
# Token 扣费失败率
- alert: HighTokenChargeFailureRate
  expr: rate(token_charge_total{status="error"}[5m]) > 0.01
  for: 5m
```

---

## 📝 回滚计划

如果部署后发现严重问题:

### 回滚步骤1: 回滚数据库迁移

```sql
-- 连接数据库
psql $DATABASE_URL

-- 执行回滚 (删除约束)
ALTER TABLE "TokenTransaction"
  DROP CONSTRAINT IF EXISTS chk_token_transaction_service_required;

-- 删除索引
DROP INDEX IF EXISTS idx_token_transaction_service_created;
DROP INDEX IF EXISTS idx_token_transaction_service_user;
DROP INDEX IF EXISTS idx_token_transaction_service;

-- 删除列 (⚠️ 数据丢失)
-- 仅在确认无需数据时执行
-- ALTER TABLE "TokenTransaction"
--   DROP COLUMN IF EXISTS "actionType",
--   DROP COLUMN IF EXISTS service;
```

### 回滚步骤2: 回滚服务部署

```bash
# 回滚到上一个版本
gcloud run services update-traffic billing-preview \
  --to-revisions=PREVIOUS=100 \
  --region=asia-northeast1

gcloud run services update-traffic offer-preview \
  --to-revisions=PREVIOUS=100 \
  --region=asia-northeast1

gcloud run services update-traffic siterank-preview \
  --to-revisions=PREVIOUS=100 \
  --region=asia-northeast1
```

---

## ✅ 成功标准

部署成功后,以下功能应正常工作:

1. **Token 扣费**:
   - ✅ Offer 创建扣费 10 tokens
   - ✅ Siterank 查询扣费 1/5/10 tokens
   - ✅ 余额不足返回 402

2. **Token 报表**:
   - ✅ `/api/v1/tokens/{userId}/usage` 返回真实数据
   - ✅ `byService` 包含 "offer", "siterank" 等
   - ✅ 数据准确性 100%

3. **数据库**:
   - ✅ `TokenTransaction` 表有 `service`, `actionType` 列
   - ✅ 所有新记录的 `service` 字段非空
   - ✅ 索引创建成功,查询性能良好

---

## 📚 相关文档

- [Token 报表增强总结](./Token_Report_Enhancement_Summary_CN.md)
- [服务集成指南](./Service_Token_Integration_Guide_CN.md)
- [系统实现总结](./Token_System_Implementation_Summary_CN.md)
- [Monorepo 构建最佳实践](../monorepo-build-best-practices.md)
- [微服务架构审查](./MicroserviceArchitectureReview.md)

---

**下一步行动**:
1. 解决 db-migrator Job 失败问题
2. 或使用方式B手动执行迁移
3. 部署所有服务
4. 执行完整测试套件
