# Phase 3-4 微服务架构深度优化计划

**创建时间**: 2025-10-06
**状态**: 执行中
**优先级**: P1-P2

---

## 一、优化任务概览

### 1.1 四大优化任务

| 任务 | 优先级 | 预计工作量 | 状态 |
|------|--------|-----------|------|
| 数据库逻辑隔离 | P1 | 2-3天 | 进行中 |
| Console BFF 模式 | P2 | 3-4天 | 待开始 |
| 引入 gRPC | P2 | 4-5天 | 待开始 |
| 完善分布式追踪 | P2 | 2-3天 | 待开始 |

### 1.2 总体目标

- **性能提升**: 数据库隔离减少锁竞争，gRPC 提升内部调用性能
- **可维护性**: BFF 模式简化前端集成，分布式追踪增强可观测性
- **扩展性**: Schema 隔离为未来物理分离打基础

---

## 二、任务1: 数据库逻辑隔离

### 2.1 当前状态

✅ **已完成**:
- Schema 隔离迁移脚本: `000003_schema_isolation.up.sql`
- 带视图兼容性的迁移脚本: `020_schema_isolation_with_views.up.sql`
- DB Migrator Job 配置: `schema-isolation-job.yaml`

🟡 **待完成**:
- 更新各服务的数据库连接配置
- 设置 `search_path` 或使用 schema 前缀
- 验证服务启动和功能正常

### 2.2 实施步骤

#### 步骤1: 更新服务环境变量配置

为每个服务添加 `SCHEMA_NAME` 环境变量:

```yaml
# offer 服务
- name: SCHEMA_NAME
  value: "offer_db"

# billing 服务
- name: SCHEMA_NAME
  value: "billing_db"

# siterank 服务
- name: SCHEMA_NAME
  value: "siterank_db"

# adscenter 服务
- name: SCHEMA_NAME
  value: "adscenter_db"
```

#### 步骤2: 更新数据库连接初始化

在每个服务的 `main.go` 中设置 `search_path`:

```go
// 方式1: 连接 URL 中指定 (推荐)
dbURL := os.Getenv("DATABASE_URL") + "?search_path=offer_db,public"

// 方式2: 连接后执行 SET
_, err := db.Exec("SET search_path TO offer_db, public")
```

#### 步骤3: 创建统一的数据库初始化函数

在 `pkg/database` 创建:

```go
// pkg/database/init.go
package database

import (
    "database/sql"
    "fmt"
    "os"
)

func InitWithSchema(dbURL string) (*sql.DB, error) {
    schema := os.Getenv("SCHEMA_NAME")
    if schema == "" {
        schema = "public"
    }

    // 追加 search_path
    if !strings.Contains(dbURL, "search_path") {
        if strings.Contains(dbURL, "?") {
            dbURL += fmt.Sprintf("&search_path=%s,public", schema)
        } else {
            dbURL += fmt.Sprintf("?search_path=%s,public", schema)
        }
    }

    db, err := sql.Open("postgres", dbURL)
    if err != nil {
        return nil, err
    }

    // 验证 search_path
    var currentPath string
    err = db.QueryRow("SHOW search_path").Scan(&currentPath)
    if err != nil {
        return nil, err
    }

    log.Printf("Database connected with search_path: %s", currentPath)
    return db, nil
}
```

#### 步骤4: 更新各服务使用新的初始化函数

```go
// services/offer/main.go
import "github.com/xxrenzhe/autoads/pkg/database"

func main() {
    dbURL := os.Getenv("DATABASE_URL")
    db, err := database.InitWithSchema(dbURL)
    if err != nil {
        log.Fatalf("Database init failed: %v", err)
    }
    defer db.Close()
    // ...
}
```

#### 步骤5: 验证和回滚计划

**验证步骤**:
1. 预发环境部署，检查服务启动日志
2. 执行 E2E 测试，验证核心功能
3. 监控错误率和延迟指标

**回滚方案**:
- 保留 public schema 的视图，服务可直接回滚到旧版本
- 视图提供完全兼容性，无需数据迁移

### 2.3 预期收益

- **性能**: 减少跨服务表锁竞争 (~10-20%)
- **隔离性**: 服务间数据逻辑隔离
- **可扩展性**: 为未来物理数据库分离打基础

---

## 三、任务2: Console 服务 BFF 模式完善

### 3.1 当前状态

**现有功能** (24个端点):
- ✅ Health endpoints (4个)
- ✅ Config snapshot (1个)
- ✅ User Management (2个)
- ✅ Token Management (8个)
- ✅ Dashboard Stats (1个)
- ✅ Config Management (4个)
- ✅ API Keys Management (4个)

**缺失功能**:
- ❌ 多服务数据聚合 (Offer + Billing + Adscenter)
- ❌ 管理员专用批量操作
- ❌ 跨服务报表导出
- ❌ 服务健康状况聚合

### 3.2 BFF 模式架构设计

```
Frontend (管理后台)
    ↓
Console Service (BFF)
    ├─→ Offer Service (HTTP)
    ├─→ Billing Service (HTTP)
    ├─→ Adscenter Service (HTTP)
    ├─→ Siterank Service (HTTP)
    └─→ Database (只读查询，无写入)
```

**设计原则**:
1. Console 不直接写入业务表，只通过 API 调用
2. 提供数据聚合和转换，简化前端逻辑
3. 实现管理员权限校验
4. 支持批量操作和导出

### 3.3 实施步骤

#### 步骤1: 创建服务客户端层

```go
// services/console/internal/clients/clients.go
package clients

import (
    "context"
    "time"
    httpx "github.com/xxrenzhe/autoads/pkg/http"
)

type ServiceClients struct {
    Offer     *httpx.Client
    Billing   *httpx.Client
    Adscenter *httpx.Client
    Siterank  *httpx.Client
}

func NewServiceClients() *ServiceClients {
    return &ServiceClients{
        Offer: httpx.NewClient(
            httpx.WithBaseURL(os.Getenv("OFFER_URL")),
            httpx.WithTimeout(10*time.Second),
            httpx.WithCircuitBreaker(5, 30*time.Second),
        ),
        Billing: httpx.NewClient(
            httpx.WithBaseURL(os.Getenv("BILLING_URL")),
            httpx.WithTimeout(10*time.Second),
            httpx.WithCircuitBreaker(5, 30*time.Second),
        ),
        // ...
    }
}
```

#### 步骤2: 创建数据聚合端点

```go
// services/console/internal/handlers/aggregation.go
package handlers

type UserDashboard struct {
    User          User              `json:"user"`
    Subscription  BillingInfo       `json:"subscription"`
    OfferCount    int              `json:"offerCount"`
    ActiveOffers  []OfferSummary   `json:"activeOffers"`
    TokenBalance  int              `json:"tokenBalance"`
    RecentActions []Action         `json:"recentActions"`
}

func (h *Handler) GetUserDashboard(w http.ResponseWriter, r *http.Request, userID string) {
    ctx := r.Context()

    var wg sync.WaitGroup
    var dashboard UserDashboard
    var errors []error

    // 并发获取各服务数据
    wg.Add(4)

    go func() {
        defer wg.Done()
        user, err := h.clients.GetUser(ctx, userID)
        if err != nil {
            errors = append(errors, err)
            return
        }
        dashboard.User = user
    }()

    go func() {
        defer wg.Done()
        sub, err := h.clients.Billing.GetSubscription(ctx, userID)
        if err != nil {
            errors = append(errors, err)
            return
        }
        dashboard.Subscription = sub
    }()

    go func() {
        defer wg.Done()
        offers, err := h.clients.Offer.ListOffers(ctx, userID)
        if err != nil {
            errors = append(errors, err)
            return
        }
        dashboard.OfferCount = len(offers)
        dashboard.ActiveOffers = filterActiveOffers(offers)
    }()

    go func() {
        defer wg.Done()
        balance, err := h.clients.Billing.GetTokenBalance(ctx, userID)
        if err != nil {
            errors = append(errors, err)
            return
        }
        dashboard.TokenBalance = balance
    }()

    wg.Wait()

    if len(errors) > 0 {
        // 部分失败也返回数据，标记错误
        dashboard.Errors = errors
    }

    json.NewEncoder(w).Encode(dashboard)
}
```

#### 步骤3: 添加批量操作端点

```go
// POST /api/v1/console/bulk/offers/archive
func (h *Handler) BulkArchiveOffers(w http.ResponseWriter, r *http.Request) {
    var req struct {
        OfferIDs []string `json:"offerIds"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        errors.Write(w, r, 400, "INVALID_REQUEST", "Invalid request body", nil)
        return
    }

    results := make([]BulkOperationResult, 0, len(req.OfferIDs))

    for _, id := range req.OfferIDs {
        err := h.clients.Offer.ArchiveOffer(r.Context(), id)
        results = append(results, BulkOperationResult{
            ID:      id,
            Success: err == nil,
            Error:   err,
        })
    }

    json.NewEncoder(w).Encode(map[string]any{
        "total":     len(req.OfferIDs),
        "succeeded": countSucceeded(results),
        "failed":    countFailed(results),
        "results":   results,
    })
}
```

#### 步骤4: 实现报表导出

```go
// GET /api/v1/console/reports/token-usage?format=csv
func (h *Handler) ExportTokenUsageReport(w http.ResponseWriter, r *http.Request) {
    format := r.URL.Query().Get("format") // csv, json, xlsx

    // 获取数据
    data, err := h.fetchTokenUsageData(r.Context())
    if err != nil {
        errors.Write(w, r, 500, "FETCH_FAILED", "Failed to fetch data", nil)
        return
    }

    switch format {
    case "csv":
        w.Header().Set("Content-Type", "text/csv")
        w.Header().Set("Content-Disposition", "attachment; filename=token-usage.csv")
        h.writeCSV(w, data)
    case "xlsx":
        w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        w.Header().Set("Content-Disposition", "attachment; filename=token-usage.xlsx")
        h.writeExcel(w, data)
    default:
        json.NewEncoder(w).Encode(data)
    }
}
```

### 3.4 新增端点清单

| 端点 | 方法 | 功能 | 优先级 |
|------|------|------|--------|
| `/api/v1/console/dashboard/:userId` | GET | 用户仪表板聚合 | P0 |
| `/api/v1/console/health/services` | GET | 所有服务健康状况 | P0 |
| `/api/v1/console/bulk/offers/archive` | POST | 批量归档 Offers | P1 |
| `/api/v1/console/bulk/tokens/topup` | POST | 批量充值 | P1 |
| `/api/v1/console/reports/token-usage` | GET | Token 使用报表 | P1 |
| `/api/v1/console/reports/offer-metrics` | GET | Offer 指标报表 | P2 |
| `/api/v1/console/analytics/revenue` | GET | 收入分析 | P2 |

---

## 四、任务3: 引入 gRPC

### 4.1 gRPC 使用场景

**适合 gRPC 的场景**:
- ✅ 内部服务间同步调用 (低延迟要求)
- ✅ 高频调用 (如 billing → token 验证)
- ✅ 强类型契约 (proto 定义)

**不适合 gRPC**:
- ❌ 前端直接调用 (浏览器兼容性)
- ❌ 异步事件 (用 Pub/Sub)
- ❌ 外部 API (用 REST)

### 4.2 实施计划

#### 阶段1: 基础设施准备

**创建 proto 目录结构**:
```
proto/
  ├── billing/
  │   └── v1/
  │       ├── billing.proto
  │       └── token.proto
  ├── offer/
  │   └── v1/
  │       └── offer.proto
  └── common/
      └── v1/
          └── common.proto
```

**示例 proto 定义**:
```protobuf
// proto/billing/v1/token.proto
syntax = "proto3";
package billing.v1;
option go_package = "github.com/xxrenzhe/autoads/proto/billing/v1;billingv1";

import "google/protobuf/timestamp.proto";

service TokenService {
  rpc GetBalance(GetBalanceRequest) returns (GetBalanceResponse);
  rpc ReserveTokens(ReserveTokensRequest) returns (ReserveTokensResponse);
  rpc CommitTokens(CommitTokensRequest) returns (CommitTokensResponse);
  rpc ReleaseTokens(ReleaseTokensRequest) returns (ReleaseTokensResponse);
}

message GetBalanceRequest {
  string user_id = 1;
}

message GetBalanceResponse {
  int32 available = 1;
  int32 reserved = 2;
  google.protobuf.Timestamp updated_at = 3;
}

message ReserveTokensRequest {
  string user_id = 1;
  int32 amount = 2;
  string task_id = 3;
  string idempotency_key = 4;
}

message ReserveTokensResponse {
  bool success = 1;
  string tx_id = 2;
  string error = 3;
}
```

#### 阶段2: 生成代码和实现服务

**Makefile**:
```makefile
.PHONY: proto
proto:
	protoc --go_out=. --go_opt=paths=source_relative \
	       --go-grpc_out=. --go-grpc_opt=paths=source_relative \
	       proto/billing/v1/*.proto
	protoc --go_out=. --go_opt=paths=source_relative \
	       --go-grpc_out=. --go-grpc_opt=paths=source_relative \
	       proto/offer/v1/*.proto
```

**服务端实现**:
```go
// services/billing/internal/grpc/server.go
package grpc

import (
    "context"
    billingv1 "github.com/xxrenzhe/autoads/proto/billing/v1"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"
)

type TokenServer struct {
    billingv1.UnimplementedTokenServiceServer
    db *sql.DB
}

func (s *TokenServer) GetBalance(ctx context.Context, req *billingv1.GetBalanceRequest) (*billingv1.GetBalanceResponse, error) {
    if req.UserId == "" {
        return nil, status.Error(codes.InvalidArgument, "user_id required")
    }

    // 查询数据库
    var available, reserved int32
    err := s.db.QueryRowContext(ctx,
        `SELECT available, reserved FROM billing_db."UserToken" WHERE user_id = $1`,
        req.UserId).Scan(&available, &reserved)

    if err == sql.ErrNoRows {
        return &billingv1.GetBalanceResponse{Available: 0, Reserved: 0}, nil
    }
    if err != nil {
        return nil, status.Error(codes.Internal, "database error")
    }

    return &billingv1.GetBalanceResponse{
        Available: available,
        Reserved:  reserved,
    }, nil
}
```

**启动 gRPC 服务器**:
```go
// services/billing/main.go
func main() {
    // ... HTTP 服务器初始化

    // gRPC 服务器
    grpcPort := os.Getenv("GRPC_PORT")
    if grpcPort == "" {
        grpcPort = "50051"
    }

    lis, err := net.Listen("tcp", ":"+grpcPort)
    if err != nil {
        log.Fatalf("failed to listen: %v", err)
    }

    grpcServer := grpc.NewServer()
    billingv1.RegisterTokenServiceServer(grpcServer, &grpc.TokenServer{DB: db})

    go func() {
        log.Printf("gRPC server listening on port %s", grpcPort)
        if err := grpcServer.Serve(lis); err != nil {
            log.Fatalf("failed to serve gRPC: %v", err)
        }
    }()

    // ... 启动 HTTP 服务器
}
```

#### 阶段3: 客户端调用

```go
// services/adscenter/internal/billing/client.go
package billing

import (
    "context"
    "time"
    billingv1 "github.com/xxrenzhe/autoads/proto/billing/v1"
    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"
)

type GRPCClient struct {
    conn   *grpc.ClientConn
    client billingv1.TokenServiceClient
}

func NewGRPCClient(addr string) (*GRPCClient, error) {
    conn, err := grpc.Dial(addr,
        grpc.WithTransportCredentials(insecure.NewCredentials()),
        grpc.WithTimeout(5*time.Second),
    )
    if err != nil {
        return nil, err
    }

    return &GRPCClient{
        conn:   conn,
        client: billingv1.NewTokenServiceClient(conn),
    }, nil
}

func (c *GRPCClient) GetBalance(ctx context.Context, userID string) (int32, error) {
    resp, err := c.client.GetBalance(ctx, &billingv1.GetBalanceRequest{
        UserId: userID,
    })
    if err != nil {
        return 0, err
    }
    return resp.Available, nil
}
```

### 4.3 优先迁移路径

| 调用链 | 当前方式 | 优先级 | 预期收益 |
|--------|---------|--------|---------|
| adscenter → billing (token操作) | HTTP | P0 | 延迟 -50%, 吞吐量 +100% |
| offer → billing (扣费) | HTTP | P1 | 延迟 -40% |
| console → all services (查询) | HTTP | P2 | 保持 HTTP (BFF 场景) |

---

## 五、任务4: 完善分布式追踪

### 5.1 当前状态

✅ **已有基础**:
- `pkg/telemetry.SetupTracing()` 函数
- 部分服务已调用 (console)
- OpenTelemetry SDK 已引入

❌ **缺失**:
- 未全面应用到所有服务
- 缺少 HTTP 中间件自动注入 trace
- 缺少跨服务 context 传播
- 未配置 trace 后端 (Jaeger/Cloud Trace)

### 5.2 实施步骤

#### 步骤1: 创建统一的追踪中间件

```go
// pkg/telemetry/middleware.go
package telemetry

import (
    "net/http"
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/propagation"
    "go.opentelemetry.io/otel/trace"
)

func TraceMiddleware(serviceName string) func(http.Handler) http.Handler {
    tracer := otel.Tracer(serviceName)
    propagator := otel.GetTextMapPropagator()

    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // 从请求头提取 trace context
            ctx := propagator.Extract(r.Context(), propagation.HeaderCarrier(r.Header))

            // 启动 span
            ctx, span := tracer.Start(ctx, r.Method+" "+r.URL.Path,
                trace.WithAttributes(
                    attribute.String("http.method", r.Method),
                    attribute.String("http.url", r.URL.String()),
                    attribute.String("http.host", r.Host),
                ),
            )
            defer span.End()

            // 注入 trace context 到响应头
            propagator.Inject(ctx, propagation.HeaderCarrier(w.Header()))

            // 继续处理请求
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

#### 步骤2: 更新所有服务启用追踪

```go
// services/offer/main.go
func main() {
    ctx := context.Background()

    // 初始化追踪
    shutdown := telemetry.SetupTracing("offer")
    defer shutdown(ctx)

    // ... 初始化数据库、缓存等

    r := chi.NewRouter()

    // 添加追踪中间件 (在日志中间件之前)
    r.Use(telemetry.TraceMiddleware("offer"))
    r.Use(middleware.LoggingMiddleware("offer"))
    r.Use(middleware.RequestID())

    // ... 注册路由
}
```

#### 步骤3: HTTP 客户端自动传播 trace

```go
// pkg/http/client.go
func (c *Client) DoJSON(ctx context.Context, method, url string, body, headers any, retries int, out any) error {
    tracer := otel.Tracer("http-client")
    ctx, span := tracer.Start(ctx, method+" "+url,
        trace.WithAttributes(
            attribute.String("http.method", method),
            attribute.String("http.url", url),
        ),
    )
    defer span.End()

    req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
    if err != nil {
        span.RecordError(err)
        return err
    }

    // 注入 trace context 到请求头
    otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(req.Header))

    // ... 执行请求
    resp, err := c.client.Do(req)
    if err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, err.Error())
        return err
    }

    span.SetAttributes(attribute.Int("http.status_code", resp.StatusCode))
    // ... 处理响应
}
```

#### 步骤4: 配置 trace 导出器

```go
// pkg/telemetry/tracing.go
func SetupTracing(serviceName string) func(context.Context) error {
    ctx := context.Background()

    // 配置导出器
    var exporter sdktrace.SpanExporter
    var err error

    exporterType := os.Getenv("OTEL_EXPORTER_TYPE") // "jaeger", "cloud-trace", "stdout"

    switch exporterType {
    case "jaeger":
        exporter, err = jaeger.New(jaeger.WithCollectorEndpoint(
            jaeger.WithEndpoint(os.Getenv("JAEGER_ENDPOINT")),
        ))
    case "cloud-trace":
        exporter, err = cloudtrace.New(
            cloudtrace.WithProjectID(os.Getenv("GOOGLE_CLOUD_PROJECT")),
        )
    case "stdout":
        exporter, err = stdouttrace.New(stdouttrace.WithPrettyPrint())
    default:
        // 默认 no-op
        return func(context.Context) error { return nil }
    }

    if err != nil {
        log.Printf("Failed to create trace exporter: %v", err)
        return func(context.Context) error { return nil }
    }

    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter),
        sdktrace.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceNameKey.String(serviceName),
        )),
    )

    otel.SetTracerProvider(tp)
    otel.SetTextMapPropagator(propagation.TraceContext{})

    return func(ctx context.Context) error {
        return tp.Shutdown(ctx)
    }
}
```

#### 步骤5: 部署配置

```yaml
# Cloud Run 环境变量
env:
  - name: OTEL_EXPORTER_TYPE
    value: "cloud-trace"
  - name: GOOGLE_CLOUD_PROJECT
    value: "gen-lang-client-0944935873"
```

### 5.3 追踪覆盖目标

| 服务 | HTTP 中间件 | HTTP 客户端 | gRPC | Pub/Sub |
|------|------------|------------|------|---------|
| offer | ✅ | ✅ | ✅ | ✅ |
| billing | ✅ | ✅ | ✅ | ✅ |
| adscenter | ✅ | ✅ | ✅ | ✅ |
| siterank | ✅ | ✅ | - | ✅ |
| console | ✅ | ✅ | - | - |
| browser-exec | ✅ | ✅ | - | ✅ |

---

## 六、时间线和里程碑

### 6.1 第1周: 数据库隔离

- [ ] Day 1-2: 创建 `pkg/database` 初始化函数
- [ ] Day 3: 更新所有服务使用新初始化
- [ ] Day 4: 预发环境部署验证
- [ ] Day 5: 生产环境灰度发布

### 6.2 第2周: Console BFF + gRPC 基础

- [ ] Day 1-2: Console 服务客户端层
- [ ] Day 3: Console 聚合端点实现
- [ ] Day 4-5: gRPC proto 定义和代码生成

### 6.3 第3周: gRPC 实现 + 追踪

- [ ] Day 1-2: Billing gRPC 服务端实现
- [ ] Day 3: Adscenter gRPC 客户端迁移
- [ ] Day 4-5: 分布式追踪全面应用

### 6.4 第4周: 测试和优化

- [ ] Day 1-2: 集成测试
- [ ] Day 3: 性能测试和优化
- [ ] Day 4: 文档更新
- [ ] Day 5: 生产环境部署

---

## 七、成功指标

| 指标 | 当前值 | 目标值 | 说明 |
|------|--------|--------|------|
| 数据库连接池利用率 | ~70% | < 50% | Schema 隔离后 |
| gRPC 调用延迟 | N/A (HTTP ~50ms) | < 10ms | 内部服务调用 |
| Trace 覆盖率 | ~20% | 100% | 所有 HTTP/gRPC 调用 |
| Console 响应时间 | N/A | < 500ms | BFF 聚合查询 |

---

## 八、风险和缓解

| 风险 | 等级 | 影响 | 缓解措施 |
|------|------|------|---------|
| Schema 迁移导致服务中断 | 中 | 服务不可用 | 使用视图保证兼容性，灰度部署 |
| gRPC 学习曲线 | 低 | 开发延迟 | 提供示例代码和文档 |
| 追踪性能开销 | 低 | CPU +5% | 使用采样率控制 (10%) |
| Console 服务复杂度 | 中 | 维护成本 | 严格控制聚合逻辑，避免过度设计 |

---

**创建人**: Claude (AI 架构顾问)
**最后更新**: 2025-10-06
