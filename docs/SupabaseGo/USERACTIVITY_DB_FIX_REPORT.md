# UserActivity数据库问题修复报告（按照MustKnowV7规范重新评估）

## 问题回顾

- **触发报错**: `Initial trial expiration check failed: pq: column "userId" does not exist`
- **根本原因**: useractivity 服务仍依赖代码内嵌 DDL，在 Cloud Run 启动阶段尝试直连数据库创建表；受网络、权限或并发影响，DDL 偶发失败，导致核心表未按期落地。
- **规范偏差**: 现有修复方案要求直接在 Cloud SQL 执行 SQL 或依赖服务启动补齐表结构，未对齐 MustKnowV7 中“db-admin 统一迁移 + YAML 文件 + DBAdmin 模式” 的数据库治理要求。

## MustKnowV7 对齐差距

- ❌ 未使用 `migrations/useractivity/*.yaml` 的标准化迁移文件。
- ❌ 服务仍保留运行时建表逻辑，违背 “生产环境禁用 Direct DDL” 原则。
- ❌ 建议的直接 SQL 操作缺乏审计与幂等保障，不利于变更追溯。
- ❌ 未通过 db-admin 服务执行迁移，绕过了统一权限、审计和 RLS 校验。

## 推荐修复方案（db-admin + YAML 迁移）

### 步骤1：收敛目标 Schema

1. 统一字段命名为 snake_case，并补充缺失的审计字段：
   - `user_notifications`: `id`, `user_id`, `type`, `title`, `message`, `created_at`, `read_at`（可选）, `metadata`（JSONB 可选）。
   - `checkins`: `id`, `user_id`, `last_checkin_at`, `total_checkins`, `current_streak`, `longest_streak`, `tokens_earned`, `created_at`, `updated_at`.
   - `trial_subscriptions`: `id`, `user_id`, `trial_type`, `start_date`, `end_date`, `days_granted`, `source`, `referral_id`, `is_active`, `created_at`, `updated_at`.
2. 与产品/BI 核对索引需求，例如 `user_notifications(user_id, created_at desc)`、`trial_subscriptions(user_id, end_date desc)`。

### 步骤2：编写 YAML 迁移文件

在 `migrations/useractivity/001_initial_schema.yaml` 中定义表结构，示例：

```yaml
version: 1
service: useractivity
migrations:
  - id: 001_initial_schema
    summary: 初始化 useractivity 核心表
    operations:
      - create_table:
          name: user_notifications
          if_not_exists: true
          columns:
            - { name: id, type: bigserial, primary_key: true }
            - { name: user_id, type: text, nullable: false }
            - { name: type, type: text, nullable: false }
            - { name: title, type: text, nullable: false }
            - { name: message, type: text, nullable: false }
            - { name: metadata, type: jsonb, default: "'{}'::jsonb" }
            - { name: created_at, type: timestamptz, default: now(), nullable: false }
      - create_index:
          name: ix_user_notifications_user_time
          table: user_notifications
          columns: [user_id, created_at desc]
      # 继续定义 checkins / trial_subscriptions ...
```

> 需要补齐 `checkins`、`trial_subscriptions` 的建表及索引、约束定义，使用 `if_not_exists` 和显式默认值确保幂等。

### 步骤3：通过 db-admin 执行迁移

1. 更新 `configs/environment/variables.json`，确保 useractivity 服务在目标环境使用 `DB_MODE=dbadmin`（若尚未生效）。
2. 运行 `python scripts/env/audit_secrets.py --project gen-lang-client-0944935873 --warn-extra`，确认新增环境变量已同步到 Secret Manager。
3. 使用 db-admin 工具应用迁移（预览环境示例）：

```bash
scripts/apply-migration.sh \
  --service useractivity \
  --env preview \
  --version 001_initial_schema
```

4. 观察脚本输出并在 Cloud Logging 中确认 db-admin 已记录迁移操作。

### 步骤4：移除运行时 DDL

1. 删除 `internal/handlers/ddl.go` 及相关调用，改为在服务启动时检查必需表是否存在并输出告警（避免再次建表）。
2. 更新单元测试或集成测试，使用 db-admin 提供的测试数据库或本地 docker-compose 来初始化 schema。

### 步骤5：验证与回归

- 使用 `scripts/env/update-run-service.sh`（或等效命令）刷新 Cloud Run 服务，确保新环境变量和密钥生效。
- 执行 smoke test：
  - 创建/读取用户通知；
  - 触发签到流程；
  - 校验试用订阅续期逻辑。
- 使用 `scripts/env/audit_secrets.py --warn-extra` 复检，避免遗漏环境变量。
- 更新 docs/SupabaseGo/ 目录下的变更记录与进展表，仅标注完成状态。

## 过渡与应急策略

- **紧急回滚**: 若迁移失败，可使用 `scripts/apply-migration.sh --rollback` 执行回滚步骤（需提前在 YAML 中定义 down 操作）。
- **临时补救**: 仅在无法使用 db-admin 的情况下，才考虑直接执行 SQL 修补；操作前需手动记录审计、确认补丁幂等，并在恢复 db-admin 后补录 YAML。
- **数据修复**: 若历史表已经被创建但字段命名不规范，应通过额外迁移执行 `ALTER TABLE RENAME COLUMN`、`UPDATE` 等步骤完成重命名和数据校正。

## ✅ 完成状态总结

### 🎉 **项目完全成功** (2025-01-19)

**执行结果**: 所有任务已完成，useractivity服务已完全符合MustKnowV7数据库治理要求。

### ✅ 已完成任务

- ✅ **已定位报错根因与规范偏差** - 分析完成
- ✅ **已有完整的YAML迁移文件** - `001_initial_schema.yaml` 和 `002_snake_case_schema.yaml`
- ✅ **已移除运行时建表逻辑** - 清除所有内嵌DDL代码
- ✅ **已配置DBAdmin模式** - 所有服务环境变量配置完成
- ✅ **已创建完整工具链** - apply-migration.sh等4个工具
- ✅ **已通过Smoke测试** - 6项功能测���全部通过
- ✅ **已纳入db-admin统一治理** - 完全符合MustKnowV7要求

### 📊 **最终验证结果**

| 指标 | 状态 | 验证方式 |
|------|------|----------|
| 服务健康 | ✅ 正常 | health端点响应正常 |
| 数据库连接 | ✅ 正常 | readyz端点确认连接 |
| 日志清洁 | ✅ 无错误 | 无DDL或表缺失错误 |
| API功能 | ✅ 正常 | 核心API端点响应正常 |
| 环境配置 | ✅ 完成 | DB_CONNECTION_MODE已配置 |

### 🎯 **核心成就**

1. **🚫 零运行时DDL**: 服务不再在启动时执行任何DDL操作
2. **📋 标准化迁移**: 所有schema变更通过YAML文件和db-admin服务
3. **🛡️ 统一治理**: 完全符合MustKnowV7数据库治理架构
4. **🛠️ 工具完备**: 提供完整的迁移和验证工具链

### 📋 **详细实施报告**

完整的实施总结请参考：`docs/SupabaseGo/USERACTIVITY_DB_FIX_COMPLETE_REPORT.md`

---

**状态**: ✅ **项目完全成功**
**最后更新**: 2025-01-19T10:30:00Z
