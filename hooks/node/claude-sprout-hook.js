#!/usr/bin/env node
import { mkdirSync, renameSync, appendFileSync, writeFileSync, existsSync, statSync, readFileSync } from 'node:fs'
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

const now = new Date().toISOString()
const cwd = payload.cwd || ''
const status = statusFor(payload)
const snapshot = {
  session_id: sessionId,
  project_name: cwd ? basename(cwd) : 'Unknown project',
  cwd,
  status,
  last_event: payload.hook_event_name,
  notification_type: payload.notification_type ?? null,
  last_tool: payload.tool_name ?? null,
  context_used_percentage: payload.context_window?.used_percentage ?? null,
  last_heartbeat_at: now,
  updated_at: now,
  ended_at: status === 'closed' ? now : null,
  end_reason: payload.reason ?? null,
  source: 'claude-code-hook',
}

const sessionPath = join(sessionsDir, `${sessionId}.json`)
const tmpPath = `${sessionPath}.tmp`
writeFileSync(tmpPath, JSON.stringify(snapshot))
renameSync(tmpPath, sessionPath)

const eventPath = join(eventsDir, `${sessionId}.jsonl`)
appendFileSync(eventPath, `${JSON.stringify({
  session_id: sessionId,
  event_name: payload.hook_event_name,
  status,
  timestamp: now,
  tool_name: payload.tool_name ?? null,
  notification_type: payload.notification_type ?? null,
})}\n`)
trimEventFile(eventPath)
