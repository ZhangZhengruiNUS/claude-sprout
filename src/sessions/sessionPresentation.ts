import type { SessionSnapshot, SessionStatus } from './sessionTypes'

export type Translate = (key: string, options?: Record<string, unknown>) => string

export type SessionActivitySummary = {
  title: string
  detail: string
  meta: string
}

export const SESSION_STATUS_PRIORITY: Record<SessionStatus, number> = {
  waiting_permission: 0,
  error: 1,
  tool_running: 2,
  running: 3,
  done: 4,
  waiting_input: 5,
  stale: 6,
  probably_closed: 7,
  idle: 8,
  closed: 9,
}

export function sessionActivitySummary(
  session: SessionSnapshot,
  conversationPreviewEnabled: boolean,
  translate: Translate,
): SessionActivitySummary {
  return {
    title: sessionActivityTitle(session, translate),
    detail: sessionActivityDetail(session, conversationPreviewEnabled, translate),
    meta: sessionActivityMeta(session, translate),
  }
}

export function sessionActivityTitle(session: SessionSnapshot, translate: Translate) {
  return displayName(session) ?? translate('petAssistant.activity.titleWithSession', {
    project: displayProjectName(session, translate),
    sessionId: shortSessionId(session.session_id, translate),
  })
}

export function sessionActivityDetail(
  session: SessionSnapshot,
  conversationPreviewEnabled: boolean,
  translate: Translate,
) {
  const tool = safeInlineText(session.last_tool)
  const event = safeInlineText(session.last_event)
  const preview = conversationPreviewEnabled ? safeInlineText(session.conversation_preview) : null

  switch (session.status) {
    case 'waiting_permission':
      return tool
        ? translate('petAssistant.activity.waitingPermissionWithTool', { tool })
        : translate('petAssistant.activity.waitingPermission')
    case 'waiting_input':
      return translate('petAssistant.activity.waitingInput')
    case 'tool_running':
      return preview ?? (tool ? translate('petAssistant.activity.usingToolWithTool', { tool }) : translate('petAssistant.activity.usingTool'))
    case 'running':
      return preview ?? (tool
        ? translate('petAssistant.activity.runningAfterTool', { tool })
        : event
          ? translate('petAssistant.activity.runningAfterEvent', { event })
          : translate('petAssistant.activity.running'))
    case 'done':
      return preview ?? translate('petAssistant.activity.completed')
    case 'error':
      return preview ?? (tool ? translate('petAssistant.activity.failedAroundTool', { tool }) : translate('petAssistant.activity.failed'))
    case 'stale':
      return translate('petAssistant.activity.stale')
    case 'probably_closed':
      return translate('petAssistant.activity.probablyClosed')
    case 'idle':
      return translate('petAssistant.activity.idle')
    case 'closed':
      return translate('petAssistant.activity.closed')
    default:
      return statusLabel(session.status, translate)
  }
}

export function sessionActivityMeta(session: SessionSnapshot, translate: Translate) {
  const context = contextLabel(session.context_used_percentage, translate)
  if (displayName(session)) {
    return [displayProjectName(session, translate), shortSessionId(session.session_id, translate), context].filter(Boolean).join(' - ')
  }
  return [statusLabel(session.status, translate), context].filter(Boolean).join(' - ')
}

export function compareSessionsByActivity(a: SessionSnapshot, b: SessionSnapshot) {
  const priorityDelta = SESSION_STATUS_PRIORITY[a.status] - SESSION_STATUS_PRIORITY[b.status]
  if (priorityDelta !== 0) return priorityDelta
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
}

export function displayProjectName(session: SessionSnapshot, translate: Translate) {
  return safeInlineText(session.project_name) ?? projectNameFromCwd(session.cwd, translate)
}

export function shortSessionId(sessionId: string, translate: Translate) {
  const trimmed = sessionId.trim()
  return trimmed ? trimmed.slice(0, 6) : translate('petAssistant.localSession')
}

export function contextLabel(value: number | null | undefined, translate: Translate) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return translate('petAssistant.context', { value: Math.round(value) })
}

export function statusLabel(status: SessionStatus, translate: Translate) {
  return translate(`status.${status}`)
}

export function safeInlineText(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  return trimmed
}

function displayName(session: SessionSnapshot) {
  return safeInlineText(session.display_name)
}

function projectNameFromCwd(cwd: string, translate: Translate) {
  return cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? translate('petAssistant.fallbackProject')
}
