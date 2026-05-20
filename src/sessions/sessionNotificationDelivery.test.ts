import { describe, expect, it, vi } from 'vitest'
import { deliverSessionNotifications } from './sessionNotificationDelivery'
import type { SessionNotification } from './sessionNotifications'

function notification(key: string): SessionNotification {
  return {
    key,
    title: 'Claude Code needs permission',
    body: 'claude-sprout - E:\\Codex Project\\claude-sprout',
  }
}

describe('session notification delivery', () => {
  it('does not mark notification keys as delivered when OS permission is denied', async () => {
    const notifiedKeys = new Set<string>()
    const pendingNotifications = new Map<string, SessionNotification>()
    const sendNotification = vi.fn()

    await deliverSessionNotifications({
      notifications: [notification('session-a:waiting_permission:2026-05-20T00:00:00Z')],
      pendingNotifications,
      notifiedKeys,
      isPermissionGranted: async () => false,
      requestPermission: async () => 'denied',
      sendNotification,
    })

    expect(sendNotification).not.toHaveBeenCalled()
    expect(notifiedKeys).toEqual(new Set())
  })

  it('keeps permission-denied notifications pending so they can be retried', async () => {
    const notifiedKeys = new Set<string>()
    const pendingNotifications = new Map<string, SessionNotification>()
    const sendNotification = vi.fn()
    const nextNotification = notification('session-a:waiting_permission:2026-05-20T00:00:00Z')

    await deliverSessionNotifications({
      notifications: [nextNotification],
      pendingNotifications,
      notifiedKeys,
      isPermissionGranted: async () => false,
      requestPermission: async () => 'denied',
      sendNotification,
    })

    await deliverSessionNotifications({
      notifications: [],
      pendingNotifications,
      notifiedKeys,
      isPermissionGranted: async () => true,
      requestPermission: async () => 'denied',
      sendNotification,
    })

    expect(sendNotification).toHaveBeenCalledWith({
      title: nextNotification.title,
      body: nextNotification.body,
    })
    expect(notifiedKeys).toEqual(new Set([nextNotification.key]))
    expect(pendingNotifications.size).toBe(0)
  })

  it('marks notification keys as delivered after sending with granted permission', async () => {
    const notifiedKeys = new Set<string>()
    const pendingNotifications = new Map<string, SessionNotification>()
    const sendNotification = vi.fn()
    const nextNotification = notification('session-a:done:2026-05-20T00:00:00Z')

    await deliverSessionNotifications({
      notifications: [nextNotification],
      pendingNotifications,
      notifiedKeys,
      isPermissionGranted: async () => true,
      requestPermission: async () => 'denied',
      sendNotification,
    })

    expect(sendNotification).toHaveBeenCalledWith({
      title: nextNotification.title,
      body: nextNotification.body,
    })
    expect(notifiedKeys).toEqual(new Set([nextNotification.key]))
  })
})
