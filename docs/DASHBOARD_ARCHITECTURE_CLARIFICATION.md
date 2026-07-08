# Dashboard 架构说明

## 两个独立的Dashboard系统

### 1. 用户Dashboard（User Dashboard）
**路径**: `/dashboard`  
**前端**: `apps/frontend/src/app/dashboard/`  
**组件**: `DashboardAggregates.tsx`  
**用途**: 普通用户查看自己的数据

**API端点**: `/api/v1/console/dashboard/stats`  
**权限**: 需要登录，只能看自己的数据  
**数据范围**: 
- 当前用户的Offers
- 当前用户的Token余额
- 当前用户的AI评估记录
- 当前用户的广告账号

### 2. 管理后台Dashboard（Admin Dashboard）
**路径**: `/manage`  
**前端**: `apps/frontend/src/app/manage/`  
**组件**: `AdminDashboard.tsx`  
**用途**: 管理员查看全局统计数据

**API端点**: `/api/v1/console/stats`  
**权限**: 需要管理员权限（AdminOnly middleware）  
**数据范围**:
- 所有用户统计
- 所有Offers统计
- 所有订阅统计
- 系统级指标

## 当前问题分析

### 问题
用户访问 `https://www.urlchecker.dev/dashboard` 时出现 "Failed to fetch dashboard stats"

### 根本原因
用户Dashboard调用的端点 `/api/v1/console/dashboard/stats` 之前没有实现。

### 混淆点
- Console Service 既服务于**管理后台**，也服务于**用户Dashboard**
- 两个Dashboard都调用Console Service的不同端点
- 端点命名容易混淆：
  - `/api/v1/console/stats` → 管理后台用
  - `/api/v1/console/dashboard/stats` → 用户Dashboard用

## 正确的架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (apps/frontend)                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │  User Dashboard      │      │  Admin Dashboard     │    │
│  │  /dashboard          │      │  /manage             │    │
│  │                      │      │                      │    │
│  │  DashboardAggregates │      │  AdminDashboard      │    │
│  └──────────┬───────────┘      └──────────┬───────────┘    │
│             │                               │                │
└─────────────┼───────────────────────────────┼────────────────┘
              │                               │
              │ GET /api/v1/console/         │ GET /api/v1/console/
              │     dashboard/stats          │     stats
              │ (user-specific)              │ (admin-only)
              │                               │
┌─────────────┴───────────────────────────────┴────────────────┐
│                    Console Service                            │
│                 (services/console)                            │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Handler: GetDashboardStats()    Handler: getAdminStats()   │
│  - Auth: User (any logged in)    - Auth: AdminOnly          │
│  - Scope: Current user only       - Scope: All users        │
│  - Data: User's offers, tokens    - Data: System metrics    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## API端点对比

### 用户Dashboard API
```http
GET /api/v1/console/dashboard/stats
Authorization: Bearer <user_token>

Response:
{
  "userId": "current-user-id",
  "totalOffers": 10,
  "evaluatedOffers": 7,
  "pendingEvaluations": 3,
  "tokensRemaining": 850,
  "aiEvaluationsTotal": 7,
  "recentEvaluations": [...]
}
```

**特点**:
- 只返回当前用户的数据
- 从JWT token中提取user_id
- 不需要管理员权限

### 管理后台API
```http
GET /api/v1/console/stats
Authorization: Bearer <admin_token>

Response:
{
  "counters": {
    "users": 1250,
    "offers": 5430,
    "subscriptionsActive": 320,
    "tokensTotal": 1500000,
    "notifications24h": 450
  },
  "updatedAt": "2025-10-18T10:30:00Z"
}
```

**特点**:
- 返回全局统计数据
- 需要管理员权限
- 聚合所有用户的数据

## 实现状态

### ✅ 已实现
1. 管理后台API (`/api/v1/console/stats`)
   - Handler: `getAdminStats()` in `tokens_handlers.go`
   - 权限: AdminOnly
   - 状态: 已实现并运行

2. 用户Dashboard API (`/api/v1/console/dashboard/stats`)
   - Handler: `GetDashboardStats()` in `dashboard_handlers.go`
   - 权限: AuthMiddleware (任何登录用户)
   - 状态: **刚刚实现**

### 前端组件
1. ✅ 用户Dashboard: `apps/frontend/src/app/dashboard/page.tsx`
2. ✅ 管理后台: `apps/frontend/src/app/manage/page.tsx`

## 命名建议（未来优化）

为了避免混淆，建议重命名：

### 当前命名
- `/api/v1/console/stats` → 管理后台
- `/api/v1/console/dashboard/stats` → 用户Dashboard

### 建议命名
- `/api/v1/console/admin/stats` → 管理后台（更明确）
- `/api/v1/console/user/dashboard` → 用户Dashboard（更明确）

或者：
- `/api/v1/admin/stats` → 管理后台
- `/api/v1/user/dashboard` → 用户Dashboard

## 权限控制

### 用户Dashboard
```go
mux.Handle("/api/v1/console/dashboard/stats", 
    middleware.AuthMiddleware(http.HandlerFunc(h.GetDashboardStats)))
```
- 只需要登录
- 自动从JWT获取user_id
- 只返回该用户的数据

### 管理后台
```go
mux.Handle("/api/v1/console/stats", 
    middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getAdminStats))))
```
- 需要登录 + 管理员角色
- 返回全局数据

## 数据隔离

### 用户Dashboard查询示例
```sql
-- 只查询当前用户的数据
SELECT COUNT(*) FROM "Offer" WHERE "userId" = $1
SELECT balance FROM "UserToken" WHERE "userId" = $1
```

### 管理后台查询示例
```sql
-- 查询所有用户的聚合数据
SELECT COUNT(*) FROM "User"
SELECT COUNT(*) FROM "Offer"
SELECT SUM(balance) FROM "UserToken"
```

## 部署注意事项

1. **用户Dashboard** (`/dashboard`)
   - 面向所有用户
   - 高频访问
   - 需要考虑缓存策略
   - 性能要求高

2. **管理后台** (`/manage`)
   - 仅管理员访问
   - 低频访问
   - 可以接受稍慢的响应
   - 数据准确性优先

## 测试验证

### 测试用户Dashboard
```bash
# 以普通用户身份登录
curl -H "Authorization: Bearer $USER_TOKEN" \
  https://www.urlchecker.dev/api/v1/console/dashboard/stats

# 应该返回该用户的数据
```

### 测试管理后台
```bash
# 以管理员身份登录
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://www.urlchecker.dev/api/v1/console/stats

# 应该返回全局统计数据
```

## 相关文件

### 用户Dashboard
- Frontend: `apps/frontend/src/app/dashboard/page.tsx`
- Component: `apps/frontend/src/components/dashboard/DashboardAggregates.tsx`
- Backend: `services/console/internal/handlers/dashboard_handlers.go`
- Route: `services/console/internal/handlers/http.go` (line ~155)

### 管理后台
- Frontend: `apps/frontend/src/app/manage/page.tsx`
- Component: `apps/frontend/src/app/manage/components/AdminDashboard.tsx`
- Backend: `services/console/internal/handlers/tokens_handlers.go` (`getAdminStats`)
- Route: `services/console/internal/handlers/http.go` (line ~152)
