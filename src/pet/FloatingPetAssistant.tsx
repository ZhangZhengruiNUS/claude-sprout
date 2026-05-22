import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
        view.activityCards.length > 0 ? (
          <ActivityHud
            cards={activityCards}
            totalCount={view.activityCards.length}
            page={safePage}
            pageCount={pageCount}
            onPageChange={onActivityPageChange}
            onOpenPanel={onOpenPanel}
          />
        ) : null
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
  const { t } = useTranslation()

  return (
    <div className="pet-minimal-hud">
      <span className="pet-hud-pill running">
        <strong>{runningCount}</strong>
        {t('petAssistant.running')}
      </span>
      <span className="pet-hud-pill complete">
        <strong>{finishedUnclosedCount}</strong>
        {t('petAssistant.finished')}
      </span>
      {actionableCount > 0 ? (
        <span className="pet-hud-pill intervention">
          <strong>{actionableCount}</strong>
          {t('petAssistant.action')}
        </span>
      ) : null}
    </div>
  )
}

function ActivityHud({
  cards,
  totalCount,
  page,
  pageCount,
  onPageChange,
  onOpenPanel,
}: {
  cards: PetAssistantActivityCard[]
  totalCount: number
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  onOpenPanel: () => void
}) {
  const { t } = useTranslation()

  return (
    <section className="pet-activity-hud" aria-label={t('petAssistant.activityLabel')}>
      <div className="pet-activity-header">
        <span>{t('petAssistant.activeSessions')}</span>
        <small>{totalCount}</small>
      </div>
      <div className="pet-activity-list">
        {cards.length === 0 ? (
          <div className="pet-activity-empty">{t('petAssistant.noOpenSessions')}</div>
        ) : (
          cards.map((card) => <ActivityCard key={card.key} card={card} onOpenPanel={onOpenPanel} />)
        )}
      </div>
      {pageCount > 1 ? (
        <div className="pet-activity-pager">
          <button
            type="button"
            title={t('petAssistant.previousSessions')}
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
            title={t('petAssistant.moreSessions')}
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
  const { t } = useTranslation()

  return (
    <article className={`pet-activity-card ${card.tone}`} onClick={onOpenPanel}>
      <div>
        <strong>{card.title}</strong>
        <small>{card.detail}</small>
        <em>{card.meta}</em>
      </div>
      <span>{t(`status.${card.status}`)}</span>
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
  const { t } = useTranslation()

  return (
    <article className={`pet-message-card ${message.tone}`} onClick={onOpenPanel}>
      <div>
        <strong>{message.title}</strong>
        <small>{message.detail}</small>
        <em>{message.meta}</em>
      </div>
      <button
        type="button"
        title={t('petAssistant.acknowledge')}
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
