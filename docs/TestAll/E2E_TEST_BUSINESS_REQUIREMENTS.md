# E2E测试业务需求完善方案

**更新时间**: 2025-10-15
**版本**: v2.0
**状态**: 🔄 根据详细业务需求完善中

---

## 📋 业务需求分析

### 核心页面结构 (修正后)

根据新的业务需求，E2E测试需要覆盖以下页面：

```
用户端页面架构:
├── /dashboard                    # 1. 仪表盘
├── /offers                     # 2. Offer管理 (原/dashboard/offers)
├── /ads-center                 # 3. Ads中心 (原/dashboard/ads-center)
├── /tasks                      # 4. 任务中心 (原/dashboard/tasks)
└── /userinfo                   # 5. 个人中心 (新页面)
```

### 页面功能详细分析

#### 1. 仪表盘 (/dashboard)
**功能**: 日常运营一览
- [ ] Offer数据表现统计
- [ ] Ads账号数据表现统计
- [ ] 风险提醒显示
- [ ] 消息通知聚合
- [ ] 快速操作入口

#### 2. Offer管理 (/offers)
**功能**: 以Offer为视角的完整管理
- [ ] Offer列表展示 (包含新的"AI推荐指数"列)
- [ ] Offer状态管理
- [ ] Offer与Ads账号关联
- [ ] 评估按钮 (普通评估 + AI评估)
- [ ] AI推荐指数弹窗
- [ ] 套餐权限控制 (Starter套餐显示"开通"按钮)

#### 3. Ads中心 (/ads-center)
**功能**: 以Ads账号为视角的管理
- [ ] 账号授权绑定
- [ ] 账号状态管理
- [ ] 账号信息获取
- [ ] 账号数据统计
- [ ] 批量操作功能

#### 4. 任务中心 (/tasks)
**功能**: 以任务为视角的消耗Token任务
- [ ] 评估任务列表
- [ ] 补点击任务列表
- [ ] 换链接任务列表
- [ ] 任务执行结果展示
- [ ] Token消耗统计

#### 5. 个人中心 (/userinfo)
**功能**: 用户个人信息管理
- [ ] 个人信息编辑
- [ ] 套餐订阅管理
- [ ] Token余额显示
- [ ] 邀请功能
- [ ] 签到功能

---

## 🎯 E2E测试架构重设计

### 测试账号配置

```typescript
const TEST_ACCOUNTS = {
  // Starter套餐用户 (限制AI评估功能)
  starter: {
    email: 'test-starter@autoads.dev',
    subscription: 'starter',
    tokens: 1000,
    expectedFeatures: ['basic-evaluation', 'ai-upgrade-prompt']
  },

  // Professional套餐用户 (启用AI评估功能)
  professional: {
    email: 'test-professional@autoads.dev',
    subscription: 'professional',
    tokens: 5000,
    expectedFeatures: ['basic-evaluation', 'ai-evaluation', 'ai-recommendation']
  },

  // Elite套餐用户 (启用所有功能)
  elite: {
    email: 'test-elite@autoads.dev',
    subscription: 'elite',
    tokens: 10000,
    expectedFeatures: ['basic-evaluation', 'ai-evaluation', 'ai-recommendation', 'advanced-features']
  },

  // 管理员账号
  admin: {
    email: 'test-admin@autoads.dev',
    subscription: 'elite',
    tokens: 50000,
    role: 'admin'
  }
}
```

### 测试套餐分类

#### A. 基础功能测试 (所有用户)
1. **仪表盘概览** - `/dashboard`
2. **个人中心访问** - `/userinfo`
3. **基础Offer列表** - `/offers`
4. **基础Ads中心** - `/ads-center`
5. **基础任务中心** - `/tasks`

#### B. Offer管理测试 (核心业务)
1. **Offer列表展示** - `/offers`
2. **Offer与Ads账号关联** - `/offers`
3. **普通评估流程** - `/offers`
4. **AI评估权限控制** - `/offers`

#### C. AI评估功能测试 (付费用户)
1. **AI评估触发** - `/offers` (Professional/Elite)
2. **AI推荐指数显示** - `/offers`
3. **AI评估详情弹窗** - `/offers`
4. **AI评估结果持久化** - `/offers`

#### D. Token消耗测试 (核心逻辑)
1. **普通评估Token消耗** - 1 token
2. **AI评估Token消耗** - 2 tokens
3. **完整评估流程Token消耗** - 3 tokens
4. **Token余额验证** - `/userinfo`

#### E. 权限控制测试 (访问控制)
1. **Starter套餐限制** - 显示"开通"按钮
2. **Professional套餐功能** - 启用AI评估
3. **Elite套餐功能** - 启用所有功能
4. **套餐升级引导** - 跳转到价格页面

---

## 🔍 核心业务流程测试

### 1. Offer评估完整流程测试

```typescript
// 测试流程: 用户点击评估 → 完整的siterank + browser-exec + AI评估流程
async function testOfferEvaluationFlow() {
  // Step 1: 创建测试Offer
  const testOffer = {
    url: 'https://example-nike.com/product-page',
    name: 'Nike Product Offer Test',
    country: 'US',
    category: 'E-commerce'
  };

  // Step 2: 用户点击评估按钮
  await page.click('[data-testid="evaluate-offer-button"]');

  // Step 3: 验证Token消耗 (根据用户套餐)
  const expectedTokenCost = user.subscription === 'starter' ? 1 : 3;
  await verifyTokenDeduction(expectedTokenCost);

  // Step 4: 等待评估完成 (可能需要30-60秒)
  await waitForEvaluationComplete();

  // Step 5: 验证评估结果持久化
  await verifyEvaluationResults(testOffer.url);

  // Step 6: 验证AI推荐指数显示 (付费用户)
  if (user.subscription !== 'starter') {
    await verifyAIRecommendationDisplay();
  }
}
```

### 2. AI评估权限控制测试

```typescript
// 测试不同套餐用户的AI评估权限
async function testAIEvaluationPermissions() {

  // Starter用户测试
  await testStarterUserRestrictions();
  async function testStarterUserRestrictions() {
    // 验证显示"开通"按钮而非评估按钮
    const upgradeButton = await page.locator('[data-testid="ai-upgrade-button"]');
    await expect(upgradeButton).toBeVisible();

    // 点击"开通"按钮应该跳转到价格页面
    await upgradeButton.click();
    await page.waitForURL('**/pricing');
  }

  // Professional用户测试
  await testProfessionalUserFeatures();
  async function testProfessionalUserFeatures() {
    // 验证可以直接进行AI评估
    const aiEvaluateButton = await page.locator('[data-testid="ai-evaluate-button"]');
    await expect(aiEvaluateButton).toBeVisible();

    // 验证可以查看AI推荐指数
    const aiRecommendation = await page.locator('[data-testid="ai-recommendation-score"]');
    await expect(aiRecommendation).toBeVisible();
  }

  // Elite用户测试
  await testEliteUserFeatures();
  async function testEliteUserFeatures() {
    // 验证所有高级功能可用
    const advancedFeatures = await page.locator('[data-testid="elite-features"]');
    await expect(advancedFeatures).toBeVisible();
  }
}
```

### 3. Token消耗规则测试

```typescript
// 测试Token消耗规则
async function testTokenConsumptionRules() {
  const initialTokenBalance = await getUserTokenBalance();

  // 测试1: 普通评估消耗1个token
  await performBasicEvaluation();
  const afterBasicBalance = await getUserTokenBalance();
  expect(afterBasicBalance).toBe(initialTokenBalance - 1);

  // 测试2: AI评估消耗额外2个token (总计3个)
  await performAIEvaluation();
  const afterAIBalance = await getUserTokenBalance();
  expect(afterAIBalance).toBe(afterBasicBalance - 2);

  // 测试3: 验证Token不足时的处理
  await testInsufficientTokens();
}
```

---

## 📊 测试数据准备

### 基础测试数据

```typescript
const TEST_DATA = {
  offers: [
    {
      url: 'https://example-nike.com/shoes',
      name: 'Nike Shoes Offer',
      brand: '', // 空，测试品牌名提取
      country: 'US',
      category: 'E-commerce',
      status: 'pending'
    },
    {
      url: 'https://example-adidas.com/clothing',
      name: 'Adidas Clothing Offer',
      brand: 'Adidas', // 已有品牌名
      country: 'UK',
      category: 'Fashion',
      status: 'pending'
    }
  ],

  adsAccounts: [
    {
      platform: 'Google Ads',
      accountId: 'acc_test_001',
      accountName: 'Test Google Ads Account',
      status: 'connected'
    }
  ],

  tasks: [
    {
      name: 'Evaluation Task 1',
      type: 'evaluation',
      status: 'pending',
      tokenCost: 1
    },
    {
      name: 'AI Evaluation Task 1',
      type: 'ai_evaluation',
      status: 'pending',
      tokenCost: 2
    }
  ]
}
```

### Mock API响应数据

```typescript
// Mock SimilarWeb API响应
const MOCK_SIMILARWEB_RESPONSE = {
  domain: 'nike.com',
  traffic: {
    monthly_visits: 85000000,
    bounce_rate: 0.35,
    avg_session_duration: 245
  },
  demographics: {
    top_countries: ['United States', 'Canada', 'United Kingdom'],
    age_distribution: [0.15, 0.25, 0.35, 0.20, 0.05]
  }
};

// Mock AI评估响应
const MOCK_AI_EVALUATION = {
  domain: 'nike.com',
  industry: 'Sports & Fashion',
  googleAdsMetrics: {
    avgCPC: 2.45,
    searchTrafficScore: 0.85,
    brandKeywordScore: 0.92,
    recommendationScore: 8.7
  },
  recommendations: [
    "Nike品牌在体育用品领域有强品牌认知度，Google广告转化率预期较高",
    "美国市场搜索量大，CPC成本适中，建议重点投放",
    "品牌词搜索流量占比高，建议配合品牌词策略最大化ROI"
  ]
};
```

---

## 🧪 新增测试脚本

### 1. Offer管理完整测试 (`test-offer-management.mjs`)

```javascript
// 测试Offer管理的完整业务流程
async function testOfferManagement() {
  // 测试1: Offer列表展示
  await testOfferListDisplay();

  // 测试2: Offer创建流程
  await testOfferCreation();

  // 测试3: Offer与Ads账号关联
  await testOfferAdsAccountLinking();

  // 测试4: Offer评估流程 (分套餐测试)
  await testOfferEvaluationBySubscription();

  // 测试5: AI推荐指数功能
  await testAIRecommendationFeatures();
}
```

### 2. AI评估功能测试 (`test-ai-evaluation.mjs`)

```javascript
// 专门测试AI评估功能
async function testAIEvaluation() {
  // 测试1: AI评估权限控制
  await testAIPermissionControl();

  // 测试2: AI评估流程完整性
  await testAIEvaluationProcess();

  // 测试3: AI推荐指数展示
  await testAIRecommendationDisplay();

  // 测试4: AI评估结果持久化
  await testAIResultsPersistence();

  // 测试5: AI评估Token消耗
  await testAIEvaluationTokenCost();
}
```

### 3. Token消耗规则测试 (`test-token-consumption.mjs`)

```javascript
// 测试Token消耗的详细规则
async function testTokenConsumption() {
  // 测试1: 不同套餐的Token消耗差异
  await testSubscriptionBasedTokenCost();

  // 测试2: Token余额不足处理
  await testInsufficientTokenHandling();

  // 测试3: Token消耗明细记录
  await testTokenTransactionRecords();

  // 测试4: Token自动充值 (如果有)
  await testAutoTokenRecharge();
}
```

### 4. 用户权限测试 (`test-user-permissions.mjs`)

```javascript
// 测试用户权限和套餐访问控制
async function testUserPermissions() {
  // 测试1: 套餐功能权限控制
  await testSubscriptionPermissions();

  // 测试2: 页面访问权限
  await testPageAccessPermissions();

  // 测试3: 功能按钮权限控制
  await testFeatureButtonPermissions();

  // 测试4: 套餐升级引导
  await testSubscriptionUpgradeGuidance();
}
```

---

## 📈 测试执行优先级

### P0 (立即执行)
1. **基础页面访问测试** - 确保所有页面可访问
2. **基础Offer管理测试** - 核心业务功能
3. **Token消耗基础测试** - 验证Token系统

### P1 (本周完成)
1. **AI评估权限控制测试** - 套餐权限验证
2. **Offer评估流程测试** - 核心业务流程
3. **用户权限测试** - 访问控制验证

### P2 (下周完成)
1. **AI评估完整流程测试** - 高级功能测试
2. **Token消耗规则详细测试** - 边界情况测试
3. **性能和稳定性测试** - 负载测试

---

## 🔧 测试环境配置

### 环境变量

```bash
# 测试环境配置
PREVIEW_BASE=https://www.urlchecker.dev
TEST_API_URL=https://www.urlchecker.dev

# SimilarWeb API配置
SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data

# Vertex AI配置
VERTEX_AI_ENDPOINT=https://vertex-ai.googleapis.com
VERTEX_AI_PROJECT=gen-lang-client-0944935873

# 测试账号配置
TEST_STARTER_EMAIL=test-starter@autoads.dev
TEST_PROFESSIONAL_EMAIL=test-professional@autoads.dev
TEST_ELITE_EMAIL=test-elite@autoads.dev
TEST_ADMIN_EMAIL=test-admin@autoads.dev
```

### 测试数据库准备

```bash
# 创建测试用户和套餐数据
node scripts/tests/create-test-subscriptions.mjs

# 创建测试Offer数据
node scripts/tests/create-test-offers.mjs

# 创建测试Ads账号数据
node scripts/tests/create-test-ads-accounts.mjs

# 创建测试任务数据
node scripts/tests/create-test-tasks.mjs
```

---

## ✅ 验收标准

### 功能完整性
- [ ] 所有页面可正常访问
- [ ] 所有按钮和表单可正常交互
- [ ] AI评估功能按套餐权限正常工作
- [ ] Token消耗规则正确执行

### 业务流程正确性
- [ ] Offer评估流程完整执行
- [ ] AI评估结果正确显示和持久化
- [ ] 套餐权限控制准确
- [ ] Token余额正确扣减

### 用户体验
- [ ] 页面加载时间 < 3秒
- [ ] 错误提示友好清晰
- [ ] 操作引导合理
- [ ] 响应式设计正常

---

**状态**: 🔄 E2E测试架构设计完成，准备实施
**预计完成时间**: 3-5天
**测试覆盖率目标**: >90%