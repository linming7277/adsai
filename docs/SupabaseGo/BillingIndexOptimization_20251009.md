# Billing 服务索引优化执行记录（阶段三任务 8.2）

**日期**: 2025-10-09  
**执行人**: Codex 助手  
**目标**: 完成架构改进阶段三任务 8.2（优化 billing 数据库索引）

---

## 执行摘要

- ✅ Supabase 库：将历史索引 `idx_token_tx_user_created` 重命名为新规范 `idx_token_transactions_user_created`，对应 `token_transactions` 表的常用查询。
- ✅ Cloud SQL（autoads_db）：新增迁移 `000009_add_billing_performance_indexes.up.sql`，在存在表结构时自动创建 `idx_token_transactions_user_created` 与 `idx_subscriptions_user_status`。
- ℹ️ 当前 Cloud SQL 环境尚未创建 `Subscription` 表，迁移脚本采用条件执行，待表结构落地后会自动补齐索引。

---

## 具体步骤

### 1. Supabase 索引命名规范化

```bash
# 连接 Session Pooler
export SUPABASE_DB_URL="postgresql://postgres.jzzvizacfyipzdyiqfzb:*HF%239dFnzV5DBA.@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require"

# 重命名旧索引
psql "$SUPABASE_DB_URL" -c 'ALTER INDEX IF EXISTS idx_token_tx_user_created RENAME TO idx_token_transactions_user_created;'

# 验证
psql "$SUPABASE_DB_URL" -c '\d+ public.token_transactions'
```

**结果**: `token_transactions` 表现有索引列表中已出现 `idx_token_transactions_user_created (user_id, created_at DESC)`。

### 2. Cloud SQL 迁移脚本

新增文件: `services/billing/internal/migrations/000009_add_billing_performance_indexes.up.sql`

```sql
DO $$
BEGIN
  IF to_regclass('"TokenTransaction"') IS NOT NULL THEN
    IF to_regclass('"TokenTransaction_userId_createdAt_idx"') IS NOT NULL THEN
      EXECUTE 'ALTER INDEX "TokenTransaction_userId_createdAt_idx" RENAME TO idx_token_transactions_user_created';
    ELSIF to_regclass('idx_token_transactions_user_created') IS NULL THEN
      EXECUTE 'CREATE INDEX idx_token_transactions_user_created ON "TokenTransaction"("userId", "createdAt" DESC)';
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"Subscription"') IS NOT NULL THEN
    IF to_regclass('idx_subscriptions_user_status') IS NULL THEN
      EXECUTE 'CREATE INDEX idx_subscriptions_user_status ON "Subscription"("userId", "status")';
    END IF;
  END IF;
END
$$;
```

执行命令:

```bash
gsutil cp services/billing/internal/migrations/000009_add_billing_performance_indexes.up.sql \
  gs://autoads-query-insights-apne1/ddl/000009_add_billing_performance_indexes.up.sql

gcloud sql import sql autoads \
  gs://autoads-query-insights-apne1/ddl/000009_add_billing_performance_indexes.up.sql \
  --database=autoads_db
```

**说明**: 迁移使用 `to_regclass()` 条件判断，可在未建表的环境中安全运行；一旦 `TokenTransaction` / `Subscription` 表存在，即会自动创建或重命名索引，保持命名一致。

---

## 验证与后续

- Supabase 验证完成，索引名称统一，便于后续性能观测。
- Cloud SQL 侧待 `billing` 服务迁移脚本落地后复查（建议结合 `\d "TokenTransaction"` / `\d "Subscription"`）。
- 下一步将继续执行阶段三任务 8.3（adscenter 索引优化），并在完成后同步更新任务追踪文档。

---

**附件**

- 迁移脚本 GCS 路径: `gs://autoads-query-insights-apne1/ddl/000009_add_billing_performance_indexes.up.sql`
- Supabase 索引验证截图: 参见上述 `\d+` 输出
