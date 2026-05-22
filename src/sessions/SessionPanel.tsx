import { Clock, FolderOpen, Hammer, RefreshCw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { openProjectFolder } from './sessionApi'
import type { SessionSnapshot, SessionStatus } from './sessionTypes'

const statusRank: Record<SessionStatus, number> = {
  waiting_permission: 0,
  error: 1,
  waiting_input: 2,
  tool_running: 3,
  running: 4,
  done: 5,
  stale: 6,
  probably_closed: 7,
  idle: 8,
  closed: 9,
}

type Props = {
  sessions: SessionSnapshot[]
  isLoading: boolean
  loadError?: string | null
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

export function SessionPanel({ sessions, isLoading, loadError, onRefresh }: Props) {
  const { t, i18n } = useTranslation()
  const sortedSessions = [...sessions].sort((a, b) => {
    const rankDelta = statusRank[a.status] - statusRank[b.status]
    if (rankDelta !== 0) return rankDelta
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })

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

        {sortedSessions.map((session) => (
          <article className="session-card" key={session.session_id}>
            <div className="session-main">
              <div className="session-title">
                <span className={`status-dot ${session.status}`} />
                <div>
                  <h3>{session.project_name || t('sessions.unknownProject')}</h3>
                  <p>{session.cwd}</p>
                </div>
              </div>
              <span className={`status-pill ${session.status}`}>
                {t(`status.${session.status}`)}
              </span>
            </div>

            <dl className="session-meta">
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
        ))}
      </div>
    </section>
  )
}
