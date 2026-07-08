# AutoAds 业务功能增强计划

**版本**: V1.0
**日期**: 2025-10-17
**状态**: 基于现有代码分析

---

## 一、现有功能分析

### 1.1 Offer评估功能（siterank服务）

#### ✅ 已实现
- 基础评估（1 token）
  - 网站可达性检测
  - SimilarWeb数据集成
  - 基础指标分析
  
- AI增强评估（+2 tokens）
  - Gemini AI分析（12维度框架 v2.5.0）
  - `recommendationScore` (0-100评分)
  - `reasons` (3条推荐理由)
  - `industry` (行业识别)
  - `trafficInsights` (流量洞察)
  - `adInsights` (广告洞察)
  - `policyCompliance` (政策合规)
  - `seasonalityInsights` (季节性洞察)
  - `conversionInsights` (转化洞察)
  - `profitabilityInsights` (盈利能力洞察)
  - `competitorInsights` (竞争对手洞察)
  - `budgetRecommendation` (预算建议)

#### ❌ 未实现但代码中有注释
```go
// Note: If domain changed after redirect (finalDomain != preliminaryDomain),
// we're using SimilarWeb data for preliminary domain.
```
**发现**: 代码已经识别了重定向问题，但选择忽略以换取性能

#### 🎯 真实需求
基于现有AI评估已经非常完善（12维度），**不需要额外的"AI建议优化"**

---

## 二、真正需要的功能增强

### 功能 1: 重定向链追踪优化 ⚠️

**当前状况**:
- 代码注释显示：已知重定向后domain可能变化
- 当前策略：使用初始domain的SimilarWeb数据
- 问题：可能导致数据不准确

**建议方案**: **不实施**

**理由**:
1. 代码注释说明这是**有意为之的权衡**
2. "性能提升31%"（并行化）vs "罕见的边缘情况"
3. 如果真的是问题，早就有用户反馈了
4. 投入产出比不高

**替代方案**: 
- 在评估结果中显示"最终落地页URL"
- 让用户知道评估的是哪个domain
- 如果用户发现不对，可以手动重新评估

---

### 功能 2: 每日落地页巡检 ✅ 值得实施

**优先级**: P1
**工作量**: 1周

**需求分析**:
- 用户创建Offer后，落地页可能失效
- 当前没有自动检测机制
- 用户只能手动重新评估

**实施方案**:

#### 2.1 数据库表设计
```sql
-- 落地页监控配置表
CREATE TABLE landing_page_monitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    offer_id UUID NOT NULL,
    url TEXT NOT NULL,
    check_frequency VARCHAR(20) DEFAULT 'daily', -- daily, weekly, disabled
    last_check_at TIMESTAMP,
    last_status VARCHAR(20), -- ok, error, timeout
    consecutive_failures INT DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 监控历史记录表
CREATE TABLE landing_page_check_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID NOT NULL REFERENCES landing_page_monitors(id),
    checked_at TIMESTAMP DEFAULT NOW(),
    status_code INT,
    response_time_ms INT,
    is_accessible BOOLEAN,
    error_message TEXT,
    redirect_chain JSONB -- 记录重定向链
);
```

#### 2.2 Worker实现
```go
// services/siterank/internal/workers/landing_page_monitor.go

type LandingPageMonitor struct {
    db     *pgxpool.Pool
    client *http.Client
}

func (m *LandingPageMonitor) RunDailyCheck(ctx context.Context) error {
    // 1. 查询需要检查的monitors
    monitors, err := m.getDueMonitors(ctx)
    
    // 2. 并发检查（限制并发数）
    sem := make(chan struct{}, 10)
    for _, monitor := range monitors {
        sem <- struct{}{}
        go func(mon Monitor) {
            defer func() { <-sem }()
            m.checkLandingPage(ctx, mon)
        }(monitor)
    }
    
    return nil
}

func (m *LandingPageMonitor) checkLandingPage(ctx context.Context, monitor Monitor) {
    start := time.Now()
    
    // 发起HTTP请求
    resp, err := m.client.Get(monitor.URL)
    duration := time.Since(start).Milliseconds()
    
    // 记录结果
    history := CheckHistory{
        MonitorID:      monitor.ID,
        StatusCode:     resp.StatusCode,
        ResponseTimeMS: int(duration),
        IsAccessible:   err == nil && resp.StatusCode < 400,
        ErrorMessage:   getErrorMessage(err),
    }
    
    m.saveCheckHistory(ctx, history)
    
    // 更新monitor状态
    if !history.IsAccessible {
        monitor.ConsecutiveFailures++
        if monitor.ConsecutiveFailures >= 3 {
            m.sendAlert(ctx, monitor) // 发送告警
        }
    } else {
        monitor.ConsecutiveFailures = 0
    }
    
    m.updateMonitor(ctx, monitor)
}
```

#### 2.3 Cloud Scheduler配置
```yaml
# 每天凌晨2点执行
name: landing-page-daily-check
schedule: "0 2 * * *"
target:
  httpTarget:
    uri: https://siterank-worker-preview-xxx.run.app/internal/monitors/check
    httpMethod: POST
```

#### 2.4 用户通知
```go
// 通过useractivity服务发送通知
func (m *LandingPageMonitor) sendAlert(ctx context.Context, monitor Monitor) {
    notification := Notification{
        UserID: monitor.UserID,
        Type:   "landing_page_down",
        Title:  "落地页无法访问",
        Message: fmt.Sprintf("您的Offer「%s」的落地页已连续3次无法访问", monitor.OfferName),
        Data: map[string]interface{}{
            "offer_id": monitor.OfferID,
            "url":      monitor.URL,
        },
    }
    
    m.useractivityClient.CreateNotification(ctx, notification)
}
```

**验收标准**:
- [ ] 每日自动检查所有启用的monitors
- [ ] 连续3次失败发送通知
- [ ] 用户可以查看检查历史
- [ ] 用户可以启用/禁用监控
- [ ] 响应时间趋势图表

---

### 功能 3: Batchopen代理配置和轮换 ✅ 值得实施

**优先级**: P1
**工作量**: 1周

**当前状况**:
- batchopen服务存在但功能简单
- 没有代理配置功能
- 没有与proxy-pool服务集成

**实施方案**:

#### 3.1 集成proxy-pool服务
```go
// services/batchopen/internal/clients/proxy_pool.go

type ProxyPoolClient struct {
    baseURL string
}

func (c *ProxyPoolClient) GetProxy(ctx context.Context, country string) (*Proxy, error) {
    url := fmt.Sprintf("%s/api/v1/proxies/acquire?country=%s", c.baseURL, country)
    // 调用proxy-pool服务获取代理
}
```

#### 3.2 任务配置扩展
```go
type BatchOpenTask struct {
    URLs          []string
    ProxyConfig   ProxyConfig
    TimeDistribution TimeDistribution
}

type ProxyConfig struct {
    Enabled       bool
    Country       string   // US, GB, CA等
    RotatePerURL  bool     // 每个URL换一个代理
    MaxRetries    int      // 代理失败重试次数
}

type TimeDistribution struct {
    Enabled       bool
    Template      string   // "us_business_hours", "global_24h"
    CustomCurve   []int    // 自定义24小时分布
}
```

#### 3.3 执行逻辑
```javascript
// services/browser-exec/executor.js

async function executeWithProxy(url, proxyConfig) {
    let proxy = null;
    
    if (proxyConfig.enabled) {
        // 从proxy-pool获取代理
        proxy = await proxyPoolClient.getProxy(proxyConfig.country);
    }
    
    const context = await browser.newContext({
        proxy: proxy ? {
            server: proxy.server,
            username: proxy.username,
            password: proxy.password
        } : undefined
    });
    
    try {
        const page = await context.newPage();
        await page.goto(url);
        // ... 执行任务
    } finally {
        await context.close();
        if (proxy) {
            await proxyPoolClient.releaseProxy(proxy.id);
        }
    }
}
```

**验收标准**:
- [ ] 支持指定国家代理
- [ ] 支持每个URL轮换代理
- [ ] 代理失败自动重试
- [ ] 任务成功率统计
- [ ] 代理使用情况报表

---

### 功能 4: Adscenter批量操作 ✅ 值得实施

**优先级**: P1
**工作量**: 2周

**当前状况**:
- adscenter服务已有Google Ads集成
- 只支持单个操作
- 没有批量操作功能

**实施方案**:

#### 4.1 批量操作API设计
```go
// services/adscenter/internal/handlers/bulk_operations.go

type BulkOperation struct {
    Type      string   // "adjust_cpc", "adjust_budget", "update_suffix", "pause", "enable"
    Targets   []Target // 目标广告/广告组/关键词
    Action    Action   // 具体操作参数
    DryRun    bool     // 预演模式
}

type Target struct {
    Type string // "campaign", "ad_group", "keyword"
    ID   string
}

type Action struct {
    // CPC调整
    CPCAdjustment *CPCAdjustment
    
    // 预算调整
    BudgetAdjustment *BudgetAdjustment
    
    // URL Suffix
    URLSuffix *string
    
    // 状态变更
    Status *string // "ENABLED", "PAUSED"
}

type CPCAdjustment struct {
    Type  string  // "absolute", "relative", "percentage"
    Value float64 // 绝对值、相对值或百分比
}
```

#### 4.2 预演模式（Dry Run）
```go
func (h *Handler) BulkOperate(w http.ResponseWriter, r *http.Request) {
    var req BulkOperation
    json.NewDecoder(r.Body).Decode(&req)
    
    if req.DryRun {
        // 预演模式：只计算影响，不实际执行
        impact := h.calculateImpact(req)
        respondWithJSON(w, http.StatusOK, map[string]interface{}{
            "dry_run": true,
            "impact":  impact,
        })
        return
    }
    
    // 实际执行
    results := h.executeBulkOperation(req)
    respondWithJSON(w, http.StatusOK, results)
}

func (h *Handler) calculateImpact(op BulkOperation) Impact {
    return Impact{
        AffectedCampaigns:  len(op.Targets),
        EstimatedCostChange: calculateCostChange(op),
        EstimatedCTRChange:  calculateCTRChange(op),
        Warnings: []string{
            "CPC降低可能导致展示量下降",
            "预算增加将立即生效",
        },
    }
}
```

#### 4.3 批量操作审计
```sql
CREATE TABLE bulk_operation_audits (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    operation_type VARCHAR(50),
    targets_count INT,
    dry_run BOOLEAN,
    executed_at TIMESTAMP,
    results JSONB,
    created_by UUID
);
```

**验收标准**:
- [ ] 支持批量CPC调整
- [ ] 支持批量预算调整
- [ ] 支持批量URL suffix修改
- [ ] 支持批量启停
- [ ] Dry Run预演模式
- [ ] 影响评估报告
- [ ] 操作审计日志
- [ ] 支持回滚

---

## 三、不建议实施的功能

### ❌ AI建议优化
**理由**: 现有AI评估已经包含12维度分析和`budgetRecommendation`，已经非常完善

### ❌ 重定向链追踪
**理由**: 代码注释显示这是有意的性能权衡，投入产出比不高

### ❌ 时间分布控制（Batchopen）
**理由**: 优先级P2，可以在P1功能完成后再考虑

---

## 四、实施优先级

### Phase 1: 基础设施（Week 1-2）
1. ✅ 套餐配置管理系统（已规划）
2. ✅ Gateway Middleware部署（已规划）

### Phase 2: 监控和告警（Week 3-4）
3. 🆕 每日落地页巡检（1周）
4. 🆕 Batchopen代理配置（1周）

### Phase 3: 批量操作（Week 5-6）
5. 🆕 Adscenter批量操作（2周）

---

## 五、总结

基于对现有代码的深入分析，我们发现：

1. **AI评估已经非常完善** - 12维度框架，不需要额外优化
2. **重定向问题是有意权衡** - 不是bug，是性能优化
3. **真正需要的是运维功能** - 监控、代理、批量操作

**核心原则**: 
- ✅ 基于现有代码理解
- ✅ 不重复造轮子
- ✅ 解决真实用户痛点
- ✅ 投入产出比高

---

**维护人**: Product & Engineering Team
**最后更新**: 2025-10-17
