# Supabase → Cloud SQL 数据同步方案（草案）

更新时间：2025-10-09

## 1. 目标

- 将 Supabase 作为**权威写入源**，Cloud SQL 作为报表/批处理的消费层。
- 保持现有 Cloud SQL 报表服务可用，逐步迁移实时写入至 Supabase。
- 在 5 分钟内完成标准事件的数据同步（近实时），并提供重试/回补机制。

## 2. 架构概览

```
Supabase Postgres (write)    Cloud SQL (read-heavy)
          │                         ▲
          │ (1) WAL → Logical Decoding / pgoutput
          ▼                         │
   Supabase CDC Slot          (4) Pub/Sub Pull
          │                         │
          │ (2) Supabase Edge Worker（或 RLS Function）
          ▼                         │
  Cloud Pub/Sub Topic  ──►  Cloud Run Sync Worker
                               │
                               │ (3) idempotent UPSERT
                               ▼
                          Cloud SQL logical DBs
```

### 步骤说明
1. **WAL 捕获**：使用 Supabase 提供的 `logical replication`（pgoutput），订阅指定 schema（例如 `token_transactions`, `offers`）。
2. **边缘 Worker**：Supabase Edge Functions（TypeScript）监听 CDC 事件，构造简化 payload（表名、主键、变更类型、payload）并推送至 Cloud Pub/Sub。
3. **同步 Worker**：Cloud Run 服务（Go）订阅 Topic，按照表名路由至对应逻辑仓库（`billing_db`, `offer_db` 等），执行幂等 UPSERT/DELETE。
4. **回补机制**：对于失败事件写入 `sync_deadletter`（Cloud SQL + GCS），由定时 Job（二次消费 Pub/Sub DLQ）重试。

## 3. Topics & Subscriptions 规划

| Topic | 订阅者 | 变更源表 | 说明 |
| --- | --- | --- | --- |
| `supabase-cdc-billing` | Cloud Run `billing-sync` | `token_wallets`, `token_transactions`, `subscriptions` | 对应逻辑库 `billing_db` |
| `supabase-cdc-offer` | Cloud Run `offer-sync` | `offers`, `offer_snapshots` | 对应逻辑库 `offer_db` |
| `supabase-cdc-ads` | Cloud Run `ads-sync` | `ads_connections`, `ads_audit_events` | 对应逻辑库 `adscenter_db` |
| `supabase-cdc-shared` | Cloud Run `shared-sync` | `user_profiles`, `idempotency_keys` | 共享库 |

- 每个 Topic 对应独立订阅，便于扩缩容与权限隔离。
- 可选：给 Cloud SQL 报表 Job 提供只读订阅，用于近实时 BI。

## 4. Cloud Run Sync Worker 设计

- **输入格式**（JSON）：
  ```json
  {
    "table": "token_transactions",
    "op": "INSERT",          // INSERT/UPDATE/DELETE
    "primary_key": {"id": "..."},
    "record": {"user_id": "...", "amount": 10, ...},
    "occurred_at": "2025-10-09T05:00:00Z"
  }
  ```
- **幂等处理**：
  - 使用 `primary_key` 计算 `event_id`（hash），记录在 `sync_checkpoint` 表。
  - UPSERT：利用 Cloud SQL `ON CONFLICT DO UPDATE`；DELETE：对照主键执行软删除或硬删除视业务决定。
- **事务与重试**：单条消息使用 `BEGIN ... COMMIT`；失败时返回 NACK，由 Pub/Sub 重新投递。连续失败超过阈值时写入 GCS + `sync_deadletter` 表。
- **监控**：导出 `sync_latency_seconds`, `sync_failures_total` 等指标，通过 Cloud Monitoring 告警。

## 5. 权限与安全

- Supabase Edge Worker 需要一个仅具备 Pub/Sub 发布权限的服务账号（可使用 Supabase Service Key + IAM 工作负载身份）。
- Cloud Run Worker 使用 `roles/cloudsql.client` + `roles/pubsub.subscriber`。
- Pub/Sub Topic 需启用 VPC-SC 日志审计，防止越权访问。

## 6. 回滚与回补

- 暂停同步：关闭 Pub/Sub Subscription 或 Cloud Run Worker。
- 回滚：对 Cloud SQL 各逻辑库执行 `TRUNCATE TABLE` 并重新全量迁移（`scripts/db/migrate-schema-to-database.sh` 支持 `--full-refresh`）。
- 回补：
  1. 导出 Supabase 指定表至 CSV（`COPY ... TO STDOUT`）。
  2. 上传至 GCS，由 Cloud Run Worker 执行批量导入（附加模式）。

## 7. 开放事项

- [ ] CDC 事件过滤的细粒度控制（仅推送变更列，或在 Worker 侧裁剪）。
- [ ] Cloud SQL 与 Supabase Schema 之后可能出现差异，需定期运行 `scripts/db/verify-schema-status.sh`。
- [ ] 若 Pub/Sub 成本或延迟不满足需求，可评估使用 Datastream（付费）直接同步。

---

本方案作为 Stage 6.2 的设计草案，可在实施前开拆具体任务：
- 开发 Supabase Edge Function + Pub/Sub 发布脚本。
- 实现 Cloud Run Sync Worker（Go）、单元测试与本地模拟。
- 配置 Cloud Build Trigger，自动部署 Edge Function 与 Sync Worker。
