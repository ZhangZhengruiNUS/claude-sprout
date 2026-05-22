import type { SessionSnapshot, SessionStatus } from '../sessions/sessionTypes'
import i18n from '../i18n/i18n'

export type PetAssistantDisplayMode = 'minimal' | 'activity'
export type PetAssistantMessageTone = 'intervention' | 'complete' | 'failed'
export type PetAssistantCardTone = PetAssistantMessageTone | 'running' | 'quiet'

export type PetAssistantMessage = {
  key: string
  sessionId: string
  title: string
  detail: string
  tone: PetAssistantMessageTone
  persistent: boolean
  updatedAt: string
}

export type PetAssistantActivityCard = {
  key: string
  sessionId: string
  title: string
  detail: string
  meta: string
  status: SessionStatus
  tone: PetAssistantCardTone
  updatedAt: string
}

export type PetAssistantView = {
  displayMode: PetAssistantDisplayMode
  runningCount: number
  finishedUnclosedCount: number
  actionableCount: number
  activityCards: PetAssistantActivityCard[]
  visibleActivityCards: PetAssistantActivityCard[]
  overflowCount: number
  messages: PetAssistantMessage[]
}

type BuildPetAssistantViewOptions = {
  sessions: SessionSnapshot[]
  displayMode: PetAssistantDisplayMode
  visibleCount: number
  acknowledgedMessageKeys?: ReadonlySet<string>
  now?: Date
  completionToastSeconds?: number
  messageFirstSeenAt?: ReadonlyMap<string, number>
  conversationPreviewEnabled?: boolean
  translate?: Translate
}

type Translate = (key: string, options?: Record<string, unknown>) => string

const defaultTranslate: Translate = (key, options) => i18n.getFixedT('en')(key, options)

const STATUS_PRIORITY: Record<SessionStatus, number> = {
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

const FINISHED_UNCLOSED_STATUSES = new Set<SessionStatus>(['done', 'error'])
const RUNNING_STATUSES = new Set<SessionStatus>(['running', 'tool_running'])
const INTERVENTION_STATUSES = new Set<SessionStatus>(['waiting_permission'])
const MESSAGE_STATUSES = new Set<SessionStatus>([
  'waiting_permission',
  'waiting_input',
  'done',
  'error',
])
export const PET_ASSISTANT_MESSAGE_STATUSES = MESSAGE_STATUSES

export function buildPetAssistantView({
  sessions,
  displayMode,
  visibleCount,
  acknowledgedMessageKeys = new Set(),
  now = new Date(),
  completionToastSeconds = 5,
  messageFirstSeenAt = new Map(),
  conversationPreviewEnabled = false,
  translate = defaultTranslate,
}: BuildPetAssistantViewOptions): PetAssistantView {
  const runningCount = sessions.filter((session) => RUNNING_STATUSES.has(session.status)).length
  const finishedUnclosedCount = sessions.filter((session) =>
    FINISHED_UNCLOSED_STATUSES.has(session.status),
  ).length
  const actionableCount = sessions.filter((session) => INTERVENTION_STATUSES.has(session.status)).length
  const activityCards = sessions
    .filter((session) => session.status !== 'closed')
    .map((session) => activityCardForSession(session, conversationPreviewEnabled, translate))
    .sort(compareCards)
  const safeVisibleCount = clampVisibleCount(visibleCount)
  const visibleActivityCards = activityCards.slice(0, safeVisibleCount)

  return {
    displayMode,
    runningCount,
    finishedUnclosedCount,
    actionableCount,
    activityCards,
    visibleActivityCards,
    overflowCount: Math.max(0, activityCards.length - visibleActivityCards.length),
    messages: sessions
      .filter((session) => MESSAGE_STATUSES.has(session.status))
      .map((session) => messageForSession(session, completionToastSeconds, translate))
      .filter((message) =>
        shouldShowMessage({
          message,
          acknowledgedMessageKeys,
          now,
          completionToastSeconds,
          messageFirstSeenAt,
        }),
      )
      .sort(compareMessages),
  }
}

export function petAssistantMessageKey(session: SessionSnapshot) {
  return `${session.session_id}:${session.status}:${session.updated_at}`
}

export function isPersistentPetMessage(status: SessionStatus, completionToastSeconds = 5) {
  return INTERVENTION_STATUSES.has(status) || completionToastSeconds <= 0
}

function shouldShowMessage({
  message,
  acknowledgedMessageKeys,
  now,
  completionToastSeconds,
  messageFirstSeenAt,
}: {
  message: PetAssistantMessage
  acknowledgedMessageKeys: ReadonlySet<string>
  now: Date
  completionToastSeconds: number
  messageFirstSeenAt: ReadonlyMap<string, number>
}) {
  if (acknowledgedMessageKeys.has(message.key)) return false
  if (message.persistent) return true
  const firstSeenAt = messageFirstSeenAt.get(message.key) ?? now.getTime()
  return now.getTime() - firstSeenAt < Math.max(0, completionToastSeconds) * 1000
}

function messageForSession(
  session: SessionSnapshot,
  completionToastSeconds: number,
  translate: Translate,
): PetAssistantMessage {
  const tone = messageTone(session.status)

  return {
    key: petAssistantMessageKey(session),
    sessionId: session.session_id,
    title: messageTitle(session, translate),
    detail: sessionMessageDetail(session, translate),
    tone,
    persistent: isPersistentPetMessage(session.status, completionToastSeconds),
    updatedAt: session.updated_at,
  }
}

function activityCardForSession(
  session: SessionSnapshot,
  conversationPreviewEnabled: boolean,
  translate: Translate,
): PetAssistantActivityCard {
  return {
    key: `${session.session_id}:${session.status}:${session.updated_at}`,
    sessionId: session.session_id,
    title: activityTitle(session, translate),
    detail: sessionActivityDetail(session, conversationPreviewEnabled, translate),
    meta: sessionActivityMeta(session, translate),
    status: session.status,
    tone: cardTone(session.status),
    updatedAt: session.updated_at,
  }
}

function messageTitle(session: SessionSnapshot, translate: Translate) {
  const project = displayProjectName(session, translate)
  switch (session.status) {
    case 'waiting_permission':
      return translate('petAssistant.title.waiting_permission', { project })
    case 'waiting_input':
      return translate('petAssistant.title.waiting_input', { project })
    case 'done':
      return translate('petAssistant.title.done', { project })
    case 'error':
      return translate('petAssistant.title.error', { project })
    default:
      return project
  }
}

function sessionMessageDetail(session: SessionSnapshot, translate: Translate) {
  if (session.last_tool) {
    return translate('petAssistant.detailWithTool', {
      status: statusLabel(session.status, translate),
      tool: session.last_tool,
    })
  }
  if (session.last_event) {
    return translate('petAssistant.detailWithEvent', {
      status: statusLabel(session.status, translate),
      event: session.last_event,
    })
  }
  return translate('petAssistant.detailWithProject', {
    status: statusLabel(session.status, translate),
    project: projectNameFromCwd(session.cwd, translate),
  })
}

function sessionActivityDetail(
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

function sessionActivityMeta(session: SessionSnapshot, translate: Translate) {
  const context = contextLabel(session.context_used_percentage, translate)
  if (displayName(session)) {
    return [displayProjectName(session, translate), shortSessionId(session.session_id, translate), context].filter(Boolean).join(' - ')
  }
  return [statusLabel(session.status, translate), context].filter(Boolean).join(' - ')
}

function activityTitle(session: SessionSnapshot, translate: Translate) {
  return displayName(session) ?? translate('petAssistant.activity.titleWithSession', {
    project: displayProjectName(session, translate),
    sessionId: shortSessionId(session.session_id, translate),
  })
}

function messageTone(status: SessionStatus): PetAssistantMessageTone {
  if (INTERVENTION_STATUSES.has(status)) return 'intervention'
  if (status === 'error') return 'failed'
  return 'complete'
}

function cardTone(status: SessionStatus): PetAssistantCardTone {
  if (INTERVENTION_STATUSES.has(status)) return 'intervention'
  if (status === 'error') return 'failed'
  if (RUNNING_STATUSES.has(status)) return 'running'
  if (status === 'done') return 'complete'
  return 'quiet'
}

function compareCards(a: PetAssistantActivityCard, b: PetAssistantActivityCard) {
  const priorityDelta = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
  if (priorityDelta !== 0) return priorityDelta
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
}

function compareMessages(a: PetAssistantMessage, b: PetAssistantMessage) {
  const aPriority = messagePriority(a.tone)
  const bPriority = messagePriority(b.tone)
  if (aPriority !== bPriority) return aPriority - bPriority
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
}

function messagePriority(tone: PetAssistantMessageTone) {
  if (tone === 'intervention') return 0
  if (tone === 'failed') return 1
  return 2
}

function displayProjectName(session: SessionSnapshot, translate: Translate) {
  return session.project_name || projectNameFromCwd(session.cwd, translate)
}

function displayName(session: SessionSnapshot) {
  return safeInlineText(session.display_name)
}

function safeInlineText(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  return trimmed
}

function shortSessionId(sessionId: string, translate: Translate) {
  const trimmed = sessionId.trim()
  return trimmed ? trimmed.slice(0, 6) : translate('petAssistant.localSession')
}

function contextLabel(value: number | null | undefined, translate: Translate) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return translate('petAssistant.context', { value: Math.round(value) })
}

function projectNameFromCwd(cwd: string, translate: Translate) {
  return cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? translate('petAssistant.fallbackProject')
}

function statusLabel(status: SessionStatus, translate: Translate) {
  return translate(`status.${status}`)
}

function clampVisibleCount(value: number) {
  if (!Number.isFinite(value)) return 3
  return Math.min(12, Math.max(1, Math.round(value)))
}
