param()

$ErrorActionPreference = "Stop"

& (Join-Path $PSScriptRoot "agent-desktop-companion-statusline.ps1")
exit $LASTEXITCODE
