# M2里程碑启动文档

**里程碑**: M2 - Offer评估系统后端
**时间**: Day 3-8（6天）
**任务数**: 38个后端任务
**预计工时**: 67小时
**状态**: 🚀 准备启动

---

## 📋 目标

构建完整的Offer评估系统后端，实现从Browser-Exec到Vertex AI的完整评估链路。

### 核心交付物

1. ✅ **Browser-Exec SimilarWeb集成** - 访问SimilarWeb API获取流量数据
2. ✅ **Siterank核心评估逻辑** - 完整的评估流程编排
3. ✅ **Vertex AI Gemini集成** - AI智能评估（Pro/Elite专属）
4. ✅ **Token预扣机制** - 防止并发重复扣款
5. ✅ **Offer Service API增强** - 评估触发和结果查询

---

## 🎯 任务分组

### 第1组：Browser-Exec SimilarWeb集成（BE-006~011）

**时间**: Day 3（1.5天）
**工时**: 11小时
**负责**: Backend-B

#### 任务清单

| 任务ID | 任务名称 | 工时 | 优先级 |
|--------|---------|------|--------|
| BE-006 | 实现`POST /similarweb`端点 | 2h | P0 |
| BE-007 | 集成SimilarWeb API访问逻辑 | 3h | P0 |
| BE-008 | 实现HTML/JSON双解析器 | 2h | P0 |
| BE-009 | 配置代理支持 | 1h | P1 |
| BE-010 | 错误处理（404、超时、解析失败） | 1h | P0 |
| BE-011 | 单元测试 | 2h | P0 |

#### 技术要点

**1. SimilarWeb API访问**
```go
// services/browser-exec/internal/handlers/similarweb.go
func (h *Handler) PostSimilarWeb(w http.ResponseWriter, r *http.Request) {
    domain := req.Domain
    url := fmt.Sprintf("https://data.similarweb.com/api/v1/data?domain=%s", domain)

    // 使用代理访问
    resp, err := h.proxyClient.Get(url)
    if err != nil {
        return handleError(w, err)
    }

    // 双解析器：先尝试JSON，失败则HTML
    data, err := h.parseResponse(resp)
    if err != nil {
        return handleError(w, err)
    }

    json.NewEncoder(w).Encode(data)
}
```

**2. 数据结构**
```go
type SimilarWebData struct {
    Domain            string `json:"domain"`
    GlobalRank        int    `json:"globalRank"`
    CountryRank       map[string]int `json:"countryRank"`
    MonthlyVisits     int64  `json:"monthlyVisits"`
    BounceRate        float64 `json:"bounceRate"`
    AvgVisitDuration  int    `json:"avgVisitDuration"`
    TrafficSources    map[string]float64 `json:"trafficSources"`
}
```

**验收标准**:
- ✅ 成功获取nike.com的SimilarWeb数据
- ✅ JSON和HTML两种格式都能解析
- ✅ 代理访问正常
- ✅ 错误场景覆盖（404、超时、解析失败）
- ✅ 单元测试覆盖率>80%

---

### 第2组：Siterank核心评估逻辑（BE-012~022）

**时间**: Day 4-5（2.5天）
**工时**: 20小时
**负责**: Backend-A

#### 任务清单

| 任务ID | 任务名称 | 工时 | 优先级 | 依赖 |
|--------|---------|------|--------|------|
| BE-012 | 增强`POST /analyze`端点 | 2h | P0 | BE-005 |
| BE-013 | 集成Browser-Exec `/evaluate-offer` | 2h | P0 | BE-012 |
| BE-014 | 实现全局缓存查询逻辑 | 2h | P0 | BE-002 |
| BE-015 | 实现全局缓存写入逻辑（TTL） | 2h | P0 | BE-014 |
| BE-016 | 集成Browser-Exec `/similarweb` | 2h | P0 | BE-011 |
| BE-017 | 实现URL Hash计算（SHA-256） | 1h | P0 | BE-013 |
| BE-018 | 实现评估结果持久化 | 2h | P0 | BE-004 |
| BE-019 | 实现聚合表更新逻辑 | 1h | P1 | BE-003 |
| BE-020 | 实现品牌名回填（Offer Service） | 1h | P1 | BE-018 |
| BE-021 | 单元测试 | 3h | P0 | BE-012~020 |
| BE-022 | 集成测试 | 2h | P0 | BE-021 |

#### 技术要点

**1. 评估流程编排**
```go
// services/siterank/internal/handlers/evaluate.go
func (h *Handler) Evaluate(ctx context.Context, req *EvaluateRequest) (*EvaluationResult, error) {
    // Step 1: 获取域名和品牌
    offerData, err := h.browserExecClient.EvaluateOffer(req.OfferURL)
    if err != nil {
        return nil, err
    }

    // Step 2: 计算URL Hash
    urlHash := sha256Hash(req.OfferURL)

    // Step 3: 查询全局缓存
    cachedData, found := h.getCachedSimilarWeb(offerData.Domain)

    // Step 4: 若缓存未命中，调用SimilarWeb API
    if !found {
        similarWebData, err := h.browserExecClient.GetSimilarWeb(offerData.Domain)
        if err != nil {
            // 缓存失败结果（1小时）
            h.cacheSimilarWeb(offerData.Domain, nil, false, 1*time.Hour)
            return nil, err
        }
        // 缓存成功结果（7天）
        h.cacheSimilarWeb(offerData.Domain, similarWebData, true, 7*24*time.Hour)
        cachedData = similarWebData
    }

    // Step 5: 持久化评估结果
    evaluation := &OfferEvaluation{
        UserID:           req.UserID,
        OfferID:          req.OfferID,
        OfferURLHash:     urlHash,
        Domain:           offerData.Domain,
        BrandName:        offerData.Brand,
        SimilarWebData:   cachedData,
        SimilarWebCached: found,
        Status:           "completed",
    }

    err = h.repo.SaveEvaluation(evaluation)
    if err != nil {
        return nil, err
    }

    // Step 6: 更新聚合表
    h.updateAggregations(urlHash, evaluation)

    // Step 7: 回填品牌名
    if req.OfferBrandEmpty {
        h.offerClient.UpdateBrand(req.OfferID, offerData.Brand)
    }

    return evaluation, nil
}
```

**2. 全局缓存策略**
```go
type SimilarWebCache struct {
    Domain      string
    Data        *SimilarWebData
    IsSuccess   bool
    FetchedAt   time.Time
    ExpiresAt   time.Time
}

func (h *Handler) getCachedSimilarWeb(domain string) (*SimilarWebData, bool) {
    var cache SimilarWebCache
    err := h.db.QueryRow(`
        SELECT domain, similarweb_data, is_success, fetched_at, expires_at
        FROM similarweb_global_cache
        WHERE domain = $1 AND expires_at > NOW()
    `, domain).Scan(&cache)

    if err != nil {
        return nil, false
    }

    return cache.Data, true
}

func (h *Handler) cacheSimilarWeb(domain string, data *SimilarWebData, isSuccess bool, ttl time.Duration) {
    expiresAt := time.Now().Add(ttl)

    _, err := h.db.Exec(`
        INSERT INTO similarweb_global_cache (domain, similarweb_data, is_success, fetched_at, expires_at)
        VALUES ($1, $2, $3, NOW(), $4)
        ON CONFLICT (domain) DO UPDATE SET
            similarweb_data = EXCLUDED.similarweb_data,
            is_success = EXCLUDED.is_success,
            fetched_at = EXCLUDED.fetched_at,
            expires_at = EXCLUDED.expires_at
    `, domain, data, isSuccess, expiresAt)
}
```

**验收标准**:
- ✅ 完整评估流程通过
- ✅ 缓存命中率>70%（第二次评估同域名）
- ✅ URL Hash唯一性验证
- ✅ 品牌名自动回填
- ✅ 单元测试覆盖率>80%
- ✅ 集成测试覆盖完整流程

---

### 第3组：Vertex AI Gemini集成（BE-023~030）

**时间**: Day 5-6（1.5天）
**工时**: 13小时
**负责**: Backend-A

#### 任务清单

| 任务ID | 任务名称 | 工时 | 优先级 | 依赖 |
|--------|---------|------|--------|------|
| BE-023 | 配置Vertex AI服务账号 | 1h | P0 | - |
| BE-024 | 设计Prompt模板 | 2h | P0 | - |
| BE-025 | 实现Gemini API调用 | 3h | P0 | BE-023 |
| BE-026 | 实现响应解析和验证 | 2h | P0 | BE-025 |
| BE-027 | 实现重试机制（3次） | 1h | P1 | BE-025 |
| BE-028 | 实现套餐权限检查 | 1h | P0 | BE-025 |
| BE-029 | AI评估结果持久化 | 1h | P0 | BE-018 |
| BE-030 | 单元测试 | 2h | P0 | BE-025~029 |

#### 技术要点

**1. Prompt模板**
```go
const evaluationPrompt = `You are an expert affiliate marketer analyzing website traffic data to recommend Offers.

Domain: {{.Domain}}
Brand: {{.Brand}}

SimilarWeb Data:
- Global Rank: {{.GlobalRank}}
- Monthly Visits: {{.MonthlyVisits}}
- Bounce Rate: {{.BounceRate}}%
- Avg Visit Duration: {{.AvgVisitDuration}} seconds
- Top Traffic Sources: {{.TrafficSources}}

Please evaluate this Offer and provide:
1. A recommendation score (0-100)
2. Exactly 3 reasons supporting your recommendation

Output format (JSON):
{
  "score": 85,
  "reasons": [
    "High traffic volume with 120M monthly visits indicates strong brand presence",
    "Low bounce rate of 35% shows good user engagement",
    "Diverse traffic sources reduce dependency risk"
  ]
}
`
```

**2. Gemini API调用**
```go
// services/siterank/internal/ai/gemini.go
type GeminiClient struct {
    projectID string
    location  string
    model     string
}

func (c *GeminiClient) Evaluate(ctx context.Context, data *SimilarWebData) (*AIEvaluation, error) {
    // 填充Prompt
    prompt := c.renderPrompt(data)

    // 调用Vertex AI
    url := fmt.Sprintf("https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent",
        c.location, c.projectID, c.location, c.model)

    req := &GenerateContentRequest{
        Contents: []Content{{
            Role: "user",
            Parts: []Part{{Text: prompt}},
        }},
        GenerationConfig: &GenerationConfig{
            Temperature:     0.7,
            TopP:            0.9,
            MaxOutputTokens: 512,
        },
    }

    var resp GenerateContentResponse
    err := c.doRequestWithRetry(ctx, url, req, &resp, 3)
    if err != nil {
        return nil, err
    }

    // 解析JSON响应
    var evaluation AIEvaluation
    err = json.Unmarshal([]byte(resp.Candidates[0].Content.Parts[0].Text), &evaluation)
    if err != nil {
        return nil, fmt.Errorf("parse AI response: %w", err)
    }

    // 验证
    if evaluation.Score < 0 || evaluation.Score > 100 {
        return nil, fmt.Errorf("invalid score: %d", evaluation.Score)
    }
    if len(evaluation.Reasons) != 3 {
        return nil, fmt.Errorf("expected 3 reasons, got %d", len(evaluation.Reasons))
    }

    return &evaluation, nil
}
```

**验收标准**:
- ✅ Vertex AI服务账号配置完成
- ✅ 成功获取AI评估（Score 0-100，3条理由）
- ✅ 重试机制生效（失败自动重试3次）
- ✅ Starter用户不调用AI
- ✅ Pro/Elite用户自动调用AI
- ✅ 单元测试覆盖率>80%

---

### 第4组：Token预扣机制（BE-032~035）

**时间**: Day 6（0.5天）
**工时**: 6小时（BE-031表创建已完成）
**负责**: Backend-C

#### 任务清单

| 任务ID | 任务名称 | 工时 | 优先级 | 依赖 |
|--------|---------|------|--------|------|
| BE-032 | 实现`POST /tokens/reserve` | 2h | P0 | BE-031 |
| BE-033 | 实现`POST /tokens/confirm` | 1h | P0 | BE-032 |
| BE-034 | 实现`POST /tokens/refund` | 1h | P0 | BE-032 |
| BE-035 | 单元测试 | 2h | P0 | BE-032~034 |

#### 技术要点

**API设计**
```go
// services/billing/internal/handlers/tokens.go

// 预扣Token
POST /api/v1/billing/tokens/reserve
{
  "user_id": "uuid",
  "amount": 3,
  "reason": "offer_evaluation",
  "reference_id": "evaluation-uuid"
}
Response: {
  "reservation_id": "uuid",
  "status": "reserved"
}

// 确认消耗
POST /api/v1/billing/tokens/confirm
{
  "reservation_id": "uuid"
}
Response: {
  "status": "confirmed",
  "tokens_deducted": 3
}

// 退还Token
POST /api/v1/billing/tokens/refund
{
  "reservation_id": "uuid"
}
Response: {
  "status": "refunded",
  "tokens_returned": 3
}
```

**幂等性保证**:
```go
func (h *Handler) ConfirmReservation(reservationID string) error {
    // 使用事务确保原子性
    tx, err := h.db.Begin()
    defer tx.Rollback()

    // 检查reservation状态
    var status string
    err = tx.QueryRow(`
        SELECT status FROM token_reservations WHERE id = $1 FOR UPDATE
    `, reservationID).Scan(&status)

    if status == "confirmed" {
        // 已确认，幂等返回成功
        return nil
    }

    if status != "reserved" {
        return fmt.Errorf("invalid status: %s", status)
    }

    // 更新状态
    _, err = tx.Exec(`
        UPDATE token_reservations
        SET status = 'confirmed', confirmed_at = NOW()
        WHERE id = $1
    `, reservationID)

    // 扣除Token余额（UserToken表）
    _, err = tx.Exec(`
        UPDATE user_tokens
        SET balance = balance - (SELECT amount FROM token_reservations WHERE id = $1)
        WHERE user_id = (SELECT user_id FROM token_reservations WHERE id = $1)
    `, reservationID)

    tx.Commit()
    return nil
}
```

**验收标准**:
- ✅ 预扣成功，余额减少
- ✅ 确认幂等性（重复调用不重复扣款）
- ✅ 退还成功，余额恢复
- ✅ 并发安全（使用FOR UPDATE）
- ✅ 单元测试覆盖率>80%

---

### 第5组：Offer Service API增强（BE-036~043）

**时间**: Day 7-8（1.5天）
**工时**: 12小时
**负责**: Backend-D

#### 任务清单

| 任务ID | 任务名称 | 工时 | 优先级 | 依赖 |
|--------|---------|------|--------|------|
| BE-036 | 增强`POST /offers/{id}/evaluate` | 2h | P0 | BE-035 |
| BE-037 | 实现套餐查询（Billing Service） | 1h | P0 | BE-036 |
| BE-038 | 实现Token消耗计算（1或3） | 1h | P0 | BE-037 |
| BE-039 | 发布Pub/Sub消息到Siterank | 2h | P0 | BE-036 |
| BE-040 | 实现`GET /offers/{id}/evaluations` | 1h | P1 | BE-018 |
| BE-041 | 实现`GET /offers/{id}/evaluations/latest` | 1h | P0 | BE-018 |
| BE-042 | 单元测试 | 2h | P0 | BE-036~041 |
| BE-043 | 集成测试 | 2h | P0 | BE-042 |

#### 技术要点

**1. 评估触发API**
```go
// services/offer/internal/handlers/evaluate.go
func (h *Handler) PostOffersIDEvaluate(w http.ResponseWriter, r *http.Request, id string) {
    // Step 1: 查询用户套餐
    tier, err := h.billingClient.GetUserTier(userID)
    if err != nil {
        return handleError(w, err)
    }

    // Step 2: 计算Token消耗
    tokensRequired := 1 // Starter
    if tier == "professional" || tier == "elite" {
        tokensRequired = 3 // Pro/Elite (包含AI)
    }

    // Step 3: 预扣Token
    reservation, err := h.billingClient.ReserveTokens(userID, tokensRequired, "offer_evaluation", id)
    if err != nil {
        return handleError(w, err)
    }

    // Step 4: 发布Pub/Sub消息
    msg := &EvaluationMessage{
        EvaluationID:   uuid.New().String(),
        UserID:         userID,
        OfferID:        id,
        OfferURL:       offer.URL,
        Tier:           tier,
        ReservationID:  reservation.ID,
        TokensReserved: tokensRequired,
    }

    err = h.pubsubClient.Publish("siterank.evaluate", msg)
    if err != nil {
        // 失败则退还Token
        h.billingClient.RefundTokens(reservation.ID)
        return handleError(w, err)
    }

    // Step 5: 返回202 Accepted
    w.WriteHeader(http.StatusAccepted)
    json.NewEncoder(w).Encode(map[string]string{
        "status": "evaluating",
        "evaluation_id": msg.EvaluationID,
    })
}
```

**2. Pub/Sub消息格式**
```json
{
  "evaluation_id": "uuid",
  "user_id": "uuid",
  "offer_id": "uuid",
  "offer_url": "https://example.com",
  "tier": "professional",
  "reservation_id": "uuid",
  "tokens_reserved": 3,
  "timestamp": "2025-10-15T12:00:00Z"
}
```

**验收标准**:
- ✅ 评估触发成功，返回202
- ✅ Token正确预扣（Starter=1, Pro/Elite=3）
- ✅ Pub/Sub消息正确发布
- ✅ 评估结果查询API正常
- ✅ 端到端集成测试通过
- ✅ 单元测试覆盖率>80%

---

## 📊 进度跟踪

### 里程碑完成标准

- ✅ 所有38个后端任务完成
- ✅ 单元测试覆盖率>80%
- ✅ 集成测试通过
- ✅ 端到端评估流程验证通过
- ✅ 性能测试：评估响应<3秒（P95）

### 每日站会

**时间**: 每天10:00
**时长**: 15分钟

**讨论内容**:
1. 昨日完成任务
2. 今日计划任务
3. 遇到的阻塞问题

---

## 🚨 风险与依赖

### 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| SimilarWeb API访问受限 | 高 | 准备降级方案（Mock数据） |
| Vertex AI配额不足 | 中 | 提前申请配额 |
| Pub/Sub延迟过高 | 中 | 实现超时机制 |

### 外部依赖

- ✅ M1基础设施完成（已完成）
- ⏳ SimilarWeb API Key（需申请）
- ⏳ Vertex AI配额（需确认）

---

## 📝 提交与部署

### 代码提交规范

```
feat(offer-eval): implement SimilarWeb integration

- Add POST /similarweb endpoint
- Implement HTML/JSON parser
- Add proxy support

Closes: BE-006, BE-007, BE-008
```

### 部署计划

**Preview环境**:
- 每个模块完成后立即部署测试
- 使用preview分支

**Production环境**:
- M2完全完成后统一部署
- 需要完整的回归测试

---

## ✅ M2完成检查清单

- [ ] Browser-Exec SimilarWeb集成完成
- [ ] Siterank核心评估逻辑完成
- [ ] Vertex AI Gemini集成完成
- [ ] Token预扣机制完成
- [ ] Offer Service API增强完成
- [ ] 所有单元测试通过（覆盖率>80%）
- [ ] 集成测试通过
- [ ] 端到端评估流程验证通过
- [ ] 性能测试通过（响应<3秒）
- [ ] 文档更新完成
- [ ] Preview环境部署成功
- [ ] 代码Review通过

---

**下一步**: 开始BE-006任务，实现Browser-Exec SimilarWeb集成
