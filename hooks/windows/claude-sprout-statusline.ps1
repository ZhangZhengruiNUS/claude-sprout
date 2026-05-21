param()

$ErrorActionPreference = "Stop"

[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Get-SproutRoot {
  if ($env:CLAUDE_SPROUT_HOME) { return $env:CLAUDE_SPROUT_HOME }
  return Join-Path $env:USERPROFILE ".claude-sprout"
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
  $conversationPreview = if (Test-ConversationPreviewEnabled $root) {
    $preview = Get-TranscriptPreview $payload.transcript_path
    if ($preview) { $preview } else { Get-TranscriptPreview $payload.transcriptPath }
  } else {
    $null
  }

  $previousStatus = "idle"
  $lastEvent = "statusLine"
  $lastTool = $null
  $notificationType = $null
  $displayName = Get-DisplayName $payload
  $endedAt = $null
  $endReason = $null
  if (Test-Path $sessionPath) {
    $previous = Get-Content -Raw -LiteralPath $sessionPath | ConvertFrom-Json
    $previousStatus = [string]$previous.status
    $lastEvent = if ($previous.last_event) { [string]$previous.last_event } else { $lastEvent }
    $lastTool = if ($previous.last_tool) { [string]$previous.last_tool } else { $null }
    $notificationType = if ($previous.notification_type) { [string]$previous.notification_type } else { $null }
    if (-not $displayName -and $previous.display_name) { $displayName = [string]$previous.display_name }
    $endedAt = if ($previous.ended_at) { [string]$previous.ended_at } else { $null }
    $endReason = if ($previous.end_reason) { [string]$previous.end_reason } else { $null }
  }

  $snapshot = [ordered]@{
    session_id = $sessionId
    project_name = $project
    display_name = $displayName
    conversation_preview = $conversationPreview
    cwd = $cwd
    status = $previousStatus
    last_event = $lastEvent
    notification_type = $notificationType
    last_tool = $lastTool
    context_used_percentage = $context
    last_heartbeat_at = $now
    updated_at = $now
    ended_at = $endedAt
    end_reason = $endReason
    source = "claude-code-statusline"
  }

  $tmpPath = "$sessionPath.tmp"
  $snapshotJson = $snapshot | ConvertTo-Json -Depth 16 -Compress
  [System.IO.File]::WriteAllText($tmpPath, $snapshotJson, $Utf8NoBom)
  Move-Item -LiteralPath $tmpPath -Destination $sessionPath -Force

  $contextText = if ($null -ne $context) { "$([math]::Round($context))% ctx" } else { "ctx n/a" }
  Write-Output "Claude Sprout: $project | $contextText"
}
catch {
  Write-Output "Claude Sprout: status unavailable"
  exit 0
}
