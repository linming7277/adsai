# Siterank服务优化部署计划

**部署日期**: 2025-10-08  
**部署环境**: Preview → Production  
**部署服务**: siterank (包含P1和P2优化)  
**部署负责人**: Kiro AI Assistant

---

## 部署概述

本次部署将优化后的siterank服务部署到preview和production环境，包含以下优化：

1. ✅ Browser-exec调用重试机制（3次重试 + 指数退避）
2. ✅ SimilarWeb API调用重试机制（3次重试 + 指数退避）
3. ✅ 智能错误缓存策略（404:24h, 5xx:5min, timeout:10min）

**预期效果**:
- 系统可靠性评分: 78/100 → 85/100
- 评估成功率: 85-90% → 90-95%

---

## 部署前检查清单

### ✅ 代码质量验证

- [x] Go编译成功
- [x] 语法检查通过
- [x] 代码格式化完成
- [x] 所有优化已实施

### ✅ 配置验证

- [x] Dockerfile使用标准模板
- [x] Go版本对齐（golang:1.25）
- [x] ENV GOWORK=off已设置
- [x] 构建优化参数已配置

### 📋 环境准备

- [ ] GCP认证配置（使用secrets/gcp_codex_dev.json）
- [ ] Secret Manager访问权限验证
- [ ] Cloud Build权限验证
- [ ] Cloud Run部署权限验证

---

## 部署流程

### 阶段1: Preview环境部署（立即执行）

#### 1.1 准备工作

```bash
# 1. 确认当前分支
git branch

# 2. 确认代码已提交
git status

# 3. 获取最新代码
git pull origin main
```

#### 1.2 本地构建验证

```bash
# 验证siterank服务本地构建
cd services/siterank
go mod tidy
go build -o siterank-service .
rm siterank-service
cd ../..
```

#### 1.3 推送到main分支（触发preview部署）

```bash
# 1. 提交优化代码
git add services/siterank/internal/browserexec/client.go
git add services/siterank/internal/similarweb/client.go
git add services/siterank/internal/similarweb/cache.go
git add docs/ArchitectureReviewV1/
git add scripts/

git commit -m "feat(siterank): add retry mechanisms and smart error caching

- Add Browser-exec retry mechanism (3 retries with exponential backoff)
- Add SimilarWeb API retry mechanism (3 retries with exponential backoff)
- Implement smart error caching strategy (404:24h, 5xx:5min, timeout:10min)
- Expected: +5-10% evaluation success rate, reliability score 78→85

Refs: docs/ArchitectureReviewV1/optimization-execution-report.md"

# 2. 推送到main分支（触发preview部署）
git push origin main
```

#### 1.4 监控GitHub Actions

```bash
# 查看GitHub Actions状态
# 访问: https://github.com/xxrenzhe/autoads/actions

# 预期流程:
# 1. detect-changed-services.sh 检测到siterank变更
# 2. 创建优化的tarball (13MB)
# 3. 提交到Cloud Build
# 4. 构建Docker镜像
# 5. 推送到Artifact Registry
# 6. 部署到Cloud Run (siterank-preview)
```

#### 1.5 验证部署成功

```bash
# 1. 检查Cloud Run服务状态
gcloud run services describe siterank-preview \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873

# 2. 获取服务URL
gcloud run services describe siterank-preview \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873 \
  --format='value(status.url)'

# 3. 检查服务健康
curl -f $(gcloud run services describe siterank-preview \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873 \
  --format='value(status.url)')/health || echo "Health check failed"
```

---

### 阶段2: Preview环境功能验证（部署后24小时内）

#### 2.1 功能测试

**测试场景1: 基础评估（验证Browser-exec重试）**

```bash
# 触发评估任务
# 预期: 如果Browser-exec首次失败，应自动重试最多3次
```

**测试场景2: SimilarWeb数据获取（验证API重试）**

```bash
# 触发包含SimilarWeb的评估
# 预期: 如果API首次失败，应自动重试最多3次
```

**测试场景3: 错误缓存（验证智能TTL）**

```bash
# 触发404错误的域名评估
# 预期: 错误缓存24小时

# 触发5xx错误的域名评估
# 预期: 错误缓存5分钟

# 触发超时错误的域名评估
# 预期: 错误缓存10分钟
```

#### 2.2 监控指标

**Prometheus指标监控**:

```bash
# 1. 评估成功率
# Metric: siterank_evaluation_success_rate
# 目标: >90%

# 2. Browser-exec重试次数
# Metric: browser_exec_retry_count
# 目标: 平均<1次/请求

# 3. SimilarWeb重试次数
# Metric: similarweb_retry_count
# 目标: 平均<1次/请求

# 4. 错误缓存命中率
# Metric: similarweb_error_cache_hit_rate
# 目标: >50%

# 5. 评估延迟P95
# Metric: siterank_evaluation_duration_p95
# 目标: <15秒
```

**Grafana仪表盘**:
- 访问Grafana仪表盘
- 查看AI评估专用仪表盘
- 对比优化前后的指标变化

#### 2.3 日志分析

```bash
# 查看Cloud Run日志
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=siterank-preview" \
  --limit=100 \
  --format=json \
  --project=gen-lang-client-0944935873

# 搜索重试相关日志
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=siterank-preview AND textPayload=~'retry'" \
  --limit=50 \
  --project=gen-lang-client-0944935873
```

#### 2.4 性能对比

| 指标 | 优化前（预期） | 优化后（实际） | 达标 |
|------|---------------|---------------|------|
| 评估成功率 | 85-90% | _待测量_ | [ ] |
| Browser-exec重试 | 0次 | _待测量_ | [ ] |
| SimilarWeb重试 | 0次 | _待测量_ | [ ] |
| 错误缓存命中率 | N/A | _待测量_ | [ ] |
| 评估延迟P95 | _待测量_ | _待测量_ | [ ] |

---

### 阶段3: Production环境部署（Preview稳定后1-2天）

#### 3.1 部署前决策

**部署条件**（所有条件必须满足）:

- [ ] Preview环境运行稳定24小时以上
- [ ] 评估成功率提升验证（+5-10%）
- [ ] 无严重错误或性能问题
- [ ] 监控指标达标
- [ ] 团队评审通过

#### 3.2 部署到Production

**方式1: 通过production分支**

```bash
# 1. 切换到production分支
git checkout production

# 2. 合并main分支
git merge main

# 3. 推送到production分支（触发生产部署）
git push origin production
```

**方式2: 通过Git Tag**

```bash
# 1. 在main分支打tag
git checkout main
git tag -a v3.1.0 -m "Release v3.1.0: Add retry mechanisms and smart error caching

Features:
- Browser-exec retry mechanism (3 retries with exponential backoff)
- SimilarWeb API retry mechanism (3 retries with exponential backoff)
- Smart error caching strategy (404:24h, 5xx:5min, timeout:10min)

Performance:
- Evaluation success rate: +5-10%
- System reliability score: 78→85

Refs: docs/ArchitectureReviewV1/optimization-execution-report.md"

# 2. 推送tag（触发生产部署）
git push origin v3.1.0
```

#### 3.3 验证生产部署

```bash
# 1. 检查Cloud Run服务状态
gcloud run services describe siterank \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873

# 2. 获取服务URL
gcloud run services describe siterank \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873 \
  --format='value(status.url)'

# 3. 检查服务健康
curl -f $(gcloud run services describe siterank \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873 \
  --format='value(status.url)')/health || echo "Health check failed"
```

#### 3.4 生产环境监控

**持续监控（7天）**:
- 每天检查评估成功率
- 每天检查重试次数统计
- 每天检查错误缓存命中率
- 每天检查P95延迟
- 每天检查错误日志

---

## 回滚计划

### 触发回滚条件

如果出现以下任一情况，立即回滚：

1. ❌ 评估成功率下降超过5%
2. ❌ P95延迟超过20秒
3. ❌ 出现严重错误或服务不可用
4. ❌ 用户投诉增加

### 回滚步骤

**Preview环境回滚**:

```bash
# 方式1: 回滚到上一个版本
gcloud run services update-traffic siterank-preview \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873

# 方式2: 部署旧镜像
gcloud run deploy siterank-preview \
  --image=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/siterank:preview-{OLD_COMMIT_SHA} \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873
```

**Production环境回滚**:

```bash
# 方式1: 回滚到上一个版本
gcloud run services update-traffic siterank \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873

# 方式2: 部署旧镜像
gcloud run deploy siterank \
  --image=asia-northeast1-docker.pkg.dev/gen-lang-client-0944935873/autoads-services/siterank:prod-{OLD_TAG} \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873
```

---

## 风险评估

### 低风险 ✅

1. **重试机制**: 采用保守策略（最多3次），不会造成过度负载
2. **指数退避**: 避免雪崩效应
3. **错误缓存**: 智能TTL策略，不会影响正常请求
4. **向后兼容**: 所有API接口保持不变

### 中风险 ⚠️

1. **延迟增加**: 最坏情况下，延迟可能增加7秒（1+2+4秒）
   - **缓解**: 只对可重试错误进行重试
   - **监控**: P95延迟目标<15秒

2. **API调用成本**: 重试可能增加API调用次数
   - **缓解**: 智能判断可重试错误，避免无效重试
   - **监控**: API调用成本统计

### 高风险 ❌

无

---

## 成功标准

### 部署成功标准

- [x] 代码编译成功
- [x] 语法检查通过
- [ ] GitHub Actions部署成功
- [ ] Cloud Run服务健康
- [ ] 健康检查通过

### 优化效果验证标准

- [ ] 评估成功率提升5-10%
- [ ] 系统可靠性评分达到85/100
- [ ] P95延迟<15秒
- [ ] 无严重错误或性能问题
- [ ] 用户反馈正面

---

## 时间表

| 阶段 | 时间 | 任务 | 负责人 |
|------|------|------|--------|
| **阶段1** | Day 1 | Preview环境部署 | Kiro AI |
| **阶段2** | Day 1-2 | Preview环境验证 | Kiro AI + 团队 |
| **决策点** | Day 2 | 评审部署到生产 | 团队 |
| **阶段3** | Day 3 | Production环境部署 | Kiro AI |
| **监控** | Day 3-10 | 生产环境持续监控 | 团队 |

---

## 联系方式

**技术支持**:
- 部署问题: 查看GitHub Actions日志
- 运行问题: 查看Cloud Run日志
- 监控问题: 查看Grafana仪表盘

**文档参考**:
- 评估报告: `docs/ArchitectureReviewV1/offer-evaluation-ai-assessment-final.md`
- 执行报告: `docs/ArchitectureReviewV1/optimization-execution-report.md`
- CI/CD流程: `docs/SupabaseGo/MustKnowV6.md`
- 构建最佳实践: `docs/monorepo-build-best-practices.md`

---

**部署计划版本**: v1.0  
**最后更新**: 2025-10-08  
**状态**: ✅ 准备就绪，等待执行

