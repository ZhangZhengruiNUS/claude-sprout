# Codex Pet Alignment Design

## Goal

Align Claude Sprout's imported pet renderer with the local Codex/Hatch Pet atlas contract so migrated Codex pet packages can use their full animation set without repackaging.

## Scope

- Treat `codex-8x9` as 8 columns by 9 rows, with 192x208 pixel cells.
- Preserve the existing Codex-compatible package shape: `pet.json` plus `spritesheet.webp`.
- Keep imported pets copied into `%USERPROFILE%\.claude-sprout\pets\<id>`.
- Keep the renderer business-light: it receives an animation key and atlas metadata, then renders the correct row and frame range.
- Do not bundle Codex assets and do not reference the original Codex pet directory at runtime.

## Atlas Contract

The profile exposes the Codex row semantics directly:

- `idle`: row 0, 6 frames, loop
- `runningRight`: row 1, 8 frames, loop
- `runningLeft`: row 2, 8 frames, loop
- `waving`: row 3, 4 frames, once
- `jumping`: row 4, 5 frames, once
- `failed`: row 5, 8 frames, once
- `waiting`: row 6, 6 frames, loop
- `running`: row 7, 6 frames, loop
- `review`: row 8, 6 frames, loop

Each animation may have a row-specific duration derived from the Codex timing table. The renderer must only step through the used frames for that row so transparent unused cells are not shown.

## State Mapping

Claude Code session state maps to Codex row semantics:

- `running` and `tool_running` use `running`.
- `waiting_permission` uses `waiting`; `waiting_input` is a weak reminder and uses `idle`.
- New `done` transitions play `jumping` once through the event-action layer, then the sustained `done` state uses `idle`.
- `error` uses `failed`.
- `idle`, `stale`, `probably_closed`, and `closed` use `idle`.
- User-triggered preview/double-click actions use `waving`.
- The existing `review` row remains available for future explicit review-style actions.

Directional drag animation uses `runningLeft` and `runningRight` while the imported pet window is actively dragged, then clears the override on pointer release.

## Tests

Frontend tests cover:

- Codex atlas geometry, row semantics, frame counts, modes, and row-specific durations.
- Session status to Codex animation mapping.
- Drag direction mapping and directional row rendering for imported pets.
- One-shot render key compatibility after animation key renames.
- Pet asset mapping still attaches the corrected atlas profile.

Rust tests cover:

- The backend `codex-8x9` profile reports 9 rows and 8 columns.

## Non-Goals

- No new pet art generation.
- No desktop behavior change beyond richer imported sprite animation and directional drag feedback.
- No automatic permission approval or prompt/output capture.
