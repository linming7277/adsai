# CI 覆盖率门禁配置（阶段三任务 10.2）

**日期**: 2025-10-09  
**执行人**: Codex 助手

---

## 实施内容

- 更新 `.github/workflows/tests.yml`：
  - `go test ./... -coverprofile=coverage.out` 并调用 `go tool cover` 解析总覆盖率。
  - 设定 `COVERAGE_THRESHOLD=60`，若低于阈值则失败并打印当前覆盖率。
  - 覆盖率报告通过 `actions/upload-artifact` 上传，便于后续聚合。

## 注意事项

- 覆盖率阈值可通过环境变量调整。
- Node 工作区暂未强制覆盖率门禁，后续可根据测试框架扩展。

---

**相关文件**
- `.github/workflows/tests.yml`
