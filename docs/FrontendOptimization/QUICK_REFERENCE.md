# Quick Reference - Admin System & Package B

**快速参考卡片** | **最后更新**: 2025-10-09

---

## 🔗 API Endpoints

### **Token Consumption Rules**

```bash
# 获取所有规则
GET /api/v1/console/tokens/rules
Query: ?enabledOnly=true&service=siterank

# 创建规则
POST /api/v1/console/tokens/rules
Body: {
  "serviceName": "siterank",      # 必填
  "actionType": "basic_evaluation", # 必填
  "costPerUnit": 1,                # 必填, > 0
  "description": "说明",            # 可选
  "enabled": true                  # 可选, 默认true
}

# 获取单个规则
GET /api/v1/console/tokens/rules/{id}

# 更新规则
PUT /api/v1/console/tokens/rules/{id}
Body: {
  "costPerUnit": 2,      # 可选
  "description": "新说明", # 可选
  "enabled": false       # 可选
}

# 软删除规则
DELETE /api/v1/console/tokens/rules/{id}
# 实际执行: UPDATE ... SET enabled = FALSE
```

### **Dashboard Aggregation**

```bash
# 获取用户仪表盘数据
GET /api/v1/console/dashboard/{userId}
Query: ?force=1  # 强制刷新缓存

Response: {
  "userId": "uuid",
  "offers": {
    "total": 42,
    "active": 30,
    "paused": 12,
    "recent": [...],
    "topKpi": { "offerId": "...", "roas": 3.5 }
  },
  "tokens": {
    "balance": { "available": 1000, "reserved": 50 },
    "transactions": [...],
    "monthlyUsage": { "thisMonth": 500, "lastMonth": 450 }
  },
  "accounts": {
    "total": 5,
    "active": 4,
    "recent": [...]
  },
  "recentActivity": [...],
  "errors": { "offer": "Service unavailable" }  # 部分失败
}
```

---

## 📁 文件位置

### **Backend - Console Service**

```
services/console/
├── internal/handlers/
│   ├── token_rules.go              # Token规则CRUD逻辑
│   ├── http.go (line 94-104)       # 路由注册
│   └── aggregation.go              # Dashboard聚合逻辑
├── migrations/
│   └── 003_create_token_rules_table.sql  # 数据库迁移
└── static/admin/
    ├── index.html (line 76-77)     # 主页入口链接
    └── token-rules.html            # Token规则管理UI
```

### **Frontend - Dashboard**

```
apps/frontend/
├── lib/dashboard/
│   ├── types.ts (line 95-150)      # ConsoleDashboardData 类型
│   └── hooks.ts (line 120-185)     # useConsoleDashboard() hook
├── app/dashboard/[organization]/
│   ├── components/
│   │   └── ConsoleDashboard.tsx    # 新仪表盘组件
│   └── page.tsx (line 15-20)       # 环境变量开关
└── .env.local
    └── NEXT_PUBLIC_USE_CONSOLE_DASHBOARD=true
```

---

## 🗄️ 数据库 Schema

```sql
CREATE TABLE token_consumption_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    cost_per_unit INTEGER NOT NULL CHECK (cost_per_unit > 0),
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,  -- 软删除标记
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),  -- 自动更新触发器
    UNIQUE(service_name, action_type)
);

-- 索引
CREATE INDEX idx_token_rules_service ON token_consumption_rules(service_name) WHERE enabled = TRUE;
CREATE INDEX idx_token_rules_enabled ON token_consumption_rules(enabled);
CREATE INDEX idx_token_rules_updated ON token_consumption_rules(updated_at DESC);
```

**初始数据** (6条规则):
| service_name | action_type       | cost_per_unit |
|--------------|-------------------|---------------|
| siterank     | basic_evaluation  | 1             |
| siterank     | ai_evaluation     | 3             |
| adscenter    | ad_query          | 1             |
| adscenter    | bulk_sync         | 10            |
| batchopen    | batch_open_url    | 1             |
| offer        | offer_query       | 2             |

---

## 🔧 环境变量

### **Frontend (.env.local)**

```bash
# Dashboard 功能开关
NEXT_PUBLIC_USE_CONSOLE_DASHBOARD=true   # true=新版, false=旧版

# Console Service 地址
NEXT_PUBLIC_API_BASE_URL=https://console.example.com

# Supabase 配置 (已有)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### **Backend (Console Service)**

```bash
# 数据库连接
DATABASE_URL=postgresql://user:pass@host:5432/adsai

# Redis 缓存
REDIS_HOST=redis.example.com
REDIS_PORT=6379

# 服务地址 (用于聚合调用)
OFFER_SERVICE_URL=https://offer.example.com
BILLING_SERVICE_URL=https://billing.example.com
ADSCENTER_SERVICE_URL=https://adscenter.example.com
SITERANK_SERVICE_URL=https://siterank.example.com
```

---

## 🧪 测试命令

### **后端 API 测试**

```bash
# 设置 Token
export TOKEN="your-admin-jwt-token"
export API_URL="https://console.example.com"

# 测试获取规则
curl -H "Authorization: Bearer $TOKEN" $API_URL/api/v1/console/tokens/rules

# 测试创建规则
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serviceName":"billing","actionType":"test","costPerUnit":1}' \
  $API_URL/api/v1/console/tokens/rules

# 测试仪表盘聚合
curl -H "Authorization: Bearer $TOKEN" \
  $API_URL/api/v1/console/dashboard/{your-user-id}
```

### **前端本地开发**

```bash
cd apps/frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run start
```

### **数据库验证**

```bash
# 连接数据库
psql $DATABASE_URL

# 查询规则数量
SELECT COUNT(*) FROM token_consumption_rules;
# 预期: 6

# 查询启用规则
SELECT service_name, action_type, cost_per_unit
FROM token_consumption_rules
WHERE enabled = TRUE
ORDER BY service_name, action_type;

# 查看索引
\d+ token_consumption_rules

# 验证触发器
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE event_object_table = 'token_consumption_rules';
```

---

## 📊 关键指标

### **性能目标**

| 指标 | 目标 | 监控方式 |
|------|------|----------|
| Token Rules API P95 | < 200ms | Grafana |
| Dashboard API P95 | < 500ms | Grafana |
| Frontend LCP | < 2s | Vercel Analytics |
| API Error Rate | < 1% | Cloud Monitoring |
| Cache Hit Rate | > 80% | Redis INFO |

### **业务指标**

| 指标 | 描述 |
|------|------|
| Total Rules | token_consumption_rules 总数 |
| Enabled Rules | enabled = TRUE 的规则数 |
| Avg Cost Per Unit | 平均每次操作Token消耗 |
| Services Covered | 覆盖的服务数量 |

---

## 🚨 常见问题 FAQ

### **Q1: 如何回滚到旧仪表盘?**
```bash
# 修改环境变量
NEXT_PUBLIC_USE_CONSOLE_DASHBOARD=false
# 重新部署前端
```

### **Q2: Token规则更新后多久生效?**
- **立即生效** - 数据库更新后下一次查询即返回新值
- **缓存**: 无缓存，每次都读数据库 (规则变更不频繁)

### **Q3: Dashboard 数据多久刷新一次?**
- **自动刷新**: 30秒 (SWR `refreshInterval`)
- **手动刷新**: 点击刷新按钮或切换页面
- **缓存**: Redis 30秒 TTL

### **Q4: 如何添加新服务的Token规则?**
1. 访问 `/console/admin/token-rules.html`
2. 填写表单: 服务名称、操作类型、Token消耗
3. 点击"创建规则"
4. 新规则立即生效，后续计费将使用新规则

### **Q5: 软删除的规则如何恢复?**
```bash
# 方法1: Admin UI
# 点击"启用"按钮重新启用

# 方法2: API
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}' \
  $API_URL/api/v1/console/tokens/rules/{rule-id}

# 方法3: 直接SQL (紧急情况)
psql $DATABASE_URL -c "UPDATE token_consumption_rules SET enabled = TRUE WHERE id = '{rule-id}';"
```

### **Q6: Dashboard 显示 "部分服务不可用" 怎么办?**
- **原因**: 后端某个服务 (Offer/Billing/Adscenter) 返回错误
- **影响**: 只影响对应模块数据，其他数据正常显示
- **解决**: 检查对应服务健康状态，修复后自动恢复
- **查看详情**: 检查 `errors` 字段中的错误信息

---

## 📚 相关文档

- [部署指南 (完整版)](./DEPLOYMENT_GUIDE.md)
- [Admin System 实施总结](./ADMIN_SYSTEM_IMPLEMENTATION_SUMMARY.md)
- [Package B 实施总结](./PACKAGE_B_IMPLEMENTATION_SUMMARY.md)
- [前端设计文档](./FrontendDesignComplete_20251009.md)

---

**版本**: v1.0
**维护者**: Claude Code
**反馈**: 如有问题请查看 [故障排查指南](./DEPLOYMENT_GUIDE.md#-故障排查)
