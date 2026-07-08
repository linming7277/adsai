# Offer评估系统完整设计方案

**文档版本**: V1.0
**创建时间**: 2025-10-15
**状态**: ✅ 设计完成，待开发
**负责团队**: Backend Team + Frontend Team

---

## 📋 目录

1. [业务需求概述](#业务需求概述)
2. [系统架构设计](#系统架构设计)
3. [数据库Schema设计](#数据库schema设计)
4. [API设计](#api设计)
5. [SimilarWeb集成方案](#similarweb集成方案)
6. [Vertex AI Gemini集成方案](#vertex-ai-gemini集成方案)
7. [套餐权限控制](#套餐权限控制)
8. [Token消耗计算](#token消耗计算)
9. [前端UI设计](#前端ui设计)
10. [实施计划](#实施计划)

---

## 业务需求概述

### 核心功能

**目标**: 为Offer提供智能评估能力，包括基础数据抓取和AI价值分析

**13个关键需求**:

1. ✅ 用户在/offers页面点击"评估"按钮触发评估
2. ✅ 评估流程：browser-exec获取落地页/域名/品牌 → SimilarWeb获取流量数据
3. ✅ SimilarWeb API: `https://data.similarweb.com/api/v1/data?domain=nike.com`
4. ✅ 自动回填品牌名（若数据库为空）
5. ✅ 持久化评估数据，实现用户级隔离
6. ✅ URL Hash作为数据聚合Key
7. ✅ SimilarWeb全局缓存（成功7天，失败1小时）
8. ✅ AI评估仅对Pro/Elite开放（Starter显示"开通"按钮）
9. ✅ Vertex AI Gemini分析SimilarWeb数据
10. ✅ Offer列表新增"AI推荐指数"列
11. ✅ Pro/Elite用户自动触发AI评估
12. ✅ Token消耗：普通1 + AI 2 = 组合3
13. ✅ UX优化：减少操作、提升体验

### 用户流程

```
┌─────────────────────────────────────────────────────────────────┐
│ Starter用户                                                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. 点击"评估"按钮                                                 │
│ 2. 消耗1个Token，执行普通评估                                      │
│ 3. 获取：落地页、域名、品牌、SimilarWeb流量数据                      │
│ 4. "AI推荐指数"列显示"开通"按钮 → 引导至/pricing                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Professional/Elite用户                                           │
├─────────────────────────────────────────────────────────────────┤
│ 1. 点击"评估"按钮                                                 │
│ 2. 消耗3个Token（普通1 + AI 2），自动执行普通+AI评估                │
│ 3. 获取：普通评估数据 + AI推荐指数 + 3条推荐理由                    │
│ 4. "AI推荐指数"列显示分数，点击后弹窗查看详情                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 系统架构设计

### 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                          Frontend                                 │
│  /dashboard/offers (Offer列表 + 评估按钮 + AI推荐指数列)            │
└────────────────────────┬─────────────────────────────────────────┘
                         │ POST /api/v1/offers/{id}/evaluate
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Offer Service                               │
│  1. 检查用户套餐（Billing Service）                                 │
│  2. 预扣Token（Billing Service）                                   │
│  3. 发布Pub/Sub消息 → siterank.evaluate                            │
└────────────────────────┬─────────────────────────────────────────┘
                         │ Pub/Sub Message
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Siterank Service                             │
│  Step 1: 调用Browser-Exec获取域名和品牌                             │
│  Step 2: 查询SimilarWeb全局缓存                                    │
│  Step 3: 若缓存未命中，调用Browser-Exec访问SimilarWeb API           │
│  Step 4: 更新全局缓存（成功7天，失败1小时）                           │
│  Step 5: 若是Pro/Elite用户，调用Vertex AI Gemini进行AI评估          │
│  Step 6: 持久化评估结果（以URL Hash为Key）                          │
│  Step 7: 确认Token消耗（Billing Service）                          │
│  Step 8: 更新Offer品牌名（若为空）                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 服务交互时序图

```
User            Frontend          Offer Service       Billing Service     Siterank Service    Browser-Exec       SimilarWeb API      Vertex AI
 |                 |                    |                    |                    |                 |                  |                 |
 |-- 点击评估 ----->|                    |                    |                    |                 |                  |                 |
 |                 |-- POST /evaluate ->|                    |                    |                 |                  |                 |
 |                 |                    |-- 查询用户套餐 ---->|                    |                 |                  |                 |
 |                 |                    |<-- Starter/Pro ----|                    |                 |                  |                 |
 |                 |                    |                    |                    |                 |                  |                 |
 |                 |                    |-- 预扣Token(1或3)->|                    |                 |                  |                 |
 |                 |                    |<-- 预扣成功 --------|                    |                 |                  |                 |
 |                 |                    |                    |                    |                 |                  |                 |
 |                 |                    |-- Pub/Sub消息 ------------------------->|                 |                  |                 |
 |                 |                    |                    |                    |                 |                  |                 |
 |                 |<-- 202 Accepted ---|                    |                    |                 |                  |                 |
 |                 |                    |                    |                    |                 |                  |                 |
 |                 |                    |                    |                    |-- /evaluate-offer -->               |                 |
 |                 |                    |                    |                    |<-- domain, brand --|                |                 |
 |                 |                    |                    |                    |                 |                  |                 |
 |                 |                    |                    |                    |-- 查询全局缓存 --|                  |                 |
 |                 |                    |                    |                    |<-- Cache Miss ---|                  |                 |
 |                 |                    |                    |                    |                 |                  |                 |
 |                 |                    |                    |                    |-- /resolve + visit SimilarWeb ------>|                 |
 |                 |                    |                    |                    |<-- HTML content ---------------------|                 |
 |                 |                    |                    |                    |-- 解析JSON数据 --|                  |                 |
 |                 |                    |                    |                    |-- 写入全局缓存 --|                  |                 |
 |                 |                    |                    |                    |                 |                  |                 |
 |                 |                    |                    |                    |-- (若Pro/Elite) 调用AI -------------------------------->|
 |                 |                    |                    |                    |<-- AI推荐指数+理由 -----------------------------------|
 |                 |                    |                    |                    |                 |                  |                 |
 |                 |                    |                    |                    |-- 持久化结果 ----|                  |                 |
 |                 |                    |                    |                    |-- 确认Token ---->|                  |                 |
 |                 |                    |                    |                    |-- 更新Offer品牌->|                  |                 |
 |                 |                    |                    |                    |                 |                  |                 |
 |<-- SSE通知完成 -|<-- 发送通知 -------|<-- Pub/Sub消息 ----|                    |                 |                  |                 |
 |                 |                    |                    |                    |                 |                  |                 |
```

### 关键设计点

1. **异步处理**: Offer Service接收请求后立即返回202，通过Pub/Sub异步处理
2. **Token预扣**: 先预扣Token，成功后确认消耗，失败则退还
3. **全局缓存**: SimilarWeb数据全局共享，不区分用户
4. **URL Hash**: 使用SHA-256(URL)作为数据聚合Key
5. **套餐判断**: 在Offer Service中判断，Siterank Service根据参数决定是否调用AI
6. **失败重试**: Pub/Sub提供自动重试（最多3次）

---

## 数据库Schema设计

### 1. Siterank Service数据库

#### 表1: `offer_evaluations` (评估结果表)

**用途**: 存储每次评估的完整结果，实现用户级隔离

```sql
CREATE TABLE offer_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,                    -- 用户ID（RLS隔离）
    offer_id UUID NOT NULL,                   -- Offer ID
    offer_url_hash VARCHAR(64) NOT NULL,      -- URL Hash (SHA-256)
    offer_url TEXT NOT NULL,                  -- 原始Offer URL

    -- 基础信息
    final_landing_url TEXT,                   -- 最终落地页
    domain VARCHAR(255),                      -- 域名（如nike.com）
    brand_name VARCHAR(255),                  -- 品牌名
    redirect_chain JSONB,                     -- 重定向链（JSON数组）

    -- SimilarWeb数据
    similarweb_data JSONB,                    -- 完整的SimilarWeb响应
    similarweb_cached BOOLEAN DEFAULT false,  -- 是否从缓存读取

    -- AI评估结果（仅Pro/Elite有数据）
    ai_recommendation_score INTEGER,          -- AI推荐指数 (0-100)
    ai_recommendation_reasons JSONB,          -- 3条推荐理由（JSON数组）
    ai_evaluation_raw JSONB,                  -- AI完整响应

    -- 元数据
    status VARCHAR(20) NOT NULL,              -- pending, running, completed, failed
    error_message TEXT,                       -- 错误信息
    started_at TIMESTAMP,                     -- 开始时间
    completed_at TIMESTAMP,                   -- 完成时间
    tokens_consumed INTEGER DEFAULT 0,        -- 本次消耗Token数（1或3）

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- 索引
    INDEX idx_user_offer (user_id, offer_id),
    INDEX idx_url_hash (offer_url_hash),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at DESC)
);

-- RLS策略
ALTER TABLE offer_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_own_evaluations ON offer_evaluations
    FOR ALL USING (user_id = current_setting('app.user_id')::uuid);
```

#### 表2: `similarweb_global_cache` (全局缓存表)

**用途**: 全局共享SimilarWeb数据，不区分用户

```sql
CREATE TABLE similarweb_global_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,      -- 域名（唯一索引）
    domain_hash VARCHAR(64) NOT NULL,         -- 域名Hash (SHA-256)

    -- 缓存数据
    similarweb_data JSONB NOT NULL,           -- 完整的SimilarWeb响应
    is_success BOOLEAN NOT NULL,              -- 是否成功获取数据

    -- 缓存元数据
    fetched_at TIMESTAMP NOT NULL DEFAULT NOW(), -- 数据获取时间
    expires_at TIMESTAMP NOT NULL,            -- 过期时间（成功7天，失败1小时）
    hit_count INTEGER DEFAULT 0,              -- 缓存命中次数
    last_hit_at TIMESTAMP,                    -- 最后命中时间

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- 索引
    INDEX idx_domain (domain),
    INDEX idx_domain_hash (domain_hash),
    INDEX idx_expires_at (expires_at)
);

-- 无RLS策略（全局共享）
```

#### 表3: `evaluation_aggregations` (URL聚合数据)

**用途**: 按URL Hash聚合所有评估数据，用于分析和展示

```sql
CREATE TABLE evaluation_aggregations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_url_hash VARCHAR(64) NOT NULL UNIQUE, -- URL Hash (唯一)
    offer_url TEXT NOT NULL,                    -- 原始URL

    -- 聚合统计
    total_evaluations INTEGER DEFAULT 0,        -- 总评估次数
    last_evaluation_id UUID,                    -- 最后一次评估ID
    last_evaluation_at TIMESTAMP,               -- 最后评估时间

    -- 最新数据快照
    latest_domain VARCHAR(255),
    latest_brand VARCHAR(255),
    latest_similarweb_data JSONB,
    latest_ai_score INTEGER,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- 索引
    INDEX idx_url_hash (offer_url_hash),
    INDEX idx_updated_at (updated_at DESC)
);

-- 无RLS策略（内部使用）
```

### 2. Offer Service数据库

#### 现有表修改: `offers`

**新增字段**:

```sql
ALTER TABLE offers ADD COLUMN IF NOT EXISTS brand_name VARCHAR(255);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS brand_name_auto_filled BOOLEAN DEFAULT false;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS latest_evaluation_id UUID;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS latest_ai_score INTEGER;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS last_evaluated_at TIMESTAMP;

CREATE INDEX idx_offers_brand_name ON offers(brand_name);
CREATE INDEX idx_offers_ai_score ON offers(latest_ai_score DESC);
```

### 3. 数据流向

```
用户触发评估
    ↓
Offer Service预扣Token
    ↓
Siterank Service创建evaluation记录（status=pending）
    ↓
Browser-Exec获取domain + brand
    ↓
查询similarweb_global_cache (按domain)
    ↓
若缓存未过期 → 直接使用
若缓存过期/不存在 → Browser-Exec访问SimilarWeb API → 写入缓存
    ↓
若Pro/Elite → 调用Vertex AI → 写入ai_recommendation_*字段
    ↓
更新evaluation记录（status=completed）
    ↓
更新evaluation_aggregations (按offer_url_hash聚合)
    ↓
更新offers表（brand_name, latest_ai_score等）
    ↓
确认Token消耗
    ↓
通知用户完成
```

---

## API设计

### 1. Offer Service新增端点

#### POST `/api/v1/offers/{offerId}/evaluate`

**用途**: 用户触发Offer评估（普通或AI）

**请求**:
```json
{
  "forceRefresh": false  // 可选，强制刷新缓存
}
```

**响应**:
```json
{
  "evaluationId": "uuid",
  "status": "pending",
  "estimatedTokens": 3,  // Starter: 1, Pro/Elite: 3
  "message": "评估已开始，请稍候..."
}
```

**状态码**:
- 202 Accepted: 评估已开始
- 400 Bad Request: Offer不存在或状态不对
- 402 Payment Required: Token余额不足
- 403 Forbidden: 没有权限

**业务逻辑**:
1. 查询用户套餐（Billing Service: `GET /api/v1/billing/subscriptions/me`）
2. 计算需要消耗的Token（Starter: 1, Pro/Elite: 3）
3. 预扣Token（Billing Service: `POST /api/v1/billing/tokens/reserve`）
4. 发布Pub/Sub消息到`siterank.evaluate`主题
5. 返回202 Accepted

**Pub/Sub消息格式**:
```json
{
  "evaluationId": "uuid",
  "offerId": "uuid",
  "userId": "uuid",
  "offerUrl": "https://...",
  "userTier": "professional",  // starter, professional, elite
  "tokensReserved": 3,
  "forceRefresh": false
}
```

#### GET `/api/v1/offers/{offerId}/evaluations`

**用途**: 获取Offer的历史评估列表

**查询参数**:
- `page`: 页码（默认1）
- `limit`: 每页数量（默认20）
- `status`: 筛选状态（pending, running, completed, failed）

**响应**:
```json
{
  "evaluations": [
    {
      "id": "uuid",
      "status": "completed",
      "domain": "nike.com",
      "brandName": "Nike",
      "aiScore": 85,
      "tokensConsumed": 3,
      "createdAt": "2025-10-15T10:30:00Z",
      "completedAt": "2025-10-15T10:31:30Z"
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 20
}
```

#### GET `/api/v1/offers/{offerId}/evaluations/latest`

**用途**: 获取Offer的最新评估结果（含完整详情）

**响应**:
```json
{
  "id": "uuid",
  "status": "completed",
  "offerUrl": "https://...",
  "finalLandingUrl": "https://www.nike.com/...",
  "domain": "nike.com",
  "brandName": "Nike",
  "redirectChain": ["https://...", "https://..."],
  "similarwebData": {
    "globalRank": 123,
    "countryRank": 45,
    "categoryRank": 10,
    "visits": 1000000000,
    "bounceRate": 0.35,
    "pagesPerVisit": 5.2,
    "avgVisitDuration": 180
  },
  "similarwebCached": true,
  "aiRecommendationScore": 85,
  "aiRecommendationReasons": [
    "该品牌在美国市场月搜索流量超过1亿次，具有极高的品牌认知度",
    "产品平均客单价$120，Google广告平均CPC仅$0.8，ROI潜力大",
    "体育用品类目搜索需求稳定，全年投放效果好"
  ],
  "tokensConsumed": 3,
  "startedAt": "2025-10-15T10:30:00Z",
  "completedAt": "2025-10-15T10:31:30Z",
  "createdAt": "2025-10-15T10:30:00Z"
}
```

### 2. Siterank Service新增/修改端点

#### POST `/api/v1/siterank/analyze` (现有端点，需增强)

**新增逻辑**:
1. 调用Browser-Exec: `POST /api/v1/browser-exec/evaluate-offer`
2. 查询SimilarWeb全局缓存（按domain）
3. 若缓存未命中，调用Browser-Exec访问SimilarWeb API
4. 若用户是Pro/Elite，调用Vertex AI进行AI评估
5. 持久化所有数据
6. 更新Offer Service的brand_name（若为空）
7. 确认Token消耗

#### GET `/api/v1/siterank/cache/stats`

**用途**: 查询全局缓存统计（管理员端点）

**响应**:
```json
{
  "totalCachedDomains": 1234,
  "successfulCaches": 1100,
  "failedCaches": 134,
  "totalHits": 5678,
  "cacheHitRate": 0.82,
  "averageAge": "3.5 days"
}
```

### 3. Browser-Exec Service新增端点

#### POST `/api/v1/browser-exec/similarweb`

**用途**: 访问SimilarWeb API并返回解析后的数据

**请求**:
```json
{
  "domain": "nike.com"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "globalRank": 123,
    "countryRank": 45,
    "categoryRank": 10,
    "category": "Sports > Apparel",
    "visits": 1000000000,
    "bounceRate": 0.35,
    "pagesPerVisit": 5.2,
    "avgVisitDuration": 180,
    "topCountries": [
      {"country": "US", "percentage": 0.45},
      {"country": "UK", "percentage": 0.15}
    ],
    "trafficSources": {
      "direct": 0.30,
      "search": 0.40,
      "social": 0.15,
      "referrals": 0.10,
      "mail": 0.05
    }
  },
  "rawHtml": "<html>...</html>"  // 原始HTML（用于调试）
}
```

**业务逻辑**:
1. 从Secret Manager获取SimilarWeb API URL
2. 使用代理访问 `{SIMILARWEB_API_URL}?domain={domain}`
3. 解析HTML/JSON响应，提取结构化数据
4. 返回标准化格式

**错误处理**:
- 若SimilarWeb无此域名数据 → `success: false, error: "domain_not_found"`
- 若请求超时 → `success: false, error: "timeout"`
- 若解析失败 → `success: false, error: "parse_error"`

### 4. Billing Service新增端点

#### POST `/api/v1/billing/tokens/reserve`

**用途**: 预扣Token（用于异步任务）

**请求**:
```json
{
  "amount": 3,
  "reason": "offer_evaluation",
  "referenceId": "evaluation-uuid"
}
```

**响应**:
```json
{
  "reservationId": "uuid",
  "reserved": true,
  "newBalance": 97
}
```

#### POST `/api/v1/billing/tokens/confirm`

**用途**: 确认Token消耗（任务成功）

**请求**:
```json
{
  "reservationId": "uuid"
}
```

**响应**:
```json
{
  "confirmed": true,
  "finalBalance": 97
}
```

#### POST `/api/v1/billing/tokens/refund`

**用途**: 退还Token（任务失败）

**请求**:
```json
{
  "reservationId": "uuid",
  "reason": "evaluation_failed"
}
```

**响应**:
```json
{
  "refunded": true,
  "newBalance": 100
}
```

---

## SimilarWeb集成方案

### 1. API配置

**Secret Manager环境变量**:
```
SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data
SIMILARWEB_PROXY_URL=http://proxy.example.com:8080  # 可选
```

### 2. 数据提取策略

SimilarWeb可能返回HTML或JSON，需要两种解析方式：

#### 方式A: JSON响应（理想情况）
```json
{
  "site": "nike.com",
  "globalRank": 123,
  "countryRank": {"US": 45, "UK": 67},
  "category": "Sports > Apparel",
  "visits": 1000000000,
  "metrics": {
    "bounceRate": 0.35,
    "pagesPerVisit": 5.2,
    "avgVisitDuration": 180
  }
}
```

#### 方式B: HTML响应（需解析）
使用Browser-Exec的页面解析能力：
1. 访问SimilarWeb URL
2. 等待页面完全加载（waitUntil: networkidle）
3. 使用JavaScript提取数据：
```javascript
const data = {
  globalRank: document.querySelector('.global-rank').innerText,
  visits: document.querySelector('.visits').innerText,
  // ...
};
```

### 3. 缓存策略

```go
// Siterank Service伪代码
func GetSimilarWebData(domain string) (*SimilarWebData, error) {
    // 1. 查询缓存
    cached, err := db.QuerySimilarWebCache(domain)
    if err == nil && !cached.IsExpired() {
        // 缓存命中且未过期
        IncrementHitCount(cached.ID)
        return cached.Data, nil
    }

    // 2. 缓存未命中，调用Browser-Exec
    resp, err := browserExecClient.GetSimilarWebData(domain)
    if err != nil {
        // 失败，缓存1小时
        SaveToCache(domain, nil, false, time.Hour)
        return nil, err
    }

    // 3. 成功，缓存7天
    SaveToCache(domain, resp.Data, true, 7*24*time.Hour)
    return resp.Data, nil
}

func SaveToCache(domain string, data *SimilarWebData, success bool, ttl time.Duration) {
    expiresAt := time.Now().Add(ttl)
    db.UpsertSimilarWebCache(&SimilarWebCache{
        Domain: domain,
        DomainHash: SHA256(domain),
        SimilarwebData: data,
        IsSuccess: success,
        FetchedAt: time.Now(),
        ExpiresAt: expiresAt,
    })
}
```

### 4. 缓存清理

**定时任务**（每小时执行）:
```sql
DELETE FROM similarweb_global_cache
WHERE expires_at < NOW() - INTERVAL '7 days';  -- 删除过期7天以上的记录
```

---

## Vertex AI Gemini集成方案

### 1. API配置

**Secret Manager环境变量**:
```
VERTEX_AI_PROJECT_ID=adsai-123456
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-1.5-pro
```

### 2. Prompt模板设计

```go
const AIEvaluationPromptTemplate = `
你是一位Google广告投放专家，请根据以下域名的SimilarWeb数据，评估该域名作为Google广告投放目标的价值。

# 域名信息
- 域名: {{.Domain}}
- 品牌名: {{.BrandName}}
- 目标投放国家: {{.TargetCountry}}

# SimilarWeb数据
- 全球排名: {{.GlobalRank}}
- 国家排名({{.TargetCountry}}): {{.CountryRank}}
- 类目: {{.Category}}
- 月访问量: {{.Visits}}
- 跳出率: {{.BounceRate}}
- 平均访问时长: {{.AvgVisitDuration}}秒
- 流量来源:
  - 直接访问: {{.TrafficSources.Direct}}
  - 搜索引擎: {{.TrafficSources.Search}}
  - 社交媒体: {{.TrafficSources.Social}}

# 评估要求
请从以下维度进行评估，并给出一个0-100的推荐指数：

1. **行业价值**: 该域名所属行业的广告价值和竞争情况
2. **流量质量**: 基于跳出率、访问时长等指标判断流量质量
3. **品牌认知度**: 基于排名和访问量判断品牌影响力
4. **搜索流量占比**: 搜索流量占比越高，越适合Google广告投放
5. **投放成本预估**: 基于类目和竞争情况，预估CPC成本

# 输出格式（必须严格按照JSON格式输出）
{
  "recommendationScore": 85,
  "industry": "体育用品",
  "estimatedCPC": "$0.80",
  "estimatedAOV": "$120",
  "reasons": [
    "该品牌在美国市场月搜索流量超过1亿次，具有极高的品牌认知度",
    "产品平均客单价$120，Google广告平均CPC仅$0.8，ROI潜力大",
    "体育用品类目搜索需求稳定，全年投放效果好"
  ]
}
`
```

### 3. API调用代码

```go
import (
    aiplatform "cloud.google.com/go/aiplatform/apiv1"
    "google.golang.org/genai"
)

func EvaluateWithAI(domain string, brandName string, similarwebData *SimilarWebData) (*AIEvaluation, error) {
    ctx := context.Background()

    // 1. 初始化Vertex AI客户端
    client, err := genai.NewClient(ctx,
        os.Getenv("VERTEX_AI_PROJECT_ID"),
        os.Getenv("VERTEX_AI_LOCATION"),
    )
    if err != nil {
        return nil, err
    }
    defer client.Close()

    // 2. 构造Prompt
    prompt := renderPromptTemplate(AIEvaluationPromptTemplate, map[string]interface{}{
        "Domain": domain,
        "BrandName": brandName,
        "GlobalRank": similarwebData.GlobalRank,
        "CountryRank": similarwebData.CountryRank,
        // ...
    })

    // 3. 调用Gemini API
    model := client.GenerativeModel(os.Getenv("VERTEX_AI_MODEL"))
    model.SetTemperature(0.2)  // 降低随机性
    model.SetTopK(40)
    model.SetTopP(0.95)

    resp, err := model.GenerateContent(ctx, genai.Text(prompt))
    if err != nil {
        return nil, err
    }

    // 4. 解析响应
    var result AIEvaluation
    if err := json.Unmarshal([]byte(resp.Candidates[0].Content.Parts[0]), &result); err != nil {
        return nil, err
    }

    // 5. 验证结果
    if result.RecommendationScore < 0 || result.RecommendationScore > 100 {
        return nil, errors.New("invalid recommendation score")
    }
    if len(result.Reasons) != 3 {
        return nil, errors.New("expected exactly 3 reasons")
    }

    return &result, nil
}

type AIEvaluation struct {
    RecommendationScore int      `json:"recommendationScore"`
    Industry            string   `json:"industry"`
    EstimatedCPC        string   `json:"estimatedCPC"`
    EstimatedAOV        string   `json:"estimatedAOV"`
    Reasons             []string `json:"reasons"`
}
```

### 4. 错误处理

```go
func EvaluateWithAIRetry(domain string, brandName string, data *SimilarWebData) (*AIEvaluation, error) {
    maxRetries := 3
    var lastErr error

    for i := 0; i < maxRetries; i++ {
        result, err := EvaluateWithAI(domain, brandName, data)
        if err == nil {
            return result, nil
        }

        lastErr = err

        // 根据错误类型决定是否重试
        if isRateLimitError(err) {
            time.Sleep(time.Duration(i+1) * 5 * time.Second)  // 指数退避
            continue
        } else if isParseError(err) {
            // Prompt可能需要调整，不重试
            break
        } else {
            // 其他错误，短暂延迟后重试
            time.Sleep(1 * time.Second)
        }
    }

    return nil, fmt.Errorf("AI evaluation failed after %d retries: %w", maxRetries, lastErr)
}
```

### 5. 成本控制

**Vertex AI Gemini定价**（参考）:
- Gemini 1.5 Pro: $0.00125 / 1K characters (input)
- 平均每次评估: ~2000 characters = $0.0025

**每月成本预估**:
- 若10,000次AI评估 = $25
- 若100,000次AI评估 = $250

**优化策略**:
1. 缓存AI评估结果（相同domain+similarwebData不重复评估）
2. 只对Pro/Elite用户提供
3. 设置每日/每月AI评估次数上限

---

## 套餐权限控制

### 1. 套餐定义

```go
type SubscriptionTier string

const (
    TierStarter      SubscriptionTier = "starter"
    TierProfessional SubscriptionTier = "professional"
    TierElite        SubscriptionTier = "elite"
)

type TierPermissions struct {
    CanUseAIEvaluation     bool
    MaxEvaluationsPerDay   int
    MaxEvaluationsPerMonth int
    TokensPerEvaluation    int  // Starter: 1, Pro/Elite: 3
}

var TierPermissionsMap = map[SubscriptionTier]TierPermissions{
    TierStarter: {
        CanUseAIEvaluation:     false,
        MaxEvaluationsPerDay:   10,
        MaxEvaluationsPerMonth: 100,
        TokensPerEvaluation:    1,
    },
    TierProfessional: {
        CanUseAIEvaluation:     true,
        MaxEvaluationsPerDay:   50,
        MaxEvaluationsPerMonth: 1000,
        TokensPerEvaluation:    3,
    },
    TierElite: {
        CanUseAIEvaluation:     true,
        MaxEvaluationsPerDay:   -1,  // 无限制
        MaxEvaluationsPerMonth: -1,
        TokensPerEvaluation:    3,
    },
}
```

### 2. 权限检查逻辑

```go
func CheckEvaluationPermission(userID string) (*TierPermissions, error) {
    // 1. 查询用户套餐
    subscription, err := billingClient.GetUserSubscription(userID)
    if err != nil {
        return nil, err
    }

    tier := SubscriptionTier(subscription.Tier)
    perms, ok := TierPermissionsMap[tier]
    if !ok {
        return nil, errors.New("invalid tier")
    }

    // 2. 检查今日评估次数
    todayCount, err := countEvaluationsToday(userID)
    if err != nil {
        return nil, err
    }

    if perms.MaxEvaluationsPerDay > 0 && todayCount >= perms.MaxEvaluationsPerDay {
        return nil, errors.New("daily evaluation limit reached")
    }

    // 3. 检查本月评估次数
    monthCount, err := countEvaluationsThisMonth(userID)
    if err != nil {
        return nil, err
    }

    if perms.MaxEvaluationsPerMonth > 0 && monthCount >= perms.MaxEvaluationsPerMonth {
        return nil, errors.New("monthly evaluation limit reached")
    }

    return &perms, nil
}
```

### 3. 前端权限展示

```typescript
// apps/frontend/src/hooks/useEvaluationPermission.ts
export function useEvaluationPermission() {
  const { tier } = useUserSubscription();

  const canUseAI = tier === 'professional' || tier === 'elite';
  const tokensPerEvaluation = canUseAI ? 3 : 1;

  return {
    canUseAI,
    tokensPerEvaluation,
    showUpgradeButton: !canUseAI,
    upgradeUrl: '/pricing',
  };
}
```

---

## Token消耗计算

### 1. 消耗规则

| 场景 | 套餐 | 普通评估 | AI评估 | 总计 |
|------|------|---------|--------|------|
| 仅普通评估 | Starter | 1 | - | 1 |
| 普通+AI评估 | Professional | 1 | 2 | 3 |
| 普通+AI评估 | Elite | 1 | 2 | 3 |

### 2. Token预扣流程

```go
// Offer Service: 处理评估请求
func HandleEvaluateRequest(offerID, userID string) error {
    // 1. 查询用户套餐
    tier, err := billingClient.GetUserTier(userID)
    if err != nil {
        return err
    }

    // 2. 计算Token消耗
    tokensNeeded := 1  // 普通评估
    if tier == "professional" || tier == "elite" {
        tokensNeeded = 3  // 普通 + AI
    }

    // 3. 预扣Token
    reservation, err := billingClient.ReserveTokens(userID, tokensNeeded, "offer_evaluation", evaluationID)
    if err != nil {
        return errors.New("token余额不足")
    }

    // 4. 发布Pub/Sub消息
    pubsubClient.Publish("siterank.evaluate", &EvaluationMessage{
        EvaluationID: evaluationID,
        OfferID: offerID,
        UserID: userID,
        UserTier: tier,
        TokensReserved: tokensNeeded,
        ReservationID: reservation.ID,
    })

    return nil
}
```

### 3. Token确认流程

```go
// Siterank Service: 评估完成后
func CompleteEvaluation(evaluationID string, success bool) error {
    // 1. 获取评估记录
    evaluation, err := db.GetEvaluation(evaluationID)
    if err != nil {
        return err
    }

    // 2. 确认或退还Token
    if success {
        // 确认消耗
        err = billingClient.ConfirmTokens(evaluation.ReservationID)
        if err != nil {
            log.Error("failed to confirm tokens", err)
        }
    } else {
        // 退还Token
        err = billingClient.RefundTokens(evaluation.ReservationID, "evaluation_failed")
        if err != nil {
            log.Error("failed to refund tokens", err)
        }
    }

    // 3. 更新评估记录
    evaluation.Status = "completed"
    evaluation.TokensConsumed = evaluation.TokensReserved
    if !success {
        evaluation.TokensConsumed = 0
    }
    db.UpdateEvaluation(evaluation)

    return nil
}
```

### 4. Token消耗展示

```typescript
// 前端: Offer列表显示Token消耗
<Badge variant="outline">
  {evaluation.tokensConsumed} Tokens
</Badge>

// 前端: 评估按钮显示预估Token
<Button onClick={handleEvaluate}>
  评估 (消耗 {estimatedTokens} Tokens)
</Button>
```

---

## 前端UI设计

### 1. Offer列表页增强

#### 新增"AI推荐指数"列

```typescript
// apps/frontend/app/dashboard/offers/page.tsx
const columns: ColumnDef<Offer>[] = [
  // ... 现有列
  {
    accessorKey: 'aiScore',
    header: 'AI推荐指数',
    cell: ({ row }) => {
      const { canUseAI } = useEvaluationPermission();
      const aiScore = row.original.latestAiScore;

      if (!canUseAI) {
        return (
          <Button variant="ghost" size="sm" onClick={() => router.push('/pricing')}>
            <Sparkles className="w-4 h-4 mr-1" />
            开通
          </Button>
        );
      }

      if (!aiScore) {
        return <span className="text-muted-foreground">未评估</span>;
      }

      return (
        <Button
          variant="ghost"
          onClick={() => openAIDetailDialog(row.original.id)}
          className="flex items-center gap-2"
        >
          <AIScoreBadge score={aiScore} />
          <span className="font-semibold">{aiScore}</span>
        </Button>
      );
    },
  },
  // ... 其他列
];
```

#### AI推荐指数徽章组件

```typescript
// apps/frontend/src/components/offers/AIScoreBadge.tsx
export function AIScoreBadge({ score }: { score: number }) {
  const variant =
    score >= 80 ? 'success' :
    score >= 60 ? 'warning' :
    'destructive';

  const icon =
    score >= 80 ? <TrendingUp className="w-4 h-4" /> :
    score >= 60 ? <Minus className="w-4 h-4" /> :
    <TrendingDown className="w-4 h-4" />;

  return (
    <Badge variant={variant} className="flex items-center gap-1">
      {icon}
      {score >= 80 && 'A'}
      {score >= 60 && score < 80 && 'B'}
      {score < 60 && 'C'}
    </Badge>
  );
}
```

### 2. 评估按钮增强

```typescript
// apps/frontend/src/components/offers/EvaluateButton.tsx
export function EvaluateButton({ offer }: { offer: Offer }) {
  const { t } = useTranslation();
  const { canUseAI, tokensPerEvaluation } = useEvaluationPermission();
  const { balance } = useBillingTokenBalance();
  const [isEvaluating, setIsEvaluating] = useState(false);

  const handleEvaluate = async () => {
    if (balance < tokensPerEvaluation) {
      toast.error(t('errors.insufficientTokens'));
      return;
    }

    setIsEvaluating(true);

    try {
      const response = await fetch(`/api/v1/offers/${offer.id}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: false }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message);
        return;
      }

      const result = await response.json();

      toast.success(
        canUseAI
          ? t('offers.evaluation.aiStarted')
          : t('offers.evaluation.started')
      );

      // 轮询或SSE监听评估进度
      pollEvaluationStatus(result.evaluationId);

    } catch (error) {
      toast.error(t('errors.evaluationFailed'));
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <Button
      onClick={handleEvaluate}
      disabled={isEvaluating || balance < tokensPerEvaluation}
      className="flex items-center gap-2"
    >
      {isEvaluating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('offers.evaluation.evaluating')}
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4" />
          {canUseAI ? t('offers.evaluation.evaluateAI') : t('offers.evaluation.evaluate')}
          <Badge variant="secondary">{tokensPerEvaluation} Tokens</Badge>
        </>
      )}
    </Button>
  );
}
```

### 3. AI评估详情弹窗

```typescript
// apps/frontend/src/components/offers/AIEvaluationDialog.tsx
export function AIEvaluationDialog({ offerId, open, onClose }: Props) {
  const { t } = useTranslation();
  const { data: evaluation, isLoading } = useQuery(
    ['offer', offerId, 'evaluation'],
    () => fetchLatestEvaluation(offerId)
  );

  if (isLoading) {
    return <DialogSkeleton />;
  }

  if (!evaluation?.aiRecommendationScore) {
    return <NoAIDataDialog />;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {t('offers.evaluation.aiDetails')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* AI推荐指数 */}
          <div className="flex items-center justify-between p-6 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">{t('offers.evaluation.recommendationScore')}</p>
              <h2 className="text-4xl font-bold mt-2">{evaluation.aiRecommendationScore}</h2>
            </div>
            <AIScoreBadge score={evaluation.aiRecommendationScore} />
          </div>

          {/* 3条推荐理由 */}
          <div>
            <h3 className="font-semibold mb-3">{t('offers.evaluation.reasons')}</h3>
            <div className="space-y-2">
              {evaluation.aiRecommendationReasons.map((reason, index) => (
                <div key={index} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge variant="outline" className="h-6 w-6 flex items-center justify-center">
                    {index + 1}
                  </Badge>
                  <p className="text-sm flex-1">{reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* SimilarWeb数据预览 */}
          <Accordion type="single" collapsible>
            <AccordionItem value="similarweb">
              <AccordionTrigger>
                {t('offers.evaluation.viewSimilarWebData')}
              </AccordionTrigger>
              <AccordionContent>
                <SimilarWebDataDisplay data={evaluation.similarwebData} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* 评估元数据 */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t('offers.evaluation.evaluatedAt', {
                time: formatDistance(new Date(evaluation.completedAt), new Date(), { addSuffix: true })
              })}
            </span>
            <span>
              {t('offers.evaluation.tokensConsumed', { count: evaluation.tokensConsumed })}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 4. SimilarWeb数据展示组件

```typescript
// apps/frontend/src/components/offers/SimilarWebDataDisplay.tsx
export function SimilarWebDataDisplay({ data }: { data: SimilarWebData }) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-4">
      <StatCard
        label={t('similarweb.globalRank')}
        value={data.globalRank?.toLocaleString()}
        icon={<Globe />}
      />
      <StatCard
        label={t('similarweb.monthlyVisits')}
        value={data.visits?.toLocaleString()}
        icon={<Users />}
      />
      <StatCard
        label={t('similarweb.bounceRate')}
        value={`${(data.bounceRate * 100).toFixed(1)}%`}
        icon={<Activity />}
      />
      <StatCard
        label={t('similarweb.avgVisitDuration')}
        value={`${Math.floor(data.avgVisitDuration / 60)}m ${data.avgVisitDuration % 60}s`}
        icon={<Clock />}
      />

      {/* 流量来源饼图 */}
      <div className="col-span-2">
        <h4 className="font-medium mb-2">{t('similarweb.trafficSources')}</h4>
        <TrafficSourcesChart data={data.trafficSources} />
      </div>
    </div>
  );
}
```

### 5. 升级引导组件（Starter用户）

```typescript
// apps/frontend/src/components/offers/UpgradePrompt.tsx
export function UpgradePrompt() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Alert className="border-primary/50 bg-primary/5">
      <Sparkles className="w-4 h-4 text-primary" />
      <AlertTitle>{t('offers.upgrade.title')}</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{t('offers.upgrade.description')}</span>
        <Button
          size="sm"
          onClick={() => router.push('/pricing')}
        >
          {t('offers.upgrade.viewPlans')}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

### 6. 评估进度通知（SSE）

```typescript
// apps/frontend/src/hooks/useEvaluationProgress.ts
export function useEvaluationProgress(evaluationId: string) {
  const [status, setStatus] = useState<EvaluationStatus>('pending');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/v1/siterank/evaluations/${evaluationId}/stream`
    );

    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      setStatus(data.status);
      setProgress(data.progress);

      if (data.status === 'completed') {
        eventSource.close();
        toast.success('评估完成！');
        queryClient.invalidateQueries(['offers']);
      } else if (data.status === 'failed') {
        eventSource.close();
        toast.error('评估失败，已退还Token');
      }
    });

    return () => eventSource.close();
  }, [evaluationId]);

  return { status, progress };
}
```

---

## 实施计划

### 阶段1: 数据库Schema与基础设施（2天）

**负责人**: Backend Team

**任务**:
1. 创建Siterank Service数据库表
   - `offer_evaluations`
   - `similarweb_global_cache`
   - `evaluation_aggregations`
2. 修改Offer Service的`offers`表，添加新字段
3. 配置Secret Manager环境变量
   - `SIMILARWEB_API_URL`
   - `VERTEX_AI_PROJECT_ID`
   - `VERTEX_AI_LOCATION`
   - `VERTEX_AI_MODEL`
4. 设置RLS策略和索引

**验收标准**:
- ✅ 所有表创建成功，索引正常
- ✅ RLS策略生效
- ✅ Secret Manager配置完成

---

### 阶段2: Browser-Exec Service增强（2天）

**负责人**: Backend Developer A

**任务**:
1. 实现`POST /api/v1/browser-exec/similarweb`端点
2. 支持两种解析方式（JSON/HTML）
3. 集成代理访问（从Secret Manager获取配置）
4. 错误处理（domain_not_found, timeout, parse_error）
5. 单元测试（80%覆盖率）

**技术细节**:
```go
// 使用Playwright访问SimilarWeb
func (s *BrowserExecService) GetSimilarWebData(domain string) (*SimilarWebResponse, error) {
    url := fmt.Sprintf("%s?domain=%s",
        os.Getenv("SIMILARWEB_API_URL"),
        domain)

    page, err := s.browser.NewPage()
    defer page.Close()

    // 设置代理（若配置）
    if proxyURL := os.Getenv("SIMILARWEB_PROXY_URL"); proxyURL != "" {
        page.SetProxy(proxyURL)
    }

    // 访问页面
    resp, err := page.Goto(url, playwright.PageGotoOptions{
        WaitUntil: playwright.WaitUntilStateNetworkidle,
        Timeout:   30000,
    })

    // 尝试解析JSON
    var data SimilarWebData
    if err := page.Evaluate(`() => { return document.body.innerText }`, &jsonText); err == nil {
        json.Unmarshal([]byte(jsonText), &data)
        return &SimilarWebResponse{Success: true, Data: data}, nil
    }

    // 否则解析HTML
    // ...
}
```

**验收标准**:
- ✅ 成功访问SimilarWeb API并解析数据
- ✅ 正确处理无数据域名（404）
- ✅ 超时控制正常（30秒）
- ✅ 单元测试通过

---

### 阶段3: Siterank Service核心逻辑（3天）

**负责人**: Backend Developer B

**任务**:
1. 实现SimilarWeb全局缓存逻辑
   - 查询缓存（按domain）
   - 写入缓存（成功7天，失败1小时）
   - 缓存命中统计
2. 集成Browser-Exec Service
   - 调用`/evaluate-offer`获取domain + brand
   - 调用`/similarweb`获取流量数据
3. 实现Vertex AI Gemini集成
   - Prompt模板
   - API调用（带重试）
   - 响应解析和验证
4. 实现评估主流程
   - 创建evaluation记录
   - 按步骤执行（Browser-Exec → SimilarWeb → AI）
   - 持久化结果
   - 更新聚合表
5. 单元测试和集成测试

**技术细节**:
```go
// Pub/Sub订阅处理
func (s *SiterankService) HandleEvaluationMessage(msg *pubsub.Message) error {
    var req EvaluationRequest
    json.Unmarshal(msg.Data, &req)

    // 1. 创建evaluation记录
    evaluation := &Evaluation{
        ID: req.EvaluationID,
        UserID: req.UserID,
        OfferID: req.OfferID,
        OfferURL: req.OfferURL,
        Status: "running",
    }
    s.db.Create(evaluation)

    // 2. 调用Browser-Exec获取domain + brand
    domainInfo, err := s.browserExecClient.EvaluateOffer(req.OfferURL)
    if err != nil {
        return s.handleFailure(evaluation, err)
    }

    evaluation.Domain = domainInfo.Domain
    evaluation.BrandName = domainInfo.BrandName
    s.db.Update(evaluation)

    // 3. 查询/获取SimilarWeb数据
    similarwebData, cached, err := s.getSimilarWebData(domainInfo.Domain)
    if err != nil {
        return s.handleFailure(evaluation, err)
    }

    evaluation.SimilarwebData = similarwebData
    evaluation.SimilarwebCached = cached
    s.db.Update(evaluation)

    // 4. 若是Pro/Elite，调用AI评估
    if req.UserTier == "professional" || req.UserTier == "elite" {
        aiResult, err := s.evaluateWithAI(domainInfo.Domain, domainInfo.BrandName, similarwebData)
        if err != nil {
            log.Warn("AI evaluation failed", err)
            // AI失败不影响整体评估
        } else {
            evaluation.AIRecommendationScore = aiResult.Score
            evaluation.AIRecommendationReasons = aiResult.Reasons
            s.db.Update(evaluation)
        }
    }

    // 5. 完成评估
    evaluation.Status = "completed"
    evaluation.CompletedAt = time.Now()
    s.db.Update(evaluation)

    // 6. 更新聚合表
    s.updateAggregation(evaluation)

    // 7. 更新Offer品牌名（若为空）
    s.updateOfferBrandName(req.OfferID, domainInfo.BrandName)

    // 8. 确认Token
    s.billingClient.ConfirmTokens(req.ReservationID)

    // 9. 通知前端
    s.notificationClient.Send(req.UserID, "evaluation_completed", evaluation.ID)

    return nil
}
```

**验收标准**:
- ✅ 完整评估流程可执行
- ✅ SimilarWeb缓存正常工作
- ✅ AI评估成功（Pro/Elite用户）
- ✅ 数据正确持久化
- ✅ 集成测试通过

---

### 阶段4: Billing Service Token管理增强（1天）

**负责人**: Backend Developer C

**任务**:
1. 实现`POST /api/v1/billing/tokens/reserve`
2. 实现`POST /api/v1/billing/tokens/confirm`
3. 实现`POST /api/v1/billing/tokens/refund`
4. 数据库表修改（新增`token_reservations`表）
5. 单元测试

**数据库Schema**:
```sql
CREATE TABLE token_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    amount INTEGER NOT NULL,
    reason VARCHAR(50) NOT NULL,
    reference_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL,  -- reserved, confirmed, refunded
    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP,
    refunded_at TIMESTAMP
);
```

**验收标准**:
- ✅ Token预扣/确认/退还逻辑正确
- ✅ 幂等性保证（重复确认不重复扣款）
- ✅ 单元测试通过

---

### 阶段5: Offer Service API增强（2天）

**负责人**: Backend Developer D

**任务**:
1. 实现`POST /api/v1/offers/{id}/evaluate`
   - 查询用户套餐
   - 计算Token消耗
   - 预扣Token
   - 发布Pub/Sub消息
2. 实现`GET /api/v1/offers/{id}/evaluations`
3. 实现`GET /api/v1/offers/{id}/evaluations/latest`
4. 套餐权限检查中间件
5. 集成测试

**验收标准**:
- ✅ API正确响应
- ✅ 套餐权限控制生效
- ✅ Token预扣成功
- ✅ Pub/Sub消息正确发布
- ✅ 集成测试通过

---

### 阶段6: 前端UI实现（3天）

**负责人**: Frontend Team

**任务**:
1. Offer列表增加"AI推荐指数"列
2. 实现`EvaluateButton`组件
3. 实现`AIEvaluationDialog`组件
4. 实现`SimilarWebDataDisplay`组件
5. 实现`UpgradePrompt`组件（Starter用户）
6. 实现SSE实时进度监听
7. i18n翻译（中英文）

**组件树**:
```
OffersPage
├── OffersTable
│   ├── AI推荐指数列
│   │   ├── AIScoreBadge (Pro/Elite有数据)
│   │   └── UpgradeButton (Starter)
│   └── 操作列
│       └── EvaluateButton
└── AIEvaluationDialog
    ├── 推荐指数展示
    ├── 3条推荐理由
    ├── SimilarWebDataDisplay
    │   ├── StatCard x4
    │   └── TrafficSourcesChart
    └── 评估元数据
```

**验收标准**:
- ✅ UI符合设计稿
- ✅ Starter用户看到"开通"按钮
- ✅ Pro/Elite用户看到AI推荐指数
- ✅ 评估按钮正确显示Token消耗
- ✅ SSE实时更新正常
- ✅ 响应式布局（移动端友好）

---

### 阶段7: 集成测试与优化（2天）

**负责人**: QA Team + Backend Team

**任务**:
1. E2E测试编写
   - Starter用户评估流程
   - Pro用户AI评估流程
   - Token预扣/确认/退还
   - 缓存命中测试
2. 性能测试
   - 评估平均耗时 < 30秒
   - SimilarWeb缓存命中率 > 70%
   - AI评估成功率 > 95%
3. 监控告警配置
   - Pub/Sub消息堆积告警
   - AI评估失败率告警
   - Token余额告警
4. 文档更新
   - API文档（OpenAPI）
   - 用户使用手册
   - 开发部署文档

**验收标准**:
- ✅ E2E测试通过率 100%
- ✅ 性能指标达标
- ✅ 监控告警正常
- ✅ 文档完整

---

### 总工期: 15天（3周）

| 阶段 | 天数 | 开始日期 | 完成日期 |
|------|------|---------|---------|
| 阶段1: 数据库Schema | 2天 | Day 1 | Day 2 |
| 阶段2: Browser-Exec增强 | 2天 | Day 1 | Day 2 |
| 阶段3: Siterank核心逻辑 | 3天 | Day 3 | Day 5 |
| 阶段4: Billing Token管理 | 1天 | Day 3 | Day 3 |
| 阶段5: Offer Service增强 | 2天 | Day 4 | Day 5 |
| 阶段6: 前端UI实现 | 3天 | Day 6 | Day 8 |
| 阶段7: 集成测试 | 2天 | Day 9 | Day 10 |
| Buffer | 2天 | Day 11 | Day 12 |

---

## 附录

### A. 关键术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| Offer评估 | Offer Evaluation | 对广告联盟Offer进行数据分析和价值评估 |
| SimilarWeb | SimilarWeb | 第三方网站流量分析平台 |
| AI推荐指数 | AI Recommendation Score | 由AI给出的0-100分投放推荐指数 |
| URL Hash | URL Hash | SHA-256(Offer URL)，用作数据聚合Key |
| 全局缓存 | Global Cache | 不区分用户的共享缓存 |
| Token预扣 | Token Reservation | 先扣除Token，待任务完成后确认或退还 |
| 套餐 | Subscription Tier | Starter/Professional/Elite三档 |

### B. 错误码表

| 错误码 | 说明 | HTTP状态码 |
|--------|------|-----------|
| `INSUFFICIENT_TOKENS` | Token余额不足 | 402 |
| `EVALUATION_LIMIT_REACHED` | 达到评估次数上限 | 429 |
| `OFFER_NOT_FOUND` | Offer不存在 | 404 |
| `INVALID_TIER` | 无效的套餐类型 | 400 |
| `SIMILARWEB_DOMAIN_NOT_FOUND` | SimilarWeb无此域名数据 | 404 |
| `SIMILARWEB_TIMEOUT` | SimilarWeb请求超时 | 504 |
| `AI_EVALUATION_FAILED` | AI评估失败 | 500 |
| `BROWSER_EXEC_FAILED` | Browser-Exec执行失败 | 500 |

### C. 性能指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 评估平均耗时 | < 30秒 | 从触发到完成 |
| SimilarWeb缓存命中率 | > 70% | 全局缓存有效性 |
| AI评估成功率 | > 95% | Vertex AI可用性 |
| Pub/Sub消息处理时间 | < 60秒 | P95 |
| Token预扣-确认延迟 | < 5秒 | 计费准确性 |

### D. 成本估算

**SimilarWeb API**:
- 未知定价（需确认）
- 全局缓存可大幅降低调用次数

**Vertex AI Gemini**:
- $0.00125 / 1K characters (input)
- 平均每次: $0.0025
- 10,000次/月 = $25
- 100,000次/月 = $250

**Cloud Pub/Sub**:
- $0.40 / million operations
- 可忽略不计

**Cloud SQL存储**:
- 评估记录: ~5KB/条
- 100,000条 = 500MB ≈ $0.17/月

**总成本预估**:
- 10,000次AI评估/月 = ~$30
- 100,000次AI评估/月 = ~$270

---

## 总结

本设计方案完整实现了13个业务需求，关键亮点：

1. ✅ **异步处理**: Pub/Sub解耦，不阻塞用户
2. ✅ **全局缓存**: SimilarWeb数据7天缓存，降低成本
3. ✅ **套餐权限**: 基于套餐的功能分级和Token消耗
4. ✅ **AI评估**: Vertex AI Gemini提供智能推荐
5. ✅ **数据聚合**: URL Hash作为Key，支持历史分析
6. ✅ **Token预扣**: 确保计费准确，失败自动退还
7. ✅ **用户级隔离**: RLS策略保证数据安全
8. ✅ **实时通知**: SSE推送评估进度
9. ✅ **UX优化**: Starter用户引导升级，Pro/Elite自动AI评估
10. ✅ **可扩展性**: 模块化设计，易于后续增强

**下一步行动**:
1. 团队Review本设计方案
2. 确认SimilarWeb API定价和访问方式
3. 分配开发任务，启动实施

---

**文档创建**: 2025-10-15
**最后更新**: 2025-10-15
**下次Review**: 实施启动前
