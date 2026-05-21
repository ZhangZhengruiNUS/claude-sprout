# Claude Sprout

Claude Sprout 是一个 Windows 优先的 Claude Code CLI 桌面伴随工具。它不是 Claude Code 的替代品，也不会自动替你批准权限。它读取 Claude Code hooks/statusline 写入的轻量本地状态文件，并通过托盘、置顶小宠物窗口、次级会话面板和 Windows 原生通知提示你及时介入。

MVP 目标是低空闲开销、本地优先，并在 Claude Code 需要人工输入或权限确认时给出足够明显的提醒。

## 功能

- 从本地 JSON snapshot 跟踪多个 Claude Code session。
- 显示 `idle`、`running`、`tool_running`、`waiting_permission`、`waiting_input`、`done`、`error`、`stale`、`probably_closed` 和 `closed`。
- 对 `waiting_permission` 使用更强提醒，对 `waiting_input` 使用较轻提醒，并对 `done` / `error` 发送系统通知。
- 会话面板展示 project name、cwd、session id、status、last event、last tool、heartbeat、context usage 和 update time。
- Tauri v2 托盘支持打开面板、刷新、设置、勿扰模式、打开数据目录和退出。
- Tauri 宠物窗口透明、无边框、置顶，并从任务栏隐藏。
- Windows PowerShell hook/statusline writer，另有 Node.js fallback 脚本。
- 本地状态目录为 `%USERPROFILE%\.claude-sprout`。
- Codex-compatible 自定义宠物导入，支持包含 `pet.json` 和 `spritesheet.webp` 的目录。
- Windows release 脚本支持 standalone exe 和 NSIS installer，并包含 release doctor 与 smoke 工具。

## 架构

```mermaid
flowchart LR
  A["Claude Code hooks / statusLine"] --> B["PowerShell 或 Node writer"]
  B --> C["%USERPROFILE%\\.claude-sprout\\sessions\\*.json"]
  B --> D["%USERPROFILE%\\.claude-sprout\\events\\*.jsonl"]
  C --> E["Tauri Rust session store"]
  D --> E
  E --> F["托盘"]
  E --> G["宠物窗口"]
  E --> H["会话面板"]
  E --> I["Windows 通知"]
```

## 数据目录

```text
%USERPROFILE%\.claude-sprout\
  sessions\
    <session_id>.json
  events\
    <session_id>.jsonl
  pets\
    <pet_id>\
      manifest.json
      spritesheet.webp
  settings.json
```

## 开发

要求：

- 推荐 Windows 11。
- Node.js 20+。
- 如需运行原生桌面端，需要 Rust stable 和 Tauri v2 前置依赖。
- 当前项目使用 `npm`。

运行 Web 预览：

```powershell
npm install
npm run dev
```

Vite 页面只是开发预览。真正的桌面形态是 Tauri 的 `pet` 窗口：一个透明、无边框、悬浮在其他应用之上的轻量组件。完整会话面板是次级窗口，通过点击宠物或托盘打开。

安装 Rust 后运行 Tauri：

```powershell
npm run tauri:dev
```

构建前端：

```powershell
npm run build
```

构建官方 Windows 发布产物：

```powershell
npm run release:exe
npm run release:nsis
```

创建 tag 前请先查看 [docs/release-checklist.md](docs/release-checklist.md)。

## Claude Code Hooks / Statusline

Claude Code command hooks 会从 stdin 接收 JSON。Claude Code status line 同样从 stdin 接收 JSON，并通过 `~/.claude/settings.json` 中的 `statusLine` 配置。

可以参考 [hooks/windows/claude-settings.example.json](hooks/windows/claude-settings.example.json)。使用时把 `C:/path/to/claude-sprout` 替换成当前仓库路径，建议使用正斜杠路径。

不要直接覆盖已有的 `~/.claude/settings.json`。请先备份，再有意识地合并 `hooks` 和 `statusLine` 配置。

## Codex-Compatible Pet Importer

Claude Sprout 会扫描：

- `%USERPROFILE%\.codex\pets`
- 设置了 `CODEX_HOME` 时的 `%CODEX_HOME%\pets`

导入包结构：

```text
<pet-id>/
  pet.json
  spritesheet.webp
```

导入后会复制到 `%USERPROFILE%\.claude-sprout\pets`，不会长期引用 Codex 原目录。首个 atlas profile 是 `codex-8x9`。

Claude Sprout 不内置、复制或分发 Codex 官方宠物素材。请只导入你拥有或有权使用的自定义宠物包。Codex 是 OpenAI 的产品名称；本项目不是 OpenAI 官方项目。

## 隐私

Claude Sprout 默认本地优先：

- 默认不做网络同步。
- 默认不采集完整 prompt/output。
- 不远程执行命令。
- 不自动批准 Claude Code 权限。
- session metadata 默认只保存在 `%USERPROFILE%\.claude-sprout`。

详见 [docs/privacy.md](docs/privacy.md)。

## 免责声明

Claude Sprout 是独立开源项目，不隶属于 Anthropic、Claude Code、OpenAI 或 Codex。

## Roadmap

- 用带 debounce 的文件监听替代 UI 轮询。
- 准备并发布第一个 Windows tag release。
- 增加签名发布流程。
- 增加 GitHub Actions release builds。
- 增加可选 wrapper/PID 增强，用于更准确的进程级关闭检测。

## License

MIT
