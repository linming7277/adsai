# 测试快速启动指南

**最后更新**: 2025-10-11
**适用对象**: 开发人员、QA工程师

---

## 🚀 5分钟快速开始

### 1. 准备环境

```bash
# 确认Node.js版本
node --version  # 需要 v18+

# 确认在项目根目录
cd /Users/jason/Documents/Kiro/autoads

# 安装依赖 (如果还未安装)
npm install
```

### 2. 生成测试数据

```bash
# 设置环境变量
export NEXT_PUBLIC_SUPABASE_URL="https://jzzvizacfyipzdyiqfzb.supabase.co"
export SUPABASE_SERVICE_KEY="你的服务密钥"

# 运行种子数据脚本
node scripts/tests/seed-test-data.mjs

# 预期输出：
# ✅ 已创建100个Offers
# ✅ 已创建50个Tasks
# ✅ Token余额: 10000
# ✅ 已创建5个广告账户连接
```

### 3. 运行测试

```bash
# 运行所有E2E测试 (无头模式)
PREVIEW_BASE=https://www.urlchecker.dev node scripts/tests/run-all-tests.mjs

# 或使用浏览器可见模式 (调试用)
PREVIEW_BASE=https://www.urlchecker.dev \
HEADLESS=false \
node scripts/tests/run-all-tests.mjs
```

### 4. 查看报告

```bash
# 测试完成后，查看最新报告
cat test-reports/e2e-report-*.md | tail -100

# 或在浏览器中打开
open test-reports/
```

---

## 📋 常用命令

### 运行单个测试

```bash
# Dashboard测试
PREVIEW_BASE=https://www.urlchecker.dev \
node scripts/tests/test-dashboard-overview.mjs

# 订阅管理测试
PREVIEW_BASE=https://www.urlchecker.dev \
node scripts/tests/test-subscription-management.mjs

# Token管理测试
PREVIEW_BASE=https://www.urlchecker.dev \
node scripts/tests/test-token-management.mjs
```

### 调试模式

```bash
# 浏览器可见 + 慢速执行
PREVIEW_BASE=https://www.urlchecker.dev \
HEADLESS=false \
SLOWMO=100 \
node scripts/tests/test-dashboard-overview.mjs
```

### 清理测试数据

```bash
# 重新生成干净的测试数据
node scripts/tests/seed-test-data.mjs
```

---

## 🔍 故障排查

### 问题1: "环境变量未设置"

**错误**:
```
❌ 缺少环境变量:
   NEXT_PUBLIC_SUPABASE_URL: ✗
   SUPABASE_SERVICE_KEY: ✗
```

**解决**:
```bash
# 从Secret Manager获取环境变量
gcloud secrets versions access latest \
  --secret="SUPABASE_SERVICE_KEY" \
  --project="gen-lang-client-0944935873"

# 或使用.env文件
cat > .env.test << EOF
NEXT_PUBLIC_SUPABASE_URL=https://jzzvizacfyipzdyiqfzb.supabase.co
SUPABASE_SERVICE_KEY=你的密钥
EOF

# 加载环境变量
export $(cat .env.test | xargs)
```

---

### 问题2: "Playwright超时"

**错误**:
```
locator.click: Timeout 30000ms exceeded.
```

**解决**:
1. 检查预发环境是否运行正常
   ```bash
   curl https://www.urlchecker.dev/api/health
   ```

2. 使用浏览器可见模式检查页面
   ```bash
   HEADLESS=false node scripts/tests/test-dashboard-overview.mjs
   ```

3. 检查测试选择器是否正确
   ```javascript
   // 在测试文件中添加调试
   await page.screenshot({ path: 'debug.png' });
   console.log(await page.content());
   ```

---

### 问题3: "测试数据缺失"

**错误**:
```
❌ 未找到账户列表或空状态提示
```

**解决**:
```bash
# 重新生成测试数据
node scripts/tests/seed-test-data.mjs

# 验证数据已创建
# 访问 https://www.urlchecker.dev/en/dashboard
# 手动登录 test-user@autoads.dev 检查是否有数据
```

---

### 问题4: "Supabase连接失败"

**错误**:
```
Error: Invalid API key
```

**解决**:
```bash
# 验证Supabase连接
curl -H "apikey: 你的ANON_KEY" \
     "https://jzzvizacfyipzdyiqfzb.supabase.co/rest/v1/Offer?select=count"

# 检查Service Key权限
# 在Supabase Dashboard -> Settings -> API 中确认Service Key
```

---

## 📊 理解测试报告

### 终端输出

```
🚀 开始运行E2E测试套件

============================================================
📦 认证与登录
============================================================

🔴 程序化登录... ✅ (14.4s)
   详情: 4 passed, 0 failed

============================================================
📦 核心功能
============================================================

🔴 Dashboard概览... ❌ (48.1s)
   详情: 2 passed, 4 failed
   错误: 只找到0/4个统计卡片
```

**图例**:
- 🔴 = 关键测试 (P0, 必须通过)
- ⚪️ = 一般测试 (P1/P2)
- ✅ = 通过
- ❌ = 失败
- ⏭️ = 跳过

---

### JSON报告结构

```json
{
  "total": 12,
  "passed": 1,
  "failed": 11,
  "suites": [
    {
      "category": "认证与登录",
      "tests": [
        {
          "name": "程序化登录",
          "status": "passed",
          "duration": 14416,
          "passed": 4,
          "failed": 0
        }
      ]
    }
  ]
}
```

---

### Markdown报告示例

```markdown
## 📊 总体统计

| 指标 | 数值 |
|------|------|
| 总测试数 | 12 |
| ✅ 通过 | 1 (8.3%) |
| ❌ 失败 | 11 |

## 📦 分类测试结果

### 认证与登录

| 测试名称 | 状态 | 耗时 | 关键 |
|----------|------|------|------|
| 程序化登录 | ✅ 通过 | 14.4s | 🔴 |
```

---

## 🛠️ 开发者工作流

### 修复Bug后的验证流程

```bash
# 1. 修复代码
# 编辑前端组件...

# 2. 本地验证
npm run dev
# 手动测试修复的功能

# 3. 部署到预发环境
git add .
git commit -m "fix: UI component rendering"
git push origin main
# 等待CI/CD部署完成

# 4. 运行E2E测试
node scripts/tests/run-all-tests.mjs

# 5. 检查结果
# 如果通过率 > 80%，继续下一个任务
# 如果仍有失败，查看详细报告并继续修复
```

---

### 添加新测试

```javascript
// scripts/tests/test-new-feature.mjs
#!/usr/bin/env node

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. 程序化登录
    await setupAuthForTest(page, 'user');

    // 2. 导航到目标页面
    await page.goto(`${BASE_URL}/en/dashboard/new-feature`);

    // 3. 测试逻辑
    const element = await page.locator('[data-testid="new-feature-button"]');
    await expect(element).toBeVisible();
    console.log('✅ 新功能按钮可见');

    // 4. 执行操作
    await element.click();
    await page.waitForSelector('[data-testid="success-message"]');
    console.log('✅ 操作成功');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
```

---

## 📚 参考文档

- [完整测试方案](./COMPREHENSIVE_TEST_PLAN.md)
- [测试执行计划](./TEST_EXECUTION_PLAN.md)
- [关键问题跟踪](./CRITICAL_ISSUES_2025-10-11.md)
- [修复代码示例](./FIX_EXAMPLES.md)

---

## 💬 获取帮助

### 常见问题

**Q: 测试运行太慢怎么办？**

A: 可以并行运行部分独立测试:
```bash
# 终端1
node scripts/tests/test-dashboard-overview.mjs &

# 终端2
node scripts/tests/test-subscription-management.mjs &

# 等待所有任务完成
wait
```

**Q: 如何只运行关键测试？**

A: 修改 `run-all-tests.mjs` 的 `TEST_SUITES` 配置:
```javascript
const TEST_SUITES = [
  {
    category: '认证与登录',
    tests: [
      { name: '程序化登录', file: 'test-programmatic-login.mjs', critical: true },
    ]
  },
  {
    category: '核心功能',
    tests: [
      // 只保留 critical: true 的测试
      { name: 'Dashboard概览', file: 'test-dashboard-overview.mjs', critical: true },
    ]
  },
];
```

**Q: 如何在CI/CD中运行测试？**

A: 在 GitHub Actions 中添加:
```yaml
- name: Run E2E Tests
  env:
    PREVIEW_BASE: https://www.urlchecker.dev
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
  run: |
    node scripts/tests/seed-test-data.mjs
    node scripts/tests/run-all-tests.mjs
```

---

**文档版本**: v1.0
**最后更新**: 2025-10-11
**维护者**: QA Team
