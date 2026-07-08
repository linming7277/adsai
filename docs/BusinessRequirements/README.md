# AdsAI 业务需求文档目录

**最后更新**: 2025-10-15

---

## 📚 文档概览

### 核心文档

1. **[MASTER_TASK_LIST.md](./MASTER_TASK_LIST.md)** ⭐️ **[START HERE]**
   - **用途**: 完整的子任务列表，用于追踪实施进展
   - **包含**: 106个子任务，按后端/前端/基础设施/测试分类
   - **工期**: 25个工作日
   - **适用于**: 项目经理、开发团队、QA团队

2. **[EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md)**
   - **用途**: 执行摘要，5个核心业务模块概述
   - **包含**: 功能概述、技术方案、实施计划（23天）
   - **适用于**: 管理层、产品经理

3. **[IMPLEMENTATION_PLAN_V1.md](./IMPLEMENTATION_PLAN_V1.md)**
   - **用途**: 详细技术实现方案
   - **包含**: 架构设计、数据流设计、API端点设计、前端组件设计
   - **页数**: 98页
   - **适用于**: 架构师、技术Lead

---

## 🎯 专项需求文档

### 4. **[OFFER_EVALUATION_SYSTEM_V1.md](./OFFER_EVALUATION_SYSTEM_V1.md)**

**需求概述**: Offer评估系统（13个需求）

**核心功能**:
- Browser-Exec集成（获取域名、品牌）
- SimilarWeb API集成（获取流量数据）
- Vertex AI Gemini集成（AI评估）
- 全局缓存（成功7天，失败1小时）
- Token预扣机制
- 套餐权限控制（Starter vs Pro/Elite）

**工期**: 15天

**关键任务**:
- BE-001~BE-043: 后端实现（67小时）
- FE-020~FE-029: 前端UI（21小时）

---

### 5. **[ROUTE_REORGANIZATION_PLAN_V2.md](./ROUTE_REORGANIZATION_PLAN_V2.md)** ⭐️ **[推荐]**

**需求概述**: 路由重组与功能增强（V2版本）

**核心变更**:
- 路由迁移：`/dashboard/offers` → `/offers`（直接新建，删除旧路由）
- 签到系统：每日10 token（简化版，无连续奖励）
- 邀请系统：套餐试用奖励（自行注册7天，邀请注册双方各14天）
- 后台管理：订阅管理、数据分析

**工期**: 15天

**关键任务**:
- FE-001~FE-012: 路由重组（13小时）
- BE-044~BE-051: 签到系统（8.5小时）
- BE-052~BE-063: 邀请系统（18.5小时）
- BE-080~BE-087: 后台管理（14.5小时）

---

### 6. **[ROUTE_REORGANIZATION_PLAN.md](./ROUTE_REORGANIZATION_PLAN.md)** ⚠️ **[已废弃]**

**状态**: V1版本，已被V2替代

**差异**:
- 使用301重定向（V2改为直接删除旧路由）
- 签到系统有连续奖励（V2简化为仅每日10 token）
- 邀请奖励为Token（V2改为套餐试用）

**不推荐使用**，请参考V2版本。

---

## 📊 文档关系图

```
MASTER_TASK_LIST.md (主任务列表)
    ├─ EXECUTIVE_SUMMARY.md (执行摘要)
    ├─ IMPLEMENTATION_PLAN_V1.md (技术实现方案)
    ├─ OFFER_EVALUATION_SYSTEM_V1.md (Offer评估系统)
    └─ ROUTE_REORGANIZATION_PLAN_V2.md (路由重组V2)
```

---

## 🚀 快速开始

### 步骤1: 阅读执行摘要

阅读 [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md) 了解项目全貌（5分钟）

### 步骤2: 查看主任务列表

阅读 [MASTER_TASK_LIST.md](./MASTER_TASK_LIST.md) 了解具体任务（15分钟）

### 步骤3: 分配任务

根据主任务列表中的角色定义，分配任务给团队成员

### 步骤4: 启动开发

按照里程碑顺序执行：
- M1: 基础设施就绪（Day 1-2）
- M2: Offer评估系统后端（Day 3-8）
- M3: 路由重组（Day 9-11）
- M4: 前端核心功能（Day 12-18）
- M5: 后台管理和辅助系统（Day 19-22）
- M6: 测试（Day 23-25）
- M7: 生产发布（Day 26）

---

## 📋 任务追踪

### 推荐工具

1. **Notion** / **Linear** / **Jira**
   - 导入主任务列表
   - 创建看板视图
   - 分配负责人

2. **GitHub Projects**
   - 创建Issues（每个任务一个Issue）
   - 使用Labels分类（backend、frontend、testing）
   - 链接PR到对应Issue

### 任务命名规范

```
[任务ID] 任务名称

示例：
[BE-001] 创建offer_evaluations表
[FE-020] 创建EvaluateButton组件
[TEST-003] Offer评估流程集成测试
```

---

## 📈 进度追踪

### 每周更新

**时间**: 每周五下午
**负责人**: 项目经理
**内容**:
1. 更新MASTER_TASK_LIST.md中的任务状态
2. 识别阻塞问题
3. 调整资源分配

### 状态标记

- ⏳ **待开始**: 尚未开始
- 🚧 **进行中**: 正在开发
- ✅ **已完成**: 开发完成，代码已合并
- ⚠️ **阻塞**: 遇到问题，需要协助

---

## 🎯 关键指标

### 开发进度

| 指标 | 当前 | 目标 |
|------|------|------|
| 后端任务完成率 | 0% | 100% |
| 前端任务完成率 | 0% | 100% |
| 单元测试覆盖率 | - | >80% |
| E2E测试通过率 | 25% | >95% |

### 质量指标

| 指标 | 目标 |
|------|------|
| API响应时间 | <500ms (P95) |
| Dashboard加载时间 | <2秒 |
| LCP | <2.5秒 |
| Bundle Size | <300KB (gzip) |

---

## 📞 联系方式

### 问题反馈

- **GitHub Issues**: 技术问题、Bug反馈
- **Slack #project-adsai**: 日常沟通、快速问题
- **项目经理邮箱**: pm@adsai.com
- **技术Lead邮箱**: tech-lead@adsai.com

### 会议安排

- **每日站会**: 每天早上10:00，15分钟
- **周会**: 每周一下午2:00，1小时
- **Sprint Review**: 每2周五下午3:00，2小时

---

## 📝 文档维护

### 变更记录

| 日期 | 文档 | 变更内容 | 负责人 |
|------|------|---------|--------|
| 2025-10-15 | ROUTE_REORGANIZATION_PLAN_V2.md | 创建V2版本（简化签到、套餐试用奖励） | Team |
| 2025-10-15 | MASTER_TASK_LIST.md | 创建主任务列表（106个子任务） | Team |
| 2025-10-15 | OFFER_EVALUATION_SYSTEM_V1.md | 创建Offer评估系统文档 | Team |

---

**文档创建**: 2025-10-15
**最后更新**: 2025-10-15
**维护频率**: 每周更新
