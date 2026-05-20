import type { SessionNotification } from './sessionNotifications'

type NotificationPermission = 'granted' | string

export type SessionNotificationDeliveryDependencies = {
  notifications: SessionNotification[]
  pendingNotifications: Map<string, SessionNotification>
  notifiedKeys: Set<string>
  isPermissionGranted: () => Promise<boolean>
  requestPermission: () => Promise<NotificationPermission>
  sendNotification: (notification: { title: string; body: string }) => void
}

export async function deliverSessionNotifications({
  notifications,
  pendingNotifications,
  notifiedKeys,
  isPermissionGranted,
  requestPermission,
  sendNotification,
}: SessionNotificationDeliveryDependencies) {
  for (const notification of notifications) {
    if (!notifiedKeys.has(notification.key)) {
      pendingNotifications.set(notification.key, notification)
    }
  }

  if (pendingNotifications.size === 0) return

  let permissionGranted = await isPermissionGranted()
  if (!permissionGranted) {
    permissionGranted = (await requestPermission()) === 'granted'
  }
  if (!permissionGranted) return

  for (const notification of pendingNotifications.values()) {
    sendNotification({ title: notification.title, body: notification.body })
    notifiedKeys.add(notification.key)
    pendingNotifications.delete(notification.key)
  }
}
