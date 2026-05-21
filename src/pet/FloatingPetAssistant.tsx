import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import type { PetAssistantActivityCard, PetAssistantMessage, PetAssistantView } from './petAssistantViewModel'

type Props = {
  view: PetAssistantView
  activityPage: number
  onActivityPageChange: (page: number) => void
  onAcknowledgeMessage: (key: string) => void
  onOpenPanel: () => void
}

export function FloatingPetAssistant({
  view,
  activityPage,
  onActivityPageChange,
  onAcknowledgeMessage,
  onOpenPanel,
}: Props) {
  const pageSize = Math.max(1, view.visibleActivityCards.length || 1)
  const pageCount = Math.max(1, Math.ceil(view.activityCards.length / pageSize))
  const safePage = Math.min(activityPage, pageCount - 1)
  const activityCards = view.activityCards.slice(safePage * pageSize, safePage * pageSize + pageSize)

  return (
    <div className={`pet-assistant-shell ${view.displayMode}`}>
      {view.displayMode === 'minimal' ? (
        <MinimalHud
          runningCount={view.runningCount}
          finishedUnclosedCount={view.finishedUnclosedCount}
          actionableCount={view.actionableCount}
        />
      ) : (
        <ActivityHud
          cards={activityCards}
          page={safePage}
          pageCount={pageCount}
          overflowCount={view.overflowCount}
          onPageChange={onActivityPageChange}
          onOpenPanel={onOpenPanel}
        />
      )}

      {view.displayMode === 'minimal' ? (
        <div className="pet-message-stack" aria-live="polite">
          {view.messages.map((message) => (
            <PetMessageCard
              key={message.key}
              message={message}
              onOpenPanel={onOpenPanel}
              onAcknowledge={() => onAcknowledgeMessage(message.key)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function MinimalHud({
  runningCount,
  finishedUnclosedCount,
  actionableCount,
}: {
  runningCount: number
  finishedUnclosedCount: number
  actionableCount: number
}) {
  return (
    <div className="pet-minimal-hud">
      <span className="pet-hud-pill running">
        <strong>{runningCount}</strong>
        running
      </span>
      <span className="pet-hud-pill complete">
        <strong>{finishedUnclosedCount}</strong>
        finished
      </span>
      {actionableCount > 0 ? (
        <span className="pet-hud-pill intervention">
          <strong>{actionableCount}</strong>
          action
        </span>
      ) : null}
    </div>
  )
}

function ActivityHud({
  cards,
  page,
  pageCount,
  overflowCount,
  onPageChange,
  onOpenPanel,
}: {
  cards: PetAssistantActivityCard[]
  page: number
  pageCount: number
  overflowCount: number
  onPageChange: (page: number) => void
  onOpenPanel: () => void
}) {
  return (
    <section className="pet-activity-hud" aria-label="Claude Code session activity">
      <div className="pet-activity-header">
        <span>Active sessions</span>
        <small>{overflowCount > 0 ? `+${overflowCount}` : `${cards.length}`}</small>
      </div>
      <div className="pet-activity-list">
        {cards.length === 0 ? (
          <div className="pet-activity-empty">No open sessions</div>
        ) : (
          cards.map((card) => <ActivityCard key={card.key} card={card} onOpenPanel={onOpenPanel} />)
        )}
      </div>
      {pageCount > 1 ? (
        <div className="pet-activity-pager">
          <button
            type="button"
            title="Previous sessions"
            onClick={() => onPageChange(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            <ChevronUp size={13} />
          </button>
          <span>
            {page + 1}/{pageCount}
          </span>
          <button
            type="button"
            title="More sessions"
            onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
            disabled={page >= pageCount - 1}
          >
            <ChevronDown size={13} />
          </button>
        </div>
      ) : null}
    </section>
  )
}

function ActivityCard({
  card,
  onOpenPanel,
}: {
  card: PetAssistantActivityCard
  onOpenPanel: () => void
}) {
  return (
    <article className={`pet-activity-card ${card.tone}`} onClick={onOpenPanel}>
      <div>
        <strong>{card.title}</strong>
        <small>{card.detail}</small>
      </div>
      <span>{card.status.replaceAll('_', ' ')}</span>
    </article>
  )
}

function PetMessageCard({
  message,
  onOpenPanel,
  onAcknowledge,
}: {
  message: PetAssistantMessage
  onOpenPanel: () => void
  onAcknowledge: () => void
}) {
  return (
    <article className={`pet-message-card ${message.tone}`} onClick={onOpenPanel}>
      <div>
        <strong>{message.title}</strong>
        <small>{message.detail}</small>
      </div>
      <button
        type="button"
        title="Acknowledge"
        onClick={(event) => {
          event.stopPropagation()
          onAcknowledge()
        }}
      >
        <Check size={13} />
      </button>
    </article>
  )
}
