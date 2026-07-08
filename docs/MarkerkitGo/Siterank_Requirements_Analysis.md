# Siterank服务需求分析和技术设计

## 一、需求理解和待确认问题

### 1.1 核心流程

```
用户操作: 点击Offer列表的"评估"按钮
    ↓
普通评估 (1 token):
    ├── 调用browser-exec访问Offer URL → 获取落地页、域名、品牌名
    ├── 调用browser-exec访问SimilarWeb API → 获取域名数据
    └── 保存评估结果到数据库
    ↓
AI评估 (2 tokens, 仅Elite用户):
    ├── 读取SimilarWeb数据
    ├── 调用Firebase AI Logic (Gemini)
    └── 生成AI推荐指数和3条理由
    ↓
前端展示:
    ├── Offer列表显示品牌名
    ├── 显示AI推荐指数
    └── 鼠标悬停显示推荐理由
```

### 1.2 待确认问题 🔴

#### 问题1: SimilarWeb API访问方式的技术细节

**需求描述**: "调用browser-exec服务访问SimilarWeb API"

**疑问**:
- Q1.1: SimilarWeb API是公开API还是需要登录的网页界面?
  - 如果是公开API → 直接HTTP调用即可，无需browser-exec
  - 如果是需要登录的页面 → 需要browser-exec + cookies/session

- Q1.2: SimilarWeb API的完整URL格式?
  ```
  已知: https://data.similarweb.com/api/v1/data?domain=nike.com
  疑问:
    - 是否需要API Key? (如 &apiKey=xxx)
    - 是否需要认证Header? (如 Authorization: Bearer xxx)
    - 响应格式是JSON还是HTML?
  ```

- Q1.3: 如果SimilarWeb需要账号登录
  - 账号信息存储在Secret Manager?
  - 需要维护session/cookies?
  - 频率限制(rate limit)?

**建议方案**:
```javascript
// 方案A: 如果是公开API (推荐)
const response = await fetch(
  `${SIMILARWEB_API_BASE}/data?domain=${domain}`,
  {
    headers: {
      // 无需 Authorization，公共 API 直接访问
    }
  }
);

// 方案B: 如果需要登录的网页
const result = await browserExec.evaluate({
  url: `${SIMILARWEB_API_BASE}/data?domain=${domain}`,
  mode: 'evaluate',
  extractData: {
    selector: 'pre',  // API响应通常在<pre>标签中
    format: 'json'
  }
});
```

**假设**: 先按方案A实现（公开API），若不通再改为方案B

---

#### 问题2: "评估"按钮的行为逻辑

**需求描述**:
- "Elite用户点击评估 → 自动完成AI评估"
- "非Elite用户 → 显示开通按钮"

**疑问**:
- Q2.1: 非Elite用户点击"评估"按钮的行为?
  - 选项A: 仍然执行普通评估(1 token)，但不执行AI评估
  - 选项B: 完全不执行，直接跳转到价格页面
  - 选项C: 弹窗提示"需要Elite套餐"，允许用户选择"仅普通评估"或"升级套餐"

**建议方案**:
```typescript
// 选项A (推荐): 渐进式增强
非Elite用户点击"评估":
  ✅ 执行普通评估 (消耗1 token)
  ✅ 显示域名数据
  ❌ 不执行AI评估
  💡 在AI推荐指数列显示"升级Elite解锁"按钮

Elite用户点击"评估":
  ✅ 执行普通评估 (1 token)
  ✅ 执行AI评估 (2 tokens)
  ✅ 显示完整结果
```

**理由**:
1. 用户体验更好（至少能看到部分数据）
2. 展示产品价值（让用户看到Elite的差异）
3. 降低决策门槛（先试用再升级）

---

#### 问题3: 品牌名提取和更新逻辑

**需求描述**: "若数据库中品牌名为空，则写入提取到的品牌名"

**疑问**:
- Q3.1: 如果brand extraction失败怎么办?
  - 选项A: 保持为空，标记"需要人工填写"
  - 选项B: 使用域名作为fallback (如 nike.com → "Nike")
  - 选项C: 重试机制

- Q3.2: 如果用户已手动填写品牌名，后续评估是否覆盖?
  - 选项A: 永远不覆盖手动填写的值
  - 选项B: 如果提取结果置信度高，提示用户确认

**建议方案**:
```typescript
if (offer.brandName === null || offer.brandName === '') {
  // 品牌名为空，尝试提取
  const extracted = await extractBrandName(landingPageUrl);

  if (extracted.success) {
    await updateOffer(offerId, {
      brandName: extracted.name,
      brandNameSource: 'auto_extracted',  // 标记来源
      brandNameConfidence: extracted.confidence
    });
  } else {
    // 提取失败，使用域名fallback
    await updateOffer(offerId, {
      brandName: domainToTitle(domain),  // nike.com → Nike
      brandNameSource: 'domain_fallback'
    });
  }
} else if (offer.brandNameSource === 'auto_extracted') {
  // 如果是之前自动提取的，可以更新
  // 如果是用户手动填写的(manual)，则跳过
}
```

---

#### 问题4: 缓存键设计

**需求描述**: "域名的SimilarWeb数据全局缓存"

**疑问**:
- Q4.1: 域名大小写敏感?
  - Nike.com vs nike.com vs NIKE.COM
  - 建议: 统一转为小写

- Q4.2: 子域名处理?
  - www.nike.com vs nike.com
  - shop.nike.com vs nike.com
  - 建议: 统一去除www，其他子域名保留

- Q4.3: 国际化域名(IDN)?
  - 例如: 中文.com
  - 建议: 转为Punycode存储

**建议方案**:
```javascript
function normalizeDomain(url) {
  const parsed = new URL(url);
  let domain = parsed.hostname.toLowerCase();

  // 移除www前缀
  if (domain.startsWith('www.')) {
    domain = domain.substring(4);
  }

  return domain;
}

// Redis缓存键
const cacheKey = `similarweb:${normalizeDomain(domain)}`;
```

---

#### 问题5: Token计费和扣费时机

**需求描述**:
- "普通评估消耗1 token"
- "AI评估消耗2 tokens"
- "Elite用户点击评估消耗3 tokens"

**疑问**:
- Q5.1: Token扣费时机?
  - 选项A: 评估开始前扣费（预扣）
  - 选项B: 评估成功后扣费（后扣）
  - 选项C: 分阶段扣费（普通评估成功扣1，AI评估成功扣2）

- Q5.2: 如果评估失败，Token是否退还?
  - browser-exec调用失败
  - SimilarWeb API返回错误
  - AI评估异常

- Q5.3: Token不足时的行为?
  - 选项A: 直接拒绝，提示"余额不足"
  - 选项B: 允许负余额，后续提醒充值
  - 选项C: 降级到免费模式（不调用付费API）

**建议方案**:
```go
// 方案: 预扣 + 失败退款 + 明确提示

// 1. 评估前检查余额
func (s *SiterankService) StartEvaluation(userID, offerID string, isElite bool) error {
  requiredTokens := 1
  if isElite {
    requiredTokens = 3  // 1 (普通) + 2 (AI)
  }

  // 检查余额
  balance, err := s.billing.GetBalance(userID)
  if err != nil {
    return err
  }

  if balance < requiredTokens {
    return ErrInsufficientTokens{
      Required: requiredTokens,
      Balance:  balance,
    }
  }

  // 预扣Token
  txID, err := s.billing.DeductTokens(userID, requiredTokens, "siterank_evaluation_pending")
  if err != nil {
    return err
  }

  // 异步评估
  go func() {
    err := s.performEvaluation(offerID, isElite)

    if err != nil {
      // 失败退款
      s.billing.RefundTokens(txID, "evaluation_failed")
      s.events.Publish(EvaluationFailedEvent{...})
    } else {
      // 成功确认扣费
      s.billing.ConfirmDeduction(txID, "evaluation_success")
      s.events.Publish(EvaluationCompletedEvent{...})
    }
  }()

  return nil
}
```

---

#### 问题6: AI评估的Prompt设计

**需求描述**: "评估维度包括行业、流量、关键词、产品类型、客单价、CPC等"

**疑问**:
- Q6.1: Prompt模板由谁维护?
  - 选项A: 硬编码在代码中
  - 选项B: 存储在Firestore，支持动态更新
  - 选项C: 存储在数据库，版本管理

- Q6.2: Gemini API的输出格式?
  - 结构化JSON还是自然语言?
  - 如何保证输出稳定性?

**建议方案**:
```javascript
// Prompt模板 (存储在Firestore: config/ai_prompts/siterank_evaluation)
const PROMPT_TEMPLATE = `
你是一位Google Ads投放专家。请基于以下SimilarWeb数据，评估该域名是否适合投放Google广告。

域名: {domain}
品牌名: {brandName}
SimilarWeb数据:
{similarwebData}

请按以下JSON格式输出评估结果:
{
  "recommendationScore": 85,  // 0-100分
  "industry": "运动服饰",
  "reasons": [
    "该域名月访问量达500万，具有较高的品牌知名度",
    "平均访问时长3分钟，用户粘性强，转化潜力大",
    "关键词'运动鞋'搜索量高，Google Ads CPC约$2，ROI可观"
  ],
  "trafficInsights": {
    "monthlyVisits": 5000000,
    "avgVisitDuration": 180,
    "bounceRate": 0.35
  },
  "adInsights": {
    "estimatedCPC": 2.0,
    "productType": "运动鞋",
    "avgOrderValue": 120
  }
}

注意: 必须严格按照JSON格式输出，不要添加任何额外文字。
`;
```

---

#### 问题7: 前端用户体验细节

**需求描述**: "鼠标悬停显示推荐理由"

**疑问**:
- Q7.1: 显示方式?
  - Tooltip (简洁)
  - Popover (丰富)
  - Modal (详细)

- Q7.2: 移动端如何交互?
  - Tooltip在移动端体验不好
  - 建议: 点击展开

**建议方案**:
```tsx
// 桌面端: Tooltip
<div className="ai-score-cell">
  <Badge variant="success">{score}分</Badge>
  <Tooltip>
    <TooltipTrigger>
      <InfoIcon />
    </TooltipTrigger>
    <TooltipContent>
      <h4>AI推荐理由</h4>
      <ul>
        {reasons.map(r => <li key={r}>{r}</li>)}
      </ul>
    </TooltipContent>
  </Tooltip>
</div>

// 移动端: 点击展开
<div className="ai-score-cell md:hidden">
  <Button variant="link" onClick={() => setShowReasons(true)}>
    {score}分 <ChevronDown />
  </Button>
</div>
```

---

## 二、技术栈选型

### 2.1 后端 (Siterank Service)

**选择: Go (与现有架构保持一致)**

理由:
1. ✅ 与offer/billing等服务技术栈统一
2. ✅ Firebase Admin SDK官方支持
3. ✅ 高性能并发处理
4. ✅ 统一中间件栈 (pkg/middleware)
5. ✅ Event Sourcing基础设施已有

依赖:
```go
// go.mod
require (
  firebase.google.com/go/v4 v4.13.0
  cloud.google.com/go/vertexai v0.5.0  // Gemini API
  github.com/go-chi/chi/v5 v5.0.10
  github.com/lib/pq v1.10.9
  github.com/redis/go-redis/v9 v9.3.0
)
```

### 2.2 前端 (Offer评估UI)

**选择: React + SWR + Radix UI (与现有架构保持一致)**

理由:
1. ✅ 已有Offer列表组件，扩展即可
2. ✅ SWR自动缓存和重新验证
3. ✅ Radix UI组件库完备

### 2.3 AI集成

**选择: Firebase AI Logic SDK**

理由:
1. ✅ 需求明确要求使用
2. ✅ 与Firebase Auth集成
3. ✅ 内置速率限制和配额管理

**注意**:
- Firebase AI Logic是Beta功能
- 需要启用Vertex AI API
- 计费: $0.00025/1K tokens (Gemini 1.5 Flash)

### 2.4 缓存策略

**选择: Redis (Memorystore)**

理由:
1. ✅ 已有Redis实例 (autoads-redis)
2. ✅ 支持TTL (7天成功 / 1小时失败)
3. ✅ 高性能读写

缓存结构:
```redis
# SimilarWeb缓存
SET similarweb:{domain} {json_data} EX 604800  # 7天
SET similarweb:{domain}:error {error_msg} EX 3600  # 1小时

# 评估结果缓存 (可选，减少数据库查询)
SET eval:{offerID}:basic {json} EX 86400  # 1天
SET eval:{offerID}:ai {json} EX 86400
```

---

## 三、数据库Schema设计

### 3.1 表设计

```sql
-- 1. Offer评估记录表
CREATE TABLE offer_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联
  user_id UUID NOT NULL REFERENCES auth.users(id),
  offer_id UUID NOT NULL REFERENCES "Offer"(id) ON DELETE CASCADE,

  -- Offer URL Hash (汇聚key)
  offer_url_hash VARCHAR(64) NOT NULL,  -- SHA256(original_url)

  -- 评估类型
  evaluation_type VARCHAR(20) NOT NULL,  -- 'basic' | 'ai'

  -- 落地页信息
  landing_page_url TEXT,
  domain VARCHAR(255),
  brand_name TEXT,
  brand_extraction_confidence FLOAT,  -- 0.0-1.0

  -- SimilarWeb数据
  similarweb_data JSONB,
  similarweb_cached BOOLEAN DEFAULT false,

  -- AI评估结果 (仅evaluation_type='ai'时有值)
  ai_recommendation_score INTEGER,  -- 0-100
  ai_reasons JSONB,  -- ["reason1", "reason2", "reason3"]
  ai_industry TEXT,
  ai_traffic_insights JSONB,
  ai_ad_insights JSONB,

  -- Token消耗
  tokens_consumed INTEGER NOT NULL,

  -- 状态
  status VARCHAR(20) NOT NULL,  -- 'pending' | 'success' | 'failed'
  error_message TEXT,

  -- 时间
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_offer_evaluations_user_id ON offer_evaluations(user_id);
CREATE INDEX idx_offer_evaluations_offer_id ON offer_evaluations(offer_id);
CREATE INDEX idx_offer_evaluations_url_hash ON offer_evaluations(offer_url_hash);
CREATE INDEX idx_offer_evaluations_created_at ON offer_evaluations(created_at DESC);

-- RLS
ALTER TABLE offer_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own evaluations"
  ON offer_evaluations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can access all evaluations"
  ON offer_evaluations
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- 2. 扩展Offer表 (添加品牌名相关字段)
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS brand_name_source VARCHAR(20);  -- 'manual' | 'auto_extracted' | 'domain_fallback'
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS brand_name_confidence FLOAT;

-- 3. AI评估历史表 (用于分析和优化)
CREATE TABLE ai_evaluation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES offer_evaluations(id),

  -- Prompt和响应
  prompt_text TEXT NOT NULL,
  prompt_version VARCHAR(20),
  response_raw TEXT NOT NULL,
  response_parsed JSONB,

  -- 性能指标
  tokens_input INTEGER,
  tokens_output INTEGER,
  latency_ms INTEGER,
  model_version VARCHAR(50),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 创建视图：最新评估结果
CREATE OR REPLACE VIEW offer_evaluations_latest AS
SELECT DISTINCT ON (offer_id, evaluation_type)
  id,
  user_id,
  offer_id,
  evaluation_type,
  domain,
  brand_name,
  ai_recommendation_score,
  ai_reasons,
  status,
  completed_at
FROM offer_evaluations
WHERE status = 'success'
ORDER BY offer_id, evaluation_type, completed_at DESC;
```

---

## 四、API接口设计

### 4.1 OpenAPI规范

```yaml
# services/siterank/api/openapi.yaml

openapi: 3.0.0
info:
  title: Siterank Service API
  version: 1.0.0
  description: Offer评估和域名分析服务

paths:
  /evaluations:
    post:
      summary: 创建Offer评估任务
      operationId: createEvaluation
      tags: [Evaluations]
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [offerId]
              properties:
                offerId:
                  type: string
                  format: uuid
                  description: Offer ID
                includeAI:
                  type: boolean
                  default: false
                  description: 是否包含AI评估 (需要Elite套餐)
      responses:
        '202':
          description: 评估任务已创建，异步处理中
          content:
            application/json:
              schema:
                type: object
                properties:
                  evaluationId:
                    type: string
                    format: uuid
                  status:
                    type: string
                    enum: [pending]
                  estimatedTokens:
                    type: integer
                    description: 预计消耗的tokens
        '402':
          description: Token余额不足
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '403':
          description: 需要Elite套餐才能使用AI评估
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /evaluations/{id}:
    get:
      summary: 获取评估结果
      operationId: getEvaluation
      tags: [Evaluations]
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: 评估结果
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Evaluation'

  /offers/{offerId}/evaluations:
    get:
      summary: 获取Offer的所有评估记录
      operationId: getOfferEvaluations
      tags: [Evaluations]
      security:
        - bearerAuth: []
      parameters:
        - name: offerId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: type
          in: query
          schema:
            type: string
            enum: [basic, ai]
      responses:
        '200':
          description: 评估记录列表
          content:
            application/json:
              schema:
                type: object
                properties:
                  evaluations:
                    type: array
                    items:
                      $ref: '#/components/schemas/Evaluation'

  /domains/{domain}/similarweb:
    get:
      summary: 获取域名的SimilarWeb数据 (优先从缓存)
      operationId: getSimilarWebData
      tags: [Domains]
      security:
        - bearerAuth: []
      parameters:
        - name: domain
          in: path
          required: true
          schema:
            type: string
            example: nike.com
      responses:
        '200':
          description: SimilarWeb数据
          content:
            application/json:
              schema:
                type: object
                properties:
                  domain:
                    type: string
                  data:
                    type: object
                  cached:
                    type: boolean
                  cachedAt:
                    type: string
                    format: date-time

components:
  schemas:
    Evaluation:
      type: object
      properties:
        id:
          type: string
          format: uuid
        offerId:
          type: string
          format: uuid
        evaluationType:
          type: string
          enum: [basic, ai]
        status:
          type: string
          enum: [pending, success, failed]
        landingPageUrl:
          type: string
        domain:
          type: string
        brandName:
          type: string
        similarwebData:
          type: object
        aiRecommendationScore:
          type: integer
          minimum: 0
          maximum: 100
        aiReasons:
          type: array
          items:
            type: string
          maxItems: 3
        tokensConsumed:
          type: integer
        startedAt:
          type: string
          format: date-time
        completedAt:
          type: string
          format: date-time

    Error:
      type: object
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: object

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

---

## 五、实现计划

### 5.1 实施步骤

```
Phase 1: 数据库和基础架构 (1-2天)
  ✓ 创建数据库迁移文件
  ✓ 扩展Offer表添加brand_name字段
  ✓ 创建offer_evaluations表

Phase 2: 后端核心功能 (3-4天)
  ✓ SimilarWeb API集成和缓存
  ✓ Browser-exec调用封装
  ✓ 品牌名提取逻辑
  ✓ 评估流程编排
  ✓ Token扣费集成

Phase 3: AI集成 (2-3天)
  ✓ Firebase AI Logic SDK集成
  ✓ Prompt工程和优化
  ✓ 响应解析和验证
  ✓ 错误处理和重试

Phase 4: 前端开发 (2-3天)
  ✓ Offer列表添加"评估"按钮
  ✓ 添加AI推荐指数列
  ✓ Tooltip/Popover交互
  ✓ 套餐升级引导

Phase 5: 测试和优化 (2天)
  ✓ 单元测试
  ✓ 集成测试
  ✓ 性能优化
  ✓ 文档完善
```

### 5.2 风险和缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| SimilarWeb API不稳定 | 高 | 1. 实现重试机制<br>2. 降级到免费API<br>3. 缓存策略 |
| Gemini API成本过高 | 中 | 1. Prompt优化减少tokens<br>2. 结果缓存<br>3. 仅Elite用户 |
| Brand extraction失败率高 | 中 | 1. 多种提取策略<br>2. Fallback到域名<br>3. 人工审核入口 |
| Token扣费争议 | 低 | 1. 明确计费规则<br>2. 失败退款<br>3. 详细账单 |

---

## 六、用户体验优化建议

### 6.1 减少用户操作

```typescript
// 建议1: 批量评估
在Offer列表添加"批量评估"按钮
  - 选择多个Offer → 一键评估
  - 显示进度条
  - 失败自动重试

// 建议2: 自动评估
新创建的Offer自动触发评估
  - 创建Offer后台异步评估
  - 评估完成推送通知
  - 节省用户手动点击

// 建议3: 评估历史
查看Offer的评估历史趋势
  - SimilarWeb数据随时间变化
  - AI推荐指数变化
  - 帮助用户决策
```

### 6.2 降低技术难度

```
建议1: 使用OpenAPI Generator
  - 自动生成Go服务端代码
  - 自动生成TypeScript SDK
  - 保证类型安全

建议2: 复用Browser-exec结果
  - url_visit_results表已有landing page数据
  - 避免重复调用browser-exec
  - 节省成本和时间

建议3: Firebase AI Logic封装
  - 创建统一的AIClient类
  - 隐藏Prompt细节
  - 便于后续切换模型
```

---

## 七、总结

### 需要确认的关键问题 (Priority排序)

🔴 **P0 (必须确认)**:
1. SimilarWeb API的访问方式（公开API vs 需要登录）
2. Token扣费时机和退款策略
3. 非Elite用户点击"评估"的具体行为

🟡 **P1 (建议确认)**:
1. AI Prompt模板存储方式
2. 品牌名提取失败的Fallback策略
3. 移动端AI推荐理由的展示方式

🟢 **P2 (可后续优化)**:
1. 批量评估功能
2. 评估历史趋势图
3. AI评估结果的人工反馈机制

### 技术栈确定

- ✅ 后端: Go + Chi + Firebase Admin SDK
- ✅ AI: Firebase AI Logic (Gemini 1.5 Flash)
- ✅ 缓存: Redis (Memorystore)
- ✅ 数据库: PostgreSQL (扩展现有schema)
- ✅ 前端: React + SWR + Radix UI

准备好后即可开始实施！
