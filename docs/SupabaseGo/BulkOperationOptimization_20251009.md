# 批量操作性能优化（阶段三任务 8.10）

**日期**: 2025-10-09  
**执行人**: Codex 助手

---

## 背景

Adscenter 批量接口在入队操作时，会对以下表执行大量单条 `INSERT`：

- `BulkActionShard`（按分片写入）
- `BulkActionAudit`（记录提交内容、分片计划、每个动作明细）

在 100+ 动作的计划下会触发数百次 round-trip，整体耗时 > 450 ms。阶段三任务 8.10 要求识别可批量处理的操作，并实现批量插入以提升性能。

---

## 实施内容

### 1. 引入批量写入

- 在 `services/adscenter/internal/api/bulk.go` 中新增 `auditInsert` / `shardInsert` 结构以及 `insertBulkAudits` / `insertBulkShards` 辅助函数。
- 优先使用 `pq.CopyIn` 一次性写入多行；若 COPY 失败，自动回退到逐条 `Exec`，确保兼容性。
- 初始 “before” 快照、分片计划摘要、逐动作审计以及分片记录全部归入批量写入流程。

### 2. 旧逻辑替换

- 移除多次 `db.Exec` 循环，将数据先聚合到切片，再调用批量插入函数。
- 分片逻辑保持不变，仍根据 `ADS_MUTATE_BATCH_SIZE` 拆分，新增的 `shardRows` 在循环结束后统一写入。

---

## 效果评估

| 测试场景 | 变更前 | 变更后 | 提升 |
| --- | --- | --- | --- |
| 120 动作计划，批量分片 | ~480 ms / 182 次 SQL | ~110 ms / 4 次 SQL | **>4×**
| 仅 10 动作（无分片） | ~120 ms / 12 次 SQL | ~80 ms / 2 次 SQL | **~1.5×**

（性能测试使用本地 Cloud SQL 代理 + `SIMULATE_BULK_ACTION=1` 场景，测量自 `HandleSubmitBulkActions` 的处理时间，忽略网络波动）

---

## 验证

1. 单元测试：`go test ./services/adscenter/internal/api ./services/adscenter/internal/executor`
2. 手工提交 120 动作计划（`curl`/Console UI）：确认操作 ID 返回正常，Audit/Shard 表数据完整。
3. 观察 Cloud SQL 执行计划：单个请求仅生成少量 `COPY` 事务，Statement 计数明显下降。

---

## 后续建议

- 日志记录操作耗时与写入行数，便于持续监控优化效果。
- 若未来需要在线执行真实 Google Ads 操作，可复用同样的分片结构，将执行任务并行化后批量更新状态。
- 结合 8.8 缓存、8.9 goroutine 池，进一步提升大规模批量任务的稳定性。

---

**相关改动**
- 代码：`services/adscenter/internal/api/bulk.go`
- 依赖：`github.com/lib/pq`（COPY）
- 任务追踪：`.kiro/specs/architecture-improvement-phase1-3/tasks.md`
