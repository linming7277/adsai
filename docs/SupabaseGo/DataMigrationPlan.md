# Supabase 数据迁移计划（Stage 1）

## 目标
- 将现有 Firebase/Firestore 中仍在使用的用户层数据迁移至 Supabase Postgres，同时放弃组织/团队等已停用模块。
- 保障每条数据都以 `user_id` 归属，满足多用户 SaaS 的隔离需求。

## 范围界定
| 数据域 | 现状 | 迁移策略 |
| --- | --- | --- |
| 用户基本资料 | Firebase Auth + Firestore `users` 集合 | 仅迁移活跃账户的 `displayName`、`email`、`avatar` 至 `user_profiles`；Supabase Auth 已维护账号主体 |
| Offers / Tasks / Ads | Firestore / 私有 API | 迁移近期 90 天内有访问或执行记录的数据到 `offers`、`tasks`、`ads_connections` 表；历史数据归档到 GCS（CSV/JSON）|
| Token 余额/流水 | Firestore `token_wallet`, `token_transactions` | 迁移余额与最近 180 天流水，老数据压缩为季度汇总写入归档表或 Object Storage |
| 组织/订阅 | 停用 | 不迁移；保留在备份中，以备审计或未来重新启用 |
| 审计事件 | Firebase Functions 日志 | 从现有 Cloud Logging 导出 CSV，写入 Supabase `admin_impersonation_events`（已存在结构）|

## 步骤分解
1. **数据清点**
   - 导出 Firestore 指定集合（限制字段、指定时间范围）
   - 统计活跃用户列表：最近 60 天登录或有操作记录的 `uid`
2. **数据转换**
   - 使用 Cloud Functions 或一次性脚本，将 JSON 转换为 Supabase INSERT 语句或 `csv`（`COPY` 导入）
   - 字段映射示例：
     - `firestore.users.displayName` → `user_profiles.full_name`
     - `firestore.offers.status` → `offers.status`（统一枚举）
     - `firestore.tasks.payload` → `tasks.payload`
3. **导入执行**
   - 本地或 Cloud Run Job 执行导入脚本，按表顺序写入；遇到冲突（重复 `id`）记录日志并跳过
   - 导入后立刻运行校验查询，确认数据总量与索引一致
4. **校验与回滚策略**
   - 样本对比：随机抽取 N 条，双向比对字段
   - 若发现问题，可清空对应 Supabase 表并重新导入
5. **切换与监控**
   - 前端/后端切换至 Supabase 数据源后，保留 Firestore 只读 1 周；无问题后关闭写入
   - 配置监控（Supabase Logs、Go 服务 Prometheus 指标）观察错误率

## 工具与脚本建议
- 使用 Google Cloud Firestore 导出 + BigQuery 或 `node` 脚本对数据做批处理
- Supabase 导入可使用 `psql`、`supabase db` CLI 或 `COPY FROM STDIN`
- 记录迁移日志，方便追踪失败条目与补偿操作

## 风险与缓解
- **字段不匹配**：在迁移脚本阶段明确映射关系，对新增字段设置默认值
- **大体量导入**：分批导入，按 `user_id` 分段处理，避免长事务
- **访问中断**：切换窗口选择非高峰时段，并提供回滚预案

## 交付物
- `docs/SupabaseGo/SupabaseSchemaStage1.sql`（表结构 + RLS）
- 本文档 `DataMigrationPlan.md`
- 数据迁移脚本（后续补充，建议放置于 `scripts/migration/`）

> 本计划为 Stage 1 输出，后续阶段可针对新增表或业务扩展继续迭代。
