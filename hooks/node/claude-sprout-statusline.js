#!/usr/bin/env node
import { mkdirSync, renameSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

const raw = await new Promise((resolve) => {
  let input = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => (input += chunk))
  process.stdin.on('end', () => resolve(input))
})

if (!raw.trim()) process.exit(0)

try {
  const payload = JSON.parse(raw)
  const sessionId = payload.session_id
  if (!sessionId) {
    console.log('Claude Sprout: no session')
    process.exit(0)
  }

  const root = process.env.CLAUDE_SPROUT_HOME || join(homedir(), '.claude-sprout')
  const sessionsDir = join(root, 'sessions')
  mkdirSync(sessionsDir, { recursive: true })
  const sessionPath = join(sessionsDir, `${sessionId}.json`)
  const previous = existsSync(sessionPath) ? JSON.parse(readFileSync(sessionPath, 'utf8')) : {}
  const cwd = payload.workspace?.current_dir || payload.cwd || ''
  const project = cwd ? basename(cwd) : 'Unknown project'
  const context = payload.context_window?.used_percentage ?? null
  const now = new Date().toISOString()
  const snapshot = {
    session_id: sessionId,
    project_name: project,
    cwd,
    status: previous.status || 'idle',
    last_event: previous.last_event || 'statusLine',
    notification_type: previous.notification_type ?? null,
    last_tool: previous.last_tool ?? null,
    context_used_percentage: context,
    last_heartbeat_at: now,
    updated_at: now,
    ended_at: previous.ended_at ?? null,
    end_reason: previous.end_reason ?? null,
    source: 'claude-code-statusline',
  }

  const tmpPath = `${sessionPath}.tmp`
  writeFileSync(tmpPath, JSON.stringify(snapshot))
  renameSync(tmpPath, sessionPath)
  console.log(`Claude Sprout: ${project} | ${context == null ? 'ctx n/a' : `${Math.round(context)}% ctx`}`)
} catch {
  console.log('Claude Sprout: status unavailable')
}
