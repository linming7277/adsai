# API 契约对照表（2025-10-09）

> 梳理当前 Go/Firebase 接口与 Supabase 重构目标的映射，用于迁移阶段校验功能覆盖。后续将为每个接口补充响应样例与测试用例。

## Dashboard & 概览
| Endpoint | Method | 当前实现 | 认证 | 重构目标 | 调用方 |
| --- | --- | --- | --- | --- | --- |
| `/dashboard` | GET | Next.js BFF → `API_BASE_URL/dashboard`（Console service） | Firebase ID Token | Supabase BFF → `services/console` 新版 `/api/v1/console/dashboard` | `useDashboard` |
| `/dashboard/metrics` | GET | Console service 聚合 | Firebase | Supabase JWT，直接调用 Console 服务 | `useDashboardMetrics` |
| `/dashboard/risk-alerts` | GET | Console service | Firebase | Supabase JWT，增强筛选字段 | `useRiskAlerts` |
| `/dashboard/risk-alerts/{id}/read` | POST | Console service | Firebase | Supabase JWT，写入审计 | `useMarkAlertRead` |
| `/dashboard/top-offers` | GET | Console service | Firebase | Supabase JWT | `useTopOffers` |
| `/dashboard/trends` | GET | Console service | Firebase | Supabase JWT | `useDashboardTrends` |

### 响应样例（Dashboard 模块）
```json
{
  "kpis": {
    "spend": 12430.55,
    "ctr": 0.067,
    "conversionRate": 0.028
  },
  "riskAlerts": [
    {
      "id": "alert_01J9G8VFA3ZQJZKPX7R70M53V3",
      "title": "投放成本异常增长",
      "severity": "high",
      "detectedAt": "2025-10-06T14:12:00Z"
    }
  ],
  "topOffers": [
    {
      "id": "offer_01H2TGT0WWE9XC9PQ7FXB0Y2F1",
      "name": "秋季新品活动",
      "status": "active",
      "ctr": 0.081
    }
  ],
  "trends": {
    "labels": ["2025-10-01", "2025-10-02", "2025-10-03"],
    "spend": [3912.31, 4077.55, 4440.69],
    "conversions": [132, 145, 158]
  }
}
```

## Offers 服务（services/offer）
| Endpoint | Method | 描述 | 当前认证 | 重构目标 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `/api/v1/offers` | GET | 当前用户 Offer 列表 | Go AuthMiddleware (Firebase) | Supabase JWT，支持分页/过滤 | `useOffers` Hook |
| `/api/v1/offers` | POST | 创建 Offer | Firebase | Supabase JWT，记录审计 | `createOffer` |
| `/api/v1/offers/{id}` | GET | Offer 详情 | Firebase | Supabase JWT | `OfferDetailModal` |
| `/api/v1/offers/{id}/status` | POST | 更新状态 | Firebase | Supabase JWT，增强状态校验 | `updateOfferStatus` |
| `/api/v1/offers/internal/kpi/*` | GET | KPI 汇总（Service Token） | X-Service-Token | 保留 Service Token + 审计 | 后台报表 |
| `/api/v1/offers/bulk/*` | POST | 批量操作 | Firebase + AdminOnly | Supabase Admin JWT + Service Token 审计 | Console Admin |

### 响应样例（Offers 列表）
```json
{
  "items": [
    {
      "id": "offer_01H2TGT0WWE9XC9PQ7FXB0Y2F1",
      "name": "秋季新品活动",
      "channels": ["google_ads", "meta_ads"],
      "status": "active",
      "budget": 5000,
      "createdAt": "2025-09-28T11:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 37
  }
}
```

## Tasks / Batchopen（services/batchopen）
| Endpoint | Method | 描述 | 当前认证 | 重构目标 | 调用方 |
| --- | --- | --- | --- | --- | --- |
| `/api/v1/tasks` | GET | 列出当前用户任务（分页、状态筛选） | Firebase | Supabase JWT | `useTasks` |
| `/api/v1/tasks/{id}` | GET | 获取单条任务 | Firebase | Supabase JWT | `useTask` |
| `/api/v1/tasks/{id}/cancel` | POST | 取消任务 | Firebase | Supabase JWT | `useCancelTask` |
| `/api/v1/tasks/{id}/retry` | POST | 重新执行任务 | Firebase | Supabase JWT | `useRetryTask` |
| `/api/v1/batchopen/tasks` | POST | 创建批量任务（OpenAPI 生成） | Firebase | Supabase JWT | 批量投放入口 |

### 响应样例（任务详情）
```json
{
  "id": "task_01HYQY9X8AR1K0YWSJ0CVC20VW",
  "type": "bulk_offer_publish",
  "status": "running",
  "createdAt": "2025-10-05T02:12:44Z",
  "updatedAt": "2025-10-05T02:21:03Z",
  "progress": 52,
  "metadata": {
    "offers": ["offer_01H2TGT0WWE9XC9PQ7FXB0Y2F1"],
    "initiator": "user_01H2TGQ2ZS5J5HWA3T4F0WPH5N"
  }
}
```

## AdsCenter（services/adscenter）
| Endpoint | 方法 | 描述 | 当前认证 | 重构目标 |
| --- | --- | --- | --- | --- |
| `/api/v1/adscenter/accounts` | GET | 账户列表 | Firebase | Supabase JWT，补充分页/状态 |
| `/api/v1/adscenter/accounts/{id}` | GET | 账户详情 | Firebase | Supabase JWT |
| `/api/v1/adscenter/accounts/{id}/sync` | POST | 手动同步账户 | Firebase | Supabase JWT |
| `/api/v1/adscenter/accounts/{id}/disconnect` | POST | 断开连接 | Firebase | Supabase JWT |
| `/api/v1/adscenter/accounts/sync-all` | POST | 同步所有账户 | Firebase | Supabase JWT + 限流 |
| `/api/v1/adscenter/keywords/expand` | POST | 关键词拓展 | Firebase | Supabase JWT |
| `/api/v1/adscenter/transfer-budget` | POST | 预算转移 | Firebase | Supabase JWT + 事务审计 |
| `/api/v1/adscenter/ab-tests/*` | GET/POST | A/B 实验 CRUD | Firebase | Supabase JWT + 更细粒度权限 |
| `/api/v1/adscenter/preflight` | POST | 广告预检 | Firebase | Supabase JWT |

### 响应样例（AdsCenter 账户列表）
```json
{
  "accounts": [
    {
      "id": "act_106936427815563",
      "displayName": "AdsAI HK",
      "status": "active",
      "currency": "HKD",
      "linkedMcc": "mcc_6543-2190-7761"
    }
  ],
  "syncState": {
    "lastSyncedAt": "2025-10-05T16:44:00Z",
    "nextScheduledAt": "2025-10-06T04:00:00Z"
  }
}
```

## Billing / Tokens（services/billing）
| Endpoint | 方法 | 描述 | 当前认证 | 重构目标 |
| --- | --- | --- | --- | --- |
| `/api/v1/tokens/balance` | GET | 当前用户 Token 余额 | Firebase | Supabase JWT（已支持） |
| `/api/v1/tokens/transactions` | GET | 交易记录 | Firebase | Supabase JWT（新增分页筛选） |
| `/api/v1/tokens/usage` | GET | 用户使用摘要（start/end） | Firebase | Supabase JWT（已实现） |
| `/api/v1/tokens/{userId}/balance` | GET | 管理员查询 | Firebase + AdminOnly | Supabase Admin JWT + 审计（已添加） |
| `/api/v1/tokens/{userId}/transactions` | GET | 管理员交易明细 | Firebase + AdminOnly | Supabase Admin JWT + 审计（已添加） |
| `/api/v1/tokens/{userId}/usage` | GET | 管理员使用摘要 | Firebase + AdminOnly | Supabase Admin JWT + 审计（已添加） |
| `/api/v1/billing/tokens/credit/*` | POST | 充值/订阅发放 | Firebase | Supabase JWT（结合 BFF 控制） |
| `/api/v1/users/{userId}/tokens/*` | POST | 后端消费 Token | Service Token | 保留 Service Token，提供 Supabase 校验辅助 |

### 响应样例（Token 余额）
```json
{
  "balance": 12850,
  "currency": "token",
  "availableCredit": 4500,
  "nextRenewalAt": "2025-11-01T00:00:00Z"
}
```

## Admin / Console（services/console）
| Endpoint | 方法 | 描述 | 当前认证 | 重构目标 |
| --- | --- | --- | --- | --- |
| `/api/v1/console/users` | GET | 用户列表 | Firebase + AdminOnly | Supabase Admin JWT |
| `/api/v1/console/users/{id}` | GET/PUT/DELETE | 用户详情、角色、停用 | Firebase + AdminOnly | Supabase Admin JWT |
| `/api/v1/console/users/{id}/tokens` | POST | 管理员充值用户 Token | Firebase + AdminOnly | Supabase Admin JWT + 审计 |
| `/api/v1/console/users/{id}/impersonate` | POST | 代登录 | Firebase + AdminOnly | Supabase Admin JWT + `admin_impersonation_events` |
| `/api/v1/console/tokens/*` | GET/POST | Token 统计/Lot 管理 | Firebase + AdminOnly | Supabase Admin JWT |
| `/api/v1/console/audit/*` | GET | 审计日志 | Firebase + AdminOnly | Supabase Admin JWT |
| `/api/v1/console/config*` | GET/POST | 配置管理 | Firebase + AdminOnly | Supabase Admin JWT |

## Notifications（services/notifications）
| Endpoint | 方法 | 描述 | 当前认证 | 重构目标 |
| --- | --- | --- | --- | --- |
| `/api/v1/notifications/recent` | GET | 最近通知列表 | Firebase | Supabase JWT |
| `/api/v1/notifications/stream` | GET (SSE) | 实时通知 | Firebase | Supabase JWT，保留 SSE |
| `/api/v1/notifications/risk/preview` | GET | 风险预览 | Firebase | Supabase JWT |
| `/api/v1/notifications/risk/evaluate` | POST | 风险评估 | Firebase | Supabase JWT |

## 备注
- 前端现有 `/pages/api/**` （如 `/api/csrf-token`、`/api/stripe/webhook`）将在重构时重新评估，必要时迁移至 Go 服务或 Supabase Function。
- 表格为初版对照，待每模块迁移时补齐字段、响应结构与测试用例链接。
