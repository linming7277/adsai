# goroutine 并发优化记录（阶段三任务 8.9）

**日期**: 2025-10-09  
**执行人**: Codex 助手

---

## 背景

BatchOpen 服务在处理批量浏览器执行任务时，会为每个请求直接 `go` 启动后台流程（预留代币 → 获取 URL → 调用 Browser-Exec → 更新 UI）。在高并发情况下可能产生大量 goroutine，引发：

- **资源竞争**：同时访问 Browser-Exec、Billing、Firestore，可能压垮下游。
- **缺少限流**：没有统一的并发上限，难以观测与调试。
- **panic 泄漏风险**：goroutine 内 panic 仅打印，难以集中处理。

根据阶段三任务 8.9 的要求，需要通过 goroutine 池控制并发、避免泄漏。

---

## 实施方案

### 1. 引入 `ants` goroutine 池

- 新增依赖：`github.com/panjf2000/ants/v2`
- 在 `services/batchopen/main.go` 中创建全局池：
  ```go
  pool, err := ants.NewPool(size, ants.WithPanicHandler(func(p any){ ... }))
  ```
- 默认容量 `size=10`，可通过 `BATCHOPEN_WORKER_POOL_SIZE` 环境变量配置（1–128）。

### 2. 统一投递入口 `submitBackgroundTask`

```go
func submitBackgroundTask(job func()) {
    if pool := ensureTaskPool(); pool != nil {
        if err := pool.Submit(job); err == nil { return }
        log.Printf("pool submit failed: %v")
    }
    go job()
}
```

- 优先使用池；若池初始化失败或瞬时满载，则回退到普通 goroutine，保证功能不受影响。
- panic handler 统一日志，便于监控。

### 3. 替换原有 `go func()`

- `createTaskHandler` 等入口改为 `submitBackgroundTask(func(){ ... })`，其内部逻辑保持不变。
- 结合已有的 `inflight` 信号量和单点缓存，进一步避免资源突增。

---

## 验证

1. `go test ./services/batchopen/...`（自动拉取新依赖）
2. 手动请求并高压测试（后续可结合 k6 / locust）：
   - 当并发超过池容量时，请求会短暂停顿等待空闲 worker，整体吞吐可控。
   - 浏览器执行与 Billing 调用数量下降到 pool size 附近。
3. 通过日志确认：
   - 初始化成功 `batchopen: failed to create worker pool` 未出现
   - 如有 submit 失败，会有明显 fallback 提示。

---

## 后续建议

- 将 `BATCHOPEN_WORKER_POOL_SIZE` 与 `BATCHOPEN_MAX_INFLIGHT` 在部署变量中统一配置，保持各环境一致。
- 结合 8.7 热点数据，持续观察 Browser-Exec 延迟与排队情况，必要时扩容池或增加队列长度。
- 若未来需要任务优先级，可进一步封装 `ants.NewPoolWithFunc` 并配合 channel 调度。

---

**相关文件**
- 代码：`services/batchopen/main.go`
- 配置：`services/batchopen/go.mod`
- 上游任务：`docs/SupabaseGo/HotDataAnalysis_20251009.md`
