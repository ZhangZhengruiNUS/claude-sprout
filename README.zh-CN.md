# Claude Sprout

Claude Sprout 是一个 Windows 优先的 Claude Code CLI 桌面伴随工具。它不是 Claude Code 的替代品，也不会自动替你批准权限。它读取 Claude Code hooks/statusline 写入的轻量本地状态文件，并通过托盘、置顶小宠物窗口、次级会话面板和 Windows 原生通知提示你及时介入。

MVP 目标是低空闲开销、本地优先，并在 Claude Code 需要人工输入或权限确认时给出足够明显的提醒。

## 功能

- 从本地 JSON snapshot 跟踪多个 Claude Code session。
- 显示 `idle`、`running`、`tool_running`、`waiting_permission`、`waiting_input`、`done`、`error`、`stale`、`probably_closed` 和 `closed`。
- 消息模式只在授权、完成、失败时介入；看板模式长期显示多会话状态。
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

可以参考 [hooks/windows/claude-settings.example.json](hooks/windows/claude-settings.example.json)。使用时把 `C:/path/to/claude-sprout` 替换成当前仓库路径，建议使用正斜杠路径；如果仓库路径包含空格，请保留 `.ps1` 路径外层的引号。

不要直接覆盖已有配置。如果设置了 `CLAUDE_CONFIG_DIR`，Claude Code 会读取 `<CLAUDE_CONFIG_DIR>\settings.json`；否则读取 `~/.claude/settings.json`。请先备份，再有意识地合并 `hooks` 和 `statusLine` 配置。

## 会话状态和宠物模式

从 Claude Code 用户的实际使用视角看，Claude Sprout 关注两个已经配置到 Claude Code 里的集成点：

- Command hooks 会在 Claude Code 发生明确事件时运行：会话开始、你提交 prompt、工具开始或结束、Claude Code 请求权限、本轮停止、失败、会话结束等。Windows 默认 writer 是 [hooks/windows/claude-sprout-hook.ps1](hooks/windows/claude-sprout-hook.ps1)；[hooks/node/claude-sprout-hook.js](hooks/node/claude-sprout-hook.js) 是 fallback。
- Statusline writer 会在 Claude Code 存活并刷新状态行时反复运行。它刷新 heartbeat、context 百分比、会话显示名，并保留最新状态。Claude Sprout 依靠这个 heartbeat 判断一个安静会话是真的还活着，还是已经很久没有更新。

Claude Sprout 不会向 Claude Code 查询“当前有哪些会话”。它只读取 `%USERPROFILE%\.claude-sprout\sessions` 下的本地 snapshot。

| 用户看到的时刻 | Claude Code 信号 | 存储状态 | 含义 | 消息模式 | 看板模式 / 会话面板 | 通知和宠物表现 |
|---|---|---|---|---|---|---|
| Claude Code 会话刚启动 | `SessionStart` | `idle` | 会话存在，但当前没有进行中的工作。 | 不弹卡片。 | 显示为安静会话。 | 不发通知；宠物 idle。 |
| 你提交了 prompt | `UserPromptSubmit` | `running` | Claude Code 已接受请求，正在处理。 | 不弹卡片。 | 显示为运行中。 | 不发通知；宠物 running。 |
| Claude Code 开始调用工具 | `PreToolUse` | `tool_running` | 工具即将运行或正在运行。 | 不弹卡片。 | 显示为工具运行中，有工具名时会展示。 | 不发通知；宠物 running。 |
| 工具结束，Claude 继续思考/回复 | `PostToolUse` | `running` | 工具已返回，Claude 继续本轮任务。 | 不弹卡片。 | 显示为运行中。 | 不发通知；宠物保持 running。 |
| Claude Code 请求权限 | `PermissionRequest` 或 `Notification: permission_prompt` | `waiting_permission` | 需要用户审批，任务才能继续。 | 弹介入卡片，直到手动确认。 | 最高优先级卡片。 | 勿扰关闭时发原生通知；宠物先挥手一次，再进入 waiting。 |
| Claude Code 回到提示符，可能等你继续输入 | `Notification: idle_prompt` | `waiting_input` | 弱信号，表示可能在等待回复；实践中这个判断可能偏吵。 | 不弹卡片。 | 作为低优先级弱状态显示。 | 不发原生通知，不计入待介入数量，不触发 waiting 动画；宠物 idle。 |
| Claude Code 干净停止本轮响应/任务 | `Stop` | `done` | 当前响应/任务完成。同一个会话后续提交新 prompt 后仍可回到 `running`。 | 弹完成卡片。按设置里的完成卡片秒数自动消失；设为 `0` 时保留到手动确认。 | 显示为已完成，直到 snapshot 被清理或状态变化。 | 勿扰关闭时发原生通知；宠物跳一下，然后回到 idle。 |
| 工具或本轮任务失败 | `PostToolUseFailure` 或 `StopFailure` | `error` | 当前任务失败，或 Claude Code 报告停止失败。 | 弹失败卡片，直到手动确认。 | 高优先级失败卡片。 | 勿扰关闭时发原生通知；宠物播放一次失败动作，并在该状态最高优先级时保持 failed。 |
| Claude Code 明确结束会话 | `SessionEnd` | `closed` | 终端会话已结束。 | 不弹卡片。 | 不在宠物看板显示；完整会话面板仍可看到。 | 不发通知；除非还有其他更高优先级会话，否则宠物 idle。 |
| 超过 2 分钟没有 heartbeat | 应用派生 | `stale` | 对非终态、非强介入状态，Claude Sprout 没看到近期 statusline heartbeat。 | 不弹卡片。 | 低优先级显示为已过期。 | 不发通知；宠物 idle。 |
| 超过 10 分钟没有 heartbeat | 应用派生 | `probably_closed` | 会话可能没有干净发出 `SessionEnd` 就关闭了。 | 不弹卡片。 | 低优先级显示为可能已关闭。 | 不发通知；宠物 idle。 |

强状态和终态在读取 snapshot 时会被保留：`waiting_permission`、`done`、`error`、`closed` 不会因为时间久就自动变成 `stale` 或 `probably_closed`。

消息模式是低打扰模式。它保持宠物窗口紧凑，只为 `waiting_permission`、`done`、`error` 显示富信息消息卡。每张卡片都会包含会话身份、细节行和元数据，方便你判断是哪一个 Claude Code 会话需要处理。如果在设置里开启了对话预览，消息卡可以显示一段受限的 transcript 片段；关闭时只显示元数据。

消息卡片生命周期：

- `waiting_permission`：保留到你手动确认，或会话状态变化。
- `error`：保留到你手动确认，或会话状态变化。
- `done`：按设置里的完成卡片秒数显示；设为 `0` 表示保留到手动确认。
- `waiting_input`、`running`、`tool_running`、`idle`、`stale`、`probably_closed`、`closed`：永远不生成消息卡。

看板模式是长期概览模式。它在宠物窗口里持续显示配置数量内的未关闭会话；超过数量时显示翻页控件。卡片按紧急程度排序：授权、错误、工具运行中、运行中、已完成、弱输入等待、已过期、可能已关闭、空闲。点击卡片会打开完整会话面板。

维护提醒：如果后续修改 hook 映射、状态派生、通知策略、消息/看板行为，请在同一次变更里同步更新本节和 [README.md](README.md)。

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
