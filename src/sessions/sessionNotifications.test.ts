import { describe, expect, it } from 'vitest'
import { notificationsForSessionChanges } from './sessionNotifications'
import type { SessionSnapshot, SessionStatus } from './sessionTypes'

function session(session_id: string, status: SessionStatus): SessionSnapshot {
  return {
    session_id,
    project_name: 'agent-desktop-companion',
    cwd: 'E:\\Codex Project\\agent-desktop-companion',
    status,
    last_event: 'Notification',
    updated_at: '2026-05-20T00:00:00Z',
    source: 'test',
  }
}

describe('session notifications', () => {
  it('notifies when a tracked session enters a strong notifiable status', () => {
    expect(notificationsForSessionChanges([session('a', 'running')], [session('a', 'waiting_permission')]))
      .toEqual([
        {
          key: 'a:waiting_permission:2026-05-20T00:00:00Z',
          title: 'Claude Code needs permission',
          body: 'agent-desktop-companion - E:\\Codex Project\\agent-desktop-companion',
        },
      ])
  })

  it('does not notify for idle prompt waiting because it is a weak reminder', () => {
    expect(notificationsForSessionChanges([session('a', 'running')], [session('a', 'waiting_input')]))
      .toEqual([])
  })

  it('does not notify when status is unchanged', () => {
    expect(
      notificationsForSessionChanges(
        [session('a', 'waiting_permission')],
        [session('a', 'waiting_permission')],
      ),
    ).toEqual([])
  })

  it('ignores non-notifiable status transitions', () => {
    expect(notificationsForSessionChanges([session('a', 'idle')], [session('a', 'running')])).toEqual([])
  })

  it('does not notify a transition key that has already been sent', () => {
    expect(
      notificationsForSessionChanges(
        [session('a', 'running')],
        [session('a', 'error')],
        new Set(['a:error:2026-05-20T00:00:00Z']),
      ),
    ).toEqual([])
  })
})
