#!/usr/bin/env node
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

const raw = await new Promise((resolve) => {
  let input = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => (input += chunk))
  process.stdin.on('end', () => resolve(input))
})

if (!raw.trim()) process.exit(0)

const payload = JSON.parse(raw)
const sessionId = payload.session_id
if (!sessionId) process.exit(0)

const root = process.env.CLAUDE_SPROUT_HOME || join(homedir(), '.claude-sprout')
const sessionsDir = join(root, 'sessions')
const eventsDir = join(root, 'events')
mkdirSync(sessionsDir, { recursive: true })
mkdirSync(eventsDir, { recursive: true })

function cleanDisplayName(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  return trimmed.slice(0, 80)
}

function transcriptDisplayName(path) {
  const transcriptPath = typeof path === 'string' ? path.trim() : ''
  if (!transcriptPath || !existsSync(transcriptPath)) return null

  let fd
  try {
    fd = openSync(transcriptPath, 'r')
    const buffer = Buffer.alloc(64 * 1024)
    const bytesRead = readSync(fd, buffer, 0, buffer.length, 0)
    const lines = buffer.subarray(0, bytesRead).toString('utf8').split(/\r?\n/)
    for (const line of lines) {
      if (!line.includes('summary') && !line.includes('title')) continue
      try {
        const entry = JSON.parse(line)
        const isSummary = entry?.type === 'summary' || entry?.type === 'session_summary'
        if (!isSummary && !entry?.summary && !entry?.title) continue
        const title = [entry.summary, entry.title, entry.session_title, entry.name]
          .map(cleanDisplayName)
          .find(Boolean)
        if (title) return title
      } catch {
        // Ignore partial or non-JSON transcript lines.
      }
    }
  } catch {
    return null
  } finally {
    if (fd !== undefined) closeSync(fd)
  }

  return null
}

function displayNameFor(input) {
  return [
    input.session_title,
    input.session_name,
    input.conversation_title,
    input.conversation_name,
    input.title,
    input.name,
    input.workspace?.name,
  ].map(cleanDisplayName).find(Boolean) ?? transcriptDisplayName(input.transcript_path ?? input.transcriptPath)
}

function statusFor(input) {
  if (input.hook_event_name === 'Notification') {
    if (input.notification_type === 'permission_prompt') return 'waiting_permission'
    if (input.notification_type === 'idle_prompt') return 'waiting_input'
  }
  return {
    SessionStart: 'idle',
    UserPromptSubmit: 'running',
    PreToolUse: 'tool_running',
    PostToolUse: 'running',
    PostToolUseFailure: 'error',
    PermissionRequest: 'waiting_permission',
    Stop: 'done',
    StopFailure: 'error',
    SessionEnd: 'closed',
  }[input.hook_event_name] || 'idle'
}

function trimEventFile(path) {
  if (existsSync(path) && statSync(path).size > 5 * 1024 * 1024) {
    const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/).slice(-2000)
    writeFileSync(path, `${lines.join('\n')}\n`)
  }
}

function isTerminalEvent(eventName) {
  return ['Stop', 'StopFailure', 'SessionEnd'].includes(eventName)
}

const now = new Date().toISOString()
const cwd = payload.cwd || ''
const status = statusFor(payload)
const eventName = payload.hook_event_name
const sessionPath = join(sessionsDir, `${sessionId}.json`)
const previous = existsSync(sessionPath) ? JSON.parse(readFileSync(sessionPath, 'utf8')) : {}
const displayName = displayNameFor(payload) ?? previous.display_name ?? null
const snapshot = {
  session_id: sessionId,
  project_name: cwd ? basename(cwd) : 'Unknown project',
  display_name: displayName,
  cwd,
  status,
  last_event: eventName,
  notification_type: payload.notification_type ?? null,
  last_tool: payload.tool_name ?? null,
  context_used_percentage: payload.context_window?.used_percentage ?? null,
  last_heartbeat_at: now,
  updated_at: now,
  ended_at: isTerminalEvent(eventName) ? now : null,
  end_reason: payload.reason ?? null,
  source: 'claude-code-hook',
}

const tmpPath = `${sessionPath}.tmp`
writeFileSync(tmpPath, JSON.stringify(snapshot))
renameSync(tmpPath, sessionPath)

const eventPath = join(eventsDir, `${sessionId}.jsonl`)
appendFileSync(eventPath, `${JSON.stringify({
  session_id: sessionId,
  event_name: eventName,
  status,
  timestamp: now,
  tool_name: payload.tool_name ?? null,
  notification_type: payload.notification_type ?? null,
})}\n`)
trimEventFile(eventPath)
