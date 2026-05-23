import { describe, expect, it } from 'vitest'
import {
  buildPetAssistantView,
  petAssistantMessageKeysForSessions,
  petAssistantMessageKey,
  prunePetAssistantMessageKeys,
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

  it('only creates message cards for permission, completion, and failure states', () => {
    const waiting = session('waiting', 'waiting_input')
    const permission = session('permission', 'waiting_permission', undefined, {
      display_name: 'Release publish',
      last_tool: 'Bash',
      context_used_percentage: 18,
    })
    const done = session('done', 'done', undefined, {
      display_name: 'Docs cleanup',
      conversation_preview: 'Claude: Updated the release checklist',
      context_used_percentage: 42,
    })
    const error = session('error', 'error', undefined, {
      project_name: 'claude-sprout',
      last_tool: 'Edit',
      context_used_percentage: 64,
    })
    const view = buildPetAssistantView({
      sessions: [waiting, permission, done, error],
      displayMode: 'minimal',
      visibleCount: 3,
      conversationPreviewEnabled: true,
    })

    expect(view.actionableCount).toBe(1)
    expect(view.messages.map((message) => message.sessionId)).toEqual([
      'permission',
      'error',
      'done',
    ])
    expect(view.messages).toContainEqual(
      expect.objectContaining({
        key: petAssistantMessageKey(permission),
        title: 'Release publish needs permission',
        detail: 'Needs permission for Bash',
        meta: 'project-permission - permis - 18% ctx',
        tone: 'intervention',
        persistent: true,
      }),
    )
    expect(view.messages).toContainEqual(
      expect.objectContaining({
        key: petAssistantMessageKey(error),
        title: 'claude-sprout - error failed',
        detail: 'Failed around Edit',
        meta: 'error - 64% ctx',
        tone: 'failed',
        persistent: true,
      }),
    )
    expect(view.messages).toContainEqual(
      expect.objectContaining({
        key: petAssistantMessageKey(done),
        title: 'Docs cleanup finished',
        detail: 'Claude: Updated the release checklist',
        meta: 'project-done - done - 42% ctx',
        tone: 'complete',
        persistent: false,
      }),
    )
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

  it('keeps idle prompt cards below active work in activity mode', () => {
    const view = buildPetAssistantView({
      sessions: [
        session('waiting-input', 'waiting_input', '2026-05-22T00:04:00Z'),
        session('running', 'running', '2026-05-22T00:03:00Z'),
      ],
      displayMode: 'activity',
      visibleCount: 2,
    })

    expect(view.visibleActivityCards.map((card) => card.sessionId)).toEqual([
      'running',
      'waiting-input',
    ])
    expect(view.visibleActivityCards[1]).toEqual(
      expect.objectContaining({
        tone: 'quiet',
        detail: 'May be waiting for a reply',
      }),
    )
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
      conversationPreviewEnabled: true,
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

  it('shows conversation preview only when the setting is enabled', () => {
    const previewSession = session('preview', 'tool_running', undefined, {
      conversation_preview: 'Claude: Implemented the release checklist and is running tests',
      last_tool: 'Edit',
    })

    const disabled = buildPetAssistantView({
      sessions: [previewSession],
      displayMode: 'activity',
      visibleCount: 3,
      conversationPreviewEnabled: false,
    })
    const enabled = buildPetAssistantView({
      sessions: [previewSession],
      displayMode: 'activity',
      visibleCount: 3,
      conversationPreviewEnabled: true,
    })

    expect(disabled.visibleActivityCards[0].detail).toBe('Using Edit')
    expect(enabled.visibleActivityCards[0].detail).toBe(
      'Claude: Implemented the release checklist and is running tests',
    )
  })

  it('keeps message cards metadata-only when conversation preview is disabled', () => {
    const done = session('done', 'done', undefined, {
      display_name: 'Feature branch',
      conversation_preview: 'Claude: Secret-looking transcript text should stay hidden',
      last_tool: 'Write',
    })

    const view = buildPetAssistantView({
      sessions: [done],
      displayMode: 'minimal',
      visibleCount: 3,
      conversationPreviewEnabled: false,
    })

    expect(view.messages[0]).toEqual(
      expect.objectContaining({
        title: 'Feature branch finished',
        detail: 'Completed',
        meta: 'project-done - done',
      }),
    )
    expect(view.messages[0].detail).not.toContain('Secret-looking')
  })

  it('does not treat statusline heartbeat updates as new completion messages', () => {
    const completedAt = '2026-05-22T00:00:00Z'
    const firstDone = session('done', 'done', completedAt, {
      ended_at: completedAt,
      last_event: 'Stop',
    })
    const heartbeatRefreshedDone = session('done', 'done', '2026-05-22T00:01:00Z', {
      ended_at: completedAt,
      last_event: 'Stop',
      source: 'claude-code-statusline',
    })
    const firstSeenAt = new Date(completedAt).getTime()

    const view = buildPetAssistantView({
      sessions: [heartbeatRefreshedDone],
      displayMode: 'minimal',
      visibleCount: 3,
      completionToastSeconds: 5,
      messageFirstSeenAt: new Map([[petAssistantMessageKey(firstDone), firstSeenAt]]),
      now: new Date('2026-05-22T00:00:10Z'),
    })

    expect(view.messages).toEqual([])
  })

  it('keeps acknowledged message keys only while that logical message is still current', () => {
    const permission = session('permission', 'waiting_permission', '2026-05-22T00:00:00Z', {
      last_event: 'PermissionRequest',
      last_tool: 'Bash',
    })
    const heartbeatRefreshedPermission = session(
      'permission',
      'waiting_permission',
      '2026-05-22T00:01:00Z',
      {
        last_event: 'PermissionRequest',
        last_tool: 'Bash',
        source: 'claude-code-statusline',
      },
    )
    const running = session('permission', 'running', '2026-05-22T00:02:00Z', {
      last_event: 'PostToolUse',
      last_tool: 'Bash',
    })
    const acknowledged = new Set([petAssistantMessageKey(permission)])

    expect(petAssistantMessageKey(heartbeatRefreshedPermission)).toBe(
      petAssistantMessageKey(permission),
    )
    expect(
      [...prunePetAssistantMessageKeys(
        acknowledged,
        petAssistantMessageKeysForSessions([heartbeatRefreshedPermission]),
      )],
    ).toEqual([petAssistantMessageKey(permission)])
    expect(
      [...prunePetAssistantMessageKeys(
        acknowledged,
        petAssistantMessageKeysForSessions([running]),
      )],
    ).toEqual([])
  })
})
