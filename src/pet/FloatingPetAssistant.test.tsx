import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FloatingPetAssistant } from './FloatingPetAssistant'
import type { PetAssistantView } from './petAssistantViewModel'

const baseView: PetAssistantView = {
  displayMode: 'activity',
  runningCount: 0,
  finishedUnclosedCount: 0,
  actionableCount: 0,
  activityCards: [],
  visibleActivityCards: [],
  overflowCount: 0,
  messages: [],
}

describe('FloatingPetAssistant', () => {
  it('does not render the activity HUD when there are no open activity cards', () => {
    const html = renderToStaticMarkup(
      <FloatingPetAssistant
        view={baseView}
        activityPage={0}
        onActivityPageChange={vi.fn()}
        onAcknowledgeMessage={vi.fn()}
        onOpenPanel={vi.fn()}
      />,
    )

    expect(html).not.toContain('pet-activity-hud')
    expect(html).not.toContain('No open sessions')
  })

  it('renders the activity HUD when at least one activity card is visible', () => {
    const html = renderToStaticMarkup(
      <FloatingPetAssistant
        view={{
          ...baseView,
          activityCards: [
            {
              key: 'session:running:now',
              sessionId: 'session',
              title: 'claude-sprout - session',
              detail: 'Using Edit',
              meta: 'running - 12% ctx',
              status: 'tool_running',
              tone: 'running',
              updatedAt: '2026-05-22T00:00:00.000Z',
            },
          ],
          visibleActivityCards: [
            {
              key: 'session:running:now',
              sessionId: 'session',
              title: 'claude-sprout - session',
              detail: 'Using Edit',
              meta: 'running - 12% ctx',
              status: 'tool_running',
              tone: 'running',
              updatedAt: '2026-05-22T00:00:00.000Z',
            },
          ],
        }}
        activityPage={0}
        onActivityPageChange={vi.fn()}
        onAcknowledgeMessage={vi.fn()}
        onOpenPanel={vi.fn()}
      />,
    )

    expect(html).toContain('pet-activity-hud')
    expect(html).toContain('Using Edit')
  })

  it('shows total activity count in the header instead of overflow count', () => {
    const card = {
      key: 'session:running:now',
      sessionId: 'session',
      title: 'claude-sprout - session',
      detail: 'Using Edit',
      meta: 'running - 12% ctx',
      status: 'tool_running' as const,
      tone: 'running' as const,
      updatedAt: '2026-05-22T00:00:00.000Z',
    }

    const html = renderToStaticMarkup(
      <FloatingPetAssistant
        view={{
          ...baseView,
          activityCards: [
            card,
            { ...card, key: 'session-2', sessionId: 'session-2' },
            { ...card, key: 'session-3', sessionId: 'session-3' },
            { ...card, key: 'session-4', sessionId: 'session-4' },
          ],
          visibleActivityCards: [
            card,
            { ...card, key: 'session-2', sessionId: 'session-2' },
            { ...card, key: 'session-3', sessionId: 'session-3' },
          ],
          overflowCount: 1,
        }}
        activityPage={0}
        onActivityPageChange={vi.fn()}
        onAcknowledgeMessage={vi.fn()}
        onOpenPanel={vi.fn()}
      />,
    )

    expect(html).toContain('<small>4</small>')
    expect(html).not.toContain('+1')
  })

  it('renders rich context on Message mode cards', () => {
    const html = renderToStaticMarkup(
      <FloatingPetAssistant
        view={{
          ...baseView,
          displayMode: 'minimal',
          messages: [
            {
              key: 'release:done:2026-05-23T00:00:00Z',
              sessionId: 'release',
              title: 'Release publish finished',
              detail: 'Claude: Built the release checklist',
              meta: 'claude-sprout - releas - 42% ctx',
              tone: 'complete',
              persistent: false,
              updatedAt: '2026-05-23T00:00:00Z',
            },
          ],
        }}
        activityPage={0}
        onActivityPageChange={vi.fn()}
        onAcknowledgeMessage={vi.fn()}
        onOpenPanel={vi.fn()}
      />,
    )

    expect(html).toContain('Release publish finished')
    expect(html).toContain('Claude: Built the release checklist')
    expect(html).toContain('claude-sprout - releas - 42% ctx')
  })
})
