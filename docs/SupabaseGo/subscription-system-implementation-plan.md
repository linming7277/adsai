# AutoAds 订阅系统实施计划

**版本**: V1.0
**日期**: 2025-10-17
**状态**: 规划阶段

---

## 一、项目背景

### 1.1 当前状况

根据对现有代码的Review，AutoAds订阅系统存在以下问题：

**前端配置硬编码**:
- 套餐信息硬编码在`apps/frontend/src/configuration.ts`
- 功能列表、价格、Token配额等都是静态配置
- 修改需要重新部署前端服务

**后端权限检查分散**:
- billing服务有基础的Token管理
- 缺少统一的权限检查机制
- 各微服务需要自行实现权限逻辑

**Token消耗规则不灵活**:
- Token消耗规则部分硬编码
- 已有`token_consumption_rules`表但使用不完整
- 缺少套餐级别的差异化计费

**配置更新流程复杂**:
- 需要修改代码、提交、构建、部署
- 无法快速响应业务需求
- 缺少配置变更历史追溯

### 1.2 目标

实现一个灵活、可配置、可追溯的订阅系统，支持：

1. **后台管理界面配置** - 无需修改代码即可调整套餐配置
2. **配置热更新** - 配置变更立即生效，无需重启服务
3. **前端自动同步** - 前端自动获取最新套餐信息
4. **多语言支持** - 中文¥/英文$自动切换
5. **配置变更追溯** - 完整的变更历史记录

---

## 二、核心功能模块

### 2.1 套餐配置管理系统（核心）

**功能范围**:
- 权限配置管理（功能开关、数量限制）
- Token消耗规则管理（操作计费规则）
- 套餐价格配置（价格、Token配额）
- 配置变更历史记录

**技术实现**:
- 数据库表：4张新表（permissions, token_costs, pricing, config_history）
- API服务：billing服务扩展
- 管理界面：console前端新增页面
- 缓存策略：Redis + 内存缓存
- 通知机制：Pub/Sub + SSE

### 2.2 权限检查中间件（支撑）

**功能范围**:
- 统一的权限检查API
- 微服务权限验证
- 权限缓存优化

**技术实现**:
- pkg/permissions包
- billing服务API
- 各微服务集成

### 2.3 Token消耗计算服务（支撑）

**功能范围**:
- 统一的Token消耗计算API
- 套餐级别差异化计费
- Token预留和确认机制优化

**技术实现**:
- billing服务扩展
- 现有token_consumption_rules表优化
- 各微服务集成

### 2.4 前端配置动态化（支撑）

**功能范围**:
- 套餐页面动态渲染
- 配置实时同步
- 多语言支持

**技术实现**:
- useSubscriptionConfig hook
- usePermission hook
- SSE配置更新监听

---

## 三、详细实施计划

### Phase 1: 数据库设计和迁移（1周）

#### 任务 1.1: 设计数据库表结构
**负责人**: Backend Team
**工作量**: 2天

**交付物**:
- [ ] subscription_permissions表设计
- [ ] subscription_token_costs表设计
- [ ] subscription_pricing表设计
- [ ] subscription_config_history表设计
- [ ] 索引设计文档

**验收标准**:
- 表结构支持JSONB存储复杂配置
- 索引覆盖常用查询场景
- 支持乐观锁（version字段）

#### 任务 1.2: 编写数据库迁移脚本
**负责人**: Backend Team
**工作量**: 2天

**交付物**:
- [ ] 创建表的SQL脚本
- [ ] 初始数据导入脚本
- [ ] 回滚脚本

**验收标准**:
- 迁移脚本幂等性
- 初始数据与现有配置一致
- 支持preview和production环境

#### 任务 1.3: 执行数据库迁移
**负责人**: DevOps Team
**工作量**: 1天

**交付物**:
- [ ] Preview环境迁移完成
- [ ] Production环境迁移完成
- [ ] 迁移验证报告

**验收标准**:
- 数据迁移成功无错误
- 现有功能不受影响
- 数据一致性验证通过

---

### Phase 2: Billing服务API开发（1.5周）

#### 任务 2.1: 实现配置查询API
**负责人**: Backend Team
**工作量**: 3天

**交付物**:
- [ ] GET /api/v1/subscription/config/permissions
- [ ] GET /api/v1/subscription/config/token-costs
- [ ] GET /api/v1/subscription/config/pricing
- [ ] GET /api/v1/subscription/config/all
- [ ] API单元测试

**验收标准**:
- API响应时间 < 100ms（使用缓存）
- 支持版本号返回（用于缓存失效）
- 错误处理完善

#### 任务 2.2: 实现权限检查API
**负责人**: Backend Team
**工作量**: 2天

**交付物**:
- [ ] POST /api/v1/subscription/check-permission
- [ ] 权限检查逻辑实现
- [ ] 缓存策略实现
- [ ] API单元测试

**验收标准**:
- 支持布尔、数字、字符串类型权限
- 缓存命中率 > 95%
- 响应时间 < 50ms

#### 任务 2.3: 实现Token消耗计算API
**负责人**: Backend Team
**工作量**: 2天

**交付物**:
- [ ] POST /api/v1/subscription/get-token-cost
- [ ] Token消耗计算逻辑
- [ ] 套餐级别差异化支持
- [ ] API单元测试

**验收标准**:
- 支持套餐级别差异化计费
- 支持"unsupported"标识
- 响应时间 < 50ms

---

### Phase 3: 配置热更新机制（1周）

#### 任务 3.1: 实现Redis缓存层
**负责人**: Backend Team
**工作量**: 2天

**交付物**:
- [ ] Redis缓存读写逻辑
- [ ] 缓存失效策略
- [ ] 缓存预热机制
- [ ] 缓存监控指标

**验收标准**:
- 缓存TTL: 5分钟（配置）、1分钟（权限检查）
- 缓存命中率 > 95%
- 缓存失效时间 < 1秒

#### 任务 3.2: 实现Pub/Sub通知机制
**负责人**: Backend Team
**工作量**: 2天

**交付物**:
- [ ] Pub/Sub消息发布逻辑
- [ ] Pub/Sub消息订阅逻辑
- [ ] 消息格式定义
- [ ] 重试机制

**验收标准**:
- 配置更新后立即发布消息
- billing服务30秒内接收到消息
- 支持消息重试（最多3次）

#### 任务 3.3: 实现SSE推送机制
**负责人**: Backend Team
**工作量**: 1天

**交付物**:
- [ ] SSE endpoint实现
- [ ] 配置更新事件推送
- [ ] 连接管理和心跳

**验收标准**:
- 前端5秒内接收到更新通知
- 支持多客户端连接
- 连接断开自动重连

---

### Phase 4: Console管理界面开发（1.5周）

#### 任务 4.1: 实现配置管理API
**负责人**: Backend Team
**工作量**: 3天

**交付物**:
- [ ] PUT /api/v1/console/subscription/permissions/:feature
- [ ] PUT /api/v1/console/subscription/token-costs/:action
- [ ] PUT /api/v1/console/subscription/pricing/:plan
- [ ] GET /api/v1/console/subscription/config/history
- [ ] 管理员权限验证

**验收标准**:
- 仅管理员可访问
- 配置更新原子性
- 变更历史完整记录

#### 任务 4.2: 开发权限配置页面
**负责人**: Frontend Team
**工作量**: 2天

**交付物**:
- [ ] /manage/subscription/permissions页面
- [ ] 权限配置表格
- [ ] 编辑和保存功能
- [ ] 实时验证

**验收标准**:
- 支持批量编辑
- 输入验证完善
- 保存成功提示

#### 任务 4.3: 开发Token消耗规则页面
**负责人**: Frontend Team
**工作量**: 2天

**交付物**:
- [ ] /manage/subscription/token-costs页面
- [ ] Token消耗规则表格
- [ ] 编辑和保存功能
- [ ] 实时验证

**验收标准**:
- 支持批量编辑
- 输入验证完善
- 保存成功提示

#### 任务 4.4: 开发套餐价格配置页面
**负责人**: Frontend Team
**工作量**: 1天

**交付物**:
- [ ] /manage/subscription/pricing页面
- [ ] 价格配置表单
- [ ] 编辑和保存功能
- [ ] 实时验证

**验收标准**:
- 支持月付/年付配置
- 价格验证完善
- 保存成功提示

#### 任务 4.5: 开发配置变更历史页面
**负责人**: Frontend Team
**工作量**: 1天

**交付物**:
- [ ] /manage/subscription/history页面
- [ ] 变更历史列表
- [ ] 筛选和搜索功能
- [ ] 详情查看

**验收标准**:
- 支持按类型、时间筛选
- 显示变更前后对比
- 支持导出CSV

---

### Phase 5: 前端配置动态化（1周）

#### 任务 5.1: 实现useSubscriptionConfig hook
**负责人**: Frontend Team
**工作量**: 2天

**交付物**:
- [ ] useSubscriptionConfig hook实现
- [ ] SWR缓存集成
- [ ] SSE更新监听
- [ ] 错误处理

**验收标准**:
- 自动获取最新配置
- 配置更新自动刷新
- 缓存策略合理

#### 任务 5.2: 实现usePermission hook
**负责人**: Frontend Team
**工作量**: 1天

**交付物**:
- [ ] usePermission hook实现
- [ ] 权限检查逻辑
- [ ] 使用示例

**验收标准**:
- 支持布尔、数字权限
- 返回allowed和limit
- 易于使用

#### 任务 5.3: 更新套餐展示页面
**负责人**: Frontend Team
**工作量**: 2天

**交付物**:
- [ ] /settings/subscription页面重构
- [ ] 动态渲染套餐卡片
- [ ] 多语言支持
- [ ] Token消耗显示

**验收标准**:
- 使用动态配置渲染
- 中英文切换正常
- 货币符号正确显示

---

### Phase 6: 微服务集成（1周）

#### 任务 6.1: 集成权限检查到siterank服务
**负责人**: Backend Team
**工作量**: 2天

**交付物**:
- [ ] 评估并发数权限检查
- [ ] AI评估权限检查
- [ ] 错误处理和提示

**验收标准**:
- 权限检查正常工作
- 错误提示清晰
- 不影响现有功能

#### 任务 6.2: 集成Token消耗计算到siterank服务
**负责人**: Backend Team
**工作量**: 1天

**交付物**:
- [ ] 基础评估Token计算
- [ ] AI评估Token计算
- [ ] 套餐级别差异化

**验收标准**:
- Token计算准确
- 支持套餐差异
- 不影响现有功能

#### 任务 6.3: 集成权限检查到adscenter服务
**负责人**: Backend Team
**工作量**: 2天

**交付物**:
- [ ] 广告账号数量限制检查
- [ ] 批量操作权限检查
- [ ] 错误处理和提示

**验收标准**:
- 权限检查正常工作
- 错误提示清晰
- 不影响现有功能

---

### Phase 7: 测试和上线（1周）

#### 任务 7.1: 单元测试
**负责人**: Backend Team + Frontend Team
**工作量**: 2天

**交付物**:
- [ ] Billing服务单元测试
- [ ] Console服务单元测试
- [ ] 前端组件单元测试
- [ ] 测试覆盖率报告

**验收标准**:
- 测试覆盖率 > 80%
- 所有测试通过
- 边界情况覆盖

#### 任务 7.2: 集成测试
**负责人**: QA Team
**工作量**: 2天

**交付物**:
- [ ] 配置更新流程测试
- [ ] 权限检查集成测试
- [ ] Token消耗计算集成测试
- [ ] 前端配置同步测试

**验收标准**:
- 端到端流程正常
- 配置更新立即生效
- 前端自动同步

#### 任务 7.3: 性能测试
**负责人**: QA Team
**工作量**: 1天

**交付物**:
- [ ] API响应时间测试
- [ ] 缓存命中率测试
- [ ] 并发压力测试
- [ ] 性能测试报告

**验收标准**:
- API响应时间 < 100ms
- 缓存命中率 > 95%
- 支持1000并发请求

#### 任务 7.4: Preview环境验证
**负责人**: QA Team + Product Team
**工作量**: 1天

**交付物**:
- [ ] Preview环境部署
- [ ] 功能验证清单
- [ ] 问题修复

**验收标准**:
- 所有功能正常工作
- 无阻塞性问题
- 用户体验良好

#### 任务 7.5: Production环境上线
**负责人**: DevOps Team
**工作量**: 1天

**交付物**:
- [ ] Production环境部署
- [ ] 灰度发布计划
- [ ] 回滚预案
- [ ] 上线监控

**验收标准**:
- 平滑上线无故障
- 监控指标正常
- 用户无感知

---

## 四、技术架构

### 4.1 数据流

```
管理员修改配置
    ↓
Console API (PUT /api/v1/console/subscription/...)
    ↓
数据库事务（更新配置 + 记录历史）
    ↓
删除Redis缓存
    ↓
发布Pub/Sub消息
    ↓
├─ Billing服务接收消息 → 刷新内存缓存
└─ Frontend通过SSE接收通知 → 重新获取配置
    ↓
配置立即生效
```

### 4.2 缓存策略

**三层缓存**:
1. **Redis缓存** (TTL 5分钟)
   - 套餐配置
   - 权限配置
   - Token消耗规则

2. **Billing服务内存缓存** (定时刷新)
   - 权限检查结果
   - Token消耗规则
   - 30秒刷新周期

3. **前端SWR缓存** (TTL 1分钟)
   - 套餐配置
   - 功能列表
   - SSE触发刷新

### 4.3 API设计

**Billing服务API**:
```
GET  /api/v1/subscription/config/all
GET  /api/v1/subscription/config/permissions
GET  /api/v1/subscription/config/token-costs
GET  /api/v1/subscription/config/pricing
POST /api/v1/subscription/check-permission
POST /api/v1/subscription/get-token-cost
```

**Console服务API**:
```
PUT  /api/v1/console/subscription/permissions/:feature
PUT  /api/v1/console/subscription/token-costs/:action
PUT  /api/v1/console/subscription/pricing/:plan
GET  /api/v1/console/subscription/config/history
```

---

## 五、风险和缓解措施

### 5.1 数据一致性风险

**风险**: 配置更新过程中可能出现数据不一致

**缓解措施**:
- 使用数据库事务确保原子性
- 乐观锁防止并发更新冲突
- 配置版本号机制

### 5.2 缓存失效风险

**风险**: 缓存失效不及时导致使用旧配置

**缓解措施**:
- 配置更新立即删除Redis缓存
- Pub/Sub通知机制确保服务刷新
- SSE推送确保前端及时更新

### 5.3 性能风险

**风险**: 配置查询频繁可能影响性能

**缓解措施**:
- 三层缓存策略
- 缓存预热机制
- 数据库索引优化

### 5.4 向后兼容风险

**风险**: 新系统可能影响现有功能

**缓解措施**:
- 保留硬编码配置作为fallback
- 灰度发布策略
- 完善的回滚预案

---

## 六、成功指标

### 6.1 功能指标

- [ ] 配置更新无需重启服务
- [ ] 配置更新5秒内生效
- [ ] 前端自动同步最新配置
- [ ] 支持中英文切换
- [ ] 配置变更历史完整记录

### 6.2 性能指标

- [ ] API响应时间 < 100ms
- [ ] 缓存命中率 > 95%
- [ ] 配置更新延迟 < 5秒
- [ ] 支持1000并发请求

### 6.3 质量指标

- [ ] 测试覆盖率 > 80%
- [ ] 零生产故障
- [ ] 用户满意度 > 90%

---

## 七、时间线

| 阶段 | 工作量 | 开始日期 | 结束日期 |
|------|--------|----------|----------|
| Phase 1: 数据库设计和迁移 | 1周 | Week 1 | Week 1 |
| Phase 2: Billing服务API开发 | 1.5周 | Week 2 | Week 3 |
| Phase 3: 配置热更新机制 | 1周 | Week 3 | Week 4 |
| Phase 4: Console管理界面开发 | 1.5周 | Week 4 | Week 5 |
| Phase 5: 前端配置动态化 | 1周 | Week 5 | Week 6 |
| Phase 6: 微服务集成 | 1周 | Week 6 | Week 7 |
| Phase 7: 测试和上线 | 1周 | Week 7 | Week 7 |

**总工期**: 7周

---

## 八、资源需求

### 8.1 人力资源

- **Backend Team**: 2人 × 7周
- **Frontend Team**: 1人 × 4周
- **QA Team**: 1人 × 2周
- **DevOps Team**: 1人 × 1周
- **Product Team**: 1人 × 1周（验收）

### 8.2 基础设施

- **数据库**: PostgreSQL（现有）
- **缓存**: Redis（现有）
- **消息队列**: Google Cloud Pub/Sub（现有）
- **监控**: Cloud Monitoring（现有）

---

## 九、后续优化方向

### 9.1 短期优化（1-2个月）

- [ ] 配置A/B测试支持
- [ ] 配置回滚功能
- [ ] 配置审批流程
- [ ] 配置模板功能

### 9.2 中期优化（3-6个月）

- [ ] 配置可视化编辑器
- [ ] 配置影响分析
- [ ] 配置自动化测试
- [ ] 配置性能优化

### 9.3 长期优化（6-12个月）

- [ ] 配置智能推荐
- [ ] 配置自动调优
- [ ] 配置多租户支持
- [ ] 配置国际化扩展

---

**维护人**: Product & Engineering Team
**最后更新**: 2025-10-17
**下次审查**: Phase 1完成后
