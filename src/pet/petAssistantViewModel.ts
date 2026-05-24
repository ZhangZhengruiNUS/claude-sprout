import type { SessionSnapshot, SessionStatus } from '../sessions/sessionTypes'
import i18n from '../i18n/i18n'
import {
  SESSION_STATUS_PRIORITY,
  sessionActivityDetail,
  sessionActivityMeta,
  sessionActivityTitle,
  type Translate,
} from '../sessions/sessionPresentation'

export type PetAssistantDisplayMode = 'minimal' | 'activity'
export type PetAssistantMessageTone = 'intervention' | 'complete' | 'failed'
export type PetAssistantCardTone = PetAssistantMessageTone | 'running' | 'quiet'

export type PetAssistantMessage = {
  key: string
  sessionId: string
  title: string
  detail: string
  meta: string
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

const defaultTranslate: Translate = (key, options) => i18n.getFixedT('en')(key, options)

const FINISHED_UNCLOSED_STATUSES = new Set<SessionStatus>(['done', 'error'])
const RUNNING_STATUSES = new Set<SessionStatus>(['running', 'tool_running'])
const INTERVENTION_STATUSES = new Set<SessionStatus>(['waiting_permission'])
const MESSAGE_STATUSES = new Set<SessionStatus>([
  'waiting_permission',
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
      .map((session) =>
        messageForSession(session, completionToastSeconds, conversationPreviewEnabled, translate),
      )
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
  return `${session.session_id}:${session.status}:${messageEventFingerprint(session)}`
}

export function petAssistantMessageKeysForSessions(sessions: SessionSnapshot[]) {
  const keys = new Set<string>()
  for (const session of sessions) {
    if (MESSAGE_STATUSES.has(session.status)) {
      keys.add(petAssistantMessageKey(session))
    }
  }
  return keys
}

export function prunePetAssistantMessageKeys(
  keys: ReadonlySet<string>,
  currentKeys: ReadonlySet<string>,
) {
  const next = new Set<string>()
  for (const key of keys) {
    if (currentKeys.has(key)) {
      next.add(key)
    }
  }
  return next
}

export function isPersistentPetMessage(status: SessionStatus, completionToastSeconds = 5) {
  return INTERVENTION_STATUSES.has(status) || status === 'error' || completionToastSeconds <= 0
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
  conversationPreviewEnabled: boolean,
  translate: Translate,
): PetAssistantMessage {
  const tone = messageTone(session.status)

  return {
    key: petAssistantMessageKey(session),
    sessionId: session.session_id,
    title: messageTitle(session, translate),
    detail: sessionActivityDetail(session, conversationPreviewEnabled, translate),
    meta: sessionActivityMeta(session, translate),
    tone,
    persistent: isPersistentPetMessage(session.status, completionToastSeconds),
    updatedAt: session.updated_at,
  }
}

function messageEventFingerprint(session: SessionSnapshot) {
  const endedAt = safeInlineText(session.ended_at)
  if (endedAt) return `ended:${endedAt}`
  return [
    safeInlineText(session.last_event) ?? 'event',
    safeInlineText(session.notification_type) ?? '',
    safeInlineText(session.last_tool) ?? '',
    safeInlineText(session.end_reason) ?? '',
  ].join('|')
}

function activityCardForSession(
  session: SessionSnapshot,
  conversationPreviewEnabled: boolean,
  translate: Translate,
): PetAssistantActivityCard {
  return {
    key: `${session.session_id}:${session.status}:${session.updated_at}`,
    sessionId: session.session_id,
    title: sessionActivityTitle(session, translate),
    detail: sessionActivityDetail(session, conversationPreviewEnabled, translate),
    meta: sessionActivityMeta(session, translate),
    status: session.status,
    tone: cardTone(session.status),
    updatedAt: session.updated_at,
  }
}

function messageTitle(session: SessionSnapshot, translate: Translate) {
  const subject = sessionActivityTitle(session, translate)
  switch (session.status) {
    case 'waiting_permission':
      return translate('petAssistant.title.waiting_permission', { project: subject })
    case 'done':
      return translate('petAssistant.title.done', { project: subject })
    case 'error':
      return translate('petAssistant.title.error', { project: subject })
    default:
      return subject
  }
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
  const priorityDelta = SESSION_STATUS_PRIORITY[a.status] - SESSION_STATUS_PRIORITY[b.status]
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

function safeInlineText(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  return trimmed
}

function clampVisibleCount(value: number) {
  if (!Number.isFinite(value)) return 3
  return Math.min(12, Math.max(1, Math.round(value)))
}
