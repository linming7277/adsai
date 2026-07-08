# browser-exec 高并发优化部署总结

**部署日期**: 2025-10-02
**部署版本**: de231cc2
**部署状态**: 🟡 进行中

---

## 优化内容概览

### 1. 架构拆分 (API + Worker)

#### API 实例 (browser-exec-preview)

**配置变更**:
```yaml
之前:
  memory: 2Gi
  cpu: 2
  concurrency: 4
  ENABLE_QUEUE_WORKER: 未设置 (默认启动)

优化后:
  memory: 1Gi              # ↓ 降低 50%
  cpu: 1                   # ↓ 降低 50%
  concurrency: 10          # ↑ 提高 150%
  ENABLE_QUEUE_WORKER: 0   # ✅ 禁用 worker
  min-instances: 1
  max-instances: 5
  timeout: 60s
```

**职责**:
- ✅ 接收 HTTP 请求 (`/visit`, `/visit-queue`)
- ✅ 发布消息到 Pub/Sub
- ✅ 提供统计和健康检查接口
- ❌ 不处理浏览器任务

**预期性能**:
- 发布吞吐量: 50 请求/s = 3000 请求/分钟
- 成本节省: CPU 和内存各降低 50%

---

#### Worker 实例 (browser-exec-preview-worker) **[新增]**

**配置**:
```yaml
memory: 2Gi
cpu: 2
concurrency: 1                    # Worker 不接受 HTTP
ENABLE_QUEUE_WORKER: 1            # ✅ 启用 worker
BROWSER_MAX_CONCURRENCY: 10       # ↑ 从 4 提高到 10
BROWSER_MAX_CONTEXTS: 20          # ↑ 从 12 提高到 20
min-instances: 5                  # ↑ 从 1 提高到 5
max-instances: 20                 # ↑ 从 10 提高到 20
timeout: 600s                     # 10 分钟 (浏览器任务超时)
no-allow-unauthenticated: true    # ✅ 不对外开放
```

**职责**:
- ✅ 从 Pub/Sub 消费消息 (maxMessages=10)
- ✅ 执行浏览器访问任务
- ✅ 记录结果到日志
- ❌ 不接受 HTTP 请求

**并发能力**:
```
最小配置 (5 实例):
  5 × 10 maxMessages = 50 个同时处理
  5 × 10 BROWSER_MAX_CONCURRENCY = 50 个浏览器任务

最大配置 (20 实例):
  20 × 10 maxMessages = 200 个同时处理
  20 × 10 BROWSER_MAX_CONCURRENCY = 200 个浏览器任务
```

---

### 2. 代理池优化

#### 预热大小提升

```javascript
之前:
  WARMUP_POOL_SIZE: 20

优化后:
  WARMUP_POOL_SIZE: 200  // 10x 提升
```

**影响**:
- 支持 200 个并发任务使用不同代理
- 减少代理重用导致的 IP 被封风险
- 启动时预热耗时增加: ~10s → ~100s

#### 分配锁窗口缩短

```javascript
之前:
  LOCK_WINDOW: 10000ms  // 10 秒
  LOCK_EXPIRY: 10000ms

优化后:
  LOCK_WINDOW: 5000ms   // 5 秒
  LOCK_EXPIRY: 5000ms
```

**影响**:
- 代理分配速度提高 2x
- 高并发下代理可用性提升
- 代理池利用率: 50 个 / 10s → 100 个 / 10s

---

### 3. Pub/Sub ack/nack 逻辑修复

**问题**: 之前将 "URL 访问失败" 视为消息处理失败,导致无限重试

**修复**:
```javascript
// 修复前
if (result.success) {
  message.ack()
} else {
  message.nack()  // ❌ 错误: URL 失败导致消息重试
}

// 修复后
message.ack()  // ✅ 总是 ack (消息处理完成)
if (result.success) {
  stats.processed++
} else {
  stats.failed++  // 记录失败,但不重试
}
```

---

## 并发能力对比

### 理论吞吐量

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| **并发处理数** | 40 | 200 | **5x** |
| **吞吐量 (URL/分钟)** | 80 | 400 | **5x** |
| **发布速率 (请求/秒)** | 16 | 100 | **6.25x** |
| **代理池大小** | 20 | 200 | **10x** |

### 实际场景对比

#### 场景 1: 100 URL 批量访问

| 阶段 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 发布阶段 | ~5s | ~2s | 2.5x |
| 处理阶段 | ~90s | ~30s | 3x |
| **总耗时** | **95s** | **32s** | **3x** |

#### 场景 2: 1000 URL 批量访问

| 阶段 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 发布阶段 | ~50s | ~10s | 5x |
| 处理阶段 | ~750s | ~150s | 5x |
| **总耗时** | **800s (13.3分钟)** | **160s (2.7分钟)** | **5x** |

---

## 部署流程

### GitHub Actions 工作流

**Workflow**: `deploy-backend.yml`
**触发**: Push to `main` 分支
**Job**: `deploy-services`

```bash
# 1. 检测变更
- Detect changed services → browser-exec 变更

# 2. Cloud Build 构建镜像
- Build image: asia-northeast1-docker.pkg.dev/.../browser-exec:preview-de231cc2

# 3. 部署 API 实例
gcloud run deploy browser-exec-preview \
  --image=...
  --memory=1Gi --cpu=1 --concurrency=10 \
  --set-env-vars="ENABLE_QUEUE_WORKER=0,..."

# 4. 部署 Worker 实例 (新增)
gcloud run deploy browser-exec-preview-worker \
  --image=...
  --memory=2Gi --cpu=2 --concurrency=1 \
  --no-allow-unauthenticated \
  --set-env-vars="ENABLE_QUEUE_WORKER=1,BROWSER_MAX_CONCURRENCY=10,..."
```

### 部署验证清单

#### API 实例验证

```bash
# 1. 检查服务状态
gcloud run services describe browser-exec-preview \
  --region=asia-northeast1 \
  --format=json | jq '{
    memory: .spec.template.spec.containers[0].resources.limits.memory,
    cpu: .spec.template.spec.containers[0].resources.limits.cpu,
    concurrency: .spec.template.spec.containerConcurrency,
    minInstances: .spec.template.metadata.annotations["autoscaling.knative.dev/minScale"],
    maxInstances: .spec.template.metadata.annotations["autoscaling.knative.dev/maxScale"]
  }'

# 预期输出:
# {
#   "memory": "1Gi",
#   "cpu": "1",
#   "concurrency": 10,
#   "minInstances": "1",
#   "maxInstances": "5"
# }

# 2. 检查环境变量
gcloud run services describe browser-exec-preview \
  --format=json | jq '.spec.template.spec.containers[0].env[] | select(.name=="ENABLE_QUEUE_WORKER")'

# 预期输出:
# {
#   "name": "ENABLE_QUEUE_WORKER",
#   "value": "0"
# }

# 3. 测试 API 访问
curl -X POST https://browser-exec-preview-yt54xvsg5q-an.a.run.app/api/v1/browser/visit-queue \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://pboost.me/ZDO2Bdek","targetCountry":"US"}'

# 预期输出:
# {
#   "success": true,
#   "messageId": "...",
#   "status": "queued"
# }
```

#### Worker 实例验证

```bash
# 1. 检查 Worker 服务状态
gcloud run services describe browser-exec-preview-worker \
  --region=asia-northeast1 \
  --format=json | jq '{
    memory: .spec.template.spec.containers[0].resources.limits.memory,
    cpu: .spec.template.spec.containers[0].resources.limits.cpu,
    minInstances: .spec.template.metadata.annotations["autoscaling.knative.dev/minScale"],
    maxInstances: .spec.template.metadata.annotations["autoscaling.knative.dev/maxScale"]
  }'

# 预期输出:
# {
#   "memory": "2Gi",
#   "cpu": "2",
#   "minInstances": "5",
#   "maxInstances": "20"
# }

# 2. 检查 Worker 环境变量
gcloud run services describe browser-exec-preview-worker \
  --format=json | jq '.spec.template.spec.containers[0].env[] | select(.name | contains("QUEUE") or contains("CONCURRENCY"))'

# 预期输出:
# {
#   "name": "ENABLE_QUEUE_WORKER",
#   "value": "1"
# }
# {
#   "name": "BROWSER_MAX_CONCURRENCY",
#   "value": "10"
# }

# 3. 查看 Worker 日志 (确认启动)
gcloud run services logs read browser-exec-preview-worker \
  --region=asia-northeast1 \
  --limit=20 | grep -E "Starting queue worker|Queue worker started|proxy-warmup"

# 预期日志:
# [pubsub] Starting queue worker...
# [proxy-warmup] Will warmup 200 proxies on startup
# [proxy-warmup] Fetched 200 proxies in ...ms
# [pubsub] Queue worker started
```

---

## 测试计划

### 测试 1: 基础功能验证

**目标**: 确认拆分架构正常工作

```bash
# 1. 发布 4 个测试 URL 到队列
node test-browser-exec-pubsub.js

# 预期:
# - 发布成功: 4/4
# - 发布耗时: <5s
# - 消息处理: 4/4 (在 60s 内完成)
```

### 测试 2: 并发能力测试

**目标**: 验证 200 并发处理能力

```bash
# 创建 100 URL 批量测试
node test-100-urls.js

# 预期:
# - 发布耗时: <10s
# - 处理完成: 100/100
# - 总耗时: <60s (vs 优化前 ~90s)
```

### 测试 3: 代理池压力测试

**目标**: 验证 200 代理池在高并发下的表现

```bash
# 查看代理预热日志
gcloud run services logs read browser-exec-preview-worker \
  --limit=50 | grep "proxy-warmup"

# 预期:
# [proxy-warmup] Will warmup 200 proxies on startup
# [proxy-warmup] Fetched 200 proxies in ~100s
# [proxy-warmup] Initialized health tracking for 200 proxies
```

---

## 监控指标

### 关键指标

| 指标 | 目标值 | 监控方式 |
|------|--------|---------|
| **API 实例数** | 1-5 | Cloud Run Metrics |
| **Worker 实例数** | 5-20 | Cloud Run Metrics |
| **队列长度** | <100 | Pub/Sub Metrics |
| **消息处理延迟** | <60s | Pub/Sub Metrics |
| **Worker CPU 利用率** | 60-80% | Cloud Monitoring |
| **Worker 内存利用率** | <85% | Cloud Monitoring |
| **代理成功率** | >70% | 服务日志 |

### 告警配置 (待添加)

```yaml
# Cloud Monitoring 告警
alerts:
  - name: "Pub/Sub 队列堆积"
    condition: pubsub_queue_length > 500
    duration: 5m

  - name: "Worker 实例不足"
    condition: worker_instances < 3
    duration: 3m

  - name: "消息处理延迟过高"
    condition: message_processing_time_p95 > 120s
    duration: 10m
```

---

## 成本估算

### 优化前成本

```
10 实例 × 2Gi × 2CPU × 24h × 30天
= $300-400/月
```

### 优化后成本

```
API 实例 (平均 2 实例):
  2 × 1Gi × 1CPU = ~$50/月

Worker 实例 (平均 8 实例):
  8 × 2Gi × 2CPU = ~$450/月

总计: ~$500/月
```

### 成本效益分析

| 指标 | 优化前 | 优化后 | 变化 |
|------|--------|--------|------|
| 成本 | $350/月 | $500/月 | +43% |
| 吞吐量 | 80 URL/分钟 | 400 URL/分钟 | +400% |
| **性价比** | 0.23 URL/分钟/$ | **0.80 URL/分钟/$** | **+248%** |

---

## 回滚计划

### 如果出现问题

```bash
# 1. 回滚到之前的版本
git revert de231cc2
git push

# 或手动回滚 Cloud Run
gcloud run services update-traffic browser-exec-preview \
  --to-revisions=browser-exec-preview-00045=100 \
  --region=asia-northeast1

# 2. 删除 Worker 实例 (如果有问题)
gcloud run services delete browser-exec-preview-worker \
  --region=asia-northeast1
```

### 回滚触发条件

- ❌ Worker 实例启动失败
- ❌ 队列消息无法被处理
- ❌ 错误率 > 20%
- ❌ P95 延迟 > 120s

---

## 下一步优化 (未来)

### 短期 (2-3 周)

1. **多代理服务商支持**
   - 添加备用代理 API
   - 自动故障转移

2. **处理时间优化**
   - 优化 Pattern Library
   - 减少冗余等待: 29.83s → 25s

### 中期 (1-2 月)

1. **结果存储**
   - 将访问结果存储到 Firestore
   - 提供结果查询 API

2. **弹性扩展优化**
   - 配置更激进的 scale-down
   - 使用爆发实例处理峰值

### 长期 (3-6 月)

1. **完全解耦架构**
   - 独立 Worker 服务
   - 更灵活的扩展策略

2. **智能调度**
   - 基于 URL 类型的优先级队列
   - 动态调整 Worker 配置

---

**部署负责人**: Claude Code
**部署时间**: 2025-10-02 12:07:07 UTC
**GitHub Actions**: https://github.com/xxrenzhe/autoads/actions/runs/18192443403
**状态**: 🟡 部署中
