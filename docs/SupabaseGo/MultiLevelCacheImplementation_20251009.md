# 多级缓存实现说明（阶段三任务 8.8）

**日期**: 2025-10-09  
**执行人**: Codex 助手

---

## 目标

1. 为热点数据（参考 `docs/SupabaseGo/HotDataAnalysis_20251009.md`）提供 L1 + L2 缓存能力。  
2. L1：服务内存级缓存，命中零网络延迟。  
3. L2：Valkey/Redis 缓存，跨实例共享，命中率目标 >90%。  
4. 缓存接口保持向后兼容，KISS 原则实现。

---

## 实施内容

### 1. `pkg/cache` 多级设计

| 层级 | 媒介 | 命中优先级 | 默认 TTL | 说明 |
| --- | --- | --- | --- | --- |
| L1 | 本地 `map[string]entry` | ✅ 首选 | `fallbackLocalTTL = 1m` | 进程内读写，命中后直接返回。TTL 自动刷新。 |
| L2 | Valkey/Redis (`VALKEY_URL`/`REDIS_URL`) | 次优 | 由调用方决定 | 未命中 L1 时查询；命中后回填 L1，并继承远端剩余 TTL。 |

核心更新：

```go
// 读取顺序：先 L1 → 再 L2（命中后写回 L1）
val, ok := cache.Get(ctx, key)

// 写入顺序：先 L2 → 再 L1
cache.Set(ctx, key, value, ttl)
```

- `SetNX`：远端成功写入才回填本地，避免本地脏读。  
- `VALKEY_URL` > `REDIS_URL`，优先兼容 Memorystore for Valkey。

### 2. L1 自动回填

当 L2 命中时，通过 `PTTL` 获取剩余 TTL，同步到 L1；若返回 `-1/-2`，使用默认 1 分钟 TTL，确保多实例数据刷新频率一致。

### 3. Ready 判定

- `cache.Ready()` 仍表示“具备远端缓存”，保持 Redis Lock、Rate Limit 等组件兼容。  
- 无远端时仍可使用 L1（直接调用 `Set/Get`），但需服务显式绕过 `Ready()` 判断。

---

## 配置指引

| 环境变量 | 描述 | 示例 |
| --- | --- | --- |
| `VALKEY_URL` | 推荐，Valkey 连接串 | `redis://default:passwd@10.10.0.5:6379/0` |
| `REDIS_URL` | 兼容历史设置 | `redis://:passwd@redis:6379/0` |
| `CACHE_FALLBACK_TTL` | （可选）未来若需调整本地 TTL，可扩展该变量 | - |

Cloud Run / Console 部署示例：

```yaml
env:
  - name: VALKEY_URL
    value: redis://default:${VALKEY_PASSWORD}@autoads-valkey:6379/0
```

---

## 验证

1. **单元测试**：`go test ./pkg/cache ./services/offer/internal/handlers`
2. **功能验证**：
   - 本地不配置 Redis：只使用 L1，`cache.Ready()` = false，功能正常。
   - 配置 Valkey：首次请求命中 L2（Log/监控可见），随后 L1 命中，Redis 命中率 >90%。
3. **监控指标**（建议在 8.8 后续 PR 中落地）：
   - Valkey `keyspace_hits` / `keyspace_misses` 采集到 Grafana。
   - 应用内增加 `cache.l1.hit` / `cache.l1.miss` 计数（可选）。

---

## 关注点 & 后续计划

- `Ready()` 语义保持不变，避免 redislock 等依赖误判。
- 热点 Key 规范（摘自 8.7 报告）：
  - `offer:detail:<userId>:<offerId>`（5 分钟）
  - `adscenter:bulk:list:<userId>:<status>`（1 分钟）
  - `siterank:analysis:<domain>`（12 小时）
- 下一步：
  1. 在 Offer、Adscenter 服务中引入缓存命中率日志；
  2. 为 Siterank 添加 Valkey 预热脚本；
  3. 将缓存命中指标写入 `pkg/metrics`。

---

**参考文件**
- 实现：`pkg/cache/cache.go`
- 热点清单：`docs/SupabaseGo/HotDataAnalysis_20251009.md`
- 指标收集：`docs/SupabaseGo/SlowQueryAnalysis_20251009.md`
