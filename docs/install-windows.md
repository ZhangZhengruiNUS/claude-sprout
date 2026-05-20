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

Known local blocker: NSIS bundling currently compiles the release exe, then fails while downloading Tauri's NSIS tool archive because the GitHub TLS certificate is reported as `UnknownIssuer`.

Build an MSI only when WiX is installed and working:

```powershell
npm run release:msi
```

Known local blocker: MSI bundling can also fail here because Tauri's WiX download hits TLS `UnknownIssuer`, and installing `WiXToolset.WiXToolset` through `winget` requires administrator rights to enable NetFx3.

## Data Folder

Claude Sprout stores local state in:

```text
%USERPROFILE%\.claude-sprout
```

Delete that folder to reset local session snapshots, events, imported pets, and config.
