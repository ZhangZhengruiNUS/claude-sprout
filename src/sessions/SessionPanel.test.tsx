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
})
