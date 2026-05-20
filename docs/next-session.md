# Next Session Handoff

Updated: 2026-05-20 13:35 Asia/Shanghai

## Current State

Claude Sprout is initialized as a public GitHub repository:

- Local path: `E:\Codex Project\claude-sprout`
- GitHub: `https://github.com/ZhangZhengruiNUS/claude-sprout`
- Branch: `main`
- Latest commit before this handoff: `8326a6a feat: add interactive resizable pet window`

The app is a Tauri v2 + React + TypeScript + Rust desktop companion for Claude Code. The intended primary surface is a transparent, frameless, always-on-top pet window. The full session panel is secondary and opens from the pet/tray.

## Implemented So Far

- React/Vite frontend scaffold.
- Tauri v2 Rust backend scaffold.
- Tray skeleton.
- Main session panel with mock sessions.
- PowerShell and Node hook/statusline writers.
- Local session state model and stale/probably_closed TTL tests.
- Codex-compatible pet importer Rust skeleton.
- Tauri release exe build support.
- Interactive pet window:
  - single-click opens session panel
  - drag moves the pet window
  - wheel resizes the pet
  - right-click enlarges one step
  - double-click plays a wave animation
  - pet scale persists in `localStorage`
  - pet window has transparent background and `shadow: false`

## Verification Commands

Known passing commands:

```powershell
npm run lint
npm run build
cargo test --manifest-path src-tauri\Cargo.toml
npm run tauri -- build --no-bundle
```

Run the desktop exe:

```powershell
.\src-tauri\target\release\claude-sprout.exe
```

Run the dev preview:

```powershell
npm run dev
```

Pet preview route:

```text
http://127.0.0.1:5173/?window=pet
```

## Known Blockers

- Full MSI bundling with `npm run tauri:build` fails at WiX download/install on this machine:
  - Tauri auto-download of WiX hit TLS `UnknownIssuer`.
  - `winget install WiXToolset.WiXToolset` requires admin rights to enable `NetFx3`.
- `--no-bundle` desktop exe build works.

## Next Tasks

1. Improve pet-window polish:
   - verify whether the transparent "square" is gone on the user's desktop
   - if still visible, shrink the window to the pet content bounds or investigate native region/hit-test masking
   - add explicit small/medium/large size controls in Settings
2. Improve Codex-like pet behavior:
   - add idle/wave/run/jump/failed/review animation controller
   - support imported `codex-8x9` spritesheets in the pet window
   - add pet preview/apply UI
3. Wire real session refresh:
   - file watcher with debounce
   - native notifications for waiting_permission/waiting_input/done/error
   - tray menu actions for refresh/open data/settings
4. Add settings persistence:
   - do-not-disturb
   - always-on-top
   - pet scale
   - lock position
5. Improve installer path:
   - document WiX prerequisite
   - optionally add NSIS target if it avoids the current WiX blocker

## Important Decisions

- Do not make the product a browser-style dashboard. The pet window is the first-class UI.
- Do not auto-approve Claude Code permission prompts.
- Keep prompts/outputs out of stored state by default.
- PowerShell hook writer is the default for Windows.
- Node hook writer remains a fallback.
- Imported Codex-compatible pet assets are copied into Claude Sprout app data; do not reference or distribute official Codex assets.
