# 后台管理系统安全增强实施方案

**日期**: 2025-10-09
**状态**: 🔄 Implementation In Progress

---

## 📋 需求概述

### **优化目标**

1. ✅ **保持简单权限**: 仅区分 USER/ADMIN 两级
2. ✅ **Recovery Code 应急访问**: 管理员生成一次性恢复码
3. ✅ **审计增强**: 记录操作前后对比、敏感操作告警

### **不实施**

- ❌ 邮箱密码登录（增加复杂度）
- ❌ 多级权限体系（Super/Ops/Support/Viewer）
- ❌ IP 白名单（降低灵活性）

---

## 🏗️ 技术架构

### **Recovery Code 系统**

```
┌──────────────────────┐
│  Admin Dashboard     │
│  (/manage/security)  │
└─────────┬────────────┘
          │ Generate Codes
          ▼
┌──────────────────────┐
│  Backend API         │
│  POST /recovery-codes│
│  /generate           │
└─────────┬────────────┘
          │ Create 10 codes
          ▼
┌──────────────────────┐
│  Database            │
│  admin_recovery_codes│
│  - code_hash (bcrypt)│
│  - expires_at (90d)  │
│  - used (boolean)    │
└──────────────────────┘
```

**恢复码格式**: `ABCD-EFGH-IJKL-MNOP` (16字符, base32编码)

**安全特性**:
- bcrypt 哈希存储（不可逆）
- 一次性使用（used = TRUE 后失效）
- 90 天自动过期
- 生成新码时撤销旧码

---

## 📊 数据库 Schema

### **1. admin_recovery_codes 表**

```sql
CREATE TABLE admin_recovery_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    code_hash TEXT NOT NULL,              -- bcrypt hash
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    used_from_ip TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,        -- 90 days
    UNIQUE(code_hash)
);

-- 索引
CREATE INDEX idx_recovery_codes_user ON admin_recovery_codes(user_id) WHERE used = FALSE;
CREATE INDEX idx_recovery_codes_expires ON admin_recovery_codes(expires_at) WHERE used = FALSE;
```

### **2. admin_audit_log 表 (增强版)**

```sql
CREATE TABLE admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    old_value JSONB,                      -- 操作前快照 ⭐ 新增
    new_value JSONB,                      -- 操作后快照 ⭐ 新增
    reason TEXT,                          -- 操作理由 ⭐ 新增
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_audit_log_user ON admin_audit_log(user_id);
CREATE INDEX idx_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_audit_log_created ON admin_audit_log(created_at DESC);
```

### **3. critical_admin_actions 视图**

```sql
CREATE OR REPLACE VIEW critical_admin_actions AS
SELECT
    id, user_email, action, resource, resource_id,
    old_value, new_value, reason, ip_address, created_at
FROM admin_audit_log
WHERE action IN (
    'DELETE_USER',
    'UPDATE_USER_ROLE',
    'DELETE_CONFIG',
    'UPDATE_PACKAGE_PRICE',
    'GENERATE_RECOVERY_CODES',
    'USE_RECOVERY_CODE',
    'FAILED_RECOVERY_CODE_LOGIN'
)
ORDER BY created_at DESC;
```

---

## 🔐 Recovery Code 工作流程

### **生成流程**

```typescript
// Step 1: 管理员访问安全设置页面
// GET /manage/security.html

// Step 2: 点击"生成恢复码"按钮
async function generateRecoveryCodes() {
  const reason = prompt('生成理由（必填）:');
  if (!reason) return;

  const res = await fetch('/api/v1/console/recovery-codes/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      count: 10,      // 生成 10 个码
      expiryDays: 90, // 90 天过期
      reason: reason
    })
  });

  const { codes } = await res.json();

  // Step 3: 一次性显示所有恢复码
  showRecoveryCodes(codes); // ⚠️ 刷新后不可再查看

  // Step 4: 自动下载为 TXT 文件
  downloadRecoveryCodes(codes, 'autoads_recovery_codes.txt');
}
```

### **使用流程**

```
┌─────────────────────┐
│  Login Page         │
│  Google OAuth 故障  │
└──────────┬──────────┘
           │ Click "使用恢复码"
           ▼
┌─────────────────────┐
│  Recovery Login     │
│  输入邮箱和恢复码    │
└──────────┬──────────┘
           │ POST /auth/recovery-code
           ▼
┌─────────────────────┐
│  Backend 验证        │
│  1. 检查用户是否管理员│
│  2. bcrypt 比对哈希  │
│  3. 标记码已使用     │
└──────────┬──────────┘
           │ Success
           ▼
┌─────────────────────┐
│  Dashboard          │
│  ⚠️ 提示重新生成码  │
└─────────────────────┘
```

---

## 📈 审计增强功能

### **1. 操作前后对比**

**示例：修改套餐价格**

```json
{
  "action": "UPDATE_PACKAGE_PRICE",
  "resource": "subscription_packages",
  "resourceId": "pro",
  "oldValue": {
    "price": 99,
    "includedTokens": 10000
  },
  "newValue": {
    "price": 129,
    "includedTokens": 15000
  },
  "reason": "市场调研后调整定价策略"
}
```

### **2. 敏感操作二次确认**

```javascript
async function deleteUser(userId) {
  // Step 1: 确认操作
  if (!confirm(`确定要删除用户 ${userId} 吗？`)) return;

  // Step 2: 要求填写理由
  const reason = prompt('删除理由（必填）:');
  if (!reason || reason.trim().length < 10) {
    alert('理由至少 10 个字符');
    return;
  }

  // Step 3: 执行并记录
  await fetch(`/api/v1/console/users/${userId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });

  // Step 4: 自动发送告警
  // → Slack: "🚨 管理员 alice@autoads.dev 删除了用户 xxx"
}
```

### **3. 实时告警**

**告警触发条件**:
- 删除用户
- 修改套餐价格
- 生成恢复码
- 使用恢复码登录
- 删除配置
- 修改用户角色

**告警渠道**:
- Slack Webhook
- 邮件通知 (可选)
- 控制台日志 (开发环境)

**示例消息**:
```
🚨 Critical Admin Action
User: alice@autoads.dev
Action: DELETE_USER
Resource: users (user-id-123)
Reason: 用户要求删除个人数据（GDPR）
IP: 203.0.113.5
Time: 2025-10-09T14:30:00Z
```

---

## 🖥️ 前端页面设计

### **1. Security Settings (/manage/security.html)**

```
┌─────────────────────────────────────────┐
│ 🔒 安全设置                              │
│ [← 返回] [🔄 刷新]                       │
├─────────────────────────────────────────┤
│ 📱 恢复码管理                            │
│                                          │
│ ⚠️ 恢复码用于 Google 登录故障时的应急访问 │
│                                          │
│ 当前状态:                                │
│   可用恢复码: 7/10                       │
│   上次生成: 2025-10-01                   │
│   过期时间: 2025-12-30                   │
│                                          │
│ [生成新恢复码]                           │
│                                          │
├─────────────────────────────────────────┤
│ 📋 恢复码列表                            │
│ ┌──────────────────────────────────┐   │
│ │ ID       │ 状态   │ 使用时间     │   │
│ ├──────────────────────────────────┤   │
│ │ ****-****│ 未使用 │ -            │   │
│ │ ****-****│ 未使用 │ -            │   │
│ │ ****-****│ 已使用 │ 10-05 14:20  │   │
│ └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### **2. Audit Logs (/manage/audit-logs.html)**

```
┌─────────────────────────────────────────┐
│ 📊 审计日志                              │
│ [← 返回] [🔄 刷新] [导出CSV]             │
├─────────────────────────────────────────┤
│ 筛选: [全部操作▾] [全部资源▾] [搜索用户] │
├─────────────────────────────────────────┤
│ 🚨 敏感操作 (近7天)                      │
│                                          │
│ [DELETE_USER] alice@... 删除用户 xyz     │
│ 理由: GDPR 用户请求                      │
│ 时间: 10-09 14:30   IP: 203.0.113.5     │
│ [查看详情] [查看变更对比]                │
│                                          │
├─────────────────────────────────────────┤
│ 📋 全部日志                              │
│ ┌──────────────────────────────────┐   │
│ │ 时间   │ 用户  │ 操作  │ 资源    │   │
│ ├──────────────────────────────────┤   │
│ │ 14:30  │ alice │ DELETE│ users   │   │
│ │ 14:25  │ bob   │ UPDATE│ config  │   │
│ │ 14:20  │ alice │ CREATE│ package │   │
│ └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### **3. Recovery Login (/auth/recovery.html)**

```
┌─────────────────────────────────────────┐
│ 🔓 恢复码登录                            │
├─────────────────────────────────────────┤
│                                          │
│ ⚠️ 此功能仅用于 Google 登录故障时的应急访问 │
│                                          │
│ 管理员邮箱:                              │
│ [alice@autoads.dev____________]          │
│                                          │
│ 恢复码:                                  │
│ [ABCD-EFGH-IJKL-MNOP___________]         │
│                                          │
│ [登录]                                   │
│                                          │
│ 💡 提示:                                 │
│ - 每个恢复码仅可使用一次                 │
│ - 登录后请立即重新生成新恢复码           │
│ - 如遗失恢复码，请联系超级管理员         │
│                                          │
│ [返回 Google 登录]                       │
└─────────────────────────────────────────┘
```

---

## 🚀 实施步骤

### **Phase 1: 数据库迁移** (30分钟)

```bash
# 1. 创建迁移文件 (已完成)
services/console/migrations/004_create_recovery_codes_table.sql

# 2. 执行迁移
cd services/console
./scripts/run-migrations.sh local  # 本地测试
./scripts/run-migrations.sh cloud  # 生产部署
```

### **Phase 2: 后端 API** (2小时)

**已完成文件**:
- `internal/handlers/recovery_codes.go` - Recovery Code CRUD
- `internal/handlers/audit.go` - 审计增强功能

**待完成**:
1. 更新 `internal/handlers/http.go` 注册路由
2. 在所有敏感操作中调用 `logAdminActionEnhanced()`
3. 集成 Slack Webhook 告警

### **Phase 3: 前端页面** (3小时)

**待创建页面**:
1. `/manage/security.html` - 安全设置 (恢复码管理)
2. `/manage/audit-logs.html` - 审计日志查看
3. `/auth/recovery.html` - 恢复码登录页面

**待更新页面**:
1. `/manage/index.html` - 添加"安全设置"入口
2. 所有管理页面 - 敏感操作添加理由输入框

### **Phase 4: 测试验证** (1小时)

```bash
# 1. 生成恢复码
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://console.autoads.dev/api/v1/console/recovery-codes/generate

# 2. 使用恢复码登录
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@autoads.dev", "recoveryCode": "ABCD-EFGH-IJKL-MNOP"}' \
  https://console.autoads.dev/api/v1/auth/recovery-code

# 3. 验证审计日志
curl -H "Authorization: Bearer $TOKEN" \
  https://console.autoads.dev/api/v1/console/audit-logs/enhanced

# 4. 测试告警
# → 执行敏感操作（如删除用户）
# → 检查 Slack 是否收到通知
```

---

## ⚠️ 安全注意事项

### **Recovery Code 最佳实践**

1. **生成后立即保存**: 显示恢复码后刷新页面将永久不可查看
2. **安全存储**:
   - ✅ 密码管理器（1Password, LastPass）
   - ✅ 加密文件（GPG 加密）
   - ❌ 纯文本文件
   - ❌ 截图保存到云盘
3. **定期轮换**: 每 90 天强制过期，自动提醒重新生成
4. **最小权限**: 仅管理员可生成，普通用户无此功能

### **审计日志合规**

1. **GDPR 合规**:
   - 记录所有个人数据访问/修改操作
   - 支持按用户导出审计日志
   - 数据删除操作必须记录理由

2. **SOC 2 合规**:
   - 所有管理员操作可追溯
   - 敏感操作实时告警
   - 审计日志不可篡改（仅追加）

3. **保留策略**:
   - 审计日志保留 2 年
   - 恢复码记录永久保留（含已使用）
   - 支持归档到 Cloud Storage

---

## 📝 待办清单

### **短期 (本周)**

- [ ] 更新 http.go 注册 Recovery Code 路由
- [ ] 创建 security.html 页面
- [ ] 创建 audit-logs.html 页面
- [ ] 创建 recovery.html 登录页面
- [ ] 在 token_rules.go 中集成 `logAdminActionEnhanced()`
- [ ] 在 config 更新中集成审计日志
- [ ] 配置 Slack Webhook 环境变量
- [ ] 执行数据库迁移
- [ ] 完整功能测试

### **中期 (下周)**

- [ ] 添加恢复码过期提醒
- [ ] 实现审计日志 CSV 导出
- [ ] 添加变更对比 Diff Viewer
- [ ] 优化 URL 路径（去除重复的 console）
- [ ] 编写管理员操作手册
- [ ] 配置 Cloud Monitoring 告警

### **长期 (下月)**

- [ ] 审计日志可视化仪表盘
- [ ] 恢复码使用统计
- [ ] 集成邮件告警
- [ ] 支持企业 SSO (SAML)

---

## 🎯 成功指标

| 指标 | 目标 | 当前 |
|------|------|------|
| Recovery Code 生成成功率 | > 99% | - |
| Recovery Code 登录延迟 | < 3s | - |
| 审计日志完整性 | 100% | - |
| 敏感操作告警及时性 | < 1min | - |
| 管理员满意度 | > 90% | - |

---

**文档版本**: v1.0
**最后更新**: 2025-10-09
**维护者**: Claude Code

🚧 **实施进行中** - 预计完成时间: 2025-10-10
