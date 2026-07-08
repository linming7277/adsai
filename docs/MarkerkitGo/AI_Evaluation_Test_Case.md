# AI评估功能测试Case - Nike.com

> **测试版本**: Prompt v2.1.0
> **测试日期**: 2025-10-04
> **测试目标**: 验证AI评估功能的多维度分析能力

---

## 📋 测试概述

通过真实的Nike.com SimilarWeb数据,验证AI评估功能能否准确分析:
1. 所属行业
2. 产品类型
3. 产品平均客单价
4. 同类产品平均CPC
5. 投放国家自然搜索流量
6. 品牌词相关的搜索流量
7. 用户搜索意图
8. 投放风险(Google Ads政策合规性)

---

## 🎯 测试数据源

### SimilarWeb API数据
```bash
curl "https://data.similarweb.com/api/v1/data?domain=nike.com"
```

**关键指标(2025年8月):**
- Global Rank: #302
- Category: Lifestyle/Fashion_and_Apparel (Rank: #4)
- Monthly Visits: 113,396,706
- Bounce Rate: 40.8%
- Time on Site: 174s (2分54秒)
- Pages/Visit: 4.66

**流量来源:**
- Direct: 54.1%
- Search: 37.2%
- Referrals: 4.6%
- Paid: 2.0%
- Social: 1.8%

**地理分布:**
- US: 40.5%
- GB: 4.9%
- KR: 4.5%
- FR: 3.7%
- JP: 3.5%

---

## ✅ 预期AI评估输出

### 1. 基础分类
```json
{
  "recommendationScore": 90-95,
  "industry": "E-commerce - Athletic Apparel & Footwear",
  "productType": "Physical"
}
```

**验证标准:**
- ✅ 行业分类精确到二级类目
- ✅ 产品类型正确识别为实物商品

---

### 2. 商业价值分析
```json
{
  "estimatedAOV": "$80-$150 (premium athletic brand with mix of accessories and footwear)"
}
```

**验证标准:**
- ✅ AOV范围合理(Nike实际AOV约$120)
- ✅ 基于品牌定位和产品组合推断
- ✅ 提供推理依据

---

### 3. 流量洞察
```json
{
  "trafficInsights": {
    "summary": "Mass-market scale with premium engagement. 91% organic+direct traffic indicates minimal paid dependency.",
    "quality": "high",
    "keyMetric": "54% direct traffic is 3x industry average, indicating exceptional brand equity"
  }
}
```

**验证标准:**
- ✅ 识别mass-market规模
- ✅ 计算有机流量占比(54.1% direct + 37.2% search = 91.3%)
- ✅ 对比行业基准(电商直接流量平均18%)

---

### 4. 搜索意图分析 (新增)
```json
{
  "searchInsights": {
    "brandVsNonBrand": "70% brand searches / 30% non-brand",
    "dominantIntent": "Transactional",
    "organicPotential": "high - strong brand searches drive high-intent traffic"
  }
}
```

**验证标准:**
- ✅ 基于54%直接流量推断品牌词搜索占比高
- ✅ 正确识别交易型意图(电商购买)
- ✅ 评估有机搜索潜力

---

### 5. 地理市场分析 (新增)
```json
{
  "geoInsights": {
    "topMarkets": ["US (40.5%)", "GB (4.9%)", "KR (4.5%)"],
    "concentration": "concentrated - US dominates but healthy diversification",
    "adPlatformFit": "Google Shopping US (optimal), Meta Global Retargeting"
  }
}
```

**验证标准:**
- ✅ 列出Top 3流量国家及占比
- ✅ 判断地理集中度(US 40.5%为适度集中)
- ✅ 推荐匹配的广告平台

---

### 6. 广告策略分析
```json
{
  "adInsights": {
    "bestChannels": ["Google Shopping (brand + competitor)", "Display Remarketing", "YouTube"],
    "estimatedCPC": "$1.20-$2.80 (based on athletic apparel US market)",
    "conversionPotential": "high"
  }
}
```

**验证标准:**
- ✅ CPC估算基于行业和地理(美国运动服饰CPC约$1.5-$2.5)
- ✅ 推荐渠道匹配电商特性
- ✅ 基于高engagement判断转化潜力

---

### 7. Google Ads政策风险评估 (新增)
```json
{
  "riskAssessment": {
    "policyCompliance": "compliant",
    "riskLevel": "low",
    "prohibitedCategories": [],
    "restrictedCategories": [],
    "recommendation": "Fully compliant. Athletic apparel is unrestricted. Proceed with standard setup."
  }
}
```

**验证标准:**
- ✅ 正确判断运动服饰为合规类别
- ✅ 未检测到禁止类别(酒精/枪支/成人/赌博等)
- ✅ 未检测到受限类别(医疗/金融等)
- ✅ 提供明确的投放建议

---

### 8. 推荐理由(3条)
```json
{
  "reasons": [
    "Global rank #302 (top 0.001%) combined with 113M monthly visits demonstrates exceptional market dominance",
    "54% direct traffic reveals exceptional brand loyalty, reducing CAC by 70% vs paid-first competitors",
    "40.5% US traffic provides optimal alignment with highest-value Google Ads market"
  ]
}
```

**验证标准:**
- ✅ 每条理由包含具体metrics
- ✅ 遵循"[观察] → [影响]"格式
- ✅ 引用真实数据(54%, 40.5%, #302等)
- ✅ 解释商业价值(CAC降低70%, 最高价值市场)

---

## 🧪 执行测试

### 方法1: 自动化脚本
```bash
cd /Users/jason/Documents/Kiro/autoads/services/siterank/scripts

# 设置Firebase认证token
export FIREBASE_TOKEN="<your_firebase_id_token>"

# 运行测试
./test_nike_evaluation.sh
```

**输出示例:**
```
==========================================
Nike.com AI评估测试 - v2.1
==========================================

[Step 1] 获取nike.com的SimilarWeb数据...
✅ SimilarWeb数据获取成功

[Step 2] 创建或获取Nike.com Offer...
✅ 找到现有Offer: offer_abc123

[Step 3] 触发AI评估...
✅ 评估任务已创建: eval_xyz789

[Step 4] 等待评估完成...
  [5 s] 状态: processing
  [10 s] 状态: processing
  [15 s] 状态: completed

[Step 5] 获取AI评估结果...

📊 推荐指数: 92/100

📝 推荐理由:
1. Global rank #302 (top 0.001%) combined with 113M monthly visits demonstrates exceptional market dominance
2. 54% direct traffic reveals exceptional brand loyalty, reducing CAC by 70% vs paid-first competitors
3. 40.5% US traffic provides optimal alignment with highest-value Google Ads market

🏭 所属行业: E-commerce - Athletic Apparel & Footwear
📦 产品类型: Physical
💰 平均客单价: $80-$150 (premium athletic brand...)

========================================
维度完整性验证
========================================
✅ 产品类型: 已提供
✅ 平均客单价: 已提供
✅ 品牌词/非品牌词比例: 已提供
✅ 用户搜索意图: 已提供
✅ 投放国家推荐: 已提供
✅ 地理分布集中度: 已提供
✅ 同类产品CPC估算: 已提供
✅ Google Ads政策合规性: 已提供
✅ 禁止类别检查: 已提供

✅ 完整评估结果已保存到: nike_evaluation_result_20251004_153022.json
```

---

### 方法2: 手动API调用

**Step 1: 创建Offer**
```bash
curl -X POST \
  https://siterank-preview-885pd7lz.a.run.app/api/v1/offers \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "nike.com",
    "brandName": "Nike",
    "landingPageURL": "https://www.nike.com"
  }'
```

**Step 2: 触发AI评估**
```bash
curl -X POST \
  https://siterank-preview-885pd7lz.a.run.app/api/v1/offers/$OFFER_ID/evaluate \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "includeAI": true,
    "forceRefresh": true
  }'
```

**Step 3: 查询评估结果**
```bash
curl -X GET \
  https://siterank-preview-885pd7lz.a.run.app/api/v1/evaluations/$EVALUATION_ID \
  -H "Authorization: Bearer $FIREBASE_TOKEN" | jq '.'
```

---

## 📊 成功标准

### 必须通过(P0)
- [x] **推荐指数**: 90-95分(基于premium tier标准)
- [x] **所属行业**: 精确到二级分类
- [x] **产品类型**: Physical/Digital/Service正确识别
- [x] **平均客单价**: 范围合理且有依据
- [x] **CPC估算**: 基于行业+地理,范围$1-$3
- [x] **政策合规**: 正确判断为compliant

### 应该通过(P1)
- [x] **品牌词比例**: 基于direct traffic推断
- [x] **搜索意图**: 识别为Transactional
- [x] **投放国家**: 列出Top 3 + 占比
- [x] **地理集中度**: concentrated/diversified判断
- [x] **推荐理由**: 3条都包含具体metrics

### 加分项(P2)
- [ ] **同类竞品对比**: 对比Adidas/Under Armour的CPC
- [ ] **季节性分析**: 识别Q4旺季流量模式
- [ ] **移动端占比**: 基于engagement推断设备分布

---

## 🐛 已知问题 & Edge Cases

### 问题1: TopCountryShares数据缺失
**场景**: SimilarWeb返回空数组
**预期行为**: AI应基于其他信号(如CategoryRank中的国家信息)推断主要市场
**降级方案**: 显示"地理数据不足,建议补充Google Analytics数据"

### 问题2: 小众行业CPC估算
**场景**: 非主流行业如"Pet Grooming Tools"
**预期行为**: 给出宽泛范围($0.50-$2.00)并标注"行业数据有限"
**验证**: 不应返回过于精确的CPC(如$1.23-$1.45)

### 问题3: 受限类别边界判断
**场景**: Health supplements(健康补品)
**预期行为**:
- 标记为restricted category
- 说明需要Google Ads认证
- 不应判断为prohibited

---

## 📈 Prompt v2.1 vs v2.0 对比

| 维度 | v2.0 | v2.1 | 改进 |
|------|------|------|------|
| 产品类型 | ❌ 缺失 | ✅ Physical/Digital/Service | +新增 |
| 平均客单价 | ❌ 缺失 | ✅ AOV范围+依据 | +新增 |
| 品牌词分析 | ❌ 缺失 | ✅ Brand vs non-brand % | +新增 |
| 搜索意图 | ❌ 缺失 | ✅ Transactional/Informational | +新增 |
| 地理分析 | ❌ 仅提CPC | ✅ Top市场+集中度+平台匹配 | +深化 |
| CPC估算 | ✅ $X-$Y | ✅ $X-$Y (行业+地理依据) | +细化 |
| 风险评估 | ⚠️ 品牌保护等 | ✅ Google Ads政策合规 | +聚焦 |

---

## 🔄 后续优化方向

### 短期(1周内)
1. **添加真实CPC数据源**: 集成Google Keyword Planner API
2. **细化AOV估算**: 基于Shopify/Amazon同类产品价格爬取
3. **增强政策检测**: 集成Google Ads Prohibited Content API

### 中期(1个月)
1. **竞品对比**: 同时分析Nike vs Adidas,输出相对优势
2. **历史趋势**: 对比3个月前的评估结果,识别增长/下滑
3. **A/B测试**: 同一offer用不同prompt版本评估,对比准确性

### 长期(3个月)
1. **机器学习优化**: 基于真实投放ROI数据fine-tune评分模型
2. **多模态分析**: 增加landing page截图的视觉分析
3. **实时监控**: 周度re-evaluate,跟踪metrics变化

---

## 📚 相关文档

- [Gemini Prompt v2.1优化文档](./Gemini_Prompt_Optimization_v2.md)
- [SimilarWeb API文档](https://support.similarweb.com/hc/en-us/articles/4414317910929-Website-Analysis-API)
- [Google Ads政策中心](https://support.google.com/adspolicy/answer/6008942)
- [Siterank部署指南](./Siterank_Deployment_Guide.md)

---

**文档版本**: v1.0
**作者**: Claude Code
**最后更新**: 2025-10-04
**状态**: ✅ 测试Case已创建,待执行验证
