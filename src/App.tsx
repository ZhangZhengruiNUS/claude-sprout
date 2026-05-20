import { Bell, FolderOpen, Moon, PawPrint, RefreshCw, Settings } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { PetRenderer } from './pet/PetRenderer'
import { applyPetScale, loadPetScale, startPetDrag } from './pet/petWindowControls'
import type { PetAnimation } from './pet/petStateMapper'
import { getHighestPriorityStatus } from './pet/petStateMapper'
import { SessionPanel } from './sessions/SessionPanel'
import { loadSessions, refreshSessions, showSessionPanel } from './sessions/sessionApi'
import type { SessionSnapshot } from './sessions/sessionTypes'
import { SettingsPanel } from './settings/SettingsPanel'
import './styles/app.css'

type WindowKind = 'panel' | 'pet'

function resolveInitialWindowKind(): WindowKind {
  const params = new URLSearchParams(window.location.search)
  if (params.get('window') === 'pet') {
    return 'pet'
  }

  try {
    return getCurrentWindow().label === 'pet' ? 'pet' : 'panel'
  } catch {
    return 'panel'
  }
}

function App() {
  const [sessions, setSessions] = useState<SessionSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [doNotDisturb, setDoNotDisturb] = useState(false)
  const [activeTab, setActiveTab] = useState<'sessions' | 'settings'>('sessions')
  const [windowKind] = useState<WindowKind>(resolveInitialWindowKind)
  const [petScale, setPetScale] = useState(loadPetScale)
  const [petAction, setPetAction] = useState<PetAnimation | null>(null)

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

  useEffect(() => {
    document.documentElement.dataset.window = windowKind
  }, [windowKind])

  function playPetAction(action: PetAnimation) {
    setPetAction(action)
    window.setTimeout(() => setPetAction(null), 950)
  }

  async function resizePet(delta: number) {
    const nextScale = await applyPetScale(petScale + delta * 0.1)
    setPetScale(nextScale)
  }

  if (windowKind === 'pet') {
    return (
      <main className="floating-pet-shell">
        <PetRenderer
          status={topStatus}
          alertCount={waitingCount}
          compact
          scale={petScale}
          action={petAction}
          onClick={() => {
            void showSessionPanel()
          }}
          onDoubleClick={() => playPetAction('wave')}
          onContextMenu={() => {
            void resizePet(1)
          }}
          onWheel={(delta) => {
            void resizePet(delta)
          }}
          onDragStart={() => {
            void startPetDrag()
          }}
        />
      </main>
    )
  }

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
