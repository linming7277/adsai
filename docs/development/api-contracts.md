# 契约先行与生成（OpenAPI First）

本项目将 `.kiro/specs/addictive-ads-management-system/openapi/*.yaml` 作为 API 的单一事实来源（Single Source of Truth）。所有服务的 API 变更必须首先修改该目录下的 OpenAPI 规范，然后通过脚本生成各语言产物与服务端 stubs。

## 目录
- 规范源：`.kiro/specs/addictive-ads-management-system/openapi/*.yaml`
- 服务镜像：`services/*/openapi.yaml`（仅镜像，禁止手改）

## 常用脚本
- 校验+最小生成（CI 同步使用）
  - `scripts/openapi/ci-check.sh`
- 全量生成（Go stubs + 前端 TS 类型）
  - `scripts/openapi/generate.sh`
- 仅 Go stubs（可指定服务）
  - `scripts/openapi/gen-go-stubs.sh [service ...]`
- 仅 TS 类型（已集成在 generate.sh 中）
  - `scripts/openapi/gen-ts-sdk.sh`
- 镜像一致性检查（非阻断）
  - `scripts/openapi/check-mirrors.sh`
- 同步镜像（便于本地查阅）
  - `scripts/openapi/sync-mirrors.sh [service ...]`

## CI 保护
- OpenAPI CI 与 Contract 工作流中启用了“单一事实来源”检查：
  - 若 PR 修改了 `services/*/openapi.yaml` 将直接失败，请改为修改 `.kiro/specs/.../openapi/*.yaml` 并重新生成。
  - 镜像检查仅做警告，帮助开发者发现镜像与上游规范的差异。

## Gateway 发布
- API Gateway 的渲染与发布在 `deploy-gateway.yml` 中实现。
  - 渲染完成后执行 `scripts/gateway/validate-rendered.sh` 校验占位符、Firebase issuer、x-google-backend 等配置是否正确。

## 推荐流程（本地）
1. 修改 `.kiro/specs/.../openapi/*.yaml`
2. 运行 `bash scripts/openapi/generate.sh`
3. 本地编译/运行服务，验证路由行为（优先使用 chi-server + oasImpl 适配）
4. 可选：`bash scripts/openapi/check-mirrors.sh` 查看镜像差异，必要时用 `sync-mirrors.sh` 同步镜像文件以便查阅

