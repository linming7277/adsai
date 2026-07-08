# API开发规范指南

**版本**: 2.0
**更新日期**: 2025-10-15
**适用范围**: AdsAI全栈开发

---

## 📖 目录

1. [概述](#概述)
2. [API开发三步法](#api开发三步法)
3. [目录结构](#目录结构)
4. [开发流程](#开发流程)
5. [验证与测试](#验证与测试)
6. [常见问题](#常见问题)

---

## 概述

AdsAI采用**单一真实来源（Single Source of Truth）**的API设计理念：

- ✅ **唯一规范**: `specs/openapi/*.yaml` 是API定义的唯一权威来源
- ✅ **自动生成**: 所有代码、类型、配置均从OpenAPI规范自动生成
- ✅ **强制执行**: CI/CD流程确保不直接修改生成的文件

### 核心原则

1. **先设计，后实现** - OpenAPI优先
2. **自动化优先** - 减少手动维护
3. **类型安全** - TypeScript + Go严格类型
4. **一致性保障** - 自动验证工具

---

## API开发三步法

### 步骤1: 定义OpenAPI规范

**位置**: `specs/openapi/{service}.yaml`

```yaml
# specs/openapi/myservice.yaml
openapi: 3.0.3
info:
  title: My Service
  version: 1.0.0
paths:
  /api/v1/myservice/resource:
    get:
      operationId: getResource
      summary: Get a resource
      security:
        - bearerAuth: []
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  id: { type: string }
                  name: { type: string }
```

**设计要点**：
- 使用语义化的operationId
- 添加详细的description和summary
- 定义清晰的schema
- 明确security要求

### 步骤2: 生成代码

运行生成脚本：

```bash
# 从项目根目录执行
./scripts/openapi/generate.sh
```

**自动生成内容**：

1. **Go服务端Stubs** - `services/{service}/internal/oapi/`
   - `types.gen.go` - 数据结构
   - `server.gen.go` - 路由接口

2. **TypeScript类型定义** - `packages/shared-types/src/{service}/`
   - `types.d.ts` - 前端类型定义

3. **Frontend API端点** - `apps/frontend/src/lib/api/endpoints.ts`
   - 自动生成的API常量

**⚠️ 注意**: 生成的文件**不应手动修改**！

### 步骤3: Gateway自动配置

Gateway配置通过两个步骤完成：

#### 3.1 手动配置Gateway路由

**位置**: `deployments/api-gateway/gateway.yaml`

```yaml
paths:
  /api/v1/myservice/resource:
    get:
      operationId: getResource
      security: [ { firebase: [] } ]
      x-google-backend:
        address: https://myservice-REPLACE_WITH_RUN_URL
        path_translation: APPEND_PATH_TO_ADDRESS
      responses: { '200': { description: OK } }
```

#### 3.2 渲染Gateway配置

```bash
# 替换占位符为实际Cloud Run URL
./scripts/deploy/render-gateway.sh

# 部署Gateway
./scripts/deploy/gateway-deploy.sh
```

---

## 目录结构

```
adsai/
├── specs/
│   └── openapi/                    # 📋 单一真实来源
│       ├── billing.yaml
│       ├── offer.yaml
│       ├── adscenter.yaml
│       ├── console.yaml
│       └── ...
│
├── services/
│   ├── billing/
│   │   ├── internal/
│   │   │   └── oapi/              # 🤖 自动生成的Go stubs
│   │   │       ├── types.gen.go
│   │   │       └── server.gen.go
│   │   └── openapi.yaml           # 📄 只读镜像（CI强制检查）
│   │
│   └── {service}/
│       └── ...
│
├── apps/
│   └── frontend/
│       └── src/
│           └── lib/
│               └── api/
│                   └── endpoints.ts   # 🤖 自动生成的API常量
│
├── packages/
│   └── shared-types/
│       └── src/
│           ├── billing/           # 🤖 自动生成的TS类型
│           │   └── types.d.ts
│           └── {service}/
│               └── types.d.ts
│
├── deployments/
│   └── api-gateway/
│       ├── gateway.yaml           # 🔧 手动维护的Gateway配置
│       └── gateway.rendered.yaml  # 🤖 渲染后的配置
│
└── scripts/
    ├── openapi/
    │   ├── generate.sh            # 主生成脚本
    │   ├── generate-endpoints.sh  # Frontend端点生成
    │   ├── validate-api-consistency.sh  # 一致性验证
    │   ├── enforce-single-source.sh     # CI强制检查
    │   └── sync-mirrors.sh        # 同步镜像文件
    │
    └── deploy/
        ├── render-gateway.sh      # 渲染Gateway配置
        └── gateway-deploy.sh      # 部署Gateway
```

---

## 开发流程

### 新增API端点

```bash
# 1. 编辑OpenAPI规范
vim specs/openapi/myservice.yaml

# 2. 生成代码
./scripts/openapi/generate.sh

# 3. 实现Go handler
vim services/myservice/internal/handlers/my_handler.go

# 4. 更新Gateway配置
vim deployments/api-gateway/gateway.yaml

# 5. 验证一致性
./scripts/openapi/validate-api-consistency.sh

# 6. 提交代码
git add specs/openapi/myservice.yaml
git add services/myservice/internal/handlers/
git add deployments/api-gateway/gateway.yaml
git commit -m "feat(myservice): add new endpoint"
```

### 修改现有API

```bash
# 1. 修改OpenAPI规范
vim specs/openapi/myservice.yaml

# 2. 重新生成代码
./scripts/openapi/generate.sh

# 3. 更新handler实现（如需要）
vim services/myservice/internal/handlers/my_handler.go

# 4. 验证并提交
./scripts/openapi/validate-api-consistency.sh
git commit -am "feat(myservice): update endpoint schema"
```

### 前端调用API

```typescript
// apps/frontend/src/lib/myservice/hooks.ts
import { API_ENDPOINTS } from '~/lib/api/endpoints';
import { apiGet } from '~/lib/api';

// ✅ 使用自动生成的端点常量
export function useMyResource() {
  return useSWR(
    API_ENDPOINTS.MYSERVICE.RESOURCE,
    apiGet
  );
}

// ❌ 不要硬编码路径
// const url = '/api/v1/myservice/resource';  // 错误！
```

---

## 验证与测试

### 自动验证

```bash
# 验证OpenAPI规范语法
./scripts/openapi/validate.sh

# 验证API一致性（specs ↔ Gateway ↔ Frontend）
./scripts/openapi/validate-api-consistency.sh

# 检查单一来源强制执行
./scripts/openapi/enforce-single-source.sh
```

### CI/CD集成

在`.github/workflows/`中集成验证：

```yaml
- name: Validate OpenAPI Consistency
  run: |
    ./scripts/openapi/validate-api-consistency.sh
    ./scripts/openapi/enforce-single-source.sh
```

### 手动测试

```bash
# 测试Gateway健康检查
curl https://adsai-gw-preview-885pd7lz.an.gateway.dev/readyz

# 测试具体端点
curl -H "Authorization: Bearer $TOKEN" \
  https://adsai-gw-preview-885pd7lz.an.gateway.dev/api/v1/myservice/resource
```

---

## 常见问题

### Q1: 我应该修改哪些文件？

**✅ 可以修改**:
- `specs/openapi/*.yaml` - API规范
- `services/*/internal/handlers/*.go` - Handler实现
- `deployments/api-gateway/gateway.yaml` - Gateway配置

**❌ 禁止修改**:
- `services/*/internal/oapi/*.gen.go` - 自动生成的Go代码
- `packages/shared-types/src/*/types.d.ts` - 自动生成的TS类型
- `apps/frontend/src/lib/api/endpoints.ts` - 自动生成的端点常量
- `services/*/openapi.yaml` - 只读镜像

### Q2: 如何处理breaking changes?

1. **版本化API**: 使用`/api/v2/`新版本
2. **兼容性过渡**: 同时支持v1和v2一段时间
3. **文档说明**: 在OpenAPI中标注deprecated
4. **前端适配**: 逐步迁移前端调用

```yaml
# specs/openapi/myservice.yaml
/api/v1/old-endpoint:
  deprecated: true
  description: "⚠️ Deprecated: Use /api/v2/new-endpoint instead"

/api/v2/new-endpoint:
  description: "New improved endpoint"
```

### Q3: Gateway配置未生效怎么办？

```bash
# 1. 检查渲染后的配置
cat deployments/api-gateway/gateway.rendered.yaml

# 2. 重新渲染
./scripts/deploy/render-gateway.sh

# 3. 验证Gateway部署
gcloud api-gateway gateways describe adsai-gw-preview \
  --project=your-gcp-project-id \
  --location=asia-northeast1

# 4. 重新部署
./scripts/deploy/gateway-deploy.sh
```

### Q4: endpoints.ts与OpenAPI不一致

```bash
# 重新生成endpoints.ts
./scripts/openapi/generate-endpoints.sh

# 验证一致性
./scripts/openapi/validate-api-consistency.sh

# 如果还有问题，检查OpenAPI规范
vim specs/openapi/{service}.yaml
```

### Q5: 如何快速定位API定义？

```bash
# 查找API端点定义
grep -r "/api/v1/myservice/resource" specs/openapi/

# 查看具体服务的所有端点
grep -E '^\s+/api/v1/' specs/openapi/myservice.yaml

# 检查Gateway路由
grep -E '^\s+/api/v1/' deployments/api-gateway/gateway.yaml
```

---

## 最佳实践

### ✅ DO

1. **总是从OpenAPI开始** - 先设计API，再实现
2. **使用语义化命名** - operationId清晰表达意图
3. **添加详细注释** - description和summary完善
4. **定义完整schema** - 包括所有字段和验证规则
5. **运行验证脚本** - 提交前验证一致性
6. **使用生成的常量** - 避免硬编码路径

### ❌ DON'T

1. **不要手动修改生成的文件** - 会被覆盖
2. **不要硬编码API路径** - 使用endpoints.ts常量
3. **不要直接修改services/*/openapi.yaml** - 修改specs/目录
4. **不要跳过验证** - 可能导致不一致
5. **不要在Gateway中添加业务逻辑** - Gateway仅做路由
6. **不要混淆环境** - 确保preview/prod隔离

---

## 工具链

### 必需工具

```bash
# Go代码生成
go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest

# TypeScript类型生成
npm install -g openapi-typescript

# YAML验证
brew install yamllint
```

### 推荐工具

- **Swagger Editor**: https://editor.swagger.io/
- **Postman**: 导入OpenAPI规范进行测试
- **VS Code插件**: OpenAPI (Swagger) Editor

---

## 相关文档

- [Frontend环境配置](./frontend-environment-configuration-2025-10-15.md)
- [MustKnowV6.md](./SupabaseGo/MustKnowV6.md) - 项目架构总览
- [Monorepo构建最佳实践](./monorepo-build-best-practices.md)

---

## 支持与反馈

遇到问题？

1. 检查本文档的[常见问题](#常见问题)
2. 运行`./scripts/openapi/validate-api-consistency.sh`诊断
3. 查看相关脚本的注释和帮助信息
4. 联系团队技术负责人

---

**最后更新**: 2025-10-15
**维护者**: AdsAI Dev Team
