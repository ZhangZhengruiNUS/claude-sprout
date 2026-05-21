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
  extra: Partial<SessionSnapshot> = {},
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
    ...extra,
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

  it('uses a renamed display name and short session id to distinguish activity cards', () => {
    const view = buildPetAssistantView({
      sessions: [
        session('4b05e339-c239-4363-a5b7-801b9dd2a734', 'waiting_permission', undefined, {
          project_name: 'ASUS',
          display_name: 'Release checklist polish',
          last_tool: 'Bash',
          context_used_percentage: 18,
        }),
      ],
      displayMode: 'activity',
      visibleCount: 3,
    })

    expect(view.visibleActivityCards[0]).toEqual(
      expect.objectContaining({
        title: 'Release checklist polish',
        detail: 'Needs permission for Bash',
        meta: 'ASUS - 4b05e3 - 18% ctx',
      }),
    )
  })

  it('falls back to project name plus short session id when no display name is available', () => {
    const view = buildPetAssistantView({
      sessions: [
        session('705f8d92-4463-4553-9842-a090d5129c58', 'tool_running', undefined, {
          project_name: 'ASUS',
          last_tool: 'Edit',
        }),
      ],
      displayMode: 'activity',
      visibleCount: 3,
    })

    expect(view.visibleActivityCards[0]).toEqual(
      expect.objectContaining({
        title: 'ASUS - 705f8d',
        detail: 'Using Edit',
        meta: 'tool running',
      }),
    )
  })
})
