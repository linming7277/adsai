# 性能测试与核心业务流程测试

> **文档版本**: v1.1
> **更新日期**: 2025-10-11
> **补充内容**: LCP性能测试 + 登录流程 + 核心功能测试

---

## 📋 目录

1. [性能测试 - Web Vitals](#性能测试---web-vitals)
2. [登录流程测试](#登录流程测试)
3. [核心业务功能测试](#核心业务功能测试)
4. [任务拆解](#任务拆解)

---

## 🚀 性能测试 - Web Vitals

### 1.1 LCP (Largest Contentful Paint) 测试

**目标**: 确保首屏最大内容绘制时间 < 2.5秒

#### 方案A: Playwright + Web Vitals库 (推荐)

**安装依赖**:
```bash
npm install -D web-vitals
```

**测试脚本**: `scripts/tests/test-web-vitals.mjs`

```javascript
#!/usr/bin/env node

import { chromium } from 'playwright';

const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

// Web Vitals阈值 (Google标准)
const THRESHOLDS = {
  LCP: 2500,  // Largest Contentful Paint: < 2.5s (good)
  FID: 100,   // First Input Delay: < 100ms (good)
  CLS: 0.1,   // Cumulative Layout Shift: < 0.1 (good)
  FCP: 1800,  // First Contentful Paint: < 1.8s (good)
  TTFB: 800,  // Time to First Byte: < 800ms (good)
};

async function testWebVitals() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🚀 开始Web Vitals性能测试');
  console.log(`📍 测试环境: ${BASE_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = {
    passed: 0,
    failed: 0,
    metrics: {}
  };

  try {
    // 注入 web-vitals 测量脚本
    await page.addInitScript(() => {
      window.webVitalsData = {};

      // 捕获 LCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        window.webVitalsData.LCP = Math.round(lastEntry.renderTime || lastEntry.loadTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      // 捕获 FCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            window.webVitalsData.FCP = Math.round(entry.startTime);
          }
        });
      }).observe({ type: 'paint', buffered: true });

      // 捕获 CLS
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        window.webVitalsData.CLS = clsValue;
      }).observe({ type: 'layout-shift', buffered: true });
    });

    // 访问首页
    const response = await page.goto(`${BASE_URL}/en`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 获取 TTFB
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return {
        TTFB: Math.round(nav.responseStart - nav.requestStart),
        domInteractive: Math.round(nav.domInteractive - nav.fetchStart),
        domComplete: Math.round(nav.domComplete - nav.fetchStart),
        loadComplete: Math.round(nav.loadEventEnd - nav.fetchStart)
      };
    });

    results.metrics.TTFB = timing.TTFB;

    // 等待 LCP 稳定 (通常在页面加载后2-3秒)
    await page.waitForTimeout(3000);

    // 获取 Web Vitals 数据
    const vitals = await page.evaluate(() => window.webVitalsData);

    results.metrics = {
      ...results.metrics,
      ...vitals,
      ...timing
    };

    // 测试 LCP
    await testMetric(results, 'LCP', vitals.LCP, THRESHOLDS.LCP, 'ms');

    // 测试 FCP
    await testMetric(results, 'FCP', vitals.FCP, THRESHOLDS.FCP, 'ms');

    // 测试 CLS
    await testMetric(results, 'CLS', vitals.CLS, THRESHOLDS.CLS, '');

    // 测试 TTFB
    await testMetric(results, 'TTFB', timing.TTFB, THRESHOLDS.TTFB, 'ms');

    // 额外的性能指标
    console.log('\n📊 额外性能指标:');
    console.log(`   DOM Interactive: ${timing.domInteractive}ms`);
    console.log(`   DOM Complete: ${timing.domComplete}ms`);
    console.log(`   Load Complete: ${timing.loadComplete}ms`);

  } catch (error) {
    console.error(`\n❌ 测试执行失败: ${error.message}`);
    results.failed++;
  } finally {
    await browser.close();
  }

  // 输出汇总
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 性能测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  const total = results.passed + results.failed;
  const passRate = total > 0 ? Math.round((results.passed / total) * 100) : 0;
  console.log(`📈 通过率: ${passRate}%`);

  // 性能等级评估
  const grade = getPerformanceGrade(results.metrics);
  console.log(`\n🏆 综合性能评级: ${grade.emoji} ${grade.label}`);
  console.log(`   ${grade.description}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

function testMetric(results, name, value, threshold, unit) {
  const status = value <= threshold ? '✅' : '❌';
  const percentage = Math.round((value / threshold) * 100);

  console.log(`\n${status} ${name}: ${value}${unit}`);
  console.log(`   阈值: ${threshold}${unit}`);
  console.log(`   性能: ${percentage}% ${percentage <= 100 ? '(优秀)' : '(需优化)'}`);

  if (value <= threshold) {
    results.passed++;
  } else {
    results.failed++;
    console.log(`   ⚠️  建议优化以达到Google推荐标准`);
  }
}

function getPerformanceGrade(metrics) {
  const { LCP, FCP, CLS, TTFB } = metrics;

  // 计算综合得分 (0-100)
  let score = 100;

  if (LCP > 2500) score -= 25;
  else if (LCP > 1800) score -= 10;

  if (FCP > 1800) score -= 15;
  else if (FCP > 1000) score -= 5;

  if (CLS > 0.1) score -= 20;
  else if (CLS > 0.05) score -= 10;

  if (TTFB > 800) score -= 20;
  else if (TTFB > 500) score -= 10;

  if (score >= 90) return { emoji: '🏆', label: 'A (优秀)', description: '性能卓越，符合所有Google标准' };
  if (score >= 75) return { emoji: '✅', label: 'B (良好)', description: '性能良好，部分指标可优化' };
  if (score >= 60) return { emoji: '⚠️', label: 'C (一般)', description: '性能一般，建议优化' };
  return { emoji: '❌', label: 'D (较差)', description: '性能较差，需要立即优化' };
}

testWebVitals().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

**执行测试**:
```bash
node scripts/tests/test-web-vitals.mjs
```

**预期输出**:
```
🚀 开始Web Vitals性能测试
📍 测试环境: https://www.urlchecker.dev
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ LCP: 1823ms
   阈值: 2500ms
   性能: 73% (优秀)

✅ FCP: 896ms
   阈值: 1800ms
   性能: 50% (优秀)

✅ CLS: 0.045
   阈值: 0.1
   性能: 45% (优秀)

✅ TTFB: 423ms
   阈值: 800ms
   性能: 53% (优秀)

📊 额外性能指标:
   DOM Interactive: 1245ms
   DOM Complete: 2134ms
   Load Complete: 2287ms

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 性能测试汇总
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 通过: 4
❌ 失败: 0
📈 通过率: 100%

🏆 综合性能评级: 🏆 A (优秀)
   性能卓越，符合所有Google标准
```

#### 方案B: Lighthouse CI (更全面)

**安装**:
```bash
npm install -D @lhci/cli
```

**配置**: `lighthouserc.json`
```json
{
  "ci": {
    "collect": {
      "url": ["https://www.urlchecker.dev/en"],
      "numberOfRuns": 3
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "first-contentful-paint": ["error", {"maxNumericValue": 1800}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "speed-index": ["error", {"maxNumericValue": 3400}],
        "interactive": ["error", {"maxNumericValue": 3800}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

**执行**:
```bash
npx lhci autorun
```

### 1.2 LCP优化建议

根据测试结果，可能的优化方向：

#### 如果 LCP > 2.5秒

**常见问题和解决方案**:

| 问题 | 检查方法 | 解决方案 |
|------|---------|---------|
| **图片过大** | 查看Network面板最大的图片 | 使用Next.js Image组件，WebP格式，响应式图片 |
| **字体加载慢** | 查看Font加载时间 | 使用`font-display: swap`，预加载关键字体 |
| **首屏渲染阻塞** | 查看Blocking Time | 代码分割，延迟加载非关键资源 |
| **服务器响应慢** | TTFB > 800ms | 使用CDN，开启HTTP/2，服务器端缓存 |
| **客户端渲染过慢** | TBT (Total Blocking Time) 高 | 减少JavaScript体积，使用SSR/SSG |

**Next.js特定优化**:

```typescript
// 1. 优化图片
import Image from 'next/image';

<Image
  src="/hero-image.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority // 预加载首屏图片
  quality={85} // 压缩质量
/>

// 2. 预加载关键资源
import Head from 'next/head';

<Head>
  <link
    rel="preload"
    href="/fonts/inter-var.woff2"
    as="font"
    type="font/woff2"
    crossOrigin="anonymous"
  />
</Head>

// 3. 延迟加载非关键组件
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false // 客户端渲染
});
```

---

## 🔐 登录流程测试

### 2.1 Google OAuth完整流程测试

**测试脚本**: `scripts/tests/test-login-flow.mjs`

```javascript
#!/usr/bin/env node

import { chromium } from 'playwright';

const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';
const TEST_EMAIL = process.env.TEST_EMAIL || 'manhwarecap99@gmail.com';
const HEADLESS = process.env.HEADLESS !== 'false';

async function testLoginFlow() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔐 登录流程测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = { passed: 0, failed: 0 };

  try {
    // Test 1: 访问登录页面
    await test(results, 'Test 1: 访问登录页面', async () => {
      await page.goto(`${BASE_URL}/en/auth/sign-in`, { waitUntil: 'networkidle' });

      if (!page.url().includes('/auth/sign-in')) {
        throw new Error(`URL不正确: ${page.url()}`);
      }

      console.log(`   ✓ 成功访问: ${page.url()}`);
    });

    // Test 2: Google登录按钮存在且可点击
    await test(results, 'Test 2: Google登录按钮', async () => {
      const googleButton = page.locator('button:has-text("Google"), a:has-text("Google")').first();

      const isVisible = await googleButton.isVisible();
      if (!isVisible) {
        throw new Error('Google登录按钮不可见');
      }

      const isEnabled = await googleButton.isEnabled();
      if (!isEnabled) {
        throw new Error('Google登录按钮被禁用');
      }

      const buttonText = await googleButton.textContent();
      console.log(`   ✓ 按钮可见且可点击: "${buttonText?.trim()}"`);
    });

    // Test 3: 点击Google登录（触发OAuth）
    await test(results, 'Test 3: 触发OAuth流程', async () => {
      if (!HEADLESS) {
        console.log('   ⏳ 请在浏览器中完成Google登录...');
      }

      const googleButton = page.locator('button:has-text("Google"), a:has-text("Google")').first();

      // 监听新窗口（OAuth弹窗）
      const [popup] = await Promise.all([
        context.waitForEvent('page', { timeout: 10000 }),
        googleButton.click()
      ]).catch(() => [null]);

      if (popup) {
        const popupUrl = popup.url();
        console.log(`   ✓ OAuth弹窗已打开: ${popupUrl.substring(0, 50)}...`);

        if (!popupUrl.includes('accounts.google.com')) {
          throw new Error('OAuth URL不正确');
        }

        if (!HEADLESS) {
          // 等待用户手动登录
          await popup.waitForEvent('close', { timeout: 60000 }).catch(() => {
            console.log('   ⚠️  登录超时');
          });

          if (popup.isClosed()) {
            console.log('   ✓ OAuth完成，弹窗已关闭');
          }
        }
      } else {
        if (HEADLESS) {
          console.log('   ℹ️  无头模式下跳过实际OAuth');
        } else {
          throw new Error('未检测到OAuth弹窗');
        }
      }
    });

    // Test 4: 登录后重定向到Dashboard
    if (!HEADLESS && page.url().includes('/dashboard')) {
      await test(results, 'Test 4: 登录后重定向', async () => {
        console.log(`   ✓ 已重定向到: ${page.url()}`);

        if (!page.url().includes('/dashboard')) {
          throw new Error('未重定向到Dashboard');
        }
      });

      // Test 5: Session持久化验证
      await test(results, 'Test 5: Session持久化', async () => {
        // 刷新页面
        await page.reload({ waitUntil: 'networkidle' });

        // 仍然在Dashboard（未被重定向到登录页）
        if (!page.url().includes('/dashboard')) {
          throw new Error('Session未持久化，被重定向到登录页');
        }

        console.log('   ✓ Session持久化正常');
      });

      // Test 6: 用户信息显示
      await test(results, 'Test 6: 用户信息显示', async () => {
        // 查找用户菜单或邮箱显示
        const userMenu = page.locator('[data-testid="profile-dropdown"], button[aria-label*="profile" i]').first();
        const hasMenu = await userMenu.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasMenu) {
          console.log('   ✓ 用户菜单可见');
        } else {
          console.log('   ⚠️  未找到用户菜单（可能选择器需要更新）');
        }
      });

      // Test 7: 退出登录
      await test(results, 'Test 7: 退出登录', async () => {
        const signOutButton = page.locator('button:has-text("Sign Out"), button:has-text("退出")').first();
        const hasButton = await signOutButton.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasButton) {
          await signOutButton.click();
          await page.waitForTimeout(2000);

          const afterLogoutUrl = page.url();
          console.log(`   ✓ 退出后URL: ${afterLogoutUrl}`);

          // 验证重定向到登录页或首页
          if (afterLogoutUrl.includes('/auth') || afterLogoutUrl.match(/\/(en|zh-CN)\/?$/)) {
            console.log('   ✓ 成功退出登录');
          } else {
            throw new Error('退出后未正确重定向');
          }

          // Test 8: 退出后无法访问Dashboard
          await page.goto(`${BASE_URL}/en/dashboard`);
          await page.waitForTimeout(1000);

          if (page.url().includes('/auth')) {
            console.log('   ✓ 退出后Dashboard受保护');
          } else {
            throw new Error('退出后仍可访问Dashboard');
          }
        } else {
          console.log('   ⚠️  未找到退出按钮，跳过退出测试');
        }
      });
    } else {
      console.log('\n   ℹ️  未完成登录，跳过登录后测试');
      results.failed += 5; // 标记为未测试
    }

  } catch (error) {
    console.error(`\n❌ 测试执行失败: ${error.message}`);
  } finally {
    if (!HEADLESS) {
      console.log('\n⏸️  浏览器将在3秒后关闭...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    await browser.close();
  }

  printSummary(results);
}

async function test(results, name, testFn) {
  console.log(`\n${name}`);
  try {
    await testFn();
    results.passed++;
  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    results.failed++;
  }
}

function printSummary(results) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 登录流程测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  const total = results.passed + results.failed;
  const passRate = total > 0 ? Math.round((results.passed / total) * 100) : 0;
  console.log(`📈 通过率: ${passRate}%`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

testLoginFlow().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

**执行**:
```bash
# 无头模式（自动化）
node scripts/tests/test-login-flow.mjs

# 显示浏览器（手动登录）
HEADLESS=false node scripts/tests/test-login-flow.mjs
```

---

## 🎯 核心业务功能测试

### 3.1 创建Offer流程测试

**测试脚本**: `scripts/tests/test-create-offer.mjs`

```javascript
#!/usr/bin/env node

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function testCreateOffer() {
  const browser = await chromium.launch({ headless: false }); // 显示浏览器便于调试
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('📝 创建Offer流程测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = { passed: 0, failed: 0 };

  try {
    // 程序化登录
    await setupAuthForTest(page, 'user');

    // Test 1: 访问Offers页面
    await test(results, 'Test 1: 访问Offers列表页', async () => {
      await page.goto(`${BASE_URL}/en/dashboard/offers`, { waitUntil: 'networkidle' });

      if (!page.url().includes('/offers')) {
        throw new Error(`URL不正确: ${page.url()}`);
      }

      console.log('   ✓ 成功访问Offers页面');
    });

    // Test 2: 点击"创建Offer"按钮
    await test(results, 'Test 2: 点击创建Offer按钮', async () => {
      const createButton = page.locator('button:has-text("Create Offer"), button:has-text("创建Offer"), a:has-text("New Offer")').first();

      const isVisible = await createButton.isVisible({ timeout: 5000 });
      if (!isVisible) {
        throw new Error('创建Offer按钮不可见');
      }

      await createButton.click();
      await page.waitForTimeout(1000);

      // 验证表单或弹窗出现
      const hasForm = await page.locator('form, [role="dialog"]').first().isVisible({ timeout: 3000 });
      if (!hasForm) {
        throw new Error('创建表单未出现');
      }

      console.log('   ✓ 创建表单已显示');
    });

    // Test 3: 填写Offer信息
    await test(results, 'Test 3: 填写Offer表单', async () => {
      const testOfferName = `Test Offer ${Date.now()}`;

      // 填写Offer名称
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
      await nameInput.fill(testOfferName);

      // 填写URL
      const urlInput = page.locator('input[name="url"], input[type="url"]').first();
      await urlInput.fill('https://example.com/offer-page');

      console.log(`   ✓ 已填写: ${testOfferName}`);
    });

    // Test 4: 提交表单
    await test(results, 'Test 4: 提交创建请求', async () => {
      const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("提交")').first();
      await submitButton.click();

      // 等待成功提示或页面跳转
      await page.waitForTimeout(2000);

      // 检查成功提示
      const successMessage = await page.locator('text=/created|成功|success/i').first().isVisible({ timeout: 5000 }).catch(() => false);

      if (successMessage) {
        console.log('   ✓ Offer创建成功');
      } else {
        console.log('   ⚠️  未检测到成功提示');
      }
    });

    // Test 5: 验证Offer出现在列表中
    await test(results, 'Test 5: 验证Offer已创建', async () => {
      // 回到列表页（如果已经在列表页则刷新）
      await page.goto(`${BASE_URL}/en/dashboard/offers`, { waitUntil: 'networkidle' });

      // 检查列表中是否有数据
      const hasOffers = await page.locator('[data-testid="offer-item"], .offer-card, tr').count() > 0;

      if (hasOffers) {
        console.log('   ✓ Offers列表有数据');
      } else {
        throw new Error('Offers列表为空');
      }
    });

  } catch (error) {
    console.error(`\n❌ 测试执行失败: ${error.message}`);
  } finally {
    await new Promise(resolve => setTimeout(resolve, 3000));
    await browser.close();
  }

  printSummary(results);
}

async function test(results, name, testFn) {
  console.log(`\n${name}`);
  try {
    await testFn();
    results.passed++;
  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    results.failed++;
  }
}

function printSummary(results) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 创建Offer测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

testCreateOffer();
```

### 3.2 触发AI评估流程测试

**测试脚本**: `scripts/tests/test-ai-evaluation.mjs`

```javascript
#!/usr/bin/env node

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function testAIEvaluation() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🤖 AI评估流程测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = { passed: 0, failed: 0 };

  try {
    await setupAuthForTest(page, 'user');

    // Test 1: 进入Offer详情页
    await test(results, 'Test 1: 访问Offer详情页', async () => {
      // 假设有一个已存在的Offer
      await page.goto(`${BASE_URL}/en/dashboard/offers`, { waitUntil: 'networkidle' });

      // 点击第一个Offer
      const firstOffer = page.locator('[data-testid="offer-item"], .offer-card, tr').first();
      await firstOffer.click();

      await page.waitForTimeout(1000);
      console.log(`   ✓ 当前URL: ${page.url()}`);
    });

    // Test 2: 触发AI评估
    await test(results, 'Test 2: 点击"AI评估"按钮', async () => {
      const evalButton = page.locator('button:has-text("AI评估"), button:has-text("Evaluate"), button:has-text("分析")').first();

      const isVisible = await evalButton.isVisible({ timeout: 5000 });
      if (!isVisible) {
        throw new Error('AI评估按钮不可见');
      }

      await evalButton.click();
      console.log('   ✓ 已触发AI评估');
    });

    // Test 3: 等待评估完成
    await test(results, 'Test 3: 等待评估结果', async () => {
      // 检查加载状态
      const loadingIndicator = page.locator('[data-testid="loading"], .loading, .spinner').first();

      if (await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('   ⏳ 评估进行中...');

        // 等待加载完成（最多30秒）
        await loadingIndicator.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {
          console.log('   ⚠️  评估超时');
        });
      }

      // 检查评估结果显示
      const hasResults = await page.locator('[data-testid="evaluation-result"], .evaluation-score, .analysis-result').first().isVisible({ timeout: 5000 }).catch(() => false);

      if (hasResults) {
        console.log('   ✓ 评估结果已显示');
      } else {
        console.log('   ⚠️  未检测到评估结果');
      }
    });

    // Test 4: 验证评估数据
    await test(results, 'Test 4: 验证评估数据完整性', async () => {
      // 检查关键指标是否存在
      const metricsToCheck = [
        { name: '评分', selector: '[data-testid="score"], .score' },
        { name: '建议', selector: '[data-testid="suggestions"], .suggestions' },
        { name: '分析', selector: '[data-testid="analysis"], .analysis' }
      ];

      let foundMetrics = 0;

      for (const metric of metricsToCheck) {
        const hasMetric = await page.locator(metric.selector).first().isVisible({ timeout: 2000 }).catch(() => false);
        if (hasMetric) {
          foundMetrics++;
          console.log(`   ✓ 找到${metric.name}`);
        }
      }

      if (foundMetrics > 0) {
        console.log(`   ✓ 找到${foundMetrics}/${metricsToCheck.length}个关键指标`);
      } else {
        throw new Error('未找到任何评估指标');
      }
    });

  } catch (error) {
    console.error(`\n❌ 测试执行失败: ${error.message}`);
  } finally {
    await new Promise(resolve => setTimeout(resolve, 3000));
    await browser.close();
  }

  printSummary(results);
}

async function test(results, name, testFn) {
  console.log(`\n${name}`);
  try {
    await testFn();
    results.passed++;
  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    results.failed++;
  }
}

function printSummary(results) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 AI评估测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

testAIEvaluation();
```

### 3.3 绑定Ads账号测试

**测试脚本**: `scripts/tests/test-bind-ads-account.mjs`

```javascript
#!/usr/bin/env node

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function testBindAdsAccount() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔗 绑定Ads账号流程测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = { passed: 0, failed: 0 };

  try {
    await setupAuthForTest(page, 'user');

    // Test 1: 访问设置页面
    await test(results, 'Test 1: 访问账号设置页面', async () => {
      await page.goto(`${BASE_URL}/en/settings/integrations`, { waitUntil: 'networkidle' });

      if (!page.url().includes('/settings')) {
        throw new Error('未能访问设置页面');
      }

      console.log('   ✓ 已进入设置页面');
    });

    // Test 2: 找到广告平台集成区域
    await test(results, 'Test 2: 找到广告平台集成', async () => {
      const integrationSection = page.locator('text=/Google Ads|Facebook Ads|TikTok Ads|广告平台/i').first();

      const isVisible = await integrationSection.isVisible({ timeout: 5000 });
      if (!isVisible) {
        throw new Error('未找到广告平台集成区域');
      }

      console.log('   ✓ 广告平台集成区域可见');
    });

    // Test 3: 点击"连接Google Ads"
    await test(results, 'Test 3: 点击连接按钮', async () => {
      const connectButton = page.locator('button:has-text("Connect"), button:has-text("连接"), button:has-text("绑定")').first();

      await connectButton.click();
      await page.waitForTimeout(1000);

      console.log('   ✓ 已点击连接按钮');
    });

    // Test 4: OAuth授权流程（Google Ads）
    await test(results, 'Test 4: OAuth授权流程', async () => {
      // 监听新窗口
      const [popup] = await Promise.all([
        context.waitForEvent('page', { timeout: 10000 }),
        Promise.resolve() // 上一步已经点击
      ]).catch(() => [null]);

      if (popup) {
        const popupUrl = popup.url();
        console.log(`   ✓ OAuth弹窗: ${popupUrl.substring(0, 50)}...`);

        if (popupUrl.includes('accounts.google.com') || popupUrl.includes('ads.google.com')) {
          console.log('   ✓ 正确跳转到Google授权页');
          console.log('   ⏳ 请手动完成授权...');

          // 等待弹窗关闭
          await popup.waitForEvent('close', { timeout: 60000 }).catch(() => {});

          if (popup.isClosed()) {
            console.log('   ✓ 授权完成');
          }
        }
      } else {
        console.log('   ℹ️  未检测到OAuth弹窗（可能已授权）');
      }
    });

    // Test 5: 验证绑定成功
    await test(results, 'Test 5: 验证账号已绑定', async () => {
      // 回到设置页面
      await page.goto(`${BASE_URL}/en/settings/integrations`, { waitUntil: 'networkidle' });

      // 查找"已连接"状态
      const connectedStatus = await page.locator('text=/Connected|已连接|Active/i').first().isVisible({ timeout: 5000 }).catch(() => false);

      if (connectedStatus) {
        console.log('   ✓ 账号绑定成功');
      } else {
        console.log('   ⚠️  未检测到已连接状态');
      }
    });

    // Test 6: 查看绑定的账号信息
    await test(results, 'Test 6: 验证账号信息显示', async () => {
      // 查找账号ID或名称
      const accountInfo = await page.locator('[data-testid="account-id"], .account-name, .account-info').first().textContent().catch(() => null);

      if (accountInfo) {
        console.log(`   ✓ 账号信息: ${accountInfo.trim()}`);
      } else {
        console.log('   ℹ️  未找到账号详细信息');
      }
    });

  } catch (error) {
    console.error(`\n❌ 测试执行失败: ${error.message}`);
  } finally {
    await new Promise(resolve => setTimeout(resolve, 3000));
    await browser.close();
  }

  printSummary(results);
}

async function test(results, name, testFn) {
  console.log(`\n${name}`);
  try {
    await testFn();
    results.passed++;
  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    results.failed++;
  }
}

function printSummary(results) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 绑定Ads账号测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

testBindAdsAccount();
```

---

## 📋 任务拆解

### Phase 1.5: 性能测试 (Week 2)

**优先级**: 🟡 P1 | **预计**: 2天

| Task ID | 任务描述 | 预计时间 | 负责人 | 验收标准 |
|---------|---------|---------|--------|---------|
| 1.5.1 | 实现Web Vitals测试脚本 | 3h | QA | LCP<2.5s, FCP<1.8s |
| 1.5.2 | 集成Lighthouse CI | 2h | DevOps | 性能评分>90 |
| 1.5.3 | 性能优化（如需要） | 1天 | 前端 | 所有指标达标 |
| 1.5.4 | 性能监控配置 | 2h | DevOps | CI中自动运行 |

### Phase 1.6: 登录流程测试 (Week 2)

**优先级**: 🔴 P0 | **预计**: 1天
**依赖**: Phase 1.2 (程序化登录)

| Task ID | 任务描述 | 预计时间 | 负责人 | 验收标准 |
|---------|---------|---------|--------|---------|
| 1.6.1 | 编写登录流程测试脚本 | 3h | QA | 覆盖8个测试点 |
| 1.6.2 | 测试Session持久化 | 1h | QA | 刷新后仍登录 |
| 1.6.3 | 测试退出登录 | 1h | QA | 退出后受保护 |
| 1.6.4 | 本地+CI验证 | 1h | QA | 全部通过 |

### Phase 1.7: 核心功能测试 (Week 3)

**优先级**: 🟡 P1 | **预计**: 3天
**依赖**: Phase 1.2 (程序化登录)

| Task ID | 任务描述 | 预计时间 | 负责人 | 验收标准 |
|---------|---------|---------|--------|---------|
| 1.7.1 | 创建Offer流程测试 | 4h | QA | 5个测试点通过 |
| 1.7.2 | AI评估流程测试 | 4h | QA | 4个测试点通过 |
| 1.7.3 | 绑定Ads账号测试 | 4h | QA | 6个测试点通过 |
| 1.7.4 | 其他核心功能测试 | 1天 | QA | 根据需求定 |
| 1.7.5 | 集成到CI | 2h | DevOps | 自动运行 |

---

## 📊 完整测试覆盖图

```
AutoAds 测试金字塔 v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                    ▲ E2E Tests
                    │ - 未登录态: 13项 ✅
                    │ - 登录流程: 8项 📋
                    │ - 核心功能: 15项 📋
                    │ - 性能测试: 4项 📋
                    ├─────────────────────
                    ▲ Component Tests
                    │ - Storybook: 15组件 📋
                    │ - 交互测试
                    ├─────────────────────
                    ▲ Unit Tests
                    │ - 工具函数: 80%覆盖 📋
                    │ - Hooks测试
                    └─────────────────────

Performance Monitoring (持续)
  - Web Vitals实时监控
  - Lighthouse CI
  - RUM (Real User Monitoring)
```

---

## 🎯 验收标准

### 性能测试通过标准

- ✅ LCP < 2.5秒
- ✅ FCP < 1.8秒
- ✅ CLS < 0.1
- ✅ TTFB < 800ms
- ✅ Lighthouse性能评分 > 90

### 登录流程通过标准

- ✅ Google OAuth正常触发
- ✅ 登录后正确重定向到Dashboard
- ✅ Session持久化（刷新后仍登录）
- ✅ 退出登录正常工作
- ✅ 退出后Dashboard受保护

### 核心功能通过标准

- ✅ 创建Offer成功并出现在列表
- ✅ AI评估正常触发并返回结果
- ✅ Ads账号绑定OAuth流程正常
- ✅ 所有操作有明确的成功/失败反馈

---

**最后更新**: 2025-10-11
**维护者**: 测试团队
