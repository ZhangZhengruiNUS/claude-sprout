# Privacy

Claude Sprout is local-first.

## What It Stores

- Session id.
- Project name and cwd.
- Current status.
- Last hook event.
- Last tool name when provided by Claude Code.
- Context usage percentage when provided by statusline.
- Heartbeat and update timestamps.
- Imported pet manifests and copied sprite files.

## What It Does Not Store By Default

- Full prompts.
- Full model output.
- Project file contents.
- Secrets.
- Network telemetry.

## What It Does Not Do

- It does not auto-approve Claude Code permissions.
- It does not bypass Claude Code permission prompts.
- It does not upload session data.
- It does not expose an HTTP or WebSocket server by default.

## Reset

Delete this directory to reset local app data:

```text
%USERPROFILE%\.claude-sprout
```
