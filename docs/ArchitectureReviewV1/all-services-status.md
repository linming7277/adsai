# Preview环境所有服务状态

**检查时间**: 2025-10-08  
**环境**: Preview (asia-northeast1)  
**总服务数**: 15

---

## 📊 服务状态总览

| # | 服务名 | 状态 | 最新Revision | 本次部署 |
|---|--------|------|-------------|---------|
| 1 | adscenter-preview | ✅ True | adscenter-preview-00030-gnz | ❌ 未更新 |
| 2 | batchopen-preview | ✅ True | batchopen-preview-00007-4cz | ❌ 未更新 |
| 3 | billing-preview | ✅ True | billing-preview-00017-hxj | ❌ 未更新 |
| 4 | browser-exec-preview | ✅ True | browser-exec-preview-00052-4dw | ❌ 未更新 |
| 5 | browser-exec-preview-worker | ✅ True | browser-exec-preview-worker-00017-4wl | ❌ 未更新 |
| 6 | console-preview | ✅ True | console-preview-00015-ckh | ❌ 未更新 |
| 7 | frontend-preview | ✅ True | frontend-preview-00156-mf7 | ❌ 未更新 |
| 8 | notifications-preview | ✅ True | notifications-preview-00011-pn8 | ❌ 未更新 |
| 9 | offer-preview | ✅ True | offer-preview-00023-dgp | ❌ 未更新 |
| 10 | **projector-preview** | ✅ True | **projector-preview-00003-rnh** | ✅ **已更新** |
| 11 | proxy-pool-manager-preview | ✅ True | proxy-pool-manager-preview-00002-5t6 | ❌ 未更新 |
| 12 | **proxy-pool-preview** | ✅ True | **proxy-pool-preview-00004-4pt** | ✅ **已更新** |
| 13 | recommendations-preview | ✅ True | recommendations-preview-00013-sth | ❌ 未更新 |
| 14 | **siterank-preview** | ✅ True | **siterank-preview-00047-5pp** | ✅ **已更新** |
| 15 | siterank-worker-preview | ✅ True | siterank-worker-preview-00003-xhv | ❌ 未更新 |

**总体状态**: ✅ 所有15个服务运行正常

---

## 🎯 本次部署更新的服务

### 1. siterank-preview ⭐ 主要优化

**Revision**: siterank-preview-00047-5pp  
**创建时间**: 2025-10-08T04:02:08  
**URL**: https://siterank-preview-yt54xvsg5q-an.a.run.app

**变更内容**:
- ✅ Browser-exec调用重试机制（3次重试 + 指数退避）
- ✅ SimilarWeb API调用重试机制（3次重试 + 指数退避）
- ✅ 智能错误缓存策略（404:24h, 5xx:5min, timeout:10min）
- ✅ 依赖版本更新

**影响**: 🎯 **主要优化** - 系统可靠性预期从78分提升至85分

---

### 2. proxy-pool-preview 📦 依赖更新

**Revision**: proxy-pool-preview-00004-4pt  
**创建时间**: 2025-10-08T04:02:13  
**URL**: https://proxy-pool-preview-yt54xvsg5q-an.a.run.app

**变更内容**:
- ✅ redis依赖升级（v9.7.0 → v9.14.0）
- ✅ 添加supabaseauth replace指令

**影响**: 📦 **依赖更新** - 低风险，无功能变更

---

### 3. projector-preview 📦 依赖更新

**Revision**: projector-preview-00003-rnh  
**创建时间**: 2025-10-08T04:02:06  
**URL**: https://projector-preview-yt54xvsg5q-an.a.run.app

**变更内容**:
- ✅ 依赖版本更新
- ✅ 添加supabaseauth replace指令

**影响**: 📦 **依赖更新** - 低风险，无功能变更

---

## 🔍 未更新的服务（12个）

这些服务在本次部署中未被触发，保持原有版本：

| 服务 | 最后更新时间 | 说明 |
|------|-------------|------|
| adscenter-preview | 较早 | 无代码变更 |
| batchopen-preview | 较早 | 无代码变更 |
| billing-preview | 较早 | 无代码变更 |
| browser-exec-preview | 较早 | 无代码变更 |
| browser-exec-preview-worker | 较早 | 无代码变更 |
| console-preview | 较早 | 无代码变更 |
| frontend-preview | 较早 | 无代码变更 |
| notifications-preview | 较早 | 无代码变更 |
| offer-preview | 较早 | 无代码变更 |
| proxy-pool-manager-preview | 较早 | 无代码变更 |
| recommendations-preview | 较早 | 无代码变更 |
| siterank-worker-preview | 较早 | 无代码变更 |

**状态**: ✅ 所有服务运行正常，无需更新

---

## 📈 服务架构概览

### 前端服务
- **frontend-preview**: Next.js 14 + Makerkit UI

### 核心业务服务
- **siterank-preview**: 网站评分服务（✅ 本次优化）
- **siterank-worker-preview**: 网站评分Worker
- **offer-preview**: Offer管理服务
- **adscenter-preview**: Google Ads管理服务
- **billing-preview**: 计费和Token管理服务

### 基础设施服务
- **browser-exec-preview**: 浏览器自动化API
- **browser-exec-preview-worker**: 浏览器自动化Worker
- **proxy-pool-preview**: 代理IP池管理（✅ 本次更新）
- **proxy-pool-manager-preview**: 代理IP池管理器
- **projector-preview**: 投影服务（✅ 本次更新）

### 辅助服务
- **batchopen-preview**: 批量任务处理
- **console-preview**: 管理后台
- **notifications-preview**: 通知服务
- **recommendations-preview**: 推荐服务

---

## 🎯 监控重点

### 高优先级监控（本次更新的服务）

#### siterank-preview
- [ ] 评估成功率 >90%
- [ ] Browser-exec重试次数统计
- [ ] SimilarWeb重试次数统计
- [ ] 错误缓存命中率 >50%
- [ ] 评估延迟P95 <15秒

#### proxy-pool-preview
- [ ] 服务可用性 >99.9%
- [ ] Redis连接正常
- [ ] 代理IP获取成功率
- [ ] 无异常错误日志

#### projector-preview
- [ ] 服务可用性 >99.9%
- [ ] 响应时间正常
- [ ] 无异常错误日志

### 常规监控（未更新的服务）

- [ ] 所有服务可用性 >99.9%
- [ ] 无异常错误日志
- [ ] 响应时间正常

---

## 🔄 回滚策略

### 快速回滚（如需要）

```bash
# siterank回滚
gcloud run services update-traffic siterank-preview \
  --to-revisions=siterank-preview-00046-45s=100 \
  --region=asia-northeast1

# proxy-pool回滚
gcloud run services update-traffic proxy-pool-preview \
  --to-revisions=proxy-pool-preview-00003-zfj=100 \
  --region=asia-northeast1

# projector回滚
gcloud run services update-traffic projector-preview \
  --to-revisions=projector-preview-00002-6mw=100 \
  --region=asia-northeast1
```

### 批量回滚（紧急情况）

```bash
# 回滚所有本次更新的服务
for service in siterank proxy-pool projector; do
    echo "回滚 $service-preview..."
    gcloud run services update-traffic ${service}-preview \
        --to-revisions=PREVIOUS_REVISION=100 \
        --region=asia-northeast1 \
        --project=gen-lang-client-0944935873
done
```

---

## 📚 相关文档

- **所有服务部署报告**: `docs/ArchitectureReviewV1/all-services-deployment-report.md`
- **Siterank部署报告**: `docs/ArchitectureReviewV1/deployment-success-report.md`
- **评估报告**: `docs/ArchitectureReviewV1/offer-evaluation-ai-assessment-final.md`
- **执行报告**: `docs/ArchitectureReviewV1/optimization-execution-report.md`

---

## 🎉 总结

### 部署状态

✅ **所有15个preview服务运行正常**

**本次部署**:
- ✅ 3个服务已更新（siterank, proxy-pool, projector）
- ✅ 12个服务保持原有版本
- ✅ 所有服务状态正常
- ✅ 无错误或异常

**风险评估**:
- 🎯 siterank: 中等风险（新功能，需要密切监控）
- 📦 proxy-pool: 低风险（依赖升级）
- 📦 projector: 低风险（依赖升级）
- ✅ 其他12个服务: 无风险（未变更）

### 下一步行动

1. **立即**: 重点监控siterank服务，验证优化效果
2. **24小时内**: 监控所有3个更新的服务
3. **1-2天后**: 如果稳定，部署到production环境

---

**报告生成时间**: 2025-10-08  
**报告版本**: v1.0  
**检查状态**: ✅ 所有服务正常  
**下一步**: 开始监控和验证

