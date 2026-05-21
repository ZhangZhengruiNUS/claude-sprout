import { Clock, FolderOpen, Hammer, RefreshCw, Trash2 } from 'lucide-react'
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

function formatTime(value?: string | null) {
  if (!value) return 'n/a'
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

export function SessionPanel({ sessions, isLoading, loadError, onRefresh }: Props) {
  const sortedSessions = [...sessions].sort((a, b) => {
    const rankDelta = statusRank[a.status] - statusRank[b.status]
    if (rankDelta !== 0) return rankDelta
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })

  return (
    <section className="session-panel">
      <div className="panel-heading">
        <div>
          <h2>Claude Code sessions</h2>
          <p>Snapshots are read from local hook/statusline files only.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw size={16} />
          {isLoading ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      {loadError ? <p className="session-load-error">{loadError}</p> : null}

      <div className="session-list">
        {!isLoading && sortedSessions.length === 0 && !loadError ? (
          <p className="session-empty">No Claude Code session snapshots found yet.</p>
        ) : null}

        {sortedSessions.map((session) => (
          <article className="session-card" key={session.session_id}>
            <div className="session-main">
              <div className="session-title">
                <span className={`status-dot ${session.status}`} />
                <div>
                  <h3>{session.project_name || 'Unknown project'}</h3>
                  <p>{session.cwd}</p>
                </div>
              </div>
              <span className={`status-pill ${session.status}`}>{session.status}</span>
            </div>

            <dl className="session-meta">
              <div>
                <dt>Session</dt>
                <dd>{session.session_id}</dd>
              </div>
              <div>
                <dt>Last event</dt>
                <dd>{session.last_event || 'n/a'}</dd>
              </div>
              <div>
                <dt>Last tool</dt>
                <dd>
                  <Hammer size={14} />
                  {session.last_tool || 'n/a'}
                </dd>
              </div>
              <div>
                <dt>Heartbeat</dt>
                <dd>
                  <Clock size={14} />
                  {formatTime(session.last_heartbeat_at)}
                </dd>
              </div>
              <div>
                <dt>Context</dt>
                <dd>{session.context_used_percentage ?? 'n/a'}%</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatTime(session.updated_at)}</dd>
              </div>
            </dl>

            <div className="card-actions">
              <button type="button" onClick={() => openProjectFolder(session.cwd)}>
                <FolderOpen size={16} />
                Open project
              </button>
              <button type="button" disabled>
                <Trash2 size={16} />
                Clean
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
