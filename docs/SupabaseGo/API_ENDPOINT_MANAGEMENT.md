# API端点统一管理规范

**规范**: 任何新增或修改API端点时，必须先在`apps/frontend/src/lib/api/endpoints.ts`中定义常量，再在`deployments/gateway/gateway.v2.yaml`中配置Gateway路由，最后在代码中使用`API_ENDPOINTS`常量而非硬编码字符串，违规代码在Code Review时直接拒绝。
