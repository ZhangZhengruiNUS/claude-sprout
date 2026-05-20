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

Replace `C:/path/to/claude-sprout` with this repository path. Use forward slashes so the command works whether Claude Code routes through Git Bash or PowerShell.

Back up existing settings first:

```powershell
Copy-Item "$env:USERPROFILE\.claude\settings.json" "$env:USERPROFILE\.claude\settings.json.bak"
```

Then merge the `hooks` and `statusLine` sections manually.

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

The writer exits quickly, avoids network access, and writes only lightweight metadata.
Terminal hook events preserve `ended_at` across later statusline heartbeats so the app can distinguish active sessions from sessions that already stopped.
