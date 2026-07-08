# Offer 服务测试工具包

本目录包含 offer 服务的测试工具和辅助函数。

## 文件说明

### fixtures.go

提供测试数据生成器和构建器。

**主要功能**:
- `NewTestOffer()`: 创建默认测试 Offer
- `NewTestOfferWithStatus(status)`: 创建指定状态的 Offer
- `NewTestOfferEvaluated()`: 创建已评估的 Offer
- `NewTestOfferCreatedEvent()`: 创建 OfferCreatedEvent
- `NewTestOfferEvaluatedEvent()`: 创建 OfferEvaluatedEvent
- `NewOfferBuilder()`: 创建 Offer 构建器（流式 API）

**使用示例**:

```go
// 创建默认测试 Offer
offer := testutil.NewTestOffer()

// 创建特定状态的 Offer
evaluatedOffer := testutil.NewTestOfferWithStatus("evaluated")

// 使用构建器创建自定义 Offer
offer := testutil.NewOfferBuilder().
    WithID("custom-id").
    WithUserID("user-123").
    WithName("Custom Offer").
    WithURL("https://custom.com").
    WithStatus("optimizing").
    WithScore(90.5).
    Build()

// 创建测试事件
event := testutil.NewTestOfferCreatedEvent()
```

### mocks.go

提供 Mock 对象用于单元测试。

**主要 Mock**:
- `MockEventPublisher`: Mock 事件发布器
- `MockSiterankClient`: Mock Siterank 客户端
- `MockOfferRepository`: Mock Offer 仓储
- `MockDB`: Mock 数据库连接
- `MockTx`: Mock 数据库事务

**使用示例**:

```go
// Mock 事件发布器
publisher := testutil.NewMockEventPublisher()

// 自定义行为
publisher.PublishFunc = func(ctx context.Context, event interface{}) error {
    // 自定义逻辑
    return nil
}

// 发布事件
publisher.Publish(ctx, event)

// 验证事件
assert.Equal(t, 1, publisher.GetEventCount())
assert.NotNil(t, publisher.GetLastEvent())

// Mock Siterank 客户端
siterankClient := testutil.NewMockSiterankClient()
siterankClient.EvaluateFunc = func(ctx context.Context, url string) (*testutil.SiterankResult, error) {
    return &testutil.SiterankResult{
        Score:     95.0,
        FinalURL:  url,
        Domain:    "example.com",
        BrandName: "Example",
    }, nil
}

result, err := siterankClient.Evaluate(ctx, "https://example.com")
```

### database.go

提供测试数据库连接和管理工具。

**主要功能**:
- `NewTestDB(t)`: 创建测试数据库连接
- `SetupTestTables()`: 创建测试表
- `Cleanup()`: 清理测试数据
- `TeardownTestTables()`: 删除测试表
- `InsertTestOffer()`: 插入测试 Offer
- `GetTestOffer()`: 获取测试 Offer

**使用示例**:

```go
func TestOfferRepository(t *testing.T) {
    // 创建测试数据库
    testDB := testutil.NewTestDB(t)
    defer testDB.Close()
    
    // 设置测试表
    testDB.SetupTestTables()
    defer testDB.TeardownTestTables()
    
    // 清理测试数据
    defer testDB.Cleanup()
    
    // 插入测试数据
    offer := testutil.NewTestOffer()
    err := testDB.InsertTestOffer(context.Background(), offer)
    assert.NoError(t, err)
    
    // 获取测试数据
    retrieved, err := testDB.GetTestOffer(context.Background(), offer.ID)
    assert.NoError(t, err)
    assert.NotNil(t, retrieved)
}
```

## 环境配置

### 测试数据库

设置 `TEST_DATABASE_URL` 环境变量：

```bash
export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/offer_test?sslmode=disable"
```

如果未设置，将使用默认值。

### 运行测试

```bash
# 运行所有测试
go test ./...

# 运行特定包的测试
go test ./internal/domain/...

# 运行测试并生成覆盖率报告
go test -v -race -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# 运行特定测试
go test -run TestOfferCompleteEvaluation ./internal/domain/...
```

## 测试最佳实践

### 1. 使用 AAA 模式

```go
func TestOfferCompleteEvaluation(t *testing.T) {
    // Arrange (准备)
    offer := testutil.NewTestOffer()
    score := 90.5
    
    // Act (执行)
    offer.CompleteEvaluation(score, "https://example.com", "example.com", "Example")
    
    // Assert (断言)
    assert.Equal(t, "evaluated", offer.EvaluationStatus)
    assert.Equal(t, &score, offer.SiterankScore)
}
```

### 2. 使用表驱动测试

```go
func TestOfferStatusTransitions(t *testing.T) {
    tests := []struct {
        name        string
        initialStatus string
        newStatus   string
        shouldError bool
    }{
        {"evaluating to evaluated", "evaluating", "evaluated", false},
        {"evaluated to optimizing", "evaluated", "optimizing", false},
        {"invalid transition", "evaluating", "archived", true},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            offer := testutil.NewTestOfferWithStatus(tt.initialStatus)
            err := offer.UpdateStatus(tt.newStatus)
            
            if tt.shouldError {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
                assert.Equal(t, tt.newStatus, offer.Status)
            }
        })
    }
}
```

### 3. 使用子测试

```go
func TestOfferDomain(t *testing.T) {
    t.Run("CompleteEvaluation", func(t *testing.T) {
        // 测试 CompleteEvaluation
    })
    
    t.Run("UpdateStatus", func(t *testing.T) {
        // 测试 UpdateStatus
    })
    
    t.Run("AddRevenue", func(t *testing.T) {
        // 测试 AddRevenue
    })
}
```

### 4. 清理资源

```go
func TestWithDatabase(t *testing.T) {
    testDB := testutil.NewTestDB(t)
    defer testDB.Close()
    defer testDB.Cleanup()
    
    // 测试逻辑
}
```

### 5. 使用 Mock 隔离依赖

```go
func TestEvaluationService(t *testing.T) {
    // Mock 外部依赖
    publisher := testutil.NewMockEventPublisher()
    siterankClient := testutil.NewMockSiterankClient()
    
    // 创建服务
    service := NewEvaluationService(publisher, siterankClient)
    
    // 测试服务逻辑
    err := service.EvaluateOffer(ctx, offer)
    assert.NoError(t, err)
    
    // 验证 Mock 调用
    assert.Equal(t, 1, publisher.GetEventCount())
}
```

## 测试覆盖率目标

- **领域模型**: >80%
- **服务层**: >70%
- **HTTP 处理器**: >60%
- **总体**: >60%

## 常见问题

### Q: 测试数据库连接失败

```bash
# 确保 PostgreSQL 正在运行
docker run -d --name postgres-test \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15

# 创建测试数据库
psql -h localhost -U postgres -c "CREATE DATABASE offer_test;"
```

### Q: 测试运行缓慢

```bash
# 使用并行测试
go test -parallel 4 ./...

# 跳过集成测试
go test -short ./...
```

### Q: Mock 不工作

确保正确设置 Mock 函数：

```go
mock := testutil.NewMockEventPublisher()
mock.PublishFunc = func(ctx context.Context, event interface{}) error {
    return nil  // 必须返回值
}
```

---

**最后更新**: 2025-10-08  
**维护者**: 后端团队
