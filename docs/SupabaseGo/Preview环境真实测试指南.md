# Preview 环境真实测试指南

> **测试环境**: https://www.urlchecker.dev
> **测试账号**: yj2008ay611@gmail.com (管理员)
> **最新部署**: preview-3557fa3e (2025-10-10 16:54)
> **测试目标**: 验证重构 + RBAC 功能

---

## 🎯 测试目标

### 重构验证
1. ✅ 新路由可访问 (`/dashboard/offers`, `/dashboard/tasks`, `/settings/profile`)
2. ✅ 旧组织路由已移除 (无 `/dashboard/[uuid]/` 路由)
3. ✅ 数据基于 `user_id` 正确过滤
4. ✅ 导航链接无 404

### RBAC验证
1. ✅ 管理员看到"后台管理"入口
2. ✅ 管理员可访问 `/manage`
3. ✅ ProfileDropdown 显示 "Admin" 链接

---

## 📝 测试步骤（请按顺序执行）

### 步骤1: 登录测试

1. **打开浏览器**（推荐 Chrome）

2. **访问预发环境**
   ```
   https://www.urlchecker.dev
   ```

3. **点击 "Sign in with Google"**
   - 选择账号：`yj2008ay611@gmail.com`
   - 完成 Google OAuth 授权

4. **观察登录后跳转**
   - ✅ 检查项：是否跳转到 `/dashboard` 或 `/en/dashboard`
   - ❌ 不应该：跳转到包含 UUID 的 URL（如 `/dashboard/xxx-xxx-xxx`）

5. **截图保存** → 命名为 `test-1-login.png`

---

### 步骤2: 验证 RBAC 管理员权限

1. **查看侧边栏导航**
   - ✅ 应该看到：
     - 仪表盘
     - Offer 管理
     - 任务中心
     - 广告中心
     - **--- 分隔线 ---**
     - **后台管理** ← 新增的管理员专属菜单
     - 系统设置

2. **点击右上角用户头像**
   - ✅ 应该看到：
     - Dashboard
     - 个人中心
     - Documentation
     - **Admin** ← 管理员专属链接
     - Sign Out

3. **点击 "Admin" 链接**
   - ✅ 检查项：是否成功跳转到 `/manage` 页面
   - ✅ 检查项：页面是否正常加载（后台管理界面）

4. **截图保存** → 命名为 `test-2-rbac-admin.png`

---

### 步骤3: 测试新路由结构

#### 3.1 测试 Offers 路由

1. **点击侧边栏 "Offer 管理"**
   - ✅ 检查 URL：`/dashboard/offers` 或 `/en/dashboard/offers`
   - ❌ 不应该：URL 中包含 UUID（`/dashboard/xxx-xxx/offers`）

2. **查看 Offers 列表**
   - ✅ 检查项：列表数据正常显示
   - ✅ 检查项：只显示当前用户的 Offers（不显示其他用户数据）

3. **点击任意 Offer 查看详情**
   - ✅ 检查 URL：`/dashboard/offers/{offer_id}`
   - ❌ 不应该：URL 中包含组织 UUID

4. **截图保存** → 命名为 `test-3-offers.png`

#### 3.2 测试 Tasks 路由

1. **点击侧边栏 "任务中心"**
   - ✅ 检查 URL：`/dashboard/tasks` 或 `/en/dashboard/tasks`

2. **查看任务列表**
   - ✅ 检查项：任务数据正常显示

3. **截图保存** → 命名为 `test-3-tasks.png`

#### 3.3 测试 Ads Center 路由

1. **点击侧边栏 "广告中心"**
   - ✅ 检查 URL：`/dashboard/ads-center` 或 `/en/dashboard/ads-center`

2. **查看广告账户连接**
   - ✅ 检查项：页面正常加载

3. **截图保存** → 命名为 `test-3-ads-center.png`

---

### 步骤4: 测试 Settings 独立路由

1. **点击用户头像 → "个人中心"**
   - ✅ 检查 URL：`/userinfo` （注意：根据代码这个可能不是 settings）

2. **或者直接访问**：
   ```
   https://www.urlchecker.dev/settings/profile
   ```
   - ✅ 检查项：个人资料设置页面正常加载
   - ✅ 检查 URL：没有组织 UUID

3. **访问其他 Settings 页面**：
   ```
   https://www.urlchecker.dev/settings/tokens
   https://www.urlchecker.dev/settings/subscription
   ```
   - ✅ 检查项：所有页面正常加载

4. **截图保存** → 命名为 `test-4-settings.png`

---

### 步骤5: 测试导航链接完整性

1. **点击所有侧边栏链接**
   - 仪表盘
   - Offer 管理
   - 任务中心
   - 广告中心
   - 后台管理
   - 系统设置 → 个人资料
   - 系统设置 → 订阅与账单

2. **检查清单**：
   - ✅ 所有链接都能正常跳转
   - ✅ 没有 404 错误
   - ✅ 没有出现组织 UUID 的 URL

3. **记录结果** → 在下方的测试清单中打勾

---

### 步骤6: 测试 SSR 和刷新

1. **访问 `/dashboard/offers`**

2. **按 F5 刷新页面**
   - ✅ 检查项：页面立即显示内容（无长时间白屏）
   - ✅ 检查项：数据正确显示

3. **打开新标签页，直接访问**：
   ```
   https://www.urlchecker.dev/dashboard/tasks
   ```
   - ✅ 检查项：直接加载成功（SSR 预渲染）

4. **截图保存** → 命名为 `test-6-ssr.png`

---

### 步骤7: 测试错误场景

#### 7.1 未登录访问

1. **退出登录**
   - 点击用户头像 → Sign Out

2. **直接访问**：
   ```
   https://www.urlchecker.dev/dashboard/offers
   ```
   - ✅ 检查项：自动重定向到登录页
   - ✅ 检查项：登录后自动跳转回 `/dashboard/offers`

#### 7.2 访问不存在的资源

1. **访问不存在的 Offer**：
   ```
   https://www.urlchecker.dev/dashboard/offers/non-existent-id-12345
   ```
   - ✅ 检查项：显示 404 页面或错误提示

2. **截图保存** → 命名为 `test-7-errors.png`

---

### 步骤8: 浏览器 Console 检查

1. **打开 Chrome DevTools**
   - 按 F12 或 右键 → 检查

2. **切换到 Console 标签**

3. **访问各个页面，检查 Console 输出**
   - ✅ 检查项：无红色错误 (Error)
   - ⚠️ 允许：少量黄色警告 (Warning)
   - ❌ 不应该：`useCurrentOrganization is not defined` 等组织相关错误

4. **截图保存** → 命名为 `test-8-console.png`

---

## ✅ 测试清单（请逐项打勾）

### 登录与认证
- [ ] Google OAuth 登录成功
- [ ] 登录后跳转到 `/dashboard`（无组织 UUID）

### RBAC 功能
- [ ] 侧边栏显示"后台管理"菜单项
- [ ] ProfileDropdown 显示 "Admin" 链接
- [ ] 点击 "Admin" 可访问 `/manage`
- [ ] `/manage` 页面正常加载

### 新路由结构
- [ ] `/dashboard/offers` 正常访问
- [ ] `/dashboard/tasks` 正常访问
- [ ] `/dashboard/ads-center` 正常访问
- [ ] `/settings/profile` 正常访问
- [ ] `/settings/tokens` 正常访问
- [ ] `/settings/subscription` 正常访问

### 数据正确性
- [ ] Offers 列表只显示当前用户数据
- [ ] Tasks 列表正常显示
- [ ] Token 余额显示正确
- [ ] 订阅状态显示正确

### 导航功能
- [ ] 所有侧边栏链接可点击
- [ ] 所有链接跳转正确（无 404）
- [ ] URL 中无组织 UUID
- [ ] 面包屑路径正确（无组织层级）

### SSR 功能
- [ ] 刷新页面状态保持
- [ ] 直接访问 URL 正常加载
- [ ] 无长时间白屏或 loading

### 错误处理
- [ ] 未登录访问自动跳转登录
- [ ] 访问不存在资源显示 404
- [ ] Console 无严重错误

### UI/文案
- [ ] 界面无"组织"字样
- [ ] 无"新建组织"按钮
- [ ] 无"组织切换器"
- [ ] 欢迎语不包含组织名称

---

## 📊 测试结果记录

### 测试环境信息
- **浏览器**: Chrome / Safari / Firefox（请选择）
- **浏览器版本**: _________
- **操作系统**: macOS / Windows / Linux（请选择）
- **测试时间**: 2025-10-11 __:__

### 发现的问题

#### 问题 1: [简短描述]
- **严重性**: Critical / High / Medium / Low
- **页面/功能**: ___________
- **重现步骤**:
  1.
  2.
  3.
- **预期行为**: ___________
- **实际行为**: ___________
- **截图**: `problem-1.png`

#### 问题 2: [简短描述]
（如无问题，删除此部分）

---

## 📸 截图提交

请将以下截图打包提交：
```
test-1-login.png          # 登录后的 Dashboard
test-2-rbac-admin.png     # 管理员权限显示
test-3-offers.png         # Offers 列表页
test-3-tasks.png          # Tasks 列表页
test-3-ads-center.png     # 广告中心页
test-4-settings.png       # Settings 页面
test-6-ssr.png            # SSR 加载效果
test-7-errors.png         # 错误处理
test-8-console.png        # Console 输出
problem-*.png             # 发现的问题（如有）
```

---

## 🎯 测试通过标准

### 必须满足（Critical）
- ✅ 所有新路由可正常访问
- ✅ 数据基于 user_id 正确过滤
- ✅ 管理员权限正常显示
- ✅ 无严重 Console 错误
- ✅ 无 404 链接

### 应该满足（High）
- ✅ SSR 正常工作
- ✅ 刷新页面状态保持
- ✅ 错误场景处理友好

### 可选优化（Medium）
- ⚡ 页面加载速度快（< 2秒）
- 🎨 UI 流畅无卡顿
- 📱 移动端适配良好

---

## 📞 遇到问题时

1. **优先查看 Console 错误信息**
   - 截图保存 Console 输出
   - 记录完整错误堆栈

2. **检查 Network 标签**
   - 查看失败的 API 请求
   - 记录请求 URL 和响应状态码

3. **记录详细重现步骤**
   - 从哪个页面开始
   - 点击了什么按钮
   - 发生了什么现象

4. **提供完整信息**
   - 浏览器版本
   - 操作系统
   - 是否清除过缓存
   - 是否在隐身模式测试

---

## ✅ 测试完成后

请提供以下信息：

1. **测试清单完成度**: __/__ (完成数/总数)
2. **发现问题数量**:
   - Critical: __
   - High: __
   - Medium: __
   - Low: __
3. **总体评价**:
   - ✅ 可以发布生产环境
   - ⚠️ 需要修复部分问题后发布
   - ❌ 存在严重问题，不建议发布
4. **测试用时**: ______ 分钟

---

**感谢你的测试！** 🎉
