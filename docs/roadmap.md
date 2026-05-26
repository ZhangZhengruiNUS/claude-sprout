# Roadmap

## Done

- Tauri v2 app shell with tray.
- Session panel reading local snapshots.
- PowerShell hook/statusline writer.
- Strong `waiting_permission` reminder.
- Low-frequency pet animation.
- Stale/probably_closed TTL.
- Codex-compatible pet scan/import workflow.
- Native notification policy with do-not-disturb.
- Pet window drag, resize, lock-position, and always-on-top settings.
- Pet preview and apply workflow.
- Settings persistence.
- Data cleanup UI.
- Release doctor and controlled session smoke scripts.
- Terminal hook state preservation for more accurate closed-session detection.
- Standalone release exe, NSIS installer, and optional MSI build scripts.
- Product identity migrated to Agent Desktop Companion, with Glint as the built-in desktop pet and visual mascot.
- New default data root and canonical hooks under `agent-desktop-companion`, with legacy Claude Sprout data and hook compatibility retained.

## Next

- File watcher with debounce.
- Acceptance-test the Glint assets in the release exe: taskbar/Alt-Tab icon, tray icon, built-in pet preview, Message mode, and Board mode.
- Manually rename the GitHub repository to `agent-desktop-companion` when ready; the remote URL is intentionally not changed by the code migration.
- Prepare and publish the first tagged Windows release.

## Later

- Optional wrapper/PID enhancement for process-level closed detection.
- Signed release flow.
- GitHub Actions release builds.
- API and skill management once the pet-first companion workflow is stable.
