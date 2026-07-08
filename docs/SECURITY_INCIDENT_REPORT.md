# AutoAds 安全事件报告 - 敏感信息泄露

**报告日期**: 2025-10-22
**严重程度**: 🔴 **高危** (Critical)
**状态**: 🚨 需立即处理

---

## 📋 执行摘要

在代码库安全审查中发现，**多个敏感凭证被硬编码并提交到Github公开仓库**，包括：
- Supabase数据库密码
- Supabase Access Token
- JWT密钥示例

**影响范围**:
- 仓库: https://github.com/xxrenzhe/autoads.git
- 受影响文件: 14个已提交文件
- 暴露时间: 未知（需检查git历史）

---

## 🔍 发现的敏感信息

### 1. Supabase数据库密码 (10个文件)
**凭证**: `*HF#9dFnzV5DBA.`
**类型**: PostgreSQL数据库密码
**权限**: 完全数据库访问权限

**受影响文件**:
1. `docs/AdminSystem/IntegrationTestingGuide.md` (Line 345)
2. `docs/DASHBOARD_307_REDIRECT_ANALYSIS.md`
3. `docs/Database/DATABASE_MIGRATION_BEST_PRACTICES.md`
4. `docs/MarkerkitGo/OAuth_401_Root_Cause_Analysis.md`
5. `docs/MarkerkitGo/SupabaseBackendIntegration.md`
6. `docs/SUPABASE_CLEANUP_EXECUTION_GUIDE.md` (Line 60)
7. `docs/SupabaseGo/SUPABASE_OPTIMIZATION_EXECUTION_REPORT.md`
8. `docs/SupabaseGo/SupabaseConfigurationGuide_20251009.md`
9. `docs/SupabaseGo/USERACTIVITY_TEST_REPORT.md`
10. `docs/operations/environment-management.md`

**连接字符串示例**:
```bash
# 已泄露的完整连接字符串
psql "postgresql://postgres.jzzvizacfyipzdyiqfzb:*HF#9dFnzV5DBA.@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
```

### 2. Supabase Access Token (脚本文件)
**凭证前缀**: `sbp_98b1b736...`
**类型**: Supabase Management API Token
**权限**: 项目管理权限

**受影响文件**:
- `scripts/direct-migration.js`
- `scripts/supabase/query_real_schema.sh`
- `scripts/utils/create-real-supabase-token.mjs`
- `scripts/utils/supabase-magic-link-auth.mjs`

### 3. JWT Token示例
**凭证前缀**: `eyJhbGci...`
**类型**: Supabase JWT (anon_key, service_role_key)
**风险**: 虽然是标准公开的anon_key，但service_role_key若泄露风险极高

---

## ⚠️ 安全风险评估

### 即时风险 (Critical)
- ✅ `.gitignore` 配置正确 (`secrets/` 已忽略)
- ❌ 但敏感信息**硬编码**在文档和脚本中
- ❌ 这些文件**已提交**到git历史
- 🔴 **已推送到Github公开仓库** (origin: https://github.com/xxrenzhe/autoads.git)

### 潜在攻击场景
1. **数据库直接访问**:
   ```bash
   psql "postgresql://postgres.jzzvizacfyipzdyiqfzb:*HF#9dFnzV5DBA.@..."
   # 攻击者可以：
   # - 读取所有认证数据 (auth.users, auth.identities)
   # - 修改用户资料 (user_profiles)
   # - 删除数据
   ```

2. **Management API滥用**:
   ```bash
   curl -H "Authorization: Bearer sbp_98b1b736..." \
        https://api.supabase.com/v1/projects/jzzvizacfyipzdyiqfzb
   # 攻击者可以：
   # - 修改项目配置
   # - 重置数据库
   # - 访问所有项目设置
   ```

3. **JWT绕过认证**:
   - 如果service_role_key泄露，可绕过所有RLS规则
   - 直接访问所有用户数据

---

## 🚨 立即行动项 (优先级顺序)

### 阶段1: 紧急止损 (30分钟内)

#### 1.1 立即轮换所有受影响凭证

**Supabase数据库密码**:
```bash
# 1. 访问 Supabase Dashboard
https://supabase.com/dashboard/project/jzzvizacfyipzdyiqfzb/settings/database

# 2. 重置数据库密码
Settings → Database → Reset Database Password

# 3. 更新 secrets/supabase-credentials.json (本地)
# 4. 更新 GCP Secret Manager (如果存储了)
```

**Supabase Access Token**:
```bash
# 1. 访问 Account Settings
https://supabase.com/dashboard/account/tokens

# 2. 撤销现有Token: sbp_98b1b736...
# 3. 生成新的Access Token
# 4. 更新 secrets/supabase-credentials.json
```

**Supabase JWT Keys** (如果service_role_key泄露):
```bash
# 警告: 重置JWT密钥会导致所有现有会话失效
# 1. Settings → API → Reset JWT Secret
# 2. 更新所有使用该密钥的服务
```

#### 1.2 更新本地凭证文件
```bash
# 确保新凭证仅存储在本地
cd /Users/jason/Documents/Kiro/autoads
vim secrets/supabase-credentials.json
# 更新所有轮换后的新凭证
```

---

### 阶段2: 清理Git历史 (1小时内)

#### 2.1 使用BFG Repo-Cleaner清理敏感信息

**安装BFG**:
```bash
brew install bfg
```

**创建敏感词清单**:
```bash
cat > /tmp/passwords.txt << 'EOF'
*HF#9dFnzV5DBA.
sbp_98b1b736dc5fd991570e0946237c0c2bcc0abbca
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6enZpemFjZnlpcHpkeWlxZnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NjkzNjgsImV4cCI6MjA3NTI0NTM2OH0.PtWGyBON9TIOoWfCWBosPqpMd1JpBskp6C3bqVkj_Ps
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6enZpemFjZnlpcHpkeWlxZnpiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTY2OTM2OCwiZXhwIjoyMDc1MjQ1MzY4fQ.NF-YqGoSpFLw5T7gdHqAAwiqNKC_5efRtNcPcCj6RA8
postgres.jzzvizacfyipzdyiqfzb
EOF
```

**执行清理**:
```bash
# 1. 创建仓库备份
cd /Users/jason/Documents/Kiro/
cp -r autoads autoads-backup-$(date +%Y%m%d)

# 2. 使用BFG清理
cd autoads
bfg --replace-text /tmp/passwords.txt --no-blob-protection .

# 3. 清理reflog和过期对象
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 4. 验证清理结果
git log --all --oneline --grep="HF#9dFnzV5DBA" # 应该为空
```

#### 2.2 强制推送清理后的历史
```bash
# ⚠️ 警告: 这会重写Github历史，影响所有协作者
git push origin --force --all
git push origin --force --tags
```

---

### 阶段3: 替换硬编码凭证 (2小时内)

#### 3.1 清理文档中的敏感信息

**批量替换策略**:
```bash
# 创建替换脚本
cat > /tmp/clean_docs.sh << 'EOF'
#!/bin/bash
FILES=(
  "docs/AdminSystem/IntegrationTestingGuide.md"
  "docs/DASHBOARD_307_REDIRECT_ANALYSIS.md"
  "docs/Database/DATABASE_MIGRATION_BEST_PRACTICES.md"
  "docs/MarkerkitGo/OAuth_401_Root_Cause_Analysis.md"
  "docs/MarkerkitGo/SupabaseBackendIntegration.md"
  "docs/SUPABASE_CLEANUP_EXECUTION_GUIDE.md"
  "docs/SupabaseGo/SUPABASE_OPTIMIZATION_EXECUTION_REPORT.md"
  "docs/SupabaseGo/SupabaseConfigurationGuide_20251009.md"
  "docs/SupabaseGo/USERACTIVITY_TEST_REPORT.md"
  "docs/operations/environment-management.md"
)

for file in "${FILES[@]}"; do
  # 替换数据库密码为环境变量引用
  sed -i.bak 's/*HF#9dFnzV5DBA\./\$SUPABASE_DB_PASSWORD/g' "$file"

  # 替换完整连接字符串
  sed -i.bak 's/postgres\.jzzvizacfyipzdyiqfzb:[^@]*/postgres.jzzvizacfyipzdyiqfzb:\$SUPABASE_DB_PASSWORD/g' "$file"

  # 删除备份文件
  rm -f "$file.bak"
done

echo "✅ 清理完成！"
EOF

chmod +x /tmp/clean_docs.sh
/tmp/clean_docs.sh
```

**标准化的文档示例**:
```bash
# ❌ 错误: 硬编码密码
psql "postgresql://postgres.jzzvizacfyipzdyiqfzb:*HF#9dFnzV5DBA.@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"

# ✅ 正确: 使用环境变量
export SUPABASE_DB_PASSWORD=$(cat secrets/supabase-credentials.json | jq -r '.db_password')
psql "postgresql://postgres.jzzvizacfyipzdyiqfzb:$SUPABASE_DB_PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"

# ✅ 或引用凭证文件
psql "$(cat secrets/supabase-credentials.json | jq -r '.db_url')"
```

#### 3.2 清理脚本中的Token

**检查并更新受影响脚本**:
```bash
# 1. scripts/direct-migration.js
# 2. scripts/supabase/query_real_schema.sh
# 3. scripts/utils/create-real-supabase-token.mjs
# 4. scripts/utils/supabase-magic-link-auth.mjs

# 替换策略: 从 secrets/supabase-credentials.json 读取
```

**标准化脚本模板**:
```javascript
// ❌ 错误: 硬编码token
const SUPABASE_TOKEN = 'sbp_98b1b736dc5fd991570e0946237c0c2bcc0abbca';

// ✅ 正确: 从凭证文件读取
const fs = require('fs');
const credentials = JSON.parse(
  fs.readFileSync('secrets/supabase-credentials.json', 'utf8')
);
const SUPABASE_TOKEN = credentials.access_token;
```

---

### 阶段4: 预防措施 (长期)

#### 4.1 Git钩子 - 防止敏感信息提交

**创建pre-commit钩子**:
```bash
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# 敏感词检测
SENSITIVE_PATTERNS=(
  "HF#9dFnzV5DBA"
  "sbp_[a-zA-Z0-9]{32}"
  "postgres.jzzvizacfyipzdyiqfzb:[^@]*@"
  "eyJhbGci[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*"
)

echo "🔍 检查敏感信息..."

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
  if git diff --cached | grep -qE "$pattern"; then
    echo "❌ 检测到敏感信息: $pattern"
    echo "提交被阻止！请移除敏感信息或使用环境变量。"
    exit 1
  fi
done

echo "✅ 安全检查通过"
exit 0
EOF

chmod +x .git/hooks/pre-commit
```

#### 4.2 Github Secret Scanning

**启用Github Secret Scanning**:
1. 访问仓库设置: https://github.com/xxrenzhe/autoads/settings/security_analysis
2. 启用: **Secret scanning**
3. 启用: **Push protection** (防止敏感信息被推送)

#### 4.3 定期安全审计

**创建安全审计脚本**:
```bash
cat > scripts/security/audit-secrets.sh << 'EOF'
#!/bin/bash

echo "🔍 AutoAds 安全审计"
echo "===================="

# 检查硬编码密码
echo ""
echo "1. 检查硬编码密码..."
git grep -E "password.*=.*['\"]" | grep -v "YOUR_PASSWORD" | grep -v "example"

# 检查硬编码Token
echo ""
echo "2. 检查硬编码Token..."
git grep -E "token.*=.*['\"]" | grep -v "YOUR_TOKEN" | grep -v "example"

# 检查数据库连接字符串
echo ""
echo "3. 检查数据库连接字符串..."
git grep -E "postgres://.*:.*@" | grep -v "\$"

# 检查API密钥
echo ""
echo "4. 检查API密钥..."
git grep -E "api[_-]?key.*=.*['\"]" | grep -v "YOUR_API_KEY"

echo ""
echo "✅ 审计完成"
EOF

chmod +x scripts/security/audit-secrets.sh
```

**定期执行**:
```bash
# 每周运行一次
./scripts/security/audit-secrets.sh
```

#### 4.4 更新.gitignore (已经正确)

当前`.gitignore`配置正确，确保包含：
```gitignore
# ✅ 已配置
secrets/
**/*credentials*.json
*.env
*.env.local
```

---

## 📊 清理验证清单

### Git历史清理验证
- [ ] BFG清理执行成功
- [ ] `git log --all | grep "HF#9dFnzV5DBA"` 返回空
- [ ] `git log --all | grep "sbp_98b1b736"` 返回空
- [ ] 强制推送到Github成功

### 凭证轮换验证
- [ ] Supabase数据库密码已重置
- [ ] Supabase Access Token已撤销并重新生成
- [ ] `secrets/supabase-credentials.json` 已更新
- [ ] GCP Secret Manager已更新 (如适用)

### 文档清理验证
- [ ] 所有文档中硬编码密码已替换为环境变量
- [ ] 所有脚本中硬编码Token已替换为文件读取
- [ ] `git grep "HF#9dFnzV5DBA"` 返回空
- [ ] `git grep "sbp_98b1b736"` 返回空

### 预防措施验证
- [ ] Pre-commit钩子已安装
- [ ] Pre-commit钩子测试通过
- [ ] Github Secret Scanning已启用
- [ ] 安全审计脚本可执行

---

## 🔐 安全最佳实践 (未来)

### 1. 凭证管理规范
```yaml
✅ 正确做法:
  - 所有凭证存储在 secrets/ 目录
  - 使用环境变量引用凭证
  - 定期轮换敏感凭证 (每季度)
  - 使用GCP Secret Manager存储生产凭证

❌ 禁止行为:
  - 硬编码密码、Token、API密钥
  - 在文档中包含真实凭证
  - 在脚本中直接写入凭证
  - 提交 .env 文件到git
```

### 2. 文档编写规范
```markdown
# ✅ 正确: 使用占位符
psql "postgresql://postgres.<project_ref>:$SUPABASE_DB_PASSWORD@..."

# ✅ 正确: 引用凭证文件
export DB_PASSWORD=$(cat secrets/supabase-credentials.json | jq -r '.db_password')

# ❌ 错误: 硬编码真实密码
psql "postgresql://postgres.jzzvizacfyipzdyiqfzb:*HF#9dFnzV5DBA.@..."
```

### 3. 代码审查检查项
- [ ] PR中是否包含敏感信息？
- [ ] 新增的配置文件是否已加入.gitignore？
- [ ] 脚本是否从环境变量或凭证文件读取敏感信息？
- [ ] 是否有硬编码的API密钥或Token？

---

## 📞 后续行动

### 立即 (今天)
1. ✅ 轮换所有受影响凭证
2. ✅ 清理Git历史
3. ✅ 更新所有文档和脚本

### 本周内
1. 启用Github Secret Scanning
2. 安装pre-commit钩子
3. 团队培训 - 安全编码规范

### 本月内
1. 建立定期安全审计流程
2. 迁移所有凭证到GCP Secret Manager
3. 实施最小权限原则

---

**报告生成时间**: 2025-10-22
**下次审计时间**: 2025-11-22
**责任人**: DevOps团队
