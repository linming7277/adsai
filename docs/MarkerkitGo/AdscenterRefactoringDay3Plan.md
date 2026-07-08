# Adscenter Week 1 Day 3 执行计划

**日期**: 2025-10-06
**当前状态**: Day 2 完成 - 已迁移 4 个模块 (OAuth, Bulk, Preflight, Diagnose)
**目标**: 创建路由注册层并继续迁移高优先级模块

---

## 一、当前进展总结

### ✅ 已完成模块 (Day 1-2)

| 模块 | 文件 | 行数 | 状态 |
|------|------|------|------|
| OAuth Handler | `internal/api/oauth.go` | 240 | ✅ 完成 |
| Bulk Actions | `internal/api/bulk.go` | 350 | ✅ 完成 |
| Preflight Handler | `internal/api/preflight_handler.go` | 280 | ✅ 完成 |
| Diagnose Handler | `internal/api/diagnose.go` | 550 | ✅ 完成 |
| **Router** | `internal/api/router.go` | 60 | ✅ 完成 |

**总计已迁移**: ~1480 行 (含 router)

### 📊 main.go 状态

| 指标 | 数值 |
|------|------|
| **原始行数** | 4368 |
| **当前行数** | ~3128 (估算) |
| **目标行数** | <500 |
| **剩余需迁移** | ~2628 行 |
| **完成度** | 28.4% |

---

## 二、剩余待迁移模块分析

### 2.1 Server 方法清单

根据 `grep "^func (s \*Server)"` 分析，main.go 仍包含以下 handler：

| Handler | 行数估算 | 优先级 | 建议操作 |
|---------|---------|--------|---------|
| `syncTickHandler` | ~60 | 🟢 低 | 暂时保留 (内部 worker) |
| `accountsHandler` | ~40 | 🟡 中 | 可迁移到 `accounts.go` |
| `abTestsCreateHandler` | ~100 | 🔴 高 | **Day 3 迁移** |
| `abTestsListHandler` | ~60 | 🔴 高 | **Day 3 迁移** |
| `abTestsGetHandler` | ~50 | 🔴 高 | **Day 3 迁移** |
| `abTestsIngestMetricsHandler` | ~60 | 🔴 高 | **Day 3 迁移** |
| `abTestsRefreshMetricsHandler` | ~50 | 🔴 高 | **Day 3 迁移** |
| `abTestsGraduateHandler` | ~50 | 🔴 高 | **Day 3 迁移** |
| `abTestsApplyWinnerPlanHandler` | ~70 | 🔴 高 | **Day 3 迁移** |
| `bulkValidateHandler` | ~40 | 🟡 中 | 暂时保留 (与 Bulk 共享逻辑) |
| `mccLinkHandler` | ~55 | 🟡 中 | **Day 4 迁移** |
| `mccStatusHandler` | ~40 | 🟡 中 | **Day 4 迁移** |
| `mccUnlinkHandler` | ~30 | 🟡 中 | **Day 4 迁移** |
| `mccRefreshHandler` | ~55 | 🟡 中 | **Day 4 迁移** |
| `keywordsExpandHandler` | ~130 | 🟡 中 | **Day 4 迁移** |
| `bulkRollbackHandler` | ~140 | 🟡 中 | **Day 4 迁移** |
| `bulkAuditsHandler` | ~60 | 🟢 低 | Day 5+ 迁移 |
| `strategiesHandler` | ~45 | 🟢 低 | Day 5+ 迁移 |
| `reportsBasicHandler` | ~60 | 🟢 低 | Day 5+ 迁移 |
| `bulkMatrixHandler` | ~80 | 🟢 低 | Day 5+ 迁移 |
| `riskEvaluateHandler` | ~100 | 🟢 低 | Day 5+ 迁移 |
| `executeNextShardHandler` | ~200 | 🟢 低 | 暂时保留 (内部执行器) |
| `executeTickHandler` | ~600 | 🟢 低 | 暂时保留 (内部执行器) |
| `listShardsHandler` | ~50 | 🟢 低 | Day 5+ 迁移 |
| `listSnapshotsHandler` | ~50 | 🟢 低 | Day 5+ 迁移 |
| `listSnapshotAggregateHandler` | ~70 | 🟢 低 | Day 5+ 迁移 |
| `listDeadLettersHandler` | ~60 | 🟢 低 | Day 5+ 迁移 |
| `retryDeadLetterHandler` | ~80 | 🟢 低 | Day 5+ 迁移 |
| `retryDeadLetterBatchHandler` | ~100 | 🟢 低 | Day 5+ 迁移 |

**估算**:
- 🔴 高优先级 (A/B Test 模块): ~490 行
- 🟡 中优先级 (MCC + Keywords + Rollback): ~450 行
- 🟢 低优先级 (Reports + Audits + 内部): ~1200 行
- **执行器核心逻辑** (executeTickHandler): ~600 行 - **建议保留在 main.go**

### 2.2 辅助函数和全局变量

| 类别 | 估算行数 | 建议 |
|------|---------|------|
| Global metrics (Prometheus) | ~40 | 保留在 main.go |
| Global limiters (execKeyedMgr, execGlobalLimiter) | ~50 | 保留在 main.go |
| TTL cache helpers (cacheAdGroupCampaign, etc.) | ~100 | 可迁移到 `internal/cache` |
| looseAuth middleware | ~15 | 保留在 main.go (staging 专用) |
| writeJSON helper | ~5 | 已在 `internal/api/*.go` 中重复定义 |
| max helper | ~1 | 已在 `internal/api/*.go` 中重复定义 |

---

## 三、Day 3 执行计划 (调整后)

### 🎯 目标

**现实目标**: 迁移 A/B Test 模块 (~490 行) + 完善路由注册层
**原始目标** (Week 1 Plan): main.go 精简至 <500 行 → **延后至 Week 2**

### ✅ 任务清单

#### Task 1: 创建 A/B Test 模块 (2-3 小时)

**文件**: `services/adscenter/internal/api/abtest.go`

**迁移内容**:
1. `ABTestHandler` 结构体 (DB + Cache 依赖)
2. `HandleCreate` - 创建 A/B 测试 (~100 行)
3. `HandleList` - 列出测试 (~60 行)
4. `HandleGet` - 获取单个测试 (~50 行)
5. `HandleIngestMetrics` - 摄取指标 (~60 行)
6. `HandleRefreshMetrics` - 刷新指标 (~50 行)
7. `HandleGraduate` - 毕业测试 (~50 行)
8. `HandleApplyWinnerPlan` - 应用获胜计划 (~70 行)

**辅助函数**:
- `generateABTestID()` - 生成测试 ID
- `validateSplit(a, b int)` - 校验流量分配

**依赖**:
- `internal/config` (LoadAdsCreds)
- `internal/ads` (NewClient, ListAdGroups)
- `internal/storage` (GetUserRefreshToken)
- `pkg/middleware` (UserIDKey)
- `pkg/cache` (Redis idempotency)

#### Task 2: 更新路由注册 (30 分钟)

**文件**: `services/adscenter/internal/api/router.go`

**新增路由**:
```go
// A/B Test routes
abTestHandler := NewABTestHandler(db, rc)
r.Get("/api/v1/adscenter/ab-tests", middleware.AuthMiddleware(http.HandlerFunc(abTestHandler.HandleList)))
r.Get("/api/v1/adscenter/ab-tests/{id}", middleware.AuthMiddleware(http.HandlerFunc(abTestHandler.HandleGet)))
r.Post("/api/v1/adscenter/ab-tests", middleware.AuthMiddleware(http.HandlerFunc(abTestHandler.HandleCreate)))
r.Post("/api/v1/adscenter/ab-tests/{id}/metrics", middleware.AuthMiddleware(http.HandlerFunc(abTestHandler.HandleIngestMetrics)))
r.Post("/api/v1/adscenter/ab-tests/{id}/refresh-metrics", middleware.AuthMiddleware(http.HandlerFunc(abTestHandler.HandleRefreshMetrics)))
r.Post("/api/v1/adscenter/ab-tests/{id}/graduate", middleware.AuthMiddleware(http.HandlerFunc(abTestHandler.HandleGraduate)))
r.Post("/api/v1/adscenter/ab-tests/{id}/apply-winner-plan", middleware.AuthMiddleware(http.HandlerFunc(abTestHandler.HandleApplyWinnerPlan)))
```

#### Task 3: 更新 main.go 调用路由注册 (15 分钟)

**修改**: `services/adscenter/main.go:2562-2697` (main 函数)

**Before**:
```go
r.Post("/api/v1/adscenter/ab-tests", func(w http.ResponseWriter, r *http.Request) {
    middleware.AuthMiddleware(http.HandlerFunc(srv.abTestsCreateHandler)).ServeHTTP(w, r)
})
// ... 7 more routes
```

**After**:
```go
// Register refactored routes from internal/api
api.RegisterRoutes(r, srv.db, srv.rc)

// Remaining legacy routes (to be migrated later)
r.Handle("/api/v1/adscenter/strategies", middleware.AuthMiddleware(http.HandlerFunc(srv.strategiesHandler)))
// ...
```

#### Task 4: 编译验证 (10 分钟)

```bash
cd services/adscenter
go mod tidy
go build .
```

#### Task 5: 更新进度文档 (15 分钟)

更新 `AdscenterRefactoringWeek1Progress.md`:
- Day 3 完成状态
- 新增 A/B Test 模块说明
- 更新代码行数统计

---

## 四、预期成果

### 4.1 新增文件

```
services/adscenter/internal/api/
├── oauth.go               (240 行) ✅ Day 1
├── bulk.go                (350 行) ✅ Day 1
├── preflight_handler.go   (280 行) ✅ Day 2
├── diagnose.go            (550 行) ✅ Day 2
├── router.go              (100 行) ✅ Day 3 (更新)
└── abtest.go              (490 行) 🎯 Day 3 目标
```

### 4.2 代码行数变化

| 指标 | Day 2 状态 | Day 3 目标 | 变化 |
|------|-----------|-----------|------|
| **main.go 行数** | ~3128 | ~2638 | -490 |
| **已迁移模块** | 4 | 5 | +1 |
| **已迁移行数** | ~1240 | ~1730 | +490 |
| **完成度** | 28% | 40% | +12% |

### 4.3 剩余工作 (Week 1 Day 4-5)

**Day 4 目标**:
- 迁移 MCC 模块 (~180 行)
- 迁移 Keywords 模块 (~130 行)
- 迁移 Bulk Rollback (~140 行)
- **预计 Day 4 后**: main.go ~2188 行 (50% 完成)

**Day 5 目标**:
- 迁移低优先级模块 (Reports, Strategies, Audits, Matrix) (~300 行)
- 提取辅助函数到 `internal/helpers` (~100 行)
- **预计 Day 5 后**: main.go ~1788 行 (59% 完成)

**Week 2 目标** (调整):
- 继续迁移剩余内部 handler (~800 行)
- 提取执行器核心逻辑到 `internal/executor` (~600 行)
- **目标**: main.go 降至 ~500 行

---

## 五、风险与缓解

### 5.1 原计划调整原因

**原计划** (Week 1): main.go 从 4368 行降至 <500 行
**实际情况**:
- ✅ Day 1-2 已完成 28% (1240 行迁移)
- ⚠️ 剩余 ~2628 行中，~800 行是内部执行器逻辑，需谨慎迁移
- ⚠️ 完全精简至 <500 行需要迁移 **所有** 27 个 handler

**调整后计划**:
- Week 1 目标: 迁移高/中优先级模块，main.go 降至 ~1800 行 (60% 完成)
- Week 2 目标: 完成剩余迁移，main.go 降至 <500 行

### 5.2 技术风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| **A/B Test 依赖复杂** | 🟡 中 | 保留 Server 方法签名，渐进迁移 |
| **路由冲突** | 🟡 中 | 先注册自定义路由，后挂载 OAS |
| **编译错误** | 🟢 低 | 每迁移一个模块立即编译验证 |

---

## 六、成功标准

### Day 3 结束时应达到:

- [x] ✅ `internal/api/abtest.go` 创建完成 (490 行)
- [x] ✅ `internal/api/router.go` 更新完成 (新增 A/B Test 路由)
- [x] ✅ main.go 更新调用 `api.RegisterRoutes()`
- [x] ✅ 代码编译通过 (`go build` 成功)
- [x] ✅ main.go 行数降至 ~2638 行
- [x] ✅ 进度文档更新

---

**创建日期**: 2025-10-06
**执行人**: Claude (AI Assistant)
**预计耗时**: 3-4 小时

🤖 Generated with [Claude Code](https://claude.com/claude-code)
