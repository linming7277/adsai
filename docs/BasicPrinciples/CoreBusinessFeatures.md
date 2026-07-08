# AutoAds 核心业务功能说明

**版本**: V3.0 (正确版)
**日期**: 2025-10-17
**状态**: SSOT (Single Source of Truth)
**说明**: 套餐基于当前代码，功能包含合理的增强规划

---

## 🎯 产品定位

**AutoAds**: Affiliate营销领域的AI驱动自动化平台

**目标用户**: Affiliate营销人员、联盟营销团队

**核心价值**:
- 快速评估Offer质量，降低试错成本
- 自动化URL访问，提升流量数据
- 统一管理广告账号，数据驱动决策

---

## 🔥 三大核心功能

### 1. Offer评估 (siterank服务)

#### 当前实现

**基础评估** (1 token):
- 网站可达性检测
- 基础指标分析
- SimilarWeb数据集成（流量排名、访问量趋势、流量来源、地理位置）
- 快速评分

**AI增强评估** (+2 tokens，总计3 tokens):
- Google Vertex AI Gemini分析
- A/B/C/D/F五级评分
- AI洞察和建议

**技术实现**:
- 服务: siterank (Go)
- 架构: API+Worker (异步处理)
- API: SimilarWeb API
- AI: Google Vertex AI Gemini
- 缓存: Redis (7天TTL)
- 评估时间: 11-16秒

#### 计划增强

**重定向链追踪** (P0):
- 追踪完整跳转链路
- 识别最终落地页
- 检测异常跳转
- 预期: 评估准确性提升40%

**AI建议优化** (P0):
- 提供3条具体可执行建议
- 建议分类和优先级
- 预期: 用户操作效率提升30%

**每日落地页巡检** (P0):
- 定时检测可用性
- 异常告警
- 历史趋势分析
- 预期: 问题发现时间缩短90%

---

### 2. 真实补点击 (batchopen服务)

#### 当前实现

**基础能力**:
- URL访问任务配置
- 后台异步执行
- 浏览器自动化 (Playwright)
- 基础统计 (成功/失败)

**技术实现**:
- 服务: batchopen (Node.js)
- 浏览器: Playwright
- 队列: GCP Pub/Sub

#### 计划增强

**代理配置和轮换** (P1):
- 集成proxy-pool服务
- 代理IP国家匹配
- 轮换策略
- Referer和UA多样性
- 预期: 任务成功率提升20%

**任务结果分析** (P1):
- 详细统计维度
- 失败原因分析
- 优化建议
- 数据导出
- 预期: 用户操作效率提升15%

**时间分布控制** (P2):
- 国家时间分布模板
- 符合当地上网习惯
- 自定义曲线
- 预期: 仿真质量提升40%

---

### 3. Ads中心 (adscenter服务)

#### 当前实现

**基础能力**:
- Google Ads OAuth授权
- 多账号绑定
- 数据同步 (增量)
- Dashboard展示

**技术实现**:
- 服务: adscenter (Go)
- API: Google Ads API
- 认证: OAuth 2.0

#### 计划增强

**批量操作** (P1):
- 批量CPC调整
- 批量预算调整
- 批量URL suffix修改
- 批量启停操作
- 影响预估和回滚
- 预期: 操作效率提升10x

**Pre-flight智能诊断** (P1):
- 账号状态检测
- 数据获取检测
- 结构有效性检测
- 转化回传检测
- 落地页检测
- 预期: 问题定位效率提升5x

---

## 💰 套餐与权限（基于当前代码）

### 套餐定义

**代码来源**: `apps/frontend/src/configuration.ts`

#### Starter套餐
- **价格**: ¥298/月 (年付¥1788，5折优惠)
- **Token**: 100 tokens/月
- **功能**:
  - 基础评估（1 token/次）
  - 真实补点击
  - 1个并发评估
  - 最多1个广告账号
  - 仅美国(US)代理IP
  - 邮件支持

#### Professional套餐 (推荐)
- **价格**: ¥998/月 (年付¥5988，5折优惠)
- **Token**: 1000 tokens/月
- **功能**:
  - 基础评估（1 token/次）
  - AI智能评估（+2 tokens，12维度）
  - 真实补点击
  - 10个并发评估
  - 最多10个广告账号
  - 全球10+地区代理IP
  - 优先邮件支持
  - 高级报表与数据导出

#### Elite套餐
- **价格**: ¥2998/月 (年付¥17988，5折优惠)
- **Token**: 10000 tokens/月
- **功能**:
  - 基础评估（1 token/次）
  - AI智能评估（+2 tokens，12维度）
  - 真实补点击
  - 100个并发评估
  - 最多100个广告账号
  - 全球50+地区代理IP
  - 专属客户成功经理
  - 自定义集成支持

### 权限矩阵

**代码来源**: `apps/frontend/src/lib/hooks/useSubscription.ts`

```typescript
// 实际权限检查逻辑
const isStarter = subscription?.plan === 'starter';
const isProfessional = subscription?.plan === 'professional';
const isElite = subscription?.plan === 'elite';

// AI evaluation is available for Professional and Elite only
const canUseAI = isProfessional || isElite;

// Unlimited offers for Elite only
const hasUnlimitedOffers = isElite;
```

| 功能 | Starter | Professional | Elite |
|------|---------|--------------|-------|
| **基础评估** | ✓ | ✓ | ✓ |
| **AI评估** | ✗ | ✓ | ✓ |
| **真实补点击** | ✓ | ✓ | ✓ |
| **Ads中心** | ✓ (1账号) | ✓ (10账号) | ✓ (100账号) |
| **并发评估** | 1个 | 10个 | 100个 |
| **代理IP** | 美国 | 全球10+ | 全球50+ |

---

## 🔧 支撑功能

### 1. 用户认证与权限

**认证方式**:
- Google OAuth一键登录
- Supabase Auth

**权限控制**:
- 基于角色的访问控制 (RBAC)
- 用户角色: User / Admin
- 套餐权限检查

---

### 2. 订阅与计费

**订阅管理**:
- 套餐订阅
- 自动续费
- 订阅状态管理

**Token系统**:
- Token余额管理
- Token消耗记录
- Token预留机制 (两阶段提交)
- 自动返还机制

**计费规则**:
- 基础评估: 1 token（包含SimilarWeb数据）
- AI评估: +2 tokens（在基础评估上增加）
- 基础+AI评估: 3 tokens（完整评估）
- 补点击: 按任务计费

---

### 3. Dashboard与通知

**Dashboard**:
- BFF服务聚合数据
- 多服务数据整合
- 关键指标展示

**通知系统**:
- 实时通知 (SSE)
- 用户活动追踪
- 系统消息推送

---

### 4. 管理后台 (Console)

**用户管理**:
- 用户列表和详情
- 权限管理

**Token管理**:
- Token余额查询
- 交易记录
- 手动调整

**Offer管理**:
- 跨用户Offer查询
- 状态管理
- 统计数据

**Ads管理**:
- 广告账号列表
- 账号详情
- 统计数据

---

### 5. 用户活动功能

**签到系统**:
- 每日签到奖励
- 连续签到统计
- Token奖励

**邀请系统**:
- 邀请码生成
- 邀请记录
- 双向试用奖励

---

## 🏗️ 技术架构

### 架构概览

```
Frontend (Next.js 14 + Makerkit)
    ↓ Google OAuth
Supabase Auth (JWT)
    ↓
GCP API Gateway ✅
    ↓
Gateway Middleware (权限+Token管理)
    ↓
13个Go微服务 + 1个Node.js服务
    ↓
PostgreSQL (Supabase + Cloud SQL) + Redis
```

### 核心服务

**业务服务**:
- offer (Go) - Offer管理
- siterank (Go) - 网站评估
- batchopen (Node.js) - 补点击
- adscenter (Go) - 广告中心
- billing (Go) - 订阅计费

**支撑服务**:
- console (Go) - 管理后台
- useractivity (Go) - 用户活动
- bff (Go) - Dashboard聚合
- gateway-middleware (Go) - 权限Token管理
- browser-exec (Node.js) - 浏览器自动化
- proxy-pool (Go) - 代理池管理
- recommendations (Go) - 推荐服务
- projector (Go) - 事件投影

---

## 📊 数据流

### Offer评估流程

```
1. 用户创建Offer
2. 点击评估按钮
3. Token预留 (1 or 3)
4. API+Worker异步处理
   - 基础评估 (siterank + SimilarWeb数据)
   - AI评估 (Gemini，可选)
5. 结果展示 (A/B/C/D/F)
6. Token确认扣除
```

### 补点击流程

```
1. 用户配置任务
   - URL列表
   - 访问频率
   - 时间设置
2. 提交任务
3. 后台异步执行
   - Playwright访问
   - 真实行为模拟
4. 结果统计
5. 通知用户
```

### Ads中心流程

```
1. OAuth授权
2. 账号绑定
3. 数据同步 (增量)
4. Dashboard展示
5. 定期更新
```

---

## 📅 功能增强路线图

### Phase 1: 评估功能增强 (4-5周)

**目标**: 提升评估准确性和可执行性

**功能**:
1. 重定向链追踪 (1周)
2. AI建议优化 (1周)
3. 每日落地页巡检 (2周)

**预期收益**:
- 评估准确性提升40%
- 用户操作效率提升30%
- 问题发现时间缩短90%

---

### Phase 2: 补点击功能增强 (4周)

**目标**: 提升任务成功率和质量

**功能**:
1. 代理配置和轮换 (2周)
2. 任务结果分析 (2周)

**预期收益**:
- 任务成功率提升20%
- 用户操作效率提升15%

---

### Phase 3: Ads中心功能增强 (7-8周)

**目标**: 规模化运营能力

**功能**:
1. 批量操作 (7周)
2. Pre-flight诊断 (8周，分阶段)

**预期收益**:
- 操作效率提升10x
- 问题定位效率提升5x

---

## 🔗 相关文档

**核心文档**:
- `MustKnowV7.md` - 架构设计和技术栈
- `CoreBusinessFeatures_V3.md` - 业务功能说明（本文档）

**优化计划**:
- `docs/ArchitectureOpV1/COMPLETE-OPTIMIZATION-PLAN.md` - 架构优化
- `docs/SuperClaude/SUPERCLOUD_OPTIMIZATION_DIRECTIVES.md` - SuperClaude优化指令

**测试方案**:
- `docs/TestAll/E2E_TEST_SOLUTION_SUMMARY.md` - E2E测试

---

## 📝 维护说明

### 套餐定义维护

**重要**: 套餐定义必须与代码保持一致

**验证方法**:
```bash
# 检查套餐配置
cat apps/frontend/src/configuration.ts | grep -A 30 "products:"

# 检查权限逻辑
cat apps/frontend/src/lib/hooks/useSubscription.ts
```

**更新流程**:
1. 代码变更后立即更新文档
2. 验证套餐名称、价格、功能列表
3. 验证权限检查逻辑

### 功能描述维护

**原则**:
- 当前实现: 基于实际代码
- 计划增强: 基于合理的业务需求
- 明确标注: 当前 vs 计划

---

**维护人**: Product & Engineering Team
**最后更新**: 2025-10-17
**下次审查**: 套餐变更或重大功能上线后
