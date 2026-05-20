param()

$ErrorActionPreference = "Stop"

function Get-SproutRoot {
  if ($env:CLAUDE_SPROUT_HOME) { return $env:CLAUDE_SPROUT_HOME }
  return Join-Path $env:USERPROFILE ".claude-sprout"
}

try {
  $raw = [Console]::In.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }

  $payload = $raw | ConvertFrom-Json
  $sessionId = [string]$payload.session_id
  if ([string]::IsNullOrWhiteSpace($sessionId)) {
    Write-Output "Claude Sprout: no session"
    exit 0
  }

  $root = Get-SproutRoot
  $sessionsDir = Join-Path $root "sessions"
  New-Item -ItemType Directory -Force -Path $sessionsDir | Out-Null

  $now = (Get-Date).ToUniversalTime().ToString("o")
  $cwd = if ($payload.workspace.current_dir) { [string]$payload.workspace.current_dir } elseif ($payload.cwd) { [string]$payload.cwd } else { "" }
  $project = if ($cwd) { Split-Path -Leaf $cwd } else { "Unknown project" }
  $context = if ($payload.context_window -and $null -ne $payload.context_window.used_percentage) { [double]$payload.context_window.used_percentage } else { $null }
  $sessionPath = Join-Path $sessionsDir "$sessionId.json"

  $previousStatus = "idle"
  $lastEvent = "statusLine"
  $lastTool = $null
  $notificationType = $null
  if (Test-Path $sessionPath) {
    $previous = Get-Content -Raw -LiteralPath $sessionPath | ConvertFrom-Json
    $previousStatus = [string]$previous.status
    $lastEvent = if ($previous.last_event) { [string]$previous.last_event } else { $lastEvent }
    $lastTool = if ($previous.last_tool) { [string]$previous.last_tool } else { $null }
    $notificationType = if ($previous.notification_type) { [string]$previous.notification_type } else { $null }
  }

  $snapshot = [ordered]@{
    session_id = $sessionId
    project_name = $project
    cwd = $cwd
    status = $previousStatus
    last_event = $lastEvent
    notification_type = $notificationType
    last_tool = $lastTool
    context_used_percentage = $context
    last_heartbeat_at = $now
    updated_at = $now
    ended_at = $null
    end_reason = $null
    source = "claude-code-statusline"
  }

  $tmpPath = "$sessionPath.tmp"
  $snapshot | ConvertTo-Json -Depth 16 -Compress | Set-Content -LiteralPath $tmpPath -Encoding utf8
  Move-Item -LiteralPath $tmpPath -Destination $sessionPath -Force

  $contextText = if ($null -ne $context) { "$([math]::Round($context))% ctx" } else { "ctx n/a" }
  Write-Output "Claude Sprout: $project | $contextText"
}
catch {
  Write-Output "Claude Sprout: status unavailable"
  exit 0
}
