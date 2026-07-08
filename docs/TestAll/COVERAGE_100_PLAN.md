# 测试覆盖率100%达成计划

**当前覆盖率**: 95%（15个业务需求）
**目标覆盖率**: 100%
**剩余缺口**: 5%
**更新日期**: 2025-10-16

---

## 📊 当前覆盖度分析

### 已完成（100%覆盖）- 11个需求

1. ✅ **需求1**: Offer CRUD操作
2. ✅ **需求2**: 评估任务队列（Pub/Sub异步）
3. ✅ **需求5**: AI评估集成（Vertex AI Gemini）
4. ✅ **需求6**: Token计费系统（预扣-消费-释放）
5. ✅ **需求8**: 订阅套餐管理
6. ✅ **需求9**: 权限控制（RBAC）
7. ✅ **需求10**: 广告账号绑定
8. ✅ **需求11**: 签到系统
9. ✅ **需求12**: Token消耗规则（1+2=3）✨ V4.1补充
10. ✅ **需求13**: 推荐系统
11. ✅ **需求14**: 通知系统

### 部分覆盖（<100%）- 4个需求

| 需求 | 当前覆盖 | 缺口 | E2E测试 | 缺失测试类型 |
|-----|---------|-----|---------|-------------|
| **需求3**: SimilarWeb API集成 | 90% | 10% | ✅ | 后端单元测试 |
| **需求4**: Brand Name自动填充 | 80% | 20% | ✅ | 数据库验证 + 后端测试 |
| **需求7**: 缓存优化策略 | 85% | 15% | ✅ | Redis集成测试 |
| **需求15**: Dashboard聚合API | 70% | 30% | ⚠️ | E2E + 后端测试 |

**缺口总计**: (10% + 20% + 15% + 30%) / 4 ≈ 19% → 整体5%缺口

---

## 🎯 达到100%覆盖的策略

### 策略1: 分层测试体系（推荐）⭐

采用**测试金字塔**模型，用不同测试层级覆盖E2E无法触及的部分：

```
        E2E Tests (10%)
          /        \
    Integration Tests (30%)
          /        \
      Unit Tests (60%)
```

#### 测试层级定义

1. **E2E测试（已完成）**
   - 工具: Playwright
   - 范围: 用户视角的完整流程
   - 限制: 无法访问后端内部（Redis、Secret Manager、服务间调用）

2. **集成测试（需补充）**
   - 工具: Go testing + testcontainers
   - 范围: 后端服务 + 外部依赖（Redis、PostgreSQL）
   - 目标: 验证数据持久化、缓存行为、API集成

3. **单元测试（需补充）**
   - 工具: Go testing + mock
   - 范围: 单个函数/模块
   - 目标: 验证业务逻辑、边界条件、错误处理

### 策略2: 监控和日志验证（辅助）

- Cloud Logging查询验证SimilarWeb API调用
- Redis CLI直接验证缓存键和TTL
- PostgreSQL查询验证brand_name字段

### 策略3: 合理接受E2E限制（务实）

对于纯后端行为，E2E测试只验证**可观测的结果**：
- ✅ 验证: 评估返回结果包含SimilarWeb数据
- ❌ 不验证: HTTP请求头中是否包含API Key（后端单元测试负责）

---

## 🔧 具体补充测试计划

### 需求3: SimilarWeb API集成（90% → 100%）

**缺口分析**:
- ✅ E2E已验证: API端点格式、响应数据结构
- ❌ 缺失验证: Secret Manager读取、API Key注入、错误重试

**补充测试**:

#### 1. 后端单元测试（browser-exec服务）

**文件**: `services/browser-exec/internal/similarweb/client_test.go`

```go
// 测试1: Secret Manager API Key读取
func TestLoadAPIKeyFromSecretManager(t *testing.T) {
    ctx := context.Background()

    // Mock Secret Manager client
    mockSecretClient := &MockSecretClient{
        secrets: map[string]string{
            "SIMILARWEB_API_KEY": "test-api-key-12345",
        },
    }

    client := NewSimilarWebClient(mockSecretClient)
    apiKey, err := client.LoadAPIKey(ctx)

    assert.NoError(t, err)
    assert.Equal(t, "test-api-key-12345", apiKey)
}

// 测试2: API Key注入到请求头
func TestAPIKeyInjection(t *testing.T) {
    // 使用httptest.Server验证请求头
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        apiKey := r.Header.Get("X-API-Key")
        assert.Equal(t, "test-api-key-12345", apiKey)
        w.WriteHeader(http.StatusOK)
    }))
    defer server.Close()

    client := NewSimilarWebClient(WithBaseURL(server.URL), WithAPIKey("test-api-key-12345"))
    _, err := client.GetDomainData(context.Background(), "nike.com")
    assert.NoError(t, err)
}

// 测试3: API调用失败重试机制
func TestAPIRetryOnFailure(t *testing.T) {
    attempts := 0
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        attempts++
        if attempts < 3 {
            w.WriteHeader(http.StatusInternalServerError)
            return
        }
        w.WriteHeader(http.StatusOK)
        json.NewEncoder(w).Encode(map[string]interface{}{"rank": 1000})
    }))
    defer server.Close()

    client := NewSimilarWebClient(WithBaseURL(server.URL), WithMaxRetries(3))
    data, err := client.GetDomainData(context.Background(), "example.com")

    assert.NoError(t, err)
    assert.Equal(t, 3, attempts) // 验证重试了2次
}
```

**预期收益**: +10%覆盖度

---

### 需求4: Brand Name自动填充（80% → 100%）

**缺口分析**:
- ✅ E2E已验证: 前端UI显示brand_name
- ❌ 缺失验证: 数据库持久化、提取逻辑边界条件

**补充测试**:

#### 1. 数据库集成测试（siterank服务）

**文件**: `services/siterank/internal/repository/evaluation_test.go`

```go
// 测试1: brand_name持久化到evaluation_aggregations表
func TestBrandNamePersistence(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()

    repo := NewEvaluationRepository(db)

    // 创建评估记录（包含brand_name）
    eval := &Evaluation{
        OfferID:   "test-offer-123",
        UserID:    "test-user-456",
        BrandName: "Nike",
        Domain:    "nike.com",
    }

    err := repo.SaveEvaluation(context.Background(), eval)
    assert.NoError(t, err)

    // 验证数据库记录
    var brandName string
    err = db.QueryRow(
        "SELECT brand_name FROM evaluation_aggregations WHERE offer_id = $1",
        "test-offer-123",
    ).Scan(&brandName)

    assert.NoError(t, err)
    assert.Equal(t, "Nike", brandName)
}

// 测试2: brand_name提取逻辑
func TestExtractBrandNameFromDomain(t *testing.T) {
    tests := []struct {
        domain   string
        expected string
    }{
        {"nike.com", "Nike"},
        {"www.shopify.com", "Shopify"},
        {"adidas.co.uk", "Adidas"},
        {"example-brand.io", "Example Brand"},
        {"123.com", "123"}, // 边界条件
    }

    for _, tt := range tests {
        t.Run(tt.domain, func(t *testing.T) {
            brandName := ExtractBrandName(tt.domain)
            assert.Equal(t, tt.expected, brandName)
        })
    }
}
```

#### 2. E2E测试补充（数据库验证）

**文件**: `scripts/tests/test-offer-evaluation-complete.mjs`（更新）

```javascript
// 补充: 通过API验证brand_name持久化
async function verifyBrandNameInDatabase(offerID) {
  // 调用后端API获取评估详情
  const response = await fetch(`${API_URL}/api/v1/offers/${offerID}/evaluations`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  const brandName = data.aggregations?.brand_name;

  console.log(`   ✓ 数据库中的Brand Name: ${brandName}`);
  assert(brandName, 'Brand Name应持久化到数据库');
}
```

**预期收益**: +20%覆盖度

---

### 需求7: 缓存优化策略（85% → 100%）

**缺口分析**:
- ✅ E2E已验证: 缓存命中效果（通过响应时间）
- ❌ 缺失验证: Redis键格式、TTL精确值、失败重试

**补充测试**:

#### 1. Redis集成测试（siterank服务）

**文件**: `services/siterank/internal/cache/redis_test.go`

```go
// 测试1: 成功缓存TTL=7天
func TestSuccessCacheTTL(t *testing.T) {
    ctx := context.Background()
    rdb := setupTestRedis(t)
    defer rdb.Close()

    cache := NewSimilarWebCache(rdb)

    // 缓存成功数据
    data := &SimilarWebData{GlobalRank: 1000}
    err := cache.SetSuccess(ctx, "nike.com", data)
    assert.NoError(t, err)

    // 验证键格式
    key := "sw:nike.com"
    exists := rdb.Exists(ctx, key).Val()
    assert.Equal(t, int64(1), exists)

    // 验证TTL
    ttl := rdb.TTL(ctx, key).Val()
    expectedTTL := 7 * 24 * time.Hour
    assert.InDelta(t, expectedTTL.Seconds(), ttl.Seconds(), 100) // 允许100秒误差
}

// 测试2: 失败缓存TTL=1小时
func TestFailureCacheTTL(t *testing.T) {
    ctx := context.Background()
    rdb := setupTestRedis(t)
    defer rdb.Close()

    cache := NewSimilarWebCache(rdb)

    // 缓存失败标记
    err := cache.SetFailure(ctx, "invalid-domain.com", errors.New("API error"))
    assert.NoError(t, err)

    // 验证键格式
    key := "sw:failure:invalid-domain.com"
    exists := rdb.Exists(ctx, key).Val()
    assert.Equal(t, int64(1), exists)

    // 验证TTL
    ttl := rdb.TTL(ctx, key).Val()
    expectedTTL := 1 * time.Hour
    assert.InDelta(t, expectedTTL.Seconds(), ttl.Seconds(), 10) // 允许10秒误差
}

// 测试3: 失败重试机制（时间Mock）
func TestFailureRetryAfterTTL(t *testing.T) {
    ctx := context.Background()
    rdb := setupTestRedis(t)
    defer rdb.Close()

    cache := NewSimilarWebCache(rdb)

    // 第一次: 缓存失败
    cache.SetFailure(ctx, "retry-test.com", errors.New("first failure"))

    // 模拟1小时后
    time.Sleep(1 * time.Hour) // 生产代码应使用时间Mock

    // 第二次: 应该重试API（缓存已过期）
    _, err := cache.GetSuccess(ctx, "retry-test.com")
    assert.Equal(t, ErrCacheMiss, err) // 缓存已失效，触发重试
}
```

**预期收益**: +15%覆盖度

---

### 需求15: Dashboard聚合API（70% → 100%）

**缺口分析**:
- ⚠️ E2E测试不完整: 仅测试了基本显示
- ❌ 缺失验证: 5个服务并发调用、部分失败容错、缓存TTL

**补充测试**:

#### 1. E2E测试完善

**文件**: `scripts/tests/test-dashboard-aggregation.mjs`（更新）

```javascript
// 测试1: 验证5个服务数据聚合
async function testDashboardDataAggregation() {
  await page.goto(`${BASE_URL}/dashboard`);

  // 等待所有数据加载
  await page.waitForSelector('[data-testid="offers-count"]');
  await page.waitForSelector('[data-testid="token-balance"]');
  await page.waitForSelector('[data-testid="subscription-plan"]');
  await page.waitForSelector('[data-testid="ads-account-count"]');
  await page.waitForSelector('[data-testid="checkin-streak"]');

  // 验证数据存在且有效
  const offersCount = await page.textContent('[data-testid="offers-count"]');
  assert(parseInt(offersCount) >= 0, 'Offers count应为数字');

  console.log('   ✓ Dashboard数据完整聚合');
}

// 测试2: 缓存测试（5分钟TTL）
async function testDashboardCaching() {
  // 第一次访问
  const start1 = Date.now();
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForSelector('[data-testid="offers-count"]');
  const time1 = Date.now() - start1;

  // 第二次访问（应命中缓存）
  const start2 = Date.now();
  await page.reload();
  await page.waitForSelector('[data-testid="offers-count"]');
  const time2 = Date.now() - start2;

  // 缓存命中应该更快
  assert(time2 < time1 * 0.5, `缓存命中应更快: ${time2}ms vs ${time1}ms`);
  console.log(`   ✓ 缓存生效: ${time1}ms → ${time2}ms`);
}
```

#### 2. 后端集成测试（bff服务）

**文件**: `services/bff/internal/handlers/dashboard_test.go`

```go
// 测试1: 5个服务并发调用
func TestConcurrentServiceCalls(t *testing.T) {
    ctx := context.Background()

    // Mock 5个服务client
    mockOfferClient := &MockOfferClient{response: OfferStats{Total: 10}}
    mockBillingClient := &MockBillingClient{response: TokenBalance{Balance: 100}}
    mockAdsClient := &MockAdsClient{response: AdsStats{AccountCount: 2}}
    mockActivityClient := &MockActivityClient{response: CheckinStats{Streak: 5}}
    mockSiterankClient := &MockSiterankClient{response: EvalStats{Total: 20}}

    handler := NewDashboardHandler(
        mockOfferClient,
        mockBillingClient,
        mockAdsClient,
        mockActivityClient,
        mockSiterankClient,
    )

    // 记录每个服务的调用时间
    start := time.Now()
    stats, err := handler.GetDashboardStats(ctx, "test-user-123")
    duration := time.Since(start)

    // 验证并发执行（总时间应接近最慢服务，而非5个服务之和）
    assert.NoError(t, err)
    assert.Less(t, duration, 500*time.Millisecond) // 并发应在500ms内完成

    // 验证所有数据正确聚合
    assert.Equal(t, 10, stats.OffersTotal)
    assert.Equal(t, 100, stats.TokenBalance)
    assert.Equal(t, 2, stats.AdsAccountCount)
}

// 测试2: 部分失败容错（<3个失败仍返回200）
func TestPartialFailureTolerance(t *testing.T) {
    // Mock 2个服务失败
    mockOfferClient := &MockOfferClient{err: errors.New("service unavailable")}
    mockBillingClient := &MockBillingClient{response: TokenBalance{Balance: 100}}
    mockAdsClient := &MockAdsClient{err: errors.New("timeout")}
    mockActivityClient := &MockActivityClient{response: CheckinStats{Streak: 5}}
    mockSiterankClient := &MockSiterankClient{response: EvalStats{Total: 20}}

    handler := NewDashboardHandler(...)
    stats, err := handler.GetDashboardStats(ctx, "test-user-123")

    // 应返回部分数据，不报错
    assert.NoError(t, err)
    assert.Equal(t, 0, stats.OffersTotal) // 失败服务返回零值
    assert.Equal(t, 100, stats.TokenBalance) // 成功服务正常
}

// 测试3: Redis缓存TTL=5分钟
func TestDashboardCacheTTL(t *testing.T) {
    rdb := setupTestRedis(t)
    cache := NewDashboardCache(rdb)

    stats := &DashboardStats{OffersTotal: 10}
    cache.Set(ctx, "user-123", stats)

    // 验证键格式
    key := "dashboard:stats:user-123"
    ttl := rdb.TTL(ctx, key).Val()
    expectedTTL := 5 * time.Minute

    assert.InDelta(t, expectedTTL.Seconds(), ttl.Seconds(), 10)
}
```

**预期收益**: +30%覆盖度

---

## 📝 执行计划

### Phase 1: 后端单元测试（优先级P0，预计3天）

**Day 1**: SimilarWeb API集成测试
- [ ] `services/browser-exec/internal/similarweb/client_test.go`
- [ ] 3个测试用例：Secret Manager、API Key注入、重试机制
- [ ] 目标: 需求3覆盖度 90% → 100%

**Day 2**: Brand Name提取和缓存优化
- [ ] `services/siterank/internal/repository/evaluation_test.go`（Brand Name）
- [ ] `services/siterank/internal/cache/redis_test.go`（缓存TTL）
- [ ] 目标: 需求4覆盖度 80% → 100%，需求7覆盖度 85% → 100%

**Day 3**: Dashboard聚合API
- [ ] `services/bff/internal/handlers/dashboard_test.go`
- [ ] 3个测试用例：并发调用、部分失败、缓存TTL
- [ ] `scripts/tests/test-dashboard-aggregation.mjs`（E2E补充）
- [ ] 目标: 需求15覆盖度 70% → 100%

### Phase 2: 集成测试（优先级P1，预计2天）

**Day 4-5**: 测试环境搭建
- [ ] 配置testcontainers（Redis、PostgreSQL）
- [ ] 编写集成测试helper函数
- [ ] 执行所有集成测试，验证覆盖度

### Phase 3: CI/CD集成（优先级P2，预计1天）

**Day 6**: 测试自动化
- [ ] 更新GitHub Actions workflow
- [ ] 添加后端测试步骤（go test）
- [ ] 配置测试覆盖率报告（codecov）

---

## 🎯 成功标准

### 定量指标
- ✅ **整体覆盖率**: 95% → 100%
- ✅ **需求3**: 90% → 100%（+10%）
- ✅ **需求4**: 80% → 100%（+20%）
- ✅ **需求7**: 85% → 100%（+15%）
- ✅ **需求15**: 70% → 100%（+30%）

### 定性指标
- ✅ 所有关键业务路径有E2E测试覆盖
- ✅ 所有后端逻辑有单元测试覆盖
- ✅ 所有外部集成（Redis、Secret Manager、API）有集成测试覆盖
- ✅ 测试文档完整，新人可快速上手

---

## 💡 注意事项

### 1. 测试覆盖率的定义

**技术覆盖率** vs **业务覆盖率**:
- ❌ 不要追求代码行覆盖率100%（不现实，且有误导性）
- ✅ 应追求业务需求覆盖率100%（每个需求都有测试验证）

### 2. 测试的投入产出比

**高价值测试**（优先）:
- ✅ 核心业务流程（Offer评估、Token计费）
- ✅ 易出错的逻辑（缓存、重试、并发）
- ✅ 用户高频操作（登录、创建Offer）

**低价值测试**（可选）:
- ⚠️ Getter/Setter函数
- ⚠️ 纯展示组件
- ⚠️ 配置文件解析

### 3. 维护测试的成本

**易维护的测试**:
- ✅ 使用Page Object模式（E2E）
- ✅ 提取公共测试helper
- ✅ Mock外部依赖（单元测试）

**难维护的测试**:
- ❌ 硬编码选择器
- ❌ 依赖真实API（不稳定）
- ❌ 测试间有依赖关系

---

## 🔄 持续改进

### 定期评估（每Sprint）
1. 新增功能必须附带测试（DoD定义）
2. 每次发现Bug，先补充测试用例
3. 定期Review测试覆盖率报告

### 技术债务管理
- 标记需要重构的测试（TODO注释）
- 删除冗余/失效的测试
- 更新测试文档

---

## 📚 参考资料

- [测试金字塔](https://martinfowler.com/articles/practical-test-pyramid.html)
- [Go Testing最佳实践](https://github.com/golang/go/wiki/TestComments)
- [Playwright最佳实践](https://playwright.dev/docs/best-practices)
- [Testcontainers Go文档](https://golang.testcontainers.org/)

---

**总结**: 达到100%测试覆盖率需要**分层测试策略**，E2E测试验证用户视角，单元测试验证内部逻辑，集成测试验证外部依赖。预计6天完成所有补充测试，最终实现100%业务需求覆盖。
