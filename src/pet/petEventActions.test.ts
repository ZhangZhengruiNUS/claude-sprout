import { describe, expect, it } from 'vitest'
import type { SessionSnapshot, SessionStatus } from '../sessions/sessionTypes'
import {
  nextPetEventActions,
  nextPetEventAction,
  petEventActionDurationMs,
  rememberPetEventAction,
} from './petEventActions'

describe('pet event actions', () => {
  it('waves once when a session enters waiting for permission', () => {
    const action = nextPetEventAction(
      [session({ id: 's1', status: 'running', lastEvent: 'PreToolUse' })],
      [
        session({
          id: 's1',
          status: 'waiting_permission',
          lastEvent: 'PermissionRequest',
          updatedAt: '2026-05-22T00:00:01.000Z',
        }),
      ],
      new Set(),
    )

    expect(action).toEqual({
      animation: 'waving',
      key: 's1:waiting_permission:PermissionRequest::2026-05-22T00:00:01.000Z',
      durationMs: petEventActionDurationMs.waving,
    })
  })

  it('jumps once when a session newly completes cleanly', () => {
    const action = nextPetEventAction(
      [session({ id: 's1', status: 'running', lastEvent: 'PostToolUse' })],
      [
        session({
          id: 's1',
          status: 'done',
          lastEvent: 'Stop',
          updatedAt: '2026-05-22T00:00:02.000Z',
        }),
      ],
      new Set(),
    )

    expect(action?.animation).toBe('jumping')
  })

  it('plays a failure reaction when a session newly fails', () => {
    const action = nextPetEventAction(
      [session({ id: 's1', status: 'tool_running', lastEvent: 'PreToolUse' })],
      [
        session({
          id: 's1',
          status: 'error',
          lastEvent: 'PostToolUseFailure',
          updatedAt: '2026-05-22T00:00:03.000Z',
        }),
      ],
      new Set(),
    )

    expect(action?.animation).toBe('failed')
  })

  it('does not replay an action for statusline heartbeat updates', () => {
    const previous = session({
      id: 's1',
      status: 'waiting_input',
      lastEvent: 'Notification',
      notificationType: 'idle_prompt',
      updatedAt: '2026-05-22T00:00:03.000Z',
    })
    const next = session({
      id: 's1',
      status: 'waiting_input',
      lastEvent: 'Notification',
      notificationType: 'idle_prompt',
      updatedAt: '2026-05-22T00:00:33.000Z',
    })

    expect(nextPetEventAction([previous], [next], new Set())).toBeNull()
  })

  it('does not replay a waiting action while the session remains waiting', () => {
    const previous = session({
      id: 's1',
      status: 'waiting_input',
      lastEvent: 'Notification',
      notificationType: 'idle_prompt',
      updatedAt: '2026-05-22T00:00:03.000Z',
    })
    const next = session({
      id: 's1',
      status: 'waiting_permission',
      lastEvent: 'PermissionRequest',
      notificationType: 'permission_prompt',
      updatedAt: '2026-05-22T00:00:04.000Z',
    })

    expect(nextPetEventAction([previous], [next], new Set())).toBeNull()
  })

  it('does not replay a remembered event action key', () => {
    const played = new Set<string>()
    const next = session({
      id: 's1',
      status: 'done',
      lastEvent: 'Stop',
      updatedAt: '2026-05-22T00:00:04.000Z',
    })
    const first = nextPetEventAction([], [next], played)
    expect(first?.animation).toBe('jumping')

    rememberPetEventAction(played, first?.key ?? '')

    expect(nextPetEventAction([], [next], played)).toBeNull()
  })

  it('returns every new action from a refresh so the caller can queue them', () => {
    const actions = nextPetEventActions(
      [
        session({ id: 'permission', status: 'running', lastEvent: 'PreToolUse' }),
        session({ id: 'failed', status: 'tool_running', lastEvent: 'PreToolUse' }),
        session({ id: 'done', status: 'running', lastEvent: 'PostToolUse' }),
      ],
      [
        session({
          id: 'done',
          status: 'done',
          lastEvent: 'Stop',
          updatedAt: '2026-05-22T00:00:04.000Z',
        }),
        session({
          id: 'failed',
          status: 'error',
          lastEvent: 'PostToolUseFailure',
          updatedAt: '2026-05-22T00:00:05.000Z',
        }),
        session({
          id: 'permission',
          status: 'waiting_permission',
          lastEvent: 'PermissionRequest',
          updatedAt: '2026-05-22T00:00:06.000Z',
        }),
      ],
      new Set(),
    )

    expect(actions.map((action) => action.animation)).toEqual(['waving', 'failed', 'jumping'])
  })

  it('does not wave for a newly discovered session start', () => {
    expect(
      nextPetEventAction(
        [],
        [
          session({
            id: 's1',
            status: 'running',
            lastEvent: 'SessionStart',
          }),
        ],
        new Set(),
      ),
    ).toBeNull()
  })

  it('does not include conversation previews in action keys', () => {
    const action = nextPetEventAction(
      [session({ id: 's1', status: 'running', lastEvent: 'PreToolUse' })],
      [
        session({
          id: 's1',
          status: 'done',
          lastEvent: 'Stop',
          updatedAt: '2026-05-22T00:00:04.000Z',
          conversationPreview: 'Claude: sensitive transcript text',
        }),
      ],
      new Set(),
    )

    expect(action?.key).toBe('s1:done:Stop::2026-05-22T00:00:04.000Z')
  })

  it('prefers a waiting-permission wave over lower-priority completion jumps', () => {
    const action = nextPetEventAction(
      [],
      [
        session({
          id: 'done',
          status: 'done',
          lastEvent: 'Stop',
          updatedAt: '2026-05-22T00:00:04.000Z',
        }),
        session({
          id: 'permission',
          status: 'waiting_permission',
          lastEvent: 'PermissionRequest',
          updatedAt: '2026-05-22T00:00:05.000Z',
        }),
      ],
      new Set(),
    )

    expect(action?.animation).toBe('waving')
    expect(action?.key.startsWith('permission:')).toBe(true)
  })
})

function session({
  id,
  status,
  lastEvent,
  notificationType = null,
  updatedAt = '2026-05-22T00:00:00.000Z',
  conversationPreview,
}: {
  id: string
  status: SessionStatus
  lastEvent: string
  notificationType?: string | null
  updatedAt?: string
  conversationPreview?: string
}): SessionSnapshot {
  return {
    session_id: id,
    project_name: 'claude-sprout',
    cwd: 'E:/Codex Project/claude-sprout',
    status,
    last_event: lastEvent,
    notification_type: notificationType,
    last_tool: 'Edit',
    context_used_percentage: 10,
    last_heartbeat_at: updatedAt,
    updated_at: updatedAt,
    ended_at: status === 'done' || status === 'error' || status === 'closed' ? updatedAt : null,
    end_reason: status === 'done' ? 'stop' : null,
    source: 'mock',
    conversation_preview: conversationPreview,
  }
}
