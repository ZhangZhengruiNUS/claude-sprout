#!/usr/bin/env node
import {
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

function resolveAgentDesktopCompanionRoot() {
  if (process.env.AGENT_DESKTOP_COMPANION_HOME) {
    return process.env.AGENT_DESKTOP_COMPANION_HOME
  }
  if (process.env.CLAUDE_SPROUT_HOME) {
    return process.env.CLAUDE_SPROUT_HOME
  }
  const newRoot = join(homedir(), '.agent-desktop-companion')
  const legacyRoot = join(homedir(), '.claude-sprout')
  return existsSync(newRoot) || !existsSync(legacyRoot) ? newRoot : legacyRoot
}

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

function cleanPreviewText(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  return trimmed.slice(0, 240)
}

function appSettingsFor(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8'))
  } catch {
    return {}
  }
}

function isConversationPreviewEnabled(root) {
  return appSettingsFor(root).petConversationPreviewEnabled === true
}

function previousSnapshot(path) {
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
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

function transcriptPreview(path) {
  const transcriptPath = typeof path === 'string' ? path.trim() : ''
  if (!transcriptPath || !existsSync(transcriptPath)) return null

  let fd
  try {
    const size = statSync(transcriptPath).size
    const maxBytes = 64 * 1024
    const start = Math.max(0, size - maxBytes)
    fd = openSync(transcriptPath, 'r')
    const buffer = Buffer.alloc(Math.min(size, maxBytes))
    const bytesRead = readSync(fd, buffer, 0, buffer.length, start)
    const lines = buffer.subarray(0, bytesRead).toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/)
    for (const line of lines.reverse()) {
      const preview = previewFromLine(line)
      if (preview) return preview
    }
  } catch {
    return null
  } finally {
    if (fd !== undefined) closeSync(fd)
  }

  return null
}

function previewFromLine(line) {
  if (!line.trim()) return null
  let entry
  try {
    entry = JSON.parse(line)
  } catch {
    return null
  }

  const role = entry?.message?.role ?? entry?.role ?? entry?.type
  if (role !== 'assistant' && role !== 'user') return null
  const text = cleanPreviewText(textFromContent(entry?.message?.content ?? entry?.content ?? entry?.text))
  if (!text) return null
  return `${role === 'assistant' ? 'Claude' : 'User'}: ${text}`.slice(0, 260)
}

function textFromContent(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item
        if (!item || typeof item !== 'object') return ''
        if (item.type && item.type !== 'text') return ''
        return typeof item.text === 'string' ? item.text : ''
      })
      .filter(Boolean)
      .join(' ')
  }
  if (content && typeof content === 'object' && content.type === 'text' && typeof content.text === 'string') {
    return content.text
  }
  return ''
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
    console.log('Agent Desktop Companion: no session')
    process.exit(0)
  }

  const root = resolveAgentDesktopCompanionRoot()
  const sessionsDir = join(root, 'sessions')
  mkdirSync(sessionsDir, { recursive: true })
  const sessionPath = join(sessionsDir, `${sessionId}.json`)
  const previous = previousSnapshot(sessionPath)
  const cwd = payload.workspace?.current_dir || payload.cwd || ''
  const project = cwd ? basename(cwd) : 'Unknown project'
  const context = payload.context_window?.used_percentage ?? null
  const displayName = displayNameFor(payload) ?? previous.display_name ?? null
  const conversationPreview = isConversationPreviewEnabled(root)
    ? transcriptPreview(payload.transcript_path ?? payload.transcriptPath)
    : null
  const now = new Date().toISOString()
  const snapshot = {
    session_id: sessionId,
    project_name: project,
    display_name: displayName,
    conversation_preview: conversationPreview,
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
  console.log(`Agent Desktop Companion: ${project} | ${context == null ? 'ctx n/a' : `${Math.round(context)}% ctx`}`)
} catch {
  console.log('Agent Desktop Companion: status unavailable')
}
