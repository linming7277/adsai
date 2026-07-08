# AI评估v2.1功能部署Runbook

**版本**: v2.1
**创建日期**: 2025-10-05
**负责人**: DevOps Team
**预估时间**: 60分钟

## 概述

本Runbook描述AI评估v2.1功能的完整部署流程，包括数据库迁移、服务部署、前端更新、监控配置和验证测试。

### v2.1新增功能

1. **数据库字段扩展** - 5个新AI评估维度
   - `ai_product_type` - 产品类型分类
   - `ai_estimated_aov` - 预估客单价
   - `ai_search_insights` - 搜索流量洞察（JSONB）
   - `ai_geo_insights` - 地理分布洞察（JSONB）
   - `ai_risk_assessment` - 风险评估（JSONB）

2. **Gemini API成本监控** - Prometheus metrics
   - `siterank_gemini_input_tokens` - 输入token直方图
   - `siterank_gemini_output_tokens` - 输出token直方图
   - `siterank_gemini_api_cost_usd` - API成本（美元）

3. **性能优化**
   - SimilarWeb缓存预热服务
   - API速率限制中间件

4. **测试覆盖**
   - 16个单元测试（缓存+限流）
   - 端到端集成测试

---

## 前置检查

### 环境要求

```bash
# 1. GCP认证
gcloud auth list
gcloud config get-value project  # 应为: your-gcp-project-id

# 2. 权限验证
gcloud projects get-iam-policy your-gcp-project-id \
  --flatten="bindings[].members" \
  --filter="bindings.members:user:$(gcloud config get-value account)" \
  --format="table(bindings.role)"

# 需要以下权限:
# - roles/cloudsql.admin (数据库迁移)
# - roles/run.admin (Cloud Run部署)
# - roles/cloudbuild.builds.editor (构建镜像)
# - roles/monitoring.metricWriter (Prometheus指标)

# 3. 工具安装检查
command -v psql || echo "⚠️ 需要安装postgresql-client"
command -v jq || echo "⚠️ 需要安装jq"
command -v gh || echo "⚠️ 需要安装gh (GitHub CLI)"

# 4. 获取Firebase Token（用于E2E测试）
echo "访问 https://preview.example.com"
echo "登录后在开发者工具中获取 idToken"
read -p "请输入Firebase Token: " FIREBASE_TOKEN
export FIREBASE_TOKEN
```

### 代码状态检查

```bash
cd /path/to/adsai

# 1. 确认所有代码已提交
git status

# 2. 确认在正确分支
git branch --show-current

# 3. 拉取最新代码
git pull origin main
```

---

## 部署步骤

### 第1步: 运行单元测试 (5分钟)

**目的**: 验证新代码的正确性

```bash
cd services/siterank

# 使用Cloud Build运行测试（避免本地权限问题）
gcloud builds submit \
  --config=test.cloudbuild.yaml \
  --project=your-gcp-project-id \
  .

# 预期输出:
# ✓ TestCachedClient_GetDomainData_CacheHit
# ✓ TestCachedClient_GetDomainData_CacheMiss
# ✓ TestCachedClient_ErrorCaching
# ... (16个测试全部通过)
# BUILD SUCCESS
```

**回滚**: 如果测试失败，停止部署，修复代码后重新测试

**验证点**:
- ✅ 所有测试通过
- ✅ 无编译错误
- ✅ 依赖项正确解析

---

### 第2步: 数据库迁移 - Staging环境 (10分钟)

**目的**: 在staging环境验证Schema变更

```bash
cd /path/to/adsai

# 执行交互式迁移脚本
bash scripts/deploy-db-migration.sh

# 脚本会提示以下步骤:
# 1. 备份当前Schema到GCS
# 2. 连接到Cloud SQL
# 3. 执行迁移SQL
# 4. 验证新字段

# 手动连接到数据库验证
gcloud sql connect adsai --user=postgres --database=adsai_db

# 在psql中执行验证
\i schemas/sql/020_ai_evaluation_v2_fields.sql

# 验证新字段已创建
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'offer_evaluations'
  AND column_name IN ('ai_product_type', 'ai_estimated_aov',
                       'ai_search_insights', 'ai_geo_insights',
                       'ai_risk_assessment')
ORDER BY column_name;

# 预期输出（5行）:
# ai_estimated_aov    | text  | YES
# ai_geo_insights     | jsonb | YES
# ai_product_type     | text  | YES
# ai_risk_assessment  | jsonb | YES
# ai_search_insights  | jsonb | YES

# 验证索引已创建
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'offer_evaluations'
  AND indexname LIKE '%insights%';

# 预期输出（3个GIN索引）:
# idx_offer_evaluations_search_insights | CREATE INDEX ... USING gin (ai_search_insights)
# idx_offer_evaluations_geo_insights    | CREATE INDEX ... USING gin (ai_geo_insights)
# idx_offer_evaluations_risk_assessment | CREATE INDEX ... USING gin (ai_risk_assessment)

\q
```

**回滚步骤**:
```bash
# 如果迁移失败，执行回滚
gcloud sql connect adsai --user=postgres --database=adsai_db
\i schemas/sql/020_ai_evaluation_v2_fields_rollback.sql

# 验证字段已删除
SELECT count(*) FROM information_schema.columns
WHERE table_name = 'offer_evaluations'
  AND column_name LIKE 'ai_%';
# 应为5（仅保留v2.0字段）
```

**验证点**:
- ✅ 5个新字段创建成功
- ✅ 3个GIN索引创建成功
- ✅ offer_evaluations_latest视图已更新
- ✅ 无约束冲突或数据丢失

---

### 第3步: 部署Siterank服务 - Preview环境 (15分钟)

**目的**: 部署包含v2.1代码的siterank服务

```bash
cd services/siterank

# 使用自动化部署脚本
bash deploy-preview.sh

# 脚本执行流程:
# 步骤 1/4: 运行单元测试 (与第1步重复验证)
# 步骤 2/4: 构建Docker镜像
#   - 镜像: asia-northeast1-docker.pkg.dev/.../siterank:preview-latest
#   - 标签: preview-{GIT_SHA}
# 步骤 3/4: 部署到Cloud Run
#   - 服务: siterank-preview
#   - 配置: 2GB内存, 2 CPU, 1-10实例
# 步骤 4/4: 验证部署
#   - 健康检查: GET /healthz (expect 200)
#   - Metrics验证: GET /metrics (检查gemini_*指标)

# 预期输出:
# ✅ 测试通过
# ✅ 镜像构建成功: asia-northeast1-docker.pkg.dev/.../siterank:preview-abc1234
# ✅ Cloud Run部署成功
# 服务URL: https://siterank-preview-yt54xvsg5q-an.a.run.app
# ✅ 健康检查通过 (HTTP 200)
# ✅ 新增Gemini成本监控指标已生效
```

**手动验证**:
```bash
# 获取服务URL
SERVICE_URL=$(gcloud run services describe siterank-preview \
  --region=asia-northeast1 \
  --project=your-gcp-project-id \
  --format='value(status.url)')

# 1. 健康检查
curl -s ${SERVICE_URL}/healthz | jq .
# 预期: {"status":"healthy","timestamp":"..."}

# 2. 验证Prometheus指标
curl -s ${SERVICE_URL}/metrics | grep -E "siterank_gemini"
# 预期输出（3个新指标）:
# siterank_gemini_input_tokens_bucket{...}
# siterank_gemini_output_tokens_bucket{...}
# siterank_gemini_api_cost_usd_bucket{...}

# 3. 检查服务日志
gcloud run services logs read siterank-preview \
  --region=asia-northeast1 \
  --limit=50 \
  --format=json | jq -r '.textPayload'
```

**回滚步骤**:
```bash
# 回滚到上一个稳定版本
PREVIOUS_REVISION=$(gcloud run revisions list \
  --service=siterank-preview \
  --region=asia-northeast1 \
  --format='value(name)' \
  --limit=2 | tail -n 1)

gcloud run services update-traffic siterank-preview \
  --region=asia-northeast1 \
  --to-revisions=${PREVIOUS_REVISION}=100

echo "已回滚到版本: ${PREVIOUS_REVISION}"
```

**验证点**:
- ✅ Docker镜像构建成功
- ✅ Cloud Run服务运行正常
- ✅ 健康检查通过（/healthz返回200）
- ✅ Gemini cost metrics可见
- ✅ 无启动错误或崩溃

---

### 第4步: 部署前端 - Firebase Hosting (10分钟)

**目的**: 更新前端TypeScript类型定义和UI组件

```bash
cd apps/frontend

# 1. 构建生产版本
npm run build

# 预期输出:
# ✓ built in 45s
# ✓ 123 modules transformed

# 2. 部署到Firebase Hosting (Preview)
firebase deploy --only hosting:preview

# 预期输出:
# ✔ Deploy complete!
# Project Console: https://console.firebase.google.com/project/...
# Hosting URL: https://preview.example.com

# 3. 验证类型定义
npm run type-check

# 预期: 无TypeScript错误
```

**验证点**:
- ✅ TypeScript编译无错误
- ✅ Firebase部署成功
- ✅ 前端可访问 (https://preview.example.com)
- ✅ 浏览器控制台无错误

**回滚步骤**:
```bash
# 查看部署历史
firebase hosting:releases:list

# 回滚到上一个版本
firebase hosting:rollback
```

---

### 第5步: 配置Grafana监控 (5分钟)

**目的**: 导入AI评估成本监控Dashboard

```bash
# 1. 导入Dashboard到Grafana
# 方法A: 通过Grafana UI
# - 访问 Grafana URL
# - 导航到 Create → Import
# - 上传文件: deployments/monitoring/grafana-dashboard-ai-evaluation.json

# 方法B: 通过API (需要Grafana API Key)
GRAFANA_URL="https://your-grafana-instance.com"
GRAFANA_API_KEY="your-api-key"

curl -X POST ${GRAFANA_URL}/api/dashboards/db \
  -H "Authorization: Bearer ${GRAFANA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @deployments/monitoring/grafana-dashboard-ai-evaluation.json

# 2. 验证Dashboard
echo "访问 ${GRAFANA_URL}/d/ai-evaluation-cost"
echo "检查以下Panel是否显示数据:"
echo "  - Gemini API成本趋势"
echo "  - Gemini Token使用量"
echo "  - AI评估请求速率"
echo "  - Token定价覆盖率"
```

**Dashboard包含的面板**:
1. Gemini API成本趋势 (USD)
2. Gemini Token使用量 (P50/P95)
3. AI评估请求速率 (成功/失败)
4. AI评估推荐指数分布 (Heatmap)
5. Token定价覆盖率 (Singlestat)
6. Gemini API延迟 (P50/P95/P99)
7. SimilarWeb缓存命中率
8. Token计费状态 (预扣/确认/退款)

**验证点**:
- ✅ Dashboard导入成功
- ✅ 所有面板加载无错误
- ✅ Prometheus数据源连接正常
- ✅ 至少1个Panel显示数据（如果已有AI评估请求）

---

### 第6步: 端到端测试 (15分钟)

**目的**: 验证v2.1字段完整性和业务流程

```bash
cd scripts/tests

# 确保FIREBASE_TOKEN已设置
echo "FIREBASE_TOKEN: ${FIREBASE_TOKEN:0:20}..."

# 执行E2E测试
bash test-ai-evaluation-e2e.sh

# 测试流程:
# 步骤 1/5: 创建测试Offer (nike.com)
# 步骤 2/5: 发起AI评估 (includeAI=true)
# 步骤 3/5: 等待评估完成 (轮询最多2分钟)
# 步骤 4/5: 获取评估结果
# 步骤 5/5: 验证v2.1新增字段

# 预期输出:
# ✅ Offer创建成功: off_abc123
# ✅ 评估任务创建成功: eval_xyz789
# ✅ 评估完成
#
# 字段验证结果
# =========================================
# aiProductType:     ✅ 存在
# aiEstimatedAOV:    ✅ 存在
# aiSearchInsights:  ✅ 存在
# aiGeoInsights:     ✅ 存在
# aiRiskAssessment:  ✅ 存在
#
# 关键数据提取:
#   推荐指数: 78
#   产品类型: Physical
#   预估AOV: $50-$150
#   品牌词占比: High (85%+)
#   主要市场: ["US", "CA", "GB"]
#   政策合规: compliant
#
# =========================================
# ✅ 测试通过 (5/5 字段)
```

**手动测试步骤** (如果脚本失败):
```bash
# 1. 登录preview.example.com
open "https://preview.example.com/en/auth/sign-in"

# 2. 创建新Offer
# URL: https://nike.com
# Country: US

# 3. 点击 "AI评估" 按钮

# 4. 检查评估结果Card
# 验证以下字段显示:
# - 推荐指数 (1-100)
# - 产品类型 (Physical/Digital/Service)
# - 预估AOV
# - 搜索洞察 (品牌词占比/搜索意图)
# - 地理洞察 (主要市场/集中度)
# - 风险评估 (合规状态/风险等级)

# 5. 检查浏览器控制台
# 应无TypeScript类型错误
```

**验证点**:
- ✅ API能创建Offer
- ✅ AI评估请求成功（返回evaluationID）
- ✅ 评估在2分钟内完成
- ✅ 5个v2.1字段全部返回
- ✅ 数据格式符合TypeScript类型定义
- ✅ 无服务器错误或超时

---

### 第7步: 监控验证 (5分钟)

**目的**: 确认监控和告警正常工作

```bash
# 1. 检查Prometheus metrics是否采集
SERVICE_URL=$(gcloud run services describe siterank-preview \
  --region=asia-northeast1 \
  --format='value(status.url)')

curl -s ${SERVICE_URL}/metrics | grep -E "siterank_gemini" | head -20

# 预期: 显示histogram buckets和counts

# 2. 在Grafana中验证
echo "访问 Grafana Dashboard"
echo "1. 检查 'Gemini API成本趋势' 面板是否有数据点"
echo "2. 检查 'Token定价覆盖率' 是否计算正确"
echo "3. 确认 'AI评估请求速率' 显示最近的评估"

# 3. 验证成本计算准确性
# 从E2E测试结果中提取token数量
# Input tokens: ~2000, Output tokens: ~500
# 预期成本: (2000 * $0.075 / 1M) + (500 * $0.30 / 1M) = $0.00030
echo "检查Grafana中的实际成本是否接近预期"

# 4. 检查告警规则（如果已配置）
gcloud alpha monitoring policies list \
  --project=your-gcp-project-id \
  --filter='displayName:siterank'

# 应包含:
# - High Gemini API Cost Alert (每小时>$1)
# - AI Evaluation Failure Rate (>10%)
```

**验证点**:
- ✅ Prometheus指标正常采集
- ✅ Grafana Dashboard显示实时数据
- ✅ 成本计算准确（误差<5%）
- ✅ 告警规则配置正确（如适用）

---

## 部署完成清单

```
☐ 第1步: 单元测试通过 (16/16)
☐ 第2步: 数据库迁移成功 (5字段+3索引)
☐ 第3步: Siterank服务部署正常 (健康检查200)
☐ 第4步: 前端部署成功 (类型检查通过)
☐ 第5步: Grafana Dashboard导入 (8个面板)
☐ 第6步: E2E测试通过 (5/5字段验证)
☐ 第7步: 监控验证正常 (metrics可见)
```

---

## 回滚决策树

```
                    ┌─────────────────┐
                    │ 部署失败或BUG   │
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
                │ 问题出现在哪个阶段？    │
                └────────────┬────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
    ┌───▼────┐         ┌────▼─────┐        ┌────▼─────┐
    │数据库  │         │后端服务  │        │前端部署  │
    └───┬────┘         └────┬─────┘        └────┬─────┘
        │                   │                   │
    执行回滚SQL       回滚Cloud Run版本    Firebase rollback
    (rollback.sql)    (--to-revisions)    (hosting:rollback)
        │                   │                   │
    验证字段删除       验证服务恢复          验证UI恢复
```

### 快速回滚命令

```bash
# 数据库回滚
gcloud sql connect adsai --user=postgres --database=adsai_db
\i schemas/sql/020_ai_evaluation_v2_fields_rollback.sql

# 后端服务回滚
PREV=$(gcloud run revisions list --service=siterank-preview \
  --region=asia-northeast1 --format='value(name)' --limit=2 | tail -n1)
gcloud run services update-traffic siterank-preview \
  --region=asia-northeast1 --to-revisions=${PREV}=100

# 前端回滚
firebase hosting:rollback
```

---

## 故障排查

### 问题1: E2E测试显示 "Token不足"

**症状**:
```json
{"error": "INSUFFICIENT_TOKENS", "message": "需要3 tokens，余额不足"}
```

**解决方案**:
```bash
# 1. 检查用户token余额
curl -s "${API_GATEWAY_URL}/api/v1/users/me/tokens" \
  -H "Authorization: Bearer ${FIREBASE_TOKEN}" | jq .

# 2. 使用Admin权限增加测试账户余额
# 联系管理员或使用billing服务API充值
```

---

### 问题2: Grafana Dashboard显示 "No Data"

**症状**: 所有Panel显示空白或 "No data"

**解决方案**:
```bash
# 1. 验证Prometheus是否采集到metrics
curl -s ${SERVICE_URL}/metrics | grep siterank_gemini
# 如果无输出 → 尚未有AI评估请求，执行E2E测试触发

# 2. 检查Prometheus数据源配置
# Grafana → Configuration → Data Sources → Prometheus
# 验证URL和认证正确

# 3. 检查时间范围
# Dashboard右上角时间选择器 → 选择 "Last 1 hour"
```

---

### 问题3: AI评估返回 "aiProductType": null

**症状**: 新字段返回null或不存在

**排查步骤**:
```bash
# 1. 验证数据库Schema
gcloud sql connect adsai --user=postgres --database=adsai_db
SELECT column_name FROM information_schema.columns
WHERE table_name = 'offer_evaluations'
  AND column_name = 'ai_product_type';
# 如果无结果 → 数据库迁移未执行

# 2. 检查siterank服务版本
gcloud run revisions describe ${REVISION_NAME} \
  --region=asia-northeast1 \
  --format='value(metadata.labels.commit-sha)'
# 验证commit SHA是否包含v2.1代码

# 3. 查看服务日志
gcloud run services logs read siterank-preview \
  --region=asia-northeast1 \
  --filter='textPayload=~"ai_product_type"' \
  --limit=20
# 检查是否有SQL错误或JSON marshaling错误
```

---

### 问题4: 部署后CPU使用率异常高

**症状**: Cloud Run CPU使用率>80%持续

**排查步骤**:
```bash
# 1. 检查并发请求数
gcloud run services describe siterank-preview \
  --region=asia-northeast1 \
  --format='value(spec.template.spec.containerConcurrency)'
# 当前设置: 80

# 2. 查看请求延迟
curl -s ${SERVICE_URL}/metrics | grep siterank_gemini_api_latency
# 检查P99延迟是否>10s

# 3. 临时扩容
gcloud run services update siterank-preview \
  --region=asia-northeast1 \
  --cpu=4 \
  --memory=4Gi \
  --max-instances=20
```

---

## 性能基准

部署完成后，以下指标应符合预期：

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| AI评估延迟（P95） | <5秒 | Grafana "Gemini API延迟" 面板 |
| 单次评估成本（P95） | <$0.001 | Grafana "Token定价覆盖率" 面板 |
| SimilarWeb缓存命中率 | >70% | Grafana "SimilarWeb缓存命中率" 面板 |
| API成功率 | >99% | Grafana "AI评估请求速率" 面板 |
| 健康检查延迟 | <100ms | `curl -w "%{time_total}" ${SERVICE_URL}/healthz` |
| 数据库查询延迟 | <50ms | Cloud SQL Insights |

---

## 联系人

- **数据库管理**: DBA Team
- **Cloud Run部署**: DevOps Team
- **前端部署**: Frontend Team
- **监控告警**: SRE Team
- **紧急联系**: On-call Engineer (PagerDuty)

---

## 附录A: 手动SQL验证查询

```sql
-- 验证v2.1字段数据完整性
SELECT
  id,
  domain,
  evaluation_type,
  ai_recommendation_score,

  -- v2.1新增字段
  ai_product_type,
  LENGTH(ai_estimated_aov) as aov_length,
  jsonb_typeof(ai_search_insights) as search_type,
  jsonb_typeof(ai_geo_insights) as geo_type,
  jsonb_typeof(ai_risk_assessment) as risk_type,

  completed_at
FROM offer_evaluations
WHERE evaluation_type = 'ai'
  AND completed_at > NOW() - INTERVAL '1 hour'
ORDER BY completed_at DESC
LIMIT 10;

-- 预期结果:
-- ai_product_type: Physical/Digital/Service/Hybrid
-- aov_length: >0
-- search_type: object
-- geo_type: object
-- risk_type: object
```

---

## 附录B: Prometheus查询示例

```promql
# 每小时Gemini成本
sum(rate(siterank_gemini_api_cost_usd_sum[5m])) * 3600

# 每日成本预估
sum(rate(siterank_gemini_api_cost_usd_sum[1h])) * 86400

# P95 Token使用量
histogram_quantile(0.95, siterank_gemini_input_tokens_bucket)

# Token定价覆盖率（3 tokens是否够）
(histogram_quantile(0.95, siterank_gemini_api_cost_usd_bucket) * 1000000) / 3

# AI评估成功率
sum(rate(siterank_evaluation_requests_total{type="ai",status="success"}[5m]))
/
sum(rate(siterank_evaluation_requests_total{type="ai"}[5m])) * 100
```

---

## 版本历史

| 版本 | 日期 | 变更内容 | 负责人 |
|------|------|----------|--------|
| v2.1 | 2025-10-05 | 初始版本：新增5个AI字段+Gemini成本监控 | Claude |

---

**完成标志**: 当所有验证点通过且E2E测试成功时，部署视为完成。
