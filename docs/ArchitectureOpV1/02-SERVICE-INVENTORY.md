# 服务清单与职责分析

**创建日期**: 2025-10-16
**服务总数**: 14个（前端1个 + 后端13个）

---

## 📋 服务分类

### 🎨 前端层（1个）

#### frontend
- **技术栈**: Next.js 14 (App Router) + Makerkit UI
- **部署**: Cloud Run (frontend-preview / frontend)
- **域名**:
  - Preview: https://preview.example.com
  - Production: https://www.example.com
- **核心职责**:
  - 用户界面展示
  - 与Supabase Auth交互（Google OAuth）
  - 通过API Gateway调用后端服务
  - 客户端状态管理
- **关键路由**:
  ```
  /auth/sign-in              # 登录
  /dashboard                 # 用户Dashboard
  /dashboard/offers          # Offers管理
  /adscenter                 # 广告中心
  /settings/*                # 用户设置
  /manage                    # 管理后台（仅管理员）
  ```
- **API调用**: 所有后端服务通过API Gateway

---

### 💼 核心业务层（3个）

#### 1. offer
- **语言**: Go 1.25
- **端口**: 8080
- **数据库**: Cloud SQL PostgreSQL
- **核心职责**:
  - ✅ Offer CRUD操作
  - ✅ Offer状态管理（draft → active → paused）
  - ✅ 评估请求网关（权限验证 + Token预留）
  - ✅ 事件发布（offer.created, offer.evaluation.requested）
  - ✅ KPI数据管理
- **对外API**:
  ```
  POST   /api/v1/offers                      # 创建Offer
  GET    /api/v1/offers                      # 列表
  GET    /api/v1/offers/{id}                 # 详情
  PUT    /api/v1/offers/{id}                 # 更新
  POST   /api/v1/offers/{id}/evaluate        # 触发评估
  GET    /api/v1/offers/{id}/evaluation      # 评估结果
  ```
- **依赖服务**:
  - siterank (评估功能，通过Pub/Sub异步)
  - billing (Token管理)
- **设计亮点**:
  - ✅ 优秀的DDD实现（领域模型清晰）
  - ✅ 完整的事件驱动架构
  - ✅ main.go仅150行（代码简洁）
- **优化建议**:
  - ⚠️ `offers_evaluation_handlers.go` 405行，需拆分

---

#### 2. billing
- **语言**: Go 1.25
- **端口**: 8080
- **数据库**: Cloud SQL PostgreSQL
- **核心职责**:
  - ✅ 订阅管理（Starter/Professional/Elite）
  - ✅ Token余额管理（查询、预留、提交、释放）
  - ✅ Token交易记录
  - ✅ 签到功能（每日免费Token）
  - ✅ Token一致性校验和修复
- **对外API**:
  ```
  GET    /api/v1/billing/subscription          # 订阅信息
  GET    /api/v1/billing/tokens/balance        # Token余额
  GET    /api/v1/billing/tokens/transactions   # 交易记录
  POST   /api/v1/billing/tokens/reserve        # 预留Token
  POST   /api/v1/billing/tokens/commit         # 确认消费
  POST   /api/v1/billing/tokens/release        # 释放预留
  POST   /api/v1/billing/checkin               # 签到
  ```
- **设计亮点**:
  - ✅ 两阶段提交（2PC）模式
  - ✅ 完整的审计日志
  - ✅ Token一致性保障
- **被依赖**: offer, adscenter, siterank（所有消费Token的服务）
- **优化建议**: 无重大问题

---

#### 3. adscenter
- **语言**: Go 1.25
- **端口**: 8080
- **数据库**: Cloud SQL PostgreSQL
- **核心职责**:
  - ✅ Google Ads账户连接（OAuth）
  - ✅ MCC（Manager Customer Client）链接管理
  - ✅ 广告投放策略配置
  - ✅ 批量操作（创建广告、修改预算等）
  - ✅ 广告诊断和优化建议
- **对外API**:
  ```
  GET    /api/v1/adscenter/accounts            # 账户列表
  POST   /api/v1/adscenter/oauth/url           # OAuth授权URL
  POST   /api/v1/adscenter/oauth/callback      # OAuth回调
  POST   /api/v1/adscenter/bulk-actions        # 批量操作
  GET    /api/v1/adscenter/diagnose            # 诊断
  ```
- **依赖服务**:
  - billing (权限和Token管理)
  - browser-exec (网站检查)
  - siterank (评分)
  - recommendations (推荐)
  - Google Ads API (外部)
- **设计问题**:
  - ⚠️ main.go 450+行（需重构）
  - ⚠️ 依赖过多（7个服务），耦合度高
- **优化建议**:
  - 拆分main.go
  - 考虑服务拆分（OAuth、Bulk Actions、Diagnose可独立）

---

### 🛠️ 功能服务层（3个）

#### 4. siterank
- **语言**: Go 1.25
- **端口**: 8080
- **数据库**: Cloud SQL PostgreSQL + Redis
- **核心职责**:
  - ✅ Offer评估编排（Basic + AI）
  - ✅ 调用browser-exec获取landing page
  - ✅ 调用SimilarWeb API获取域名数据
  - ✅ 调用Gemini AI进行智能评估
  - ✅ SimilarWeb数据双层缓存（Redis + PostgreSQL）
  - ✅ 评估历史记录
- **对外API**:
  ```
  POST   /api/v1/offers/{offerId}/evaluate      # 创建评估
  GET    /api/v1/offers/{offerId}/evaluations/latest  # 最新评估
  GET    /api/v1/offers/{offerId}/evaluations   # 评估列表
  GET    /api/v1/evaluations/{evaluationId}     # 评估详情
  GET    /api/v1/domains/{domain}/similarweb    # SimilarWeb数据
  ```
- **依赖服务**:
  - browser-exec (浏览器访问 + SimilarWeb抓取)
  - billing (Token消费)
- **设计问题**:
  - ❌ `internal/evaluation/service.go` 978行（严重违规）
  - ⚠️ 缓存策略过度设计（PostgreSQL当缓存）
  - ⚠️ HTTP和后台任务未分离
- **优化建议**:
  - **P0**: 拆分service.go为6个文件
  - **P1**: 去除PostgreSQL缓存表
  - **P1**: 分离API和Worker

---

#### 5. browser-exec
- **语言**: Node.js 22
- **端口**: 8080
- **技术**: Express + Playwright
- **核心职责**:
  - ✅ 浏览器自动化（访问URL、截图、提取内容）
  - ✅ Offer跳转链解析
  - ✅ SimilarWeb数据抓取（专用端点）
  - ✅ 代理池集成
  - ✅ 浏览器Context池管理
- **对外API**:
  ```
  POST   /api/v1/browser/visit                # 访问URL
  POST   /api/v1/browser/resolve-offer        # 解析Offer跳转链
  POST   /api/v1/browser/similarweb           # SimilarWeb抓取
  POST   /api/v1/browser/evaluate-offer       # Offer评估专用
  GET    /api/v1/browser/pools                # Context池状态
  ```
- **依赖服务**:
  - proxy-pool (代理IP)
- **被依赖**: siterank, adscenter
- **设计问题**:
  - ⚠️ index.js ~800行（偏大）
  - ⚠️ Context重复创建，未充分复用
- **优化建议**:
  - Context池复用优化
  - 代码模块化拆分

---

#### 6. recommendations
- **语言**: Go 1.25
- **端口**: 8080
- **数据库**: Cloud SQL PostgreSQL
- **核心职责**:
  - ✅ 品牌关键词检测
  - ✅ 品牌覆盖率分析
  - ✅ 机会发现（Opportunities）
  - ✅ 竞争对手分析
- **对外API**:
  ```
  POST   /api/v1/recommend/keywords/brand-check       # 品牌关键词检测
  GET    /api/v1/recommend/brand-coverage             # 品牌覆盖率
  GET    /api/v1/recommend/opportunities              # 机会列表
  ```
- **被依赖**: adscenter
- **优化建议**: 无重大问题

---

### 🏗️ 基础设施层（2个）

#### 7. proxy-pool
- **语言**: Go 1.25
- **端口**: 8080
- **数据库**: Redis
- **核心职责**:
  - ✅ 代理IP池管理（分发和轮换）
  - ✅ 代理供应商对接（从第三方API采购代理）
  - ✅ 代理自动补充（低水位触发 + 定期检查）
  - ✅ 代理健康检查和质量监控
  - ✅ 国家/地区分组
- **对外API**:
  ```
  GET    /api/v1/proxies/acquire        # 获取代理
  POST   /api/v1/proxies/report         # 上报代理状态
  GET    /api/v1/proxies/stats          # 代理池统计
  ```
- **被依赖**: browser-exec, siterank
- **架构说明**:
  - 单体服务，集成了代理分发和采购管理功能
  - `Manager` 组件负责从供应商API批量获取代理
  - 自动水位管理：低于阈值触发后台补充
  - 启动时预填充200个代理，运行时维持池深度
- **优化建议**: 架构合理，无需拆分

---

#### 8. projector
- **语言**: Go 1.25
- **核心职责**:
  - ✅ 事件投影（Event Projection）
  - ✅ 读模型构建（CQRS）
  - ✅ 数据同步和聚合
- **订阅事件**: Pub/Sub所有业务事件
- **优化建议**: 无重大问题

---

### 🔧 辅助服务层（4个）

#### 10. console
- **语言**: Go 1.25
- **端口**: 8080
- **数据库**: Cloud SQL PostgreSQL
- **核心职责**:
  - ✅ 管理后台API（仅管理员）
  - ✅ 系统统计和监控
  - ✅ 用户管理
  - ✅ **通知功能（集成）**: 通知发送、规则管理、历史记录
  - ✅ 任务管理
- **对外API**:
  ```
  # 管理后台
  GET    /api/v1/console/stats                     # 系统统计
  GET    /api/v1/console/users                     # 用户列表
  GET    /api/v1/console/tasks                     # 任务列表
  GET    /api/v1/console/dashboard/stats           # Dashboard统计

  # 通知功能
  GET    /api/v1/console/notifications/recent      # 最近通知
  POST   /api/v1/console/notifications/read        # 标记已读
  GET    /api/v1/console/notifications/unread-count # 未读数量
  POST   /api/v1/console/notifications/templates/create  # 通知模板
  POST   /api/v1/console/notifications/broadcast   # 广播通知
  ```
- **订阅事件**: 所有需要通知的业务事件（Pub/Sub）
- **架构说明**: Notifications功能**已集成在Console服务中**，不是独立服务
- **优化建议**: 无重大问题

---

#### 11. batchopen
- **语言**: Go 1.25
- **核心职责**:
  - ✅ 批量打开URL任务
  - ✅ 批量数据处理
- **优化建议**: 功能独立，运行正常

---

#### 12. useractivity
- **语言**: Go 1.25
- **端口**: 8080
- **数据库**: Cloud SQL PostgreSQL
- **部署状态**: ⚠️ **仅preview环境**（生产环境待部署）
- **核心职责**:
  - ✅ 用户行为追踪
  - ✅ 访问日志记录
  - ✅ 行为分析
  - ✅ **通知功能（集成）**:
    - 通知发送（邮件、站内信）
    - 通知历史记录
    - 通知规则管理
- **对外API**:
  ```
  # 通知功能
  GET    /api/v1/notifications/recent        # 最近通知
  POST   /api/v1/notifications/read          # 标记已读
  GET    /api/v1/notifications/unread-count  # 未读数量
  GET    /api/v1/notifications/stream        # SSE通知流
  DELETE /api/v1/notifications/{id}          # 删除通知
  ```
- **订阅事件**: 用户操作事件、业务通知事件
- **被依赖**: frontend
- **架构说明**: Notifications功能**集成在本服务中**，不是独立服务
- **优化建议**: 需部署生产环境

---

#### 13. bff
- **语言**: Go 1.25
- **端口**: 8080
- **数据库**: Redis (缓存)
- **部署状态**: ⚠️ **仅preview环境**（生产环境待部署）
- **核心职责**:
  - ✅ Dashboard数据聚合
  - ✅ 跨服务数据整合
- **对外API**:
  ```
  GET    /api/v1/dashboard/stats    # 聚合Dashboard统计
  ```
- **被依赖**: frontend
- **优化建议**: 需部署生产环境

---

## 📊 服务依赖矩阵

| 服务 | 出度（依赖） | 入度（被依赖） | 耦合度 | 评分 |
|------|-------------|---------------|--------|------|
| frontend | 0 (通过Gateway) | 0 | 低 | 9/10 |
| offer | 2 | 1 | 低 | 8/10 |
| billing | 1 | 3 | 低 | 9/10 |
| adscenter | 7 | 1 | 高 | 4/10 |
| siterank | 2 | 2 | 中 | 7/10 |
| browser-exec | 1 | 2 | 中 | 7/10 |
| recommendations | 0 | 1 | 低 | 9/10 |
| proxy-pool | 1 | 2 | 低 | 8/10 |
| console | 3 | 0 | 中 | 7/10 |
| batchopen | 0 | 0 | 低 | 9/10 |
| useractivity | 1 | 1 | 低 | 8/10 |
| bff | 3 | 1 | 中 | 7/10 |

---

## 🎯 关键服务识别

### 核心路径服务（Critical Path）
1. **frontend** - 用户入口
2. **offer** - 核心业务
3. **billing** - Token管理（基础能力）
4. **siterank** - 评估功能（核心功能）
5. **browser-exec** - 浏览器自动化（基础设施）

### 单点故障风险
1. **billing** - 被3个服务依赖，Token管理核心
2. **browser-exec** - 被2个服务依赖，无替代方案
3. **proxy-pool** - 被2个服务依赖，代理必需

### 解耦良好的服务
1. **useractivity** - 异步事件驱动，故障不影响主流程（含通知功能）
2. **projector** - 独立的投影器，可重建
3. **recommendations** - 辅助功能，可降级
4. **bff** - 数据聚合层，可降级

---

## 📝 服务健康度总结

### ✅ 优秀（8-10分）
- **offer**: 代码简洁，设计优秀
- **billing**: 功能完整，设计清晰
- **useractivity**: 解耦良好，职责单一（含通知功能）
- **proxy-pool**: 独立稳定
- **bff**: 数据聚合简洁

### ⚠️ 良好（6-7分）
- **siterank**: 功能强大，但代码过大
- **browser-exec**: 功能复杂，待优化
- **console**: 功能独立，代码中等

### ❌ 需改进（<6分）
- **adscenter**: 依赖过多，代码过大

### ⚠️ 部署待完善
- **useractivity**: 仅preview环境，生产环境待部署
- **bff**: 仅preview环境，生产环境待部署

---

## 📚 参考

- [01-CURRENT-ARCHITECTURE.md](./01-CURRENT-ARCHITECTURE.md) - 总体架构
- [03-DATA-FLOW-ANALYSIS.md](./03-DATA-FLOW-ANALYSIS.md) - 数据流分析

**版本**: 1.0
**作者**: Kiro AI Assistant
