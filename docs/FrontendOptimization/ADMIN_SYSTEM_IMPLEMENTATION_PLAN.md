# AutoAds 后台管理系统实施方案

**创建时间**: 2025-10-09
**实施优先级**: P0（核心功能）
**预估工时**: 3-5 天

---

## 📋 需求概览

### 用户需求
> "还需要实现后台管理系统，支持如下功能模块：仪表盘、用户管理、套餐管理、Token管理（包括消耗规则）、API管理、动态配置等"

### 现状分析

**✅ 已存在的后端服务**:

Console 服务 (`/services/console`) 已完整实现后台管理 API：

| 模块 | API 端点 | 状态 | 文件位置 |
|-----|----------|------|---------|
| 用户管理 | `GET/PUT /api/v1/console/users/*` | ✅ 已实现 | `handlers/users.go` |
| Token管理 | `GET /api/v1/console/tokens/*` | ✅ 已实现 | `handlers/http.go` |
| API密钥管理 | `GET/POST /api/v1/console/apikeys/*` | ✅ 已实现 | `handlers/http.go` |
| 配置管理 | `GET/PUT /api/v1/console/config/*` | ✅ 已实现 | `handlers/http.go` |
| Dashboard统计 | `GET /api/v1/console/stats` | ✅ 已实现 | `handlers/http.go` |
| 审计日志 | `GET /api/v1/console/audit/*` | ✅ 已实现 | `handlers/audit.go` |

**⚠️ 需要补充的功能**:

| 模块 | API 端点 | 状态 | 优先级 |
|-----|----------|------|-------|
| Token消耗规则 | `GET/POST /api/v1/console/tokens/rules` | ❌ 需新增 | P0 |
| 套餐管理UI | 基于配置管理 | ⚠️ 需优化 | P1 |
| 现代化前端 | React/Next.js 替换静态HTML | ⚠️ 需重构 | P2 |

**✅ 已存在的静态管理页面**:

| 页面 | 功能 | 文件位置 | 状态 |
|-----|------|---------|------|
| 仪表盘 | 核心统计、SLO概览 | `static/admin/index.html` | ✅ 基础可用 |
| 用户管理 | 用户列表、角色、套餐、充值 | `static/admin/users.html` | ✅ 基础可用 |
| 告警管理 | 告警列表、规则配置 | `static/admin/alerts.html` | ✅ 基础可用 |
| Adscenter监控 | 执行报表、业务指标 | `static/admin/adscenter-*.html` | ✅ 基础可用 |

---

## 🎯 实施策略

### 策略一：快速补充（推荐）⭐

**核心原则**:
1. **复用现有 Console 服务 API**（已实现 20+ 管理端点）
2. **优化现有静态页面**（已有 Dashboard、用户、告警管理）
3. **新增 Token 消耗规则管理**（唯一缺失的核心功能）

**优势**:
- ✅ 快速上线（3-5 天）
- ✅ 复用已有代码（减少 Bug）
- ✅ 渐进式优化（后续可迁移到 React）

**交付物**:
1. Token 消耗规则管理 API + UI (新增)
2. 优化现有管理页面（样式、交互）
3. 套餐管理 UI（基于配置管理）
4. 动态配置 UI（基于配置管理）

### 策略二：全面重构（不推荐）

**核心原则**:
1. 使用 React/Next.js 重新开发管理后台
2. 集成到主应用 `/admin` 路由

**优势**:
- ✅ 现代化 UI
- ✅ 代码可维护性高

**劣势**:
- ❌ 耗时长（2-3 周）
- ❌ 重复造轮子
- ❌ 风险高

---

## 📐 实施方案详情（策略一）

### Phase 1: Token 消耗规则管理（P0）

#### 1.1 后端 API 实现

**数据库表** (`services/console/migrations/003_token_rules.up.sql`):

```sql
CREATE TABLE IF NOT EXISTS token_consumption_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    cost_per_unit INTEGER NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(service_name, action_type)
);

CREATE INDEX idx_token_rules_service ON token_consumption_rules(service_name);
CREATE INDEX idx_token_rules_enabled ON token_consumption_rules(enabled);

-- 初始数据
INSERT INTO token_consumption_rules (service_name, action_type, cost_per_unit, description) VALUES
('siterank', 'basic_evaluation', 1, 'Offer 基础评估（SimilarWeb数据）'),
('siterank', 'ai_evaluation', 3, 'Offer AI评估（SimilarWeb + Vertex AI）'),
('adscenter', 'ad_query', 1, '查询单条广告消耗'),
('batchopen', 'batch_open_url', 1, '批量打开单个URL消耗'),
('offer', 'offer_query', 2, '查询Offer详情消耗')
ON CONFLICT (service_name, action_type) DO NOTHING;
```

**Handler 实现** (补充到 `services/console/internal/handlers/http.go`):

```go
// 已在现有代码中实现：
// mux.Handle("/api/v1/console/tokens/rules", ...)
// mux.Handle("/api/v1/console/tokens/rules/", ...)

type TokenRule struct {
    ID          string    `json:"id"`
    ServiceName string    `json:"serviceName"`
    ActionType  string    `json:"actionType"`
    CostPerUnit int       `json:"costPerUnit"`
    Description string    `json:"description"`
    Enabled     bool      `json:"enabled"`
    CreatedAt   time.Time `json:"createdAt"`
    UpdatedAt   time.Time `json:"updatedAt"`
}

func (h *Handler) getTokenRules(w http.ResponseWriter, r *http.Request) {
    rows, err := h.DB.Query(r.Context(), `
        SELECT id, service_name, action_type, cost_per_unit, description, enabled, created_at, updated_at
        FROM token_consumption_rules
        WHERE enabled = TRUE
        ORDER BY service_name, action_type
    `)
    // ... 实现逻辑
}

func (h *Handler) createTokenRule(w http.ResponseWriter, r *http.Request) {
    var rule TokenRule
    json.NewDecoder(r.Body).Decode(&rule)

    err := h.DB.QueryRow(r.Context(), `
        INSERT INTO token_consumption_rules (service_name, action_type, cost_per_unit, description, enabled)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at, updated_at
    `, rule.ServiceName, rule.ActionType, rule.CostPerUnit, rule.Description, rule.Enabled).Scan(...)
    // ... 实现逻辑
}

func (h *Handler) tokenRulesTree(w http.ResponseWriter, r *http.Request) {
    // 处理 PUT /api/v1/console/tokens/rules/{id} (更新)
    // 处理 DELETE /api/v1/console/tokens/rules/{id} (删除/禁用)
}
```

#### 1.2 前端 UI 实现

**新建文件**: `services/console/static/admin/token-rules.html`

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Token 消耗规则管理</title>
  <style>
    /* 复用现有样式 */
    body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto; margin: 20px; }
    table { width:100%; border-collapse: collapse; }
    th, td { border:1px solid #e5e7eb; padding:8px; font-size: 13px; }
    th { background:#f3f4f6; text-align:left; }
    .form-row { display:flex; gap:10px; margin-bottom: 10px; }
    button { padding:6px 12px; cursor:pointer; }
  </style>
  <script>
    async function fetchJSON(u, opt){
      const r = await fetch(u, opt||{});
      if(!r.ok) throw new Error(await r.text());
      return r.json();
    }

    let rules = [];

    async function load(){
      rules = await fetchJSON('/api/v1/console/tokens/rules');
      const tbody = document.querySelector('#rulesList');
      tbody.innerHTML = '';

      for(const rule of rules){
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${rule.serviceName}</td>
          <td>${rule.actionType}</td>
          <td>${rule.costPerUnit}</td>
          <td>${rule.description}</td>
          <td>${rule.enabled ? '✅' : '❌'}</td>
          <td>
            <button onclick="editRule('${rule.id}')">编辑</button>
            <button onclick="toggleRule('${rule.id}', ${!rule.enabled})">
              ${rule.enabled ? '禁用' : '启用'}
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      }
    }

    async function createRule(){
      const data = {
        serviceName: document.querySelector('#serviceName').value,
        actionType: document.querySelector('#actionType').value,
        costPerUnit: parseInt(document.querySelector('#costPerUnit').value),
        description: document.querySelector('#description').value,
        enabled: true
      };

      await fetchJSON('/api/v1/console/tokens/rules', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
      });

      alert('规则已创建');
      await load();
    }

    async function toggleRule(id, enabled){
      await fetchJSON(`/api/v1/console/tokens/rules/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ enabled })
      });
      await load();
    }

    window.addEventListener('DOMContentLoaded', load);
  </script>
</head>
<body>
  <h2>Token 消耗规则管理</h2>
  <div class="form-row">
    <a href="/console/admin/index.html">返回仪表盘</a>
  </div>

  <h3>新增规则</h3>
  <div class="form-row">
    <select id="serviceName">
      <option value="siterank">SiteRank</option>
      <option value="adscenter">AdsCenter</option>
      <option value="batchopen">BatchOpen</option>
      <option value="offer">Offer</option>
    </select>
    <input id="actionType" placeholder="操作类型 (如 basic_evaluation)" />
    <input id="costPerUnit" type="number" placeholder="Token消耗" min="1" />
    <input id="description" placeholder="说明" />
    <button onclick="createRule()">创建</button>
  </div>

  <h3>规则列表</h3>
  <table>
    <thead>
      <tr>
        <th>服务</th>
        <th>操作类型</th>
        <th>Token消耗</th>
        <th>说明</th>
        <th>状态</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody id="rulesList"></tbody>
  </table>
</body>
</html>
```

### Phase 2: 优化现有管理页面（P1）

#### 2.1 改进 Dashboard (`static/admin/index.html`)

**优化点**:
1. 添加 Token 统计卡片
2. 集成用户增长趋势
3. 添加快捷操作链接
4. 优化样式（使用 Tailwind CSS CDN）

**修改示例**:

```html
<!-- 在现有 <div id="stats"> 之后添加 -->
<h3>快捷操作</h3>
<div class="grid">
  <div class="card">
    <a href="/console/admin/users.html">👥 用户管理</a>
  </div>
  <div class="card">
    <a href="/console/admin/token-rules.html">⚡ Token规则</a>
  </div>
  <div class="card">
    <a href="/console/admin/config.html">⚙️ 系统配置</a>
  </div>
</div>
```

#### 2.2 新增套餐管理页面 (`static/admin/plans.html`)

**功能**:
- 查看当前套餐配置（从 `/api/v1/console/config?key=plans.*` 获取）
- 修改套餐Token额度、价格、功能列表
- 基于配置管理 API 实现

**示例代码**:

```javascript
async function loadPlans(){
  const configs = await fetchJSON('/api/v1/console/config?key=plans.*');
  // 解析 plans.pro.tokenGrant, plans.pro.priceMonthly 等
  // 渲染表单
}

async function updatePlan(tier, field, value){
  const key = `plans.${tier}.${field}`;
  await fetchJSON(`/api/v1/console/config/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ value: JSON.stringify(value) })
  });
  alert('套餐配置已更新');
}
```

#### 2.3 新增动态配置页面 (`static/admin/config.html`)

**功能**:
- 查看所有配置项（分类：限流、业务规则、套餐、Token）
- 修改配置值（实时生效）
- 查看配置历史

**示例代码**:

```javascript
async function loadConfigs(){
  const configs = await fetchJSON('/api/v1/console/config');
  // configs.items = [{ key: 'rateLimit.adscenter.rpm', value: '100', updatedAt: '...' }]
  renderConfigTable(configs.items);
}

async function updateConfig(key, value){
  await fetchJSON(`/api/v1/console/config/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ value })
  });
  await loadConfigs();
}
```

### Phase 3: 文档与部署（P2）

#### 3.1 创建管理员使用手册

**文件**: `docs/Admin/ADMIN_USER_GUIDE.md`

**内容**:
1. 登录方式（Supabase Admin 权限配置）
2. 各模块使用说明
3. 常见操作示例
4. 故障排查

#### 3.2 更新 Console 服务文档

**文件**: `services/console/README.md`

**补充内容**:
- 新增 API 端点文档
- 静态页面访问路径
- Admin 权限配置指南

---

## 📦 交付物清单

### 后端（Console 服务）

| 文件 | 功能 | 状态 |
|-----|------|------|
| `migrations/003_token_rules.up.sql` | Token规则表DDL | ❌ 新增 |
| `internal/handlers/token_rules.go` | Token规则CRUD | ❌ 新增 |
| `internal/handlers/http.go` | 注册路由（已有） | ✅ 已存在 |

### 前端（静态页面）

| 文件 | 功能 | 状态 |
|-----|------|------|
| `static/admin/index.html` | 仪表盘 | ⚠️ 优化 |
| `static/admin/users.html` | 用户管理 | ✅ 已存在 |
| `static/admin/token-rules.html` | Token规则管理 | ❌ 新增 |
| `static/admin/plans.html` | 套餐管理 | ❌ 新增 |
| `static/admin/config.html` | 动态配置 | ❌ 新增 |

### 文档

| 文件 | 功能 | 状态 |
|-----|------|------|
| `docs/Admin/ADMIN_USER_GUIDE.md` | 管理员使用手册 | ❌ 新增 |
| `services/console/README.md` | Console服务文档 | ⚠️ 更新 |

---

## 🚀 实施步骤

### Day 1: Token 消耗规则管理

- [x] 创建数据库迁移文件 (`003_token_rules.up.sql`)
- [ ] 实现后端 API (`token_rules.go`)
- [ ] 创建前端页面 (`token-rules.html`)
- [ ] 测试 CRUD 功能

### Day 2: 套餐管理

- [ ] 创建套餐管理页面 (`plans.html`)
- [ ] 集成配置管理 API
- [ ] 测试套餐修改功能

### Day 3: 动态配置

- [ ] 创建动态配置页面 (`config.html`)
- [ ] 添加配置分类展示
- [ ] 测试配置热更新

### Day 4: 优化与测试

- [ ] 优化 Dashboard 页面
- [ ] 统一样式（引入 Tailwind CDN）
- [ ] 端到端测试所有功能

### Day 5: 文档与部署

- [ ] 编写管理员使用手册
- [ ] 更新 Console 服务 README
- [ ] 部署到测试环境
- [ ] 交付验收

---

## 🔒 安全考虑

### 1. 认证授权

**当前方案**:
- 使用 `middleware.AdminOnly` 中间件
- 验证用户 role = 'ADMIN'（来自 Supabase metadata）

**建议增强**:
```go
// services/console/internal/middleware/admin.go
func AdminOnly(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        user := auth.GetUserFromContext(r.Context())
        if user == nil || user.Role != "ADMIN" {
            errors.Write(w, r, 403, "ADMIN_REQUIRED", "Admin role required", nil)
            return
        }
        // 记录审计日志
        logAdminAction(r.Context(), user.ID, r.Method, r.URL.Path)
        next.ServeHTTP(w, r)
    })
}
```

### 2. 审计日志

**当前方案**:
- Console 服务已实现审计日志表 (`migrations/002_create_audit_log_table.sql`)
- 已有 API: `GET /api/v1/console/audit`

**建议增强**:
- 所有管理操作自动记录到审计日志
- 定期导出审计日志到 Cloud Storage

### 3. 敏感操作确认

**建议新增**:
- Token 充值：需要二次确认
- 套餐降级：需要原因说明
- 配置修改：需要变更说明

---

## 📊 成功指标

| 指标 | 目标 | 验收标准 |
|-----|------|---------|
| 功能完整性 | 100% | 所有6个模块可用 |
| API响应时间 | < 500ms | P95 < 500ms |
| 页面加载时间 | < 2s | 首屏加载 < 2s |
| 管理员满意度 | > 80% | 使用调研问卷 |

---

## 🎯 总结

**核心优势**:
1. ✅ **快速上线**: 复用Console服务现有20+端点，仅需补充1个模块
2. ✅ **低风险**: 基于已验证的代码，减少Bug
3. ✅ **易维护**: 静态HTML易于修改，无需构建工具

**后续优化方向**:
1. 使用 React/Next.js 重构管理后台（P2优先级）
2. 集成到主应用 `/admin` 路由
3. 添加实时WebSocket推送（Dashboard刷新）

**预期交付时间**: 3-5 个工作日
