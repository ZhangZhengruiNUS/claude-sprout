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

## Data Folder

Claude Sprout stores local state in:

```text
%USERPROFILE%\.claude-sprout
```

Delete that folder to reset local session snapshots, events, imported pets, and config.
