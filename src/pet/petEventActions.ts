import type { SessionSnapshot } from '../sessions/sessionTypes'
import type { PetAnimation } from './petStateMapper'

export type PetEventAction = {
  animation: Extract<PetAnimation, 'waving' | 'jumping' | 'failed'>
  key: string
  durationMs: number
}

export const petEventActionDurationMs = {
  waving: 760,
  jumping: 920,
  failed: 1280,
} satisfies Record<PetEventAction['animation'], number>

const ACTION_PRIORITY: Record<PetEventAction['animation'], number> = {
  waving: 0,
  failed: 1,
  jumping: 2,
}

const WAITING_STATUSES = new Set(['waiting_permission', 'waiting_input'])

export function nextPetEventAction(
  previousSessions: SessionSnapshot[],
  nextSessions: SessionSnapshot[],
  playedKeys: ReadonlySet<string>,
): PetEventAction | null {
  return nextPetEventActions(previousSessions, nextSessions, playedKeys)[0] ?? null
}

export function nextPetEventActions(
  previousSessions: SessionSnapshot[],
  nextSessions: SessionSnapshot[],
  playedKeys: ReadonlySet<string>,
): PetEventAction[] {
  const previousById = new Map(
    previousSessions.map((session) => [session.session_id, session] as const),
  )

  return nextSessions
    .map((session) => actionForSession(previousById.get(session.session_id), session))
    .filter((action): action is PetEventAction => action !== null)
    .filter((action) => !playedKeys.has(action.key))
    .sort(comparePetEventActions)
}

export function rememberPetEventAction(playedKeys: Set<string>, key: string, limit = 200) {
  if (!key) return
  playedKeys.add(key)
  while (playedKeys.size > limit) {
    const oldest = playedKeys.values().next().value as string | undefined
    if (!oldest) return
    playedKeys.delete(oldest)
  }
}

function actionForSession(
  previousSession: SessionSnapshot | undefined,
  nextSession: SessionSnapshot,
): PetEventAction | null {
  if (isWaitingStatus(nextSession.status) && !isWaitingStatus(previousSession?.status)) {
    return petAction('waving', nextSession)
  }

  if (nextSession.status === 'error' && previousSession?.status !== 'error') {
    return petAction('failed', nextSession)
  }

  if (nextSession.status === 'done' && previousSession?.status !== 'done') {
    return petAction('jumping', nextSession)
  }

  return null
}

function isWaitingStatus(status: string | undefined) {
  return typeof status === 'string' && WAITING_STATUSES.has(status)
}

function petAction(animation: PetEventAction['animation'], session: SessionSnapshot): PetEventAction {
  return {
    animation,
    key: [
      session.session_id,
      session.status,
      session.last_event,
      session.notification_type ?? '',
      session.updated_at,
    ].join(':'),
    durationMs: petEventActionDurationMs[animation],
  }
}

function comparePetEventActions(left: PetEventAction, right: PetEventAction) {
  const priorityDelta = ACTION_PRIORITY[left.animation] - ACTION_PRIORITY[right.animation]
  if (priorityDelta !== 0) return priorityDelta
  return left.key.localeCompare(right.key)
}
