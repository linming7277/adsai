# AutoAds 业务需求实现方案 V1

**创建时间**: 2025-10-15
**文档版本**: v1.0
**负责人**: Development Team

---

## 📋 目录

1. [架构概述](#架构概述)
2. [业务需求分析](#业务需求分析)
3. [详细设计方案](#详细设计方案)
4. [数据流设计](#数据流设计)
5. [API端点设计](#api端点设计)
6. [前端组件设计](#前端组件设计)
7. [实施计划](#实施计划)

---

## 架构概述

### 现有技术栈

#### 前端
- **框架**: Next.js 14 (App Router)
- **UI库**: React + TailwindCSS + shadcn/ui
- **状态管理**: React Hooks + SWR
- **国际化**: react-i18next
- **路由**: `apps/frontend/src/app/`

#### 后端微服务
| 服务 | 职责 | OpenAPI |
|------|------|---------|
| **offer** | Offer管理、评估、KPI | ✅ |
| **adscenter** | 广告账号管理、OAuth、数据同步 | ✅ |
| **billing** | Token余额、订阅、签到、邀请 | ✅ |
| **console** | 任务管理、统计、通知规则 | ✅ |
| **notifications** | 通知推送、消息管理 | ✅ |
| **recommendations** | 风险检测、品牌审核、机会推荐 | ✅ |
| **siterank** | 网站排名抓取 | ✅ |
| **browser-exec** | 浏览器自动化 | ✅ |
| **batchopen** | 批量打开URL | ✅ |

#### 数据库
- **Supabase PostgreSQL**: 用户认证
- **Cloud SQL PostgreSQL**: 应用数据、业务数据

### 现有页面路由

```
apps/frontend/src/app/
├── auth/                  # 认证页面
├── dashboard/             # 用户Dashboard
│   ├── page.tsx          # 首页（已实现基础版）
│   ├── offers/           # Offer管理
│   ├── tasks/            # 任务中心
│   └── ads-center/       # 广告中心
├── settings/              # 个人设置
│   ├── profile/          # 个人信息
│   ├── subscription/     # 订阅管理
│   └── tokens/           # Token余额
└── manage/                # 管理后台（Admin专用）
```

---

## 业务需求分析

### 需求1: 仪表盘 (`/dashboard`)

**目标**: 聚合Offer数据、Ads账号数据、风险提醒、消息通知，实现日常运营一览

#### 核心功能模块

1. **概览统计卡片** (Stats Cards)
   - Total Offers数量
   - Pending评估 Offers
   - Ready部署 Offers
   - Token余额
   - 活跃广告账号数
   - 今日消耗Token
   - 本月总消耗
   - 待处理任务数

2. **数据表现图表** (Performance Charts)
   - Offer状态分布饼图（Pending/Ready/Deployed/Paused）
   - 近30天Offer创建趋势折线图
   - Ads账号数据汇总（支出、点击、转化）
   - Token消耗趋势（近7天/30天）

3. **风险提醒面板** (Risk Alerts)
   - 品牌违规风险（来自recommendations服务）
   - 预算即将耗尽提醒
   - Offer失效警告
   - 广告账号异常

4. **消息通知列表** (Notifications Feed)
   - 最近10条通知
   - 分类：系统通知、任务完成、风险告警
   - 未读标记
   - 点击跳转到详情

5. **快速操作区** (Quick Actions)
   - 创建新Offer
   - 绑定广告账号
   - 充值Token
   - 查看任务

#### 数据来源

| 数据项 | API端点 | 微服务 |
|--------|---------|--------|
| Offer统计 | `GET /api/v1/offers?aggregate=true` | offer |
| Token余额 | `GET /api/v1/billing/tokens/balance` | billing |
| 任务统计 | `GET /api/v1/console/tasks/stats` | console |
| Ads账号汇总 | `GET /api/v1/adscenter/accounts` | adscenter |
| 风险提醒 | `GET /api/v1/recommend/opportunities` | recommendations |
| 通知列表 | `GET /api/v1/notifications/recent` | notifications |

---

### 需求2: Offer管理 (`/dashboard/offers`)

**目标**: 以Offer为视角，聚合offer信息、状态、操作，关联Ads账号

#### 核心功能模块

1. **Offer列表视图** (List View)
   - 表格展示：名称、URL、国家、状态、创建时间、操作
   - 状态标签：Pending、Ready、Deployed、Paused、Rejected
   - 排序：按创建时间、更新时间、状态
   - 分页：每页20/50/100条

2. **筛选与搜索** (Filter & Search)
   - 搜索框：按名称、URL模糊搜索
   - 状态筛选：多选（Pending/Ready/Deployed/Paused）
   - 国家筛选：多选（US/UK/CA/AU等）
   - 分类筛选：Gaming/Finance/Shopping等
   - 时间范围：最近7天/30天/自定义

3. **Offer详情抽屉** (Detail Drawer)
   - 基础信息：名称、URL、国家、分类、描述
   - 状态历史：时间线展示状态变更
   - AI评估结果：质量评分、风险等级、建议
   - KPI数据：点击、转化、收入（如已部署）
   - 关联广告账号：已绑定的账号列表

4. **批量操作** (Bulk Operations)
   - 全选/反选
   - 批量删除
   - 批量修改状态（Ready → Deployed）
   - 批量导出（CSV/JSON）
   - 批量AI评估

5. **Offer与Ads账号关联** (Ads Account Binding)
   - 在Offer详情中绑定广告账号
   - 一个Offer可绑定多个账号
   - 解绑操作
   - 显示绑定状态（Active/Paused）

6. **创建Offer** (Create Offer)
   - 表单字段：名称、URL、国家、分类、描述
   - 实时URL验证
   - 自动填充（从URL提取信息）
   - 保存为草稿
   - 提交后自动触发AI评估

#### 数据来源

| 数据项 | API端点 | 方法 |
|--------|---------|------|
| Offer列表 | `/api/v1/offers` | GET |
| Offer详情 | `/api/v1/offers/{id}` | GET |
| 创建Offer | `/api/v1/offers` | POST |
| 更新Offer | `/api/v1/offers/{id}` | PUT |
| 删除Offer | `/api/v1/offers/{id}` | DELETE |
| 修改状态 | `/api/v1/offers/{id}/status` | PUT |
| AI评估 | `/api/v1/offers/{id}/evaluate` | POST |
| 评估结果 | `/api/v1/offers/{id}/evaluation` | GET |
| KPI数据 | `/api/v1/offers/{id}/kpi` | GET |
| 关联账号 | `/api/v1/offers/{id}/accounts` | GET/POST |
| 解绑账号 | `/api/v1/offers/{id}/accounts/{accountId}` | DELETE |

---

### 需求3: Ads中心 (`/dashboard/ads-center`)

**目标**: 以Ads账号为视角，实现账号授权绑定、状态管理、信息获取、数据统计

#### 核心功能模块

1. **账号列表视图** (Accounts List)
   - 卡片展示：账号名称、ID、平台logo、状态
   - 状态指示：Connected、Disconnected、Syncing、Error
   - 数据预览：总支出、点击数、转化数
   - 最后同步时间

2. **账号授权绑定** (OAuth Binding)
   - 点击"绑定新账号"按钮
   - 选择平台：Google Ads（后续扩展Facebook/TikTok）
   - OAuth授权流程：
     1. 调用`GET /api/v1/adscenter/oauth/url`获取授权URL
     2. 弹出新窗口跳转到Google OAuth
     3. 用户授权后回调`/api/v1/adscenter/oauth/callback`
     4. 前端轮询检查授权状态
     5. 授权成功后显示账号选择器
     6. 选择要绑定的账号，调用`POST /api/v1/adscenter/accounts`

3. **账号状态管理** (Account Management)
   - 查看账号详情：点击卡片进入详情页
   - 同步数据：手动触发`POST /api/v1/adscenter/accounts/{id}/sync`
   - 断开连接：调用`POST /api/v1/adscenter/accounts/{id}/disconnect`
   - 删除账号：调用`DELETE /api/v1/adscenter/accounts/{id}`

4. **账号信息获取** (Account Info)
   - 基础信息：账号ID、名称、币种、时区
   - 授权状态：OAuth Token有效期、刷新时间
   - 关联Offers：显示使用该账号的Offers列表
   - 预算信息：日预算、月预算、当前消耗

5. **账号数据统计** (Account Statistics)
   - 实时数据卡片：
     - 总支出（Total Spend）
     - 总点击（Total Clicks）
     - 总转化（Total Conversions）
     - 平均CPC
     - 转化率
   - 趋势图表：
     - 近30天支出趋势
     - 近30天点击趋势
     - 分日数据对比
   - 数据来源：通过`GET /api/v1/adscenter/accounts/{id}`获取

6. **批量同步** (Bulk Sync)
   - "同步所有账号"按钮
   - 调用`POST /api/v1/adscenter/accounts/sync-all`
   - 显示同步进度（通过SSE实时更新）

#### 数据来源

| 数据项 | API端点 | 方法 |
|--------|---------|------|
| 账号列表 | `/api/v1/adscenter/accounts` | GET |
| 账号详情 | `/api/v1/adscenter/accounts/{id}` | GET |
| OAuth授权URL | `/api/v1/adscenter/oauth/url` | GET |
| OAuth回调 | `/api/v1/adscenter/oauth/callback` | GET |
| 添加账号 | `/api/v1/adscenter/accounts` | POST |
| 同步账号 | `/api/v1/adscenter/accounts/{id}/sync` | POST |
| 同步所有 | `/api/v1/adscenter/accounts/sync-all` | POST |
| 断开连接 | `/api/v1/adscenter/accounts/{id}/disconnect` | POST |
| 删除账号 | `/api/v1/adscenter/accounts/{id}` | DELETE |
| 实时数据流 | `/api/v1/adscenter/accounts/stream` | GET (SSE) |

---

### 需求4: 任务中心 (`/dashboard/tasks`)

**目标**: 以任务为视角，展示需要消耗token的各种任务，包括评估任务、补点击任务、换链接任务

#### 核心功能模块

1. **任务列表视图** (Tasks List)
   - 表格展示：任务ID、类型、状态、Token消耗、创建时间、完成时间
   - 任务类型：
     - **Evaluation**: AI评估任务
     - **ClickBoost**: 补点击任务
     - **LinkRotation**: 换链接任务
     - **BrandAudit**: 品牌审核任务
   - 状态标签：Pending、Running、Completed、Failed、Cancelled

2. **状态筛选Tab** (Status Tabs)
   - 全部任务
   - 进行中（Running）
   - 已完成（Completed）
   - 失败（Failed）
   - 待处理（Pending）

3. **任务详情抽屉** (Task Detail Drawer)
   - 基础信息：任务ID、类型、创建时间
   - 执行进度：
     - 进度条（0-100%）
     - 当前步骤描述
     - 预计剩余时间
   - Token消耗：
     - 预估消耗
     - 实际消耗
     - 消耗明细（分步骤）
   - 执行结果：
     - 成功：显示结果摘要
     - 失败：显示错误信息、重试按钮
   - 关联对象：
     - 如果是Evaluation任务，显示关联的Offer链接
     - 如果是ClickBoost任务，显示关联的Campaign

4. **任务统计卡片** (Task Stats)
   - 今日任务数
   - 本月任务数
   - 今日Token消耗
   - 本月Token消耗
   - 任务成功率

5. **任务操作** (Task Operations)
   - 取消任务：调用`POST /api/v1/console/tasks/{id}/cancel`
   - 重试失败任务：调用`POST /api/v1/console/tasks/{id}/retry`
   - 查看日志：显示任务执行日志

6. **实时更新** (Real-time Updates)
   - 使用SSE监听任务状态变更
   - 调用`GET /api/v1/console/tasks/stream`
   - 自动更新进度条和状态

7. **任务类型详解** (Task Types)

   **评估任务 (Evaluation Task)**
   - 触发方式：创建Offer后自动触发，或手动点击"AI评估"
   - 消耗Token：10-50 tokens（根据评估深度）
   - 执行流程：
     1. 抓取Offer URL内容
     2. 分析页面质量（加载速度、SEO、安全性）
     3. AI评估内容合规性（品牌违规、敏感内容）
     4. 生成评估报告（质量评分、风险等级、优化建议）
   - 结果展示：在Offer详情页显示评估结果

   **补点击任务 (ClickBoost Task)**
   - 触发方式：手动创建，选择Campaign和目标点击量
   - 消耗Token：0.1 token/click
   - 执行流程：
     1. 验证Campaign有效性
     2. 通过浏览器自动化模拟真实点击
     3. 使用代理IP池分散来源
     4. 记录点击日志
   - 结果展示：完成的点击数、消耗Token、点击质量评分

   **换链接任务 (LinkRotation Task)**
   - 触发方式：手动创建，选择要轮换的Offers
   - 消耗Token：5 tokens/link
   - 执行流程：
     1. 检测原链接是否失效
     2. 从备用链接池选择替代链接
     3. 验证新链接有效性
     4. 更新Offer配置
     5. 通知相关Campaign更新链接
   - 结果展示：更换成功的链接数、失败原因

#### 数据来源

| 数据项 | API端点 | 方法 |
|--------|---------|------|
| 任务列表 | `/api/v1/console/tasks` | GET |
| 任务统计 | `/api/v1/console/tasks/stats` | GET |
| 任务详情 | `/api/v1/console/tasks/{id}` | GET |
| 取消任务 | `/api/v1/console/tasks/{id}/cancel` | POST |
| 重试任务 | `/api/v1/console/tasks/{id}/retry` | POST |
| 任务流 | `/api/v1/console/tasks/stream` | GET (SSE) |

---

### 需求5: 个人中心 (`/settings/profile` 等)

**目标**: 用户个人中心，包括个人信息、套餐订阅、Token余额、邀请、签到

#### 核心功能模块

1. **个人信息** (`/settings/profile`)
   - 显示：邮箱、用户名、头像、注册时间
   - 编辑：用户名、头像
   - 密码管理：修改密码、找回密码
   - 安全设置：两步验证、登录设备管理

2. **套餐订阅** (`/settings/subscription`)
   - 当前套餐：
     - 套餐名称（Free/Pro/Elite）
     - 套餐价格
     - 到期时间
     - 套餐功能对比
   - 套餐列表：
     - Free: 1000 tokens/月，基础功能
     - Pro: $29/月，10000 tokens/月，高级功能
     - Elite: $99/月，50000 tokens/月，全功能
   - 操作：
     - 升级套餐：选择新套餐 → Stripe支付 → 回调确认
     - 降级套餐：选择新套餐 → 下个周期生效
     - 取消订阅：取消自动续费

3. **Token余额** (`/settings/tokens`)
   - 统计卡片：
     - 当前余额
     - 今日消耗
     - 本月消耗
     - 待处理预留
   - 充值入口：
     - 充值档位：100/$1, 1000/$9, 5000/$39, 10000/$69
     - Stripe支付
     - 充值历史记录
   - 使用明细：
     - 表格展示：时间、类型、消耗量、余额、描述
     - 类型：评估任务、补点击、换链接、签到奖励、邀请奖励
     - 筛选：按类型、时间范围
   - 交易记录：
     - 充值记录：时间、金额、方式、状态
     - 赠送记录：来源（签到、邀请）

4. **邀请系统** (`/settings/referral`)
   - 邀请链接：
     - 生成专属邀请链接
     - 复制按钮、二维码
   - 邀请奖励规则：
     - 邀请人注册：+100 tokens
     - 被邀请人首次充值：邀请人获得10%返现（tokens）
   - 邀请统计：
     - 已邀请人数
     - 成功注册人数
     - 已充值人数
     - 累计获得tokens
   - 邀请列表：
     - 表格展示：邀请时间、邮箱（脱敏）、状态、奖励

5. **签到系统** (`/settings/checkin`)
   - 签到日历：
     - 显示本月签到情况
     - 连续签到天数
     - 本月累计签到天数
   - 签到按钮：
     - 今日已签到：显示"已签到"灰色按钮
     - 今日未签到：显示"立即签到"按钮
     - 签到成功：弹出奖励提示（+10 tokens）
   - 签到奖励规则：
     - 每日签到：+10 tokens
     - 连续7天：额外+50 tokens
     - 连续30天：额外+200 tokens

#### 数据来源

| 数据项 | API端点 | 方法 |
|--------|---------|------|
| 用户信息 | `/api/v1/console/users/me` | GET |
| 当前订阅 | `/api/v1/billing/subscriptions/me` | GET |
| Token余额 | `/api/v1/billing/tokens/balance` | GET |
| Token使用明细 | `/api/v1/billing/tokens/usage` | GET |
| 交易记录 | `/api/v1/billing/tokens/transactions` | GET |
| 充值 | `/api/v1/billing/tokens/recharge` | POST |
| 邀请信息 | `/api/v1/billing/referral` | GET |
| 签到状态 | `/api/v1/billing/checkin/status` | GET |
| 签到 | `/api/v1/billing/checkin` | POST |

---

## 数据流设计

### Dashboard数据聚合流程

```
[Frontend] /dashboard
    ↓
    ├─→ [Offer Service] GET /api/v1/offers?aggregate=true
    │       → 返回: {total: 150, pending: 45, ready: 60, deployed: 45}
    │
    ├─→ [Billing Service] GET /api/v1/billing/tokens/balance
    │       → 返回: {balance: 5000, todayUsed: 120, monthUsed: 3400}
    │
    ├─→ [Console Service] GET /api/v1/console/tasks/stats
    │       → 返回: {pending: 5, running: 3, completed: 142, failed: 8}
    │
    ├─→ [AdsCenter Service] GET /api/v1/adscenter/accounts
    │       → 返回: [{id, name, status, spend, clicks}, ...]
    │
    ├─→ [Recommendations Service] GET /api/v1/recommend/opportunities
    │       → 返回: [{type: "brand_risk", severity: "high", offer_id}, ...]
    │
    └─→ [Notifications Service] GET /api/v1/notifications/recent
            → 返回: [{id, title, message, timestamp, read}, ...]
```

### Offer与Ads账号关联流程

```
[Frontend] /dashboard/offers/{offerId}
    ↓
1. 查看已关联账号
    GET /api/v1/offers/{offerId}/accounts
    → 返回: [{accountId, accountName, status, bindTime}, ...]

2. 绑定新账号
    POST /api/v1/offers/{offerId}/accounts
    Body: {accountId: "123-456-789"}
    → Offer Service 调用 AdsCenter Service 验证账号
    → 创建关联记录
    → 返回: {success: true, binding: {...}}

3. 解绑账号
    DELETE /api/v1/offers/{offerId}/accounts/{accountId}
    → 删除关联记录
    → 返回: {success: true}
```

### AI评估任务创建流程

```
[Frontend] /dashboard/offers/{offerId} → 点击"AI评估"
    ↓
1. 创建评估任务
    POST /api/v1/offers/{offerId}/evaluate
    Body: {depth: "deep", options: {...}}
    ↓
    [Offer Service]
    ├─→ 检查Token余额（通过Billing Service）
    ├─→ 预留Token（调用Billing.Reserve）
    ├─→ 创建Task记录（通过Console Service）
    └─→ 发布Pub/Sub消息 → offer.evaluation.requested
    ↓
2. Worker监听消息
    [Offer Worker]
    ├─→ 调用Browser-Exec抓取URL内容
    ├─→ 调用AI服务分析内容
    ├─→ 生成评估报告
    ├─→ 扣减Token（调用Billing.Commit）
    └─→ 更新Task状态 → Completed
    ↓
3. 前端实时更新
    [Frontend] 监听SSE
    GET /api/v1/console/tasks/stream
    → 接收任务状态变更事件
    → 更新UI显示进度和结果
```

### OAuth授权流程

```
[Frontend] /dashboard/ads-center → 点击"绑定Google Ads"
    ↓
1. 获取授权URL
    GET /api/v1/adscenter/oauth/url?platform=google_ads
    ↓
    [AdsCenter Service]
    ├─→ 生成state（防CSRF）
    ├─→ 存储state到Redis（5分钟过期）
    └─→ 返回: {authUrl: "https://accounts.google.com/...", state: "xxx"}
    ↓
2. 弹出新窗口授权
    window.open(authUrl, 'oauth', 'width=600,height=700')
    ↓
3. 用户在Google页面授权
    ↓
4. Google回调
    GET /api/v1/adscenter/oauth/callback?code=xxx&state=xxx
    ↓
    [AdsCenter Service]
    ├─→ 验证state
    ├─→ 用code换取access_token和refresh_token
    ├─→ 获取用户的Google Ads账号列表
    ├─→ 存储OAuth Token到数据库（加密）
    └─→ 重定向到前端页面
    ↓
5. 前端关闭授权窗口
    ├─→ 主窗口监听postMessage
    ├─→ 轮询检查授权状态
    └─→ 显示账号选择器
    ↓
6. 用户选择要绑定的账号
    POST /api/v1/adscenter/accounts
    Body: {accountId: "123-456-789", accountName: "My Ads Account"}
    ↓
    [AdsCenter Service]
    ├─→ 创建账号记录
    ├─→ 触发首次数据同步
    └─→ 返回: {success: true, account: {...}}
```

---

## API端点设计

### 新增/增强端点需求

#### Dashboard聚合API（需增强Console Service）

```yaml
GET /api/v1/console/dashboard/stats
summary: 获取Dashboard聚合统计数据
security: [bearerAuth]
responses:
  200:
    content:
      application/json:
        schema:
          type: object
          properties:
            offers:
              type: object
              properties:
                total: {type: integer}
                pending: {type: integer}
                ready: {type: integer}
                deployed: {type: integer}
            tokens:
              type: object
              properties:
                balance: {type: integer}
                todayUsed: {type: integer}
                monthUsed: {type: integer}
            tasks:
              type: object
              properties:
                pending: {type: integer}
                running: {type: integer}
                completed: {type: integer}
                failed: {type: integer}
            adsAccounts:
              type: object
              properties:
                total: {type: integer}
                active: {type: integer}
                totalSpend: {type: number}
                totalClicks: {type: integer}
            notifications:
              type: object
              properties:
                unreadCount: {type: integer}
                recentItems:
                  type: array
                  items: {$ref: '#/components/schemas/Notification'}
            risks:
              type: array
              items: {$ref: '#/components/schemas/RiskAlert'}
```

#### Offer统计API（需增强Offer Service）

```yaml
GET /api/v1/offers?aggregate=stats
summary: 获取Offer统计数据（不返回列表，只返回汇总）
security: [bearerAuth]
responses:
  200:
    content:
      application/json:
        schema:
          type: object
          properties:
            total: {type: integer}
            byStatus:
              type: object
              properties:
                pending: {type: integer}
                ready: {type: integer}
                deployed: {type: integer}
                paused: {type: integer}
                rejected: {type: integer}
            recentTrend:
              type: array
              items:
                type: object
                properties:
                  date: {type: string, format: date}
                  count: {type: integer}
```

#### Task类型扩展（需增强Console Service Schema）

```yaml
components:
  schemas:
    Task:
      type: object
      properties:
        id: {type: string}
        userId: {type: string}
        type:
          type: string
          enum: [evaluation, click_boost, link_rotation, brand_audit]
        status:
          type: string
          enum: [pending, running, completed, failed, cancelled]
        progress:
          type: object
          properties:
            percentage: {type: integer, minimum: 0, maximum: 100}
            currentStep: {type: string}
            totalSteps: {type: integer}
            currentStepIndex: {type: integer}
        tokens:
          type: object
          properties:
            estimated: {type: integer}
            consumed: {type: integer}
            breakdown:
              type: array
              items:
                type: object
                properties:
                  step: {type: string}
                  tokens: {type: integer}
        relatedObject:
          type: object
          properties:
            type: {type: string, enum: [offer, campaign, account]}
            id: {type: string}
            name: {type: string}
        result:
          type: object
          additionalProperties: true
        error:
          type: object
          properties:
            message: {type: string}
            code: {type: string}
            retryable: {type: boolean}
        createdAt: {type: string, format: date-time}
        startedAt: {type: string, format: date-time}
        completedAt: {type: string, format: date-time}
        estimatedCompletionAt: {type: string, format: date-time}
```

---

## 前端组件设计

### Dashboard组件树

```
/dashboard/page.tsx
├── DashboardHeader (已存在)
├── DashboardPageLayout (已存在)
│   ├── AlertsBanner (新增)
│   │   └── RiskAlert[] (风险提醒卡片)
│   ├── DashboardStatsGrid (已存在，需增强)
│   │   ├── StatCard: Total Offers
│   │   ├── StatCard: Pending Offers
│   │   ├── StatCard: Ready Offers
│   │   ├── StatCard: Token Balance
│   │   ├── StatCard: Active Ads Accounts (新增)
│   │   ├── StatCard: Today Token Usage (新增)
│   │   ├── StatCard: Month Token Usage (新增)
│   │   └── StatCard: Pending Tasks (新增)
│   ├── PerformanceCharts (新增)
│   │   ├── OfferStatusPieChart (Offer状态分布)
│   │   ├── OfferTrendLineChart (近30天创建趋势)
│   │   ├── AdsAccountsSummaryCard (Ads账号数据汇总)
│   │   └── TokenUsageTrendChart (Token消耗趋势)
│   ├── NotificationsFeed (新增)
│   │   └── NotificationItem[] (通知列表项)
│   └── QuickActionsCard (已存在)
```

### Offers页面组件树

```
/dashboard/offers/page.tsx
├── OffersHeader
│   ├── SearchBar (搜索框)
│   ├── FilterBar (筛选器)
│   │   ├── StatusFilter (多选下拉)
│   │   ├── CountryFilter (多选下拉)
│   │   ├── CategoryFilter (多选下拉)
│   │   └── DateRangeFilter (日期范围选择器)
│   └── ActionButtons
│       ├── CreateOfferButton
│       ├── BatchDeleteButton (批量删除)
│       └── ExportButton (导出)
├── OffersTable
│   ├── TableHeader
│   │   ├── SelectAllCheckbox
│   │   └── ColumnHeaders (可排序)
│   └── OfferRow[]
│       ├── Checkbox
│       ├── OfferNameCell (点击打开详情抽屉)
│       ├── URLCell
│       ├── CountryCell
│       ├── StatusBadge
│       ├── CreatedAtCell
│       └── ActionsDropdown (编辑、删除、AI评估)
├── OfferDetailDrawer (抽屉组件)
│   ├── DrawerHeader (Offer名称)
│   ├── BasicInfoSection
│   ├── StatusHistoryTimeline
│   ├── AIEvaluationSection
│   │   ├── QualityScore
│   │   ├── RiskLevel
│   │   └── Recommendations
│   ├── KPISection (如已部署)
│   │   ├── ClicksChart
│   │   ├── ConversionsChart
│   │   └── RevenueChart
│   ├── AdsAccountBindingSection
│   │   ├── BoundAccountsList
│   │   │   └── AccountCard[] (已绑定账号)
│   │   └── BindNewAccountButton (打开账号选择器)
│   └── DrawerFooter
│       ├── EditButton
│       ├── DeleteButton
│       └── CloseButton
├── CreateOfferDialog (对话框)
│   └── OfferForm
│       ├── NameInput
│       ├── URLInput (实时验证)
│       ├── CountrySelect
│       ├── CategorySelect
│       ├── DescriptionTextarea
│       └── FormActions (保存草稿、提交)
└── Pagination (分页)
```

### AdsCenter页面组件树

```
/dashboard/ads-center/page.tsx
├── AdsCenterHeader
│   └── BindNewAccountButton (打开OAuth流程)
├── AccountsGrid
│   └── AccountCard[]
│       ├── PlatformLogo (Google Ads logo)
│       ├── AccountName
│       ├── AccountID
│       ├── StatusBadge (Connected/Disconnected/Syncing)
│       ├── DataPreview
│       │   ├── TotalSpend
│       │   ├── TotalClicks
│       │   └── TotalConversions
│       ├── LastSyncTime
│       └── ActionButtons
│           ├── ViewDetailsButton (跳转到详情页)
│           ├── SyncButton (手动同步)
│           └── MoreMenu (断开、删除)
├── AccountDetailPage (/dashboard/ads-center/{id})
│   ├── AccountHeader
│   │   ├── AccountName
│   │   ├── AccountID
│   │   ├── StatusBadge
│   │   └── ActionButtons (同步、断开、删除)
│   ├── BasicInfoCard
│   │   ├── Currency
│   │   ├── Timezone
│   │   ├── OAuthStatus (Token有效期)
│   │   └── BudgetInfo (日预算、月预算)
│   ├── StatsCardsGrid
│   │   ├── TotalSpendCard
│   │   ├── TotalClicksCard
│   │   ├── TotalConversionsCard
│   │   ├── AvgCPCCard
│   │   └── ConversionRateCard
│   ├── TrendChartsSection
│   │   ├── SpendTrendChart (近30天)
│   │   ├── ClicksTrendChart (近30天)
│   │   └── DailyComparisonChart
│   └── RelatedOffersSection
│       ├── RelatedOffersTable
│       └── Pagination
└── OAuthFlowDialog (OAuth授权对话框)
    ├── PlatformSelector (选择平台)
    ├── AuthorizeButton (跳转到OAuth)
    ├── AccountSelector (授权后选择账号)
    └── ConfirmButton (确认绑定)
```

### Tasks页面组件树

```
/dashboard/tasks/page.tsx
├── TasksHeader
│   ├── TaskStatsCards
│   │   ├── TodayTasksCard
│   │   ├── MonthTasksCard
│   │   ├── TodayTokenUsageCard
│   │   └── MonthTokenUsageCard
│   └── FilterTabs
│       ├── AllTab
│       ├── RunningTab
│       ├── CompletedTab
│       ├── FailedTab
│       └── PendingTab
├── TasksTable
│   ├── TableHeader
│   └── TaskRow[]
│       ├── TaskIDCell
│       ├── TaskTypeBadge (Evaluation/ClickBoost/LinkRotation)
│       ├── StatusBadge (Pending/Running/Completed/Failed)
│       ├── TokensCell (消耗量)
│       ├── CreatedAtCell
│       ├── CompletedAtCell
│       └── ActionsDropdown (查看详情、取消、重试)
├── TaskDetailDrawer (详情抽屉)
│   ├── DrawerHeader
│   │   ├── TaskID
│   │   ├── TaskTypeBadge
│   │   └── StatusBadge
│   ├── ProgressSection
│   │   ├── ProgressBar (0-100%)
│   │   ├── CurrentStepDescription
│   │   └── EstimatedTimeRemaining
│   ├── TokenUsageSection
│   │   ├── EstimatedTokens
│   │   ├── ConsumedTokens
│   │   └── TokenBreakdown (分步骤)
│   ├── RelatedObjectSection
│   │   ├── ObjectType (Offer/Campaign/Account)
│   │   ├── ObjectName
│   │   └── JumpToObjectLink
│   ├── ResultSection (如已完成)
│   │   ├── SuccessMessage
│   │   ├── ResultSummary
│   │   └── DetailedReport
│   ├── ErrorSection (如失败)
│   │   ├── ErrorMessage
│   │   ├── ErrorCode
│   │   └── RetryButton
│   └── LogsSection
│       └── ExecutionLogs (执行日志)
└── RealTimeUpdater (SSE监听组件)
    └── useTasksStream() (自定义Hook)
```

### Settings页面组件树

```
/settings/profile/page.tsx (个人信息)
├── ProfileHeader
├── BasicInfoCard
│   ├── AvatarUpload
│   ├── UsernameInput
│   ├── EmailDisplay (不可编辑)
│   └── SaveButton
├── PasswordCard
│   ├── CurrentPasswordInput
│   ├── NewPasswordInput
│   ├── ConfirmPasswordInput
│   └── ChangePasswordButton
└── SecurityCard
    ├── TwoFactorAuth (两步验证)
    └── LoginDevices (登录设备管理)

/settings/subscription/page.tsx (套餐订阅)
├── CurrentPlanCard
│   ├── PlanName (Free/Pro/Elite)
│   ├── PlanPrice
│   ├── ExpiryDate
│   └── ManageButton (升级、降级、取消)
├── PlansComparisonTable
│   ├── FreePlanColumn
│   ├── ProPlanColumn
│   └── ElitePlanColumn
└── BillingHistoryTable
    └── BillingRecord[] (账单记录)

/settings/tokens/page.tsx (Token余额)
├── TokenStatsCards
│   ├── BalanceCard
│   ├── TodayUsageCard
│   ├── MonthUsageCard
│   └── PendingReserveCard
├── RechargeSection
│   ├── RechargeTiers (100/$1, 1000/$9, 5000/$39, 10000/$69)
│   └── RechargeButton (跳转到Stripe)
├── UsageDetailTable
│   └── UsageRecord[] (时间、类型、消耗、余额、描述)
└── TransactionsTable
    └── Transaction[] (充值、赠送记录)

/settings/referral/page.tsx (邀请系统)
├── ReferralLinkCard
│   ├── LinkDisplay
│   ├── CopyButton
│   └── QRCode
├── ReferralRulesCard (奖励规则说明)
├── ReferralStatsCards
│   ├── InvitedCountCard
│   ├── RegisteredCountCard
│   ├── RechargedCountCard
│   └── TotalRewardsCard
└── ReferralListTable
    └── ReferralRecord[] (邀请时间、邮箱、状态、奖励)

/settings/checkin/page.tsx (签到系统)
├── CheckinCalendar (本月签到日历)
│   ├── CalendarGrid (显示签到日期)
│   ├── ContinuousDaysDisplay (连续签到天数)
│   └── MonthTotalDaysDisplay (本月累计签到)
├── CheckinButton
│   ├── AlreadyCheckedIn (已签到状态)
│   └── CheckinAction (立即签到)
├── CheckinRewardsCard (奖励规则)
│   ├── DailyReward (+10 tokens)
│   ├── Weekly Reward (+50 tokens)
│   └── MonthlyReward (+200 tokens)
└── CheckinHistoryTable
    └── CheckinRecord[] (签到日期、奖励tokens)
```

---

## 实施计划

### 阶段1: 架构准备与API增强 (3天)

**目标**: 完善后端API，支持新功能需求

#### Day 1: Console Service增强
- [ ] 增加Dashboard聚合API: `GET /api/v1/console/dashboard/stats`
- [ ] 增强Task Schema: 添加progress、tokens、relatedObject字段
- [ ] 实现SSE任务流: 优化`GET /api/v1/console/tasks/stream`
- [ ] 添加任务类型枚举: evaluation, click_boost, link_rotation, brand_audit

#### Day 2: Offer Service增强
- [ ] 增加统计API: `GET /api/v1/offers?aggregate=stats`
- [ ] 增强Offer-Account关联API: `GET/POST/DELETE /api/v1/offers/{id}/accounts`
- [ ] 优化评估API: 返回详细进度信息
- [ ] 添加批量操作API: `POST /api/v1/offers/batch`

#### Day 3: AdsCenter Service增强
- [ ] 优化OAuth流程: 增加state验证、token刷新
- [ ] 增强账号详情API: 返回完整统计数据
- [ ] 实现批量同步: 优化`POST /api/v1/adscenter/accounts/sync-all`
- [ ] 添加SSE实时数据流: 优化`GET /api/v1/adscenter/accounts/stream`

### 阶段2: Dashboard实现 (3天)

**目标**: 实现完整的Dashboard聚合视图

#### Day 4-5: Dashboard核心组件开发
- [ ] 创建AlertsBanner组件（风险提醒）
- [ ] 增强DashboardStatsGrid（添加4个新卡片）
- [ ] 创建PerformanceCharts组件（饼图、折线图）
- [ ] 创建NotificationsFeed组件（通知列表）
- [ ] 集成数据获取Hooks: `useDashboardStats()`

#### Day 6: Dashboard数据集成与优化
- [ ] 实现并发API调用（Promise.all）
- [ ] 添加Loading骨架屏
- [ ] 实现Error边界处理
- [ ] 优化性能（React.memo、useMemo）
- [ ] 添加E2E测试

### 阶段3: Offers页面实现 (4天)

**目标**: 实现完整的Offer管理功能

#### Day 7-8: Offers列表与筛选
- [ ] 创建OffersHeader（搜索、筛选）
- [ ] 创建OffersTable（表格、排序、分页）
- [ ] 实现筛选逻辑（状态、国家、分类、时间）
- [ ] 实现批量选择与操作
- [ ] 集成数据Hooks: `useOffers()`, `useOfferFilters()`

#### Day 9: Offer详情抽屉
- [ ] 创建OfferDetailDrawer组件
- [ ] 实现基础信息展示
- [ ] 实现状态历史时间线
- [ ] 集成AI评估结果展示
- [ ] 集成KPI数据图表

#### Day 10: Offer-Account关联
- [ ] 实现AdsAccountBindingSection
- [ ] 创建账号选择器
- [ ] 实现绑定/解绑逻辑
- [ ] 显示绑定状态
- [ ] 添加E2E测试

### 阶段4: AdsCenter页面实现 (4天)

**目标**: 实现完整的Ads账号管理功能

#### Day 11-12: OAuth授权流程
- [ ] 创建OAuthFlowDialog组件
- [ ] 实现OAuth窗口弹出与监听
- [ ] 实现授权状态轮询
- [ ] 实现账号选择器
- [ ] 集成Hooks: `useOAuth()`, `useAccountBinding()`

#### Day 13: 账号列表与卡片
- [ ] 创建AccountsGrid组件
- [ ] 创建AccountCard组件
- [ ] 实现账号状态展示
- [ ] 实现手动同步按钮
- [ ] 实现断开/删除操作

#### Day 14: 账号详情页
- [ ] 创建AccountDetailPage
- [ ] 实现统计卡片Grid
- [ ] 实现趋势图表（Recharts）
- [ ] 实现关联Offers列表
- [ ] 添加SSE实时更新
- [ ] 添加E2E测试

### 阶段5: Tasks页面实现 (3天)

**目标**: 实现完整的任务中心功能

#### Day 15-16: 任务列表与详情
- [ ] 创建TasksHeader（统计卡片、筛选Tab）
- [ ] 创建TasksTable（表格展示）
- [ ] 创建TaskDetailDrawer（详情抽屉）
- [ ] 实现进度条组件
- [ ] 实现Token消耗明细
- [ ] 集成Hooks: `useTasks()`, `useTaskDetail()`

#### Day 17: 实时更新与操作
- [ ] 实现SSE监听: `useTasksStream()`
- [ ] 实现取消任务功能
- [ ] 实现重试任务功能
- [ ] 实现任务日志查看
- [ ] 添加E2E测试

### 阶段6: 个人中心实现 (3天)

**目标**: 实现完整的个人中心功能

#### Day 18: Token余额页面
- [ ] 增强TokenStatsCards
- [ ] 创建RechargeSection（充值档位）
- [ ] 创建UsageDetailTable（使用明细）
- [ ] 创建TransactionsTable（交易记录）
- [ ] 集成Hooks: `useTokenBalance()`, `useTokenTransactions()`

#### Day 19: 邀请与签到系统
- [ ] 创建ReferralLinkCard（邀请链接、二维码）
- [ ] 创建ReferralStatsCards（邀请统计）
- [ ] 创建ReferralListTable（邀请列表）
- [ ] 创建CheckinCalendar（签到日历）
- [ ] 创建CheckinButton（签到按钮）
- [ ] 集成Hooks: `useReferral()`, `useCheckin()`

#### Day 20: 订阅管理页面
- [ ] 增强CurrentPlanCard
- [ ] 创建PlansComparisonTable（套餐对比）
- [ ] 集成Stripe支付流程
- [ ] 实现升级/降级/取消订阅
- [ ] 添加E2E测试

### 阶段7: 集成测试与优化 (3天)

**目标**: 全面测试、性能优化、文档完善

#### Day 21: E2E测试完善
- [ ] 补全所有页面的E2E测试
- [ ] 验证关键业务流程
- [ ] 修复测试发现的问题

#### Day 22: 性能优化
- [ ] 前端Bundle分析与优化
- [ ] API响应时间优化
- [ ] 数据库查询优化
- [ ] 实现缓存策略

#### Day 23: 文档与上线
- [ ] 完善用户使用文档
- [ ] 完善开发文档
- [ ] 部署到预发环境
- [ ] UAT用户验收测试
- [ ] 生产环境发布

---

## 技术注意事项

### 1. 数据安全
- ✅ 所有API必须通过JWT认证
- ✅ RLS (Row Level Security) 基于user_id隔离数据
- ✅ OAuth Token加密存储
- ✅ 敏感数据脱敏显示（邀请列表邮箱）

### 2. 性能优化
- ✅ 使用SWR缓存API数据（5分钟）
- ✅ Dashboard并发请求（Promise.all）
- ✅ 图表懒加载（dynamic import）
- ✅ 虚拟滚动（长列表）
- ✅ 分页限制（默认20条）

### 3. 错误处理
- ✅ 统一错误边界组件
- ✅ API错误重试机制（3次）
- ✅ 友好错误提示（Toast）
- ✅ 降级方案（显示骨架屏或空状态）

### 4. i18n国际化
- ✅ 所有文本使用t()函数
- ✅ 支持中英文切换
- ✅ 日期、数字格式化
- ✅ 翻译文件位置: `apps/frontend/public/locales/`

### 5. 测试覆盖
- ✅ 单元测试：关键业务逻辑（80%+覆盖率）
- ✅ 集成测试：API端点（100%覆盖核心API）
- ✅ E2E测试：关键业务流程（100%覆盖）
- ✅ 性能测试：页面加载时间（LCP<2.5s）

---

## 📊 预期成果

完成后，AutoAds将具备以下能力：

1. **Dashboard仪表盘**
   - 一目了然的数据概览
   - 实时风险提醒
   - 消息通知聚合
   - 快速操作入口

2. **Offer管理**
   - 完整的CRUD操作
   - 智能筛选与搜索
   - AI评估集成
   - 与Ads账号无缝关联

3. **Ads中心**
   - OAuth一键授权
   - 账号状态实时监控
   - 数据统计与趋势
   - 批量同步管理

4. **任务中心**
   - 所有任务统一展示
   - 实时进度跟踪
   - Token消耗透明
   - 任务操作便捷

5. **个人中心**
   - 完善的账号管理
   - 灵活的订阅升级
   - 清晰的Token明细
   - 激励机制（签到、邀请）

---

**文档维护**: 请在实施过程中及时更新本文档，记录实际进度和遇到的问题。

**联系人**: Development Team Lead
**更新时间**: 2025-10-15
