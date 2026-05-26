# Claude Code Hooks and Statusline

Agent Desktop Companion uses command hooks for event semantics and statusline for heartbeat. The current integration targets Claude Code, while the app identity and local data root use the broader Agent Desktop Companion naming.

## Why Both

- Hooks tell us what happened: tool started, permission requested, task stopped, session ended.
- Statusline tells us the session is still alive even when no hook-worthy event fires.
- The app derives `stale` and `probably_closed` when heartbeat stops without `SessionEnd`.

## Windows Settings Patch

See:

```text
hooks/windows/claude-settings.example.json
```

Replace `C:/path/to/agent-desktop-companion` with this repository path. Keep the script path quoted and use forward slashes so paths with spaces work whether Claude Code routes through Git Bash or PowerShell.

Back up existing settings first:

```powershell
Copy-Item "$env:USERPROFILE\.claude\settings.json" "$env:USERPROFILE\.claude\settings.json.bak"
```

Then merge the `hooks` and `statusLine` sections manually.

## Troubleshooting Empty Sessions

The app does not query Claude Code for live sessions. It only reads snapshot files written by the hook and statusline writers.

If the panel is empty after starting Claude Code:

1. Confirm Claude Code's active settings file contains the Agent Desktop Companion `hooks` and `statusLine` sections. If `CLAUDE_CONFIG_DIR` is set, Claude Code reads `<CLAUDE_CONFIG_DIR>\settings.json`; otherwise check `~\.claude\settings.json`.
2. Confirm every command path has replaced `C:/path/to/agent-desktop-companion` with this checkout path, for example `"E:/Codex Project/agent-desktop-companion/hooks/windows/agent-desktop-companion-hook.ps1"`. Keep quotes around the `.ps1` path when the checkout path contains spaces.
3. Start a new Claude Code session after saving the settings file.
4. Confirm snapshot files appear under `%USERPROFILE%\.agent-desktop-companion\sessions\*.json`.
5. If `AGENT_DESKTOP_COMPANION_HOME` or legacy `CLAUDE_SPROUT_HOME` is set for Claude Code or the app, confirm both processes point at the same directory.

Refreshing the panel only reloads existing snapshot files, so it cannot discover a terminal session until Claude Code has written at least one snapshot.

Legacy `claude-sprout-*` hook files are retained as wrappers for one release cycle. Existing Claude Code settings can continue to work, but new settings should point at the `agent-desktop-companion-*` scripts.

## Captured Events

- `SessionStart` -> `idle`
- `UserPromptSubmit` -> `running`
- `PreToolUse` -> `tool_running`
- `PostToolUse` -> `running`
- `PostToolUseFailure` -> `error`
- `PermissionRequest` -> `waiting_permission`
- `Notification: permission_prompt` -> `waiting_permission`
- `Notification: idle_prompt` -> `waiting_input`
- `Stop` -> `done`
- `StopFailure` -> `error`
- `SessionEnd` -> `closed`

`waiting_input` means Claude Code is back at the prompt and ready for the user's next message. Agent Desktop Companion treats this as a weak reminder: it is visible in session UI, but does not trigger a native notification or strong Glint intervention. `waiting_permission` remains the strong actionable waiting state.

The writer exits quickly, avoids network access, and writes only lightweight metadata.
Terminal hook events preserve `ended_at` across later statusline heartbeats so the app can distinguish active sessions from sessions that already stopped.
