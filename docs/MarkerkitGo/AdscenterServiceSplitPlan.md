# Adscenter 服务拆分行动计划

**创建时间**: 2025-10-06
**状态**: 📋 计划中
**优先级**: P1 (中期规划)
**预计执行时间**: 2-3 周
**风险等级**: 高 (核心业务服务重构)

---

## 一、当前问题分析

### 1.1 违反单一职责原则 (SRP)

**现状**: `services/adscenter/main.go`
- **文件大小**: 262KB (4368 行)
- **函数数量**: 32+ 个顶层函数
- **职责混杂**:
  - OAuth 认证流程
  - 预检（Preflight）逻辑
  - 广告执行（Executor）引擎
  - 限流管理
  - 指标同步
  - 批量操作处理
  - 审计日志
  - 数据库迁移

**引用**：`docs/MarkerkitGo/MicroserviceArchitectureReview.md` 第 2.1 节
> ⚠️ **adscenter 过于庞大** (main.go 261KB)：
> - 包含预检 (preflight)、执行 (executor)、批量操作、限流、OAuth、目标推导等多个子领域
> - 违反 SRP，建议拆分为 3 个独立服务

### 1.2 扩展性受限

**问题**:
- **预检服务**: 计算密集，需要独立扩展（当前与 API 绑定）
- **执行引擎**: I/O 密集（调用 Google Ads API），需要独立扩展
- **API 网关**: 流量密集，扩展需求与其他模块不同

**当前限制**: 所有模块共享同一个 Cloud Run 实例，无法独立扩展

### 1.3 可维护性差

**问题**:
- 单个文件 4368 行，代码导航困难
- 修改预检逻辑可能影响执行引擎（代码耦合）
- 测试困难：单元测试需要模拟整个服务

---

## 二、拆分目标架构

### 2.1 服务拆分设计

```
当前架构:
adscenter (单一服务)
  ├─ OAuth 认证
  ├─ Preflight 预检
  ├─ Executor 执行引擎
  ├─ Bulk Actions 批量操作
  ├─ Metrics 指标同步
  └─ Audit 审计日志

目标架构:
adscenter-api (公共网关)
  ├─ OAuth 认证流程
  ├─ API 路由和认证中间件
  ├─ 限流保护
  └─ 转发请求到 executor/preflight

adscenter-executor (内部服务)
  ├─ Google Ads API 执行引擎
  ├─ 批量操作处理
  ├─ 审计日志写入
  └─ 死信队列处理

adscenter-preflight (预检服务)
  ├─ 账户预检逻辑
  ├─ 落地页可达性检测
  ├─ 预检结果缓存（Redis）
  └─ 轻量级独立部署
```

### 2.2 服务职责边界

| 服务 | 端口 | 职责 | 依赖 | 扩展需求 |
|------|------|------|------|----------|
| **adscenter-api** | 8080 (外部) | OAuth 流程、API 网关、认证 | executor, preflight (HTTP) | 流量驱动 |
| **adscenter-executor** | 8081 (内部) | 广告操作执行、批量操作 | Google Ads API, Database | I/O 密集 |
| **adscenter-preflight** | 8082 (内部) | 账户预检、落地页检测 | Google Ads API, Redis | 计算密集 |

### 2.3 服务间通信

```
前端
  ↓ HTTPS
adscenter-api (认证 + 路由)
  ├─→ adscenter-executor (HTTP, 内部) - 执行操作
  └─→ adscenter-preflight (HTTP, 内部) - 预检账户
```

**通信方式**: 同步 HTTP (内部服务，延迟 < 10ms)

---

## 三、实施方案

### 3.1 Phase 1: 代码模块化重构 (第 1 周)

**目标**: 在现有代码库中拆分逻辑模块，不改变部署方式

#### 步骤1: 创建服务目录结构

```bash
services/adscenter/
  ├─ cmd/
  │   ├─ api/main.go           # API 网关入口
  │   ├─ executor/main.go      # 执行引擎入口
  │   └─ preflight/main.go     # 预检服务入口
  ├─ internal/
  │   ├─ api/                  # API 网关逻辑
  │   │   ├─ oauth.go
  │   │   ├─ routes.go
  │   │   └─ middleware.go
  │   ├─ executor/             # (已存在) 执行引擎
  │   ├─ preflight/            # (已存在) 预检逻辑
  │   ├─ shared/               # 共享代码
  │   │   ├─ config.go
  │   │   ├─ billing.go
  │   │   └─ cache.go
  │   └─ ...
  └─ main.go                   # (保留，用于向后兼容)
```

#### 步骤2: 提取 OAuth 逻辑到 internal/api

从 `main.go` 提取以下函数到 `internal/api/oauth.go`:
- `signState()`
- `verifyState()`
- `chooseRedirectURL()`
- OAuth 回调处理逻辑

#### 步骤3: 提取共享逻辑到 internal/shared

- `billingActionAdscenter()` → `internal/shared/billing.go`
- `cacheGet()`, `cacheSet()` → `internal/shared/cache.go`
- `writeAudit()` → `internal/shared/audit.go`

#### 步骤4: 创建独立入口点

`services/adscenter/cmd/api/main.go`:
```go
package main

import (
    "github.com/xxrenzhe/autoads/services/adscenter/internal/api"
    "github.com/xxrenzhe/autoads/services/adscenter/internal/shared"
)

func main() {
    cfg := shared.LoadConfig()
    server := api.NewServer(cfg)
    server.Start(":8080")
}
```

**验证**: 本地运行 `go run services/adscenter/cmd/api/main.go`

### 3.2 Phase 2: 独立进程部署 (第 2 周)

**目标**: 3 个服务独立部署，共享代码库

#### 步骤1: 创建独立 Dockerfile

`services/adscenter/Dockerfile.api`:
```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /adscenter-api ./services/adscenter/cmd/api

FROM alpine:latest
RUN apk --no-cache add ca-certificates
COPY --from=builder /adscenter-api /adscenter-api
EXPOSE 8080
CMD ["/adscenter-api"]
```

类似的 `Dockerfile.executor` 和 `Dockerfile.preflight`

#### 步骤2: 创建 Cloud Run 部署配置

`deployments/adscenter/api-preview.yaml`:
```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: adscenter-api-preview
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: '20'
        autoscaling.knative.dev/minScale: '1'
    spec:
      containers:
      - image: asia-northeast1-docker.pkg.dev/.../adscenter-api:preview-latest
        ports:
        - containerPort: 8080
        env:
        - name: EXECUTOR_URL
          value: "https://adscenter-executor-preview-xxxx.a.run.app"
        - name: PREFLIGHT_URL
          value: "https://adscenter-preflight-preview-xxxx.a.run.app"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: DATABASE_URL
              key: latest
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: REDIS_URL
              key: latest
```

#### 步骤3: 部署到预发环境

```bash
# 构建镜像
docker build -f services/adscenter/Dockerfile.api \
  -t asia-northeast1-docker.pkg.dev/.../adscenter-api:preview-latest .

# 部署到 Cloud Run
gcloud run services replace deployments/adscenter/api-preview.yaml \
  --region=asia-northeast1
```

重复 executor 和 preflight

#### 步骤4: 配置内部服务 Ingress

```bash
# executor 和 preflight 仅允许内部调用
gcloud run services update adscenter-executor-preview \
  --region=asia-northeast1 \
  --ingress=internal

gcloud run services update adscenter-preflight-preview \
  --region=asia-northeast1 \
  --ingress=internal
```

### 3.3 Phase 3: 完全独立服务 (第 3 周)

**目标**: 服务间通过 gRPC/Pub/Sub 通信，代码完全解耦

#### 选项1: gRPC 通信 (推荐)

**优势**:
- 类型安全
- 高性能（二进制协议）
- 内置负载均衡

**实现**:
1. 定义 `adscenter.proto`:
```protobuf
service AdscenterExecutor {
  rpc ExecuteAction(ExecuteRequest) returns (ExecuteResponse);
  rpc BulkActions(BulkRequest) returns (BulkResponse);
}

service AdscenterPreflight {
  rpc RunPreflight(PreflightRequest) returns (PreflightResponse);
}
```

2. 生成代码: `protoc --go_out=. --go-grpc_out=. adscenter.proto`

3. 更新 adscenter-api 调用方式:
```go
// HTTP → gRPC
conn, _ := grpc.Dial("adscenter-executor:8081", grpc.WithInsecure())
client := pb.NewAdscenterExecutorClient(conn)
resp, _ := client.ExecuteAction(ctx, &pb.ExecuteRequest{...})
```

#### 选项2: Pub/Sub 通信 (异步)

**使用场景**: 批量操作、审计日志等非关键路径

**实现**:
```go
// adscenter-api 发布事件
publisher.Publish(ctx, "adscenter-bulk-actions", Event{
    Type: "BulkActionRequested",
    Data: bulkRequest,
})

// adscenter-executor 订阅事件
subscriber.Subscribe(ctx, "adscenter-bulk-actions", handleBulkAction)
```

---

## 四、数据分离策略

### 4.1 数据库表分配

根据 Schema 级隔离迁移：

```
adscenter_db (schema):
  ├─ UserAdsConnection (所有服务共享，只读)
  ├─ BulkAudit (executor 写入，api 读取)
  ├─ MccLink (api 管理)
  └─ AuditEvents (executor 写入)
```

**共享策略**: 所有服务连接 `adscenter_db` schema，设置 `search_path=adscenter_db,public`

### 4.2 缓存分离

| 服务 | 缓存用途 | Redis Key 前缀 |
|------|---------|---------------|
| adscenter-api | OAuth state | `ac:oauth:*` |
| adscenter-preflight | 预检结果 | `ac:preflight:*` |
| adscenter-executor | 执行限流 | `ac:exec:*` |

---

## 五、迁移步骤

### 5.1 前置条件

- [x] Schema 级隔离迁移完成 (adscenter_db 已创建)
- [ ] 所有服务配置 REDIS_URL (已完成)
- [ ] 内部模块化重构完成 (Phase 1)

### 5.2 灰度发布计划

| 阶段 | 流量分配 | 验证指标 | 回滚条件 |
|------|---------|---------|---------|
| **阶段1** (第1天) | 5% 新架构 | 错误率 < 1%, P95延迟 < 2s | 错误率 > 5% |
| **阶段2** (第3天) | 25% 新架构 | 同上 + 吞吐量无下降 | 延迟 > 3s |
| **阶段3** (第7天) | 50% 新架构 | 同上 | - |
| **阶段4** (第14天) | 100% 新架构 | 连续7天稳定 | - |

### 5.3 回滚方案

**紧急回滚** (< 5 分钟):
```bash
# 切换 API Gateway 路由到旧版 adscenter
gcloud run services update-traffic adscenter \
  --region=asia-northeast1 \
  --to-revisions=adscenter-00xxx=100
```

**完全回滚** (< 30 分钟):
1. 删除新服务
2. 恢复旧版 adscenter 部署
3. 清理 Redis 缓存

---

## 六、风险评估

| 风险 | 等级 | 影响 | 缓解措施 |
|------|------|------|---------|
| **服务间调用失败** | 高 | OAuth 流程中断 | 添加断路器，降级到本地逻辑 |
| **数据库连接池耗尽** | 中 | 3个服务共享连接池 | 每个服务独立连接池配置 |
| **缓存不一致** | 中 | 预检结果过期 | 统一 TTL，添加版本号 |
| **部署复杂度增加** | 低 | CI/CD 需要构建3个镜像 | 统一 Dockerfile，参数化构建 |

---

## 七、监控指标

### 7.1 拆分前后对比

| 指标 | 拆分前 | 拆分后目标 |
|------|--------|-----------|
| 单个服务代码量 | 262KB | < 80KB |
| 服务启动时间 | ~3s | < 1s (轻量级服务) |
| 预检 P95 延迟 | ~2s | < 1s (独立优化) |
| 执行 P95 延迟 | ~1.5s | < 1s |
| 内存使用 | ~512MB | 256MB/服务 |

### 7.2 新增监控告警

```yaml
# 服务间调用失败告警
- name: "Adscenter Internal Call Failure"
  condition: adscenter-api → executor/preflight 失败率 > 5%
  duration: 60s
  notification: ops@autoads.com

# 服务启动失败告警
- name: "Adscenter Service Unhealthy"
  condition: /healthz 返回非 200
  duration: 60s
```

---

## 八、成功标准

- [ ] ✅ 所有服务独立部署成功
- [ ] ✅ OAuth 流程端到端测试通过
- [ ] ✅ 预检和执行功能正常
- [ ] ✅ 错误率 < 1% (7天)
- [ ] ✅ P95 延迟无显著增加
- [ ] ✅ 代码量减少 > 50%
- [ ] ✅ 文档更新完成

---

## 九、时间线

| 周次 | 任务 | 交付物 |
|------|------|--------|
| **第1周** | Phase 1: 代码模块化 | 3个独立入口点，可本地运行 |
| **第2周** | Phase 2: 独立部署 | 3个 Cloud Run 服务，预发环境 |
| **第3周** | Phase 3: gRPC/测试 | 完整集成测试，灰度发布 |
| **第4周** | 监控优化 | 生产环境全量，文档更新 |

**总计**: 4 周 (1 个月)

---

## 十、参考资料

- **架构审查**: `docs/MarkerkitGo/MicroserviceArchitectureReview.md` 第 2.1 节
- **微服务设计**: `docs/MarkerkitGo/MicroServiceDesign.md`
- **现有模块**: `services/adscenter/internal/`
- **gRPC 示例**: https://grpc.io/docs/languages/go/quickstart/

---

**执行人**: TBD
**批准人**: TBD
**风险评估**: 高 (核心业务服务重构)
**建议**: 先在预发环境完整验证后再上生产

🤖 Generated with [Claude Code](https://claude.com/claude-code)
