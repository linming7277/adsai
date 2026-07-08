# 快速开始 - Siterank优化部署

**目标**: 将优化后的siterank服务部署到preview环境  
**预计时间**: 10-15分钟  
**前置条件**: 代码已提交到本地Git仓库

---

## 🚀 立即执行（3步）

### 步骤1: 提交代码到main分支

```bash
# 1. 检查当前状态
git status

# 2. 添加所有变更
git add services/siterank/internal/browserexec/client.go
git add services/siterank/internal/similarweb/client.go
git add services/siterank/internal/similarweb/cache.go
git add docs/ArchitectureReviewV1/
git add scripts/

# 3. 提交代码
git commit -m "feat(siterank): add retry mechanisms and smart error caching

- Add Browser-exec retry mechanism (3 retries with exponential backoff)
- Add SimilarWeb API retry mechanism (3 retries with exponential backoff)
- Implement smart error caching strategy (404:24h, 5xx:5min, timeout:10min)
- Expected: +5-10% evaluation success rate, reliability score 78→85

Refs: docs/ArchitectureReviewV1/optimization-execution-report.md"

# 4. 推送到main分支（触发preview部署）
git push origin main
```

### 步骤2: 监控GitHub Actions

```bash
# 访问GitHub Actions页面
# https://github.com/linming7277/adsai/actions

# 预期流程（5-10分钟）:
# ✅ detect-changed-services.sh 检测到siterank变更
# ✅ 创建优化的tarball (13MB)
# ✅ 提交到Cloud Build
# ✅ 构建Docker镜像
# ✅ 推送到Artifact Registry
# ✅ 部署到Cloud Run (siterank-preview)
```

### 步骤3: 验证部署成功

```bash
# 检查服务状态
gcloud run services describe siterank-preview \
  --region=asia-northeast1 \
  --project=your-gcp-project-id \
  --format="table(status.url,status.conditions[0].status)"

# 检查健康状态
SERVICE_URL=$(gcloud run services describe siterank-preview \
  --region=asia-northeast1 \
  --project=your-gcp-project-id \
  --format='value(status.url)')

curl -f $SERVICE_URL/health && echo "✅ 服务健康" || echo "❌ 健康检查失败"
```

---

## ✅ 部署成功后

### 立即验证（5分钟）

```bash
# 1. 查看最新日志
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=siterank-preview" \
  --limit=20 \
  --format="table(timestamp,textPayload)" \
  --project=your-gcp-project-id

# 2. 触发一次评估任务（通过前端或API）
# 观察是否有重试日志
```

### 24小时内监控

**关键指标**:
- [ ] 评估成功率 >90%
- [ ] Browser-exec重试次数 平均<1次/请求
- [ ] SimilarWeb重试次数 平均<1次/请求
- [ ] 错误缓存命中率 >50%
- [ ] 评估延迟P95 <15秒

**监控方式**:
1. Prometheus metrics
2. Grafana仪表盘
3. Cloud Run日志
4. 用户反馈

---

## 🔄 如果需要回滚

```bash
# 回滚到上一个版本
gcloud run services update-traffic siterank-preview \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=asia-northeast1 \
  --project=your-gcp-project-id
```

---

## 📚 详细文档

- **完整部署计划**: [deployment-plan.md](./deployment-plan.md)
- **优化执行报告**: [optimization-execution-report.md](./optimization-execution-report.md)
- **总结报告**: [SUMMARY.md](./SUMMARY.md)

---

## 🎯 下一步（1-2天后）

如果preview环境稳定：

```bash
# 部署到production环境
git checkout production
git merge main
git push origin production

# 或者打tag
git tag -a v3.1.0 -m "Release v3.1.0: Add retry mechanisms"
git push origin v3.1.0
```

---

**快速开始版本**: v1.0  
**最后更新**: 2025-10-08  
**预计执行时间**: 10-15分钟

