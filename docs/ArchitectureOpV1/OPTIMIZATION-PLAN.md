# AutoAds 架构优化实施方案

**版本**: 1.0
**创建日期**: 2025-10-16
**实施周期**: 12周
**预期收益**: 性能提升73%，成本降低48%

---

## 📋 目录

1. [执行摘要](#-执行摘要)
2. [当前状态](#-当前状态)
3. [优化方案](#-优化方案)
4. [实施路线图](#-实施路线图)
5. [验收标准](#-验收标准)

---

## 🎯 执行摘要

### 优化目标

解决当前架构的4个核心问题：
1. **代码规范违反**: 2个文件超过300行限制
2. **基础能力分散**: 权限和Token管理在每个服务重复实现
3. **性能瓶颈**: 评估流程串行执行，耗时16秒
4. **测试覆盖不足**: 平均覆盖率<10%

### 核心收益

| 维度 | 当前 | 优化后 | 提升 |
|------|------|--------|------|
| 评估响应时间 | 16s | 6s | ⚡ 63% |
| API响应时间 | 300ms | 5ms | ⚡ 98% |
| 系统吞吐量 | 100 req/s | 300 req/s | 📈 200% |
| 运营成本 | $430/月 | $225/月 | 💰 48% |
| 代码质量评分 | 5.5/10 | 8.5/10 | ⬆️ +3.0 |

---

## 📊 当前状态

### 服务清单（13个）

| 服务 | 职责 | 部署状态 |
|------|------|----------|
| **核心业务层** | | |
| offer | Offer管理、评估编排 | ✅ 全环境 |
| billing | 订阅管理、Token管理 | ✅ 全环境 |
| adscenter | 广告投放、账户管理 | ✅ 全环境 |
| **功能服务层** | | |
| siterank | 网站评估执行 | ✅ 全环境 |
| browser-exec | 网页访问、数据抓取 | ✅ 全环境 |
| recommendations | 优化建议 | ✅ 全环境 |
| **基础设施层** | | |
| proxy-pool | 代理池管理 | ✅ 全环境 |
| projector | 事件投影 | ✅ 全环境 |
| **辅助服务层** | | |
| console | 管理后台 | ✅ 全环境 |
| batchopen | 批量操作 | ✅ 全环境 |
| bff | Dashboard数据聚合 | ⚠️ 仅preview |
| useractivity | 用户行为+通知 | ⚠️ 仅preview |
| **前端** | | |
| frontend | Next.js 14 | ✅ 全环境 |

### 技术栈

- **前端**: Next.js 14 + Makerkit
- **后端**: Go 1.25 (主) + Node.js 22 (browser-exec)
- **数据库**: PostgreSQL + Redis
- **消息队列**: GCP Pub/Sub
- **网关**: GCP API Gateway
- **部署**: Cloud Run

### 关键问题

| 问题 | 影响 | 优先级 |
|------|------|--------|
| `siterank/evaluation/service.go` 978行 | 违反规范、难维护 | P0 |
| `offer/handlers/offers_evaluation_handlers.go` 405行 | 违反规范 | P0 |
| 权限和Token管理分散在各服务 | 重复代码70%、billing负载高 | P1 |
| 评估步骤串行执行 | 16秒延迟 | P1 |
| SimilarWeb数据使用PostgreSQL缓存 | 数据库负载高40% | P1 |
| HTTP和后台任务未分离 | 扩展性差 | P1 |

---

## 💡 优化方案

### Phase 1: 紧急修复（Week 1-2）

#### P0-1: 代码文件拆分

**siterank/evaluation 重构**
```
services/siterank/internal/evaluation/
├── service.go              (< 300行) - 核心接口
├── basic_evaluation.go     (~200行) - 基础评估
├── ai_evaluation.go        (~150行) - AI评估
├── cache.go                (~150行) - 缓存逻辑
├── aggregations.go         (~100行) - 聚合更新
└── repository.go           (~200行) - 数据访问
```

**offer/handlers 重构**
```
services/offer/internal/handlers/
├── offers_evaluation_handlers.go  (~150行) - HTTP入口
├── evaluation_orchestrator.go     (~150行) - 评估编排
└── evaluation_billing.go          (~100行) - Billing集成
```

**工作量**: 3-5天
**收益**: 符合规范、可维护性提升60%

#### P0-2: i18n规范修复

**扫描硬编码**
```bash
grep -r "[\u4e00-\u9fa5]" apps/frontend/src --include="*.tsx" | grep -v "t("
```

**修复示例**
```tsx
// ❌ 错误
<button>创建Offer</button>

// ✅ 正确
const { t } = useTranslation();
<button>{t('offers.create')}</button>
```

**工作量**: 1-2天
**收益**: 符合规范、支持多语言

#### P1-6: 数据库索引优化

```sql
-- Offer表
CREATE INDEX CONCURRENTLY idx_offer_user_status
  ON "Offer"(user_id, status);
CREATE INDEX CONCURRENTLY idx_offer_created_at
  ON "Offer"(created_at DESC);

-- offer_evaluations表
CREATE INDEX CONCURRENTLY idx_eval_offer_created
  ON offer_evaluations(offer_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_eval_user_type
  ON offer_evaluations(user_id, evaluation_type);

-- TokenTransaction表
CREATE INDEX CONCURRENTLY idx_token_tx_user_created
  ON token_transactions(user_id, created_at DESC);
```

**工作量**: 1天
**收益**: 查询性能提升80%

---

### Phase 2: 基础能力统一（Week 3-6）

#### P1-1: Gateway Middleware Service

**架构**
```
Frontend → GCP API Gateway → Gateway Middleware → 业务服务
```

**核心功能**
1. JWT验证
2. 订阅套餐查询（Redis缓存，5分钟TTL）
3. 功能权限检查（Redis缓存，5分钟TTL）
4. Token余额检查和预留（Redis缓存，1分钟TTL）
5. 请求头注入（X-User-ID, X-User-Tier, X-Token-Reserved等）

**技术栈**
- Go 1.25 + Gin
- Redis (Memorystore)
- PostgreSQL (配置存储)
- GCP Pub/Sub (配置热更新)
- Cloud Run

**中间件管道**
```go
router.Use(
    middleware.JWTValidator(),         // 1. JWT验证
    middleware.SubscriptionLoader(),   // 2. 加载订阅套餐
    middleware.PermissionChecker(),    // 3. 检查功能权限
    middleware.TokenManager(),         // 4. Token预留
    middleware.HeaderInjector(),       // 5. 注入请求头
    middleware.ReverseProxy(),         // 6. 转发
)
```

**实施步骤**
- Week 3: Gateway服务开发（中间件 + 反向代理）
- Week 4: 配置管理和热更新机制
- Week 5: 业务服务简化（移除权限检查代码）
- Week 6: 部署和验证

**收益**
- 响应时间: 150ms → 5ms (97%提升)
- billing负载: -80%
- 重复代码: -70%

**详细设计**: 见 `14-API-GATEWAY-UNIFIED-PERMISSIONS.md`

#### P1-2: 去除PostgreSQL缓存表

**当前**: Redis(短期) → PostgreSQL(长期,7天) → API调用
**优化**: Redis(7天TTL) → API调用

**实施步骤**
```bash
# 1. 延长Redis TTL
# 2. 删除PostgreSQL缓存逻辑
# 3. 删除表
DROP TABLE IF EXISTS domain_cache;
DROP TABLE IF EXISTS domain_country_cache;
```

**工作量**: 1-2周
**收益**: 缓存性能提升90%、数据库负载降低40%

#### P1-3: API+Worker架构拆分

**当前**: siterank (HTTP + 评估任务)
**优化**: siterank-api (HTTP) + siterank-worker (评估任务)

**API层**
```go
func (h *APIHandler) CreateEvaluation(w http.ResponseWriter, r *http.Request) {
    // 1. 创建evaluation记录
    evaluationID := createEvaluation(...)

    // 2. 发送到Pub/Sub队列
    h.pubsub.Publish("evaluation-tasks", &Task{
        EvaluationID: evaluationID,
        Priority:     req.EnableAI ? "high" : "normal",
    })

    // 3. 立即返回（不等待执行）
    w.WriteHeader(202)
    json.NewEncoder(w).Encode(map[string]string{
        "evaluationId": evaluationID,
        "status":       "queued",
        "estimatedTime": "15s",
    })
}
```

**Worker层**
```go
func (w *Worker) ProcessTask(task *Task) error {
    return w.evalService.ExecuteEvaluation(context.Background(), task.EvaluationID)
}
```

**部署配置**
```yaml
# siterank-api
resources:
  cpu: "0.5"
  memory: "512Mi"
autoscaling:
  min: 1
  max: 10

# siterank-worker
resources:
  cpu: "1"
  memory: "1Gi"
autoscaling:
  min: 1
  max: 20  # 根据队列长度
```

**工作量**: 2-3周
**收益**: API响应时间 15s → 50ms、吞吐量提升200%、成本优化30%

---

### Phase 3: 性能优化（Week 7-9）

#### P2-1: 评估步骤并行化

**当前**: 串行执行 16s
```
Visit URL (5s) → SimilarWeb (3s) → AI (8s) = 16s
```

**优化**: 并行执行 11s
```go
var wg sync.WaitGroup
var visitResult *VisitResult
var swData *SimilarWebData

// 并行执行
wg.Add(2)
go func() {
    defer wg.Done()
    visitResult, _ = s.browserExec.VisitURL(ctx, url)
}()
go func() {
    defer wg.Done()
    swData, _ = s.similarweb.GetData(ctx, domain)
}()
wg.Wait()

// 继续AI评估
aiResult := s.aiEvaluator.Evaluate(ctx, visitResult, swData)
```

**工作量**: 3天
**收益**: 评估速度提升31% (16s → 11s)

#### P2-2: SimilarWeb数据预加载

**实现**
```go
func (h *Handler) CreateOffer(w http.ResponseWriter, r *http.Request) {
    offer := createOfferFromRequest(r)
    h.db.Insert(offer)

    // 异步预加载SimilarWeb（不阻塞响应）
    go h.preloadSimilarWebData(offer.OriginalURL)

    respondJSON(w, offer)
}
```

**工作量**: 2天
**收益**: 首次评估速度提升60% (16s → 6s)

#### P2-3: Token余额缓存

```go
func (s *Service) GetBalance(ctx context.Context, userID string) (int, error) {
    // 1. 尝试Redis缓存
    cacheKey := fmt.Sprintf("token:balance:%s", userID)
    if cached, err := s.redis.Get(ctx, cacheKey).Int(); err == nil {
        return cached, nil
    }

    // 2. 查询数据库
    balance, err := s.db.QueryBalance(userID)
    if err != nil {
        return 0, err
    }

    // 3. 写入Redis（60秒TTL）
    s.redis.Set(ctx, cacheKey, balance, 60*time.Second)
    return balance, nil
}
```

**工作量**: 1天
**收益**: Token查询性能提升90% (50ms → 5ms)

#### P2-5: Browser Context池复用

```javascript
class ContextPool {
    constructor(maxSize = 10) {
        this.pool = []
        this.maxSize = maxSize
    }

    async acquire() {
        if (this.pool.length > 0) {
            const ctx = this.pool.pop()
            await ctx.clearCookies()
            return ctx
        }
        return await browser.newContext()
    }

    async release(context) {
        if (this.pool.length < this.maxSize) {
            this.pool.push(context)
        } else {
            await context.close()
        }
    }
}
```

**工作量**: 3天
**收益**: Context创建时间减少80% (2s → 400ms)、内存占用降低60%

---

### Phase 4: 持续改进（Week 10-12）

#### P1-5: 断路器模式

```go
breaker := circuitbreaker.New(
    circuitbreaker.WithFailureThreshold(5),
    circuitbreaker.WithSuccessThreshold(2),
    circuitbreaker.WithTimeout(30*time.Second),
)

func (c *Client) CallBilling() (*Response, error) {
    var resp *Response
    err := breaker.Call(func() error {
        var err error
        resp, err = c.httpClient.Get("/api/v1/billing/subscription")
        return err
    })

    if errors.Is(err, circuitbreaker.ErrOpen) {
        return c.getCachedSubscription(), nil  // 降级策略
    }
    return resp, err
}
```

**工作量**: 1周
**收益**: 系统可用性提升至99.9%+

#### 监控和告警完善

**关键指标Dashboard**
- 评估成功率
- Token消耗速率
- API响应时间（P50/P95/P99）
- 错误率

**告警规则**
- 评估成功率 <90%
- API响应时间 P95 >500ms
- 错误率 >5%
- Token余额 <100

#### 自动化测试完善

**目标**: 测试覆盖率 >70%

- 单元测试（目标80%）
- 集成测试（API端到端）
- 性能测试（评估流程压测）

---

## 📅 实施路线图

### 时间线

```
┌─────────────────────────────────────────────────────────┐
│ Week 1-2: Phase 1 - 紧急修复                            │
│   ✓ P0-1 代码拆分                                       │
│   ✓ P0-2 i18n修复                                       │
│   ✓ P1-6 索引优化                                       │
│   → 代码质量: 5.5 → 6.5                                 │
├─────────────────────────────────────────────────────────┤
│ Week 3-6: Phase 2 - 基础能力统一                        │
│   ✓ P1-1 Gateway Middleware (核心)                     │
│   ✓ P1-2 去除PG缓存                                     │
│   ✓ P1-3 API+Worker架构                                │
│   → 代码质量: 6.5 → 7.5                                 │
├─────────────────────────────────────────────────────────┤
│ Week 7-9: Phase 3 - 性能优化                            │
│   ✓ P2-1 并行化评估                                     │
│   ✓ P2-2 SW预加载                                       │
│   ✓ P2-3 Token缓存                                      │
│   ✓ P2-5 Context池                                      │
│   → 代码质量: 7.5 → 8.2                                 │
├─────────────────────────────────────────────────────────┤
│ Week 10-12: Phase 4 - 持续改进                          │
│   ✓ P1-5 断路器                                         │
│   ✓ 监控告警                                            │
│   ✓ 测试完善                                            │
│   → 代码质量: 8.2 → 8.5                                 │
└─────────────────────────────────────────────────────────┘
```

### 里程碑

| Week | 里程碑 | 关键交付物 | 评分 |
|------|--------|-----------|------|
| Week 0 | 当前状态 | - | 5.5/10 |
| Week 2 | Phase 1完成 | 代码拆分、索引优化 | 6.5/10 |
| Week 6 | Phase 2完成 | Gateway Middleware、API+Worker | 7.5/10 |
| Week 9 | Phase 3完成 | 并行化、预加载、缓存 | 8.2/10 |
| Week 12 | Phase 4完成 | 断路器、监控、测试 | 8.5/10 |

### 团队分工

| 团队 | 职责 |
|------|------|
| **Backend Team** | Phase 1-3（代码拆分、Gateway开发、性能优化） |
| **Frontend Team** | Phase 1（i18n修复） |
| **DevOps Team** | Phase 2-4（Gateway部署、监控、告警） |
| **Full Team** | Phase 4（测试完善、文档更新） |

---

## ✅ 验收标准

### Phase 1验收

- [ ] 所有文件 <300行
- [ ] 测试通过率 100%
- [ ] 代码覆盖率 >80%
- [ ] 零硬编码字符串
- [ ] 慢查询数量减少 80%

### Phase 2验收

- [ ] Gateway Middleware部署成功（preview + prod）
- [ ] billing服务负载降低 60%
- [ ] API响应时间 <10ms (P95)
- [ ] 业务服务代码减少 20%
- [ ] Redis缓存命中率 >85%
- [ ] API响应时间: 15s → 50ms
- [ ] Worker独立扩缩容正常

### Phase 3验收

- [ ] 评估时间: 16s → 11s（后续）
- [ ] 首次评估: 16s → 6s
- [ ] Token查询: 50ms → 5ms
- [ ] Context创建: 2s → 400ms
- [ ] 内存占用降低 60%

### Phase 4验收

- [ ] 系统可用性 >99.9%
- [ ] 所有关键指标Dashboard可用
- [ ] 告警规则生效
- [ ] 测试覆盖率 >70%

### 总体验收指标

| 指标 | 当前 | 目标 | 验收标准 |
|------|------|------|----------|
| **性能** | | | |
| 评估首次响应 | 16s | 6s | ≤6s |
| 评估后续响应 | 16s | 11s | ≤11s |
| API响应时间 | 300ms | 5ms | ≤10ms |
| Token查询 | 50ms | 5ms | ≤10ms |
| 系统吞吐量 | 100 req/s | 300 req/s | ≥250 req/s |
| **成本** | | | |
| Cloud Run | $200/月 | $130/月 | ≤$150/月 |
| PostgreSQL | $80/月 | $50/月 | ≤$60/月 |
| SimilarWeb API | $150/月 | $45/月 | ≤$50/月 |
| **代码质量** | | | |
| 平均文件行数 | 450行 | 180行 | <300行 |
| 重复代码 | 30% | 10% | <15% |
| 测试覆盖率 | 10% | 70% | >60% |
| 代码质量评分 | 5.5/10 | 8.5/10 | ≥8.0/10 |

---

## 🚨 风险管理

### 高风险项

#### 1. Gateway Middleware重构 (Phase 2.1)
- **影响**: 所有API端点
- **缓解**:
  - 灰度发布（preview环境先行1周）
  - 保留旧逻辑双写
  - 完整的回滚方案
- **回滚**: 切换Gateway路由回旧服务

#### 2. API+Worker拆分 (Phase 2.3)
- **影响**: 评估流程
- **缓解**:
  - Pub/Sub保证消息不丢失
  - Worker可回退到API模式
  - 队列监控告警
- **回滚**: 停止Worker，API恢复同步处理

### 中风险项

#### 去除PostgreSQL缓存 (Phase 2.2)
- **影响**: 缓存命中率可能暂时下降
- **缓解**: 预先导入Redis
- **回滚**: 保留表结构1周

### 低风险项

- 代码拆分、索引优化、并行化（影响范围小，易回滚）

---

## 📚 参考文档

### 详细技术方案
- `14-API-GATEWAY-UNIFIED-PERMISSIONS.md` - Gateway Middleware完整设计
- `07-SUBSCRIPTION-CONFIG-HOT-RELOAD.md` - 配置热更新机制
- `04-OPTIMIZATION-OPPORTUNITIES.md` - 18项优化详细说明

### 当前架构分析
- `01-CURRENT-ARCHITECTURE.md` - 当前架构全景
- `02-SERVICE-INVENTORY.md` - 服务清单与职责
- `03-DATA-FLOW-ANALYSIS.md` - 数据流分析

### 审查报告
- `FINAL-REVIEW-REPORT.md` - 第三轮Review报告（Ground Truth验证）
- `ARCHITECTURE-REVIEW-FINDINGS.md` - 审查发现汇总

---

## 📞 支持

- **项目负责人**: Jason
- **技术问题**: 提交Issue到项目仓库
- **实施进展**: 更新本文档的验收清单
- **紧急联系**: 见团队内部文档

---

**版本历史**
- v1.0 (2025-10-16): 初始版本，基于第三轮Ground Truth验证结果

---

**让我们开始优化AutoAds，打造高性能SaaS平台！** 🚀
