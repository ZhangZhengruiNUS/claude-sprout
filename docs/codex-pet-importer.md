# Codex-Compatible Pet Importer

Claude Sprout supports a compatibility layer for custom Codex-compatible pets. The renderer should use Claude Sprout manifests, not Codex files directly.

## Search Paths

- `%USERPROFILE%\.codex\pets`
- `%CODEX_HOME%\pets`

## Expected Package

```text
<pet-id>/
  pet.json
  spritesheet.webp
```

`pet.json` follows the Codex-compatible shape:

```json
{
  "id": "pet-id",
  "displayName": "Pet Name",
  "description": "Short description",
  "spritesheetPath": "spritesheet.webp"
}
```

## Atlas Profile

`codex-8x9` means 8 columns by 9 rows, with 192x208 pixel cells. The expected spritesheet size is 1536x1872.

| Row | Animation | Frames | Playback |
| --- | --- | ---: | --- |
| 0 | `idle` | 6 | loop |
| 1 | `runningRight` | 8 | loop |
| 2 | `runningLeft` | 8 | loop |
| 3 | `waving` | 4 | once |
| 4 | `jumping` | 5 | once |
| 5 | `failed` | 8 | once |
| 6 | `waiting` | 6 | loop |
| 7 | `running` | 6 | loop |
| 8 | `review` | 6 | loop |

Claude Sprout maps Claude Code session status to these Codex row semantics: active work uses `running`, blocked input or permission states use `waiting`, new clean completions play `jumping` once and then settle back to `idle`, errors use `failed`, and quiet or closed sessions use `idle`. The `review` row remains available for explicit review-style actions instead of being held forever after completion.

While dragging an imported pet, horizontal movement temporarily overrides the sustained status animation with `runningRight` or `runningLeft`. Releasing the drag clears that override and returns to the current session-driven animation.

## Import Behavior

1. Validate required files and `spritesheet.webp` dimensions.
2. Copy the package into `%USERPROFILE%\.claude-sprout\pets\<pet-id>`.
3. Generate `manifest.json`.
4. Use atlas profile `codex-8x9`.

## Copyright Boundary

Do not bundle official Codex pet assets. Only import local custom packages that the user owns or has permission to use.
