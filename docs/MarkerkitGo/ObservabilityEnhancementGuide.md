# 可观测性增强指南 (P1 任务)

**创建日期**: 2025-10-07
**优先级**: P1
**工作量**: 2-3 天
**目标**: 提升故障排查效率 50%+

---

## 一、当前状态 vs 目标

### 1.1 现状

✅ **已有**:
- Prometheus metrics (`pkg/telemetry`)
- 基础日志记录 (`pkg/logger`)
- 健康检查端点 (/healthz, /readyz)
- OpenTelemetry 分布式追踪（已集成但未启用）

❌ **缺失**:
- Pub/Sub 订阅延迟监控
- 错误日志聚合 (Cloud Error Reporting)
- 生产环境分布式追踪未启用
- 服务间调用链可视化

### 1.2 目标

- ✅ Pub/Sub 订阅延迟 < 5秒，超过触发告警
- ✅ 所有错误自动上报到 Cloud Error Reporting
- ✅ Preview 环境启用分布式追踪（10% 采样）
- ✅ 生产环境启用分布式追踪（0.1% 采样）

---

## 二、任务 1: Pub/Sub 订阅延迟监控

### 2.1 问题分析

**风险**:
- projector/notifications 是唯一订阅者
- 如果服务崩溃或处理缓慢，事件堆积
- 无告警，发现问题可能已延迟数小时

**关键指标**:
```
subscription/oldest_unacked_message_age - 最老未确认消息年龄
subscription/num_unacked_messages      - 未确认消息数量
subscription/num_retained_acked_messages - 已确认但保留的消息
```

### 2.2 实施步骤

#### Step 1: 创建 Cloud Monitoring 告警策略

```bash
# 脚本: scripts/monitoring/create-pubsub-alerts.sh
#!/bin/bash

PROJECT_ID="gen-lang-client-0944935873"
NOTIFICATION_CHANNEL_ID="your-slack-channel-id"  # 需要先创建

# 告警1: Pub/Sub 消息积压超过 100 条
gcloud alpha monitoring policies create \
  --notification-channels="$NOTIFICATION_CHANNEL_ID" \
  --display-name="Pub/Sub Message Backlog > 100" \
  --condition-display-name="Unacked messages > 100" \
  --condition-threshold-value=100 \
  --condition-threshold-duration=300s \
  --condition-filter='
    resource.type="pubsub_subscription"
    AND metric.type="pubsub.googleapis.com/subscription/num_unacked_messages"
  ' \
  --project="$PROJECT_ID"

# 告警2: Pub/Sub 消息延迟超过 60 秒
gcloud alpha monitoring policies create \
  --notification-channels="$NOTIFICATION_CHANNEL_ID" \
  --display-name="Pub/Sub Message Age > 60s" \
  --condition-display-name="Oldest unacked message > 60s" \
  --condition-threshold-value=60 \
  --condition-threshold-duration=120s \
  --condition-filter='
    resource.type="pubsub_subscription"
    AND metric.type="pubsub.googleapis.com/subscription/oldest_unacked_message_age"
  ' \
  --project="$PROJECT_ID"

# 告警3: Pub/Sub 订阅错误率 > 1%
gcloud alpha monitoring policies create \
  --notification-channels="$NOTIFICATION_CHANNEL_ID" \
  --display-name="Pub/Sub Error Rate > 1%" \
  --condition-display-name="Pull error rate > 1%" \
  --condition-threshold-value=0.01 \
  --condition-threshold-duration=300s \
  --condition-filter='
    resource.type="pubsub_subscription"
    AND metric.type="pubsub.googleapis.com/subscription/pull_message_operation_count"
    AND metric.label.result="error"
  ' \
  --project="$PROJECT_ID"

echo "✅ Pub/Sub 告警策略创建完成"
echo "请在 Cloud Console 配置通知渠道: https://console.cloud.google.com/monitoring/alerting/notifications"
```

#### Step 2: 添加 Pub/Sub 订阅 metrics 到服务

```go
// pkg/events/metrics.go (新建或扩展)
package events

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    pubsubMessagesProcessed = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "pubsub_messages_processed_total",
            Help: "Total number of Pub/Sub messages processed",
        },
        []string{"subscription", "status"}, // status: "success", "error", "retry"
    )

    pubsubProcessingDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "pubsub_message_processing_duration_seconds",
            Help:    "Duration of Pub/Sub message processing",
            Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30},
        },
        []string{"subscription", "event_type"},
    )

    pubsubMessageAge = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "pubsub_message_age_seconds",
            Help:    "Age of Pub/Sub messages when processed",
            Buckets: []float64{1, 5, 10, 30, 60, 300, 600},
        },
        []string{"subscription"},
    )
)

func RecordMessageProcessed(subscription, status string) {
    pubsubMessagesProcessed.WithLabelValues(subscription, status).Inc()
}

func RecordProcessingDuration(subscription, eventType string, duration float64) {
    pubsubProcessingDuration.WithLabelValues(subscription, eventType).Observe(duration)
}

func RecordMessageAge(subscription string, ageSeconds float64) {
    pubsubMessageAge.WithLabelValues(subscription).Observe(ageSeconds)
}
```

#### Step 3: 在 projector/notifications 中集成 metrics

```go
// services/projector/main.go
import (
    "time"
    ev "github.com/xxrenzhe/autoads/pkg/events"
)

func (p *Projector) pushHandler(w http.ResponseWriter, r *http.Request) {
    start := time.Now()

    // ...existing parsing logic...

    // 记录消息年龄
    if env.Timestamp != "" {
        if msgTime, err := time.Parse(time.RFC3339, env.Timestamp); err == nil {
            ageSeconds := time.Since(msgTime).Seconds()
            ev.RecordMessageAge("projector-subscription", ageSeconds)
        }
    }

    // 处理事件
    err := p.processEvent(r.Context(), &env)

    // 记录处理结果
    status := "success"
    if err != nil {
        status = "error"
        ev.RecordMessageProcessed("projector-subscription", status)
        apperr.Write(w, r, http.StatusInternalServerError, "PROCESSING_ERROR", "Event processing failed", nil)
        return
    }

    ev.RecordMessageProcessed("projector-subscription", status)
    ev.RecordProcessingDuration("projector-subscription", env.Type, time.Since(start).Seconds())
    w.WriteHeader(http.StatusOK)
}
```

---

## 三、任务 2: Cloud Error Reporting 集成

### 3.1 为什么需要

**当前问题**:
- 错误日志分散在各服务
- 排查故障需要手动查询 Cloud Logging
- 无法快速识别高频错误
- 无错误分组和去重

**Cloud Error Reporting 优势**:
- 自动错误分组
- 错误趋势和频率统计
- 邮件/Slack 通知
- 堆栈跟踪可视化

### 3.2 实施步骤

#### Step 1: 添加 Cloud Error Reporting 客户端

```go
// pkg/errorreporting/client.go (已存在，确认是否完善)
package errorreporting

import (
    "context"
    "fmt"
    "os"

    "cloud.google.com/go/errorreporting"
    "github.com/rs/zerolog/log"
)

var globalClient *errorreporting.Client

// Init initializes the global Error Reporting client
func Init(ctx context.Context, projectID, serviceName, serviceVersion string) error {
    client, err := errorreporting.NewClient(ctx, projectID, errorreporting.Config{
        ServiceName:    serviceName,
        ServiceVersion: serviceVersion,
        OnError: func(err error) {
            log.Error().Err(err).Msg("Failed to report error to Cloud Error Reporting")
        },
    })
    if err != nil {
        return fmt.Errorf("failed to create error reporting client: %w", err)
    }

    globalClient = client
    return nil
}

// Report reports an error to Cloud Error Reporting
func Report(err error) {
    if globalClient != nil {
        globalClient.Report(errorreporting.Entry{
            Error: err,
        })
    }
}

// ReportWithContext reports an error with additional context
func ReportWithContext(ctx context.Context, err error, user, req string) {
    if globalClient != nil {
        globalClient.Report(errorreporting.Entry{
            Error: err,
            User:  user,
            Req:   []byte(req),
        })
    }
}

// Close closes the Error Reporting client
func Close() error {
    if globalClient != nil {
        return globalClient.Close()
    }
    return nil
}
```

#### Step 2: 在服务启动时初始化

```go
// services/offer/main.go
import (
    "github.com/xxrenzhe/autoads/pkg/errorreporting"
)

func main() {
    ctx := context.Background()

    // Initialize Error Reporting
    projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
    if projectID == "" {
        projectID = "gen-lang-client-0944935873"
    }
    if err := errorreporting.Init(ctx, projectID, "offer", "v1.0.0"); err != nil {
        log.Warn().Err(err).Msg("Failed to initialize Error Reporting, continuing without it")
    }
    defer errorreporting.Close()

    // ...rest of main()...
}
```

#### Step 3: 在错误处理中集成

```go
// services/offer/internal/handlers/http.go
import (
    "github.com/xxrenzhe/autoads/pkg/errorreporting"
)

func (h *Handler) CreateOffer(w http.ResponseWriter, r *http.Request) {
    // ...logic...

    offer, err := h.offerService.Create(r.Context(), req)
    if err != nil {
        // 记录到 Error Reporting
        errorreporting.ReportWithContext(
            r.Context(),
            err,
            req.UserID,
            fmt.Sprintf("POST /api/v1/offers - UserID: %s", req.UserID),
        )

        errors.Write(w, r, http.StatusInternalServerError, "CREATE_FAILED", "Failed to create offer", nil)
        return
    }

    writeJSON(w, http.StatusCreated, offer)
}
```

#### Step 4: 全局错误拦截中间件

```go
// pkg/middleware/error_reporting.go (新建)
package middleware

import (
    "fmt"
    "net/http"
    "runtime/debug"

    "github.com/xxrenzhe/autoads/pkg/errorreporting"
)

// RecoverMiddleware recovers from panics and reports to Error Reporting
func RecoverMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if err := recover(); err != nil {
                stack := debug.Stack()

                // Report panic to Error Reporting
                panicErr := fmt.Errorf("panic: %v\n%s", err, stack)
                errorreporting.ReportWithContext(
                    r.Context(),
                    panicErr,
                    r.Header.Get("X-User-ID"),
                    fmt.Sprintf("%s %s", r.Method, r.URL.Path),
                )

                // Return 500 error
                w.WriteHeader(http.StatusInternalServerError)
                w.Write([]byte("Internal Server Error"))
            }
        }()

        next.ServeHTTP(w, r)
    })
}
```

应用到所有服务:

```go
// services/*/main.go
r.Use(middleware.RecoverMiddleware)
```

---

## 四、任务 3: 启用分布式追踪

### 4.1 执行脚本

已准备就绪: `scripts/enable-distributed-tracing.sh`

```bash
# Preview 环境（10% 采样）
./scripts/enable-distributed-tracing.sh preview

# 验证
gcloud run services describe offer-preview --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env)" | grep TRACES_ENABLED
```

### 4.2 配置 OpenTelemetry Collector（可选）

如果需要自定义后端（非 Cloud Trace）:

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 10s

exporters:
  googlecloud:
    project: gen-lang-client-0944935873
  jaeger:
    endpoint: jaeger:14250

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [googlecloud, jaeger]
```

部署到 Cloud Run:

```bash
gcloud run deploy otel-collector \
  --image=otel/opentelemetry-collector-contrib:latest \
  --region=asia-northeast1 \
  --allow-unauthenticated \
  --port=4318 \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=gen-lang-client-0944935873"
```

---

## 五、任务 4: adscenter 安全性加固

### 5.1 限制 looseAuth 仅在 staging 环境

```go
// services/adscenter/main.go
func main() {
    // ...existing code...

    // 🔒 安全加固: looseAuth 仅在 staging 环境启用
    environment := os.Getenv("ENVIRONMENT") // "staging", "preview", "production"
    if environment == "production" || environment == "preview" {
        if os.Getenv("ADSCENTER_AUTH_BULK_FALLBACK") != "" {
            log.Fatal().Msg("SECURITY: ADSCENTER_AUTH_BULK_FALLBACK is not allowed in production/preview")
        }
    }

    // ...rest of main()...
}
```

### 5.2 Secret Manager TTL 配置

```go
// pkg/config/secret.go
package config

import (
    "context"
    "sync"
    "time"

    secretmanager "cloud.google.com/go/secretmanager/apiv1"
    "cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
)

type CachedSecret struct {
    value      string
    expiresAt  time.Time
    mu         sync.RWMutex
}

var secretCache = make(map[string]*CachedSecret)

func GetSecretWithTTL(ctx context.Context, secretName string, ttl time.Duration) (string, error) {
    // Check cache
    if cached, ok := secretCache[secretName]; ok {
        cached.mu.RLock()
        if time.Now().Before(cached.expiresAt) {
            value := cached.value
            cached.mu.RUnlock()
            return value, nil
        }
        cached.mu.RUnlock()
    }

    // Fetch from Secret Manager
    client, err := secretmanager.NewClient(ctx)
    if err != nil {
        return "", err
    }
    defer client.Close()

    req := &secretmanagerpb.AccessSecretVersionRequest{Name: secretName}
    result, err := client.AccessSecretVersion(ctx, req)
    if err != nil {
        return "", err
    }

    value := string(result.Payload.Data)

    // Update cache
    cached := &CachedSecret{
        value:     value,
        expiresAt: time.Now().Add(ttl),
    }
    secretCache[secretName] = cached

    return value, nil
}
```

使用示例:

```go
// 15 分钟 TTL (而非永久缓存)
databaseURL, err := config.GetSecretWithTTL(ctx, "DATABASE_URL", 15*time.Minute)
```

---

## 六、实施清单

### P1.1: Pub/Sub 订阅延迟监控 (0.5 天)
- [ ] 创建 Cloud Monitoring 告警策略
- [ ] 添加 Pub/Sub metrics 到 projector/notifications
- [ ] 配置 Slack 通知渠道

### P1.2: Cloud Error Reporting 集成 (1 天)
- [ ] 确认 pkg/errorreporting 实现完善
- [ ] 所有服务启动时初始化 Error Reporting
- [ ] 关键错误处理添加 Report 调用
- [ ] 添加全局 RecoverMiddleware

### P1.3: 启用分布式追踪 (0.5 天)
- [ ] 执行 `./scripts/enable-distributed-tracing.sh preview`
- [ ] 验证 Cloud Trace 数据
- [ ] (可选) 部署 OpenTelemetry Collector

### P1.4: adscenter 安全性加固 (0.5 天)
- [ ] 限制 looseAuth 环境检查
- [ ] Secret Manager TTL 配置
- [ ] 测试和验证

**总工作量**: 2-3 天
**预期完成**: 2025-10-10

---

**编写人**: Claude (AI 架构顾问)
**创建日期**: 2025-10-07
**实施优先级**: P1
