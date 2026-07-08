# 事件存储接口设计（阶段三任务 9.1）

**日期**: 2025-10-09  
**执行人**: Codex 助手

---

## 接口概览

在 `pkg/eventstore` 中定义统一的事件存储抽象：

- `Event`：已持久化的事件（包含 ID、名称、版本、载荷、元数据、发生时间）。
- `UncommittedEvent`：待写入事件，支持自定义 payload/metadata，Append 时统一序列化并补齐时间戳。
- `Snapshot`：聚合根快照（含状态、元数据、版本）。
- `AppendResult`：追加成功后返回的事件集合及最新版本。
- `Store` 接口：
  ```go
  type Store interface {
      EnsureSchema(ctx context.Context) error
      Append(ctx context.Context, aggregateType, aggregateID string, expectedVersion int, events []UncommittedEvent) (AppendResult, error)
      Load(ctx context.Context, aggregateType, aggregateID string, fromVersion int) ([]Event, error)
      LoadSnapshot(ctx context.Context, aggregateType, aggregateID string) (*Snapshot, error)
      SaveSnapshot(ctx context.Context, snap Snapshot) error
  }
  ```
- 并引入 `ErrConcurrencyConflict` 作为乐观锁冲突提示。

## 兼容层

为不影响现有调用（Offer Handler、Notifications Saga 等），保留 `EnsureDDL` 与 `WriteWithDB`，并标注 Deprecated，后续可以逐步迁移到新接口。

## 后续路线

1. **9.2**：使用上述接口实现 PostgreSQL 版本（Append、Load、Snapshot 等）。
2. **9.3**：在 Offer 服务中接入 Store，记录领域事件并编写聚合重放逻辑。
3. **9.4/9.5**：增加事件重放与快照落地，实现聚合快速恢复。

---

**相关文件**
- `pkg/eventstore/store.go`
- `pkg/eventstore/legacy.go`
