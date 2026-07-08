# Supabase vs Cloud SQL Schema 对照（2025-10-09）

本对照文档用于支撑 Stage 6.1「Supabase × Cloud SQL schema 对照」，聚焦当前已上线或待迁移的核心实体。信息来源包括：

- `docs/SupabaseGo/SupabaseSchemaStage1.sql`
- `schemas/sql/` 与各服务的 `internal/migrations/*.sql`
- Cloud SQL 现有表结构梳理（`services/*/internal` 中的查询语句）

> 若后续发现 Schema 发生变动，请同步更新本文件并在 `SupabaseFrontendRebuildProgress.md` 中标注。

## 1. 核心用户域（User / Profile）

| 维度 | Supabase | Cloud SQL（共享库） | 差异 & 处理建议 |
| --- | --- | --- | --- |
| 基础信息 | `auth.users` + `user_profiles`（Stage1 脚本） | `User`（billing / siterank 内嵌 DDL） | Supabase 采用 auth + profile 拆分；Cloud SQL 仍有自建 `User`，建议逐步下线，保留仅读视图指向 Supabase Profile。 |
| 唯一键 | `auth.users.email` (unique) | `User.email` (unique) | 逻辑一致；迁移后 `User` 仅作为缓存视图，不再写入。 |
| 衍生字段 | `user_profiles.locale`, `avatar_url`, `last_login_at` | `User.locale`, `photo` | 字段语义接近，可在 Cloud SQL 创建视图/Materialized View 统一命名，减少服务层逻辑。 |

## 2. Token / 计费域

| 表 | Supabase | Cloud SQL | 备注 |
| --- | --- | --- | --- |
| Token 钱包 | `token_wallets` | `UserToken` | 字段基本一致；Supabase 额外记录 `available_balance` 与 `locked_balance`。Cloud SQL 建议通过同步作业填充，逐步切换读写路径。 |
| Token 交易 | `token_transactions` | `TokenTransaction` | Supabase 定义 JSONB `metadata` 与 `origin_service` 字段；Cloud SQL 目前使用 `description` + `service` 字段。迁移时需补充映射并为 JSONB 添加索引。 |
| Reservation | Supabase 以 `token_transactions` 中 `type='reserve'` 表示 | Cloud SQL 单独表 `TokenRepairAudit` / `TokenCreditAllocation` | Stage 4 引入的 Go 服务已经改成统一路径，建议最终以 Supabase `token_transactions` + 视图覆盖 Cloud SQL 统计逻辑。 |

## 3. Offers / Ads / Tasks 业务表

| 模块 | Supabase Stage1 | Cloud SQL | 处理建议 |
| --- | --- | --- | --- |
| Offer | `offers`, `offer_snapshots`, `offer_preferences` | `Offer`, `OfferStatusHistory`, `OfferPreferences` | Supabase 已涵盖；Cloud SQL 仍存在历史表用于报表。计划是保留 Cloud SQL 作为数据仓库，实时路径迁移至 Supabase。 |
| AdsCenter | `ads_connections`, `ads_audit_events`, `ads_budget_history` | `UserAdsConnection`, `AuditEvents`, `BulkAudit` | 字段数量与命名接近，少量差异（Supabase 使用 `connection_status` 统一枚举）。迁移时需提供转换脚本并在 Cloud SQL 建立只读视图供遗留报表使用。 |
| Tasks | `tasks`, `task_runs`, `task_events` | `WorkflowTask`, `WorkflowTaskAttempt` | Supabase Stage1 已提供更细粒度结构，Cloud SQL 将逐步退化为历史归档。 |

## 4. 幂等键 / 事件表

| 表 | Supabase | Cloud SQL | 建议 |
| --- | --- | --- |
| 幂等键 | `idempotency_keys`（Stage1，含 `service` 列） | `IdempotencyKeys`, `idempotency_keys` (offer 内嵌) | Supabase 采用统一结构，建议逐步将 Cloud SQL 各副本替换为视图引用 Supabase 表；Go 服务所有写入均切换至 Supabase。 |
| 审计事件 | `admin_impersonation_events`, `ads_audit_events` | `AuditEvents`, `TokenRepairAudit` | Supabase 新增 JSONB `context`，可覆盖 Cloud SQL 表。同样建议 Cloud SQL 侧保留兼容视图。 |

## 5. 数据同步策略（草案）

1. **实时写入**：所有新业务流量优先写 Supabase；通过 Pub/Sub（`supabase-changes-*`）向 Cloud SQL 异步同步必要数据。
2. **只读视图**：在 Cloud SQL 创建 `CREATE VIEW` 指向 Supabase Foreign Data Wrapper（FDW）或使用定期物化视图，满足报表需求。
3. **冲突处理**：以 Supabase 为单一事实来源，Cloud SQL 仅做缓存/归档；若同步失败通过 `TokenRepairAudit` 等表记录补偿任务。

## 6. 待办事项

- [ ] 根据本文映射更新 `scripts/db/migrate-schema-to-database.sh`，确保多目标库同步字段名称。
- [ ] 为 `token_transactions` / `ads_audit_events` 新增索引（Supabase `CREATE INDEX IF NOT EXISTS`）。
- [ ] 在 Cloud SQL 建立 `CREATE VIEW` 草稿，模拟迁移后查询路径。
- [ ] 将本文映射附加到 `docs/SupabaseGo/SupabaseFrontendRebuildTasks.md` Stage 6.1 链接，作为验收依据。

---

如需进一步对比字段级别差异，可使用 `scripts/db/verify-schema-status.sh`（待完成）自动生成 CSV 报告。本文件将作为人工校对的基线版本。
