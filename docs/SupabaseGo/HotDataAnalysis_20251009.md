# 数据热点识别报告（阶段三任务 8.7）

**日期**: 2025-10-09  
**执行人**: Codex 助手  
**数据来源时间窗**: 2025-10-09 13:25–14:30 UTC+8（Cloud SQL `pg_stat_user_tables` 与 `pg_stat_statements` 快照）  

---

## 采集方法

1. 启用的 `pg_stat_statements`（参见 `docs/SupabaseGo/SlowQueryAnalysis_20251009.md`）持续收集查询。
2. 使用 Cloud SQL Admin API 导出统计：
   ```bash
   gcloud sql export csv autoads gs://autoads-query-insights-apne1/pg_stat_user_tables_20251009142943.csv \
     --database=autoads_db \
     --query="SELECT schemaname, relname, seq_scan, idx_scan, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup
              FROM pg_stat_user_tables
              ORDER BY (seq_scan + idx_scan) DESC LIMIT 50"
   ```
3. 将统计按 `seq_scan + idx_scan`（表扫描命中次数）排序，结合写入指标（`n_tup_ins/_upd/_del`）评估热点。

---

## 跨服务热点概览（Top 10）

| 排名 | Schema | 表名 | 扫描次数 (Seq+Idx) | 近期写入 (INS/UPD/DEL) | 主要功能 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `public` | `offer_evaluations` | **523** | 1/0/0 | Offer AI 评估读模型 | 结合 8.5 重写后的聚合，建议将热点结果写入 Redis/Valkey L2 缓存，5 分钟 TTL；长期考虑下沉至 `offer_db.Offer` |
| 2 | `offer_db` | `Offer` | **479** | 26/13/0 | Offer 新版 read-model（Next.js + Supabase 前端） | 继续维护 `offer` 列表缓存（`Cache` 接口），并在 8.8 中实现分层缓存 |
| 3 | `siterank_db` | `SiterankAnalysis` | **376** | 60/105/0 | Siterank 评分分析结果 | 高并发读取，适合放入 Redis，按 `domain`/`user` 维度缓存；写入多需注意缓存失效 |
| 4 | `public` | `notification_rules` | **319** | 1/0/0 | SaaS 自定义告警规则 | 读多写少，可使用应用内 LRU + Redis 结合，管理员更新后广播失效 |
| 5 | `public` | `Offer` | **183** | 4/3/0 | Legacy Offer 表（Go 服务自用） | 已与新版并存，建议逐步迁移读流量至 `offer_db.Offer`，并设置查询只读副本 |
| 6 | `siterank_db` | `domain_cache` | **59** | 3/0/0 | Siterank 域名缓存 | 纯读取，适合常驻 Redis（长 TTL），与 Valkey HSET 同步 |
| 7 | `public` | `BulkActionOperation` | **58** | 10/10/0 | Adscenter 批量操作主表 | 8.3 已加索引；建议缓存最近 50 条操作列表，并为 `plan` 字段做对象存储降成本 |
| 8 | `siterank_db` | `domain_country_cache` | **52** | 0/0/0 | 域名国家缓存 | 与 `domain_cache` 同策略，可合并 Key 结构减少查表次数 |
| 9 | `siterank_db` | `SiterankHistory` | **48** | 36/0/0 | 历史评分序列 | 时间序列类热点，适合写入 BigQuery 作离线分析，实时查询可使用滚动窗口缓存 |
| 10 | `public` | `idempotency_keys` | **39** | 15/0/0 | 幂等键去重 | 保持短 TTL + 合理清理任务；避免缓存，以数据库为权威，但需保证索引与分片 |

> **说明**: 由于当前真实业务流量有限，热度榜单主要反映内部任务与测试脚本。实际生产部署后需结合 Cloud Monitoring 重新校准。

---

## 服务维度热点解读

### Offer 服务
- **核心热点**: `offer_evaluations`、`offer_db.Offer`、`public.Offer`、`OfferAccountMap`。
- **原因**: KPI 聚合、前端列表、Offer 详情访问。
- **建议**:
  - 维持 8.5 中的批量账号预取，防止聚合任务回退到 N+1。
  - 在 8.8 引入两级缓存：L1（应用内 LRU）+ L2（Valkey），并对详情接口使用写穿策略。
  - 为 `OfferAccountMap` 加入定时预热任务（缓存常用账号列表）。

### Adscenter 服务
- **核心热点**: `BulkActionOperation`、`BulkActionShard`、`BulkActionAudit`。
- **原因**: 控制台批量操作查询 + 状态轮询。
- **建议**:
  - 使用 `idx_bulk_actions_user_status`、`idx_bulk_actions_created`（已完成）封顶 SQL 延迟。
  - 轮询接口优先命中缓存，缓存 Key 包含 `userId` 与 `status`（避免跨用户污染）。

### Siterank 服务
- **核心热点**: `SiterankAnalysis`、`SiterankHistory`、`domain_cache`、`domain_country_cache`。
- **原因**: 评分展示与缓存命中。
- **建议**:
  - 引入 Redis/Valkey TTL（6~12 小时）并提供后台刷新脚本。
  - 规划读写分离：写入走主库，展示页面改走只读副本或缓存。

### Billing 服务
- **核心热点**: `billing_db.UserToken`、`billing_db.TokenTransaction`、`billing_db.Subscription`。
- **原因**: 代币余额读取 + 事务写入。
- **建议**:
  - 使用现有高频索引（8.2 已完成）；
  - 为 `UserToken` 设置应用内短 TTL 缓存（1 分钟）搭配通知失效；事务表保持直接读库保证一致性。

### 通知/后台
- **核心热点**: `notification_rules`、`user_notifications`、`event_store`。
- **原因**: 通知策略加载、事件快照读取。
- **建议**:
  - `notification_rules` 可一次性加载并存入应用内缓存，触发更新时重新加载。
  - `user_notifications` 写多读多，后续可通过 Redis Stream 或 Pub/Sub 降低直接查询压力。

---

## 热点数据列表（用于任务看板登记）

| 服务 | 表 | 数据类型 | 热点场景 | 缓存策略建议 |
| --- | --- | --- | --- | --- |
| Offer | `offer_evaluations` | AI 评估结果 | KPI 聚合、策略判定 | Redis L2 缓存（Key: `offer_eval:<offer>`，TTL 5 分钟） |
| Offer | `offer_db.Offer` | Offer Read Model | 前端列表、详情 | L1 LRU + L2 Valkey，写入时广播失效 |
| Siterank | `siterank_db.SiterankAnalysis` | 评分分析 | 控制台展示 | TTL 6 小时，提供批量刷新 CLI |
| Adscenter | `BulkActionOperation` | 批量操作计划 | 批量列表/详情 | 结合 8.3 索引 + 用户态缓存 |
| Billing | `billing_db.UserToken` | Token 余额 | 余额查询、扣费验证 | 读缓存 1 分钟，写后强制失效 |
| Notifications | `notification_rules` | 告警配置 | Agent 启动加载 | 启动拉取 + 热更新广播 |
| Console | `user_notifications` | 消息中心 | 通知列表 | 分页缓存 & 每用户限流 |
| Shared | `idempotency_keys` | 幂等控制 | 所有 idempotent 请求 | 避免缓存，保持清理任务、索引命中 |

---

## 下一步（支撑 8.8 缓存实现）

1. 为 Offer/Adscenter/Siterank 服务设计统一的缓存 Key 约定与 TTL。
2. 在 Valkey/Redis 中创建命名空间前缀，例如：
   - `offer:detail:<user>:<offerId>`
   - `adscenter:bulk:list:<user>:<status>`
   - `siterank:analysis:<domain>`
3. 配合 Cloud Monitoring 添加自定义指标：
   - 缓存命中率（分服务）
   - 每个热点表的查询时延（pg_stat_statements 定期采样）
4. 定期导出 `pg_stat_user_tables`（使用 Cloud Scheduler + Cloud Functions）并推送到 BigQuery，形成趋势面板。

---

**文档归档**
- CSV 原始数据：`gs://autoads-query-insights-apne1/pg_stat_user_tables_20251009142943.csv`
- 任务追踪：`.kiro/specs/architecture-improvement-phase1-3/tasks.md`（8.7 已标记完成）
