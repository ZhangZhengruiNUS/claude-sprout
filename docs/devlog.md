# Development Log

## 2026-05-20

- Initialized `claude-sprout` as a Tauri v2 + React + TypeScript + Rust project.
- Added English and Chinese README files plus architecture, hooks, privacy, roadmap, Windows install, and Codex-compatible pet importer docs.
- Created PowerShell and Node hook/statusline writer scripts.
- Added local session snapshot model and stale/probably_closed TTL logic.
- Created GitHub public repository: `https://github.com/ZhangZhengruiNUS/claude-sprout`.
- Changed the primary product surface from a panel-first app to a pet-first desktop companion:
  - `main` window starts hidden.
  - `pet` window starts visible, transparent, frameless, always-on-top, and taskbar-hidden.
- Installed Rust/Cargo locally through `winget install Rustlang.Rustup`.
- Confirmed Tauri release exe builds with `npm run tauri -- build --no-bundle`.
- Added an app icon and committed `src-tauri/Cargo.lock`.
- Added interactive pet behavior:
  - drag to move
  - wheel to resize
  - right-click to enlarge
  - double-click to play wave animation
  - click to open session panel
  - `shadow: false` to reduce transparent-window square artifacts
- Added this project continuity system:
  - `AGENTS.md` for automatic startup instructions
  - `docs/next-session.md` for short handoff
  - `docs/devlog.md` for chronological project tracking
- Added a more reliable handoff update mechanism:
  - `docs/handoff-state.json` stores handoff source data
  - `scripts/update-handoff.mjs` regenerates `docs/next-session.md`
  - `scripts/install-dev-hooks.ps1` installs a local git pre-commit hook that refreshes and stages the handoff before commits
- Fixed pet-window movement after user desktop testing:
  - transparent square artifact is confirmed gone
  - replaced delayed native `startDragging()` with manual pointer tracking plus Tauri `setPosition`
  - added explicit Tauri window permissions for pet position and size updates
- Added settings persistence and pet controls:
  - settings now persist to `%USERPROFILE%\.claude-sprout\settings.json`
  - Settings includes do-not-disturb, always-on-top, small/medium/large pet size, and lock-position controls
  - Settings changes sync to the live pet window through Tauri events
  - added Vitest coverage for frontend settings schema and Rust coverage for app-data settings storage
