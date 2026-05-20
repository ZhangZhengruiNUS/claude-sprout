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
