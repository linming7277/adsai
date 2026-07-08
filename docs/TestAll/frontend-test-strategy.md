# 前端自动化测试策略文档

> **文档版本**: v1.0
> **创建日期**: 2025-10-11
> **负责人**: 开发团队
> **项目**: AutoAds SaaS 应用

---

## 📋 目录

1. [当前测试状态](#当前测试状态)
2. [测试架构设计](#测试架构设计)
3. [实施路线图](#实施路线图)
4. [技术方案详解](#技术方案详解)
5. [任务拆解与追踪](#任务拆解与追踪)

---

## 🎯 当前测试状态

### ✅ 已完成 (2025-10-11)

#### E2E测试框架 - Playwright
- **状态**: ✅ 完成并验证
- **测试脚本**: `scripts/tests/test-frontend-complete.mjs`
- **测试结果**: 13/13 通过 (100%)
- **执行时间**: < 30秒

#### 测试覆盖范围

| 测试类别 | 测试项 | 状态 | 说明 |
|---------|--------|------|------|
| **HTTP路由** | 根路径重定向 | ✅ | 1次重定向，性能优秀 |
| **品牌一致性** | AutoAds品牌检查 | ✅ | 无Makerkit残留 |
| **国际化** | 英文导航栏 | ✅ | Features, Pricing, etc. |
| **国际化** | 中文导航栏 | ✅ | 功能、定价、客户案例、帮助中心 |
| **UI组件** | Footer中文翻译 | ✅ | 产品、资源、公司、安全与合规 |
| **SEO** | Meta标签 | ✅ | description, og:title完整 |
| **主题** | 深色模式切换器 | ✅ | 组件可见 |
| **认证** | 未登录访问Dashboard | ✅ | 正确重定向到/auth |
| **认证** | 登录页面元素 | ✅ | Google登录按钮存在 |
| **公开页面** | 4个公开页面 | ✅ | 全部返回200 |
| **性能** | DOM解析时间 | ✅ | 386ms (优秀) |

### ⚠️ 待完成

| 任务 | 优先级 | 阻塞原因 |
|------|--------|---------|
| 登录态测试 | 🔴 P0 | 需要程序化登录 |
| 多角色权限测试 | 🟡 P1 | 需要程序化登录 |
| 组件测试 (Storybook) | 🟢 P2 | - |
| 视觉回归测试 (Chromatic) | 🟢 P2 | 依赖Storybook |
| CI/CD集成 | 🟡 P1 | - |

---

## 🏗️ 测试架构设计

### 测试金字塔模型

```
        ▲ E2E Tests (10%)
        │ - Playwright端到端测试
        │ - 关键业务流程验证
        │ - 跨浏览器兼容性
        ├─────────────────────
        ▲ Component Tests (20%)
        │ - Storybook + Vitest
        │ - UI组件隔离测试
        │ - 交互行为验证
        ├─────────────────────
        ▲ Unit Tests (70%)
        │ - Jest/Vitest
        │ - 函数、工具类测试
        │ - 业务逻辑验证
        └─────────────────────
```

### 技术栈选型

| 层级 | 工具 | 状态 | 理由 |
|------|------|------|------|
| **E2E** | Playwright | ✅ 已集成 | 跨浏览器、速度快、多tab支持 |
| **组件测试** | Storybook + Vitest | 📋 待实施 | 组件隔离、文档化、社区成熟 |
| **视觉测试** | Chromatic | 📋 待实施 | 像素级UI回归检测 |
| **单元测试** | Vitest | 📋 待实施 | Vite原生支持、速度快 |
| **CI/CD** | GitHub Actions | 📋 待实施 | 项目已在使用 |

---

## 🚀 实施路线图

### Phase 1: E2E测试完善 (Week 1-2)

**目标**: 覆盖未登录态和登录态的所有关键流程

#### Week 1: 程序化登录 (P0)
- [ ] 后端实现测试Session API
- [ ] Playwright集成Session管理
- [ ] 验证登录态测试通过

#### Week 2: 多角色权限测试 (P1)
- [ ] 创建测试账号（admin/user/guest）
- [ ] 编写角色权限边界测试
- [ ] 实现数据隔离机制（Seed/Teardown）

### Phase 2: CI/CD集成 (Week 3)

**目标**: 自动化测试在每次代码提交时运行

- [ ] GitHub Actions工作流配置
- [ ] PR门禁（测试失败阻止合并）
- [ ] 测试报告自动生成
- [ ] 通知机制（Slack/Email）

### Phase 3: 组件测试体系 (Week 4-5)

**目标**: 建立组件级测试和视觉回归检测

#### Week 4: Storybook搭建
- [ ] Storybook初始化
- [ ] 核心组件Stories (Navbar, Footer, ThemeSelector)
- [ ] 交互测试 (Interaction Testing)

#### Week 5: Chromatic集成
- [ ] Chromatic账号配置
- [ ] 视觉回归基线建立
- [ ] CI集成（自动对比）

### Phase 4: 单元测试补充 (Week 6+)

**目标**: 为工具函数、hooks等编写单元测试

- [ ] Vitest配置
- [ ] 工具函数测试覆盖率 >80%
- [ ] React Hooks测试
- [ ] 业务逻辑层测试

---

## 🔧 技术方案详解

### 1. 程序化登录方案（解决Google OAuth问题）

#### 问题
- AutoAds使用Google OAuth，无密码登录
- 每个测试都通过UI登录太慢（>5秒/次）
- 无头模式下无法完成OAuth交互

#### 解决方案A: 后端测试Session API (推荐)

**后端实现** (`apps/backend/api/test/create-session.go`):

```go
package test

import (
    "encoding/json"
    "net/http"
    "os"
)

// CreateTestSession 为测试创建认证Session
// 仅在测试环境下可用
func CreateTestSession(w http.ResponseWriter, r *http.Request) {
    // 安全检查：仅在测试环境启用
    if os.Getenv("APP_ENV") != "test" && os.Getenv("APP_ENV") != "development" {
        http.Error(w, "Forbidden", http.StatusForbidden)
        return
    }

    var req struct {
        Email string `json:"email"`
        Role  string `json:"role"` // admin, user, guest
    }

    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request", http.StatusBadRequest)
        return
    }

    // 获取或创建测试用户
    user, err := getOrCreateTestUser(req.Email, req.Role)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    // 生成Supabase JWT token
    accessToken, refreshToken, err := supabase.GenerateTestTokens(user.ID)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    json.NewEncoder(w).Encode(map[string]string{
        "access_token":  accessToken,
        "refresh_token": refreshToken,
        "user_id":       user.ID,
        "email":         user.Email,
        "role":          user.Role,
    })
}

func getOrCreateTestUser(email, role string) (*User, error) {
    // 实现用户创建/获取逻辑
    // ...
}
```

**Playwright集成** (`scripts/tests/helpers/auth.mjs`):

```javascript
export async function setupAuthForTest(page, userRole = 'user') {
    const roleEmailMap = {
        admin: 'test-admin@autoads.dev',
        user: 'test-user@autoads.dev',
        guest: 'test-guest@autoads.dev'
    };

    const email = roleEmailMap[userRole];

    // 调用后端测试API获取Session
    const response = await page.request.post(`${BASE_URL}/api/test/create-session`, {
        data: { email, role: userRole }
    });

    if (!response.ok()) {
        throw new Error(`创建测试Session失败: ${response.status()}`);
    }

    const { access_token, refresh_token } = await response.json();

    // 设置Supabase认证cookies
    await page.context().addCookies([
        {
            name: 'sb-access-token',
            value: access_token,
            domain: new URL(BASE_URL).hostname,
            path: '/',
            httpOnly: false,
            secure: true,
            sameSite: 'Lax'
        },
        {
            name: 'sb-refresh-token',
            value: refresh_token,
            domain: new URL(BASE_URL).hostname,
            path: '/',
            httpOnly: false,
            secure: true,
            sameSite: 'Lax'
        }
    ]);

    // 同时设置localStorage（Supabase可能使用）
    await page.addInitScript((tokens) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token
        }));
    }, { access_token, refresh_token });

    console.log(`✅ 已设置${userRole}角色的测试Session`);
}
```

**使用示例**:

```javascript
import { test, expect } from '@playwright/test';
import { setupAuthForTest } from './helpers/auth.mjs';

test('管理员可以访问用户管理页面', async ({ page }) => {
    // 设置admin认证
    await setupAuthForTest(page, 'admin');

    // 直接访问受保护页面
    await page.goto('/manage/users');

    // 验证页面加载成功
    await expect(page.getByRole('heading', { name: '用户管理' })).toBeVisible();
});

test('普通用户不能访问用户管理页面', async ({ page }) => {
    await setupAuthForTest(page, 'user');

    await page.goto('/manage/users');

    // 应该被重定向或显示403
    expect(page.url()).toMatch(/\/(auth|403)/);
});
```

#### 解决方案B: Session录制重放 (快速方案)

适用于快速启动，但需要定期更新。

```javascript
// 一次性录制
test('录制认证状态', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth/sign-in`);

    // 暂停，手动完成Google登录
    await page.pause();

    // 保存完整的认证状态
    const storageState = await page.context().storageState();
    fs.writeFileSync('test-fixtures/auth-state-user.json', JSON.stringify(storageState, null, 2));
});

// 后续测试复用
test.use({ storageState: 'test-fixtures/auth-state-user.json' });

test('访问Dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // 已经处于登录态 ✅
});
```

### 2. 多角色权限测试

**测试矩阵**:

| 路径 | Guest | User | Admin |
|------|-------|------|-------|
| `/` | ✅ 200 | ✅ 200 | ✅ 200 |
| `/features` | ✅ 200 | ✅ 200 | ✅ 200 |
| `/dashboard` | ❌ →/auth | ✅ 200 | ✅ 200 |
| `/settings/profile` | ❌ →/auth | ✅ 200 | ✅ 200 |
| `/manage/users` | ❌ →/auth | ❌ 403 | ✅ 200 |
| `/manage/billing` | ❌ →/auth | ❌ 403 | ✅ 200 |

**测试代码** (`scripts/tests/test-role-permissions.mjs`):

```javascript
import { test, expect } from '@playwright/test';
import { setupAuthForTest } from './helpers/auth.mjs';

const ROLE_PERMISSIONS = [
    {
        role: 'guest',
        canAccess: ['/', '/features', '/pricing'],
        redirectToAuth: ['/dashboard', '/settings', '/manage'],
        forbidden: []
    },
    {
        role: 'user',
        canAccess: ['/', '/features', '/dashboard', '/settings/profile'],
        redirectToAuth: [],
        forbidden: ['/manage/users', '/manage/billing']
    },
    {
        role: 'admin',
        canAccess: ['/', '/dashboard', '/settings', '/manage/users'],
        redirectToAuth: [],
        forbidden: []
    }
];

for (const { role, canAccess, redirectToAuth, forbidden } of ROLE_PERMISSIONS) {
    test.describe(`${role}角色权限测试`, () => {
        test.beforeEach(async ({ page }) => {
            if (role !== 'guest') {
                await setupAuthForTest(page, role);
            }
        });

        for (const path of canAccess) {
            test(`${role}可以访问${path}`, async ({ page }) => {
                const response = await page.goto(`${BASE_URL}${path}`);
                expect(response.status()).toBe(200);
                expect(page.url()).not.toContain('/auth');
            });
        }

        for (const path of redirectToAuth) {
            test(`${role}访问${path}重定向到登录页`, async ({ page }) => {
                await page.goto(`${BASE_URL}${path}`);
                expect(page.url()).toContain('/auth');
            });
        }

        for (const path of forbidden) {
            test(`${role}访问${path}返回403`, async ({ page }) => {
                const response = await page.goto(`${BASE_URL}${path}`);
                expect([403, 404]).toContain(response.status());
            });
        }
    });
}
```

### 3. 数据隔离策略

**原则**: 每个测试用例应该有独立的测试数据，互不干扰。

**实现** (`scripts/tests/helpers/test-data.mjs`):

```javascript
export class TestDataManager {
    constructor(apiClient) {
        this.api = apiClient;
        this.createdResources = [];
    }

    async createProject(userId, data = {}) {
        const project = await this.api.post('/api/test/projects', {
            name: `test-project-${Date.now()}`,
            owner_id: userId,
            ...data
        });

        this.createdResources.push({ type: 'project', id: project.id });
        return project;
    }

    async createAd(projectId, data = {}) {
        const ad = await this.api.post('/api/test/ads', {
            title: `test-ad-${Date.now()}`,
            project_id: projectId,
            ...data
        });

        this.createdResources.push({ type: 'ad', id: ad.id });
        return ad;
    }

    async cleanup() {
        // 按创建顺序反向清理（先删除子资源）
        for (const resource of this.createdResources.reverse()) {
            await this.api.delete(`/api/test/${resource.type}s/${resource.id}`);
        }
        this.createdResources = [];
    }
}

// 使用示例
test('创建和删除项目流程', async ({ page }) => {
    const testData = new TestDataManager(apiClient);

    try {
        // 1. 准备测试数据
        await setupAuthForTest(page, 'user');
        const project = await testData.createProject(testUserId, {
            name: '我的测试项目'
        });

        // 2. 执行UI测试
        await page.goto(`/projects/${project.id}`);
        await page.click('button:has-text("删除")');
        await page.click('button:has-text("确认")');

        // 3. 验证
        await expect(page.getByText('项目已删除')).toBeVisible();

    } finally {
        // 4. 清理（即使测试失败也会执行）
        await testData.cleanup();
    }
});
```

### 4. CI/CD集成配置

**GitHub Actions配置** (`.github/workflows/frontend-e2e-test.yml`):

```yaml
name: Frontend E2E Tests

on:
  push:
    branches: [main, develop]
    paths:
      - 'apps/frontend/**'
      - 'scripts/tests/**'
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    timeout-minutes: 15

    env:
      PREVIEW_BASE: ${{ secrets.PREVIEW_BASE_URL || 'https://www.urlchecker.dev' }}
      HEADLESS: true

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: node scripts/tests/test-frontend-complete.mjs

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-test-results
          path: |
            playwright-report/
            test-results/
          retention-days: 7

      - name: Upload screenshots on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-screenshots
          path: test-results/**/*.png

      - name: Comment PR with test results
        if: github.event_name == 'pull_request'
        uses: daun/playwright-report-comment@v3
        with:
          report-path: playwright-report/index.html
```

**PR门禁配置** (GitHub Branch Protection):

```yaml
# 在GitHub仓库设置中配置
Branch protection rules:
  - Require status checks to pass before merging
    ✅ Frontend E2E Tests
  - Require branches to be up to date before merging
```

### 5. Storybook配置

**安装** (`apps/frontend/`):

```bash
npx storybook@latest init
```

**核心组件Stories示例** (`src/components/Navbar.stories.tsx`):

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within, expect } from '@storybook/test';
import Navbar from './Navbar';

const meta: Meta<typeof Navbar> = {
  title: 'Layout/Navbar',
  component: Navbar,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof Navbar>;

// 英文版本
export const English: Story = {
  parameters: {
    nextjs: {
      router: {
        locale: 'en',
      },
    },
  },
};

// 中文版本
export const Chinese: Story = {
  parameters: {
    nextjs: {
      router: {
        locale: 'zh-CN',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 验证中文导航链接
    await expect(canvas.getByText('功能')).toBeInTheDocument();
    await expect(canvas.getByText('定价')).toBeInTheDocument();
  },
};

// 登录状态
export const Authenticated: Story = {
  parameters: {
    mockData: {
      isAuthenticated: true,
      user: {
        email: 'test@example.com',
        name: '测试用户',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 验证用户菜单可见
    const userMenu = canvas.getByLabelText('User menu');
    await expect(userMenu).toBeInTheDocument();
  },
};

// 深色模式
export const DarkMode: Story = {
  parameters: {
    theme: 'dark',
  },
};
```

### 6. Chromatic集成

**配置** (`.storybook/main.ts`):

```typescript
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@chromatic-com/storybook',
  ],
  framework: '@storybook/react-vite',
};

export default config;
```

**GitHub Actions集成**:

```yaml
- name: Publish to Chromatic
  uses: chromaui/action@v1
  with:
    projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
    buildScriptName: 'build-storybook'
    autoAcceptChanges: 'main' # 主分支自动接受
    exitOnceUploaded: true
```

---

## 📊 任务拆解与追踪

### Phase 1: E2E测试完善

#### 1.1 后端测试API开发

**负责人**: 后端开发
**预计时间**: 2天
**优先级**: 🔴 P0

- [ ] **Task 1.1.1**: 创建测试用户数据表 (2h)
  - 表结构: `test_users(id, email, role, created_at)`
  - 添加唯一索引: `email`
  - 迁移脚本: `migrations/xxx_create_test_users.sql`

- [ ] **Task 1.1.2**: 实现 `/api/test/create-session` 端点 (4h)
  - 文件: `apps/backend/api/test/create_session.go`
  - 环境检查: 仅在 `APP_ENV=test|development` 时可用
  - 输入验证: email, role (admin|user|guest)
  - 生成Supabase JWT token
  - 返回: `access_token`, `refresh_token`, `user_id`

- [ ] **Task 1.1.3**: 实现 `getOrCreateTestUser` 函数 (3h)
  - 根据email查询是否存在
  - 不存在则创建新用户
  - 设置对应的role权限
  - 与Supabase Auth集成

- [ ] **Task 1.1.4**: 添加单元测试 (2h)
  - 测试环境检查逻辑
  - 测试用户创建流程
  - 测试token生成正确性
  - 覆盖率 >80%

- [ ] **Task 1.1.5**: 添加API文档 (1h)
  - Swagger/OpenAPI注释
  - 示例请求/响应
  - 错误码说明

**验收标准**:
```bash
# 测试环境
curl -X POST http://localhost:8080/api/test/create-session \
  -H "Content-Type: application/json" \
  -d '{"email":"test@autoads.dev","role":"user"}'

# 预期响应
{
  "access_token": "eyJhbGc...",
  "refresh_token": "...",
  "user_id": "uuid",
  "email": "test@autoads.dev",
  "role": "user"
}

# 生产环境（应该返回403）
curl -X POST https://api.urlchecker.dev/api/test/create-session
# => 403 Forbidden
```

#### 1.2 Playwright程序化登录集成

**负责人**: 前端开发/QA
**预计时间**: 2天
**优先级**: 🔴 P0
**依赖**: Task 1.1完成

- [ ] **Task 1.2.1**: 创建auth辅助模块 (2h)
  - 文件: `scripts/tests/helpers/auth.mjs`
  - 实现 `setupAuthForTest(page, role)` 函数
  - 处理cookie和localStorage设置
  - 添加错误处理和重试逻辑

- [ ] **Task 1.2.2**: 更新现有测试用例 (3h)
  - 修改 `test-frontend-complete.mjs`
  - 为登录态测试添加 `beforeEach` hook
  - 移除手动登录等待逻辑

- [ ] **Task 1.2.3**: 编写登录态测试用例 (4h)
  - Test 13: Dashboard页面加载
  - Test 14: 用户菜单交互
  - Test 15: 设置页面访问
  - Test 16: 项目创建流程
  - Test 17: 退出登录

- [ ] **Task 1.2.4**: 本地验证 (1h)
  - 运行完整测试套件
  - 确认所有测试通过
  - 记录执行时间

**验收标准**:
```bash
# 执行测试
HEADLESS=true node scripts/tests/test-frontend-complete.mjs

# 预期结果
✅ 通过: 18/18 (包含5个新登录态测试)
⏱️  执行时间: < 45秒
```

#### 1.3 多角色权限测试

**负责人**: QA
**预计时间**: 3天
**优先级**: 🟡 P1
**依赖**: Task 1.2完成

- [ ] **Task 1.3.1**: 创建测试账号 (1h)
  - 使用后端API创建3个角色的测试用户
  - 记录账号信息到 `test-fixtures/test-accounts.json`
  - 验证每个角色的权限配置

- [ ] **Task 1.3.2**: 设计权限测试矩阵 (2h)
  - 文档: `docs/test-permission-matrix.md`
  - 列出所有受保护路由
  - 定义每个角色的访问权限
  - Review by 产品经理

- [ ] **Task 1.3.3**: 实现角色切换测试 (4h)
  - 文件: `scripts/tests/test-role-permissions.mjs`
  - 使用矩阵驱动测试用例
  - 验证200/403/重定向行为
  - 添加断言消息

- [ ] **Task 1.3.4**: UI权限测试 (3h)
  - 测试"删除"按钮可见性（admin可见，user不可见）
  - 测试"用户管理"菜单项（admin可见）
  - 测试批量操作权限

- [ ] **Task 1.3.5**: 跨角色数据隔离测试 (4h)
  - 用户A创建项目
  - 用户B不能看到用户A的项目
  - 管理员可以看到所有项目

**验收标准**:
```bash
# 执行权限测试
node scripts/tests/test-role-permissions.mjs

# 预期结果
Guest角色: 3 passed, 0 failed
User角色: 6 passed, 0 failed
Admin角色: 8 passed, 0 failed
总计: 17 passed
```

#### 1.4 数据隔离机制

**负责人**: 后端+QA
**预计时间**: 3天
**优先级**: 🟡 P1

- [ ] **Task 1.4.1**: 后端测试数据API (1天)
  - `POST /api/test/seed/project` - 创建测试项目
  - `POST /api/test/seed/ad` - 创建测试广告
  - `DELETE /api/test/cleanup/:resource_type/:id` - 清理资源
  - 添加级联删除逻辑

- [ ] **Task 1.4.2**: TestDataManager类实现 (4h)
  - 文件: `scripts/tests/helpers/test-data.mjs`
  - 资源追踪机制
  - 自动清理逻辑
  - 错误恢复

- [ ] **Task 1.4.3**: 集成到测试用例 (4h)
  - 为需要测试数据的用例添加Seed/Teardown
  - 示例: 项目创建/编辑/删除测试

- [ ] **Task 1.4.4**: 并发测试验证 (2h)
  - 运行10个测试用例并发执行
  - 验证数据不会冲突
  - 检查数据库连接池

**验收标准**:
```javascript
// 测试代码示例
test('删除项目', async ({ page }) => {
  const testData = new TestDataManager(apiClient);

  const project = await testData.createProject(userId);
  await page.goto(`/projects/${project.id}`);
  await page.click('button:has-text("删除")');

  // 自动清理
  await testData.cleanup();
});

// 并发测试
npm run test:parallel -- --workers=10
// 全部通过，无数据冲突
```

### Phase 2: CI/CD集成

#### 2.1 GitHub Actions工作流

**负责人**: DevOps
**预计时间**: 2天
**优先级**: 🟡 P1

- [ ] **Task 2.1.1**: 创建E2E测试工作流 (2h)
  - 文件: `.github/workflows/frontend-e2e-test.yml`
  - 触发条件: PR到main/develop, push到frontend/**
  - 安装Playwright环境

- [ ] **Task 2.1.2**: 配置测试环境变量 (1h)
  - GitHub Secrets: `PREVIEW_BASE_URL`, `TEST_API_KEY`
  - 环境选择逻辑（staging/production）

- [ ] **Task 2.1.3**: 测试报告上传 (2h)
  - Playwright HTML报告生成
  - 上传到GitHub Artifacts
  - 保留7天

- [ ] **Task 2.1.4**: 失败截图上传 (1h)
  - 捕获失败时的页面截图
  - 上传到Artifacts
  - 在PR中评论链接

- [ ] **Task 2.1.5**: PR门禁配置 (1h)
  - Branch Protection Rules
  - 必需状态检查: "Frontend E2E Tests"
  - 禁止强制推送

- [ ] **Task 2.1.6**: 通知配置 (2h)
  - Slack Webhook集成
  - 测试失败时发送通知
  - 包含失败测试列表和报告链接

**验收标准**:
```yaml
# PR创建后自动运行测试
✅ Frontend E2E Tests (18 passed in 45s)

# 测试失败时
❌ Frontend E2E Tests (16 passed, 2 failed)
   - Test 14: Dashboard页面加载 (failed)
   - Test 15: 设置页面访问 (failed)
   📊 查看完整报告: [链接]
   📸 失败截图: [链接]

# Slack通知
🔴 PR #123 测试失败
   仓库: autoads
   分支: feature/new-dashboard
   失败: 2/18
```

### Phase 3: Storybook组件测试

#### 3.1 Storybook初始化

**负责人**: 前端开发
**预计时间**: 1天
**优先级**: 🟢 P2

- [ ] **Task 3.1.1**: 安装Storybook (30min)
  - `npx storybook@latest init`
  - 选择React + Vite配置
  - 安装必要addons

- [ ] **Task 3.1.2**: 配置Next.js支持 (1h)
  - 安装 `@storybook/nextjs`
  - 配置路由、国际化mock
  - 配置全局样式导入

- [ ] **Task 3.1.3**: 配置主题切换 (1h)
  - 集成深色/浅色模式切换
  - 配置背景主题预览
  - 添加工具栏控制

- [ ] **Task 3.1.4**: 配置国际化 (1h)
  - Mock i18next
  - 添加语言切换控制
  - 加载翻译文件

- [ ] **Task 3.1.5**: 编写文档首页 (1h)
  - `Introduction.mdx`
  - 组件库使用指南
  - 设计原则说明

**验收标准**:
```bash
npm run storybook
# 浏览器打开 http://localhost:6006
# 可以看到欢迎页面和示例组件
```

#### 3.2 核心组件Stories

**负责人**: 前端开发
**预计时间**: 3天
**优先级**: 🟢 P2

- [ ] **Task 3.2.1**: Navbar组件 (4h)
  - `Navbar.stories.tsx`
  - 英文版本
  - 中文版本
  - 登录/未登录状态
  - 移动端视图
  - 交互测试（点击菜单）

- [ ] **Task 3.2.2**: Footer组件 (2h)
  - `Footer.stories.tsx`
  - 中英文版本
  - 响应式布局
  - 深色模式

- [ ] **Task 3.2.3**: ThemeSelector组件 (2h)
  - `ThemeSelector.stories.tsx`
  - 5个主题预览
  - 选择交互测试
  - localStorage持久化验证

- [ ] **Task 3.2.4**: Button组件 (2h)
  - 不同尺寸 (sm, md, lg)
  - 不同变体 (primary, secondary, ghost)
  - 加载状态
  - 禁用状态

- [ ] **Task 3.2.5**: Form组件 (4h)
  - Input, Textarea, Select
  - 验证状态（成功/错误）
  - 表单提交交互测试

**验收标准**:
```bash
npm run storybook
# 可以在Storybook UI中看到所有组件
# 每个组件至少有3个Stories
# 交互测试全部通过（绿色勾选）
```

#### 3.3 Chromatic视觉回归测试

**负责人**: QA
**预计时间**: 2天
**优先级**: 🟢 P2
**依赖**: Task 3.2完成

- [ ] **Task 3.3.1**: Chromatic账号设置 (30min)
  - 注册Chromatic账号
  - 创建项目
  - 获取Project Token

- [ ] **Task 3.3.2**: 集成Chromatic CLI (1h)
  - `npm install -D chromatic`
  - 添加npm script: `chromatic`
  - 本地测试上传

- [ ] **Task 3.3.3**: GitHub Actions集成 (2h)
  - 添加Chromatic job到CI
  - 配置自动对比
  - 主分支自动接受变更

- [ ] **Task 3.3.4**: 建立视觉基线 (1h)
  - 运行首次Chromatic构建
  - Review所有组件快照
  - 接受为基线

- [ ] **Task 3.3.5**: 测试视觉回归检测 (2h)
  - 故意修改组件样式
  - 提交PR触发Chromatic
  - 验证检测到差异
  - 在Chromatic UI中Review

- [ ] **Task 3.3.6**: 编写使用文档 (1h)
  - 文档: `docs/visual-regression-testing.md`
  - 如何Review视觉变更
  - 如何接受/拒绝变更
  - 最佳实践

**验收标准**:
```bash
# 本地运行
npm run chromatic

# 输出
✅ Build 123 published
📸 Captured 47 component snapshots
🔍 No visual changes detected
🌐 View build: https://www.chromatic.com/build?appId=...

# PR中
✅ Chromatic - Visual tests passed (0 changes)
# 或
⚠️ Chromatic - 3 visual changes detected [Review]
```

### Phase 4: 单元测试补充

#### 4.1 Vitest配置

**负责人**: 前端开发
**预计时间**: 1天
**优先级**: 🟢 P3

- [ ] **Task 4.1.1**: 安装Vitest (30min)
  - `npm install -D vitest @vitejs/plugin-react`
  - 配置 `vitest.config.ts`

- [ ] **Task 4.1.2**: 配置测试环境 (1h)
  - jsdom环境
  - 全局变量
  - Mock模块路径映射

- [ ] **Task 4.1.3**: 配置覆盖率报告 (30min)
  - `@vitest/coverage-v8`
  - 设置阈值: 80%
  - 排除目录配置

- [ ] **Task 4.1.4**: 添加npm scripts (15min)
  - `test:unit` - 运行单元测试
  - `test:coverage` - 生成覆盖率报告
  - `test:watch` - watch模式

**验收标准**:
```bash
npm run test:unit
# ✓ test/utils.test.ts (5 tests) 12ms
# Test Files  1 passed (1)
#      Tests  5 passed (5)
```

#### 4.2 工具函数测试

**负责人**: 前端开发
**预计时间**: 2天
**优先级**: 🟢 P3

- [ ] **Task 4.2.1**: 路由工具测试 (2h)
  - `src/lib/router-utils.test.ts`
  - 测试 `isActive()`, `ensureAbsolutePath()`

- [ ] **Task 4.2.2**: 国际化工具测试 (2h)
  - `src/i18n/utils.test.ts`
  - 测试 `normalizeLocale()`, `isSupportedLocale()`

- [ ] **Task 4.2.3**: 主题工具测试 (2h)
  - `src/lib/themes/backgrounds.test.ts`
  - 测试 `getThemeById()`, `getThemeStyle()`

- [ ] **Task 4.2.4**: 表单验证测试 (3h)
  - `src/lib/validation.test.ts`
  - 测试email、URL、密码验证

**验收标准**:
```bash
npm run test:coverage

# File                        | % Stmts | % Branch | % Funcs | % Lines
# --------------------------- | ------- | -------- | ------- | -------
# src/lib/router-utils.ts     |   100   |   100    |   100   |   100
# src/i18n/utils.ts           |   95.2  |   90.0   |   100   |   95.2
# src/lib/themes/backgrounds.ts|  100   |   100    |   100   |   100
```

#### 4.3 React Hooks测试

**负责人**: 前端开发
**预计时间**: 2天
**优先级**: 🟢 P3

- [ ] **Task 4.3.1**: 安装测试工具 (15min)
  - `npm install -D @testing-library/react @testing-library/react-hooks`

- [ ] **Task 4.3.2**: useTheme hook测试 (2h)
  - 测试主题初始化
  - 测试主题切换
  - 测试localStorage持久化

- [ ] **Task 4.3.3**: useAuth hook测试 (3h)
  - Mock Supabase client
  - 测试登录/登出
  - 测试session获取

- [ ] **Task 4.3.4**: useTranslation hook测试 (2h)
  - Mock i18next
  - 测试翻译key读取
  - 测试语言切换

**验收标准**:
```typescript
// 示例测试
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';

test('useTheme应该切换主题', () => {
  const { result } = renderHook(() => useTheme());

  expect(result.current.themeId).toBe('slate-professional');

  act(() => {
    result.current.changeTheme('indigo-modern');
  });

  expect(result.current.themeId).toBe('indigo-modern');
  expect(localStorage.getItem('theme')).toBe('indigo-modern');
});
```

---

## 📈 成功指标 (KPI)

### 测试覆盖率目标

| 指标 | 当前 | 目标 (4周后) | 目标 (3个月后) |
|------|------|-------------|---------------|
| **E2E测试** | 13项 | 25项 | 50项 |
| **组件测试** | 0 | 15个组件 | 30个组件 |
| **单元测试覆盖率** | 0% | 60% | 80% |
| **视觉回归测试** | 0 | 15个组件 | 30个组件 |

### 质量指标

| 指标 | 目标 |
|------|------|
| **测试通过率** | >95% |
| **平均执行时间** | E2E <2分钟, 单元测试 <10秒 |
| **误报率** | <5% |
| **生产Bug发现率** | 测试发现 >80% |

### 效率指标

| 指标 | 目标 |
|------|------|
| **CI反馈时间** | <5分钟 |
| **测试用例编写效率** | 1个E2E用例/天, 10个单元测试/天 |
| **回归测试时间节省** | 减少80%人工测试时间 |

---

## 📚 参考资源

### 官方文档
- [Playwright文档](https://playwright.dev/)
- [Storybook文档](https://storybook.js.org/)
- [Vitest文档](https://vitest.dev/)
- [Chromatic文档](https://www.chromatic.com/docs/)

### 内部文档
- [项目架构文档](./architecture.md)
- [API文档](./api-documentation.md)
- [部署流程](./deployment.md)

### 相关Issue/PR
- #TODO: 添加相关Issue链接

---

## 🔄 文档更新日志

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|---------|------|
| 2025-10-11 | v1.0 | 初始版本创建 | Claude |

---

**文档维护**: 每周五更新任务进度，每月Review整体策略
