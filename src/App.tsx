import { Bell, FolderOpen, Moon, PawPrint, RefreshCw, Settings } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PetRenderer } from './pet/PetRenderer'
import { getHighestPriorityStatus } from './pet/petStateMapper'
import { SessionPanel } from './sessions/SessionPanel'
import { loadSessions, refreshSessions } from './sessions/sessionApi'
import type { SessionSnapshot } from './sessions/sessionTypes'
import { SettingsPanel } from './settings/SettingsPanel'
import './styles/app.css'

function App() {
  const [sessions, setSessions] = useState<SessionSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [doNotDisturb, setDoNotDisturb] = useState(false)
  const [activeTab, setActiveTab] = useState<'sessions' | 'settings'>('sessions')

  async function load() {
    setIsLoading(true)
    setSessions(await loadSessions())
    setIsLoading(false)
  }

  useEffect(() => {
    // Session data is an external Tauri-backed store; initial load belongs in this subscription effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    const id = window.setInterval(() => {
      void load()
    }, 30_000)
    return () => window.clearInterval(id)
  }, [])

  const topStatus = useMemo(() => getHighestPriorityStatus(sessions), [sessions])
  const activeCount = sessions.filter((session) => !['closed'].includes(session.status)).length
  const waitingCount = sessions.filter((session) => session.status === 'waiting_permission').length

  return (
    <main className="app-shell">
      <aside className="pet-rail" aria-label="Claude Sprout pet preview">
        <div className="brand-mark">
          <PawPrint size={18} />
          <span>Claude Sprout</span>
        </div>
        <PetRenderer status={topStatus} alertCount={waitingCount} />
        <div className="rail-actions">
          <button type="button" onClick={() => setActiveTab('sessions')}>
            <Bell size={16} />
            Sessions
          </button>
          <button type="button" onClick={() => setActiveTab('settings')}>
            <Settings size={16} />
            Settings
          </button>
        </div>
      </aside>

      <section className="content-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Windows-first Claude Code companion</p>
            <h1>Session status center</h1>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className={doNotDisturb ? 'toggle active' : 'toggle'}
              onClick={() => setDoNotDisturb((value) => !value)}
              aria-pressed={doNotDisturb}
            >
              <Moon size={16} />
              Do not disturb
            </button>
            <button
              type="button"
              onClick={async () => {
                await refreshSessions()
                await load()
              }}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </header>

        <div className="status-strip">
          <div>
            <span className="metric">{activeCount}</span>
            <span>tracked sessions</span>
          </div>
          <div>
            <span className={`status-dot ${topStatus}`} />
            <span>highest priority: {topStatus}</span>
          </div>
          <div>
            <FolderOpen size={16} />
            <span>%USERPROFILE%\.claude-sprout</span>
          </div>
        </div>

        {activeTab === 'sessions' ? (
          <SessionPanel sessions={sessions} isLoading={isLoading} onRefresh={load} />
        ) : (
          <SettingsPanel doNotDisturb={doNotDisturb} onDoNotDisturbChange={setDoNotDisturb} />
        )}
      </section>
    </main>
  )
}

export default App
