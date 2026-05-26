import { describe, expect, it } from 'vitest'
import type { SessionStatus } from '../sessions/sessionTypes'
import { getHighestPriorityStatus, statusToPetAnimation } from './petStateMapper'

describe('pet state mapper', () => {
  it.each([
    ['idle', 'idle'],
    ['running', 'running'],
    ['tool_running', 'running'],
    ['waiting_permission', 'waiting'],
    ['waiting_input', 'idle'],
    ['done', 'idle'],
    ['error', 'failed'],
    ['stale', 'idle'],
    ['probably_closed', 'idle'],
    ['closed', 'idle'],
  ] satisfies Array<[SessionStatus, ReturnType<typeof statusToPetAnimation>]>)(
    'maps %s to the Codex %s animation',
    (status, animation) => {
      expect(statusToPetAnimation(status)).toBe(animation)
    },
  )

  it('keeps permission waiting above running work', () => {
    expect(
      getHighestPriorityStatus([
        session('running'),
        session('tool_running'),
        session('waiting_permission'),
      ]),
    ).toBe('waiting_permission')
  })

  it('keeps idle prompt waiting below active work as a weak reminder', () => {
    expect(
      getHighestPriorityStatus([
        session('running'),
        session('tool_running'),
        session('waiting_input'),
      ]),
    ).toBe('tool_running')
  })
})

function session(status: SessionStatus) {
  return {
    session_id: status,
    project_name: 'agent-desktop-companion',
    cwd: 'E:/Codex Project/agent-desktop-companion',
    status,
    last_event: 'Status',
    updated_at: '2026-05-22T00:00:00.000Z',
    source: 'mock',
  } as const
}
