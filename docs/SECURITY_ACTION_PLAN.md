# 安全行动计划

**创建时间**: 2025-10-22
**优先级**: 🔴 紧急
**决策者**: 项目负责人

---

## 📋 执行摘要

已发现Git仓库中存在硬编码的敏感信息：
- 🔴 管理员密码: `***REDACTED***`
- 🟡 Supabase Anon Key

**当前状态**:
- ✅ 代码已修复（所有硬编码已移除）
- ⚠️  Git历史仍包含敏感信息
- ⚠️  需要立即决策和执行

---

## 🎯 两种方案对比

### 方案A: 清理Git历史（彻底方案）

**优点**:
- ✅ 彻底清除敏感信息
- ✅ 最高安全性
- ✅ 符合安全最佳实践

**缺点**:
- ❌ 需要强制推送，所有commit hash改变
- ❌ 团队成员需要重新克隆仓库
- ❌ 可能破坏CI/CD和PR引用
- ❌ 操作复杂，耗时1-2小时
- ❌ 仓库已有损坏的Git对象，风险较高

**执行方式**:
```bash
# 使用提供的脚本
./scripts/security/cleanup-git-history.sh
```

---

### 方案B: 立即更换密码（务实方案）⭐ 推荐

**优点**:
- ✅ 立即消除安全风险
- ✅ 操作简单，耗时<10分钟
- ✅ 无需团队协调
- ✅ 不影响CI/CD和协作
- ✅ 适合仓库已有损坏对象的情况

**缺点**:
- ⚠️  Git历史仍包含旧密码（但已失效）

**执行方式**:
```bash
# 使用提供的脚本
./scripts/security/quick-password-change.sh
```

---

## 🎯 我的建议

### **推荐方案B：立即更换密码**

**理由**:

1. **仓库健康状况**
   - 仓库已有损坏的Git对象
   - 清理历史可能加剧问题
   - 风险大于收益

2. **安全性评估**
   - 更换密码后，旧密码立即失效
   - Supabase Anon Key设计上可公开
   - 当前代码已修复，未来不会再泄露

3. **操作风险**
   - 方案A需要强制推送，影响所有协作者
   - 方案B简单可靠，立即生效

4. **成本效益**
   - 方案A: 1-2小时 + 团队协调成本
   - 方案B: <10分钟，零协调成本

---

## ✅ 立即执行（方案B）

### 步骤1: 更换管理员密码（5分钟）

```bash
# 运行密码更换脚本
./scripts/security/quick-password-change.sh
```

**脚本会自动**:
1. 生成新的强密码
2. 更新Supabase数据库
3. 更新.env.local文件
4. （可选）更新Secret Manager

### 步骤2: 验证新密码（2分钟）

```bash
# 访问管理员登录页
open https://www.urlchecker.dev/auth/admin-signin

# 使用新密码登录
# 邮箱: admin@autoads.dev
# 密码: <脚本生成的新密码>
```

### 步骤3: 更新所有环境（10分钟）

```bash
# Preview环境
gcloud secrets versions add ADMIN_PASSWORD --data-file=- --project=gen-lang-client-0944935873 << EOF
<新密码>
EOF

# Production环境（如果有）
# 使用相同的命令
```

### 步骤4: 提交代码修复（5分钟）

```bash
# 提交当前的代码修复（已移除硬编码）
git add -A
git commit -m "security: remove hardcoded passwords and API keys

- Replace hardcoded admin password with ADMIN_PASSWORD env var
- Remove hardcoded Supabase Anon Key fallback
- Add environment variable validation
- Update all archive scripts to use env vars

Security: The old password has been rotated and is no longer valid."

git push origin main
```

---

## 📊 完整清单

### 必须立即执行 ✅

- [ ] 运行 `./scripts/security/quick-password-change.sh`
- [ ] 验证新密码可以登录
- [ ] 更新所有环境的Secret Manager
- [ ] 提交代码修复到Git
- [ ] 测试各环境的管理员登录

### 可选执行（如果担心Supabase Key）

- [ ] 在Supabase Dashboard重新生成Anon Key
- [ ] 更新所有环境的 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] 重新部署Frontend服务

### 后续跟进（1周内）

- [ ] 添加pre-commit hook防止敏感信息提交
- [ ] 定期运行安全扫描（每月）
- [ ] 文档化密码管理流程
- [ ] 培训团队成员安全最佳实践

---

## 📁 相关文档

1. **SECURITY_SCAN_REPORT.md** - 完整的安全扫描报告
2. **SECURITY_FIX_SUMMARY.md** - 代码修复总结
3. **GIT_HISTORY_CLEANUP_GUIDE.md** - Git历史清理详细指南（如果将来需要）
4. **本文档** - 行动计划和决策建议

---

## 🔧 提供的工具

### 1. 快速密码更换脚本（推荐）

**位置**: `scripts/security/quick-password-change.sh`

**功能**:
- 自动生成强密码
- 更新Supabase数据库
- 更新本地环境变量
- 可选更新Secret Manager

**使用**:
```bash
chmod +x scripts/security/quick-password-change.sh
./scripts/security/quick-password-change.sh
```

---

### 2. Git历史清理脚本（备用）

**位置**: `scripts/security/cleanup-git-history.sh`

**功能**:
- 自动备份仓库
- 使用git-filter-repo清理历史
- 验证清理结果
- 提供恢复指导

**使用**:
```bash
chmod +x scripts/security/cleanup-git-history.sh
./scripts/security/cleanup-git-history.sh
```

⚠️  **仅在以下情况使用**:
- 仓库是公开的
- 必须符合合规要求
- 有充分时间进行团队协调

---

## 🆘 紧急联系

如果遇到问题或需要帮助：

**技术问题**:
- 检查日志: `tail -f /var/log/autoads/*.log`
- 查看错误: `journalctl -u autoads-* -n 50`

**安全问题**:
- 立即更换所有密码
- 检查访问日志
- 联系安全团队

**数据库问题**:
- 验证连接: `psql $SUPABASE_DB_URL -c "SELECT version();"`
- 检查用户: `psql $SUPABASE_DB_URL -c "SELECT * FROM auth.users WHERE email = 'admin@autoads.dev';"`

---

## ✅ 执行确认

完成后，请确认以下检查项：

### 密码更换确认
- [ ] 新密码已生成并保存
- [ ] Supabase数据库已更新
- [ ] .env.local已更新
- [ ] Secret Manager已更新（所有环境）
- [ ] 新密码可以成功登录
- [ ] 旧密码无法登录（已失效）

### 代码修复确认
- [ ] 所有硬编码密码已移除
- [ ] 所有硬编码API Key已移除
- [ ] 环境变量验证已添加
- [ ] 代码已提交到Git
- [ ] CI/CD构建通过

### 安全验证确认
- [ ] 无法在代码中找到硬编码密码
- [ ] 无法在代码中找到硬编码API Key
- [ ] 所有脚本使用环境变量
- [ ] 测试环境正常运行

---

## 📈 时间估算

| 步骤 | 预估时间 | 说明 |
|------|---------|------|
| 密码更换 | 5分钟 | 运行脚本自动完成 |
| 验证登录 | 2分钟 | 测试新密码 |
| 更新环境 | 10分钟 | 所有环境的Secret Manager |
| 提交代码 | 5分钟 | Git commit和push |
| 测试验证 | 10分钟 | 各环境功能测试 |
| **总计** | **~30分钟** | 包含验证时间 |

---

## 🎯 成功标准

完成后应达到：

1. ✅ 旧密码完全失效，无法登录
2. ✅ 新密码可以正常登录所有环境
3. ✅ 代码中无任何硬编码敏感信息
4. ✅ 所有环境变量正确配置
5. ✅ CI/CD正常运行
6. ✅ 服务正常运行

---

**行动建议**: 立即执行方案B，完成后进行验证，并将经验文档化。

**预期结果**: 30分钟内完成所有安全修复，服务正常运行，无安全风险。

---

**最后更新**: 2025-10-22
**负责人**: 待指定
**状态**: 待执行
