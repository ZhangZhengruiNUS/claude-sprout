param()

$ErrorActionPreference = "Stop"

& (Join-Path $PSScriptRoot "agent-desktop-companion-hook.ps1")
exit $LASTEXITCODE
