import { Clock, FolderOpen, Hammer, MessageSquareText, RefreshCw, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { openProjectFolder } from './sessionApi'
import {
  compareSessionsByActivity,
  displayProjectName,
  sessionActivitySummary,
} from './sessionPresentation'
import type { SessionSnapshot } from './sessionTypes'

type Props = {
  sessions: SessionSnapshot[]
  isLoading: boolean
  loadError?: string | null
  conversationPreviewEnabled?: boolean
  onRefresh: () => void | Promise<void>
}

function formatTime(value: string | null | undefined, language: string | undefined, fallback: string) {
  if (!value) return fallback
  return new Intl.DateTimeFormat(language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

export function SessionPanel({
  sessions,
  isLoading,
  loadError,
  conversationPreviewEnabled = false,
  onRefresh,
}: Props) {
  const { t, i18n } = useTranslation()
  const sortedSessions = useMemo(
    () => [...sessions].sort(compareSessionsByActivity),
    [sessions],
  )

  return (
    <section className="session-panel">
      <div className="panel-heading">
        <div>
          <h2>{t('sessions.title')}</h2>
          <p>{t('sessions.description')}</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw size={16} />
          {isLoading ? t('sessions.refreshing') : t('common.refresh')}
        </button>
      </div>

      {loadError ? <p className="session-load-error">{loadError}</p> : null}

      <div className="session-list">
        {!isLoading && sortedSessions.length === 0 && !loadError ? (
          <p className="session-empty">{t('sessions.empty')}</p>
        ) : null}

        {sortedSessions.map((session) => {
          const summary = sessionActivitySummary(session, conversationPreviewEnabled, t)
          const projectName = displayProjectName(session, t)

          return (
            <article className="session-card" key={session.session_id}>
              <div className="session-main">
                <div className="session-title">
                  <span className={`status-dot ${session.status}`} />
                  <div>
                    <h3 title={summary.title}>{summary.title}</h3>
                    <p title={session.cwd}>{session.cwd}</p>
                  </div>
                </div>
                <span className={`status-pill ${session.status}`}>
                  {t(`status.${session.status}`)}
                </span>
              </div>

              <div className="session-activity-summary">
                <span>
                  <MessageSquareText size={14} />
                  {t('sessions.activityOutput')}
                </span>
                <strong title={summary.detail}>{summary.detail}</strong>
                {summary.meta ? <small title={summary.meta}>{summary.meta}</small> : null}
              </div>

              <dl className="session-meta">
                <div>
                  <dt>{t('sessions.project')}</dt>
                  <dd>{projectName}</dd>
                </div>
                <div>
                  <dt>{t('sessions.session')}</dt>
                  <dd>{session.session_id}</dd>
                </div>
                <div>
                  <dt>{t('sessions.lastEvent')}</dt>
                  <dd>{session.last_event || t('common.na')}</dd>
                </div>
                <div>
                  <dt>{t('sessions.lastTool')}</dt>
                  <dd>
                    <Hammer size={14} />
                    {session.last_tool || t('common.na')}
                  </dd>
                </div>
                <div>
                  <dt>{t('sessions.heartbeat')}</dt>
                  <dd>
                    <Clock size={14} />
                    {formatTime(session.last_heartbeat_at, i18n.resolvedLanguage, t('common.na'))}
                  </dd>
                </div>
                <div>
                  <dt>{t('sessions.context')}</dt>
                  <dd>
                    {typeof session.context_used_percentage === 'number'
                      ? `${session.context_used_percentage}%`
                      : t('common.na')}
                  </dd>
                </div>
                <div>
                  <dt>{t('sessions.updated')}</dt>
                  <dd>{formatTime(session.updated_at, i18n.resolvedLanguage, t('common.na'))}</dd>
                </div>
                <div>
                  <dt>{t('sessions.source')}</dt>
                  <dd>{session.source || t('common.na')}</dd>
                </div>
                <div>
                  <dt>{t('sessions.ended')}</dt>
                  <dd>{formatTime(session.ended_at, i18n.resolvedLanguage, t('common.na'))}</dd>
                </div>
              </dl>

              <div className="card-actions">
                <button type="button" onClick={() => openProjectFolder(session.cwd)}>
                  <FolderOpen size={16} />
                  {t('sessions.openProject')}
                </button>
                <button type="button" disabled>
                  <Trash2 size={16} />
                  {t('sessions.clean')}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
