import type { SessionSnapshot, SessionStatus } from './sessionTypes'
import i18n from '../i18n/i18n'

export type SessionNotification = {
  key: string
  title: string
  body: string
}

const NOTIFIABLE_STATUSES = new Set<SessionStatus>([
  'waiting_permission',
  'done',
  'error',
])

export function notificationsForSessionChanges(
  previousSessions: SessionSnapshot[],
  nextSessions: SessionSnapshot[],
  notifiedKeys: ReadonlySet<string> = new Set(),
) {
  const previousById = new Map(
    previousSessions.map((session) => [session.session_id, session.status] as const),
  )

  return nextSessions.flatMap((session) => {
    const previousStatus = previousById.get(session.session_id)
    if (previousStatus === session.status || !NOTIFIABLE_STATUSES.has(session.status)) {
      return []
    }

    const notification = notificationForSession(session)
    return notifiedKeys.has(notification.key) ? [] : [notification]
  })
}

export function sessionNotificationKey(session: SessionSnapshot) {
  return `${session.session_id}:${session.status}:${session.updated_at}`
}

export function notificationTitleForStatus(status: SessionStatus) {
  switch (status) {
    case 'waiting_permission':
      return i18n.t('notifications.waitingPermission')
    case 'done':
      return i18n.t('notifications.done')
    case 'error':
      return i18n.t('notifications.error')
    default:
      return i18n.t('notifications.fallback')
  }
}

function notificationForSession(session: SessionSnapshot): SessionNotification {
  return {
    key: sessionNotificationKey(session),
    title: notificationTitleForStatus(session.status),
    body: `${session.project_name} - ${session.cwd}`,
  }
}
