param()

$ErrorActionPreference = "Stop"

[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Get-SproutRoot {
  if ($env:CLAUDE_SPROUT_HOME) { return $env:CLAUDE_SPROUT_HOME }
  return Join-Path $env:USERPROFILE ".claude-sprout"
}

function Get-ProjectName([string]$cwd) {
  if ([string]::IsNullOrWhiteSpace($cwd)) { return "Unknown project" }
  return Split-Path -Leaf $cwd
}

function Get-Status($payload) {
  $eventName = [string]$payload.hook_event_name
  switch ($eventName) {
    "SessionStart" { return "idle" }
    "UserPromptSubmit" { return "running" }
    "PreToolUse" { return "tool_running" }
    "PostToolUse" { return "running" }
    "PostToolUseFailure" { return "error" }
    "PermissionRequest" { return "waiting_permission" }
    "Stop" { return "done" }
    "StopFailure" { return "error" }
    "SessionEnd" { return "closed" }
    "Notification" {
      switch ([string]$payload.notification_type) {
        "permission_prompt" { return "waiting_permission" }
        "idle_prompt" { return "waiting_input" }
        default { return "idle" }
      }
    }
    default { return "idle" }
  }
}

function Limit-EventFile([string]$path) {
  $maxBytes = 5MB
  if ((Test-Path $path) -and ((Get-Item $path).Length -gt $maxBytes)) {
    $tail = Get-Content -LiteralPath $path -Tail 2000
    [System.IO.File]::WriteAllText($path, (($tail -join [Environment]::NewLine) + [Environment]::NewLine), $Utf8NoBom)
  }
}

function Is-TerminalEvent([string]$eventName) {
  return $eventName -eq "Stop" -or $eventName -eq "StopFailure" -or $eventName -eq "SessionEnd"
}

try {
  $raw = [Console]::In.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }

  $payload = $raw | ConvertFrom-Json
  $sessionId = [string]$payload.session_id
  if ([string]::IsNullOrWhiteSpace($sessionId)) { exit 0 }

  $root = Get-SproutRoot
  $sessionsDir = Join-Path $root "sessions"
  $eventsDir = Join-Path $root "events"
  New-Item -ItemType Directory -Force -Path $sessionsDir, $eventsDir | Out-Null

  $now = (Get-Date).ToUniversalTime().ToString("o")
  $status = Get-Status $payload
  $eventName = [string]$payload.hook_event_name
  $cwd = if ($payload.cwd) { [string]$payload.cwd } else { "" }
  $context = $null
  if ($payload.context_window -and $null -ne $payload.context_window.used_percentage) {
    $context = [double]$payload.context_window.used_percentage
  }

  $snapshot = [ordered]@{
    session_id = $sessionId
    project_name = Get-ProjectName $cwd
    cwd = $cwd
    status = $status
    last_event = $eventName
    notification_type = if ($payload.notification_type) { [string]$payload.notification_type } else { $null }
    last_tool = if ($payload.tool_name) { [string]$payload.tool_name } else { $null }
    context_used_percentage = $context
    last_heartbeat_at = $now
    updated_at = $now
    ended_at = if (Is-TerminalEvent $eventName) { $now } else { $null }
    end_reason = if ($payload.reason) { [string]$payload.reason } else { $null }
    source = "claude-code-hook"
  }

  $sessionPath = Join-Path $sessionsDir "$sessionId.json"
  $tmpPath = "$sessionPath.tmp"
  $snapshotJson = $snapshot | ConvertTo-Json -Depth 16 -Compress
  [System.IO.File]::WriteAllText($tmpPath, $snapshotJson, $Utf8NoBom)
  Move-Item -LiteralPath $tmpPath -Destination $sessionPath -Force

  $event = [ordered]@{
    session_id = $sessionId
    event_name = $eventName
    status = $status
    timestamp = $now
    tool_name = if ($payload.tool_name) { [string]$payload.tool_name } else { $null }
    notification_type = if ($payload.notification_type) { [string]$payload.notification_type } else { $null }
  }
  $eventPath = Join-Path $eventsDir "$sessionId.jsonl"
  $eventJson = $event | ConvertTo-Json -Depth 8 -Compress
  [System.IO.File]::AppendAllText($eventPath, ($eventJson + [Environment]::NewLine), $Utf8NoBom)
  Limit-EventFile $eventPath
}
catch {
  Write-Error $_.Exception.Message
  exit 1
}

exit 0
