# 用户Dashboard Stats 获取失败问题修复

## 问题描述
访问 https://www.urlchecker.dev/dashboard （**用户Dashboard**，非管理后台）时出现 "Failed to fetch dashboard stats" 错误。

## 架构说明
系统有两个独立的Dashboard：
1. **用户Dashboard** (`/dashboard`) - 普通用户查看自己的数据
2. **管理后台** (`/manage`) - 管理员查看全局统计

本次修复针对的是**用户Dashboard**。

## 根本原因分析

### 1. API端点不匹配
**前端调用**: `/api/v1/dashboard/stats`  
**后端实现**: 端点未实现，返回 501 Not Implemented

### 2. 端点定义存在但未实现
- OpenAPI规范中定义了 `/api/v1/console/dashboard/stats`
- 但 `GetDashboardStats` 方法只有空实现，返回 `StatusNotImplemented`
- 路由已注册但handler未实现

### 3. 前端使用了错误的端点
前端代码使用了 `/api/v1/dashboard/stats`，但正确的端点应该是 `/api/v1/console/dashboard/stats`

## 修复方案

### 1. 修复前端API调用 ✅
**文件**: `apps/frontend/src/components/dashboard/DashboardAggregates.tsx`

```typescript
// 修复前
const response = await fetch('/api/v1/dashboard/stats', {

// 修复后  
const response = await fetch('/api/v1/console/dashboard/stats', {
```

### 2. 实现后端Handler ✅
**文件**: `services/console/internal/handlers/dashboard_handlers.go`

创建了完整的 `GetDashboardStats` 实现，包括:
- 用户Offer统计
- AI评估统计
- Token余额
- 平均分数计算
- 广告账号统计
- 最近评估记录

### 3. 注册路由 ✅
**文件**: `services/console/internal/handlers/http.go`

```go
mux.Handle("/api/v1/console/dashboard/stats", 
    middleware.AuthMiddleware(http.HandlerFunc(h.GetDashboardStats)))
```

## 实现细节

### Dashboard Stats 数据结构

```typescript
interface DashboardStats {
  userId: string;
  totalOffers: number;
  evaluatedOffers: number;
  pendingEvaluations: number;
  evaluatedToday?: number;
  avgScore?: string;              // "A+", "B", etc.
  scoreTrend?: 'up' | 'down' | 'stable';
  aiEvaluationsTotal: number;
  aiEvaluationsSuccess: number;
  aiEvaluationsFailed: number;
  tokensTotal: number;
  tokensConsumed: number;
  tokensRemaining: number;
  adsAccounts?: {
    totalAccounts: number;
    activeAccounts: number;
    pendingAuthorization: number;
    offersCoverage: number;
  };
  recentEvaluations: Array<{
    id: string;
    offerId: string;
    type: string;
    status: string;
    tokensConsumed: number;
    brandName?: string;
    domain?: string;
    aiScore?: number;
    completedAt?: string;
    createdAt: string;
  }>;
  lastUpdated: string;
}
```

### 数据库查询

Handler从以下表查询数据:
- `Offer` - Offer统计和评估记录
- `UserToken` - Token余额
- `AdsAccount` - 广告账号统计（可选）

### 权限控制

- 使用 `AuthMiddleware` 确保用户已认证（不需要管理员权限）
- 从context中获取 `user_id`
- 只返回当前用户的数据（数据隔离）
- 与管理后台的 `AdminOnly` 权限不同

### 与管理后台的区别

| 特性 | 用户Dashboard | 管理后台 |
|------|--------------|---------|
| 路径 | `/dashboard` | `/manage` |
| API | `/api/v1/console/dashboard/stats` | `/api/v1/console/stats` |
| 权限 | 登录用户 | 管理员 |
| 数据范围 | 当前用户 | 全局统计 |
| 组件 | `DashboardAggregates.tsx` | `AdminDashboard.tsx` |

## 测试验证

### 1. 本地测试
```bash
# 启动console服务
cd services/console
go run cmd/server/main.go

# 测试端点
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/console/dashboard/stats
```

### 2. 预期响应
```json
{
  "userId": "user-123",
  "totalOffers": 10,
  "evaluatedOffers": 7,
  "pendingEvaluations": 3,
  "evaluatedToday": 2,
  "avgScore": "B+",
  "scoreTrend": "stable",
  "aiEvaluationsTotal": 7,
  "aiEvaluationsSuccess": 6,
  "aiEvaluationsFailed": 1,
  "tokensRemaining": 850,
  "tokensTotal": 1000,
  "tokensConsumed": 150,
  "recentEvaluations": [...],
  "lastUpdated": "2025-10-18T10:30:00Z"
}
```

## 部署步骤

### 1. 部署后端
```bash
# 构建console服务
cd services/console
docker build -t console:latest .

# 部署到Cloud Run
gcloud run deploy console \
  --image console:latest \
  --region asia-northeast1
```

### 2. 部署前端
```bash
# 构建前端
cd apps/frontend
npm run build

# 部署到Cloud Run
gcloud run deploy frontend \
  --source . \
  --region asia-northeast1
```

### 3. 验证
访问 https://www.urlchecker.dev/dashboard 确认数据正常加载

## 相关文件

### 修改的文件
1. `apps/frontend/src/components/dashboard/DashboardAggregates.tsx` - 修复API端点
2. `services/console/internal/handlers/dashboard_handlers.go` - 新增handler实现
3. `services/console/internal/handlers/http.go` - 注册路由

### 相关文档
- `docs/DASHBOARD_307_REDIRECT_ANALYSIS.md` - Dashboard重定向分析
- `apps/frontend/src/lib/api/endpoints.ts` - API端点定义
- `services/console/internal/oapi/server.gen.go` - OpenAPI生成的接口

## 注意事项

### 1. 用户认证
- 端点需要有效的JWT token
- Token通过 `Authorization: Bearer` header传递
- Middleware会验证token并提取user_id

### 2. 性能考虑
- 查询已优化，使用索引字段
- 考虑添加缓存（5分钟TTL）
- 前端已实现5分钟自动刷新

### 3. 错误处理
- 数据库查询失败返回0值而不是错误
- 可选字段（如adsAccounts）只在有数据时返回
- 前端有完整的错误处理和重试机制

## 后续优化

### 短期（1-2周）
- [ ] 添加Redis缓存减少数据库查询
- [ ] 实现scoreTrend计算逻辑
- [ ] 跟踪实际token消耗量

### 中期（1个月）
- [ ] 添加更多维度的统计数据
- [ ] 实现实时数据推送（WebSocket/SSE）
- [ ] 优化查询性能（物化视图）

### 长期（3个月）
- [ ] 迁移到专门的分析服务
- [ ] 实现自定义Dashboard配置
- [ ] 添加数据导出功能
