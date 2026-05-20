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

Check the local installer tool cache:

```powershell
npm run release:doctor
```

If the machine cannot download Tauri's NSIS tools because the GitHub TLS certificate is reported as `UnknownIssuer`, pre-cache NSIS under:

```text
src-tauri\target\.tauri\NSIS
```

Tauri expects the extracted NSIS files directly inside that folder, including:

```text
makensis.exe
Bin\makensis.exe
Stubs\lzma-x86-unicode
Stubs\lzma_solid-x86-unicode
Include\MUI2.nsh
Include\FileFunc.nsh
Include\x64.nsh
Include\nsDialogs.nsh
Include\WinMessages.nsh
Plugins\x86-unicode\additional\nsis_tauri_utils.dll
```

Reference downloads:

- `https://github.com/tauri-apps/binary-releases/releases/download/nsis-3.11/nsis-3.11.zip`
  - SHA1: `EF7FF767E5CBD9EDD22ADD3A32C9B8F4500BB10D`
- `https://github.com/tauri-apps/nsis-tauri-utils/releases/download/nsis_tauri_utils-v0.5.3/nsis_tauri_utils.dll`
  - SHA1: `75197FEE3C6A814FE035788D1C34EAD39349B860`

After the cache is populated, `npm run release:nsis` writes the installer to:

```text
src-tauri\target\release\bundle\nsis\Claude Sprout_0.1.0_x64-setup.exe
```

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

For a repeatable controlled session-state smoke sequence, run:

```powershell
npm run smoke:sessions
```

This launches the release exe with a temporary `CLAUDE_SPROUT_HOME`, writes `running -> waiting_permission -> done`, toggles do-not-disturb in settings, then writes `running -> waiting_input` for a second session. The script verifies the file flow and app process path; native notification visibility still needs desktop observation.

## Data Folder

Claude Sprout stores local state in:

```text
%USERPROFILE%\.claude-sprout
```

Delete that folder to reset local session snapshots, events, imported pets, and config.
