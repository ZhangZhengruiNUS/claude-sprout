# Windows Install

## Development Prerequisites

1. Install Node.js 20 or newer.
2. Install Rust stable with `rustup`.
3. Install the Tauri v2 Windows prerequisites from the official Tauri guide.
4. Clone this repository.

## Run

```powershell
npm install
npm run tauri:dev
```

If Rust is not available yet, run the frontend preview only:

```powershell
npm run dev
```

## Build

Official Windows release artifacts are:

- standalone release executable, built with `npm run release:exe`
- NSIS installer, built with `npm run release:nsis`

Use [docs/release-checklist.md](release-checklist.md) for the first tagged release checklist and artifact publication steps.

MSI packaging is kept as an optional maintainer build for enterprise-style distribution checks. It is validated when WiX is available, but it is not required for the normal release path.

Build the release executable without creating an installer:

```powershell
npm run release:exe
```

The executable is written to:

```text
src-tauri\target\release\agent-desktop-companion.exe
```

Build the default Windows installer:

```powershell
npm run release:nsis
```

The Tauri config uses the NSIS target by default so normal installer work does not also request MSI output.
Installer tools are cached under the project target directory (`src-tauri\target\.tauri`) so failed downloads and pre-cached tools are easier to inspect on Windows.

Check the local installer tool cache:

```powershell
npm run release:doctor
```

If the machine cannot download Tauri's installer tools because the Windows SChannel path fails with `UnknownIssuer`, `SEC_E_NO_CREDENTIALS`, or a closed TLS connection, pre-cache the official NSIS release tools with Node's HTTPS stack:

```powershell
npm run release:precache-tools -- --target nsis
npm run release:doctor
```

The script downloads the fixed tool archives, verifies hashes, and writes the local Tauri cache under:

```text
src-tauri\target\.tauri\NSIS
```

Limit the pre-cache to one installer family when needed:

```powershell
npm run release:precache-tools -- --target nsis
npm run release:precache-tools -- --target wix
```

Use `npm run release:precache-tools` without a target only when you intentionally want both NSIS and WiX caches.

Reference downloads and expected hashes are printed by `npm run release:doctor`. The current fixed inputs are:

- `https://github.com/tauri-apps/binary-releases/releases/download/nsis-3.11/nsis-3.11.zip`
  - SHA1: `EF7FF767E5CBD9EDD22ADD3A32C9B8F4500BB10D`
- `https://github.com/tauri-apps/nsis-tauri-utils/releases/download/nsis_tauri_utils-v0.5.3/nsis_tauri_utils.dll`
  - SHA1: `75197FEE3C6A814FE035788D1C34EAD39349B860`
- `https://github.com/wixtoolset/wix3/releases/download/wix3141rtm/wix314-binaries.zip`
  - SHA256: `6ac824e1642d6f7277d0ed7ea09411a508f6116ba6fae0aa5f2c7daa2ff43d31`

After the cache is populated, `npm run release:nsis` writes the installer to:

```text
src-tauri\target\release\bundle\nsis\Agent Desktop Companion_0.1.0_x64-setup.exe
```

Optionally build an MSI only when WiX is installed and working:

```powershell
npm run release:msi
```

If `npm run release:doctor -- --target msi` reports `candle.exe` and `light.exe` as present, the local WiX cache is ready and Tauri should not need to download WiX during `release:msi`. Installing `WiXToolset.WiXToolset` through `winget` is still optional and can require administrator rights to enable NetFx3. Do not block a normal release on MSI unless a specific distribution requirement needs it.

## Desktop Smoke Test

After building the release exe, run:

```powershell
.\src-tauri\target\release\agent-desktop-companion.exe
```

Then verify:

1. The pet window opens as the primary surface and clicking it opens the session panel.
2. The tray menu opens the session panel, opens Settings, refreshes sessions, toggles Do Not Disturb, opens the data folder, and quits cleanly.
3. Toggling Do Not Disturb changes `%USERPROFILE%\.agent-desktop-companion\settings.json`, unless an override or legacy compatibility root is active.
4. With Do Not Disturb off, a controlled session JSON transition to `waiting_permission`, `done`, or `error` shows one native notification. `waiting_input` remains visible in session UI as a weak reminder but does not show a native notification.
5. With Do Not Disturb on, the same transition refreshes session state without showing a native notification.

For reliable notification testing while the current polling implementation is in place, leave at least two seconds between controlled session JSON state changes.

For a repeatable controlled session-state smoke sequence, run:

```powershell
npm run smoke:sessions
```

This launches the release exe with a temporary `AGENT_DESKTOP_COMPANION_HOME`, writes `running -> waiting_permission -> done`, toggles do-not-disturb in settings, then writes `running -> waiting_input` for a second session. The script verifies the file flow and app process path; native notification visibility still needs desktop observation for strong notification states.

Use the legacy compatibility path with:

```powershell
npm run smoke:sessions -- --legacy-env
```

## Data Folder

Agent Desktop Companion stores local state in:

```text
%USERPROFILE%\.agent-desktop-companion
```

Delete that folder to reset local session snapshots, events, imported pets, and config.

Compatibility notes:

- `AGENT_DESKTOP_COMPANION_HOME` overrides the current data root.
- If `CLAUDE_SPROUT_HOME` is set, the app and canonical hooks continue to use it.
- If the new default directory does not exist but `%USERPROFILE%\.claude-sprout` exists, the app reads the legacy directory.
- Legacy data is not moved or deleted automatically.
