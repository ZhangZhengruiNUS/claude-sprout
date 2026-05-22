# Claude Code Hooks and Statusline

Claude Sprout uses command hooks for event semantics and statusline for heartbeat.

## Why Both

- Hooks tell us what happened: tool started, permission requested, task stopped, session ended.
- Statusline tells us the session is still alive even when no hook-worthy event fires.
- The app derives `stale` and `probably_closed` when heartbeat stops without `SessionEnd`.

## Windows Settings Patch

See:

```text
hooks/windows/claude-settings.example.json
```

Replace `C:/path/to/claude-sprout` with this repository path. Keep the script path quoted and use forward slashes so paths with spaces work whether Claude Code routes through Git Bash or PowerShell.

Back up existing settings first:

```powershell
Copy-Item "$env:USERPROFILE\.claude\settings.json" "$env:USERPROFILE\.claude\settings.json.bak"
```

Then merge the `hooks` and `statusLine` sections manually.

## Troubleshooting Empty Sessions

The app does not query Claude Code for live sessions. It only reads snapshot files written by the hook and statusline writers.

If the panel is empty after starting Claude Code:

1. Confirm Claude Code's active settings file contains the Claude Sprout `hooks` and `statusLine` sections. If `CLAUDE_CONFIG_DIR` is set, Claude Code reads `<CLAUDE_CONFIG_DIR>\settings.json`; otherwise check `~\.claude\settings.json`.
2. Confirm every command path has replaced `C:/path/to/claude-sprout` with this checkout path, for example `"E:/Codex Project/claude-sprout/hooks/windows/claude-sprout-hook.ps1"`. Keep quotes around the `.ps1` path when the checkout path contains spaces.
3. Start a new Claude Code session after saving the settings file.
4. Confirm snapshot files appear under `%USERPROFILE%\.claude-sprout\sessions\*.json`.
5. If `CLAUDE_SPROUT_HOME` is set for Claude Code or the app, confirm both processes point at the same directory.

Refreshing the panel only reloads existing snapshot files, so it cannot discover a terminal session until Claude Code has written at least one snapshot.

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

`waiting_input` means Claude Code is back at the prompt and ready for the user's next message. Claude Sprout treats this as a weak reminder: it is visible in session UI, but does not trigger a native notification or strong pet intervention. `waiting_permission` remains the strong actionable waiting state.

The writer exits quickly, avoids network access, and writes only lightweight metadata.
Terminal hook events preserve `ended_at` across later statusline heartbeats so the app can distinguish active sessions from sessions that already stopped.
