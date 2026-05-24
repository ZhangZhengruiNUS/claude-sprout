import { Clock, FolderOpen, Hammer, MessageSquareText, RefreshCw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { openProjectFolder } from './sessionApi'
import {
  compareSessionsByActivity,
  displayProjectName,
  sessionActivitySummary,
} from './sessionPresentation'
import type { SessionSnapshot } from './sessionTypes'

type SessionScope = 'attention' | 'last24h' | 'all'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const
const DEFAULT_PAGE_SIZE = 10
const ATTENTION_STATUSES = new Set<SessionSnapshot['status']>([
  'waiting_permission',
  'error',
  'tool_running',
  'running',
  'waiting_input',
])

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
  const [scope, setScope] = useState<SessionScope>('attention')
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [page, setPage] = useState(1)
  const sortedSessions = useMemo(
    () => [...sessions].sort(compareSessionsByActivity),
    [sessions],
  )
  const scopeCounts = useMemo(() => sessionScopeCounts(sortedSessions), [sortedSessions])
  const visibleSessions = useMemo(
    () => sessionsForScope(sortedSessions, scope),
    [scope, sortedSessions],
  )
  const pageCount = Math.max(1, Math.ceil(visibleSessions.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageStart = visibleSessions.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const pageEnd = Math.min(safePage * pageSize, visibleSessions.length)
  const pagedSessions = visibleSessions.slice((safePage - 1) * pageSize, safePage * pageSize)

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

      <div className="session-controls">
        <div className="session-scope-tabs" aria-label={t('sessions.scopeLabel')}>
          {(['attention', 'last24h', 'all'] satisfies SessionScope[]).map((nextScope) => (
            <button
              type="button"
              key={nextScope}
              className={scope === nextScope ? 'active' : ''}
              onClick={() => {
                setScope(nextScope)
                setPage(1)
              }}
            >
              <span>{t(`sessions.scope.${nextScope}`)}</span>
              <strong>{scopeCounts[nextScope]}</strong>
            </button>
          ))}
        </div>

        <div className="session-pagination-controls">
          <label>
            {t('sessions.perPage')}
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(1)
              }}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <span>
            {t('sessions.pageSummary', {
              page: safePage,
              pageCount,
              start: pageStart,
              end: pageEnd,
              total: visibleSessions.length,
            })}
          </span>
          <div className="session-page-buttons">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage <= 1}
            >
              {t('sessions.previousPage')}
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={safePage >= pageCount}
            >
              {t('sessions.nextPage')}
            </button>
          </div>
        </div>
      </div>

      <div className="session-list">
        {!isLoading && sortedSessions.length === 0 && !loadError ? (
          <p className="session-empty">{t('sessions.empty')}</p>
        ) : null}

        {!isLoading && sortedSessions.length > 0 && pagedSessions.length === 0 && !loadError ? (
          <p className="session-empty">{t('sessions.emptyScope')}</p>
        ) : null}

        {pagedSessions.map((session) => {
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

function sessionScopeCounts(sessions: SessionSnapshot[]) {
  return {
    attention: sessionsForScope(sessions, 'attention').length,
    last24h: sessionsForScope(sessions, 'last24h').length,
    all: sessions.length,
  }
}

function sessionsForScope(sessions: SessionSnapshot[], scope: SessionScope) {
  switch (scope) {
    case 'attention':
      return sessions.filter((session) => ATTENTION_STATUSES.has(session.status))
    case 'last24h':
      return sessions.filter((session) => isWithinLastHours(session.updated_at, 24))
    case 'all':
      return sessions
  }
}

function isWithinLastHours(value: string, hours: number) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return false
  return Date.now() - timestamp <= hours * 60 * 60 * 1000
}
