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

Build the release executable without creating an installer:

```powershell
npm run release:exe
```

The executable is written to:

```text
src-tauri\target\release\claude-sprout.exe
```

Build the default Windows installer:

```powershell
npm run release:nsis
```

The Tauri config uses the NSIS target by default so normal installer work does not also request MSI output.
Installer tools are cached under the project target directory (`src-tauri\target\.tauri`) so failed downloads and pre-cached tools are easier to inspect on Windows.

Known local blocker: NSIS bundling currently compiles the release exe, then fails while downloading Tauri's NSIS tool archive because the GitHub TLS certificate is reported as `UnknownIssuer`. This is a machine trust or proxy-chain problem, not an app compile problem; fix the local certificate path or pre-cache the NSIS tool archive before rerunning `npm run release:nsis`.

Build an MSI only when WiX is installed and working:

```powershell
npm run release:msi
```

Known local blocker: MSI bundling can also fail here because Tauri's WiX download hits TLS `UnknownIssuer`, and installing `WiXToolset.WiXToolset` through `winget` requires administrator rights to enable NetFx3.

## Desktop Smoke Test

After building the release exe, run:

```powershell
.\src-tauri\target\release\claude-sprout.exe
```

Then verify:

1. The pet window opens as the primary surface and clicking it opens the session panel.
2. The tray menu opens the session panel, opens Settings, refreshes sessions, toggles Do Not Disturb, opens the data folder, and quits cleanly.
3. Toggling Do Not Disturb changes `%USERPROFILE%\.claude-sprout\settings.json`.
4. With Do Not Disturb off, a controlled session JSON transition to `waiting_permission`, `waiting_input`, `done`, or `error` shows one native notification.
5. With Do Not Disturb on, the same transition refreshes session state without showing a native notification.

For reliable notification testing while the current polling implementation is in place, leave at least two seconds between controlled session JSON state changes.

## Data Folder

Claude Sprout stores local state in:

```text
%USERPROFILE%\.claude-sprout
```

Delete that folder to reset local session snapshots, events, imported pets, and config.
