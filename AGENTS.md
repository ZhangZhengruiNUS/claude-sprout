# Agent Desktop Companion Agent Instructions

This repository is a Windows-first Tauri v2 local-first AI Agent desktop companion. The primary product surface is Glint, a small transparent always-on-top pet window; the full session panel is secondary.

## Automatic Startup Context

At the start of any new Codex session in this repository, do this before planning or editing:

1. Read `docs/next-session.md`.
2. Skim `docs/devlog.md` for recent decisions.
3. Run `git status --short --branch` and `git log --oneline --decorate -5`.
4. If the user says "continue", "继续开发", or gives a new feature request without more context, continue from the "Next Tasks" section in `docs/next-session.md`.

Do not ask the user to restate prior context unless the handoff is stale, contradictory, or missing the information needed for a risky decision.

## Project Priorities

- Keep the pet window as the primary surface: transparent, frameless, always-on-top, lightweight, and low-noise.
- Keep the session panel as a secondary view opened from the pet or tray.
- Prefer Windows behavior and PowerShell hook support first.
- Do not implement automatic Claude Code permission approval.
- Do not capture full prompts, model outputs, secrets, or project file contents.
- Keep data local under `%USERPROFILE%\.agent-desktop-companion` by default, while preserving legacy read compatibility for `%USERPROFILE%\.claude-sprout` and `CLAUDE_SPROUT_HOME`.

## Development Workflow

- Use `npm` in this repo.
- Use Tauri v2 + React + TypeScript + Rust.
- Before claiming a change works, run the smallest relevant verification:
  - Frontend changes: `npm run lint` and `npm run build`.
  - Rust/session-store changes: `cargo test --manifest-path src-tauri\Cargo.toml`.
  - Desktop build changes: `npm run tauri -- build --no-bundle`.
- Full installer bundling currently may fail on this machine because WiX install/download is blocked by admin/TLS issues. The release exe build works with `--no-bundle`.

## Handoff Discipline

After meaningful project changes, update:

- `docs/next-session.md` with current state, commands, blockers, and next tasks.
- `docs/devlog.md` with a short dated entry.

Use `npm run handoff:update` to regenerate `docs/next-session.md` from `docs/handoff-state.json` plus live git/package metadata. If the local git hook has been installed with `npm run hooks:install`, commits automatically run the handoff update and stage `docs/next-session.md`.

When next tasks, blockers, implemented capabilities, or decisions change, edit `docs/handoff-state.json` first, then run `npm run handoff:update`.

Then commit and push unless the user asks not to.
