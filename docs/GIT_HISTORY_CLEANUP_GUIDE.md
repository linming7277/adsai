# Git历史清理指南

**创建时间**: 2025-10-22
**状态**: ⚠️ 需要人工决策
**风险等级**: 🔴 高风险操作

---

## ⚠️ 重要警告

Git历史重写是一个**高风险操作**，会产生以下影响：

1. **所有commit hash会改变**
2. **需要强制推送到远程仓库**
3. **其他开发者需要重新克隆仓库**
4. **所有PR和issue引用会失效**
5. **可能破坏CI/CD流程**

---

## 🔍 发现的问题

### Git仓库状态

**仓库完整性问题**:
```
✅ 已删除损坏的tags: v0.0.1, v0.0.1-test-full-build, v1.0.0-build-test
⚠️  存在一些损坏的Git对象（dangling blobs）
⚠️  部分历史对象无法完全访问
```

**敏感信息分布**:
- 🔴 硬编码管理员密码: `***REDACTED***`
  - 已知存在于多个脚本文件的历史版本中
  - 最近的提交已修复（当前工作区）

- 🟡 Supabase Anon Key
  - 存在于 `UnifiedUserService.ts` 的历史版本中
  - 最近的提交 (04ee1107d) 涉及此变更

---

## 🛠️ 清理方案

### 方案1: 使用 git-filter-repo（推荐）

**优点**:
- 速度快
- Python实现，易于安装
- 官方推荐替代filter-branch

**步骤**:

```bash
# 1. 安装git-filter-repo
pip3 install git-filter-repo

# 2. 创建备份
cd /Users/jason/Documents/Kiro
git clone --mirror autoads autoads-backup.git

# 3. 创建替换文件
cd /Users/jason/Documents/Kiro/autoads
cat > /tmp/replacements.txt << 'EOF'
***REDACTED***==>REDACTED_ADMIN_PASSWORD
***REDACTED***==>REDACTED_SUPABASE_ANON_KEY
EOF

# 4. 执行清理
git filter-repo --replace-text /tmp/replacements.txt --force

# 5. 验证结果
git log --all -S "REDACTED_PATTERN" --oneline
git log --all -S "eyJhbGci" --oneline

# 6. 重新添加远程仓库（filter-repo会删除远程）
git remote add origin git@github.com:xxrenzhe/autoads.git

# 7. 强制推送到远程（⚠️ 危险操作）
git push --force --all
git push --force --tags
```

---

### 方案2: 使用 BFG Repo-Cleaner（替代方案）

**优点**:
- 非常快速
- 简单易用
- 专门用于清理敏感数据

**步骤**:

```bash
# 1. 下载BFG
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# 2. 创建备份
cd /Users/jason/Documents/Kiro
git clone --mirror autoads autoads-backup.git

# 3. 创建替换文件
cat > /tmp/passwords.txt << 'EOF'
***REDACTED_ADMIN_PASSWORD***
***REDACTED_SUPABASE_ANON_KEY***
EOF

# 4. 在mirror仓库上执行清理
cd /Users/jason/Documents/Kiro/autoads-backup.git
java -jar ../bfg-1.14.0.jar --replace-text /tmp/passwords.txt

# 5. 清理和压缩
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 6. 验证结果
git log --all -S "REDACTED_PATTERN" --oneline

# 7. 推送到远程（如果满意）
git push --force --all
git push --force --tags

# 8. 从mirror恢复到工作目录
cd /Users/jason/Documents/Kiro/autoads
git pull --force
```

---

### 方案3: 不清理历史（简单方案）

**如果决定不清理历史**，需要采取以下措施：

1. ✅ **立即更换所有泄露的密码**（最重要）
   ```bash
   # 更换管理员密码
   psql "$SUPABASE_DB_URL"
   UPDATE auth.users
   SET encrypted_password = crypt('新的强密码', gen_salt('bf'))
   WHERE email = 'admin@autoads.dev';
   ```

2. ✅ **轮换Supabase密钥**（如果担心安全）
   - 在Supabase Dashboard中重新生成Anon Key
   - 更新所有环境变量

3. ✅ **限制仓库访问权限**
   - 审查有权访问仓库的用户
   - 移除不必要的访问权限

4. ✅ **监控异常活动**
   - 检查管理员账户的登录日志
   - 监控API使用情况

5. ✅ **文档化风险**
   - 在安全文档中记录此事件
   - 制定应急响应计划

---

## 🎯 决策矩阵

| 因素 | 清理历史 | 不清理历史 |
|------|---------|-----------|
| **安全性** | ✅ 最高 | ⚠️ 中等（需更换密码） |
| **操作复杂度** | 🔴 高 | ✅ 低 |
| **团队影响** | 🔴 需要所有人重新克隆 | ✅ 无影响 |
| **CI/CD影响** | ⚠️ 可能需要重新配置 | ✅ 无影响 |
| **历史可追溯性** | ⚠️ commit hash改变 | ✅ 完整保留 |
| **时间成本** | ⚠️ 1-2小时 | ✅ <10分钟 |

---

## 📋 推荐决策流程

### 问题1: 仓库是私有的还是公开的？

**如果是私有仓库**:
- ✅ 更换密码即可（方案3）
- ⚠️ 如果担心内部人员，考虑清理历史

**如果是公开仓库**:
- 🔴 **必须清理历史**（方案1或方案2）
- 🔴 立即更换所有密码
- 🔴 审计所有访问日志

### 问题2: 团队规模和协作情况？

**单人开发或小团队（<5人）**:
- ✅ 可以清理历史（沟通成本低）
- 提前通知团队成员

**大团队（>5人）或活跃PR**:
- ⚠️ 清理历史成本高
- 建议方案3：更换密码 + 限制访问

### 问题3: 密码是否被使用过？

**如果密码从未在生产环境使用**:
- ✅ 风险较低
- 更换密码即可

**如果密码已在生产环境使用**:
- 🔴 立即更换
- 🔴 审计登录日志
- ⚠️ 考虑清理历史

---

## ✅ 执行前检查清单

### 清理历史前必须完成：

- [ ] **备份仓库**
  ```bash
  git clone --mirror autoads autoads-backup.git
  tar -czf autoads-full-backup-$(date +%Y%m%d).tar.gz autoads/
  ```

- [ ] **通知所有团队成员**
  - 说明将进行历史重写
  - 告知重新克隆仓库的步骤
  - 设定操作时间窗口

- [ ] **暂停CI/CD**
  - 禁用自动部署
  - 等待所有pending的构建完成

- [ ] **记录当前HEAD**
  ```bash
  git rev-parse HEAD > /tmp/original-head.txt
  ```

- [ ] **检查未推送的本地分支**
  ```bash
  git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads
  ```

### 清理历史后必须完成：

- [ ] **验证清理结果**
  ```bash
  git log --all -S "REDACTED_PATTERN" --oneline
  git log --all -S "eyJhbGci" --oneline
  ```

- [ ] **测试仓库完整性**
  ```bash
  git fsck --full
  ```

- [ ] **更新所有环境**
  - 更换所有密码
  - 更新环境变量
  - 重启相关服务

- [ ] **通知团队重新克隆**
  ```bash
  # 发送给团队的指令
  cd path/to/autoads
  git fetch origin
  git reset --hard origin/main
  # 或完全重新克隆
  rm -rf autoads
  git clone git@github.com:xxrenzhe/autoads.git
  ```

---

## 🆘 如果清理失败

### 恢复备份

```bash
# 从mirror备份恢复
cd /Users/jason/Documents/Kiro/autoads
git remote remove origin
git remote add origin ../autoads-backup.git
git fetch origin
git reset --hard origin/main

# 重新添加正确的远程
git remote set-url origin git@github.com:xxrenzhe/autoads.git
```

### 从tar归档恢复

```bash
cd /Users/jason/Documents/Kiro
rm -rf autoads
tar -xzf autoads-full-backup-YYYYMMDD.tar.gz
```

---

## 📞 需要帮助？

### 相关文档
- [Git Filter-Repo文档](https://github.com/newren/git-filter-repo)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [GitHub: 从仓库中删除敏感数据](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)

### AutoAds团队联系方式
- 安全团队: security@autoads.dev
- 技术负责人: tech-lead@autoads.dev

---

## 📝 建议

### 我的建议（基于当前情况）

**推荐方案**: **方案3（不清理历史）+ 立即更换密码**

**理由**:
1. ✅ 仓库已有一些损坏的Git对象，清理历史可能加剧问题
2. ✅ 当前代码已修复，未来不会再泄露
3. ✅ 更换密码可以立即消除风险
4. ✅ 操作简单，不影响团队协作
5. ✅ 保留完整的Git历史用于调试

**必须立即执行**:
```bash
# 1. 更换管理员密码（连接到Supabase）
psql "$SUPABASE_DB_URL"
UPDATE auth.users
SET encrypted_password = crypt('新的超强密码!@#2025', gen_salt('bf'))
WHERE email = 'admin@autoads.dev';

# 2. 验证新密码
# 使用新密码尝试登录

# 3. 更新所有环境的ADMIN_PASSWORD环境变量
echo "ADMIN_PASSWORD=新的超强密码!@#2025" >> .env.local
```

**可选操作**（如果担心Supabase Key泄露）:
- 在Supabase Dashboard重新生成Anon Key
- 更新所有环境的 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

**最终决策**: 请你根据实际情况（仓库性质、团队规模、风险评估）选择合适的方案。

**如果需要执行Git历史清理，请先完整阅读本文档，并确保已完成所有检查清单项目。**
