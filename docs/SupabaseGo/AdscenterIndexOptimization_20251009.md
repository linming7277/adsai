# Adscenter 批量操作索引优化记录（阶段三任务 8.3）

**日期**: 2025-10-09  
**执行人**: Codex 助手  
**目标**: 完成阶段三任务 8.3，为批量操作表补齐性能索引

---

## 现状审查

通过 Cloud SQL 查询确认 `BulkActionOperation` 仅存在以下索引：

- `BulkActionOperation_pkey`（主键）
- `ix_bulk_op_user`（`user_id, created_at DESC`）

缺少针对 `status` 过滤和纯 `created_at` 排序的索引，影响列表/筛选请求性能。

查询命令：

```bash
gcloud sql export csv autoads gs://autoads-query-insights-apne1/adscenter_indexdefs.csv \
  --database=autoads_db \
  --query="SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='BulkActionOperation'"
```

---

## 执行步骤

### 1. 新增迁移脚本

文件: `services/adscenter/internal/migrations/007_bulk_action_indexes.sql`

```sql
DO $$
BEGIN
  IF to_regclass('"BulkActionOperation"') IS NOT NULL THEN
    IF to_regclass('idx_bulk_actions_user_status') IS NULL THEN
      EXECUTE 'CREATE INDEX idx_bulk_actions_user_status ON "BulkActionOperation"(user_id, status)';
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"BulkActionOperation"') IS NOT NULL THEN
    IF to_regclass('idx_bulk_actions_created') IS NULL THEN
      EXECUTE 'CREATE INDEX idx_bulk_actions_created ON "BulkActionOperation"(created_at DESC)';
    END IF;
  END IF;
END
$$;
```

### 2. 导入 Cloud SQL

```bash
gsutil cp services/adscenter/internal/migrations/007_bulk_action_indexes.sql \
  gs://autoads-query-insights-apne1/ddl/007_bulk_action_indexes.sql

gcloud sql import sql autoads \
  gs://autoads-query-insights-apne1/ddl/007_bulk_action_indexes.sql \
  --database=autoads_db \
  --user=postgres
```

> 注意：需显式指定 `--user=postgres`，否则 Cloud SQL 默认服务账号无表所有权，无法创建索引。

---

## 验证结果

```bash
gcloud sql export csv autoads gs://autoads-query-insights-apne1/adscenter_indexdefs_after.csv \
  --database=autoads_db \
  --query="SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='BulkActionOperation' ORDER BY indexname"
```

导出结果包含：

- `idx_bulk_actions_user_status` → `(user_id, status)`
- `idx_bulk_actions_created` → `(created_at DESC)`
- 原有 `ix_bulk_op_user` 保留，用于用户维度的时间排序

---

## 后续建议

- 可在 adscenter API 层更新查询计划，优先利用新索引执行状态筛选。
- 若后续需要统一索引命名，可考虑将 `ix_bulk_op_user` 重命名为 `idx_bulk_actions_user_created`，保持命名规范一致。
- 继续推进阶段三任务 8.4（offer 索引优化），与本次结果共同提升查询性能。

---

**附件**

- 迁移脚本: `services/adscenter/internal/migrations/007_bulk_action_indexes.sql`
- Cloud SQL 导入路径: `gs://autoads-query-insights-apne1/ddl/007_bulk_action_indexes.sql`
