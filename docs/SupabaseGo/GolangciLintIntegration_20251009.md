# golangci-lint 集成（阶段三任务 10.3）

**日期**: 2025-10-09  
**执行人**: Codex 助手

---

## 实施内容

- 在 `.github/workflows/code-quality.yml` 新增 `golangci-lint` Job：
  - 使用 `actions/setup-go@v4` 安装 Go 1.25.1。
  - 通过 `golangci/golangci-lint-action@v6` 执行 `golangci-lint`，超时 5 分钟。
  - 与前端质量检查并行运行，确保 Go 代码在 PR 上保持规范。

## 注意事项

- 依赖于仓库已有的 `golangci-lint` 配置（若需自定义，可在根目录添加 `.golangci.yml`）。
- 若 lint 出现失败，会阻断 Pull Request 合并，提示开发者修复。

---

**相关文件**
- `.github/workflows/code-quality.yml`
