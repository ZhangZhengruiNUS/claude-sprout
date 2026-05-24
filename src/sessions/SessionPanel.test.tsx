import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import '../i18n/i18n'
import { SessionPanel } from './SessionPanel'
import type { SessionSnapshot } from './sessionTypes'

function session(extra: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    session_id: '4b05e339-c239-4363-a5b7-801b9dd2a734',
    project_name: 'claude-sprout',
    display_name: null,
    conversation_preview: null,
    cwd: 'E:\\Codex Project\\claude-sprout',
    status: 'tool_running',
    last_event: 'PreToolUse',
    notification_type: null,
    last_tool: 'Edit',
    context_used_percentage: 42,
    last_heartbeat_at: '2026-05-24T01:02:03Z',
    updated_at: '2026-05-24T01:02:04Z',
    ended_at: null,
    end_reason: null,
    source: 'test',
    ...extra,
  }
}

describe('SessionPanel', () => {
  it('uses the same display name and preview summary as Board cards when preview is enabled', () => {
    const html = renderToStaticMarkup(
      <SessionPanel
        sessions={[
          session({
            display_name: 'Release checklist polish',
            conversation_preview: 'Claude: Updated the session panel with richer details',
          }),
        ]}
        isLoading={false}
        conversationPreviewEnabled
        onRefresh={vi.fn()}
      />,
    )

    expect(html).toContain('Release checklist polish')
    expect(html).toContain('Claude: Updated the session panel with richer details')
    expect(html).toContain('claude-sprout - 4b05e3 - 42% ctx')
    expect(html).toContain('test')
  })

  it('keeps conversation preview hidden when the local opt-in setting is off', () => {
    const html = renderToStaticMarkup(
      <SessionPanel
        sessions={[
          session({
            conversation_preview: 'Claude: Secret-looking transcript text should stay hidden',
          }),
        ]}
        isLoading={false}
        conversationPreviewEnabled={false}
        onRefresh={vi.fn()}
      />,
    )

    expect(html).toContain('Using Edit')
    expect(html).not.toContain('Secret-looking')
  })

  it('defaults to active and actionable sessions instead of rendering all history', () => {
    const html = renderToStaticMarkup(
      <SessionPanel
        sessions={[
          session({
            session_id: 'running-session',
            display_name: 'Running work',
            status: 'running',
          }),
          session({
            session_id: 'done-session',
            display_name: 'Finished history',
            status: 'done',
          }),
          session({
            session_id: 'closed-session',
            display_name: 'Closed history',
            status: 'closed',
          }),
        ]}
        isLoading={false}
        onRefresh={vi.fn()}
      />,
    )

    expect(html).toContain('Active / needs action')
    expect(html).toContain('Running work')
    expect(html).not.toContain('Finished history')
    expect(html).not.toContain('Closed history')
  })

  it('shows page size and exact page counts for the current view', () => {
    const activeSessions = Array.from({ length: 12 }, (_, index) =>
      session({
        session_id: `active-${String(index + 1).padStart(2, '0')}`,
        display_name: `Active session ${index + 1}`,
        status: 'running',
        updated_at: new Date(Date.now() - index * 1_000).toISOString(),
      }),
    )

    const html = renderToStaticMarkup(
      <SessionPanel
        sessions={activeSessions}
        isLoading={false}
        onRefresh={vi.fn()}
      />,
    )

    expect(html).toContain('Per page')
    expect(html).toContain('1-10 of 12 · page 1/2')
    expect(html).toContain('Active session 10')
    expect(html).not.toContain('Active session 11')
  })
})
