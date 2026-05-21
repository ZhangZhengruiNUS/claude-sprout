import { describe, expect, it } from 'vitest'
import type { SessionStatus } from '../sessions/sessionTypes'
import { getHighestPriorityStatus, statusToPetAnimation } from './petStateMapper'

describe('pet state mapper', () => {
  it.each([
    ['idle', 'idle'],
    ['running', 'running'],
    ['tool_running', 'running'],
    ['waiting_permission', 'waiting'],
    ['waiting_input', 'waiting'],
    ['done', 'review'],
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

  it('keeps actionable waiting statuses above running work', () => {
    expect(
      getHighestPriorityStatus([
        session('running'),
        session('tool_running'),
        session('waiting_input'),
      ]),
    ).toBe('waiting_input')
  })
})

function session(status: SessionStatus) {
  return {
    session_id: status,
    project_name: 'claude-sprout',
    cwd: 'E:/Codex Project/claude-sprout',
    status,
    last_event: 'Status',
    updated_at: '2026-05-22T00:00:00.000Z',
    source: 'mock',
  } as const
}
