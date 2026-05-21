#!/usr/bin/env node
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
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

function displayNameFor(payload) {
  return [
    payload.session_title,
    payload.session_name,
    payload.conversation_title,
    payload.conversation_name,
    payload.title,
    payload.name,
    payload.workspace?.name,
  ].map(cleanDisplayName).find(Boolean) ?? transcriptDisplayName(payload.transcript_path ?? payload.transcriptPath)
}

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
  const displayName = displayNameFor(payload) ?? previous.display_name ?? null
  const now = new Date().toISOString()
  const snapshot = {
    session_id: sessionId,
    project_name: project,
    display_name: displayName,
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
