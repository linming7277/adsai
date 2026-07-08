# 预发域 UI/E2E 测试（chrome-devtools-mcp）

本指南说明如何在本地使用 chrome-devtools-mcp 驱动真实 Chrome，执行 www.urlchecker.dev 的 UI/E2E 流程，覆盖 FeatureTest.md 中的 U1–U8 及前端触发链路。

## 先决条件
- Node.js ≥ 22.12
- 本机安装 Chrome（或自行提供 `PUPPETEER_EXECUTABLE_PATH` 指向 Chromium/Chrome 可执行文件）
- gcloud 已登录或不需要（仅 UI 测试无需 gcloud）

## 启动 MCP Server（推荐）

方式A：npx 直接运行（自动使用系统 Chrome；如未找到需设置 `PUPPETEER_EXECUTABLE_PATH`）

```
# 开启无头模式（建议CI）
npx chrome-devtools-mcp@latest --headless
```

方式B：指定浏览器调试端口（连接已启动的 Chrome）

```
# 先启动 Chrome 并开启调试端口
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-mcp \
  --headless=new

# 连接到该实例
npx chrome-devtools-mcp@latest --browserUrl http://127.0.0.1:9222
```

> 若系统未安装 Chrome，可临时安装 `puppeteer`（包含 Chromium）并导出路径：
>
> ```
> export PUPPETEER_EXECUTABLE_PATH=$(node -e "console.log(require('puppeteer').executablePath())")
> npx chrome-devtools-mcp@latest --headless
> ```

## 在 MCP 客户端中添加 Server

- Codex CLI（示例）：
```
codex mcp add chrome-devtools -- npx chrome-devtools-mcp@latest
```

- Claude Code / Cursor / Gemini CLI / VS Code Copilot：参见 chrome-devtools-mcp README 中的“Getting started”配置片段，将 `command` 与 `args` 配置为 `npx chrome-devtools-mcp@latest`。

## 场景建议（示例）

- U1：
  - 打开 https://www.urlchecker.dev 并截屏
  - 导航 /about，校验标题与可见元素
  - 触发登录页，若使用 NextAuth，记录回调 URL 与请求参数

- U2/U4–U8：
  - 使用管理员白名单邮箱登录后台（或注入已有会话），进入仪表盘
  - 执行用户/套餐/Token/风险/动态配置操作，截图与 HAR 记录

- F2/F3/F5/F8（前端触发侧）：
  - 跳转到评估/仿真/批量/诊断页面，执行操作并在页面查看进度/结果
  - 后端链路通过 Cloud Run 与日志/事件验证

## 工件留存
- 截图：take_screenshot
- 网络：list_network_requests / get_network_request（或 HAR）
- 性能：performance_start_trace / stop_trace / analyze_insight

## 注意
- Google OAuth 可能受 2FA/风控限制；建议使用测试账号，或通过注入已登录会话简化流程。
- 代理/地域要求可在系统网络或 Chrome 启动参数层面配置（亦可结合后端代理链路验证）。

