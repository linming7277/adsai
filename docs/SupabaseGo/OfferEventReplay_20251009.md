# Offer 事件重放与快照（阶段三任务 9.4-9.5）

**日期**: 2025-10-09  
**执行人**: Codex 助手

---

## 新增能力

1. **事件重放** (`services/offer/internal/store/rebuilder.go` + `aggregate.go`)
   - `RehydrateOffer`：从快照起始版本加载后续事件，并通过 `applyOfferEvent` 逐条应用。
   - `LoadOfferAggregate`：返回重建后的 `domain.Offer` 及当前版本，供后续聚合逻辑使用。

2. **快照保存** (`event_store.go` + Handler)
   - 在 `HandleCreate` 记录事件后，使用 `SaveOfferSnapshotState` 写入快照（当前版本 + 事件载荷）。
   - 快照结构 `AggregateState`、`OfferSnapshot` 用于快速恢复。

3. **最佳实践**
   - `applyOfferEvent` 目前支持 `OfferCreated`，未来可扩展更多事件。
   - `LoadOfferAggregate` 返回 `nil` + 版本，可用于判空逻辑。

## 使用方式

```go
agg, version, err := offerStore.LoadOfferAggregate(ctx, offerID)
if err != nil { /* handle */ }
if agg != nil {
    // 使用 agg 衍生状态
}
```

## 下一步

- 在后续事件（状态变更、评估完成等）中持续调用 `AppendOfferEvents` 并更新快照。
- 提供后台任务，将历史数据生成初始快照，减少冷启动重放时间。

---

**相关文件**
- `services/offer/internal/store/event_store.go`
- `services/offer/internal/store/rebuilder.go`
- `services/offer/internal/store/aggregate.go`
- `services/offer/internal/handlers/http.go`
