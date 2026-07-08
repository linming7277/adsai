# 安全扫描报告

**扫描时间**: 2025-10-22
**扫描范围**: 整个代码库（包括Git历史）
**状态**: 🔴 发现严重安全问题

---

## 🔴 严重问题（需立即修复）

### 1. 硬编码管理员密码

**风险等级**: 🔴 严重
**密码**: `***REDACTED***` (已在代码修复中移除)

**泄露位置**（8处）:
```
scripts/archive/create-admin-user.ts:9
scripts/archive/debug-admin-login.ts:12
scripts/archive/debug-admin-login.ts:111
scripts/archive/fix-admin-password.ts:27
scripts/archive/fix-preview-admin-login.sh:15
scripts/archive/verify-admin-auth.ts:51
scripts/archive/verify-admin-auth.ts:76
scripts/common/setup-admin.sh:22
```

**影响**:
- ✅ 所有文件都在 `scripts/archive/` 或 `scripts/common/` 目录
- ✅ 这些是工具脚本，不是生产代码
- ❌ 但密码已泄露到Git历史，任何有仓库访问权的人都能看到

**修复建议**:
1. **立即更换管理员密码**（最高优先级）
2. 修改所有脚本，使用环境变量 `ADMIN_PASSWORD` 替代硬编码
3. 考虑使用Git历史重写工具清除敏感信息（可选，有风险）

---

### 2. Supabase Anon Key 硬编码

**风险等级**: 🟡 中等
**Key**: `***REDACTED***` (已在代码修复中移除)

**泄露位置**（2处）:
```
apps/frontend/src/lib/services/UnifiedUserService.ts:124
docs/SECURITY_INCIDENT_REPORT.md:159
```

**影响**:
- 🟡 Supabase Anon Key 设计上可以公开（用于客户端）
- 🟡 但仍建议通过环境变量管理，避免硬编码
- ✅ 配合Row Level Security (RLS) 可以安全使用

**修复建议**:
1. 修改 `UnifiedUserService.ts`，移除硬编码的fallback值
2. 确保所有环境都正确配置 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. 文档中的Key可以保留（用于说明目的）

---

## ✅ 正常情况（无需修复）

### 1. `.gitignore` 配置正确

以下敏感文件模式已被正确排除：
```
secrets/*                    # ✅ 秘密文件目录
**/*credentials*.json        # ✅ 凭证文件
**/*service-account*.json    # ✅ 服务账号密钥
**/*-key.json               # ✅ 密钥文件
*.env                       # ✅ 环境变量文件
*.env.local                 # ✅ 本地环境变量
*.key                       # ✅ 密钥文件
*.pem                       # ✅ 证书文件
```

### 2. `secrets/` 目录未被提交

检查结果：
- ✅ `secrets/` 目录中的所有敏感文件都已被.gitignore排除
- ✅ Git仓库中只有 `secrets/README.md`（这是允许的）
- ✅ 实际的密钥文件（gcp_codex_dev.json, firebase-adminsdk.json等）未被提交

### 3. 配置文件引用路径正常

以下文件引用了secrets/路径，但这是正常的：
```
.env.migrate: GOOGLE_APPLICATION_CREDENTIALS=secrets/gcp_codex_dev.json
docker-compose.yml: - ./secrets/firebase-adminsdk.json:/app/secrets/firebase-adminsdk.json:ro
```

这些只是路径配置，不包含实际密钥内容。

---

## 🔧 修复方案

### 优先级1: 立即更换管理员密码

```bash
# 1. 连接到Supabase数据库
psql "$SUPABASE_DB_URL"

# 2. 更新管理员密码（使用新的强密码）
UPDATE auth.users
SET encrypted_password = crypt('新的强密码', gen_salt('bf'))
WHERE email = 'admin@autoads.dev';

# 3. 更新所有脚本使用环境变量
export ADMIN_PASSWORD='新的强密码'
```

### 优先级2: 移除硬编码的Supabase Key

**修改文件**: `apps/frontend/src/lib/services/UnifiedUserService.ts:124`

**当前代码**:
```typescript
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '***REDACTED***';
```

**修复后**:
```typescript
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_ANON_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is not set');
}
```

### 优先级3: 更新Archive脚本

**需要修改的文件**（8个）:

1. `scripts/archive/create-admin-user.ts`
2. `scripts/archive/debug-admin-login.ts`
3. `scripts/archive/fix-admin-password.ts`
4. `scripts/archive/fix-preview-admin-login.sh`
5. `scripts/archive/verify-admin-auth.ts`
6. `scripts/common/setup-admin.sh`

**修改模式**:
```typescript
// ❌ 旧代码
const password = '***REDACTED***'

// ✅ 新代码
const password = process.env.ADMIN_PASSWORD || (() => {
  throw new Error('ADMIN_PASSWORD environment variable is required');
})();
```

---

## 📊 扫描统计

| 类别 | 数量 | 风险等级 |
|------|------|----------|
| 硬编码密码 | 8处 | 🔴 严重 |
| 硬编码API Key | 2处 | 🟡 中等 |
| 泄露的密钥文件 | 0 | ✅ 安全 |
| .gitignore配置缺陷 | 0 | ✅ 安全 |

---

## ✅ 安全最佳实践检查

| 检查项 | 状态 | 说明 |
|--------|------|------|
| .gitignore配置 | ✅ | 正确排除所有敏感文件 |
| secrets/目录保护 | ✅ | 未被提交到Git |
| 环境变量使用 | 🟡 | 大部分正确，但有少量硬编码 |
| 密钥轮换 | ❌ | 管理员密码需要立即更换 |
| Git历史清理 | ⚠️ | 可选，但有风险 |

---

## 🎯 后续建议

### 短期（1周内）
1. ✅ 立即更换管理员密码
2. ✅ 移除UnifiedUserService.ts中的硬编码Key
3. ✅ 更新所有archive脚本使用环境变量

### 中期（1个月内）
1. 🔲 实施密钥轮换策略（定期更换Supabase密钥）
2. 🔲 添加pre-commit hook，防止敏感信息提交
3. 🔲 定期运行安全扫描工具（如git-secrets, truffleHog）

### 长期
1. 🔲 使用Secret Manager统一管理所有密钥
2. 🔲 实施最小权限原则
3. 🔲 定期安全审计

---

**报告生成者**: Claude Code Security Scanner
**下次扫描建议**: 2025-11-22（1个月后）
