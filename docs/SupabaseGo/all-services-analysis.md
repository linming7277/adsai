# 所有服务分析（基于实际代码）

## 服务列表（14个）

### 1. adscenter - Google Ads账户管理
- **入口**: services/adscenter/cmd/server/main.go
- **语言**: Go
- **功能**: Google Ads账户管理、批量操作、诊断优化
- **路由**: /api/v1/adscenter/*
- **数据库**: Cloud SQL PostgreSQL（独立迁移文件）

### 2. batchopen - 批量打开操作
- **入口**: services/batchopen/cmd/server/main.go
- **语言**: Go
- **功能**: 
  - 事件驱动的批量打开任务
  - 监听StartBatchopenTask事件
  - 创建BatchopenTask记录
- **路由**: 无HTTP路由（纯事件订阅者）
- **数据库**: Cloud SQL PostgreSQL（BatchopenTask表）
- **事件**: 订阅Redis Pub/Sub

### 3. bff - Backend for Frontend
- **入口**: services/bff/cmd/bff/main.go
- **语言**: Go
- **功能**: 
  - 聚合多个服务的数据
  - Dashboard统计数据聚合
  - Redis缓存支持
- **路由**: /api/v1/dashboard/stats
- **数据库**: 无（调用其他服务）

### 4. billing - 计费和订阅管理
- **入口**: services/billing/main.go
- **语言**: Go
- **功能**: 
  - Token两阶段提交（Reserve→Commit/Release）
  - 订阅管理（Subscription表）
  - Token余额管理（UserToken表）
  - Token交易记录（TokenTransaction表）
- **路由**: /api/v1/billing/*，/api/v1/tokens/*
- **数据库**: Cloud SQL PostgreSQL（独立迁移文件000001-000010）

### 5. browser-exec - 浏览器自动化
- **入口**: services/browser-exec/index.js
- **语言**: Node.js + Playwright
- **功能**: 浏览器自动化、网页抓取、反爬虫检测
- **路由**: 待确认
- **数据库**: Cloud SQL PostgreSQL

### 6. console - 后台管理API
- **入口**: services/console/main.go
- **语言**: Go
- **功能**: 后台管理、用户管理、数据统计
- **路由**: /api/v1/console/*
- **数据库**: Cloud SQL PostgreSQL

### 7. gateway-middleware - API网关中间件
- **入口**: services/gateway-middleware/cmd/server/main.go
- **语言**: Go
- **功能**: 
  - JWT验证（已完成）
  - 反向代理（已完成）
  - 订阅查询（待实现）
  - 权限检查（待实现）
  - Token预留（待实现）
- **路由**: 所有路由的统一入口
- **状态**: MVP框架已完成，核心功能待实现

### 8. notifications - 通知服务（已下线）
- **状态**: 已下线，功能已合并到useractivity服务
- **说明**: 用户通知功能现在由useractivity服务提供

### 9. offer - Offer管理
- **入口**: services/offer/main.go
- **语言**: Go
- **功能**: 
  - Offer管理和评估
  - DDD+CQRS架构
  - 事件驱动
- **路由**: /api/v1/offers/*
- **数据库**: Cloud SQL PostgreSQL（代码内嵌DDL）

### 10. projector - 事件投影器
- **入口**: services/projector/main.go
- **语言**: Go
- **功能**: 
  - 监听Pub/Sub事件并投影到数据库
  - 处理OfferCreated、SiterankCompleted等事件
  - 幂等性保证（event_projection表）
- **路由**: POST /push（Pub/Sub推送端点）
- **数据库**: Cloud SQL PostgreSQL（event_projection表、Offer表等）

### 11. proxy-pool - 代理池管理
- **入口**: services/proxy-pool/cmd/server/main.go
- **语言**: Go
- **功能**: 
  - 代理IP池管理
  - 从代理提供商获取代理
  - Redis存储和轮换
  - 支持stub模式（无Redis时）
- **路由**: 待确认（通过handlers注册）
- **数据库**: Redis（代理池存储）

### 12. recommendations - 推荐服务
- **入口**: services/recommendations/main.go
- **语言**: Go
- **功能**: 
  - 推荐算法
  - BigQuery数据分析
  - Firestore缓存
  - 别名管理
- **路由**: 待确认（使用OpenAPI生成）
- **数据库**: Cloud SQL PostgreSQL + BigQuery + Firestore

### 13. siterank - 网站评分
- **入口**: services/siterank/main.go
- **语言**: Go
- **功能**: 
  - 网站评分和Offer评估
  - SimilarWeb数据获取
  - AI评估
- **路由**: /api/v1/offers/{offerId}/evaluate，/api/v1/domains/{domain}/similarweb
- **数据库**: Cloud SQL PostgreSQL（代码内嵌DDL）
  - offer_evaluations（评估记录）
  - evaluation_aggregations（评估聚合统计）
  - token_reservations（Token预留）

### 14. useractivity - 用户活动
- **入口**: services/useractivity/cmd/useractivity/main.go
- **语言**: Go
- **功能**: 
  - 用户通知（SSE实时推送）
  - 签到功能（每日签到奖励Token）
  - 邀请追踪（邀请码生成、邀请关系记录）
  - 试用订阅（待废弃，迁移到billing服务）
  - 事件查询（Console事件查询、导出）
- **路由**: 
  - /api/v1/notifications/*（通知列表、SSE流、标记已读、未读数量）
  - /api/v1/check-in/*（POST签到、GET status、GET history）
  - /api/v1/referral/*（GET邀请信息、GET list、POST track）
  - /api/v1/trial/*（POST create、GET active）- **待废弃**
  - /api/v1/console/events/*（事件查询、导出、类型统计）
- **数据库**: Cloud SQL PostgreSQL（代码内嵌DDL）
  - user_notifications（用户通知）
  - checkins（签到记录）
  - user_checkin_stats（签到统计）
  - referrals（邀请关系）
  - referral_records（邀请记录）
  - trial_subscriptions（试用订阅，待废弃）
  - notification_rules（通知规则）
  - event_store（事件存储，共享表）

## 核心服务关系

### 订阅系统相关服务
1. **billing**: Token管理和订阅管理
2. **useractivity**: 试用订阅、邀请追踪、签到
3. **gateway-middleware**: 统一权限和Token检查（待实现）

### 业务功能服务
1. **offer**: Offer管理
2. **siterank**: 网站评分
3. **adscenter**: Google Ads管理
4. **batchopen**: 批量操作

### 基础设施服务
1. **browser-exec**: 浏览器自动化
2. **proxy-pool**: 代理池
3. **projector**: 事件投影
4. **bff**: 前端聚合
5. **console**: 后台管理
6. **recommendations**: 推荐算法

### 已下线服务
1. **notifications**: 已下线，功能合并到useractivity服务

## 服务总结

**实际运行的服务数量**: 13个（notifications已下线）

**按功能分类**:
- **订阅系统**: billing, useractivity, gateway-middleware
- **业务功能**: offer, siterank, adscenter, batchopen
- **基础设施**: browser-exec, proxy-pool, projector, bff, console, recommendations

## 下一步

1. 详细分析待确认服务的代码
2. 更新需求文档，反映所有服务的实际功能
3. 明确订阅系统完善涉及的服务和功能
