# 预发环境集成测试路线图

生成时间: 2025-10-09

## 概述

本文档记录预发环境真实集成测试的完整实施计划和进度。

## 核心原则

**用户要求**: "所有服务的测试都直接调用预发环境的服务和数据库完成实际测试，不要假装测试完成"

### 测试要求

1. **真实连接**: 必须连接预发环境的实际部署服务
2. **真实数据库**: 使用 Supabase PostgreSQL（预发环境）
3. **真实认证**: 使用真实的 JWT token 或 Service Key
4. **数据清理**: 测试后必须清理测试数据
5. **幂等性**: 测试可以重复运行不影响结果

## 基础设施

### 预发环境配置

**Supabase 数据库**:
- URL: `https://jzzvizacfyipzdyiqfzb.supabase.co`
- DB Host: `aws-1-ap-northeast-1.pooler.supabase.com:5432`
- Database: `postgres`
- User: `postgres.jzzvizacfyipzdyiqfzb`

**服务 URL 模式**:
- `https://[service]-preview-yt54xvsg5q-an.a.run.app`

### 统一测试工具

创建了 `pkg/testutil/integration.go` 提供统一的测试工具：

```go
type PreviewEnvConfig struct {
    SupabaseURL        string
    SupabaseDBURL      string
    SupabaseServiceKey string

    // 所有微服务 URL
    BillingURL         string
    OfferURL           string
    AdscenterURL       string
    // ...

    TestUserID    string
    TestUserEmail string
    TestUserToken string
}
```

**功能**:
- ✅ `LoadPreviewEnvConfig()` - 从环境变量加载配置
- ✅ `ConnectToSupabase()` - 连接 Supabase 数据库
- ✅ `HealthCheck()` - 检查服务可用性
- ✅ `MakeRequest()` - 发送带认证的 HTTP 请求
- ✅ `CleanupTestData()` - 清理测试数据
- ✅ `CreateTestUser()` - 创建测试用户

## 服务健康检查修复

### Phase 1: 健康检查端点排查 ✅ 已完成

**排查结果** (2025-10-09):

| 服务 | /health | /healthz | /readyz | 状态 |
|------|---------|----------|---------|------|
| billing | ❌ 404 | ✅ | ✅ | 需重新部署 |
| offer | ✅ | ✅ | - | 正常 |
| adscenter | ✅ | ✅ | ✅ | 正常 |
| siterank | ❌ | ❌ 404 | - | 已修复代码 |
| browser-exec | ✅ | - | - | 正常 |
| proxy-pool | ✅ | - | - | 正常 |
| recommendations | ❌ 404 | ✅ | ✅ | 已修复代码 |

### Phase 2: 代码修复 ✅ 已完成

**修复记录**:

1. **siterank** (services/siterank/main.go:130-131)
   - 添加 `/health` 端点
   - 确保 `/healthz` 端点正确注册
   - 状态: ✅ 代码已修复，待部署

2. **recommendations** (services/recommendations/main.go:51)
   - 添加 `/health` 端点
   - 状态: ✅ 代码已修复，待部署

3. **billing** (services/billing/main.go:115)
   - 验证代码已正确注册 `/health`
   - 状态: ⚠️ 需重新部署以应用最新代码

**Git Commit**: `3afdc5c7` - "fix(health): 修复预发环境服务健康检查端点"

### Phase 3: 部署到预发环境 🔄 进行中

**部署脚本**: `scripts/deploy-health-fixes.sh`

待部署服务:
- [ ] siterank-preview
- [ ] recommendations-preview
- [ ] billing-preview (重新部署)

**部署命令**:
```bash
./scripts/deploy-health-fixes.sh
```

**验证命令**:
```bash
./scripts/check-preview-services.sh
```

## 集成测试实施计划

### 已完成的服务

#### 1. siterank ✅

**测试文件**: `services/siterank/integration_test.go`

**测试场景** (8个):
1. ✅ API 端点测试 - 评估创建和查询
2. ✅ 品牌提取逻辑 - 从各种 URL 模式提取品牌
3. ✅ SimilarWeb 缓存 - 缓存命中/未命中场景
4. ✅ 评估评分 - 使用各种数据源的评分逻辑
5. ✅ Token 消耗 - 验证 token 扣减
6. ✅ 错误处理 - 无效 URL、超时、服务不可用
7. ✅ 数据库持久化 - 评估结果存储和查询
8. ✅ 并发评估 - 多个并发请求处理

**运行方式**:
```bash
cd services/siterank
SITERANK_SERVICE_URL=https://siterank-preview-yt54xvsg5q-an.a.run.app \
DATABASE_URL=postgres://postgres.jzzvizacfyipzdyiqfzb:PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres \
TEST_USER_TOKEN=xxx \
go test -v -tags=integration ./integration_test.go
```

**文档**: `services/siterank/README_INTEGRATION_TESTS.md`

### 待实施的服务

#### 2. billing ⏳ 待实施

**当前状态**: 有单元测试，缺少真实集成测试

**需要的测试场景**:
- [ ] Token 余额查询 - 连接预发环境数据库
- [ ] Token 预留 (Reserve) - 真实 API 调用
- [ ] Token 提交 (Commit) - 真实扣款和数据库更新
- [ ] Token 释放 (Release) - 撤销预留
- [ ] 订阅充值 - Credit subscription tokens
- [ ] 购买充值 - Credit purchased tokens
- [ ] 使用报告 - 查询真实使用数据
- [ ] 一致性检查 - UserToken vs Pool vs CreditLots

**测试文件**: `services/billing/integration_test.go` (待创建)

#### 3. offer ⏳ 待实施

**当前状态**: 有测试工具 (testutil)，缺少集成测试

**需要的测试场景**:
- [ ] 创建 Offer - 真实数据库插入
- [ ] 查询 Offer - 从预发环境查询
- [ ] 更新 Offer 状态 - 状态流转测试
- [ ] Offer 评估触发 - 调用 siterank 服务
- [ ] Offer 模拟 - 调用 browser-exec 服务
- [ ] Offer 启动 - 调用 adscenter 服务
- [ ] 事件发布 - Pub/Sub 事件验证
- [ ] 数据清理 - 测试后清理

**测试文件**: `services/offer/integration_test.go` (待创建)

#### 4. adscenter ⏳ 待实施

**当前状态**: 服务健康，缺少集成测试

**需要的测试场景**:
- [ ] 批量操作入队 - 真实 Redis/Valkey 操作
- [ ] 执行目标派生 - 从 Offer 派生广告账户操作
- [ ] 广告操作执行 - 真实 Google Ads API 调用（沙箱）
- [ ] 操作状态查询 - 从数据库查询状态
- [ ] 错误处理 - API 限流、认证失败等
- [ ] 指标上报 - Prometheus metrics 验证

**测试文件**: `services/adscenter/integration_test.go` (待创建)

#### 5. browser-exec ⏳ 待实施

**当前状态**: 服务健康，缺少集成测试

**需要的测试场景**:
- [ ] 简单页面访问 - 真实 Playwright 执行
- [ ] JavaScript 执行 - 动态内容渲染
- [ ] Cloudflare 绕过 - 真实挑战页面
- [ ] 多重定向跟踪 - 完整跳转链追踪
- [ ] 超时处理 - 长时间运行页面
- [ ] 并发请求 - 多个并发浏览器会话
- [ ] 资源清理 - 浏览器进程清理验证

**测试文件**: `services/browser-exec/integration_test.go` (待创建)

#### 6. proxy-pool ⏳ 待实施

**当前状态**: 服务健康，缺少集成测试

**需要的测试场景**:
- [ ] 代理获取 - 从池中获取可用代理
- [ ] 代理验证 - 真实连接测试
- [ ] 代理轮转 - 多国代理切换
- [ ] 代理健康检查 - 可用性监控
- [ ] 代理黑名单 - 失败代理移除
- [ ] 指标上报 - 代理使用统计

**测试文件**: `services/proxy-pool/integration_test.go` (待创建)

#### 7. recommendations ⏳ 待实施

**当前状态**: 服务健康，缺少集成测试

**需要的测试场景**:
- [ ] Offer 别名创建 - 真实 URL 缩短
- [ ] 别名查询 - 从 Redis 缓存和 DB 查询
- [ ] BigQuery 推荐查询 - 真实数据仓库查询
- [ ] Firestore 数据同步 - 跨数据库同步
- [ ] 缓存一致性 - Redis vs DB 一致性
- [ ] 性能测试 - 查询延迟监控

**测试文件**: `services/recommendations/integration_test.go` (待创建)

## 测试环境配置

### 环境变量模板

创建了 `.env.integration.example`:

```bash
# Supabase 数据库配置（预发环境）
SUPABASE_URL=https://jzzvizacfyipzdyiqfzb.supabase.co
SUPABASE_DB_URL=postgres://postgres.jzzvizacfyipzdyiqfzb:YOUR_PASSWORD@...
SUPABASE_SERVICE_KEY=<从 Secret Manager 获取>

# Cloud Run 服务 URL（预发环境）
BILLING_URL=https://billing-preview-yt54xvsg5q-an.a.run.app
OFFER_URL=https://offer-preview-yt54xvsg5q-an.a.run.app
# ...

# 测试用户配置
TEST_USER_ID=test-user-integration
TEST_USER_EMAIL=test@integration.test
TEST_USER_TOKEN=<从预发环境获取>
```

### 获取密钥

```bash
# Supabase Service Key
gcloud secrets versions access latest \
  --secret="SUPABASE_SERVICE_KEY" \
  --project=gen-lang-client-0944935873

# 其他密钥类似获取
```

## 运行测试

### 单个服务测试

```bash
# 设置环境变量
export $(cat .env.integration | xargs)

# 运行特定服务的集成测试
cd services/siterank
go test -v -tags=integration ./integration_test.go

cd services/billing
go test -v -tags=integration ./integration_test.go
```

### 所有服务测试

```bash
# 创建测试脚本（待实施）
./scripts/run-integration-tests.sh
```

## 进度跟踪

### 总体进度

- ✅ Phase 1: 基础设施准备 (100%)
  - ✅ 创建 pkg/testutil
  - ✅ 创建 .env.integration.example
  - ✅ 创建健康检查脚本

- ✅ Phase 2: 健康检查修复 (100%)
  - ✅ 排查所有服务
  - ✅ 修复代码
  - 🔄 部署到预发环境 (0%)

- 🔄 Phase 3: 集成测试实施 (14%)
  - ✅ siterank (100%)
  - ⏳ billing (0%)
  - ⏳ offer (0%)
  - ⏳ adscenter (0%)
  - ⏳ browser-exec (0%)
  - ⏳ proxy-pool (0%)
  - ⏳ recommendations (0%)

### 下一步行动

1. **立即执行**:
   - [ ] 运行 `./scripts/deploy-health-fixes.sh`
   - [ ] 验证所有 health 端点正常
   - [ ] 更新 PREVIEW-ENV-STATUS.md

2. **短期 (本周)**:
   - [ ] 实施 billing 集成测试
   - [ ] 实施 offer 集成测试
   - [ ] 实施 adscenter 集成测试

3. **中期 (下周)**:
   - [ ] 实施 browser-exec 集成测试
   - [ ] 实施 proxy-pool 集成测试
   - [ ] 实施 recommendations 集成测试

4. **长期**:
   - [ ] CI/CD 集成 - GitHub Actions 自动运行集成测试
   - [ ] 测试报告 - 生成测试覆盖率和性能报告
   - [ ] 监控告警 - 集成测试失败自动告警

## 相关文档

- `PREVIEW-ENV-STATUS.md` - 预发环境服务状态
- `.env.integration.example` - 环境变量模板
- `pkg/testutil/integration.go` - 统一测试工具
- `scripts/check-preview-services.sh` - 健康检查脚本
- `scripts/deploy-health-fixes.sh` - 部署脚本
- `services/siterank/README_INTEGRATION_TESTS.md` - Siterank 测试文档

## 附录

### 常见问题

**Q: 集成测试会影响生产数据吗？**
A: 不会。所有测试使用独立的测试用户 ID（`test-user-*` 前缀），测试后自动清理。

**Q: 如何获取测试用的 JWT token？**
A: 使用 Supabase Service Key 创建测试用户，或从预发环境的前端登录获取。

**Q: 测试失败如何调试？**
A:
1. 检查服务健康状态：`./scripts/check-preview-services.sh`
2. 查看服务日志：`gcloud run services logs read [service]-preview`
3. 验证环境变量配置
4. 检查数据库连接

**Q: 如何确保测试幂等性？**
A:
1. 使用唯一的测试 ID（包含时间戳）
2. 测试开始前清理旧数据
3. 测试结束后清理新数据
4. 使用事务回滚（where applicable）
