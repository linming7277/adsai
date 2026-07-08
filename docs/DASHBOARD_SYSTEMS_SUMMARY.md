# Dashboard 系统总结

## 系统概览

AutoAds 有两个独立的Dashboard系统，服务于不同的用户群体和用途。

## 1. 用户Dashboard（User Dashboard）

### 基本信息
- **URL**: `https://www.urlchecker.dev/dashboard`
- **用户**: 所有登录用户
- **用途**: 查看个人数据和操作

### 前端实现
```
apps/frontend/src/app/dashboard/
├── page.tsx                          # 路由入口
└── components/
    └── DashboardAggregates.tsx       # 主组件
```

### API端点
```
GET /api/v1/console/dashboard/stats
Authorization: Bearer <user_token>
```

### 后端实现
```
services/console/internal/handlers/
├── dashboard_handlers.go             # Handler实现
└── http.go                           # 路由注册
```

### 权限控制
```go
mux.Handle("/api/v1/console/dashboard/stats", 
    middleware.AuthMiddleware(http.HandlerFunc(h.GetDashboardStats)))
```
- ✅ 需要登录
- ❌ 不需要管理员权限
- 🔒 只能看自己的数据

### 数据内容
- 个人Offer统计（总数、已评估、待评估）
- 个人Token余额
- AI评估记录
- 个人广告账号
- 最近评估历史

### 实现状态
- ✅ 前端组件已实现
- ✅ API端点已修复（2025-10-18）
- ✅ 后端Handler已实现
- ✅ 路由已注册
- 🚀 待部署

---

## 2. 管理后台（Admin Dashboard）

### 基本信息
- **URL**: `https://www.urlchecker.dev/manage`
- **用户**: 仅管理员
- **用途**: 查看全局统计和系统管理

### 前端实现
```
apps/frontend/src/app/manage/
├── page.tsx                          # 路由入口
└── components/
    ├── AdminDashboard.tsx            # 主组件
    ├── DashboardMetricsCards.tsx     # 指标卡片
    ├── RecentActivityFeed.tsx        # 活动流
    └── SystemAlertsBanner.tsx        # 系统告警
```

### API端点
```
GET /api/v1/console/stats
Authorization: Bearer <admin_token>
```

### 后端实现
```
services/console/internal/handlers/
├── tokens_handlers.go                # getAdminStats()
└── http.go                           # 路由注册
```

### 权限控制
```go
mux.Handle("/api/v1/console/stats", 
    middleware.AuthMiddleware(
        middleware.AdminOnly(http.HandlerFunc(h.getAdminStats))))
```
- ✅ 需要登录
- ✅ 需要管理员权限
- 🌍 可以看全局数据

### 数据内容
- 全局用户统计
- 全局Offer统计
- 订阅统计
- Token总量
- 系统通知统计
- 最近活动记录

### 实现状态
- ✅ 前端组件已实现
- ✅ API端点已实现
- ✅ 后端Handler已实现
- ✅ 路由已注册
- ✅ 已部署运行

---

## 对比表格

| 特性 | 用户Dashboard | 管理后台 |
|------|--------------|---------|
| **路径** | `/dashboard` | `/manage` |
| **API端点** | `/api/v1/console/dashboard/stats` | `/api/v1/console/stats` |
| **前端组件** | `DashboardAggregates.tsx` | `AdminDashboard.tsx` |
| **后端Handler** | `GetDashboardStats()` | `getAdminStats()` |
| **Handler文件** | `dashboard_handlers.go` | `tokens_handlers.go` |
| **权限要求** | 登录用户 | 管理员 |
| **数据范围** | 当前用户 | 全局统计 |
| **访问频率** | 高频 | 低频 |
| **性能要求** | 高 | 中 |
| **缓存策略** | 5分钟 | 可选 |
| **实现状态** | ✅ 刚修复 | ✅ 已运行 |

---

## 数据查询对比

### 用户Dashboard查询
```sql
-- 只查询当前用户的数据
SELECT COUNT(*) FROM "Offer" 
WHERE "userId" = $1;

SELECT balance FROM "UserToken" 
WHERE "userId" = $1;

SELECT * FROM "Offer" 
WHERE "userId" = $1 
ORDER BY "updatedAt" DESC 
LIMIT 5;
```

### 管理后台查询
```sql
-- 查询所有用户的聚合数据
SELECT COUNT(*) FROM "User";

SELECT COUNT(*) FROM "Offer";

SELECT SUM(balance) FROM "UserToken";

SELECT COUNT(*) FROM "Subscription" 
WHERE status='active';
```

---

## API响应示例

### 用户Dashboard响应
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
  "adsAccounts": {
    "totalAccounts": 2,
    "activeAccounts": 2,
    "pendingAuthorization": 0,
    "offersCoverage": 80
  },
  "recentEvaluations": [
    {
      "id": "eval-1",
      "offerId": "offer-1",
      "type": "ai_evaluation",
      "status": "evaluated",
      "tokensConsumed": 1,
      "brandName": "Example Brand",
      "domain": "example.com",
      "aiScore": 85,
      "completedAt": "2025-10-18T10:00:00Z",
      "createdAt": "2025-10-18T09:55:00Z"
    }
  ],
  "lastUpdated": "2025-10-18T10:30:00Z"
}
```

### 管理后台响应
```json
{
  "counters": {
    "users": 1250,
    "offers": 5430,
    "subscriptionsActive": 320,
    "tokensTotal": 1500000,
    "notifications24h": 450,
    "siterankAnalyses": 3200,
    "batchopenTasks": 150
  },
  "updatedAt": "2025-10-18T10:30:00Z"
}
```

---

## 安全考虑

### 用户Dashboard
1. **数据隔离**: 严格限制只能访问自己的数据
2. **SQL注入防护**: 使用参数化查询
3. **认证检查**: 每次请求验证JWT token
4. **用户ID提取**: 从JWT claims中提取，不信任客户端传值

```go
// 从context获取user_id（由middleware设置）
userID, ok := ctx.Value("user_id").(string)
if !ok || userID == "" {
    return errors.Unauthorized()
}

// 所有查询都带上userId过滤
db.Query("SELECT * FROM Offer WHERE userId = $1", userID)
```

### 管理后台
1. **双重认证**: 登录 + 管理员角色验证
2. **审计日志**: 记录所有管理操作
3. **敏感数据**: 不返回用户密码等敏感信息
4. **访问控制**: AdminOnly middleware强制检查

```go
// AdminOnly middleware检查
func AdminOnly(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        role := r.Context().Value("user_role").(string)
        if role != "admin" {
            http.Error(w, "Forbidden", http.StatusForbidden)
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

---

## 性能优化

### 用户Dashboard
- ✅ 前端5分钟自动刷新
- ✅ 查询使用索引字段（userId）
- 🔄 考虑添加Redis缓存（5分钟TTL）
- 🔄 考虑使用物化视图

### 管理后台
- ✅ 按需加载（不自动刷新）
- ✅ 容忍部分查询失败（返回-1）
- ✅ 可选表查询（如果不存在跳过）
- 🔄 可以添加更长的缓存时间

---

## 测试验证

### 用户Dashboard测试
```bash
# 1. 获取用户token
USER_TOKEN=$(curl -X POST https://www.urlchecker.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r '.token')

# 2. 测试Dashboard API
curl -H "Authorization: Bearer $USER_TOKEN" \
  https://www.urlchecker.dev/api/v1/console/dashboard/stats

# 3. 验证返回数据只包含该用户的信息
```

### 管理后台测试
```bash
# 1. 获取管理员token
ADMIN_TOKEN=$(curl -X POST https://www.urlchecker.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@autoads.dev","password":"admin_password"}' \
  | jq -r '.token')

# 2. 测试管理后台API
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://www.urlchecker.dev/api/v1/console/stats

# 3. 验证返回全局统计数据
```

### 权限测试
```bash
# 用普通用户token访问管理后台（应该403）
curl -H "Authorization: Bearer $USER_TOKEN" \
  https://www.urlchecker.dev/api/v1/console/stats
# Expected: 403 Forbidden

# 用管理员token访问用户Dashboard（应该成功，但只看到管理员自己的数据）
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://www.urlchecker.dev/api/v1/console/dashboard/stats
# Expected: 200 OK (admin's personal data)
```

---

## 部署清单

### 用户Dashboard部署
- [ ] 部署Console Service（包含新的dashboard_handlers.go）
- [ ] 部署Frontend（包含修复的API端点）
- [ ] 验证 `/dashboard` 页面正常加载
- [ ] 验证数据只显示当前用户的内容
- [ ] 监控API响应时间

### 管理后台验证
- [x] 确认 `/manage` 页面正常运行
- [x] 确认只有管理员可以访问
- [x] 确认显示全局统计数据
- [x] 确认所有指标卡片正常显示

---

## 相关文档

1. [Dashboard架构说明](./DASHBOARD_ARCHITECTURE_CLARIFICATION.md)
2. [用户Dashboard修复记录](./DASHBOARD_STATS_ISSUE_FIX.md)
3. [Console Service部署指南](../services/console/DEPLOYMENT_GUIDE.md)
4. [API端点定义](../apps/frontend/src/lib/api/endpoints.ts)

---

## 未来优化建议

### 短期（1-2周）
1. 为用户Dashboard添加Redis缓存
2. 优化数据库查询性能
3. 添加更多用户维度的统计

### 中期（1个月）
1. 实现实时数据推送（WebSocket）
2. 添加自定义Dashboard配置
3. 实现数据导出功能

### 长期（3个月）
1. 考虑拆分为独立的Analytics服务
2. 实现更复杂的数据分析功能
3. 添加数据可视化图表
