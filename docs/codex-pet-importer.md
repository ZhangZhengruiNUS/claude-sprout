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

## Import Behavior

1. Validate required files.
2. Copy the package into `%USERPROFILE%\.claude-sprout\pets\<pet-id>`.
3. Generate `manifest.json`.
4. Use atlas profile `codex-8x9`.

## Copyright Boundary

Do not bundle official Codex pet assets. Only import local custom packages that the user owns or has permission to use.
