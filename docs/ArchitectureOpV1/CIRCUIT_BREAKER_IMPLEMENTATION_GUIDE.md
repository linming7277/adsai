# Circuit Breaker Implementation Guide
# 断路器实现指南

## 概述

本文档描述了autoads项目中断路器模式的标准化实现和最佳实践。断路器模式用于提高系统的容错性，防止级联故障。

## 架构设计

### 核心组件

1. **pkg/circuitbreaker** - 核心断路器实现
2. **pkg/serviceclient** - 带断路器的服务客户端
3. **pkg/httpclient** - 带断路器的HTTP客户端

### 断路器状态

- **Closed (0)**: 正常状态，请求正常通过
- **Half-Open (1)**: 半开状态，允许少量请求测试服务是否恢复
- **Open (2)**: 打开状态，所有请求快速失败

## 使用方式

### 方式1: 使用serviceclient (推荐)

```go
import "github.com/xxrenzhe/autoads/pkg/serviceclient"

// 创建registry (内置断路器)
registry := serviceclient.NewRegistry()

// 调用其他服务 (自动断路器保护)
var result SomeStruct
err := registry.CallJSON(ctx, "service-name", serviceclient.Request{
    Method: "POST",
    Path:   "/api/v1/endpoint",
    Body:   requestData,
}, &result)
```

### 方式2: 使用BreakerClient

```go
import "github.com/xxrenzhe/autoads/pkg/circuitbreaker"
import httpx "github.com/xxrenzhe/autoads/pkg/http"

// 创建带断路器的HTTP客户端
breakerCfg := circuitbreaker.DefaultConfig("my-service")
breaker := circuitbreaker.NewMetricsBreaker(breakerCfg, "autoads", "my-service")
httpClient := httpx.New(10 * time.Second)

// 使用断路器执行请求
_, err := breaker.Execute(func() (any, error) {
    err := httpClient.DoJSON(ctx, "GET", url, nil, nil, 2, &result)
    if err != nil {
        return nil, err
    }
    return result, nil
})
```

## 配置参数

### 默认配置 (pkg/circuitbreaker/breaker.go:98)

```go
Config{
    Name:        "service-name",
    MaxRequests: 3,                    // 半开状态最大请求数
    Interval:    60 * time.Second,      // 闭合状态重置间隔
    Timeout:     30 * time.Second,      // 打开状态持续时间
    ReadyToTrip: func(counts Counts) bool {
        // 5个请求且失败率>=50%时触发断路器打开
        failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
        return counts.Requests >= 5 && failureRatio >= 0.5
    },
}
```

### 服务特定配置 (pkg/serviceclient/registry.go)

```go
// Billing service - 快速响应，低容错
CircuitBreaker: DefaultCircuitBreakerConfig(),
Timeout: 5 * time.Second,
MaxRetries: 2,

// Siterank service - 慢响应，分析服务
Timeout: 30 * time.Second,
MaxRetries: 1,

// Browser-exec service - 很慢，浏览器操作
Timeout: 35 * time.Second,
MaxRetries: 1,
```

## 监控指标

### Prometheus指标

```promql
# 断路器状态 (0=Closed, 1=Half-Open, 2=Open)
autoads_{service}_circuit_breaker_state{breaker="target-service"}

# 请求总数
autoads_{service}_circuit_breaker_requests_total{result="success|failure"}

# 成功/失败计数
autoads_{service}_circuit_breaker_successes_total
autoads_{service}_circuit_breaker_failures_total{type="consecutive"}
```

### 告警规则 (monitoring/prometheus/alerts/circuit-breaker-alerts.yaml)

- **CircuitBreakerOpen**: 断路器打开 (critical)
- **CircuitBreakerHalfOpen**: 断路器半开 (warning)
- **CircuitBreakerHighFailureRate**: 失败率>30% (warning)
- **CircuitBreakerConsecutiveFailures**: 连续失败>5次 (warning)
- **CircuitBreakerFlapping**: 状态频繁切换 (info)

## 当前实现状态

### ✅ 已实现断路器的服务

| Service | 实现方式 | 保护目标 | 备注 |
|---------|----------|----------|------|
| **adscenter** | BreakerClient | 外部HTTP调用 | services/adscenter/internal/clients/breaker_client.go |
| **offer** | BreakerClient | 外部HTTP调用 | services/offer/internal/clients/breaker_client.go |
| **bff** | serviceclient | billing, siterank | internal/handlers/dashboard.go |
| **gateway-middleware** | serviceclient | billing | internal/clients/billing.go |
| **siterank** | serviceclient | browser-exec | internal/browserexec/client.go |
| **batchopen** | serviceclient | 多个下游服务 | main.go |
| **console** | serviceclient | billing, adscenter, siterank, offer | internal/handlers/http.go |

### ❌ 不需要断路器的服务

| Service | 原因 |
|---------|------|
| **billing** | 纯数据库操作，无外部HTTP调用 |
| **notifications** | 纯API服务，无外部调用 |
| **browser-exec** | Node.js服务，使用Playwright |
| **proxy-pool** | 内部工具服务 |
| **projector** | 事件处理服务 |
| **recommendations** | 算法服务 |
| **functions** | Cloud Functions |

## 最佳实践

### 1. 服务调用优先级

```
优先级1: serviceclient (推荐)
├── 内置断路器
├── 自动重试
├── 服务发现
└── 监控集成

优先级2: BreakerClient
├── 自定义断路器配置
├── Prometheus指标
└── 适合特殊场景

优先级3: 直接HTTP客户端 (不推荐)
└── 需要手动实现断路器
```

### 2. 配置调优

```go
// 快速服务 (数据库、缓存)
fastServiceConfig := circuitbreaker.Config{
    Timeout:  5 * time.Second,
    Interval: 30 * time.Second,
    ReadyToTrip: func(counts Counts) bool {
        return counts.Requests >= 3 &&
               float64(counts.TotalFailures) / float64(counts.Requests) >= 0.6
    },
}

// 慢速服务 (浏览器、AI分析)
slowServiceConfig := circuitbreaker.Config{
    Timeout:  60 * time.Second,
    Interval: 120 * time.Second,
    ReadyToTrip: func(counts Counts) bool {
        return counts.Requests >= 5 &&
               float64(counts.TotalFailures) / float64(counts.Requests) >= 0.4
    },
}
```

### 3. 降级策略

```go
func (c *Client) GetDataWithFallback(ctx context.Context, req Request) (Data, error) {
    var data Data

    // 尝试调用远程服务
    _, err := c.breaker.Execute(func() (any, error) {
        err := c.registry.CallJSON(ctx, "remote-service", request, &data)
        if err != nil {
            return nil, err
        }
        return data, nil
    })

    if err != nil {
        // 降级处理
        log.Warn("Remote service failed, using fallback", "error", err)
        return c.getFallbackData(ctx, req)
    }

    return data, nil
}
```

### 4. 测试策略

```go
func TestCircuitBreakerBehavior(t *testing.T) {
    // 1. 测试正常状态
    assert.Equal(t, gobreaker.Closed, breaker.State())

    // 2. 模拟失败触发断路器打开
    for i := 0; i < 6; i++ {
        _, err := breaker.Execute(failingFunction)
        assert.Error(t, err)
    }
    assert.Equal(t, gobreaker.Open, breaker.State())

    // 3. 测试快速失败
    _, err := breaker.Execute(failingFunction)
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "circuit breaker is open")

    // 4. 等待超时后测试半开状态
    time.Sleep(breakerTimeout + time.Second)
    assert.Equal(t, gobreaker.HalfOpen, breaker.State())
}
```

## 故障排查

### 1. 检查断路器状态

```bash
# 查看所有断路器状态
curl -s "http://prometheus:9090/api/v1/query?query=autoads_.*_circuit_breaker_state"

# 查看特定服务的断路器
curl -s "http://prometheus:9090/api/v1/query?query=autoads_offer_circuit_breaker_state"
```

### 2. 检查失败率

```bash
# 查看失败率
curl -s "http://prometheus:9090/api/v1/query?query=rate(autoads_.*_circuit_breaker_requests_total{result=\"failure\"}[5m]) / rate(autoads_.*_circuit_breaker_requests_total[5m])"
```

### 3. 查看告警

```bash
# 查看当前告警
curl -s "http://alertmanager:9093/api/v1/alerts"
```

## 性能考虑

1. **内存开销**: 每个断路器实例约占用1KB内存
2. **CPU开销**: 断路器检查操作非常轻量 (< 1μs)
3. **网络开销**: 断路器打开时避免无效网络调用
4. **监控开销**: Prometheus指标更新约10μs

## 总结

autoads项目的断路器实现已经相当完善：
- ✅ 核心框架已实现 (pkg/circuitbreaker)
- ✅ 主要服务已集成 (7个Go服务)
- ✅ 监控告警已配置 (5个告警规则)
- ✅ 最佳实践已建立 (serviceclient优先)

后续重点是：
1. 持续监控断路器状态
2. 根据实际情况调优参数
3. 完善降级策略
4. 加强故障恢复能力