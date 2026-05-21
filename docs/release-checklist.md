# Release Checklist

This checklist is for the first tagged Windows release of Claude Sprout.

## Release Scope

- Target version: `v0.1.0`.
- Official Windows artifacts:
  - standalone release executable: `src-tauri\target\release\claude-sprout.exe`
  - NSIS installer: `src-tauri\target\release\bundle\nsis\Claude Sprout_0.1.0_x64-setup.exe`
- Optional maintainer artifact:
  - MSI installer: `src-tauri\target\release\bundle\msi\Claude Sprout_0.1.0_x64_en-US.msi`
- Do not block the release on MSI unless a specific distribution requirement needs it.
- Do not tag the release until the verification and artifact checks below pass.

## Preflight

1. Confirm the working tree is clean:

   ```powershell
   git status --short --branch
   ```

2. Confirm there is no conflicting local or remote tag:

   ```powershell
   git tag --list v0.1.0
   git ls-remote --tags origin v0.1.0
   ```

3. Confirm release versions match the intended tag:
   - `package.json`
   - `package-lock.json`
   - `src-tauri\tauri.conf.json`
   - `src-tauri\Cargo.toml`
   - `src-tauri\Cargo.lock`
4. Confirm release notes mention the privacy boundaries:
   - local-only state under `%USERPROFILE%\.claude-sprout`
   - no prompt/output capture by default
   - no automatic Claude Code permission approval
5. Confirm the official artifact policy still matches `docs\install-windows.md`.
6. Confirm the release notes say the app is unsigned unless code signing has been configured.

## Verification

Run the core validation commands:

```powershell
npm test
npm run lint
npm run build
cargo test --manifest-path src-tauri\Cargo.toml
```

Validate the release tool cache for the official installer path:

```powershell
npm run release:doctor
```

If NSIS cache files are missing or the normal Tauri download path hits a Windows TLS/SChannel error, pre-cache the release tools and re-run the doctor:

```powershell
npm run release:precache-tools -- --target nsis
npm run release:doctor
```

## Build Artifacts

Build the standalone executable:

```powershell
npm run release:exe
```

Build the official installer:

```powershell
npm run release:nsis
```

Optional maintainer-only MSI validation:

```powershell
npm run release:doctor -- --target msi
npm run release:msi
```

## Artifact Checks

Confirm the expected official files exist:

```powershell
Test-Path src-tauri\target\release\claude-sprout.exe
Test-Path "src-tauri\target\release\bundle\nsis\Claude Sprout_0.1.0_x64-setup.exe"
```

Capture hashes for the official artifacts:

```powershell
Get-FileHash src-tauri\target\release\claude-sprout.exe -Algorithm SHA256
Get-FileHash "src-tauri\target\release\bundle\nsis\Claude Sprout_0.1.0_x64-setup.exe" -Algorithm SHA256
```

Record the file sizes and hashes in the GitHub release notes.

## Desktop Smoke

Run the release executable:

```powershell
.\src-tauri\target\release\claude-sprout.exe
```

Verify:

1. The pet window opens first, is transparent, frameless, always on top, and hidden from the taskbar.
2. Clicking the pet opens and focuses the session panel.
3. The tray menu can open the session panel, open Settings, refresh sessions, toggle Do Not Disturb, open the data folder, and quit cleanly.
4. Settings changes persist under `%USERPROFILE%\.claude-sprout\settings.json`.
5. Do Not Disturb suppresses native notifications.
6. With Do Not Disturb off, a controlled `waiting_permission`, `waiting_input`, `done`, or `error` transition shows one native notification.

Run the NSIS installer and verify:

1. The installer completes without requesting MSI/WiX.
2. The installed app launches to the pet window.
3. The pet, tray, session panel, Settings, and quit flow still work from the installed app.
4. Uninstall removes the installed app cleanly without deleting `%USERPROFILE%\.claude-sprout`.

For repeatable session-state flow setup:

```powershell
npm run smoke:sessions
```

Native notification visibility still needs desktop observation.

## Tag And Publish

1. Create the release tag only after the checklist above passes:

   ```powershell
   git tag -a v0.1.0 -m "v0.1.0"
   git push origin v0.1.0
   ```

2. Create a GitHub release for `v0.1.0`.
3. Upload the official artifacts:
   - `claude-sprout.exe`
   - `Claude Sprout_0.1.0_x64-setup.exe`
4. Include SHA256 hashes, file sizes, supported OS notes, and a short smoke-test summary.
5. Mention that the app is unsigned if code signing is not configured for this release.

## Rollback

If a blocking issue is found before publishing:

1. Delete the local tag if it was created:

   ```powershell
   git tag -d v0.1.0
   ```

2. Delete the remote tag only if it was already pushed:

   ```powershell
   git push origin :refs/tags/v0.1.0
   ```

3. Do not reuse a published broken artifact. Fix forward, rebuild, and publish a new patch tag if users could already have downloaded it.
