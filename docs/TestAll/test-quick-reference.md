# 前端测试快速参考指南

> **快速开始**: 5分钟了解测试体系和常用命令

---

## 🚀 快速开始

### 运行现有测试

```bash
# 1. 完整E2E测试 (推荐)
node scripts/tests/test-frontend-complete.mjs

# 2. 显示浏览器窗口（用于调试）
HEADLESS=false node scripts/tests/test-frontend-complete.mjs

# 3. 测试指定环境
PREVIEW_BASE=https://staging.urlchecker.dev node scripts/tests/test-frontend-complete.mjs

# 4. 简单的HTTP测试（无需Playwright）
./scripts/tests/run-all-tests.sh
```

### 当前测试覆盖

✅ **已完成** (13项):
- HTTP重定向、品牌一致性
- 中英文导航栏i18n
- SEO元数据、认证守卫
- 公开页面、性能指标

⏳ **待完成**:
- 登录态测试（需要程序化登录）
- 多角色权限测试
- 组件测试（Storybook）

---

## 📁 文件结构

```
autoads/
├── scripts/tests/                    # 测试脚本目录
│   ├── test-frontend-complete.mjs   # ✅ 主测试文件(13项)
│   ├── test-google-oauth.mjs        # OAuth登录测试
│   ├── run-all-tests.sh             # bash基础测试
│   └── helpers/                      # 辅助函数(待创建)
│       ├── auth.mjs                  # 程序化登录
│       └── test-data.mjs             # 测试数据管理
│
├── docs/                             # 文档目录
│   ├── frontend-test-strategy.md    # 📚 完整策略文档
│   ├── test-tasks-tracking.md       # 📋 任务追踪看板
│   ├── test-quick-reference.md      # 🔖 本文件
│   ├── frontend-test-results-*.md   # 测试结果报告
│   └── frontend-automated-test-plan.md # 测试方案
│
└── .github/workflows/                # CI/CD(待创建)
    └── frontend-e2e-test.yml
```

---

## 🧪 测试命令速查

### E2E测试

| 命令 | 用途 | 时长 |
|------|------|------|
| `node scripts/tests/test-frontend-complete.mjs` | 完整测试(无头) | ~30s |
| `HEADLESS=false node scripts/tests/test-frontend-complete.mjs` | 显示浏览器 | ~45s |
| `node scripts/tests/test-google-oauth.mjs` | OAuth登录测试 | ~60s |

### 基础测试

| 命令 | 用途 | 时长 |
|------|------|------|
| `./scripts/tests/run-all-tests.sh` | HTTP/curl测试 | ~10s |
| `curl -IL https://www.urlchecker.dev/` | 检查重定向 | ~1s |

### 未来命令 (待实施)

```bash
# Storybook
npm run storybook              # 启动Storybook开发环境
npm run build-storybook        # 构建静态Storybook
npm run chromatic              # 运行视觉回归测试

# 单元测试
npm run test:unit              # 运行单元测试
npm run test:coverage          # 生成覆盖率报告
npm run test:watch             # watch模式

# 权限测试
node scripts/tests/test-role-permissions.mjs
```

---

## 🎯 测试场景速查

### 场景1: 验证中文导航栏是否正确

```bash
# 方法1: Playwright (推荐)
node scripts/tests/test-frontend-complete.mjs | grep "Test 4"

# 方法2: 手动浏览器测试
open https://www.urlchecker.dev/zh-CN/
# 查看导航栏是否显示: 功能、定价、客户案例、帮助中心
```

### 场景2: 测试认证守卫

```bash
# Playwright自动测试
node scripts/tests/test-frontend-complete.mjs | grep "Test 9"

# 手动验证
curl -IL https://www.urlchecker.dev/en/dashboard
# 应该重定向到 /en/auth?redirect=...
```

### 场景3: 检查重定向次数

```bash
# 方法1: curl
curl -IL https://www.urlchecker.dev/ 2>&1 | grep "HTTP"
# 预期: 只有2个HTTP响应(1次重定向)

# 方法2: Playwright (更准确)
node scripts/tests/test-frontend-complete.mjs | grep "重定向次数"
# 预期: 重定向次数: 1 (优秀)
```

### 场景4: 性能测试

```bash
# DOM解析时间
node scripts/tests/test-frontend-complete.mjs | grep "Test 12"

# TTFB测试
curl -o /dev/null -s -w "TTFB: %{time_starttransfer}s\n" \
  https://www.urlchecker.dev/en/
```

---

## 🔧 常见问题排查

### 问题1: 测试超时

```bash
# 症状
Error: page.goto: Timeout 30000ms exceeded

# 解决方案
1. 检查网站是否可访问: curl -I https://www.urlchecker.dev/
2. 增加超时时间: 在测试代码中设置 timeout: 60000
3. 检查网络连接
```

### 问题2: Playwright浏览器未安装

```bash
# 症状
Error: Executable doesn't exist at /path/to/chromium

# 解决方案
npx playwright install chromium
```

### 问题3: 中文字符显示为乱码

```bash
# 症状
grep输出中文为 ???

# 解决方案
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
```

### 问题4: CI/CD中测试失败但本地通过

```bash
# 可能原因
1. 环境变量未设置: 检查 PREVIEW_BASE, HEADLESS
2. 浏览器未安装: 确保CI中有 npx playwright install
3. 超时设置: CI环境通常更慢，需要增加超时
4. 时区差异: 使用UTC时间
```

---

## 📊 测试结果解读

### 成功示例

```
✅ 通过: 13
❌ 失败: 0
⏭️  跳过: 4
📈 通过率: 100%

详细结果:
✅ Test 1: 根路径重定向
✅ Test 2: 品牌一致性检查
✅ Test 3: 英文导航栏
✅ Test 4: 中文导航栏（关键测试）
...
```

**解读**:
- 所有未登录态测试通过
- 跳过的4个是登录态测试（需要OAuth）
- 总体健康度: 优秀 ✅

### 失败示例

```
✅ 通过: 11
❌ 失败: 2
⏭️  跳过: 4
📈 通过率: 84%

详细结果:
✅ Test 1: 根路径重定向
❌ Test 4: 中文导航栏（关键测试）
   └─ 缺少中文导航链接: 功能, 定价
```

**解读**:
- i18n可能未正确初始化
- 需要检查 `useTranslation` 钩子
- 查看浏览器控制台是否有错误

---

## 🎨 测试最佳实践

### DO ✅

```javascript
// ✅ 使用语义化选择器
await page.getByRole('button', { name: '删除' })

// ✅ 使用waitFor确保元素出现
await expect(page.getByText('删除成功')).toBeVisible()

// ✅ 独立的测试数据
const testData = await createTestProject()

// ✅ 清理测试数据
test.afterEach(async () => {
  await testData.cleanup()
})
```

### DON'T ❌

```javascript
// ❌ 硬编码等待时间
await page.waitForTimeout(5000)

// ❌ 脆弱的选择器
await page.click('.css-12345')

// ❌ 依赖生产数据
const project = await getProjectById('prod-id-123')

// ❌ 不清理测试数据
// 会导致数据库污染
```

---

## 📚 相关文档链接

| 文档 | 用途 | 链接 |
|------|------|------|
| 完整测试策略 | 技术方案、架构设计 | [frontend-test-strategy.md](./frontend-test-strategy.md) |
| 任务追踪看板 | 进度追踪、责任分配 | [test-tasks-tracking.md](./test-tasks-tracking.md) |
| 测试结果报告 | 执行结果、问题记录 | [frontend-test-results-*.md](./frontend-test-results-20251011.md) |
| Playwright官方文档 | API参考 | https://playwright.dev/ |
| Storybook官方文档 | 组件测试 | https://storybook.js.org/ |

---

## 🆘 获取帮助

### 测试失败怎么办？

1. **查看详细日志**
   ```bash
   node scripts/tests/test-frontend-complete.mjs 2>&1 | tee test-output.log
   ```

2. **启用调试模式**
   ```bash
   DEBUG=pw:api node scripts/tests/test-frontend-complete.mjs
   ```

3. **查看截图**（失败时自动生成）
   ```bash
   ls test-results/**/screenshot-*.png
   ```

4. **联系相关人员**
   - E2E测试: QA团队
   - 后端API: 后端开发
   - CI/CD: DevOps团队

---

## 🔖 快捷键备忘

### Playwright UI模式 (调试神器)

```bash
# 启动UI模式
npx playwright test --ui

# 快捷键
- F5: 运行测试
- F8: 暂停
- F10: 单步跳过
- F11: 单步进入
```

### Storybook快捷键 (待实施后使用)

```
- A: 展开/折叠侧边栏
- S: 搜索组件
- D: 切换深色模式
- F: 全屏模式
```

---

## 📈 测试覆盖率目标

| 时间 | E2E测试项 | 组件Stories | 单元测试覆盖率 |
|------|----------|------------|--------------|
| **当前** | 13 | 0 | 0% |
| **1个月后** | 25 | 15 | 60% |
| **3个月后** | 50 | 30 | 80% |

---

**最后更新**: 2025-10-11
**维护者**: 测试团队
