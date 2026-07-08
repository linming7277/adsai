# 新用户Onboarding系统手动测试指南

## 🎯 测试目的

验证新用户注册后，系统是否自动创建：
1. ✅ 8个Demo Offers
2. ✅ 欢迎通知
3. ✅ 签到系统初始化
4. ✅ 邀请码生成
5. ✅ 1000 tokens发放

## 📋 测试前准备

### 1. 准备新的Google账号

**重要**: 必须使用一个从未在AutoAds注册过的Google账号。

**选项A - 创建新账号**:
- 访问 https://accounts.google.com/signup
- 创建一个测试用的Google账号
- 记录账号信息

**选项B - 使用现有未注册账号**:
- 确认该Google账号从未登录过 www.urlchecker.dev
- 如果不确定，可以先在隐私模式尝试登录查看

### 2. 准备测试环境

```bash
# 打开Chrome隐私模式
Command + Shift + N (Mac)
Ctrl + Shift + N (Windows)

# 或清除所有浏览器数据
Chrome Settings → Privacy → Clear browsing data → All time
```

## 🧪 测试步骤

### 步骤1: 访问认证页面

1. 在隐私模式浏览器中访问:
   ```
   https://www.urlchecker.dev/auth
   ```

2. 你应该看到:
   - 页面标题: "Continue to AutoAds" 或 "登录"
   - 一个 "Continue with Google" 按钮
   - 提示文字: "OAuth only authentication"

### 步骤2: Google OAuth登录

1. 点击 **"Continue with Google"** 按钮

2. 在Google登录页面:
   - 输入新的Google账号邮箱
   - 输入密码
   - 完成任何2FA验证（如果有）

3. Google权限授权页面:
   - 点击 **"允许"** 或 **"Continue"**
   - 授权AutoAds访问基本信息

4. 等待OAuth回调和重定向
   - 正常情况下会重定向到 `/dashboard`
   - 如果出现错误，可能重定向到 `/setup-error`

### 步骤3: 等待Onboarding初始化

**重要**: Onboarding是异步执行的，需要等待3-5秒。

1. 登录成功后，**不要立即操作**
2. 等待 **5-10秒**，让系统完成初始化
3. 你可能会看到页面顶部有loading状态或通知

### 步骤4: 验证Dashboard

访问: `https://www.urlchecker.dev/dashboard`

**期望结果** ✅:
- [ ] 页面正常加载（无错误信息）
- [ ] 显示统计卡片（Total Offers, Active Campaigns等）
- [ ] 统计数字不全是0（应该有8个offers的汇总数据）
- [ ] Token余额显示（右上角或侧边栏）

**如果失败** ❌:
- 错误信息: "Failed to fetch dashboard stats"
- 所有统计数字都是0
- 页面显示空状态

### 步骤5: 验证Offers页面

访问: `https://www.urlchecker.dev/offers`

**期望结果** ✅:
- [ ] 看到 **8个** Demo Offers（不是空列表）
- [ ] Offer名称包括：
  - Nike Summer Sale Campaign
  - Amazon Prime Day Electronics
  - Apple iPhone 15 Launch
  - Adidas Fall Collection
  - Samsung Galaxy Launch
  - Sony PlayStation Deals
  - Microsoft Surface Promo
  - Dell Laptop Campaign
- [ ] 不同的状态标签（scaling, optimizing, evaluating, archived）
- [ ] 部分Offer显示Revenue和ROAS数据

**如果失败** ❌:
- 看到: "Get started by creating your first offer"
- 或者: 空的offers列表
- 或者: offers数量不是8个

### 步骤6: 验证Token余额

访问: `https://www.urlchecker.dev/settings/tokens`

**期望结果** ✅:
- [ ] 可用余额显示: **1000**
- [ ] 交易历史中有一条记录：
  - 类型: Credit
  - 金额: +1000
  - 描述: "Trial subscription created"
  - 时间: 刚才注册的时间

**如果失败** ❌:
- 余额显示0
- 或无法加载交易历史

### 步骤7: 验证签到功能

访问: `https://www.urlchecker.dev/settings/checkin`

**期望结果** ✅:
- [ ] 显示签到界面（不是错误信息）
- [ ] 连续签到天数: 0
- [ ] 显示"签到"或"Check In"按钮
- [ ] 可以点击按钮进行第一次签到

**如果失败** ❌:
- 错误信息: "暂无签到记录"
- 或页面无法加载

### 步骤8: 验证邀请码

访问: `https://www.urlchecker.dev/settings/referral`

**期望结果** ✅:
- [ ] 显示一个 **8位** 随机邀请码（例如: a3b5c7d9）
- [ ] 显示邀请链接（例如: https://www.urlchecker.dev/auth?referralCode=a3b5c7d9）
- [ ] 可以复制邀请码或链接
- [ ] 显示邀请统计（可能是0，因为刚注册）

**如果失败** ❌:
- 错误信息: "暂无法获取邀请信息"
- 或邀请码为空

### 步骤9: 验证通知

点击右上角的通知图标（bell icon）

**期望结果** ✅:
- [ ] 有至少 **1条** 通知
- [ ] 通知标题: "Welcome to AutoAds!" 或类似欢迎信息
- [ ] 通知内容提到: "1000 free tokens"

**如果失败** ❌:
- 错误信息: "Failed to load notifications"
- 或通知列表为空

### 步骤10: 验证订阅信息

访问: `https://www.urlchecker.dev/settings/subscription`

**期望结果** ✅:
- [ ] 订阅类型: **TRIAL** 或 **Professional (Trial)**
- [ ] 显示到期日期（注册后7天）
- [ ] Token quota: 1000
- [ ] 订阅来源: self_register

**如果失败** ❌:
- 无订阅信息
- 或订阅类型不是Trial

## 📊 测试结果记录

### 测试信息
- **测试日期**: _____________
- **测试人员**: _____________
- **Google账号**: _____________
- **User ID**: _____________ (可在浏览器开发者工具中查看localStorage)

### 功能检查清单

| 功能 | 状态 | 备注 |
|------|------|------|
| OAuth登录成功 | ☐ 通过 ☐ 失败 | |
| Dashboard数据显示 | ☐ 通过 ☐ 失败 | |
| 8个Demo Offers | ☐ 通过 ☐ 失败 | 实际数量: ___ |
| Token余额1000 | ☐ 通过 ☐ 失败 | |
| 签到功能可用 | ☐ 通过 ☐ 失败 | |
| 邀请码生成 | ☐ 通过 ☐ 失败 | 邀请码: ____ |
| 欢迎通知 | ☐ 通过 ☐ 失败 | |
| Trial订阅 | ☐ 通过 ☐ 失败 | |

### 总体评分

- **通过项目**: ___/8
- **成功率**: ___%
- **总体状态**: ☐ 全部通过 ☐ 部分通过 ☐ 失败

## 🔧 故障排查

### 如果Onboarding没有触发

1. **检查等待时间**:
   - 确保等待了至少5-10秒
   - 尝试刷新页面

2. **检查服务日志**:
   ```bash
   gcloud logging read \
     'resource.labels.service_name="billing-preview" AND jsonPayload.message=~"Onboarding"' \
     --limit 20 --freshness=10m
   ```

3. **检查是否真的是新用户**:
   - 确认该Google账号从未注册过
   - 检查数据库中是否已存在该用户

### 如果部分功能失败

1. **只有Demo Offers失败**:
   - 检查offer服务是否正常
   - 查看offer服务日志

2. **只有通知/签到/邀请失败**:
   - 检查数据库连接
   - 查看billing服务错误日志

3. **Token未发放**:
   - 检查trial订阅是否创建成功
   - 查看billing服务中的token发放日志

## 📝 测试报告模板

```markdown
# Onboarding系统测试报告

## 测试信息
- 测试时间: 2025-XX-XX XX:XX
- 测试环境: Preview (www.urlchecker.dev)
- 测试账号: test@example.com
- User ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

## 测试结果
- ✅ OAuth登录: 成功
- ✅ Demo Offers: 8个全部创建
- ✅ Token余额: 1000
- ✅ 签到功能: 正常
- ✅ 邀请码: a3b5c7d9
- ✅ 欢迎通知: 已收到
- ✅ Trial订阅: 已创建

## 问题记录
无问题

## 建议
系统运行正常，可以投入生产使用。
```

## 🎉 预期完美结果

如果一切正常，新用户注册后应该：
- 在10秒内完成所有初始化
- Dashboard立即显示有意义的数据
- 有完整的示例内容可以探索
- 可以立即体验所有功能（签到、邀请、评估）
- 感受到"系统很完善"而不是"空空如也"

---

**提示**: 如果测试中遇到任何问题，请保存截图并记录错误信息，便于开发团队定位和修复。
