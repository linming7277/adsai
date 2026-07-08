# AdsAI 数据架构设计原则

## 📋 概述

AdsAI 项目采用**混合数据库架构**，结合了 Cloud SQL（业务数据）和 Supabase（认证数据）的优势，实现了高性能、高可用性和可扩展性的数据管理系统。本文档定义了项目优化后的数据库架构核心原则和设计规范。

## 🎯 架构优化成果

### 阶段1完成状态：85% ✅
- **代码开发**: 100% 完成 - DatabaseManager、SupabaseClient、HybridDatabaseManager
- **部署验证**: 100% 完成 - Cloud Build成功，服务正常运行
- **功能测试**: 80% 完成 - 核心功能验证，API兼容性优化中
- **文档记录**: 100% 完成 - 完整的架构文档和操作指南

### 核心指标达成
- **性能提升**: pgxpool连接池管理优化数据库连接效率
- **构建成功率**: 100% - 所有语法检查通过
- **服务可用性**: HTTP 200健康检查，零错误启动
- **架构复杂度**: 遵循KISS原则，有效控制复杂度

## 🏗️ 新架构原则

### 1. 混合数据库架构 (Hybrid Database Architecture)
- **业务数据**: Cloud SQL PostgreSQL 作为主要业务数据存储
- **认证数据**: Supabase 作为用户认证和身份管理
- **数据同步**: 自动化双向同步机制确保数据一致性
- **连接管理**: 标准化pgxpool连接池，替代自定义连接器

### 2. 微服务数据库自治 (Microservice Database Autonomy)
- **直接连接**: 服务通过pgxpool直接连接数据库，无代理开销
- **连接池管理**: 每个服务独立管理连接池，避免单点故障
- **性能优化**: 基于IAM和SSL的安全机制，实现优秀性能
- **扩展性**: GCP基础设施支持，自动负载均衡

### 3. 现代化迁移管理 (Modern Migration Management)
- **golang-migrate**: 使用标准化的数据库迁移工具
- **版本控制**: 完整的up/down迁移文件，支持回滚
- **CI/CD集成**: GitHub → Cloud Build → Cloud Run自动化流程
- **混合迁移**: 支持Cloud SQL和Supabase的协调迁移

## 🔧 技术实现架构

### 混合数据库访问层
```
应用程序服务 → DatabaseManager/SupabaseClient → [Cloud SQL | Supabase]
     ↓                 ↓                    ↓
业务数据操作        HybridDatabaseManager    认证数据操作
     ↓                 ↓                    ↓
pgxpool连接池      数据同步机制           Supabase SDK
```

### 核心组件架构
1. **应用层**: 微服务 (billing, adscenter, useractivity, offer, siterank)
2. **数据库管理层**:
   - `DatabaseManager`: Cloud SQL pgxpool连接管理
   - `SupabaseClient`: Supabase认证服务封装
   - `HybridDatabaseManager`: 混合数据源统一接口
3. **数据存储层**:
   - **Cloud SQL**: 业务数据、交易记录、订阅信息
   - **Supabase**: 用户认证、身份管理、用户配置

### 技术栈优化
- **数据库连接**: pgx/v5 + pgxpool (标准PostgreSQL连接池)
- **认证集成**: Supabase Go SDK v0.0.4
- **迁移管理**: golang-migrate v4.19.0
- **错误处理**: 结构化错误处理和重试机制
- **监控**: 健康检查、性能指标、连接池状态

## 🛡️ 安全架构

### 混合安全策略
- **Cloud SQL**: 基于IAM的服务认证，VPC内网访问
- **Supabase**: JWT Token认证，OAuth 2.0集成
- **数据同步**: 加密传输，完整性验证
- **访问控制**: 分层权限管理，最小权限原则

### 安全特性
- **连接安全**: SSL/TLS加密，IAM角色绑定
- **数据加密**: 静态数据加密，传输加密
- **SQL 注入防护**: 参数化查询，输入验证
- **连接池隔离**: 每个服务独立连接池
- **审计日志**: 数据库操作记录，同步日志追踪
- **速率限制**: API级别限流，防止滥用

### 网络架构
```
Internet → Cloud Run (服务) → [Private VPC]
                              ↓
                    ┌─────────────────────────┐
                    │  Cloud SQL (业务数据)   │
                    │  - IAM认证              │
                    │  - VPC内网              │
                    └─────────────────────────┘
                              ↓
                    ┌─────────────────────────┐
                    │  Supabase (认证数据)     │
                    │  - OAuth 2.0            │
                    │  - JWT Token           │
                    └─────────────────────────┘
```

## 📊 数据库设计模式

### 混合数据架构
```
┌─────────────────────────────────────────────────────────────┐
│                   AdsAI 混合数据架构                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────────────────────┐  │
│  │   Cloud SQL     │    │          Supabase                │  │
│  │   (业务数据)     │    │        (认证数据)                │  │
│  │                 │    │                                 │  │
│  │ • billing       │    │ • 用户认证                        │  │
│  │ • adscenter     │    │ • 身份管理                        │  │
│  │ • offer         │    │ • 用户配置                        │  │
│  │ • siterank      │    │ • OAuth集成                       │  │
│  │ • useractivity  │    │ • 权限控制                        │  │
│  └─────────────────┘    └─────────────────────────────────┘  │
│           ↓                       ↓                          │
│     数据同步机制              ←→     数据同步机制                │
│           ↓                       ↓                          │
└─────────────────────────────────────────────────────────────┘
```

### Schema设计优化
每个业务域拥有��立的schema，支持数据同步：

#### Cloud SQL Schema (业务数据)
- **billing**: 用户账户、订阅、交易记录
- **adscenter**: 广告账户、投放数据、统计信息
- **offer**: 优惠活动、促销策略、兑换记录
- **siterank**: 网站评估、排名数据、历史趋势
- **useractivity**: 用户行为、活动日志、通知记录

#### Supabase Schema (认证数据)
- **auth.users**: 用户认证信息
- **auth.sessions**: 用户会话管理
- **custom.user_profiles**: 用户配置和偏好
- **custom.permissions**: 权限和角色管理

### 数据同步策略
- **双向同步**: Cloud SQL ↔ Supabase实时数据同步
- **事件驱动**: 基于数据库触发器的变更通知
- **冲突解决**: 最后写入胜出策略，记录冲突日志
- **一致性保证**: 最终一致性，强一致性关键数据

## 🔍 数据流架构

### 混合数据读取流程
```
用户请求 → HybridDatabaseManager → [数据源选择] → [查询执行] → [结果整合] → 返回响应
                                    ↓              ↓
                              业务数据查询      认证数据查询
                                    ↓              ↓
                            Cloud SQL       Supabase
                                    ↓              ↓
                            pgxpool查询      JWT验证查询
```

### 数据写入流程
```
数据写入请求 → HybridDatabaseManager → 事务管理 → [双重写入] → 同步日志
                                          ↓              ↓
                                    业务数据写入      认证数据更新
                                          ↓              ↓
                                 Cloud SQL事务    Supabase API调用
                                          ↓              ↓
                                   提交事务        记录同步状态
```

### 数据同步流程
```
数据变更触发 → 同步事件队列 → 数据转换 → 冲突检测 → 双向同步 → 状态更新
     ↓              ↓            ↓         ↓         ↓         ↓
  DB触发器      事件处理器      格式标准化   一致性检查   远程API   同步日志
```

### 迁移执行流程
```
迁移操作 → golang-migrate → [迁移验证] → [执行迁移] → [状态记录] → 完成
       ↓           ↓            ↓           ↓           ↓
  迁移脚本    版本检查      预检查     up/down文件   迁移表更新
```

## 📋 实现规范

### 服务端实现
```go
// ✅ 正确的数据库访问方式
func (s *UserService) GetUserActivity(ctx context.Context, userID string) ([]Activity, error) {
    query := "SELECT * FROM user_activities WHERE user_id = $1 ORDER BY created_at DESC"
    result, err := s.dbClient.ExecuteQuery(ctx, "useractivity", query, userID)
    if err != nil {
        return nil, fmt.Errorf("failed to query user activities: %w", err)
    }
    return parseActivities(result), nil
}

// ❌ 禁止的直接数据库连接
func (s *UserService) GetUserActivityBad(ctx context.Context, userID string) ([]Activity, error) {
    db, err := sql.Open("postgres", cfg.DatabaseURL) // 禁止
    if err != nil {
        return nil, err
    }
    // 直接数据库操作代码...
}
```

### 客户端配置
```go
// 数据库客户端初始化
func NewUserActivityDatabase() (*UserActivityDatabase, error) {
    dbAdminURL := os.Getenv("DB_ADMIN_URL")
    if dbAdminURL == "" {
        dbAdminURL = "https://db-admin-preview-xxxxx.a.run.app"
    }

    token := os.Getenv("DB_ADMIN_TOKEN")
    if token == "" {
        return nil, fmt.Errorf("DB_ADMIN_TOKEN environment variable is required")
    }

    dbClient := database.NewHTTPDBAdminClient(dbAdminURL, token)
    return &UserActivityDatabase{client: dbClient}, nil
}
```

## 🚀 部署架构

### 预发/生产环境
- **主数据库**: Cloud SQL PostgreSQL
- **只读副本**: 用于读取密集型操作
- **连接池**: db-admin 服务管理所有连接
- **负载均衡**: 通过 Cloud Run 自动扩缩容

### 开发环境
- **本地数据库**: Docker PostgreSQL 容器
- **测试数据库**: 独立的测试 schema
- **开发工具**: `dbctl` 命令行工具

## 📈 监控与维护

### 性能监控
- **查询性能**: 监控慢查询和执行时间
- **连接池状态**: 监控连接使用情况
- **错误率**: 监控数据库操作错误率
- **资源使用**: 监控 CPU 和内存使用

### 维护流程
- **定期备份**: 自动化数据库备份
- **索引优化**: 基于使用情况优化索引
- **清理归档**: 定期清理历史数据
- **安全审计**: 定期安全检查和更新

## 🔄 迁移策略

### 新服务接入
1. 创建独立的数据库 schema
2. 配置 db-admin 客户端连接
3. 实现数据访问层代码
4. 运行集成测试验证
5. 部署到生产环境

### 现有服务迁移
1. 评估现有数据库连接代码
2. 实现新的 db-admin 客户端
3. 逐步替换数据库访问逻辑
4. 验证功能完整性
5. 移除旧的数据库连接代码

## 📚 相关文档

- [数据库管理服务设计](../SupabaseGo/DB_ADMIN_SERVICE_DESIGN.md)
- [数据库统一策略](../SupabaseGo/DATABASE_UNIFIED_STRATEGY.md)
- [数据库连接最佳实践](../SupabaseGo/DATABASE_CONNECTION_BEST_PRACTICES.md)
- [完整数据库管理解决方案](../Database/COMPLETE_DATABASE_MANAGEMENT_SOLUTION.md)

## 🎯 成功指标

### 技术指标
- **代理覆盖率**: > 95% 的数据库操作通过 db-admin
- **DDL 集中化**: 100% 的 DDL 操作通过 db-admin 执行
- **迁移统一**: 单一的迁移工具和流程
- **安全合规**: 零直接数据库连接

### 业务指标
- **查询性能**: 95% 的查询在 100ms 内完成
- **系统可用性**: > 99.9% 的数据库服务可用性
- **开发效率**: 减少 50% 的数据库相关开发时间
- **维护成本**: 降低 40% 的数据库维护成本

---

**最后更新**: 2025-01-20
**版本**: v1.0
**维护者**: AdsAI 技术团队