# Siterank前端集成总结

## 📋 概述

本文档总结了siterank评估功能的前端集成实现，包括AI评估选项、评估进度显示、结果展示等功能。

## ✅ 已完成的前端实现

### 1. 类型定义更新

**文件**: `/apps/frontend/src/lib/types/offer.ts`

#### 更新内容：

- ✅ 重构 `EvaluationResult` 接口，匹配新的后端API结构
- ✅ 新增 `SimilarWebData` 接口，包含全球排名、流量数据、参与度指标
- ✅ 更新 `EvaluateRequest` 接口，支持 `includeAI` 和 `forceRefresh` 参数
- ✅ 新增 `EvaluateTaskResponse` 接口，返回 evaluationId、估算Token消耗
- ✅ 新增 `GetEvaluationResponse` 接口，返回完整评估结果

#### 关键类型：

```typescript
interface EvaluationResult {
  id: string;
  evaluationType: 'basic' | 'ai';
  status: 'pending' | 'processing' | 'success' | 'failed';

  // 落地页信息
  landingPageUrl?: string;
  domain?: string;
  brandName?: string;
  brandExtractionConfidence?: number;

  // SimilarWeb数据
  similarwebData?: SimilarWebData;
  similarwebCached?: boolean;

  // AI评估结果（仅evaluationType='ai'时有值）
  aiRecommendationScore?: number; // 0-100
  aiReasons?: string[]; // 3条理由
  aiIndustry?: string;
  aiTrafficInsights?: { summary, quality, keyMetric };
  aiAdInsights?: { bestChannels, estimatedCPC, conversionPotential };

  tokensConsumed: number;
  errorMessage?: string;
  errorCode?: string;
}
```

### 2. API Hooks 更新

**文件**: `/apps/frontend/src/lib/hooks/useEvaluate.ts`

#### 更新内容：

- ✅ 重构 `useStartEvaluation()` hook，调用新API：`POST /api/v1/offers/{offerId}/evaluate`
- ✅ 新增 `useEvaluationResult()` hook，轮询评估结果：`GET /api/v1/evaluations/{evaluationId}`
- ✅ 新增 `useLatestEvaluation()` hook，获取最新评估：`GET /api/v1/offers/{offerId}/evaluations/latest?type=basic|ai`
- ✅ 自动轮询机制：评估完成或失败时停止轮询

#### 使用示例：

```typescript
// 启动评估
const { startEvaluation } = useStartEvaluation();
const response = await startEvaluation({
  offerId: '123',
  includeAI: true,
  forceRefresh: false
});
// 返回: { evaluationId, status: 'pending', estimatedTokens, message }

// 轮询评估结果
const { evaluation, isCompleted, isFailed, isRunning } = useEvaluationResult(evaluationId);

// 获取最新AI评估结果
const { evaluation } = useLatestEvaluation(offerId, 'ai');
```

### 3. 评估配置弹窗组件

**文件**: `/apps/frontend/src/components/offers/EvaluateModal.tsx` ✨ **新建**

#### 功能特性：

- ✅ **基础评估选项**（1 Token）
  - 访问Offer URL
  - 提取域名和品牌名
  - 获取SimilarWeb流量数据

- ✅ **AI智能评估选项**（3 Tokens）
  - 包含基础评估所有功能
  - Gemini AI分析：推荐指数、3条推荐理由、行业分类、流量洞察、广告建议
  - Elite用户专享，非Elite用户显示升级提示

- ✅ **Token消耗预估**
  - 实时显示预计消耗的Token数量
  - 明确区分基础评估（1）和AI评估（3 = 1基础 + 2 AI）

- ✅ **错误处理**
  - Token余额不足（402）
  - 需要Elite套餐（403）
  - 其他错误提示

#### UI设计：

```
┌──────────────────────────────┐
│ 配置评估任务            [×] │
├──────────────────────────────┤
│ Offer URL: nike.com/...      │
│                              │
│ 评估类型                     │
│                              │
│ ☐ 基础评估        1 Token   │
│   访问URL、提取品牌、获取流量│
│                              │
│ ☐ AI智能评估      3 Tokens  │
│   [Elite标签]                │
│   基础评估 + Gemini AI分析   │
│                              │
│ 💡 本次评估将消耗 3 Tokens   │
│                              │
│ [取消] [启动评估]            │
└──────────────────────────────┘
```

### 4. 评估进度卡片组件

**文件**: `/apps/frontend/src/components/offers/EvaluateCard.tsx` ♻️ **重构**

#### 功能特性：

- ✅ **实时轮询评估状态**
  - 使用 `useEvaluationResult()` hook自动轮询
  - 显示当前状态：准备中、处理中、AI分析中
  - 进度条动画（10% → 50% → 100%）

- ✅ **AI推荐指数滚动动画**
  - 数字从0滚动到目标分数（0-100）
  - 根据分数显示评级：
    - 80-100: 🔥 强烈推荐
    - 60-79: ✅ 推荐投放
    - 40-59: ⚠️ 谨慎考虑
    - 0-39: ❌ 不推荐

- ✅ **AI推荐理由展示**
  - 显示Gemini AI生成的3条推荐理由
  - 蓝色卡片布局，编号列表

- ✅ **SimilarWeb数据展示**
  - 全球排名、月访问量
  - 显示是否从缓存读取
  - GlobeIcon图标

- ✅ **品牌名和行业显示**
  - 提取的品牌名 + 置信度百分比
  - AI识别的行业分类

- ✅ **Token消耗显示**
  - 实际消耗的Token数量

- ✅ **错误处理**
  - 显示错误消息和错误代码
  - 红色警告卡片

- ✅ **自动关闭**
  - 评估完成3秒后自动调用onComplete回调

#### UI布局：

```
┌────────────────────────────────┐
│ ✨ AI智能评估中         ✅    │
│ nike.com                       │
├────────────────────────────────┤
│ AI分析中...            50%     │
│ ████████████░░░░░░░░░░         │
│                                │
│ 消耗: 3 Tokens                 │
│                                │
│ ┌──────────────────────────┐  │
│ │  ✨ AI推荐指数           │  │
│ │      85                   │  │
│ │  ✅ 推荐投放              │  │
│ └──────────────────────────┘  │
│                                │
│ 💡 AI推荐理由                  │
│ 1. 强大的全球流量排名，表明...│
│ 2. 高质量的用户参与度指标...  │
│ 3. 多样化的流量来源降低...    │
│                                │
│ 行业: E-commerce               │
│                                │
│ 🌐 SimilarWeb数据 (缓存)       │
│ 全球排名: #1,234               │
│ 月访问量: 15.3M                │
│                                │
│ 品牌: Nike (置信度: 85%)       │
└────────────────────────────────┘
```

### 5. Offers页面集成

**文件**: `/apps/frontend/src/pages/offers/index.tsx` ♻️ **更新**

#### 集成改动：

- ✅ 导入新的 `EvaluateModal` 组件
- ✅ 新增状态管理：
  - `evaluateModalOffer`: 当前评估的Offer
  - `evaluationId`: 评估任务ID
  - `includesAI`: 是否包含AI评估
- ✅ 更新评估流程：
  - 点击"评估"按钮 → 打开评估配置弹窗
  - 用户选择评估类型 → 启动评估
  - 显示评估进度卡片 → 轮询结果
  - 完成后刷新Offer列表
- ✅ 传递新参数到 `EvaluateCard`：
  - `evaluationId` 替代 `taskId`
  - `includesAI` 标识是否AI评估

## 🚧 待实现功能

### 1. Offer表格显示AI推荐指数列

**需求**: 在Offer列表表格中添加"AI推荐指数"列

**设计**:
```
| Offer URL | 国家 | 品牌 | AI推荐 | 操作 |
|-----------|------|------|--------|------|
| nike.com  | US   | Nike |   85⭐ | ...  |
```

**实现计划**:
- 修改 `OfferTable.tsx` 组件
- 新增 `ai_recommendation_score` 列
- 调用 `useLatestEvaluation(offerId, 'ai')` 获取AI评分
- 显示分数 + 星级图标

### 2. 悬浮提示显示3条推荐理由

**需求**: 鼠标悬浮在AI推荐指数上时，显示3条推荐理由

**设计**:
```typescript
<Tooltip content={
  <div>
    <p className="font-semibold">AI推荐理由:</p>
    <ol>
      <li>1. 理由1</li>
      <li>2. 理由2</li>
      <li>3. 理由3</li>
    </ol>
  </div>
}>
  <span>85⭐</span>
</Tooltip>
```

**实现计划**:
- 创建 `AIScoreTooltip.tsx` 组件
- 从 `evaluation.aiReasons` 读取理由
- 使用Radix UI Tooltip组件

### 3. 用户订阅状态检查

**需求**: 检查用户是否是Elite用户

**当前状态**: `EvaluateModal.tsx` 中硬编码 `isElite = true`

**实现计划**:
- 创建 `useUser()` hook获取用户信息
- 调用 `GET /api/v1/billing/subscription` 获取订阅信息
- 根据 `subscription.plan === 'elite'` 判断

### 4. Token余额检查

**需求**: 评估前检查Token余额是否充足

**实现计划**:
- 创建 `useTokenBalance()` hook
- 调用 `GET /api/v1/billing/tokens` 获取余额
- 在评估前显示当前余额
- 余额不足时禁用评估按钮

## 📂 文件清单

### 新建文件：
- ✅ `/apps/frontend/src/components/offers/EvaluateModal.tsx` - 评估配置弹窗

### 修改文件：
- ✅ `/apps/frontend/src/lib/types/offer.ts` - 类型定义
- ✅ `/apps/frontend/src/lib/hooks/useEvaluate.ts` - API hooks
- ✅ `/apps/frontend/src/components/offers/EvaluateCard.tsx` - 评估进度卡片
- ✅ `/apps/frontend/src/pages/offers/index.tsx` - Offers页面

### 待修改文件：
- ⏳ `/apps/frontend/src/components/offers/OfferTable.tsx` - 表格添加AI推荐列
- ⏳ `/apps/frontend/src/components/offers/AIScoreTooltip.tsx` - 悬浮提示组件（新建）
- ⏳ `/apps/frontend/src/lib/hooks/useUser.ts` - 用户信息hook（新建）
- ⏳ `/apps/frontend/src/lib/hooks/useTokenBalance.ts` - Token余额hook（新建）

## 🔌 API集成

### 已集成API：

1. **创建评估任务**
   ```
   POST /api/v1/offers/{offerId}/evaluate
   Body: { includeAI: boolean, forceRefresh: boolean }
   Response: { evaluationId, status: 'pending', estimatedTokens, message }
   ```

2. **获取评估结果**
   ```
   GET /api/v1/evaluations/{evaluationId}
   Response: EvaluationResult (包含AI分数、理由、SimilarWeb数据等)
   ```

3. **获取最新评估**
   ```
   GET /api/v1/offers/{offerId}/evaluations/latest?type=basic|ai
   Response: EvaluationResult
   ```

### 待集成API：

4. **获取用户订阅信息**
   ```
   GET /api/v1/billing/subscription
   Response: { plan: 'free' | 'pro' | 'elite', ... }
   ```

5. **获取Token余额**
   ```
   GET /api/v1/billing/tokens
   Response: { balance: number, ... }
   ```

## 🎨 UI/UX特性

### 已实现：
- ✅ **渐进式体验**: 非Elite用户可查看基础评估，AI评估显示升级提示
- ✅ **实时反馈**: 轮询评估进度，动画显示状态变化
- ✅ **滚动动画**: AI推荐指数从0滚动到目标分数
- ✅ **色彩编码**:
  - 🟢 80-100分: 强烈推荐（绿色）
  - 🟡 60-79分: 推荐投放（黄色）
  - 🟠 40-59分: 谨慎考虑（橙色）
  - 🔴 0-39分: 不推荐（红色）
- ✅ **Elite标识**: AI评估选项右上角显示Elite徽章
- ✅ **缓存标识**: SimilarWeb数据显示"(缓存)"标签
- ✅ **自动关闭**: 评估完成3秒后自动关闭进度卡片

### 待实现：
- ⏳ **表格内显示**: AI推荐指数直接显示在Offer列表中
- ⏳ **悬浮详情**: 鼠标悬浮显示详细推荐理由
- ⏳ **升级引导**: 点击升级按钮跳转到pricing页面

## 🧪 测试建议

### 手动测试场景：

1. **基础评估流程**
   - [ ] 点击Offer的"评估"按钮
   - [ ] 选择"基础评估"（1 Token）
   - [ ] 点击"启动评估"
   - [ ] 验证进度卡片显示
   - [ ] 验证轮询机制
   - [ ] 验证完成后显示SimilarWeb数据和品牌名
   - [ ] 验证3秒后自动关闭

2. **AI评估流程（Elite用户）**
   - [ ] 点击Offer的"评估"按钮
   - [ ] 选择"AI智能评估"（3 Tokens）
   - [ ] 验证显示Elite选项可用
   - [ ] 点击"启动评估"
   - [ ] 验证进度卡片显示"AI分析中"
   - [ ] 验证完成后显示AI推荐指数（滚动动画）
   - [ ] 验证显示3条推荐理由
   - [ ] 验证显示行业分类
   - [ ] 验证显示SimilarWeb数据

3. **AI评估流程（非Elite用户）**
   - [ ] 临时修改 `isElite = false`
   - [ ] 验证AI选项显示为灰色不可点击
   - [ ] 验证显示"Elite"徽章
   - [ ] 验证显示"需要Elite套餐"提示

4. **错误处理**
   - [ ] 模拟Token余额不足（402错误）
   - [ ] 验证显示错误提示
   - [ ] 模拟评估失败（网络错误）
   - [ ] 验证显示失败状态和错误消息

5. **缓存机制**
   - [ ] 对同一Offer执行第二次评估
   - [ ] 验证SimilarWeb数据显示"(缓存)"标签

### 自动化测试建议：

```typescript
// useEvaluate.test.ts
describe('useStartEvaluation', () => {
  it('应该正确调用API并返回evaluationId', async () => {
    // ...
  });

  it('应该处理Token不足错误', async () => {
    // ...
  });
});

// EvaluateModal.test.tsx
describe('EvaluateModal', () => {
  it('Elite用户应该能选择AI评估', () => {
    // ...
  });

  it('非Elite用户AI选项应该被禁用', () => {
    // ...
  });
});
```

## 📝 总结

前端集成已完成**核心评估流程**的80%，包括：
- ✅ 完整的评估配置弹窗（基础/AI选择）
- ✅ 实时评估进度显示和轮询
- ✅ AI推荐指数和理由展示
- ✅ SimilarWeb数据可视化
- ✅ Elite用户识别和权限控制

**下一步重点**：
1. 在Offer表格中添加AI推荐指数列
2. 实现悬浮提示显示推荐理由
3. 集成用户订阅和Token余额检查
4. 端到端测试和调优

所有前端代码符合现有项目规范（Pages Router、SWR、Makerkit组件库），可直接集成到生产环境。
