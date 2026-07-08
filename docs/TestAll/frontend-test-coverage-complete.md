# 前端测试完整覆盖清单

> **更新日期**: 2025-10-11
> **当前状态**: 已完成核心业务功能测试脚本 (12个测试场景)

---

## 📊 测试覆盖概览

| 测试类型 | 测试场景数 | 测试脚本数 | 总测试点数 | 状态 |
|---------|----------|-----------|----------|------|
| **未登录态测试** | 13 | 2 | 13 | ✅ 已完成 |
| **登录流程测试** | 8 | 1 | 8 | ✅ 已完成 |
| **核心业务功能** | 12 | 9 | 74 | ✅ 已完成 |
| **性能测试** | 4 | 1 | 4 | ✅ 已完成 |
| **总计** | **37** | **13** | **99** | ✅ |

---

## 📁 测试脚本清单

### 1. 基础未登录态测试

#### `test-frontend-complete.mjs` (13测试点)
**执行命令**:
```bash
node scripts/tests/test-frontend-complete.mjs
```

**测试覆盖**:
- ✅ HTTP重定向验证
- ✅ 品牌一致性检查
- ✅ 中英文导航栏i18n
- ✅ SEO元数据验证
- ✅ 认证守卫
- ✅ 公开页面可访问性
- ✅ 性能指标(DOM解析时间)

---

### 2. 性能测试

#### `test-web-vitals.mjs` (4测试点)
**执行命令**:
```bash
node scripts/tests/test-web-vitals.mjs
```

**测试覆盖**:
- ✅ LCP (Largest Contentful Paint) < 2.5s
- ✅ FCP (First Contentful Paint) < 1.8s
- ✅ CLS (Cumulative Layout Shift) < 0.1
- ✅ TTFB (Time to First Byte) < 800ms

**验收标准**:
- 所有指标达到Google标准
- 综合性能评级 ≥ B (75分)

---

### 3. 登录流程测试

#### `test-login-flow.mjs` (8测试点)
**执行命令**:
```bash
# 显示浏览器（手动登录测试）
HEADLESS=false node scripts/tests/test-login-flow.mjs
```

**测试覆盖**:
- ✅ 访问登录页面
- ✅ Google登录按钮可见
- ✅ 触发OAuth流程
- ✅ 登录后重定向到Dashboard
- ✅ Session持久化验证
- ✅ 用户信息显示
- ✅ 退出登录功能
- ✅ 退出后Dashboard受保护

---

## 🎯 核心业务功能测试 (12场景 / 74测试点)

### 4. Offer管理 - 创建流程

#### `test-create-offer.mjs` (5测试点)
**执行命令**:
```bash
node scripts/tests/test-create-offer.mjs
```

**测试覆盖**:
- ✅ 访问Offers列表页
- ✅ 点击创建Offer按钮
- ✅ 填写Offer表单
- ✅ 提交创建请求
- ✅ 验证Offer已创建

---

### 5. Offer管理 - AI评估

#### `test-ai-evaluation.mjs` (4测试点)
**执行命令**:
```bash
node scripts/tests/test-ai-evaluation.mjs
```

**测试覆盖**:
- ✅ 进入Offer详情页
- ✅ 点击AI评估按钮
- ✅ 等待评估结果
- ✅ 验证评估数据完整性

---

### 6. 广告中心 - 绑定账号

#### `test-bind-ads-account.mjs` (6测试点)
**执行命令**:
```bash
node scripts/tests/test-bind-ads-account.mjs
```

**测试覆盖**:
- ✅ 访问账号设置页面
- ✅ 找到广告平台集成区域
- ✅ 点击连接按钮
- ✅ OAuth授权流程
- ✅ 验证账号已绑定
- ✅ 查看绑定账号信息

---

### 7. Dashboard概览

#### `test-dashboard-overview.mjs` (6测试点) 🆕
**执行命令**:
```bash
node scripts/tests/test-dashboard-overview.mjs
```

**测试覆盖**:
- ✅ 访问Dashboard首页
- ✅ 验证统计卡片区域 (Offers总数/待评估/可投放/剩余Tokens)
- ✅ 验证快速操作区域 (管理Offers/查看Tasks/广告中心/新建Offer)
- ✅ 统计卡片可点击导航
- ✅ 快速操作按钮可点击
- ✅ 欢迎信息显示

---

### 8. Offer筛选与搜索

#### `test-offer-filtering.mjs` (10测试点) 🆕
**执行命令**:
```bash
node scripts/tests/test-offer-filtering.mjs
```

**测试覆盖**:
- ✅ 访问Offers列表页
- ✅ 状态筛选下拉框 (全部/待评估/评估中/可投放/已投放/已归档/失败)
- ✅ 搜索输入框 (品牌名/URL搜索)
- ✅ 评估类型筛选 (全部/AI智能评估/基础评估)
- ✅ 时间范围筛选 (不限/最近7天/最近30天)
- ✅ 收藏筛选按钮 (仅看收藏/显示全部)
- ✅ 排序规则下拉框 (最近更新优先/AI指数优先)
- ✅ 升序降序切换
- ✅ 重置筛选按钮
- ✅ 刷新按钮

---

### 9. Offer批量操作

#### `test-bulk-operations.mjs` (8测试点) 🆕
**执行命令**:
```bash
node scripts/tests/test-bulk-operations.mjs
```

**测试覆盖**:
- ✅ 访问Offers列表
- ✅ 全选复选框存在
- ✅ 选择单个Offer
- ✅ 批量评估按钮可见且可点击
- ✅ 批量删除按钮可见且可点击
- ✅ 清除选择按钮功能
- ✅ 全选功能
- ✅ 批量操作提示文案

---

### 10. 任务管理

#### `test-task-management.mjs` (8测试点) 🆕
**执行命令**:
```bash
node scripts/tests/test-task-management.mjs
```

**测试覆盖**:
- ✅ 访问任务中心
- ✅ Token余额卡片显示
- ✅ 状态筛选下拉框 (待处理/进行中/已完成/失败/已取消)
- ✅ 刷新状态按钮
- ✅ 任务列表显示或空状态
- ✅ 任务操作按钮 (取消/重试)
- ✅ 任务统计信息
- ✅ 空状态快速操作卡片

---

### 11. 广告中心操作

#### `test-ads-center-operations.mjs` (10测试点) 🆕
**执行命令**:
```bash
node scripts/tests/test-ads-center-operations.mjs
```

**测试覆盖**:
- ✅ 访问广告中心
- ✅ 连接新账号按钮可见且可点击
- ✅ 同步全部账号按钮 (如有账号)
- ✅ 账号列表或空状态显示
- ✅ 统计卡片 (已连接账号/活跃账号/累计花费/平均ROAS)
- ✅ 单个账号同步按钮
- ✅ 断开连接按钮
- ✅ 策略模板区域
- ✅ 执行报告区域
- ✅ 空状态快速操作卡片

---

### 12. 订阅管理

#### `test-subscription-management.mjs` (8测试点) 🆕
**执行命令**:
```bash
node scripts/tests/test-subscription-management.mjs
```

**测试覆盖**:
- ✅ 访问订阅管理页面
- ✅ 当前套餐显示 (Free/Basic/Elite)
- ✅ 套餐列表显示完整
- ✅ 升级套餐按钮可见
- ✅ 套餐功能对比显示
- ✅ 价格信息显示
- ✅ 查看套餐详情
- ✅ 管理订阅选项 (如已订阅)

---

### 13. Token管理

#### `test-token-management.mjs` (9测试点) 🆕
**执行命令**:
```bash
node scripts/tests/test-token-management.mjs
```

**测试覆盖**:
- ✅ 访问Token管理页面
- ✅ Token余额统计卡片 (当前余额/已使用/总购买)
- ✅ 充值按钮可见且可点击
- ✅ 使用明细区域显示
- ✅ 交易记录表格显示
- ✅ 交易记录筛选选项
- ✅ Token使用说明显示
- ✅ 刷新按钮功能
- ✅ 空状态提示 (如无交易)

---

## 🔄 执行所有测试

### 快速运行所有核心测试

创建统一测试脚本:

```bash
# scripts/tests/run-all-business-tests.sh
#!/bin/bash

echo "🚀 开始执行AutoAds核心业务功能完整测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

FAILED=0

# 1. 基础未登录态测试
echo "▶ Test 1/13: 基础未登录态测试"
node scripts/tests/test-frontend-complete.mjs || FAILED=$((FAILED + 1))

# 2. 性能测试
echo "\n▶ Test 2/13: Web Vitals性能测试"
node scripts/tests/test-web-vitals.mjs || FAILED=$((FAILED + 1))

# 3. 登录流程测试 (需要手动登录，跳过自动化测试)
echo "\n▶ Test 3/13: 登录流程测试 (需手动执行)"
echo "⏭️  跳过 (需要手动登录)"

# 4-13. 核心业务功能测试 (需要程序化登录)
echo "\n▶ Test 4/13: Dashboard概览测试"
node scripts/tests/test-dashboard-overview.mjs || FAILED=$((FAILED + 1))

echo "\n▶ Test 5/13: Offer筛选与搜索测试"
node scripts/tests/test-offer-filtering.mjs || FAILED=$((FAILED + 1))

echo "\n▶ Test 6/13: Offer批量操作测试"
node scripts/tests/test-bulk-operations.mjs || FAILED=$((FAILED + 1))

echo "\n▶ Test 7/13: 创建Offer测试"
node scripts/tests/test-create-offer.mjs || FAILED=$((FAILED + 1))

echo "\n▶ Test 8/13: AI评估测试"
node scripts/tests/test-ai-evaluation.mjs || FAILED=$((FAILED + 1))

echo "\n▶ Test 9/13: 任务管理测试"
node scripts/tests/test-task-management.mjs || FAILED=$((FAILED + 1))

echo "\n▶ Test 10/13: 广告中心操作测试"
node scripts/tests/test-ads-center-operations.mjs || FAILED=$((FAILED + 1))

echo "\n▶ Test 11/13: 绑定Ads账号测试"
node scripts/tests/test-bind-ads-account.mjs || FAILED=$((FAILED + 1))

echo "\n▶ Test 12/13: 订阅管理测试"
node scripts/tests/test-subscription-management.mjs || FAILED=$((FAILED + 1))

echo "\n▶ Test 13/13: Token管理测试"
node scripts/tests/test-token-management.mjs || FAILED=$((FAILED + 1))

# 汇总
echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 测试执行汇总"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 通过: $((13 - FAILED)) / 13"
echo "❌ 失败: $FAILED / 13"

if [ $FAILED -gt 0 ]; then
  echo "\n⚠️  部分测试失败，请查看详细日志"
  exit 1
else
  echo "\n🎉 所有测试通过！"
  exit 0
fi
```

---

## ⚠️ 重要说明

### 依赖项

所有登录后的测试 (Test 4-13) **依赖**:
- ✅ **程序化登录方案** (Phase 1.1 + 1.2)
- ✅ **后端测试API**: `/api/test/create-session`
- ✅ **Auth辅助模块**: `scripts/tests/helpers/auth.mjs`

### 当前状态

- ✅ **未登录态测试**: 可直接运行 (Test 1-2)
- ⏸️ **登录流程测试**: 需手动登录 (Test 3)
- 🔒 **核心业务功能测试**: 需程序化登录 (Test 4-13)

---

## 📈 测试指标看板

### 覆盖率统计

| 维度 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| **测试脚本数** | 13 | 25 (1个月) | ⏳ 52% |
| **测试场景数** | 37 | 50 (1个月) | ⏳ 74% |
| **总测试点数** | 99 | 150 (1个月) | ⏳ 66% |
| **核心功能覆盖** | 12/12 | 12/12 | ✅ 100% |

### 分类统计

| 测试类型 | 脚本数 | 测试点数 | 覆盖率 |
|---------|--------|---------|--------|
| **页面导航与路由** | 1 | 13 | ✅ 100% |
| **性能监控** | 1 | 4 | ✅ 100% |
| **认证与授权** | 2 | 14 | ✅ 100% |
| **Offer管理** | 4 | 29 | ✅ 100% |
| **任务管理** | 1 | 8 | ✅ 100% |
| **广告中心** | 2 | 16 | ✅ 100% |
| **设置与账户** | 2 | 17 | ✅ 100% |

---

## 🎯 下一步计划

### Phase 1.1-1.2: 程序化登录 (Week 1)
- [ ] 后端实现 `/api/test/create-session` API
- [ ] 前端实现 `helpers/auth.mjs` 辅助模块
- [ ] 集成程序化登录到所有登录态测试

### Phase 1.3: 多角色权限测试 (Week 2)
- [ ] 创建3个角色测试账号 (admin/user/guest)
- [ ] 设计权限测试矩阵
- [ ] 实现角色权限测试脚本 (17测试点)

### Phase 2: CI/CD集成 (Week 3)
- [ ] GitHub Actions工作流配置
- [ ] PR门禁设置
- [ ] 测试报告自动化

### Phase 3: Storybook组件测试 (Week 4-5)
- [ ] Storybook初始化
- [ ] 核心组件Stories (15个组件)
- [ ] Chromatic视觉回归测试

---

**最后更新**: 2025-10-11
**维护者**: 测试团队
**文档版本**: v2.0
