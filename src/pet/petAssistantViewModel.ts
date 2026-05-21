import type { SessionSnapshot, SessionStatus } from '../sessions/sessionTypes'

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
}

const STATUS_PRIORITY: Record<SessionStatus, number> = {
  waiting_permission: 0,
  waiting_input: 1,
  error: 2,
  tool_running: 3,
  running: 4,
  done: 5,
  stale: 6,
  probably_closed: 7,
  idle: 8,
  closed: 9,
}

const FINISHED_UNCLOSED_STATUSES = new Set<SessionStatus>(['done', 'error'])
const RUNNING_STATUSES = new Set<SessionStatus>(['running', 'tool_running'])
const INTERVENTION_STATUSES = new Set<SessionStatus>(['waiting_permission', 'waiting_input'])
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
}: BuildPetAssistantViewOptions): PetAssistantView {
  const runningCount = sessions.filter((session) => RUNNING_STATUSES.has(session.status)).length
  const finishedUnclosedCount = sessions.filter((session) =>
    FINISHED_UNCLOSED_STATUSES.has(session.status),
  ).length
  const actionableCount = sessions.filter((session) => INTERVENTION_STATUSES.has(session.status)).length
  const activityCards = sessions
    .filter((session) => session.status !== 'closed')
    .map((session) => activityCardForSession(session, conversationPreviewEnabled))
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
      .map((session) => messageForSession(session, completionToastSeconds))
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
): PetAssistantMessage {
  const tone = messageTone(session.status)

  return {
    key: petAssistantMessageKey(session),
    sessionId: session.session_id,
    title: messageTitle(session),
    detail: sessionMessageDetail(session),
    tone,
    persistent: isPersistentPetMessage(session.status, completionToastSeconds),
    updatedAt: session.updated_at,
  }
}

function activityCardForSession(
  session: SessionSnapshot,
  conversationPreviewEnabled: boolean,
): PetAssistantActivityCard {
  return {
    key: `${session.session_id}:${session.status}:${session.updated_at}`,
    sessionId: session.session_id,
    title: activityTitle(session),
    detail: sessionActivityDetail(session, conversationPreviewEnabled),
    meta: sessionActivityMeta(session),
    status: session.status,
    tone: cardTone(session.status),
    updatedAt: session.updated_at,
  }
}

function messageTitle(session: SessionSnapshot) {
  switch (session.status) {
    case 'waiting_permission':
      return `${displayProjectName(session)} needs permission`
    case 'waiting_input':
      return `${displayProjectName(session)} needs a reply`
    case 'done':
      return `${displayProjectName(session)} finished`
    case 'error':
      return `${displayProjectName(session)} failed`
    default:
      return displayProjectName(session)
  }
}

function sessionMessageDetail(session: SessionSnapshot) {
  if (session.last_tool) return `${statusLabel(session.status)} - ${session.last_tool}`
  if (session.last_event) return `${statusLabel(session.status)} - ${session.last_event}`
  return `${statusLabel(session.status)} - ${projectNameFromCwd(session.cwd)}`
}

function sessionActivityDetail(session: SessionSnapshot, conversationPreviewEnabled: boolean) {
  const tool = safeInlineText(session.last_tool)
  const event = safeInlineText(session.last_event)
  const preview = conversationPreviewEnabled ? safeInlineText(session.conversation_preview) : null
  switch (session.status) {
    case 'waiting_permission':
      return tool ? `Needs permission for ${tool}` : 'Needs permission'
    case 'waiting_input':
      return 'Waiting for your reply'
    case 'tool_running':
      return preview ?? (tool ? `Using ${tool}` : 'Using tool')
    case 'running':
      return preview ?? (tool ? `Continuing after ${tool}` : event ? `Running after ${event}` : 'Running')
    case 'done':
      return preview ?? 'Completed'
    case 'error':
      return preview ?? (tool ? `Failed around ${tool}` : 'Failed')
    case 'stale':
      return 'No heartbeat recently'
    case 'probably_closed':
      return 'Probably closed'
    case 'idle':
      return 'Idle'
    case 'closed':
      return 'Closed'
    default:
      return statusLabel(session.status)
  }
}

function sessionActivityMeta(session: SessionSnapshot) {
  const context = contextLabel(session.context_used_percentage)
  if (displayName(session)) {
    return [displayProjectName(session), shortSessionId(session.session_id), context].filter(Boolean).join(' - ')
  }
  return [statusLabel(session.status), context].filter(Boolean).join(' - ')
}

function activityTitle(session: SessionSnapshot) {
  return displayName(session) ?? `${displayProjectName(session)} - ${shortSessionId(session.session_id)}`
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

function displayProjectName(session: SessionSnapshot) {
  return session.project_name || projectNameFromCwd(session.cwd)
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

function shortSessionId(sessionId: string) {
  const trimmed = sessionId.trim()
  return trimmed ? trimmed.slice(0, 6) : 'local'
}

function contextLabel(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return `${Math.round(value)}% ctx`
}

function projectNameFromCwd(cwd: string) {
  return cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? 'Claude Code'
}

function statusLabel(status: SessionStatus) {
  return status.replaceAll('_', ' ')
}

function clampVisibleCount(value: number) {
  if (!Number.isFinite(value)) return 3
  return Math.min(12, Math.max(1, Math.round(value)))
}
