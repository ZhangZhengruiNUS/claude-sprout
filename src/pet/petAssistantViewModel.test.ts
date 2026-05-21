import { describe, expect, it } from 'vitest'
import {
  buildPetAssistantView,
  petAssistantMessageKey,
  type PetAssistantDisplayMode,
} from './petAssistantViewModel'
import type { SessionSnapshot, SessionStatus } from '../sessions/sessionTypes'

function session(
  session_id: string,
  status: SessionStatus,
  updated_at = '2026-05-22T00:00:00Z',
): SessionSnapshot {
  return {
    session_id,
    project_name: `project-${session_id}`,
    cwd: `E:\\Codex Project\\project-${session_id}`,
    status,
    last_event: status === 'tool_running' ? 'PreToolUse' : 'Notification',
    last_tool: status === 'tool_running' ? 'Edit' : null,
    updated_at,
    source: 'test',
  }
}

describe('pet assistant view model', () => {
  it('counts running and finished unclosed sessions for minimal mode', () => {
    const view = buildPetAssistantView({
      sessions: [
        session('running', 'running'),
        session('tool', 'tool_running'),
        session('done', 'done'),
        session('error', 'error'),
        session('closed', 'closed'),
      ],
      displayMode: 'minimal',
      visibleCount: 3,
    })

    expect(view.runningCount).toBe(2)
    expect(view.finishedUnclosedCount).toBe(2)
  })

  it('keeps intervention messages persistent and completion messages configurable', () => {
    const waiting = session('waiting', 'waiting_input')
    const done = session('done', 'done')
    const view = buildPetAssistantView({
      sessions: [waiting, done],
      displayMode: 'minimal',
      visibleCount: 3,
    })

    expect(view.messages).toEqual([
      expect.objectContaining({
        key: petAssistantMessageKey(waiting),
        tone: 'intervention',
        persistent: true,
      }),
      expect.objectContaining({
        key: petAssistantMessageKey(done),
        tone: 'complete',
        persistent: false,
      }),
    ])
  })

  it('sorts activity cards by action priority and reports overflow', () => {
    const view = buildPetAssistantView({
      sessions: [
        session('done', 'done', '2026-05-22T00:01:00Z'),
        session('running', 'running', '2026-05-22T00:03:00Z'),
        session('waiting', 'waiting_permission', '2026-05-22T00:02:00Z'),
        session('closed', 'closed', '2026-05-22T00:04:00Z'),
      ],
      displayMode: 'activity' satisfies PetAssistantDisplayMode,
      visibleCount: 2,
    })

    expect(view.visibleActivityCards.map((card) => card.sessionId)).toEqual(['waiting', 'running'])
    expect(view.overflowCount).toBe(1)
  })
})
