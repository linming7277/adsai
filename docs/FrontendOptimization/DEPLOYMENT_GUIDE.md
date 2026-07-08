# 部署指南 - Admin System & Package B Dashboard

**日期**: 2025-10-09
**范围**: Package B Dashboard + Admin System (Phase 1 + Phase 2)
**状态**: ✅ Ready for Deployment

**Phase 1**: Token Rules + Dashboard
**Phase 2**: 路径重命名 + 迁移 Job + 套餐管理 + 动态配置

---

## 📋 部署清单

### 1️⃣ **数据库迁移**

**推荐方式: 使用 Cloud Run Jobs (Phase 2 新增)**

```bash
# 通过 Cloud Build 自动部署并执行迁移
cd services/console
gcloud builds submit --config cloudbuild.migrate.yaml

# 或使用便捷脚本
./scripts/run-migrations.sh cloud
```

**手动方式 (仅开发环境)**:

```bash
# 位置: services/console/migrations/003_create_token_rules_table.sql
psql $DATABASE_URL -f services/console/migrations/003_create_token_rules_table.sql
```

**迁移内容**:
- ✅ 创建 `token_consumption_rules` 表
- ✅ 添加 3 个性能索引 (service_name, enabled, updated_at)
- ✅ 添加自动更新 `updated_at` 触发器
- ✅ 插入 6 条初始规则数据
- ✅ 软删除支持 (`enabled` 字段)

**验证迁移成功**:
```sql
-- 应返回 6 条记录
SELECT service_name, action_type, cost_per_unit, enabled
FROM token_consumption_rules
ORDER BY service_name;
```

预期输出:
```
service_name | action_type       | cost_per_unit | enabled
-------------|-------------------|---------------|--------
adscenter    | ad_query          | 1             | true
adscenter    | bulk_sync         | 10            | true
batchopen    | batch_open_url    | 1             | true
offer        | offer_query       | 2             | true
siterank     | basic_evaluation  | 1             | true
siterank     | ai_evaluation     | 3             | true
```

---

### 2️⃣ **Console Service 部署**

**修改文件汇总**:
```
services/console/
├── internal/handlers/
│   ├── http.go             (修改) - 移除重复代码，更新路由注释
│   └── token_rules.go      (新增) - Token规则完整CRUD API
├── migrations/
│   └── 003_create_token_rules_table.sql (新增)
└── static/admin/
    ├── index.html          (修改) - 添加Token规则入口链接
    └── token-rules.html    (新增) - Token规则管理UI
```

**部署步骤**:

```bash
# 1. 编译验证
cd services/console
go build -o console .

# 2. 运行测试 (如果有)
go test ./internal/handlers/...

# 3. 部署到 Cloud Run
gcloud builds submit --config cloudbuild.yaml

# 4. 验证部署
curl -H "Authorization: Bearer $TOKEN" \
  https://console.example.com/api/v1/console/tokens/rules
```

**预期响应**:
```json
{
  "items": [
    {
      "id": "uuid-here",
      "serviceName": "siterank",
      "actionType": "basic_evaluation",
      "costPerUnit": 1,
      "description": "Offer基础评估 - SimilarWeb数据分析",
      "enabled": true,
      "createdAt": "2025-10-09T...",
      "updatedAt": "2025-10-09T..."
    },
    ...
  ],
  "total": 6
}
```

---

### 3️⃣ **Frontend Dashboard 部署**

**修改文件汇总**:
```
apps/frontend/
├── lib/dashboard/
│   ├── types.ts            (修改) - 添加 ConsoleDashboardData 类型定义
│   └── hooks.ts            (修改) - 添加 useConsoleDashboard() hook
├── app/dashboard/[organization]/
│   ├── components/
│   │   └── ConsoleDashboard.tsx  (新增) - Console服务仪表盘组件
│   └── page.tsx            (修改) - 添加环境变量开关
└── .env.local              (需配置)
```

**环境变量配置**:

```bash
# apps/frontend/.env.local
NEXT_PUBLIC_USE_CONSOLE_DASHBOARD=true  # 启用新仪表盘
NEXT_PUBLIC_API_BASE_URL=https://console.example.com  # Console服务地址
```

**部署步骤**:

```bash
# 1. 安装依赖
cd apps/frontend
npm install

# 2. 本地开发验证
npm run dev
# 访问 http://localhost:3000/dashboard/[org] 验证新仪表盘

# 3. 构建生产版本
npm run build

# 4. 部署到 Vercel/Cloud Run
npm run deploy
```

**回滚方案**:
如果新仪表盘有问题，设置环境变量回退到旧版本:
```bash
NEXT_PUBLIC_USE_CONSOLE_DASHBOARD=false
```

---

## 🧪 测试验证

### **Admin System - Token Rules**

**1. 访问管理页面**:
```
https://console.example.com/console/admin/index.html
→ 点击 "Token规则" 链接
→ 应显示 6 条初始规则
```

**2. 测试创建规则**:
- 服务名称: `billing`
- 操作类型: `subscription_query`
- Token消耗: `1`
- 说明: `查询订阅套餐信息`
- 点击"创建规则" → 应成功创建并刷新列表

**3. 测试编辑规则**:
- 点击任意规则的"编辑"按钮
- 修改 Token 消耗数量 → 应立即生效

**4. 测试禁用规则**:
- 点击"禁用"按钮 → 规则状态变为 "✗ 禁用"
- 统计卡片中"启用规则"数量应减 1

**5. API 测试**:
```bash
# 获取所有规则
curl -H "Authorization: Bearer $TOKEN" \
  https://console.example.com/api/v1/console/tokens/rules

# 仅获取启用规则
curl -H "Authorization: Bearer $TOKEN" \
  "https://console.example.com/api/v1/console/tokens/rules?enabledOnly=true"

# 按服务筛选
curl -H "Authorization: Bearer $TOKEN" \
  "https://console.example.com/api/v1/console/tokens/rules?service=siterank"

# 创建新规则
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "billing",
    "actionType": "subscription_query",
    "costPerUnit": 1,
    "description": "查询订阅套餐信息"
  }' \
  https://console.example.com/api/v1/console/tokens/rules

# 更新规则
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"costPerUnit": 2, "enabled": false}' \
  https://console.example.com/api/v1/console/tokens/rules/{rule-id}
```

---

### **Package B - Dashboard**

**1. 访问仪表盘**:
```
https://example.com/dashboard/[your-org]
→ 应显示新的 Console Dashboard
→ 包含 4 个 KPI 卡片: Offers, Tokens, Accounts, ROAS
```

**2. 验证数据加载**:
- 打开浏览器开发者工具 Console
- 应看到日志: `[Dashboard] Loaded dashboard data`
- 数据应在 30 秒内自动刷新

**3. 测试快捷操作**:
- 点击"创建 Offer" → 应跳转到 Offer 创建页
- 点击"充值 Token" → 应跳转到充值页
- 点击"连接 Ads 账户" → 应跳转到账户管理页

**4. 测试部分服务故障**:
- 如果某个后端服务（如 Offer/Billing）失败
- 应显示黄色警告横幅，但仍显示其他服务数据
- 不应阻塞整个页面渲染

**5. 性能验证**:
```javascript
// 在浏览器 Console 执行
performance.getEntriesByType('navigation')[0].duration
// 应 < 2000ms (首屏加载时间)

// 检查 SWR 缓存
window.__SWR_CACHE__
// 应包含 'console-dashboard' 键
```

---

## 📊 监控指标

部署后需监控以下指标:

### **Backend Metrics**

```promql
# Console Service API 延迟
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket{
    service="console",
    path=~"/api/v1/console/tokens/rules.*"
  }[5m])
)
# 目标: < 200ms

# Token Rules API 错误率
rate(http_requests_total{
  service="console",
  path=~"/api/v1/console/tokens/rules.*",
  status=~"5.."
}[5m])
# 目标: < 1%

# Dashboard Aggregation API 延迟
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket{
    service="console",
    path="/api/v1/console/dashboard/:userId"
  }[5m])
)
# 目标: < 500ms (包含多服务调用)
```

### **Frontend Metrics**

通过 Vercel Analytics / Google Analytics 监控:
- **Dashboard Load Time**: < 2s (LCP)
- **SWR Cache Hit Rate**: > 80%
- **API Error Rate**: < 2%
- **User Engagement**: 点击率、停留时间

---

## 🚨 故障排查

### **问题 1: Token Rules API 返回 500**

**症状**: 访问 `/api/v1/console/tokens/rules` 返回 500 错误

**排查步骤**:
```bash
# 1. 检查数据库迁移是否成功
psql $DATABASE_URL -c "SELECT COUNT(*) FROM token_consumption_rules;"
# 应返回 6

# 2. 检查 Console Service 日志
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=console" --limit 50

# 3. 验证数据库连接
psql $DATABASE_URL -c "SELECT version();"
```

**常见原因**:
- ❌ 迁移未执行 → 手动执行 `003_create_token_rules_table.sql`
- ❌ 数据库权限不足 → 检查 Cloud SQL IAM 权限
- ❌ `enabled` 字段缺失 → 执行 `ALTER TABLE token_consumption_rules ADD COLUMN enabled BOOLEAN DEFAULT TRUE;`

---

### **问题 2: Dashboard 不显示数据**

**症状**: ConsoleDashboard 显示空白或加载中

**排查步骤**:
```bash
# 1. 检查环境变量
echo $NEXT_PUBLIC_USE_CONSOLE_DASHBOARD  # 应为 true
echo $NEXT_PUBLIC_API_BASE_URL           # 应为 Console 服务地址

# 2. 测试 Dashboard API
curl -H "Authorization: Bearer $TOKEN" \
  https://console.example.com/api/v1/console/dashboard/{user-id}

# 3. 检查浏览器 Console 错误
# 打开开发者工具 → Console → 查找红色错误
```

**常见原因**:
- ❌ 用户未认证 → 检查 Supabase Session
- ❌ CORS 配置错误 → 检查 Console Service CORS 设置
- ❌ API 超时 → 检查后端服务（Offer/Billing/Adscenter）健康状态

---

### **问题 3: 统计数据不准确**

**症状**: Dashboard 显示的数字与实际不符

**排查步骤**:
```bash
# 1. 验证 Redis 缓存
redis-cli -h $REDIS_HOST -p $REDIS_PORT
> GET dashboard:{user-id}
> TTL dashboard:{user-id}  # 应 < 30 (30秒TTL)

# 2. 强制刷新缓存
curl -H "Authorization: Bearer $TOKEN" \
  "https://console.example.com/api/v1/console/dashboard/{user-id}?force=1"

# 3. 对比数据库原始数据
psql $DATABASE_URL -c "SELECT COUNT(*) FROM offers WHERE user_id = '{user-id}';"
```

**常见原因**:
- ❌ 缓存未过期 → 等待 30 秒或使用 `?force=1` 参数
- ❌ 后端服务返回旧数据 → 检查各服务的缓存策略
- ❌ 数据同步延迟 → 检查 Pub/Sub 消息队列

---

## 📝 完成清单

部署前最终检查:

### **Backend**
- [ ] ✅ 数据库迁移已在生产环境执行
- [ ] ✅ Console Service 已成功部署到 Cloud Run
- [ ] ✅ Token Rules API 返回正确数据 (6条初始规则)
- [ ] ✅ Admin 页面可访问并正常工作
- [ ] ✅ 日志无 ERROR 级别错误

### **Frontend**
- [ ] ✅ 环境变量已正确配置
- [ ] ✅ `npm run build` 成功通过
- [ ] ✅ Dashboard 页面正常显示
- [ ] ✅ SWR 自动刷新工作正常
- [ ] ✅ 快捷操作链接跳转正确

### **测试**
- [ ] ✅ 创建/编辑/禁用规则功能正常
- [ ] ✅ 统计卡片数据准确
- [ ] ✅ 部分服务失败时仍可用 (Partial Failure Tolerance)
- [ ] ✅ 性能指标符合目标 (Dashboard < 2s, API < 500ms)

### **监控**
- [ ] ✅ Grafana 仪表盘已添加新指标
- [ ] ✅ 告警规则已配置 (错误率 > 1%)
- [ ] ✅ 日志聚合正常工作

---

## 🎯 下一步

部署完成后的优化方向:

1. **Phase 2 - Admin Pages Enhancement** (Optional)
   - 创建套餐管理页面 (`packages.html`)
   - 创建动态配置页面 (`config.html`)
   - 添加批量操作功能

2. **Phase 3 - Advanced Features** (Future)
   - Token 规则历史版本追踪
   - 配置变更对比 (Diff Viewer)
   - 导出/导入规则 (JSON/CSV)

3. **Phase 4 - React Migration** (Low Priority)
   - 将 Admin 静态页面迁移到 React/Next.js
   - 统一前端技术栈

4. **Next Package**
   - Package C: Offers 列表增强
   - Package E: Navigation 路由简化

---

**文档版本**: v1.0
**最后更新**: 2025-10-09
**维护者**: Claude Code

如有问题，请参考:
- [Admin System Implementation Summary](./ADMIN_SYSTEM_IMPLEMENTATION_SUMMARY.md)
- [Package B Implementation Summary](./PACKAGE_B_IMPLEMENTATION_SUMMARY.md)
- [Frontend Design Complete](./FrontendDesignComplete_20251009.md)
