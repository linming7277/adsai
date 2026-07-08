# 三层用户数据架构验证中间件

## 概述

三层用户数据架构验证中间件是AdsAI项目中确保数据一致性的关键组件，用于验证用户在三个数据层中的完整性和一致性：

- **Layer 1**: Supabase auth.users (认证层)
- **Layer 2**: Cloud SQL user.users (业务用户层)
- **Layer 3**: Cloud SQL billing.accounts (计费层)

## 功能特性

### 1. 实时验证
- 对每个用户请求验证三层架构状态
- 检测数据缺失、不一致和完整性问题
- 支持严格模式和宽松模式

### 2. 自动修复
- 智能检测缺失的业务数据
- 自动创建缺失的user.users记录
- 自动创建缺失的billing.accounts记录
- 支持邮箱不一致的自动修正

### 3. 性能优化
- 使用数据库连接池优化查询性能
- 支持结果缓存（TTL可配置）
- 并行验证和检查

### 4. 监控和指标
- 详细的验证日志记录
- 性能指标收集
- 支持Prometheus格式的监控输出

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    Three-Layer Validation Middleware     │
├─────────────────────────────────────────────────────────────────┤
│  HTTP Request                                        │
│  ┌─────────��─────┐                                      │
│  │ JWT Extractor │                                      │
│  │ (Supabase)     │                                      │
│  └───────────────┘                                      │
│           ↓                                             │
│  ┌──────────────────────────────────────┐            │
│  │    Three-Layer Validator                │            │
│  │  - Layer 1 Check (JWT)              │            │
│  │  - Layer 2 Check (user.users)       │            │
│  │  - Layer 3 Check (billing.accounts)   │            │
│  │  - Consistency Validation              │            │
│  └──────────────────────────────────────┘            │
│           ↓                                             │
│  ┌─────────────────┐        ┌───────────────────────┐  │
│  │ Decision Engine │        │  Auto-Heal Service    │  │
│  │ (Pass/Block)    │        │ (Repair Missing Data)│  │
│  └─────────────────┘        └───────────────────────┘  │
│           ↓                                             │
│    Next Middleware Handler                               │
└─────────────────────────────────────────────────────────┘
```

## 使用方法

### 1. 基础配置

```go
package main

import (
    "github.com/linming7277/adsai/pkg/middleware"
    "github.com/linming7277/adsai/pkg/database"
)

func main() {
    // 创建数据库适配器
    adapter, err := database.GetFinalAdapterForService("your-service")
    if err != nil {
        log.Fatal(err)
    }
    defer adapter.Close()

    // 配置验证参数
    config := middleware.DefaultValidationConfig()
    config.StrictMode = true                    // 严格模式
    config.Timeout = 5 * time.Second            // 验证超时
    config.CriticalPaths = []string{            // 强制验证的路径
        "/api/v1/billing/subscriptions",
        "/api/v1/billing/tokens/consume",
        "/api/v1/user/profile",
    }

    // 创建验证中间件
    validator := middleware.NewThreeLayerUserValidator(adapter, config)
    validationMiddleware := validator.Middleware(config)

    // 应用到HTTP路由
    router := chi.NewRouter()
    router.Use(middleware.RequestID())
    router.Use(validationMiddleware)  // 应用三层验证
    router.Use(authMiddleware)             // 然后应用认证
    router.Use(loggingMiddleware)

    // 注册路由
    router.Handle("/api/v1/your-endpoint", yourHandler)

    log.Println("三层验证中间件已启用")
    http.ListenAndServe(":8080", router)
}
```

### 2. 集成自动修复

```go
// 启用自动修复功能
integrationConfig := middleware.IntegrationConfig{
    ServiceName:      "your-service",
    ValidationConfig: config,
    AutoHealMissing: true,                    // 启用自动修复
    HealTimeout:     10 * time.Second,          // 修复超时
    EnableMetrics:    true,                        // 启用指标收集
}

threeLayerIntegration, err := middleware.NewThreeLayerIntegration(
    "your-service",
    integrationConfig,
)
defer threeLayerIntegration.Close()

// 使用带自动修复的中间件
autoHealMiddleware := threeLayerIntegration.GetMiddlewareWithAutoHeal(config)

router := chi.NewRouter()
router.Use(autoHealMiddleware)
```

### 3. 在处理程序中获取验证结果

```go
func yourHandler(w http.ResponseWriter, r *http.Request) {
    // 从上下文获取验证结果
    if userStatus, ok := middleware.GetUserStatusFromContext(r.Context()); ok {
        switch userStatus.Status {
        case "complete":
            // 用户数据完整，正常处理
            handleRequest(w, r)
        case "billing_missing":
            // 用户缺少计费数据，引导完成设置
            http.Error(w, "请先完成计费设置", http.StatusPaymentRequired)
            return
        case "business_missing":
            // 用户业务数据缺失，需要初始化
            http.Error(w, "用户数据初始化中", http.StatusForbidden)
            return
        default:
            log.Printf("用户状态异常: %s", userStatus.Status)
            http.Error(w, "用户数据异常", http.StatusInternalServerError)
            return
        }
    }

    // 正常处理请求
    handleRequest(w, r)
}
```

## 验证状态说明

### UserLayerStatus 结构

```go
type UserLayerStatus struct {
    UserID     string `json:"user_id"`
    Layer1OK   bool   `json:"layer1_ok"`   // Supabase auth.users
    Layer2OK   bool   `json:"layer2_ok"`   // Cloud SQL user.users
    Layer3OK   bool   `json:"layer3_ok"`   // Cloud SQL billing.accounts
    EmailMatch bool   `json:"email_match"`
    Status     string `json:"status"`     // 整体状态
    Details    string `json:"details"`    // 详细描述
    Timestamp  int64  `json:"timestamp"`  // 检查时间戳
}
```

### 状态类型

- **complete**: 所有三层都存在且数据一致
- **business_missing**: Layer 2或Layer 3缺失
- **billing_missing**: Layer 3缺失
- **email_inconsistent**: Layer 1和Layer 2邮箱不一致
- **partial**: 部分数据存在
- **critical_auth_missing**: Layer 1认证失败

## 性能优化建议

### 1. 数据库层面
- 为验证查询添加复合索引
- 使用连接池避免频繁连接/断开
- 实现结果缓存减少重复验证

### 2. 应用层面
- 配置合理的验证超时时间
- 根据请求类型选择性验证
- 异步执行非关键验证操作

### 3. 监控层面
- 监控验证失败率
- 设置性能基准和告警
- 定期分析验证日志

## 故障排除

### 常见问题

1. **验证超时**
   - 检查数据库连接状态
   - 优化查询性能
   - 增加验证超时时间

2. **验证失败率高**
   - 检查数据完整性
   - 确认自动修复是否正常工作
   - 分析失败模式

3. **自动修复不工作**
   - 检查数据库权限
   - 验证修复逻辑
   - 查看错误日志

## 最佳实践

1. **配置管理**
   - 生产环境使用严格模式
   - 开发环境可以使用宽松模式便于调试
   - 合理设置验证超时时间

2. **日志记录**
   - 记录详细的验证结果
   - 包含足够的上下文信息便于调试
   - 定期清理过期的日志

3. **监控集成**
   - 集成Prometheus指标收集
   - 设置关键指标的告警阈值
   - 建立监控仪表板

4. **测试策略**
   - 编写单元测试验证各种场景
   - 进行集成测试验证完整流程
   - 进行性能测试验证系统负载

## 迁移和部署

### 数据库迁移
确保运行迁移脚本：
```bash
# 运行三层验证相关的数据库迁移
psql $DATABASE_URL -f migrations/001_three_layer_validation_schema.up.sql
```

### 环境变量配置
```bash
# 启用三层验证
USE_THREE_LAYER_VALIDATION=true

# 严格模式（生产环境建议）
THREE_LAYER_STRICT_MODE=true

# 验证超时时间（毫秒）
THREE_LAYER_VALIDATION_TIMEOUT=5000

# 启用自动修复
THREE_LAYER_AUTO_HEAL=true

# 自动修复超时时间（秒）
THREE_LAYER_HEAL_TIMEOUT=10
```

## 版本历史

- **v1.0.0**: 初始版本，实现基本的三层验证功能
- **v1.1.0**: 添加自动修复功能
- **v1.2.0**: 性能优化和监控集成
- **v1.3.0**: 增强错误处理和故障排除

## 相关文档

- [DATABASE_ARCHITECTURE_CURRENT.md](./DATABASE_ARCHITECTURE_CURRENT.md) - 数据库架构说明
- [pkg/database/adapter.go](../pkg/database/adapter.go) - 数据库适配器
- [pkg/auth/supabase.go](../pkg/auth/supabase.go) - Supabase认证
- [pkg/middleware/](../pkg/middleware/) - 中间件包

## 贡献指南

如需改进三层验证中间件，请：

1. 创建功能分支
2. 编写测试用例
3. 更新文档
4. 提交Pull Request

## 许可证

本组件遵循AdsAI项目许可证。