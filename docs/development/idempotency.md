# 写操作幂等策略（Idempotency）

本项目对“可能重复提交”的写操作（POST/PUT/DELETE）统一提供幂等保护，避免重复扣费、重复入队、重复执行等副作用。

## 设计要点
- 传入键：客户端在写操作时设置 `X-Idempotency-Key`（推荐 UUID/有意义的业务键，最长 128 字符）
- 透传：BFF/HTTP 客户端默认透传该头，事件/队列也附带该键（参考 pkg/httpclient 与 pkg/events）
- 中间件：`pkg/middleware/IdempotencyMiddleware` 读取并注入上下文
- 持久化映射：
  - 表：`idempotency_keys(key TEXT PRIMARY KEY, user_id TEXT, scope TEXT, target_id TEXT, created_at, expires_at)`（见 `schemas/sql/005_idempotency.sql`）
  - 查询：`SELECT target_id FROM idempotency_keys WHERE key=$1 AND user_id=$2 AND scope=$3 AND expires_at>NOW()`
  - 写入：`INSERT ... ON CONFLICT (key) DO UPDATE ...`，并设置 TTL（常见 6h/24h）
- 命名规范（scope）：`{service}.{feature}[.subfeature][:{resourceId}]`
  - 示例：
    - `adscenter.bulk.submit`
    - `adscenter.abtest.create`
    - `adscenter.abtest.metrics:{testId}:{variant}`
    - `adscenter.rollback`
    - `batchopen.create`
    - `siterank.analyze`

## 覆盖情况（示例）
- adscenter：bulk submit/validate、rollback、A/B tests（create/metrics/refresh/graduate/apply-plan）、执行器（execute-next、execute-tick）
- siterank：analyze
- batchopen：任务创建
- billing：credit/commit/reserve/release 等原子扣费

## 使用建议
- 客户端：
  - 用户触发的“变更/入队/执行”操作应携带 `X-Idempotency-Key`
  - 重试/网络抖动/刷新后重复提交也能返回同一 `target_id`
- 服务端：
  - 读 `X-Idempotency-Key` → 查表命中则短路返回；新建成功后写入映射
  - TTL 依业务设定（队列型 6~24 小时，账务类可更长）

## 验收方法（示例）
- 重复调用写端点（携带相同 `X-Idempotency-Key`）
  - 第一次：返回 2xx + 新的业务 `target_id`
  - 第二次：返回 2xx + 相同 `target_id`（或 idempotent 标记/当前状态）

