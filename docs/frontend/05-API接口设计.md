# AdsAI API 接口设计文档

> 基于 RESTful 风格的前后端 API 接口规范
>
> 版本: v2.0
> 更新时间: 2024-10-03
>
> **v2.0 更新内容:**
> - 术语修正："仿真" → "补点击"
> - 修正补点击接口（删除 ads_account_ids 参数）
> - 新增投放接口（POST /api/v1/offers/{id}/deploy）
> - 补点击进度不返回 ROAS 等业务数据

---

## 📋 目录

- [API 设计原则](#api-设计原则)
- [认证与授权](#认证与授权)
- [通用规范](#通用规范)
- [核心服务接口](#核心服务接口)
  - [Offer 服务](#1-offer-服务)
  - [SiteRank 服务](#2-siterank-服务)
  - [AdsCenter 服务](#3-adscenter-服务)
  - [BatchOpen 服务](#4-batchopen-服务)
  - [Billing 服务](#5-billing-服务)
  - [Notifications 服务](#6-notifications-服务)
  - [Dashboard 服务](#7-dashboard-服务)
  - [Tasks 服务](#8-tasks-服务)
- [错误处理](#错误处理)
- [限流与配额](#限流与配额)

---

## 🎯 API 设计原则

### 核心原则

1. **RESTful** - 资源导向，使用 HTTP 动词
2. **版本控制** - URL 路径包含版本号 `/api/v1/`
3. **统一格式** - 统一的请求/响应格式
4. **错误友好** - 清晰的错误码和错误信息
5. **幂等性** - GET/PUT/DELETE 保证幂等

### URL 命名规范

```
基础 URL: https://api.example.com/api/v1/
预发环境: https://api.preview.example.com/api/v1/

资源命名:
- 使用复数名词: /offers, /ads-accounts
- 使用小写字母: /offers/123
- 使用连字符: /ads-accounts, /token-transactions
- 嵌套资源: /offers/{id}/evaluations
```

### HTTP 动词

| 动词   | 用途               | 示例                          |
| ------ | ------------------ | ----------------------------- |
| GET    | 获取资源           | GET /offers                   |
| POST   | 创建资源           | POST /offers                  |
| PUT    | 完整更新资源       | PUT /offers/123               |
| PATCH  | 部分更新资源       | PATCH /offers/123             |
| DELETE | 删除资源           | DELETE /offers/123            |

---

## 🔐 认证与授权

### Firebase ID Token

所有 API 请求必须携带 Firebase ID Token：

```http
Authorization: Bearer <firebase_id_token>
```

### Token 验证流程

```
1. 前端从 Firebase Auth 获取 ID Token
2. 请求时在 Header 中携带 Token
3. Go 微服务使用 Firebase Admin SDK 验证 Token
4. 验证成功后提取 user_id，执行业务逻辑
```

### 权限控制

基于用户角色的访问控制 (RBAC)：

```typescript
enum UserRole {
  USER = 'USER',           // 普通用户
  ADMIN = 'ADMIN',         // 管理员
  SUPER_ADMIN = 'SUPER_ADMIN' // 超级管理员
}

// 权限示例
GET /offers          - USER, ADMIN, SUPER_ADMIN
POST /offers         - USER, ADMIN, SUPER_ADMIN
DELETE /offers/{id}  - ADMIN, SUPER_ADMIN (仅自己的)
GET /admin/users     - SUPER_ADMIN
```

---

## 📐 通用规范

### 请求格式

**Query 参数 (GET):**
```http
GET /api/v1/offers?page=1&limit=20&status=EVALUATED&sort=created_at:desc
```

**Body 参数 (POST/PUT/PATCH):**
```json
{
  "offer_url": "https://example.com/offer",
  "country_code": "US",
  "brand_name": "Nike"
}
```

### 响应格式

**成功响应:**
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "offer_url": "https://example.com/offer",
    "brand_name": "Nike"
  },
  "message": "Offer created successfully",
  "timestamp": "2024-10-03T12:34:56Z"
}
```

**分页响应:**
```json
{
  "success": true,
  "data": [
    { "id": "1", "brand_name": "Nike" },
    { "id": "2", "brand_name": "Adidas" }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  },
  "timestamp": "2024-10-03T12:34:56Z"
}
```

**错误响应:**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_TOKENS",
    "message": "Token 余额不足，需要 10 Token，当前余额 5 Token",
    "details": {
      "required": 10,
      "available": 5
    }
  },
  "timestamp": "2024-10-03T12:34:56Z"
}
```

---

## 🚀 核心服务接口

### 1. Offer 服务

#### 1.1 创建 Offer

**批量添加 Offer（支持单个或多个）**

```http
POST /api/v1/offers
```

**Request:**
```json
{
  "offers": [
    {
      "offer_url": "https://example.com/offer1",
      "country_code": "US",
      "auto_evaluate": true
    },
    {
      "offer_url": "https://example.com/offer2",
      "country_code": "UK"
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "created": [
      {
        "id": "offer_abc123",
        "offer_url": "https://example.com/offer1",
        "brand_name": "Nike",
        "country_code": "US",
        "evaluation_status": "QUEUED",
        "created_at": "2024-10-03T12:34:56Z"
      }
    ],
    "failed": [
      {
        "offer_url": "https://example.com/offer2",
        "reason": "Invalid URL format"
      }
    ]
  },
  "message": "1 offer created, 1 failed",
  "timestamp": "2024-10-03T12:34:56Z"
}
```

---

#### 1.2 获取 Offer 列表

```http
GET /api/v1/offers
```

**Query 参数:**
```
?page=1              # 页码（默认 1）
&limit=20            # 每页数量（默认 20，最大 100）
&status=EVALUATED    # 筛选状态: PENDING, EVALUATED, CLICK_TASK_RUNNING, DEPLOYED
&country_code=US     # 筛选国家
&sort=created_at:desc # 排序: created_at, roas, health_score (asc/desc)
&search=Nike         # 搜索品牌名或 URL
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "offer_abc123",
      "offer_url": "https://example.com/offer1",
      "brand_name": "Nike Shoes",
      "country_code": "US",
      "evaluation_status": "EVALUATED",
      "evaluation_score": 85,
      "click_task_status": "PENDING",
      "deployment_status": "PENDING",
      "roas": 2.35,
      "health_score": 88,
      "linked_ads_count": 3,
      "created_at": "2024-10-03T12:34:56Z",
      "updated_at": "2024-10-03T13:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  },
  "timestamp": "2024-10-03T12:34:56Z"
}
```

---

#### 1.3 获取单个 Offer

```http
GET /api/v1/offers/{offer_id}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "offer_abc123",
    "offer_url": "https://example.com/offer1",
    "brand_name": "Nike Shoes",
    "country_code": "US",
    "evaluation_status": "EVALUATED",
    "evaluation_score": 85,
    "evaluation_details": {
      "traffic_potential": 90,
      "keyword_precision": 80,
      "estimated_cpc": 70,
      "compliance_risk": 20,
      "seasonal_opportunity": 90
    },
    "click_task_status": "PENDING",
    "deployment_status": "PENDING",
    "roas": 2.35,
    "health_score": 88,
    "linked_ads_accounts": [
      {
        "id": "ads_123",
        "account_name": "Nike US 1",
        "status": "ACTIVE",
        "balance": 250.00
      }
    ],
    "created_at": "2024-10-03T12:34:56Z",
    "updated_at": "2024-10-03T13:00:00Z"
  },
  "timestamp": "2024-10-03T12:34:56Z"
}
```

---

#### 1.4 更新 Offer

```http
PATCH /api/v1/offers/{offer_id}
```

**Request:**
```json
{
  "brand_name": "Nike Running Shoes",
  "country_code": "CA",
  "tags": ["sports", "footwear"]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "offer_abc123",
    "brand_name": "Nike Running Shoes",
    "country_code": "CA",
    "tags": ["sports", "footwear"],
    "updated_at": "2024-10-03T13:30:00Z"
  },
  "message": "Offer updated successfully",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 1.5 删除 Offer

```http
DELETE /api/v1/offers/{offer_id}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Offer deleted successfully",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 1.6 批量操作 Offer

```http
POST /api/v1/offers/batch
```

**Request:**
```json
{
  "action": "EVALUATE",  // EVALUATE, CLICK_TASK, DEPLOY, ARCHIVE, DELETE
  "offer_ids": ["offer_abc123", "offer_def456", "offer_ghi789"]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "task_id": "task_xyz789",
    "status": "QUEUED",
    "total_offers": 3,
    "estimated_token_cost": 30,
    "estimated_duration": "30s"
  },
  "message": "Batch evaluation task created",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 1.7 投放到 Ads 账号

```http
POST /api/v1/offers/{offer_id}/deploy
```

**Request:**
```json
{
  "ads_account_ids": ["ads_123", "ads_456"]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "offer_id": "offer_abc123",
    "deployment_status": "DEPLOYED",
    "linked_accounts": [
      {
        "id": "ads_123",
        "account_name": "Nike US 1",
        "status": "ACTIVE"
      },
      {
        "id": "ads_456",
        "account_name": "Nike US 2",
        "status": "ACTIVE"
      }
    ],
    "deployed_at": "2024-10-03T13:30:00Z"
  },
  "message": "Offer deployed to 2 ads accounts successfully",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

**说明:**
- 投放操作会建立 Offer ←→ Ads Account 关联关系
- 写入 offer_ads_links 表
- 更新 offers 表的 deployment_status 为 DEPLOYED
- 投放后开始产生 ROAS 等业务数据

---

#### 1.8 查看已关联的 Ads 账号

```http
GET /api/v1/offers/{offer_id}/linked-accounts
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "offer_id": "offer_abc123",
    "total_linked": 2,
    "accounts": [
      {
        "id": "ads_123",
        "account_name": "Nike US 1",
        "status": "ACTIVE",
        "balance": 250.00,
        "linked_at": "2024-10-03T13:30:00Z",
        "stats_7d": {
          "spend": 156.30,
          "clicks": 320,
          "roas": 2.35
        }
      },
      {
        "id": "ads_456",
        "account_name": "Nike US 2",
        "status": "BUDGET_LOW",
        "balance": 15.00,
        "linked_at": "2024-10-03T13:30:00Z",
        "stats_7d": {
          "spend": 45.20,
          "clicks": 85,
          "roas": 1.8
        }
      }
    ]
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 1.9 断开 Ads 账号关联

```http
DELETE /api/v1/offers/{offer_id}/linked-accounts/{ads_account_id}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Ads account unlinked successfully",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

### 2. SiteRank 服务

#### 2.1 评估 Offer

**启动评估任务**

```http
POST /api/v1/siterank/evaluate
```

**Request:**
```json
{
  "offer_id": "offer_abc123",
  "priority": "NORMAL"  // LOW, NORMAL, HIGH
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "task_id": "task_eval_123",
    "offer_id": "offer_abc123",
    "status": "QUEUED",
    "token_cost": 10,
    "estimated_duration": "10s",
    "queue_position": 3
  },
  "message": "Evaluation task created",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 2.2 获取评估结果

```http
GET /api/v1/siterank/evaluate/{task_id}
```

**Response (200 OK - 评估中):**
```json
{
  "success": true,
  "data": {
    "task_id": "task_eval_123",
    "status": "IN_PROGRESS",
    "progress": 70,
    "current_step": "分析流量数据",
    "steps_completed": [
      "解析 URL",
      "访问落地页",
      "获取流量数据"
    ],
    "steps_remaining": [
      "AI 分析内容",
      "计算综合评分"
    ],
    "elapsed_time": "7s",
    "estimated_remaining": "3s"
  },
  "timestamp": "2024-10-03T13:30:07Z"
}
```

**Response (200 OK - 评估完成):**
```json
{
  "success": true,
  "data": {
    "task_id": "task_eval_123",
    "status": "COMPLETED",
    "offer_id": "offer_abc123",
    "score": 85,
    "details": {
      "traffic_potential": 90,
      "keyword_precision": 80,
      "estimated_cpc": 70,
      "compliance_risk": 20,
      "seasonal_opportunity": 90
    },
    "ai_recommendation": "该 Offer 流量潜力大，建议补充流量数据后再投放",
    "landing_page": {
      "url": "https://nike.com/shoes",
      "title": "Nike Running Shoes",
      "load_time": 2.3,
      "mobile_friendly": true
    },
    "token_consumed": 10,
    "duration": "9.8s",
    "completed_at": "2024-10-03T13:30:10Z"
  },
  "timestamp": "2024-10-03T13:30:10Z"
}
```

---

#### 2.3 批量评估

```http
POST /api/v1/siterank/evaluate/batch
```

**Request:**
```json
{
  "offer_ids": ["offer_abc123", "offer_def456", "offer_ghi789"]
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "batch_task_id": "batch_eval_xyz",
    "total_offers": 3,
    "status": "QUEUED",
    "estimated_token_cost": 30,
    "estimated_duration": "30s"
  },
  "message": "Batch evaluation task created",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

### 3. AdsCenter 服务

#### 3.1 获取 Google Ads OAuth URL

```http
GET /api/v1/adscenter/oauth/url
```

**Query 参数:**
```
?redirect_uri=https://www.example.com/adscenter/callback
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...",
    "state": "random_state_token_xyz"
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 3.2 处理 OAuth 回调

```http
POST /api/v1/adscenter/oauth/callback
```

**Request:**
```json
{
  "code": "4/0AY0e-g7...",
  "state": "random_state_token_xyz"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accounts_imported": 3,
    "accounts": [
      {
        "id": "ads_123",
        "account_id": "123-456-7890",
        "account_name": "Nike US 1",
        "currency": "USD",
        "balance": 250.00,
        "status": "ACTIVE"
      }
    ]
  },
  "message": "3 Google Ads accounts imported successfully",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 3.3 获取 Ads 账号列表

```http
GET /api/v1/adscenter/accounts
```

**Query 参数:**
```
?page=1
&limit=20
&status=ACTIVE       # ACTIVE, SUSPENDED, BUDGET_LOW
&search=Nike
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "ads_123",
      "account_id": "123-456-7890",
      "account_name": "Nike US 1",
      "currency": "USD",
      "balance": 250.00,
      "daily_budget": 50.00,
      "status": "ACTIVE",
      "linked_offers_count": 5,
      "total_impressions": 12500,
      "total_clicks": 320,
      "total_spend": 156.30,
      "last_synced_at": "2024-10-03T12:00:00Z",
      "created_at": "2024-09-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 3.4 获取单个 Ads 账号详情

```http
GET /api/v1/adscenter/accounts/{account_id}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "ads_123",
    "account_id": "123-456-7890",
    "account_name": "Nike US 1",
    "currency": "USD",
    "balance": 250.00,
    "daily_budget": 50.00,
    "status": "ACTIVE",
    "linked_offers": [
      {
        "id": "offer_abc123",
        "brand_name": "Nike Shoes",
        "roas": 2.35
      }
    ],
    "stats_7d": {
      "impressions": 12500,
      "clicks": 320,
      "spend": 156.30,
      "conversions": 18,
      "roas": 2.35
    },
    "last_synced_at": "2024-10-03T12:00:00Z",
    "created_at": "2024-09-01T10:00:00Z"
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 3.5 更新 Ads 账号

```http
PATCH /api/v1/adscenter/accounts/{account_id}
```

**Request:**
```json
{
  "account_name": "Nike US 1 - Updated",
  "daily_budget": 75.00
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "ads_123",
    "account_name": "Nike US 1 - Updated",
    "daily_budget": 75.00,
    "updated_at": "2024-10-03T13:30:00Z"
  },
  "message": "Ads account updated successfully",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 3.6 同步 Ads 账号数据

```http
POST /api/v1/adscenter/accounts/{account_id}/sync
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "task_id": "sync_task_123",
    "status": "QUEUED",
    "estimated_duration": "5s"
  },
  "message": "Sync task created",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 3.7 预算转移

```http
POST /api/v1/adscenter/transfer-budget
```

**Request:**
```json
{
  "from_account_id": "ads_123",
  "to_account_id": "ads_456",
  "amount": 50.00
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "transaction_id": "txn_abc123",
    "from_account": {
      "id": "ads_123",
      "balance_before": 250.00,
      "balance_after": 200.00
    },
    "to_account": {
      "id": "ads_456",
      "balance_before": 15.00,
      "balance_after": 65.00
    },
    "amount": 50.00,
    "completed_at": "2024-10-03T13:30:00Z"
  },
  "message": "Budget transferred successfully",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

### 4. BatchOpen 服务

#### 4.1 启动补点击任务

```http
POST /api/v1/batchopen/click-tasks
```

**Request:**
```json
{
  "offer_id": "offer_abc123",
  "target_clicks": 100,
  "duration_hours": 24
}
```

**关键说明:**
- ❌ **不需要** `ads_account_ids` 参数 - 补点击与 Ads 账号无关
- ✅ 仅需 2 个参数: `target_clicks` + `duration_hours`

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "task_id": "click_task_xyz789",
    "offer_id": "offer_abc123",
    "status": "QUEUED",
    "token_cost": 50,
    "estimated_duration": "24h",
    "target_clicks": 100,
    "queue_position": 2
  },
  "message": "Click task created",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 4.2 获取补点击进度

```http
GET /api/v1/batchopen/click-tasks/{task_id}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "task_id": "click_task_xyz789",
    "status": "IN_PROGRESS",
    "offer_id": "offer_abc123",
    "progress": 45,
    "stats": {
      "elapsed_hours": 10,
      "remaining_hours": 14,
      "completed_clicks": 45,
      "target_clicks": 100,
      "spend": 23.50
    },
    "started_at": "2024-10-03T10:00:00Z",
    "estimated_completion": "2024-10-04T10:00:00Z"
  },
  "timestamp": "2024-10-03T20:00:00Z"
}
```

**关键说明:**
- ✅ 显示: completed_clicks, target_clicks, spend
- ❌ **不显示**: revenue, conversions, roas（补点击不产生业务数据）

---

#### 4.3 补点击完成响应

```http
GET /api/v1/batchopen/click-tasks/{task_id}
```

**Response (200 OK - 已完成):**
```json
{
  "success": true,
  "data": {
    "task_id": "click_task_xyz789",
    "status": "COMPLETED",
    "offer_id": "offer_abc123",
    "final_stats": {
      "duration_hours": 24,
      "completed_clicks": 100,
      "target_clicks": 100,
      "total_spend": 52.30,
      "token_consumed": 50
    },
    "started_at": "2024-10-03T10:00:00Z",
    "completed_at": "2024-10-04T10:00:00Z"
  },
  "message": "Click task completed successfully",
  "timestamp": "2024-10-04T10:00:00Z"
}
```

**关键说明:**
- ❌ **不返回** revenue, conversions, roas 等业务数据
- ✅ 补点击仅用于流量获取，不产生 ROAS 数据

---

### 5. Billing 服务

#### 5.1 获取套餐列表

```http
GET /api/v1/billing/plans
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "plan_free",
      "name": "免费版",
      "price": 0,
      "currency": "USD",
      "interval": "month",
      "features": {
        "max_offers": 5,
        "monthly_tokens": 100,
        "max_ads_accounts": 2,
        "support_level": "community"
      }
    },
    {
      "id": "plan_pro",
      "name": "专业版",
      "price": 29.99,
      "currency": "USD",
      "interval": "month",
      "features": {
        "max_offers": 50,
        "monthly_tokens": 1000,
        "max_ads_accounts": 10,
        "support_level": "email"
      }
    },
    {
      "id": "plan_enterprise",
      "name": "企业版",
      "price": 99.99,
      "currency": "USD",
      "interval": "month",
      "features": {
        "max_offers": -1,
        "monthly_tokens": 10000,
        "max_ads_accounts": -1,
        "support_level": "priority"
      }
    }
  ],
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 5.2 获取当前订阅

```http
GET /api/v1/billing/subscription
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "sub_abc123",
    "user_id": "user_123",
    "plan_id": "plan_pro",
    "plan_name": "专业版",
    "status": "ACTIVE",
    "current_period_start": "2024-10-01T00:00:00Z",
    "current_period_end": "2024-11-01T00:00:00Z",
    "cancel_at_period_end": false,
    "created_at": "2024-09-15T10:00:00Z"
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 5.3 创建订阅

```http
POST /api/v1/billing/subscription
```

**Request:**
```json
{
  "plan_id": "plan_pro",
  "payment_method_id": "pm_abc123"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "subscription_id": "sub_abc123",
    "status": "ACTIVE",
    "plan_id": "plan_pro",
    "current_period_end": "2024-11-03T13:30:00Z"
  },
  "message": "Subscription created successfully",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 5.4 升级/降级订阅

```http
PATCH /api/v1/billing/subscription
```

**Request:**
```json
{
  "new_plan_id": "plan_enterprise"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "subscription_id": "sub_abc123",
    "old_plan_id": "plan_pro",
    "new_plan_id": "plan_enterprise",
    "proration_amount": 70.00,
    "effective_date": "2024-10-03T13:30:00Z"
  },
  "message": "Subscription upgraded successfully",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 5.5 取消订阅

```http
DELETE /api/v1/billing/subscription
```

**Request:**
```json
{
  "cancel_immediately": false  // true: 立即取消, false: 周期结束后取消
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "subscription_id": "sub_abc123",
    "status": "ACTIVE",
    "cancel_at_period_end": true,
    "period_end": "2024-11-01T00:00:00Z"
  },
  "message": "Subscription will be cancelled at period end",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 5.6 获取 Token 余额

```http
GET /api/v1/billing/tokens
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "balance": 1250,
    "monthly_quota": 1000,
    "bonus_tokens": 250,
    "expires_at": "2024-11-01T00:00:00Z"
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 5.7 购买 Token

```http
POST /api/v1/billing/tokens/purchase
```

**Request:**
```json
{
  "amount": 500,
  "payment_method_id": "pm_abc123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "transaction_id": "txn_token_123",
    "tokens_purchased": 500,
    "price": 9.99,
    "currency": "USD",
    "new_balance": 1750,
    "created_at": "2024-10-03T13:30:00Z"
  },
  "message": "500 tokens purchased successfully",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 5.8 获取 Token 交易历史

```http
GET /api/v1/billing/tokens/transactions
```

**Query 参数:**
```
?page=1
&limit=20
&type=ALL  // ALL, EARNED, CONSUMED, PURCHASED, REFUNDED
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "txn_123",
      "type": "CONSUMED",
      "amount": -10,
      "balance_after": 1240,
      "description": "评估 Nike Shoes",
      "reference_type": "EVALUATION",
      "reference_id": "task_eval_123",
      "created_at": "2024-10-03T12:00:00Z"
    },
    {
      "id": "txn_124",
      "type": "EARNED",
      "amount": 10,
      "balance_after": 1250,
      "description": "每日签到奖励",
      "reference_type": "CHECKIN",
      "reference_id": "checkin_20241003",
      "created_at": "2024-10-03T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 5.9 每日签到

```http
POST /api/v1/billing/checkin
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "tokens_earned": 10,
    "new_balance": 1260,
    "consecutive_days": 5,
    "next_milestone": {
      "days": 7,
      "bonus_tokens": 50
    }
  },
  "message": "Check-in successful! Earned 10 tokens",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

### 6. Notifications 服务

#### 6.1 获取通知列表

```http
GET /api/v1/notifications
```

**Query 参数:**
```
?page=1
&limit=20
&status=UNREAD  // ALL, UNREAD, READ
&type=ALL       // ALL, SYSTEM, TASK, RISK, REWARD
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "notif_123",
      "type": "RISK",
      "priority": "HIGH",
      "title": "Ads 账号预算不足",
      "message": "Nike US 2 余额不足 $20，将在 6 小时后暂停广告",
      "action": {
        "type": "ONE_CLICK_FIX",
        "label": "一键修复",
        "url": "/api/v1/adscenter/auto-fix/budget"
      },
      "status": "UNREAD",
      "created_at": "2024-10-03T12:00:00Z"
    },
    {
      "id": "notif_124",
      "type": "TASK",
      "priority": "NORMAL",
      "title": "评估完成",
      "message": "Nike Shoes 评估完成，得分 85 分",
      "reference": {
        "type": "OFFER",
        "id": "offer_abc123"
      },
      "status": "READ",
      "created_at": "2024-10-03T11:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "total_pages": 3,
    "has_next": true,
    "has_prev": false
  },
  "summary": {
    "total_unread": 12
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 6.2 标记为已读

```http
PATCH /api/v1/notifications/{notification_id}/read
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Notification marked as read",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 6.3 批量标记为已读

```http
POST /api/v1/notifications/read-all
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "marked_count": 12
  },
  "message": "12 notifications marked as read",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 6.4 获取未读数量

```http
GET /api/v1/notifications/unread-count
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "total": 12,
    "by_type": {
      "SYSTEM": 2,
      "TASK": 5,
      "RISK": 3,
      "REWARD": 2
    }
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

### 7. Dashboard 服务

#### 7.1 获取大盘概览

```http
GET /api/v1/dashboard/overview
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "total_offers": 150,
      "active_offers": 35,
      "total_ads_accounts": 12,
      "active_ads_accounts": 10,
      "total_spend_7d": 1256.50,
      "total_revenue_7d": 2950.00,
      "avg_roas_7d": 2.35,
      "health_score": 88
    },
    "risk_alerts": [
      {
        "id": "risk_123",
        "severity": "HIGH",
        "type": "BUDGET_LOW",
        "title": "2 个 Ads 账号预算不足",
        "description": "Nike US 2, Survey US 3",
        "action_url": "/adscenter?filter=budget_low"
      }
    ],
    "top_offers": [
      {
        "id": "offer_abc123",
        "brand_name": "Nike Shoes",
        "roas": 3.85,
        "spend_7d": 320.50,
        "revenue_7d": 1234.00,
        "health_score": 95
      }
    ],
    "recent_tasks": [
      {
        "id": "task_123",
        "type": "EVALUATION",
        "status": "COMPLETED",
        "offer_brand": "Nike Shoes",
        "completed_at": "2024-10-03T12:00:00Z"
      }
    ],
    "trends": {
      "roas_trend_7d": [2.1, 2.3, 2.5, 2.4, 2.6, 2.3, 2.35],
      "spend_trend_7d": [150, 180, 200, 190, 210, 180, 175]
    }
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 7.2 获取数据趋势

```http
GET /api/v1/dashboard/trends
```

**Query 参数:**
```
?metric=ROAS          # ROAS, SPEND, REVENUE, CLICKS, IMPRESSIONS
&period=7D            # 1D, 7D, 30D, 90D
&offer_id=offer_123   # 可选，筛选特定 Offer
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "metric": "ROAS",
    "period": "7D",
    "data_points": [
      {
        "date": "2024-09-27",
        "value": 2.1
      },
      {
        "date": "2024-09-28",
        "value": 2.3
      },
      {
        "date": "2024-10-03",
        "value": 2.35
      }
    ],
    "summary": {
      "avg": 2.35,
      "max": 2.6,
      "min": 2.1,
      "trend": "STABLE"
    }
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

### 8. Tasks 服务

#### 8.1 获取任务列表

```http
GET /api/v1/tasks
```

**Query 参数:**
```
?page=1
&limit=20
&status=ALL          # ALL, QUEUED, IN_PROGRESS, COMPLETED, FAILED, CANCELLED
&type=ALL            # ALL, EVALUATION, CLICK_TASK, DEPLOYMENT, SYNC
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "task_123",
      "type": "EVALUATION",
      "status": "COMPLETED",
      "offer_id": "offer_abc123",
      "offer_brand": "Nike Shoes",
      "token_cost": 10,
      "token_reserved": 10,
      "token_consumed": 10,
      "token_refunded": 0,
      "progress": 100,
      "result": {
        "score": 85,
        "recommendation": "建议补充流量数据"
      },
      "created_at": "2024-10-03T12:00:00Z",
      "started_at": "2024-10-03T12:00:05Z",
      "completed_at": "2024-10-03T12:00:15Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 250,
    "total_pages": 13,
    "has_next": true,
    "has_prev": false
  },
  "summary": {
    "queued": 5,
    "in_progress": 3,
    "completed_today": 15,
    "failed_today": 1
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 8.2 获取单个任务详情

```http
GET /api/v1/tasks/{task_id}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "task_123",
    "type": "EVALUATION",
    "status": "IN_PROGRESS",
    "offer_id": "offer_abc123",
    "offer_brand": "Nike Shoes",
    "token_cost": 10,
    "token_reserved": 10,
    "token_consumed": 0,
    "progress": 70,
    "current_step": "AI 分析内容",
    "logs": [
      {
        "timestamp": "2024-10-03T12:00:05Z",
        "message": "开始评估"
      },
      {
        "timestamp": "2024-10-03T12:00:07Z",
        "message": "解析 URL 完成"
      },
      {
        "timestamp": "2024-10-03T12:00:12Z",
        "message": "访问落地页完成，耗时 2.3s"
      }
    ],
    "created_at": "2024-10-03T12:00:00Z",
    "started_at": "2024-10-03T12:00:05Z",
    "estimated_completion": "2024-10-03T12:00:15Z"
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 8.3 取消任务

```http
POST /api/v1/tasks/{task_id}/cancel
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "task_id": "task_123",
    "status": "CANCELLED",
    "token_refunded": 10
  },
  "message": "Task cancelled, 10 tokens refunded",
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

#### 8.4 获取任务统计

```http
GET /api/v1/tasks/stats
```

**Query 参数:**
```
?period=7D  # 1D, 7D, 30D
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "period": "7D",
    "total_tasks": 150,
    "by_status": {
      "COMPLETED": 120,
      "FAILED": 5,
      "CANCELLED": 2,
      "IN_PROGRESS": 3,
      "QUEUED": 20
    },
    "by_type": {
      "EVALUATION": 80,
      "CLICK_TASK": 40,
      "DEPLOYMENT": 20,
      "SYNC": 10
    },
    "tokens_consumed": 1200,
    "tokens_refunded": 50,
    "avg_duration": {
      "EVALUATION": 9.8,
      "CLICK_TASK": 86400,
      "DEPLOYMENT": 120
    },
    "success_rate": 0.96
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

## ❌ 错误处理

### 标准错误格式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "additional context"
    }
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

### 常见错误码

| HTTP 状态码 | 错误码                   | 说明                   |
| ----------- | ------------------------ | ---------------------- |
| 400         | INVALID_REQUEST          | 请求参数无效           |
| 400         | INVALID_URL              | URL 格式无效           |
| 401         | UNAUTHORIZED             | 未授权，Token 无效     |
| 403         | FORBIDDEN                | 权限不足               |
| 404         | NOT_FOUND                | 资源不存在             |
| 409         | ALREADY_EXISTS           | 资源已存在             |
| 409         | INSUFFICIENT_TOKENS      | Token 余额不足         |
| 422         | VALIDATION_FAILED        | 数据验证失败           |
| 429         | RATE_LIMIT_EXCEEDED      | 请求频率超限           |
| 500         | INTERNAL_SERVER_ERROR    | 服务器内部错误         |
| 503         | SERVICE_UNAVAILABLE      | 服务暂时不可用         |

### 错误响应示例

**Token 余额不足:**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_TOKENS",
    "message": "Token 余额不足，需要 10 Token，当前余额 5 Token",
    "details": {
      "required": 10,
      "available": 5,
      "purchase_url": "/billing/tokens/purchase"
    }
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

**请求频率超限:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "请求频率超限，请稍后再试",
    "details": {
      "limit": 100,
      "remaining": 0,
      "reset_at": "2024-10-03T14:00:00Z"
    }
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

**数据验证失败:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "数据验证失败",
    "details": {
      "fields": [
        {
          "field": "offer_url",
          "error": "URL 格式无效"
        },
        {
          "field": "country_code",
          "error": "国家代码必须为 2 个字母"
        }
      ]
    }
  },
  "timestamp": "2024-10-03T13:30:00Z"
}
```

---

## 🚦 限流与配额

### 限流策略

**基于用户级别的限流:**

| 套餐       | 请求频率 (每分钟) | 并发评估任务 | 并发补点击任务 |
| ---------- | ----------------- | ------------ | -------------- |
| 免费版     | 60                | 2            | 1              |
| 专业版     | 300               | 10           | 5              |
| 企业版     | 1000              | 50           | 20             |

**限流 Headers:**

每个响应都会包含限流信息：

```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 285
X-RateLimit-Reset: 1696338000
```

### 套餐配额

**免费版:**
```json
{
  "max_offers": 5,
  "monthly_tokens": 100,
  "max_ads_accounts": 2,
  "max_concurrent_evaluations": 2,
  "max_concurrent_click_tasks": 1
}
```

**专业版:**
```json
{
  "max_offers": 50,
  "monthly_tokens": 1000,
  "max_ads_accounts": 10,
  "max_concurrent_evaluations": 10,
  "max_concurrent_click_tasks": 5
}
```

**企业版:**
```json
{
  "max_offers": -1,
  "monthly_tokens": 10000,
  "max_ads_accounts": -1,
  "max_concurrent_evaluations": 50,
  "max_concurrent_click_tasks": 20
}
```

---

## 📊 总结

### API 设计亮点

✅ **统一规范** - 统一的 URL 结构、请求/响应格式
✅ **清晰错误** - 详细的错误码和错误信息
✅ **分页友好** - 标准的分页参数和响应
✅ **实时反馈** - 任务进度查询和 WebSocket 推送
✅ **Token 透明** - 明确的 Token 消耗和余额管理
✅ **限流保护** - 基于套餐的请求频率和并发控制

### 核心服务 API 总结

1. **Offer 服务** - 9 个端点，支持 CRUD、批量操作、投放、查看关联
2. **SiteRank 服务** - 3 个端点，支持单个/批量评估、进度查询
3. **AdsCenter 服务** - 7 个端点，支持 OAuth、账号管理、预算转移
4. **BatchOpen 服务** - 3 个端点，支持补点击启动、进度查询
5. **Billing 服务** - 9 个端点，支持订阅管理、Token 购买、签到
6. **Notifications 服务** - 4 个端点，支持通知列表、已读标记
7. **Dashboard 服务** - 2 个端点，支持概览数据、趋势分析
8. **Tasks 服务** - 4 个端点，支持任务列表、详情、取消、统计

**关键变更（v2.0）:**
- ✅ 补点击接口简化，仅需 target_clicks + duration_hours
- ✅ 补点击进度不返回 ROAS、revenue、conversions
- ✅ 新增投放接口 POST /api/v1/offers/{id}/deploy
- ✅ 投放操作建立 Offer ←→ Ads Account 关联关系

---

**文档版本**: v2.0
**最后更新**: 2024-10-03
**维护者**: AdsAI 后端开发团队
