# Siterank Worker 部署行动计划

**创建时间**: 2025-10-06
**状态**: ⏳ 待执行
**优先级**: P0 (本周完成)

---

## 一、当前状态

### 1.1 已完成工作 ✅

1. **Worker 模式代码实现** (services/siterank/main.go:1484-1506)
   ```go
   if os.Getenv("SITERANK_WORKER_MODE") == "subscriber" {
       log.Println("Starting in Pub/Sub subscriber worker mode...")
       // HTTP server for health checks
       go func() {
           if err := http.ListenAndServe(":"+port, r); err != nil {
               log.Fatalf("Failed to start HTTP server: %v", err)
           }
       }()

       // Pub/Sub subscriber
       ctx := context.Background()
       subscriber, err := ev.NewSubscriber(ctx, server.handleSiterankRequestedEvent)
       if err != nil {
           log.Fatalf("Failed to create subscriber: %v", err)
       }
       defer subscriber.Close()

       log.Println("Pub/Sub subscriber started, listening for EventSiterankRequested...")
       if err := subscriber.Start(ctx); err != nil {
           log.Fatalf("Subscriber error: %v", err)
       }
       return
   }
   ```

2. **Pub/Sub 订阅创建**
   ```bash
   Subscription: siterank-worker-sub-preview
   Topic: domain-events-preview
   Ack Deadline: 600s
   Retention: 7d
   Max Delivery Attempts: 5
   Dead Letter: browser-visit-dlq
   Message Ordering: Enabled
   ```

3. **Cloud Run 服务创建**
   ```bash
   Service: siterank-worker-preview
   Region: asia-northeast1
   URL: https://siterank-worker-preview-yt54xvsg5q-an.a.run.app
   Revision: siterank-worker-preview-00002-9x6
   ```

4. **环境变量配置** ✅
   ```yaml
   SITERANK_WORKER_MODE: subscriber
   PUBSUB_SUBSCRIPTION_ID: siterank-worker-sub-preview
   PUBSUB_TOPIC_ID: domain-events-preview
   GOOGLE_CLOUD_PROJECT: gen-lang-client-0944935873
   DATABASE_URL: (from secret)
   REDIS_URL: (from secret)
   BROWSER_EXEC_URL: https://browser-exec-preview-885pd7lz.a.run.app
   ```

### 1.2 问题诊断 ⚠️

**症状**:
```bash
# 当前日志
2025/10/05 17:08:05 Starting Siterank service...
2025/10/05 17:08:05 Database connection successful.
2025/10/05 17:08:05 Listening on port 8080

# 预期日志
2025/10/05 17:08:05 Starting Siterank service...
2025/10/05 17:08:05 Database connection successful.
2025/10/05 17:08:05 Starting in Pub/Sub subscriber worker mode...
2025/10/05 17:08:05 Pub/Sub subscriber started, listening for EventSiterankRequested...
```

**根因分析**:
1. **环境变量检查通过**: `SITERANK_WORKER_MODE=subscriber` 已正确配置
2. **代码检查通过**: Worker 模式代码存在于 commit 93430b6e
3. **问题定位**: 部署的镜像可能是旧版本,不包含 worker 模式代码

**证据**:
```bash
# 当前部署镜像
Image: asia-northeast1-docker.pkg.dev/.../siterank@sha256:af7b7156...
Creation Time: 2025-10-05T17:31:34Z

# 代码提交时间
Commit: 93430b6e (包含 worker 模式代码)
Date: 2025-10-05 (具体时间待确认)
```

---

## 二、解决方案

### 2.1 方案A: 触发 GitHub Actions 重新构建 (推荐)

**优势**:
- 使用标准化 CI/CD 流程
- 自动应用所有构建优化和安全检查
- 镜像标签规范 (preview-{sha})

**步骤**:
```bash
# 1. 创建空提交触发构建
git commit --allow-empty -m "chore: trigger siterank rebuild for worker mode"
git push origin main

# 2. 监控 GitHub Actions
gh run list --workflow="Deploy Backend (Cloud Build → Cloud Run)" --limit 1

# 3. 等待 siterank 构建完成
gh run watch <run-id>

# 4. 部署到 siterank-worker-preview
gcloud run services update siterank-worker-preview \
  --region=asia-northeast1 \
  --image=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/siterank:preview-<new-sha>
```

**预计耗时**: 10-15 分钟

### 2.2 方案B: 直接使用现有 siterank-preview 镜像

**假设**: 如果 siterank-preview 服务已使用包含 worker 代码的镜像

**步骤**:
```bash
# 1. 获取 siterank-preview 当前镜像
SITERANK_IMAGE=$(gcloud run services describe siterank-preview \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].image)")

# 2. 更新 siterank-worker-preview 使用相同镜像
gcloud run services update siterank-worker-preview \
  --region=asia-northeast1 \
  --image=$SITERANK_IMAGE

# 3. 验证日志
gcloud run services logs read siterank-worker-preview \
  --region=asia-northeast1 \
  --limit=20 | grep "subscriber worker mode"
```

**预计耗时**: 5 分钟

### 2.3 方案C: 本地构建并推送 (最快但不推荐)

**优势**: 最快解决问题
**劣势**: 绕过 CI/CD,缺少安全检查

**步骤**:
```bash
# 1. 本地构建
cd services/siterank
docker build -t asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/siterank:manual-worker .

# 2. 推送镜像
docker push asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/siterank:manual-worker

# 3. 部署
gcloud run services update siterank-worker-preview \
  --region=asia-northeast1 \
  --image=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/siterank:manual-worker
```

**预计耗时**: 8-10 分钟 (取决于本地网络速度)

---

## 三、验证清单

部署完成后,按以下步骤验证:

### 3.1 日志验证
```bash
# 查看启动日志
gcloud run services logs read siterank-worker-preview \
  --region=asia-northeast1 \
  --limit=30

# 预期输出
✓ "Starting in Pub/Sub subscriber worker mode..."
✓ "Pub/Sub subscriber started, listening for EventSiterankRequested..."
```

### 3.2 Pub/Sub 订阅验证
```bash
# 检查订阅状态
gcloud pubsub subscriptions describe siterank-worker-sub-preview \
  --format="value(pushConfig.pushEndpoint,ackDeadlineSeconds)"

# 发布测试事件
gcloud pubsub topics publish domain-events-preview \
  --message='{"type":"EventSiterankRequested","data":{"offerId":"test-123","url":"https://example.com","country":"US"}}'

# 检查消息是否被消费
gcloud pubsub subscriptions pull siterank-worker-sub-preview \
  --limit=10 --auto-ack
# 预期: 没有消息 (已被 worker 消费)
```

### 3.3 Cloud Run 指标验证
```bash
# 查看实例数
gcloud run services describe siterank-worker-preview \
  --region=asia-northeast1 \
  --format="value(status.traffic[0].percent,spec.template.spec.containers[0].resources.limits)"

# 预期: 至少 1 个实例运行
```

### 3.4 功能端到端测试
```bash
# 1. 通过 offer API 创建 siterank 请求
curl -X POST https://autoads-gw-preview-885pd7lz.an.gateway.dev/api/v1/offer/siterank \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url":"https://example.com","country":"US","offerId":"test-offer-123"}'

# 2. 验证事件发布到 Pub/Sub
gcloud logging read "resource.type=pubsub_topic AND jsonPayload.type=EventSiterankRequested" \
  --limit=1 --format=json

# 3. 验证 worker 消费事件
gcloud run services logs read siterank-worker-preview \
  --region=asia-northeast1 \
  --limit=50 | grep "EventSiterankRequested"

# 4. 验证评分结果写入数据库
psql $DATABASE_URL -c "SELECT id, url, score, status FROM siterank_db.\"SiterankAnalysis\" ORDER BY created_at DESC LIMIT 5;"
```

---

## 四、回滚方案

如果部署后出现问题,按以下步骤回滚:

```bash
# 1. 回滚到上一个 revision
gcloud run services update-traffic siterank-worker-preview \
  --region=asia-northeast1 \
  --to-revisions=siterank-worker-preview-00001=100

# 2. 或者完全停止服务
gcloud run services delete siterank-worker-preview \
  --region=asia-northeast1

# 3. Pub/Sub 订阅暂停 (防止消息丢失)
gcloud pubsub subscriptions update siterank-worker-sub-preview \
  --ack-deadline=600
```

---

## 五、后续优化

部署成功后的优化任务:

1. **性能调优**
   - [ ] 调整 `--min-instances=1` 保持至少 1 个实例热启动
   - [ ] 监控 CPU/内存使用率,按需调整资源限制
   - [ ] 配置 `--max-instances=20` 支持高峰期扩展

2. **监控告警**
   - [ ] 配置 Cloud Monitoring 告警
     - Pub/Sub 消息积压 > 100
     - Worker 实例 CPU > 80%
     - 错误率 > 5%
   - [ ] 集成 Grafana 大盘展示关键指标

3. **生产环境部署**
   - [ ] 创建 `siterank-worker` 服务 (生产环境)
   - [ ] 创建 `siterank-worker-sub` 订阅 (生产环境)
   - [ ] 灰度发布: 先 10% 流量,验证无误后全量

4. **文档更新**
   - [ ] 更新 OptimizationPhase5Summary.md 补充部署结果
   - [ ] 更新 MustKnowV4.md 架构图 (API + Worker 模式)
   - [ ] 创建 Siterank Worker 运维手册

---

## 六、参考资料

- **代码位置**: `services/siterank/main.go:1484-1506`
- **部署配置**: `deployments/siterank/preview-worker-deploy.yaml`
- **架构文档**: `docs/MarkerkitGo/MicroserviceArchitectureReview.md` 第 2.3 节
- **优化总结**: `docs/MarkerkitGo/OptimizationPhase5Summary.md` 第 2.2 节

---

**执行人**: TBD
**预计完成时间**: 2025-10-06 (当天)
**风险等级**: 低 (有回滚方案)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
