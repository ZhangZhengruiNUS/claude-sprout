$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$gitDir = Join-Path $repoRoot ".git"
if (-not (Test-Path $gitDir)) {
  throw "This repository has no .git directory: $repoRoot"
}

$hooksDir = Join-Path $gitDir "hooks"
New-Item -ItemType Directory -Force -Path $hooksDir | Out-Null

$hookPath = Join-Path $hooksDir "pre-commit"
$hook = @'
#!/bin/sh
set -e

echo "[claude-sprout] updating handoff..."
npm run handoff:update
git add docs/next-session.md
'@

Set-Content -LiteralPath $hookPath -Value $hook -Encoding ascii
Write-Host "Installed git pre-commit hook: $hookPath"
