# Offer 服务

## 概述

Offer 服务是 autoads 项目的核心业务服务，负责优惠/产品管理、评估、状态管理和 KPI 追踪。本服务采用 **领域驱动设计 (DDD)** 和 **CQRS (命令查询职责分离)** 架构模式，是项目中架构设计的典范。

### 核心功能

- ✅ **Offer 管理**: 创建、更新、删除优惠/产品
- ✅ **Offer 评估**: 集成 Siterank 服务进行评估
- ✅ **状态管理**: evaluating → optimizing → scaling → archived
- ✅ **KPI 追踪**: 曝光、点击、CTR、CPC、ROAS
- ✅ **收入管理**: 收入记录和统计
- ✅ **广告账户关联**: 关联 Google Ads 账户
- ✅ **事件驱动**: 使用 Pub/Sub 发布领域事件
- ✅ **偏好设置**: 用户偏好管理

---

## 架构设计

### DDD (领域驱动设计)

Offer 服务完美实现了 DDD 模式：

```
Domain Layer (领域层)
├── Offer (聚合根)
│   ├── CompleteEvaluation()
│   ├── UpdateStatus()
│   └── AddRevenue()
├── Domain Events (领域事件)
│   ├── OfferCreatedEvent
│   ├── OfferEvaluatedEvent
│   └── OfferStatusChangedEvent
└── Value Objects (值对象)
    ├── OfferStatus
    └── KPI
```

**领域模型示例**:

```go
// Offer 聚合根
type Offer struct {
    ID              string
    UserID          string
    Name            string
    URL             string
    Status          OfferStatus
    SiterankScore   *float64
    CreatedAt       time.Time
    UpdatedAt       time.Time
}

// 业务方法
func (o *Offer) CompleteEvaluation(score float64, finalURL, domain, brandName string) {
    o.EvaluationStatus = "evaluated"
    o.SiterankScore = &score
    o.FinalURL = finalURL
    o.Domain = domain
    if o.Name == "" || o.Name == "Unnamed" {
        o.Name = brandName
    }
    o.UpdatedAt = time.Now()
}
```

### CQRS (命令查询职责分离)

```
Command Side (写模型)
├── HTTP Handlers
│   ├── CreateOffer
│   ├── UpdateOffer
│   └── DeleteOffer
├── Domain Logic
│   └── Offer Aggregate
└── Event Publishing
    └── Pub/Sub

Query Side (读模型)
├── HTTP Handlers
│   ├── ListOffers
│   ├── GetOffer
│   └── GetOfferKPI
├── Projectors
│   └── OfferProjector
└── Read Database
    └── PostgreSQL
```

### 事件驱动架构

```
Event Flow:
1. Command → Offer Aggregate
2. Aggregate → Domain Event
3. Event → Event Bus
4. Event Bus → Pub/Sub
5. Pub/Sub → Subscribers (notifications, analytics, etc.)
```

**事件定义**:

```go
type OfferCreatedEvent struct {
    OfferID     string
    UserID      string
    Name        string
    OriginalUrl string
    Status      string
    CreatedAt   time.Time
}
```

---

## 技术栈

- **语言**: Go 1.25.1
- **框架**: Chi Router
- **数据库**: Cloud SQL PostgreSQL (通过 VPC Connector)
- **缓存**: Redis (autoads-redis)
- **消息队列**: Pub/Sub
- **部署**: GCP Cloud Run (asia-northeast1)
- **认证**: Supabase JWT
- **架构模式**: DDD + CQRS + Event Sourcing

---

## 本地开发

### 前置条件

- Go 1.25+
- Docker (可选)
- GCP 服务账号密钥: `secrets/gcp_codex_dev.json`
- 访问 Secret Manager 的权限

### 环境变量

```bash
# 数据库
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# Pub/Sub
PUBSUB_PROJECT_ID=gen-lang-client-0944935873
PUBSUB_TOPIC=offer-events

# Siterank 服务
SITERANK_SERVICE_URL=https://siterank-preview-...

# Supabase
SUPABASE_URL=https://jzzvizacfyipzdyiqfzb.supabase.co
SUPABASE_ANON_KEY=...
```

### 启动服务

```bash
# 进入服务目录
cd services/offer

# 安装依赖
go mod download

# 运行服务
go run main.go
```

### 数据库初始化

Offer 服务使用代码内嵌 DDL 模式，服务启动时自动创建表：

```go
// internal/handlers/ddl.go
func EnsureAllTables(ctx context.Context, db *sql.DB) error {
    // 自动创建所有表
}
```

**表结构**:
- `Offer` - 主表
- `OfferStatusHistory` - 状态历史
- `OfferPreferences` - 偏好设置
- `OfferKpiDeadLetter` - KPI 死信队列
- `idempotency_keys` - 幂等性键

---

## API 端点

### 认证

所有 API 端点需要 Supabase JWT Token：

```bash
Authorization: Bearer <supabase_jwt_token>
```

### 主要端点

#### Offer 管理

```bash
# 创建 Offer (异步，返回 202)
POST /api/v1/offers
{
  "name": "My Offer",
  "url": "https://example.com",
  "description": "..."
}

# 列出 Offers
GET /api/v1/offers

# 获取 Offer 详情
GET /api/v1/offers/{id}

# 更新 Offer
PUT /api/v1/offers/{id}

# 删除 Offer
DELETE /api/v1/offers/{id}

# 更新状态
PUT /api/v1/offers/{id}/status
{
  "status": "optimizing"
}
```

#### KPI 管理

```bash
# 获取 KPI
GET /api/v1/offers/{id}/kpi

# 聚合 KPI
GET /api/v1/offers/{id}/kpi/aggregate?start=2025-01-01&end=2025-01-31
```

#### 账户关联

```bash
# 列出关联账户
GET /api/v1/offers/{id}/accounts

# 关联账户
POST /api/v1/offers/{id}/accounts
{
  "accountId": "123-456-7890"
}

# 取消关联
DELETE /api/v1/offers/{id}/accounts/{accountId}
```

#### 偏好设置

```bash
# 获取偏好
GET /api/v1/offers/{id}/preferences

# 更新偏好
PUT /api/v1/offers/{id}/preferences
{
  "autoOptimize": true,
  "targetROAS": 3.0
}
```

#### 内部端点

```bash
# 自动状态更新 (内部服务调用)
POST /api/v1/offers/internal/auto-status
X-Service-Token: <internal_token>
```

完整 API 文档请参考 `openapi.yaml`。

---

## 领域模型

### Offer 状态机

```
[创建] → evaluating (评估中)
           ↓
       evaluated (已评估)
           ↓
       optimizing (优化中)
           ↓
       scaling (扩展中)
           ↓
       archived (已归档)
```

### 事件流

```
CreateOffer Command
  ↓
OfferCreatedEvent
  ↓
Pub/Sub Topic: offer-events
  ↓
Subscribers:
  - Notifications Service
  - Analytics Service
  - Siterank Service (触发评估)
```

### 聚合根设计

```go
// Offer 是聚合根，封装所有业务逻辑
type Offer struct {
    // 标识
    ID     string
    UserID string
    
    // 基本信息
    Name        string
    URL         string
    Description string
    
    // 评估信息
    EvaluationStatus string
    SiterankScore    *float64
    FinalURL         string
    Domain           string
    
    // 状态
    Status    OfferStatus
    CreatedAt time.Time
    UpdatedAt time.Time
}

// 业务方法（命令）
func (o *Offer) CompleteEvaluation(...)
func (o *Offer) UpdateStatus(...)
func (o *Offer) AddRevenue(...)
```

---

## 事件系统

### 事件发布器

```go
// 支持多种实现
type Publisher interface {
    Publish(ctx context.Context, event interface{}) error
}

// Pub/Sub 实现
type PubSubPublisher struct {
    client *pubsub.Client
    topic  *pubsub.Topic
}

// Noop 实现（测试用）
type NoopPublisher struct{}
```

### 事件处理器

```go
// 事件处理器接口
type EventHandler interface {
    Handle(ctx context.Context, event interface{}) error
}

// Offer 投影器
type OfferProjector struct {
    db *sql.DB
}

func (p *OfferProjector) Handle(ctx context.Context, event interface{}) error {
    switch e := event.(type) {
    case *OfferCreatedEvent:
        // 更新读模型
    case *OfferEvaluatedEvent:
        // 更新读模型
    }
}
```

---

## 配置说明

### 事件发布

```yaml
# config.yaml
events:
  publisher: pubsub  # pubsub | noop
  topic: offer-events
```

### 数据库

- 使用 Cloud SQL PostgreSQL
- 通过 VPC Connector 访问
- 代码内嵌 DDL，启动时自动创建表

### 缓存

- 使用 Redis 缓存查询结果
- TTL: 5 分钟

---

## 部署

### Preview 环境

```bash
# 推送到 main 分支自动触发部署
git push origin main

# 服务名: offer-preview
# URL: https://offer-preview-...run.app
```

### 生产环境

```bash
# 推送到 production 分支自动触发部署
git push origin production

# 服务名: offer
# URL: https://offer-...run.app
```

---

## 故障排查

### 常见问题

#### 事件发布失败

```bash
# 检查 Pub/Sub Topic
gcloud pubsub topics describe offer-events

# 检查订阅
gcloud pubsub subscriptions list --filter="topic:offer-events"

# 查看死信队列
gcloud pubsub topics describe offer-events-dead-letter
```

#### 数据库表未创建

```bash
# 检查启动日志
gcloud run services logs read offer-preview --limit=100

# 手动执行 DDL
psql $DATABASE_URL < internal/handlers/ddl.sql
```

#### Siterank 评估失败

```bash
# 检查 Siterank 服务健康
curl https://siterank-preview-...run.app/health

# 查看评估日志
gcloud run services logs read offer-preview \
  --filter="textPayload:evaluation"
```

---

## 开发指南

### 代码结构

```
services/offer/
├── cmd/
│   └── server/          # 旧版入口（已废弃）
├── internal/
│   ├── config/          # 配置管理
│   ├── domain/          # 领域模型 ⭐
│   │   ├── events.go   # 领域事件
│   │   └── offer.go    # Offer 聚合根
│   ├── events/          # 事件基础设施 ⭐
│   │   ├── bus.go      # 事件总线
│   │   ├── publisher.go
│   │   └── handler.go
│   ├── handlers/        # HTTP 处理器
│   │   ├── ddl.go      # 数据库表定义
│   │   └── http.go     # HTTP 处理逻辑
│   ├── projectors/      # 事件投影器 ⭐
│   │   └── offer_projector.go
│   └── services/        # 业务服务
│       └── evaluation_service.go
├── main.go              # 主入口
└── openapi.yaml         # API 规范
```

### 添加新功能

#### 1. 添加新的领域事件

```go
// internal/domain/events.go
type OfferArchivedEvent struct {
    OfferID   string
    UserID    string
    Reason    string
    ArchivedAt time.Time
}
```

#### 2. 在聚合根中发布事件

```go
// internal/domain/offer.go
func (o *Offer) Archive(reason string) error {
    o.Status = StatusArchived
    o.UpdatedAt = time.Now()
    
    // 发布事件
    event := &OfferArchivedEvent{
        OfferID:    o.ID,
        UserID:     o.UserID,
        Reason:     reason,
        ArchivedAt: o.UpdatedAt,
    }
    
    return eventBus.Publish(context.Background(), event)
}
```

#### 3. 添加事件处理器

```go
// internal/projectors/offer_projector.go
func (p *OfferProjector) Handle(ctx context.Context, event interface{}) error {
    switch e := event.(type) {
    case *OfferArchivedEvent:
        return p.handleOfferArchived(ctx, e)
    }
}
```

### 测试

```bash
# 运行所有测试
go test ./...

# 运行领域模型测试
go test ./internal/domain/...

# 生成覆盖率报告
go test -v -race -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### 代码规范

- **领域逻辑**: 必须在 `internal/domain/` 中
- **事件定义**: 必须在 `internal/domain/events.go` 中
- **HTTP 处理器**: 只负责请求/响应转换
- **业务逻辑**: 封装在聚合根的方法中
- **测试**: 每个领域方法都要有单元测试

---

## 监控和告警

### Prometheus 指标

- `offer_created_total`: Offer 创建总数
- `offer_evaluation_duration_seconds`: 评估时长
- `offer_status_transitions_total`: 状态转换总数
- `event_published_total`: 事件发布总数

### 事件监控

- 事件发布成功率
- 事件处理延迟
- 死信队列大小

---

## 架构亮点

### 为什么 Offer 服务是架构典范？

1. **完美的 DDD 实现**
   - 清晰的聚合根设计
   - 业务逻辑封装在领域模型中
   - 领域事件驱动状态变化

2. **优雅的 CQRS**
   - 命令和查询完全分离
   - 事件投影器更新读模型
   - 支持最终一致性

3. **灵活的事件系统**
   - 支持多种发布器实现
   - 易于测试（NoopPublisher）
   - 解耦服务依赖

4. **代码简洁**
   - main.go 仅 150 行
   - 高度模块化
   - 易于理解和维护

### 其他服务应该学习什么？

- ✅ 领域模型设计
- ✅ 事件驱动架构
- ✅ 代码组织方式
- ✅ 简洁的 main.go

---

## 贡献指南

### 提交代码

1. 创建功能分支
2. 编写领域模型和测试
3. 实现 HTTP 处理器
4. 添加事件处理器
5. 更新文档
6. 创建 Pull Request

### 提交信息规范

- `feat(domain)`: 领域模型变更
- `feat(events)`: 事件系统变更
- `feat(api)`: API 端点变更
- `refactor`: 代码重构
- `test`: 测试相关

---

## 相关资源

- [OpenAPI 规范](./openapi.yaml)
- [架构分析报告](../../docs/ArchitectureReviewV1/offer-analysis.md)
- [DDD 最佳实践](https://martinfowler.com/tags/domain%20driven%20design.html)
- [CQRS 模式](https://martinfowler.com/bliki/CQRS.html)

---

**最后更新**: 2025-10-08  
**维护者**: 后端团队  
**架构模式**: DDD + CQRS + Event Sourcing  
**状态**: ✅ 生产就绪 | 🌟 架构典范
# Trigger offer service rebuild
