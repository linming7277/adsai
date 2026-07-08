# AutoAds 文档审查报告

**审查日期**: 2025-10-17
**审查范围**: 602个MD文档
**审查目的**: 识别过时内容，明确产品核心功能

---

## 📊 执行摘要

### 文档现状
- **总文档数**: 602个MD文档
- **文档分布**: 
  - 产品需求文档: ~50个
  - 架构设计文档: ~80个
  - 功能规格文档: ~40个
  - 测试文档: ~30个
  - 其他文档: ~400个

### 核心发现
1. **存在两套产品定义**（冲突严重）
2. **技术栈描述不一致**
3. **核心功能定义混乱**
4. **大量过时文档未清理**

---

## 🎯 产品核心功能定义（冲突分析）

### 版本1: 当前实际运行版本 (MustKnowV7.md)

**架构**: Makerkit (Next.js 14) + Go 微服务

**三大核心功能**:

1. **Offer评估** (siterank服务)
   - AI驱动的网站质量评估
   - SimilarWeb数据集成
   - 基础评估 (1 token) + AI评估 (3 tokens)
   - 评估时间: 11-16秒
   - 状态: ✅ **已实现并运行**

2. **真实补点击** (batchopen服务)
   - 自动化URL访问任务
   - 用户配置补点击计划
   - 后台异步执行
   - 状态: ✅ **已实现并运行**

3. **Ads中心** (adscenter服务)
   - 授权绑定Ads账号
   - 同步Ads账号数据
   - 数据分析和展示
   - 状态: ✅ **已实现并运行**

**技术栈**:
- 前端: Next.js 14 + Makerkit
- 后端: 13个Go微服务 + 1个Node.js服务
- 数据库: PostgreSQL (Supabase + Cloud SQL) + Redis
- 部署: GCP Cloud Run
- API网关: GCP API Gateway ✅ 已部署

---

### 版本2: 重构计划版本 (prd-new-V5.md)

**架构**: GoFly框架 + Go单体应用

**三大核心功能** (重构目标):

1. **BatchGo** (BatchOpen的Go重构版本)
   - 三种执行模式: Basic/Silent/Automated
   - HTTP访问 + Puppeteer访问
   - 并发性能提升4900% (1→50并发)
   - 状态: ❌ **计划中，未实施**

2. **SiteRankGo** (SiteRank的Go重构版本)
   - SimilarWeb API集成
   - 批量域名排名查询
   - 智能缓存策略
   - 状态: ❌ **计划中，未实施**

3. **AdsCenterGo** (AdsCenter的Go重构版本)
   - Google Ads OAuth集成
   - 多广告账户管理
   - 链接提取和批量替换
   - 状态: ❌ **计划中，未实施**

**技术栈**:
- 前端: Next.js 14 (保持)
- 后端: Go + GoFly Admin V3框架
- 数据库: MySQL 8.0 (全新部署)
- 状态: ❌ **未实施**

---

### 版本3: 产品重构V2版本 (productrefactoring-v2/)

**定位**: 面向联盟营销与品牌竞价高阶玩家

**四大核心模块**:

1. **智能Offer中心**
   - Offer资产管理
   - 状态机: evaluating/optimizing/scaling/profitable/abandoned
   - ROSC指标 (归因收益/广告花费)
   - 机会推荐引擎
   - 状态: ❓ **规划文档，实施状态不明**

2. **评估与仿真工作流** (Siterank + Batchopen)
   - Siterank: 快扫/深评、SimilarWeb画像、AI洞察
   - Batchopen: 点击任务模板、国家时间分布曲线、质量评分
   - 状态: ❓ **规划文档，实施状态不明**

3. **批量操作与智能诊断** (Adscenter)
   - Pre-flight智能诊断器
   - 跨账户批量操作 (CPC/预算/URL后缀/启停)
   - 回滚与审计
   - 状态: ❓ **规划文档，实施状态不明**

4. **AI风险与机会洞察**
   - 低曝低点/高曝低点识别
   - 落地页可用性检测
   - AI建议
   - 状态: ❓ **规划文档，实施状态不明**

**套餐**: Pro / Max / Elite (无免费版)
**计费**: 套餐+Token双轨制

---

## ⚠️ 关键冲突与问题

### 1. 架构冲突

| 维度 | 当前实际 | V5重构计划 | V2重构计划 |
|------|---------|-----------|-----------|
| **后端框架** | Go微服务 | GoFly单体 | 未明确 |
| **数据库** | PostgreSQL | MySQL 8.0 | 未明确 |
| **认证** | Supabase Auth | GoFly Auth | 未明确 |
| **部署** | Cloud Run | 未明确 | 未明确 |
| **API网关** | ✅ 已部署 | 未提及 | 未提及 |

**问题**: 三套架构方案并存，实际运行与计划严重脱节

### 2. 功能命名冲突

| 功能 | 当前实际 | V5计划 | V2计划 |
|------|---------|--------|--------|
| **补点击** | batchopen | BatchGo | Batchopen |
| **评估** | siterank | SiteRankGo | Siterank |
| **Ads** | adscenter | AdsCenterGo | Adscenter |

**问题**: 命名不统一，容易混淆

### 3. 功能范围冲突

**Offer评估**:
- 当前实际: 基础评估 + AI评估 (简单)
- V2计划: 快扫/深评 + SimilarWeb画像 + AI洞察 + 每日巡检 (复杂)

**补点击**:
- 当前实际: 简单的URL访问任务
- V5计划: 三种模式 (Basic/Silent/Automated)
- V2计划: 点击任务模板 + 国家时间分布曲线 + 质量评分

**Ads中心**:
- 当前实际: 基础的账号绑定和数据展示
- V2计划: Pre-flight诊断 + 批量操作 + 智能建议

**问题**: 功能范围差异巨大，不清楚实际实现了哪些

### 4. 套餐体系冲突

| 维度 | 当前实际 | V5计划 | V2计划 |
|------|---------|--------|--------|
| **套餐** | Starter/Pro/Elite | Free/Pro/Max | Pro/Max/Elite |
| **免费版** | ✅ 有 | ✅ 有 | ❌ 无 |
| **计费** | 订阅+Token | 订阅+Token | 订阅+Token |

**问题**: 套餐命名和定位不一致

---

## 📁 过时文档清单

### 高度过时 (建议归档)

1. **prd-new-V5.md** (2441行)
   - 描述GoFly重构计划
   - 与当前实际架构完全不符
   - 建议: 移至 `docs/archived/`

2. **prd-brownfield-gofly-migration.md**
   - GoFly迁移计划
   - 未实施
   - 建议: 归档

3. **ArchitectureOptimization*.md** (6个文件)
   - 早期架构优化方案
   - 已被 `ArchitectureOpV1/` 替代
   - 建议: 归档

4. **FeatureOptimization*.md** (4个文件)
   - 早期功能优化方案
   - 已被新方案替代
   - 建议: 归档

5. **SUPABASE_*.md** (多个文件)
   - Supabase迁移文档
   - 迁移已完成
   - 建议: 保留核心文档，归档过程文档

### 中度过时 (需要更新)

1. **productrefactoring-v2/** 目录
   - 产品重构V2规划
   - 实施状态不明
   - 建议: 明确标注为"规划文档"或更新实施状态

2. **api-spec-v33.md**
   - API规格文档
   - 版本号v33，可能过时
   - 建议: 检查是否与当前API一致

3. **deployment-guide.md**
   - 部署指南
   - 需要验证是否与当前部署流程一致
   - 建议: 更新或归档

### 低度过时 (保持更新)

1. **MustKnowV7.md** ✅
   - 当前项目核心文档
   - 需要持续更新

2. **COMPLETE-OPTIMIZATION-PLAN.md** ✅
   - 架构优化计划
   - 正在实施中

3. **E2E_TEST_SOLUTION_SUMMARY.md** ✅
   - E2E测试方案
   - 需要持续更新

---

## ✅ 产品核心功能定义（推荐版本）

基于当前实际运行状态，推荐使用以下定义：

### 产品定位
**AutoAds**: Affiliate营销领域的AI驱动自动化平台

### 三大核心功能

#### 1. Offer评估 (siterank)
**功能**: AI驱动的网站质量评估
**价值**: 快速筛选高质量Offer，降低试错成本
**实现**:
- 基础评估: 网站可达性、基础指标 (1 token)
- AI评估: SimilarWeb数据 + Gemini AI分析 (3 tokens)
- 评分系统: A/B/C/D/F五级评分
- 评估时间: 11-16秒

**技术**:
- 服务: siterank (Go)
- API: SimilarWeb API
- AI: Google Vertex AI Gemini
- 架构: API+Worker (异步处理)

#### 2. 真实补点击 (batchopen)
**功能**: 自动化URL访问任务，提升流量数据
**价值**: 改善Offer流量指标，提升广告效果
**实现**:
- 任务配置: URL列表、访问频率、时间设置
- 后台执行: 异步任务队列
- 浏览器自动化: 真实浏览器访问
- 结果统计: 成功率、访问时间、错误分析

**技术**:
- 服务: batchopen (Node.js)
- 浏览器: Puppeteer
- 队列: GCP Pub/Sub

#### 3. Ads中心 (adscenter)
**功能**: Google Ads账号管理与数据分析
**价值**: 统一管理多个广告账号，数据驱动决策
**实现**:
- 账号绑定: OAuth授权流程
- 数据同步: 增量同步广告数据
- Dashboard: 关键指标可视化
- 多账号管理: 支持多个Ads账号

**技术**:
- 服务: adscenter (Go)
- API: Google Ads API
- 认证: OAuth 2.0

### 支撑功能

#### 4. 用户认证与权限
- Google OAuth一键登录
- 基于角色的权限控制 (RBAC)
- 用户/管理员双角色

#### 5. 订阅与计费
- 三级套餐: Starter/Pro/Elite
- Token经济系统
- 订阅管理

#### 6. Dashboard与通知
- BFF服务聚合数据
- 实时通知系统 (SSE)
- 用户活动追踪

---

## 📋 推荐行动

### 立即行动 (P0)

1. **明确产品定义**
   - 确认使用"当前实际版本"作为SSOT
   - 更新所有文档引用
   - 归档过时的重构计划

2. **清理过时文档**
   - 创建 `docs/archived/` 目录
   - 移动高度过时文档
   - 添加README说明归档原因

3. **更新核心文档**
   - 更新 MustKnowV7.md
   - 更新 SuperClaude优化指令集
   - 确保三大核心功能描述一致

### 短期行动 (P1)

4. **统一命名规范**
   - 确定功能命名标准
   - 更新所有文档
   - 更新代码注释

5. **文档分类整理**
   - 按状态分类: 当前/规划/归档
   - 添加状态标签
   - 建立文档索引

6. **建立文档维护机制**
   - 定期审查 (每月)
   - 版本控制
   - 变更日志

### 中期行动 (P2)

7. **评估重构计划**
   - 评估V2重构计划的价值
   - 决定是否实施
   - 更新或归档相关文档

8. **完善功能文档**
   - 补充实施细节
   - 添加架构图
   - 更新API文档

---

## 📊 文档健康度评分

| 维度 | 评分 | 说明 |
|------|------|------|
| **一致性** | 3/10 | 三套定义并存，严重冲突 |
| **准确性** | 5/10 | 部分文档准确，部分过时 |
| **完整性** | 6/10 | 核心功能有文档，但细节不足 |
| **可维护性** | 4/10 | 缺乏维护机制，过时文档多 |
| **可用性** | 5/10 | 难以快速找到准确信息 |

**总体评分**: **4.6/10** (需要改进)

---

## 🎯 目标状态

### 文档架构 (推荐)

```
docs/
├── current/                    # 当前实际运行版本
│   ├── MustKnow.md            # 核心原则 (SSOT)
│   ├── Architecture.md         # 架构设计
│   ├── CoreFeatures/          # 核心功能
│   │   ├── OfferEvaluation.md
│   │   ├── Batchopen.md
│   │   └── AdsCenter.md
│   ├── API/                   # API文档
│   └── Deployment/            # 部署文档
├── planning/                   # 规划文档
│   ├── Roadmap.md
│   ├── FeatureRequests/
│   └── TechDebt/
├── archived/                   # 归档文档
│   ├── 2024/
│   ├── 2025-Q1/
│   └── README.md              # 归档说明
└── README.md                  # 文档索引
```

### 文档标准

每个文档应包含:
- **状态标签**: Current/Planning/Archived
- **最后更新日期**
- **负责人**
- **版本号**
- **变更日志**

---

## 附录

### A. 文档统计

- 总文档数: 602
- 当前有效: ~150 (25%)
- 需要更新: ~200 (33%)
- 建议归档: ~250 (42%)

### B. 关键文档清单

**必读文档** (SSOT):
1. docs/BasicPrinciples/MustKnowV7.md
2. docs/ArchitectureOpV1/COMPLETE-OPTIMIZATION-PLAN.md
3. docs/TestAll/E2E_TEST_SOLUTION_SUMMARY.md
4. docs/SuperClaude/SUPERCLOUD_OPTIMIZATION_DIRECTIVES.md

**参考文档**:
1. docs/productrefactoring-v2/ (规划参考)
2. docs/monorepo-build-best-practices.md
3. docs/architecture/ (架构分析)

**过时文档** (建议归档):
1. docs/prd-new-V5.md
2. docs/prd-brownfield-gofly-migration.md
3. docs/ArchitectureOptimization*.md
4. docs/FeatureOptimization*.md

---

**审查人**: Kiro AI Assistant
**审查日期**: 2025-10-17
**下次审查**: 2025-11-17
