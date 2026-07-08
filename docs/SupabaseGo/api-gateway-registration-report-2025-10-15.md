# API Gateway 注册完整性评估报告

**日期**: 2025-10-15
**评估人**: Claude Code
**项目**: AutoAds
**GCP Project**: gen-lang-client-0944935873

---

## 📊 执行摘要

⚠️ **评估结论**: 存在缺失注册，部分服务API未在Gateway注册，可能导致Frontend调用失败。

**关键发现**:
- ✅ 已注册服务: 6个
- ⚠️ 有OpenAPI但未注册: 3个
- ❌ Frontend调用但未注册: 1个 **(notifications服务 - 高优先级)**
- 🔍 Worker服务: 3个（无需Gateway）
- 📝 内部服务: 2个（无需Gateway）

---

## 🎯 关键问题

### ❌ 紧急问题：Frontend调用失败

**问题**: Frontend正在调用 `/api/v1/notifications/recent`，但此API未在Gateway注册

**影响**:
- Frontend `useNotifications()` hook会返回404错误
- 用户无法看到通知
- 可能影响用户体验

**位置**: `apps/frontend/src/lib/notifications/hooks.ts:11`

```typescript
const endpoint = `/api/v1/notifications/recent?limit=${limit}`;
```

**解决方案**: 将notifications服务注册到Gateway

---

## 📋 详细评估

### 1. 后端服务总览

#### 生产环境服务（13个）

| 服务名 | URL | 类型 | OpenAPI | Gateway注册 | 状态 |
|--------|-----|------|---------|------------|------|
| adscenter | adscenter-yt54xvsg5q-an.a.run.app | API | ✅ | ✅ | 正常 |
| batchopen | batchopen-yt54xvsg5q-an.a.run.app | API | ✅ | ✅ | 正常 |
| billing | billing-yt54xvsg5q-an.a.run.app | API | ✅ | ✅ | 正常 |
| browser-exec | browser-exec-yt54xvsg5q-an.a.run.app | API | ✅ | ❌ | 缺失注册 |
| browser-exec-worker | browser-exec-worker-yt54xvsg5q-an.a.run.app | Worker | ❌ | ❌ | 无需Gateway |
| console | console-yt54xvsg5q-an.a.run.app | API | ✅ | ✅ | 正常 |
| notifications | notifications-yt54xvsg5q-an.a.run.app | API | ✅ | ❌ | **缺失注册** |
| offer | offer-yt54xvsg5q-an.a.run.app | API | ✅ | ✅ | 正常 |
| projector | projector-yt54xvsg5q-an.a.run.app | API | ❌ | ❌ | 未知类型 |
| proxy-pool | proxy-pool-yt54xvsg5q-an.a.run.app | 内部 | ❌ | ❌ | 内部服务 |
| recommendations | recommendations-yt54xvsg5q-an.a.run.app | API | ✅ | ❌ | 缺失注册 |
| siterank | siterank-yt54xvsg5q-an.a.run.app | API | ✅ | ✅ | 正常 |
| ssrgenlangclient0944935 | ssrgenlangclient0944935-yt54xvsg5q-an.a.run.app | 特殊 | ❌ | ❌ | 特殊服务 |

#### 服务目录（13个）

```
services/
├── adscenter/          ✅ 已注册
├── batchopen/          ✅ 已注册
├── billing/            ✅ 已注册
├── browser-exec/       ❌ 未注册 (有OpenAPI)
├── console/            ✅ 已注册
├── functions/          🔧 内部（dispatcher）
├── internal/           🔧 内部（auth）
├── notifications/      ❌ 未注册 (有OpenAPI, Frontend调用!)
├── offer/              ✅ 已注册
├── projector/          🔍 未知（无OpenAPI）
├── proxy-pool/         🔧 内部（无OpenAPI）
├── recommendations/    ❌ 未注册 (有OpenAPI)
└── siterank/           ✅ 已注册
```

---

### 2. Gateway已注册服务（6个）

**Gateway**: `autoads-gw` (生产环境)

| 服务 | API路径示例 | 端点数 |
|------|-----------|--------|
| adscenter | `/api/v1/adscenter/accounts` | 10+ |
| batchopen | `/api/v1/batchopen/tasks` | 5+ |
| billing | `/api/v1/billing/tokens/balance` | 8+ |
| console | `/api/v1/console/users` | 15+ |
| offer | `/api/v1/offers` | 5+ |
| siterank | `/api/v1/siterank/analyze` | 3+ |

**总计**: 约46个API端点已注册

---

### 3. 未注册但有OpenAPI的服务（3个）

#### 3.1 notifications 服务 ⚠️ **高优先级**

**状态**: ❌ Frontend正在调用，但未注册到Gateway

**OpenAPI路径**: `services/notifications/openapi.yaml`

**提供的API端点**:
- `GET /api/v1/notifications/recent` - 获取最近通知（Frontend正在使用）
- `POST /api/v1/notifications/read` - 标记通知为已读

**Frontend使用情况**:
```typescript
// apps/frontend/src/lib/notifications/hooks.ts
const endpoint = `/api/v1/notifications/recent?limit=${limit}`;
```

**影响**: 高 - 会导致Frontend调用失败

**建议**: 立即注册到Gateway

---

#### 3.2 browser-exec 服务

**状态**: ❌ 未注册到Gateway

**OpenAPI路径**: `services/browser-exec/openapi.yaml`

**提供的API端点**:
- `POST /api/v1/browser/parse-url` - 解析URL并提取hostname和brand
- `POST /api/v1/browser/check-availability` - 检查URL可用性

**核心功能**:
- 浏览器自动化服务
- 使用Playwright进行网页抓取
- 支持代理池和反检测

**Frontend使用情况**: 未发现直接调用

**影响**: 中 - 如果未来需要Frontend调用，需要注册

**建议**: 评估是否需要暴露给Frontend，如仅供后端服务间调用，可保持当前状态

---

#### 3.3 recommendations 服务

**状态**: ❌ 未注册到Gateway

**OpenAPI路径**: `services/recommendations/openapi.yaml`

**提供的API端点**:
- `POST /api/v1/recommend/keywords/brand-check` - 检查关键词品牌词风险
- `POST /api/v1/recommend/internal/offline/brand-audit` - 离线品牌审计

**核心功能**:
- 关键词推荐
- 品牌词风险检测
- BigQuery集成

**Frontend使用情况**: 未发现直接调用

**影响**: 中 - 如果未来需要Frontend调用，需要注册

**建议**: 评估是否需要暴露给Frontend

---

### 4. Worker服务（无需Gateway注册）

| 服务名 | 用途 | 说明 |
|--------|------|------|
| browser-exec-worker | 浏览器自动化任务队列 | 通过Pub/Sub触发，无需HTTP API |
| siterank-worker-preview | 网站评分Worker | 通过Pub/Sub触发，无需HTTP API |

**结论**: Worker服务通常通过消息队列（Pub/Sub）触发，不需要通过Gateway暴露HTTP API

---

### 5. 内部服务（无需Gateway注册）

| 服务目录 | 用途 | 说明 |
|---------|------|------|
| functions/dispatcher | 函数调度器 | 内部服务 |
| internal/auth | 认证服务 | 内部服务，Gateway使用Firebase Auth |
| proxy-pool | 代理IP池管理 | 内部服务，供其他服务调用 |

**结论**: 内部服务不需要通过Gateway暴露给Frontend

---

### 6. 未明确分类的服务

| 服务名 | 状态 | 建议 |
|--------|------|------|
| projector | 无OpenAPI规范 | 需确认服务用途和API端点 |
| ssrgenlangclient0944935 | 特殊服务 | 需确认用途 |

---

## 🔧 Frontend API调用分析

### 已注册且正常使用

| API路径 | 服务 | Frontend使用 |
|---------|------|-------------|
| `/api/v1/adscenter/*` | adscenter | ✅ AdsCenter功能 |
| `/api/v1/billing/*` | billing | ✅ Token管理 |
| `/api/v1/console/*` | console | ✅ 管理后台 |
| `/api/v1/offers/*` | offer | ✅ Offer管理 |
| `/api/v1/siterank/*` | siterank | ✅ 网站评分 |

### 调用但未注册 ⚠️

| API路径 | 服务 | Frontend位置 | 状态 |
|---------|------|-------------|------|
| `/api/v1/notifications/recent` | notifications | `src/lib/notifications/hooks.ts:11` | ❌ 会失败 |

---

## 📊 Gateway路由统计

### 生产Gateway (`autoads-gw`)

**总端点数**: 约46个

**按服务分类**:
```
adscenter:   10+ 端点
billing:      8+ 端点
console:     15+ 端点
offer:        5+ 端点
siterank:     3+ 端点
batchopen:    5+ 端点
```

**特殊端点**:
- 健康检查: `/api/health`, `/api/health/*`
- 就绪检查: `/readyz`

---

## ✅ 推荐行动计划

### 🔥 高优先级（立即执行）

#### 1. 注册notifications服务到Gateway

**理由**: Frontend正在调用，当前会返回404错误

**步骤**:

1. 确认notifications服务OpenAPI规范
```bash
cat services/notifications/openapi.yaml
```

2. 将OpenAPI规范添加到Gateway配置
```bash
# 方法1: 手动添加到 deployments/api-gateway/gateway.yaml
# 方法2: 使用merge-openapi.sh自动合并
bash scripts/gateway/merge-openapi.sh out/gateway-merged.yaml
```

3. 更新Gateway
```bash
bash scripts/gateway/sync-gateway.sh prod
```

4. 验证注册成功
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://autoads-gw-885pd7lz.an.gateway.dev/api/v1/notifications/recent?limit=5"
```

---

### 📋 中优先级（评估后执行）

#### 2. 评估browser-exec服务是否需要暴露给Frontend

**当前状态**:
- 有完整OpenAPI规范
- Frontend未直接调用
- 可能由后端服务（如offer、siterank）内部调用

**评估问题**:
- Frontend是否需要直接调用浏览器自动化功能？
- 还是仅作为后端服务间调用？

**如果需要暴露**:
```bash
# 添加到Gateway配置
# API路径: /api/v1/browser/parse-url, /api/v1/browser/check-availability
```

---

#### 3. 评估recommendations服务是否需要暴露给Frontend

**当前状态**:
- 有完整OpenAPI规范
- Frontend未直接调用
- 主要功能：关键词推荐、品牌词风险检测

**评估问题**:
- Frontend是否需要直接调用推荐服务？
- 还是通过adscenter服务间接调用？

**如果需要暴露**:
```bash
# 添加到Gateway配置
# API路径: /api/v1/recommend/keywords/brand-check
```

---

### 🔍 低优先级（长期优化）

#### 4. 明确projector服务的用途和API

**问题**:
- 无OpenAPI规范
- 不清楚服务提供的API端点
- 不清楚是否需要通过Gateway暴露

**行动**:
1. 查看projector服务代码
2. 确认服务用途
3. 如果提供HTTP API，添加OpenAPI规范
4. 评估是否需要注册到Gateway

---

#### 5. 清理ssrgenlangclient0944935特殊服务

**问题**: 服务名称不符合命名规范，用途不明

**建议**: 调查此服务用途，考虑重命名或下线

---

## 📈 Gateway覆盖率分析

### 当前覆盖情况

```
总API服务: 9个 (排除Worker和内部服务)
已注册: 6个
未注册: 3个

覆盖率: 66.7% (6/9)
```

### 目标覆盖率

如果注册notifications服务：
```
覆盖率: 77.8% (7/9)
```

如果注册所有应暴露的服务（notifications + browser-exec + recommendations）：
```
覆盖率: 100% (9/9)
```

---

## 🎯 最佳实践建议

### 1. API开发三步法（强制执行）

根据项目规范 (`docs/SupabaseGo/MustKnowV6.md:63-67`)：

```
1. 服务端实现：在 services/{service}/openapi.yaml 中定义OpenAPI规范
2. Frontend定义：在 apps/frontend/src/lib/api/endpoints.ts 中添加常量
3. Gateway自动生成：通过 merge-openapi.sh 自动生成Gateway配置
```

**当前问题**: notifications服务违反了这个流程
- ✅ 有OpenAPI规范
- ❌ Gateway未注册
- ❓ Frontend endpoints.ts未定义（但直接使用了字符串路径）

---

### 2. 统一服务注册流程

**建议建立以下流程**:

```bash
# 新服务上线检查清单
1. ✅ 创建 services/{service}/openapi.yaml
2. ✅ 运行 scripts/openapi/generate.sh 生成Frontend常量
3. ✅ 运行 scripts/gateway/merge-openapi.sh 合并到Gateway
4. ✅ 运行 scripts/gateway/sync-gateway.sh 部署Gateway
5. ✅ 测试API调用
```

---

### 3. CI/CD自动化检查

**建议添加CI检查**:

```yaml
# .github/workflows/check-api-registration.yml
- name: Check API Registration
  run: |
    # 检查所有有OpenAPI的服务是否在Gateway注册
    bash scripts/gateway/validate-registration.sh
```

---

### 4. Frontend API调用规范

**当前问题**: Frontend直接使用字符串路径

```typescript
// ❌ 不推荐
const endpoint = `/api/v1/notifications/recent?limit=${limit}`;

// ✅ 推荐
import { API_ENDPOINTS } from '~/lib/api/endpoints';
const endpoint = API_ENDPOINTS.NOTIFICATIONS.RECENT(limit);
```

**建议**: 统一使用 `API_ENDPOINTS` 常量，避免硬编码

---

## 📝 后续行动项

| 优先级 | 任务 | 负责人 | 预计时间 | 状态 |
|-------|------|--------|---------|------|
| 🔥 P0 | 注册notifications服务到Gateway | - | 30分钟 | 待执行 |
| 📋 P1 | 评估browser-exec是否需要暴露 | - | 1小时 | 待评估 |
| 📋 P1 | 评估recommendations是否需要暴露 | - | 1小时 | 待评估 |
| 🔍 P2 | 调查projector服务用途 | - | 2小时 | 待调查 |
| 🔍 P2 | 清理ssrgenlangclient0944935服务 | - | 1小时 | 待确认 |
| 📊 P3 | 建立Gateway注册CI检查 | - | 4小时 | 待规划 |
| 📊 P3 | 统一Frontend API调用规范 | - | 8小时 | 待规划 |

---

## 📌 附录：快速验证命令

### 检查服务列表

```bash
# 查看所有生产环境后端服务
gcloud run services list --region=asia-northeast1 \
  --format="table(metadata.name,status.url)" | grep -v preview

# 查看Gateway注册的服务
grep -o "https://[a-z-]*-yt54xvsg5q" \
  deployments/api-gateway/gateway.rendered.yaml | \
  sed 's|https://||' | sed 's|-yt54xvsg5q||' | sort -u
```

### 检查OpenAPI规范

```bash
# 列出所有有OpenAPI的服务
ls services/*/openapi.yaml

# 检查特定服务的API端点
yq '.paths | keys' services/notifications/openapi.yaml
```

### 测试Gateway端点

```bash
# 健康检查
curl "https://autoads-gw-885pd7lz.an.gateway.dev/api/health"

# 测试认证端点（需要Token）
curl -H "Authorization: Bearer $TOKEN" \
  "https://autoads-gw-885pd7lz.an.gateway.dev/api/v1/notifications/recent"
```

---

## 🎯 结论

**当前状态**: ⚠️ 不完整 - 需要立即修复

**关键问题**:
1. **紧急**: notifications服务未注册，导致Frontend调用失败
2. **重要**: browser-exec和recommendations服务有OpenAPI但未注册
3. **优化**: 部分服务用途不明确（projector, ssrgenlangclient0944935）

**预期改进效果**:
- ✅ 修复Frontend通知功能
- ✅ 提高Gateway覆盖率至100%
- ✅ 统一API管理流程
- ✅ 减少未来集成问题

**建议**: 立即执行P0任务，并在Sprint规划中安排P1-P3任务。

---

**报告生成时间**: 2025-10-15
**下次评估建议**: 每月或新服务上线时
