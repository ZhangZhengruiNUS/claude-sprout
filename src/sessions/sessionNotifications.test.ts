import { describe, expect, it } from 'vitest'
import { notificationsForSessionChanges } from './sessionNotifications'
import type { SessionSnapshot, SessionStatus } from './sessionTypes'

function session(session_id: string, status: SessionStatus): SessionSnapshot {
  return {
    session_id,
    project_name: 'claude-sprout',
    cwd: 'E:\\Codex Project\\claude-sprout',
    status,
    last_event: 'Notification',
    updated_at: '2026-05-20T00:00:00Z',
    source: 'test',
  }
}

describe('session notifications', () => {
  it('notifies when a tracked session enters a notifiable status', () => {
    expect(notificationsForSessionChanges([session('a', 'running')], [session('a', 'waiting_input')]))
      .toEqual([
        {
          key: 'a:waiting_input:2026-05-20T00:00:00Z',
          title: 'Claude Code is waiting for input',
          body: 'claude-sprout - E:\\Codex Project\\claude-sprout',
        },
      ])
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
