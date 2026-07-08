# Cloud SQL 慢查询审计报告（2025-10-09）

**执行时间**: 2025-10-09 21:30 (UTC+8)  
**目标实例**: `autoads`（PostgreSQL 17，私有 IP）  
**执行人**: Codex 助手

---

## 背景概述

阶段三性能优化任务要求“启用慢查询日志，并识别所有 >100ms 的查询”。由于 Cloud SQL 实例仅开放私网访问，本次审计通过 Cloud SQL Admin API 与 GCS 导出能力完成数据收集，实现以下目标：

1. 启用 `pg_stat_statements` 并收集聚合执行统计
2. 将 `log_min_duration_statement` 设置为 100ms，开启后续慢查询日志
3. 导出 Top 10 慢查询与高频查询明细，形成可追踪报告

---

## 操作步骤

1. **GCP 鉴权与项目配置**
   - `gcloud auth activate-service-account codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com --key-file=secrets/gcp_codex_dev.json`
   - `gcloud config set project gen-lang-client-0944935873`

2. **创建审计专用 GCS 存储桶**
   - `gsutil mb -l asia-northeast1 gs://autoads-query-insights-apne1`
   - 授权 Cloud SQL 实例服务账号 `p644672509127-x227ed@gcp-sa-cloud-sql.iam.gserviceaccount.com` 具备 `roles/storage.objectAdmin`

3. **启用 `pg_stat_statements`**
   - 将 `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;` 上传至 `gs://autoads-query-insights-apne1/ddl/create_pg_stat_statements.sql`
   - 执行 `gcloud sql import sql autoads gs://autoads-query-insights-apne1/ddl/create_pg_stat_statements.sql --database=autoads_db`
   - 校验扩展：`SELECT extname FROM pg_extension` 返回 `pg_stat_statements`

4. **开启慢查询日志阈值**
   - `gcloud sql instances patch autoads --database-flags log_min_duration_statement=100 --quiet`
   - 后续所有超过 100ms 的语句会写入 Cloud Logging（备查）

5. **导出慢查询 & 高频查询数据**
   - `gcloud sql export csv autoads gs://autoads-query-insights-apne1/pg_stat_statements_over100ms_20251009133906.csv --database=autoads_db --query="SELECT … WHERE s.mean_exec_time > 100"`
   - `gcloud sql export csv autoads gs://autoads-query-insights-apne1/pg_stat_statements_postgres_20251009133831.csv --database=autoads_db --query="SELECT … WHERE rolname='postgres'"`

---

## 慢查询结果（>100ms）

| 角色 | 查询 ID | 调用次数 | 总执行时间 (ms) | 平均执行时间 (ms) | SQL 片段 |
| --- | --- | --- | --- | --- | --- |
| postgres | 8903049722751559825 | 1 | 541.94 | 541.94 | CREATE DATABASE offer_db WITH ENCODING='UTF8' LC_COLLATE='en_US.UTF8'… |
| cloudsqladmin | -9118819885451926401 | 22 | 6561.98 | 298.27 | SELECT pg_catalog.pg_backup_start($1, $2) |
| cloudsqladmin | 399109833616677338 | 22 | 5044.65 | 229.30 | SELECT labelfile FROM pg_catalog.pg_backup_stop($1) |
| cloudsqlagent | -9008239067901759723 | 1 | 156.36 | 156.36 | ALTER ROLE "postgres" WITH LOGIN PASSWORD 'SCRAM-SHA-… |
| cloudsqladmin | -6833030450354264337 | 1 | 115.92 | 115.92 | SELECT public.validate_password($1, $2, $3, $4, $5) |

> **说明**  
> - 当前大部分 >100ms 的语句属于 Cloud SQL 备份与账号维护操作。  
> - 实际业务流量尚未触发显著的慢查询样本。

---

## 应用角色（`postgres`）TOP 5 执行时间

| 查询 ID | 调用次数 | 总执行时间 (ms) | 平均执行时间 (ms) | SQL 片段 |
| --- | --- | --- | --- | --- |
| 7698311823127640761 | 78 | 1106.80 | 14.19 | -- Indexes DO $$ BEGIN … CREATE INDEX IF NOT EXISTS ix_notif_rules_service_metric … |
| 8903049722751559825 | 1 | 541.94 | 541.94 | CREATE DATABASE offer_db WITH ENCODING='UTF8' LC_COLLATE='en_US.UTF8'… |
| 6767030376420311356 | 78 | 482.27 | 6.18 | -- Notification rules evolution … CREATE TABLE notification_rules … |
| 323323879932780684 | 657 | 367.33 | 0.56 | ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '' |
| 1008208167816625675 | 50 | 231.66 | 4.63 | DO $do$ BEGIN … ALTER TABLE offer_evaluations ADD COLUMN offer_url_hash … |

> **观察**  
> - 业务角色 `postgres` 的 Top 5 全部为迁移或 DDL 操作，说明目前统计窗口内缺乏真实线上读写负载。  
> - 索引与表结构调整已被记录，可用于后续变更审计。

---

## 结论与后续计划

1. **慢查询基线**  
   - 当前统计周期内未观察到业务 SQL 超过 100ms。  
   - 云端备份、密码校验属于运维操作，可从监控面板中做标签过滤。

2. **监控建议**  
   - 将 `pg_stat_statements` 导出的 CSV 定期落地（可使用 Cloud Scheduler + Cloud Functions 自动化）。  
   - 在 Cloud Logging 中创建筛选器：`resource.type="cloudsql_database" AND jsonPayload.duration>=0.1s`，结合 Grafana 告警规则 7.6。

3. **下一步任务衔接**  
   - 继续完成阶段三 8.2-8.6 的数据库索引与连接池优化（已在先前实施报告中完成）。  
   - 进入 8.7 “热点数据识别”前，建议等待实际流量或构造压力测试，确保样本覆盖真实业务路径。

---

**附件与原始数据**

- `gs://autoads-query-insights-apne1/pg_stat_statements_over100ms_20251009133906.csv`
- `gs://autoads-query-insights-apne1/pg_stat_statements_postgres_20251009133831.csv`
- `gs://autoads-query-insights-apne1/ddl/create_pg_stat_statements.sql`

如需进一步分析，可在本地下载 CSV 后使用数据透视或 BI 工具深入挖掘。
