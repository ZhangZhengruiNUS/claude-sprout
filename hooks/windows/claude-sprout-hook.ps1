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

function Get-CleanDisplayName($value) {
  if ($null -eq $value) { return $null }
  $trimmed = ([string]$value).Trim() -replace "\s+", " "
  if ([string]::IsNullOrWhiteSpace($trimmed)) { return $null }
  if ($trimmed.Length -gt 80) { return $trimmed.Substring(0, 80) }
  return $trimmed
}

function Get-CleanPreviewText($value) {
  if ($null -eq $value) { return $null }
  $trimmed = ([string]$value).Trim() -replace "\s+", " "
  if ([string]::IsNullOrWhiteSpace($trimmed)) { return $null }
  if ($trimmed.Length -gt 240) { return $trimmed.Substring(0, 240) }
  return $trimmed
}

function Get-AppSettings($root) {
  $settingsPath = Join-Path $root "settings.json"
  if (-not (Test-Path -LiteralPath $settingsPath)) { return $null }
  try {
    return Get-Content -Raw -Encoding UTF8 -LiteralPath $settingsPath | ConvertFrom-Json
  }
  catch {
    return $null
  }
}

function Test-ConversationPreviewEnabled($root) {
  $settings = Get-AppSettings $root
  return $null -ne $settings -and $settings.petConversationPreviewEnabled -eq $true
}

function Get-TranscriptDisplayName($path) {
  $transcriptPath = if ($null -ne $path) { ([string]$path).Trim() } else { "" }
  if (-not $transcriptPath -or -not (Test-Path -LiteralPath $transcriptPath)) { return $null }

  try {
    $lines = @(Get-Content -LiteralPath $transcriptPath -Encoding UTF8 -TotalCount 120 -ErrorAction Stop)
    foreach ($line in $lines) {
      if (-not ($line.Contains("summary") -or $line.Contains("title"))) { continue }
      try {
        $entry = $line | ConvertFrom-Json
        $isSummary = [string]$entry.type -eq "summary" -or [string]$entry.type -eq "session_summary"
        if (-not $isSummary -and -not $entry.summary -and -not $entry.title) { continue }
        foreach ($candidate in @($entry.summary, $entry.title, $entry.session_title, $entry.name)) {
          $cleaned = Get-CleanDisplayName $candidate
          if ($cleaned) { return $cleaned }
        }
      }
      catch {
        continue
      }
    }
  }
  catch {
    return $null
  }

  return $null
}

function Get-TextFromContent($content) {
  if ($null -eq $content) { return "" }
  if ($content -is [string]) { return $content }
  if ($content -is [array]) {
    $parts = @()
    foreach ($item in $content) {
      if ($item -is [string]) {
        $parts += $item
      }
      elseif ($null -ne $item -and $item.type -eq "text" -and $item.text -is [string]) {
        $parts += [string]$item.text
      }
    }
    return ($parts -join " ")
  }
  if ($content.type -eq "text" -and $content.text -is [string]) { return [string]$content.text }
  return ""
}

function Get-PreviewFromLine([string]$line) {
  if ([string]::IsNullOrWhiteSpace($line)) { return $null }
  try {
    $entry = $line | ConvertFrom-Json
  }
  catch {
    return $null
  }

  $role = if ($entry.message.role) { [string]$entry.message.role } elseif ($entry.role) { [string]$entry.role } else { [string]$entry.type }
  if ($role -ne "assistant" -and $role -ne "user") { return $null }
  $content = if ($entry.message.content) { $entry.message.content } elseif ($entry.content) { $entry.content } else { $entry.text }
  $text = Get-CleanPreviewText (Get-TextFromContent $content)
  if (-not $text) { return $null }
  $prefix = if ($role -eq "assistant") { "Claude" } else { "User" }
  $preview = "${prefix}: $text"
  if ($preview.Length -gt 260) { return $preview.Substring(0, 260) }
  return $preview
}

function Get-TranscriptPreview($path) {
  $transcriptPath = if ($null -ne $path) { ([string]$path).Trim() } else { "" }
  if (-not $transcriptPath -or -not (Test-Path -LiteralPath $transcriptPath)) { return $null }

  try {
    $lines = @(Get-Content -LiteralPath $transcriptPath -Encoding UTF8 -Tail 120 -ErrorAction Stop)
    for ($index = $lines.Count - 1; $index -ge 0; $index--) {
      $preview = Get-PreviewFromLine ([string]$lines[$index])
      if ($preview) { return $preview }
    }
  }
  catch {
    return $null
  }

  return $null
}

function Get-DisplayName($payload) {
  $candidates = @(
    $payload.session_title,
    $payload.session_name,
    $payload.conversation_title,
    $payload.conversation_name,
    $payload.title,
    $payload.name,
    $payload.workspace.name
  )
  foreach ($candidate in $candidates) {
    $cleaned = Get-CleanDisplayName $candidate
    if ($cleaned) { return $cleaned }
  }
  foreach ($candidate in @(
    (Get-TranscriptDisplayName $payload.transcript_path),
    (Get-TranscriptDisplayName $payload.transcriptPath)
  )) {
    if ($candidate) { return $candidate }
  }
  return $null
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

function Get-PreviousSnapshot([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  try {
    return Get-Content -Raw -Encoding UTF8 -LiteralPath $path | ConvertFrom-Json
  }
  catch {
    return $null
  }
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
  $sessionPath = Join-Path $sessionsDir "$sessionId.json"
  $displayName = Get-DisplayName $payload
  $conversationPreview = if (Test-ConversationPreviewEnabled $root) {
    $preview = Get-TranscriptPreview $payload.transcript_path
    if ($preview) { $preview } else { Get-TranscriptPreview $payload.transcriptPath }
  } else {
    $null
  }
  if (-not $displayName) {
    $previous = Get-PreviousSnapshot $sessionPath
    if ($previous.display_name) { $displayName = [string]$previous.display_name }
  }

  $snapshot = [ordered]@{
    session_id = $sessionId
    project_name = Get-ProjectName $cwd
    display_name = $displayName
    conversation_preview = $conversationPreview
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
