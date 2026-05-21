import {
  Bell,
  EyeOff,
  FolderOpen,
  Moon,
  PanelTopOpen,
  PawPrint,
  RefreshCw,
  Settings,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { emit, listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { PetRenderer } from './pet/PetRenderer'
import {
  importCodexPet,
  listPetAssets,
  scanCodexPetCandidates,
  type CodexPetCandidate,
  type PetAsset,
} from './pet/petAssetsApi'
import {
  applyPetAlwaysOnTop,
  applyPetScale,
  beginPetDrag,
  getPetWindow,
  hideCurrentPetWindow,
} from './pet/petWindowControls'
import type { PetAnimation } from './pet/petStateMapper'
import { getHighestPriorityStatus } from './pet/petStateMapper'
import { SessionPanel } from './sessions/SessionPanel'
import { loadSessions, refreshSessions, showSessionPanel } from './sessions/sessionApi'
import { deliverSessionNotifications } from './sessions/sessionNotificationDelivery'
import {
  notificationsForSessionChanges,
  type SessionNotification,
} from './sessions/sessionNotifications'
import type { SessionSnapshot } from './sessions/sessionTypes'
import { SettingsPanel } from './settings/SettingsPanel'
import type { AppSettings, PetSizePreset } from './settings/appSettings'
import {
  loadAppSettings,
  settingsWithPetScale,
  settingsWithPetSizePreset,
} from './settings/appSettings'
import { loadPersistedAppSettings, savePersistedAppSettings } from './settings/appSettingsApi'
import {
  cleanStorage,
  getStorageSummary,
  openDataFolder,
  type StorageCleanKind,
  type StorageSummary,
} from './storage/storageApi'
import { cleanStorageConfirmationText, formatBytes } from './storage/storageFormatting'
import './styles/app.css'

type WindowKind = 'panel' | 'pet'
const SETTINGS_CHANGED_EVENT = 'claude-sprout://settings-changed'
const PET_ASSETS_CHANGED_EVENT = 'claude-sprout://pet-assets-changed'
const SESSION_CHANGED_EVENT = 'claude-sprout://sessions-changed'
const OPEN_SETTINGS_EVENT = 'claude-sprout://open-settings'

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

function isTauriRuntime() {
  return '__TAURI_INTERNALS__' in window
}

function App() {
  const [sessions, setSessions] = useState<SessionSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [settings, setSettings] = useState(loadAppSettings)
  const [activeTab, setActiveTab] = useState<'sessions' | 'settings'>('sessions')
  const [windowKind] = useState<WindowKind>(resolveInitialWindowKind)
  const [petAction, setPetAction] = useState<PetAnimation | null>(null)
  const [petActionReplayKey, setPetActionReplayKey] = useState(0)
  const [petAssets, setPetAssets] = useState<PetAsset[]>([])
  const [previewPetId, setPreviewPetId] = useState<string | null>(settings.activePetId)
  const [codexPetCandidates, setCodexPetCandidates] = useState<CodexPetCandidate[]>([])
  const [hasScannedCodexPets, setHasScannedCodexPets] = useState(false)
  const [isScanningCodexPets, setIsScanningCodexPets] = useState(false)
  const [importingPetSourcePath, setImportingPetSourcePath] = useState<string | null>(null)
  const [petImportError, setPetImportError] = useState<string | null>(null)
  const [storageSummary, setStorageSummary] = useState<StorageSummary | null>(null)
  const [isStorageLoading, setIsStorageLoading] = useState(false)
  const [isStorageCleaning, setIsStorageCleaning] = useState(false)
  const [storageMessage, setStorageMessage] = useState<string | null>(null)
  const [petMenuPosition, setPetMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const settingsRef = useRef(settings)
  const sessionsRef = useRef<SessionSnapshot[]>([])
  const notifiedSessionKeysRef = useRef(new Set<string>())
  const pendingSessionNotificationsRef = useRef(new Map<string, SessionNotification>())
  const loadSequenceRef = useRef(0)
  const storageLoadSequenceRef = useRef(0)

  async function load(options: { showLoading?: boolean; notify?: boolean } = {}) {
    const sequence = loadSequenceRef.current + 1
    loadSequenceRef.current = sequence
    if (options.showLoading ?? true) {
      setIsLoading(true)
    }
    const nextSessions = await loadSessions()
    if (sequence !== loadSequenceRef.current) {
      return
    }
    if (options.notify) {
      void notifySessionChanges(
        sessionsRef.current,
        nextSessions,
        settingsRef.current.doNotDisturb,
        notifiedSessionKeysRef.current,
        pendingSessionNotificationsRef.current,
      )
    }
    sessionsRef.current = nextSessions
    setSessions(nextSessions)
    if (options.showLoading ?? true) {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Session data is an external Tauri-backed store; initial load belongs in this subscription effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    const id = window.setInterval(() => {
      void load({ showLoading: false, notify: windowKind === 'panel' })
    }, 30_000)
    return () => window.clearInterval(id)
  }, [windowKind])

  useEffect(() => {
    void refreshPetAssets()
  }, [])

  const topStatus = useMemo(() => getHighestPriorityStatus(sessions), [sessions])
  const activeCount = sessions.filter((session) => !['closed'].includes(session.status)).length
  const waitingCount = sessions.filter((session) => session.status === 'waiting_permission').length

  useEffect(() => {
    document.documentElement.dataset.window = windowKind
  }, [windowKind])

  useEffect(() => {
    if (!isTauriRuntime() || windowKind !== 'panel') return

    const currentWindow = getCurrentWindow()
    let isMounted = true
    let isHidingToTray = false
    let unlisten: (() => void) | null = null

    void currentWindow.onResized(async () => {
      if (!isMounted || isHidingToTray) return
      if (!(await currentWindow.isMinimized())) return

      isHidingToTray = true
      try {
        await currentWindow.hide()
        await currentWindow.unminimize()
      } finally {
        window.setTimeout(() => {
          isHidingToTray = false
        }, 0)
      }
    }).then((handler) => {
      unlisten = handler
    })

    return () => {
      isMounted = false
      unlisten?.()
    }
  }, [windowKind])

  useEffect(() => {
    let isMounted = true
    void loadPersistedAppSettings().then((persistedSettings) => {
      if (!isMounted) return
      // Settings are owned by the app-data store; the sync load only seeds first paint.
      setSettings(persistedSettings)
      setPreviewPetId(persistedSettings.activePetId)
    })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    void applySettingsToPet(settings, windowKind)
  }, [settings, windowKind])

  useEffect(() => {
    if (!isTauriRuntime()) return

    let isMounted = true
    let unlisten: (() => void) | null = null

    void listen<AppSettings>(SETTINGS_CHANGED_EVENT, (event) => {
      if (!isMounted) return
      const previousAppliedPetId = settingsRef.current.activePetId
      setSettings(event.payload)
      setPreviewPetId((currentPreviewPetId) =>
        currentPreviewPetId === previousAppliedPetId ? event.payload.activePetId : currentPreviewPetId,
      )
      void refreshPetAssets()
      void applySettingsToPet(event.payload, windowKind)
    }).then((handler) => {
      unlisten = handler
    })

    return () => {
      isMounted = false
      unlisten?.()
    }
  }, [windowKind])

  useEffect(() => {
    if (windowKind !== 'panel' || activeTab !== 'settings') return
    void loadStorageSummary()
  }, [activeTab, windowKind])

  useEffect(() => {
    if (!isTauriRuntime() || windowKind !== 'panel') return

    let isMounted = true
    let unlisten: (() => void) | null = null

    void listen(OPEN_SETTINGS_EVENT, () => {
      if (!isMounted) return
      setActiveTab('settings')
    }).then((handler) => {
      unlisten = handler
    })

    return () => {
      isMounted = false
      unlisten?.()
    }
  }, [windowKind])

  useEffect(() => {
    if (!isTauriRuntime()) return

    let isMounted = true
    let unlisten: (() => void) | null = null

    void listen(PET_ASSETS_CHANGED_EVENT, () => {
      if (!isMounted) return
      void refreshPetAssets()
    }).then((handler) => {
      unlisten = handler
    })

    return () => {
      isMounted = false
      unlisten?.()
    }
  }, [])

  useEffect(() => {
    if (!isTauriRuntime()) return

    let isMounted = true
    let unlisten: (() => void) | null = null

    void listen(SESSION_CHANGED_EVENT, () => {
      if (!isMounted) return
      void load({ showLoading: false, notify: windowKind === 'panel' })
    }).then((handler) => {
      unlisten = handler
    })

    return () => {
      isMounted = false
      unlisten?.()
    }
  }, [windowKind])

  function playPetAction(action: PetAnimation) {
    setPetMenuPosition(null)
    setPetActionReplayKey((current) => current + 1)
    setPetAction(action)
    window.setTimeout(() => setPetAction(null), 950)
  }

  async function resizePet(delta: number) {
    setPetMenuPosition(null)
    await updateSettings(settingsWithPetScale(settings, settings.petScale + delta * 0.1))
  }

  async function hidePet() {
    setPetMenuPosition(null)
    await hideCurrentPetWindow()
  }

  async function updateSettings(nextSettings: AppSettings) {
    settingsRef.current = nextSettings
    const savedSettings = await savePersistedAppSettings(nextSettings)
    settingsRef.current = savedSettings
    setSettings(savedSettings)
    await applySettingsToPet(savedSettings, windowKind)

    if (isTauriRuntime()) {
      await emit(SETTINGS_CHANGED_EVENT, savedSettings)
    }
  }

  async function updatePetSizePreset(preset: Exclude<PetSizePreset, 'custom'>) {
    await updateSettings(settingsWithPetSizePreset(settings, preset))
  }

  async function updateSettingsFromLatest(
    resolveNextSettings: (currentSettings: AppSettings) => AppSettings,
  ) {
    await updateSettings(resolveNextSettings(settingsRef.current))
  }

  async function applyPreviewPet() {
    await updateSettingsFromLatest((currentSettings) => ({
      ...currentSettings,
      activePetId: previewPetId,
    }))
  }

  async function refreshPetAssets() {
    setPetAssets(await listPetAssets())
  }

  async function scanCodexPets() {
    setIsScanningCodexPets(true)
    setPetImportError(null)
    try {
      setCodexPetCandidates(await scanCodexPetCandidates())
      setHasScannedCodexPets(true)
    } catch (error) {
      setPetImportError(errorMessage(error))
    } finally {
      setIsScanningCodexPets(false)
    }
  }

  async function importPetCandidate(candidate: CodexPetCandidate) {
    if (!candidate.valid) return

    setImportingPetSourcePath(candidate.sourcePath)
    setPetImportError(null)
    try {
      const manifest = await importCodexPet(candidate.sourcePath)
      await refreshPetAssets()
      setPreviewPetId(manifest.id)
      await updateSettingsFromLatest((currentSettings) => ({
        ...currentSettings,
        activePetId: manifest.id,
      }))
      if (isTauriRuntime()) {
        await emit(PET_ASSETS_CHANGED_EVENT)
      }
    } catch (error) {
      setPetImportError(errorMessage(error))
    } finally {
      setImportingPetSourcePath(null)
    }
  }

  async function loadStorageSummary(options: { clearMessage?: boolean } = {}) {
    const sequence = storageLoadSequenceRef.current + 1
    storageLoadSequenceRef.current = sequence
    setIsStorageLoading(true)
    if (options.clearMessage ?? true) {
      setStorageMessage(null)
    }
    try {
      const summary = await getStorageSummary()
      if (sequence !== storageLoadSequenceRef.current) {
        return false
      }
      setStorageSummary(summary)
      return true
    } catch (error) {
      if (sequence !== storageLoadSequenceRef.current) {
        return false
      }
      setStorageMessage(`Storage summary failed: ${errorMessage(error)}`)
      return false
    } finally {
      if (sequence === storageLoadSequenceRef.current) {
        setIsStorageLoading(false)
      }
    }
  }

  async function handleCleanStorage(kind: StorageCleanKind) {
    const bucket = kind === 'safe_sessions' ? storageSummary?.sessions : storageSummary?.events
    if (!bucket || bucket.cleanableFileCount === 0) return

    const confirmed = window.confirm(
      cleanStorageConfirmationText(kind, bucket.cleanableFileCount, bucket.cleanableBytes),
    )
    if (!confirmed) return

    setIsStorageCleaning(true)
    setStorageMessage(null)
    try {
      const result = await cleanStorage({
        kind,
        expectedCleanableFileCount: bucket.cleanableFileCount,
        expectedCleanableBytes: bucket.cleanableBytes,
      })
      const refreshed = await loadStorageSummary({ clearMessage: false })
      if (!refreshed) return
      setStorageMessage(
        `Deleted ${result.deletedFileCount} files and freed ${formatBytes(result.deletedBytes)}.`,
      )
      if (kind === 'safe_sessions') {
        await load({ showLoading: false })
      }
    } catch (error) {
      setStorageMessage(`Storage cleanup failed: ${errorMessage(error)}`)
    } finally {
      setIsStorageCleaning(false)
    }
  }

  const activePetAsset = petAssets.find((petAsset) => petAsset.id === settings.activePetId) ?? null
  const previewPetAsset =
    windowKind === 'panel'
      ? petAssets.find((petAsset) => petAsset.id === previewPetId) ?? null
      : activePetAsset

  if (windowKind === 'pet') {
    return (
      <main className="floating-pet-shell">
        <PetRenderer
          status={topStatus}
          alertCount={waitingCount}
          compact
          draggable={!settings.petLockPosition}
          scale={settings.petScale}
          action={petAction}
          actionReplayKey={petActionReplayKey}
          petAsset={activePetAsset}
          onClick={() => {
            setPetMenuPosition(null)
            void showSessionPanel()
          }}
          onDoubleClick={() => playPetAction('wave')}
          onContextMenu={(position) => {
            setPetMenuPosition(position)
          }}
          onWheel={(delta) => {
            void resizePet(delta)
          }}
          onDragStart={beginPetDrag}
        />
        {petMenuPosition ? (
          <div
            className="pet-context-menu"
            style={
              {
                '--pet-menu-x': `${petMenuPosition.x}px`,
                '--pet-menu-y': `${petMenuPosition.y}px`,
              } as CSSProperties
            }
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              title="Open session panel"
              onClick={() => {
                setPetMenuPosition(null)
                void showSessionPanel()
              }}
            >
              <PanelTopOpen size={14} />
              Open
            </button>
            <button
              type="button"
              title="Hide pet window"
              onClick={() => {
                void hidePet()
              }}
            >
              <EyeOff size={14} />
              Hide
            </button>
            <button
              type="button"
              title="Make pet larger"
              onClick={() => {
                void resizePet(1)
              }}
            >
              <ZoomIn size={14} />
              Larger
            </button>
            <button
              type="button"
              title="Make pet smaller"
              onClick={() => {
                void resizePet(-1)
              }}
            >
              <ZoomOut size={14} />
              Smaller
            </button>
          </div>
        ) : null}
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
        <PetRenderer
          status={topStatus}
          alertCount={waitingCount}
          action={petAction}
          actionReplayKey={petActionReplayKey}
          petAsset={previewPetAsset}
        />
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
              className={settings.doNotDisturb ? 'toggle active' : 'toggle'}
              onClick={() => {
                void updateSettings({ ...settings, doNotDisturb: !settings.doNotDisturb })
              }}
              aria-pressed={settings.doNotDisturb}
            >
              <Moon size={16} />
              Do not disturb
            </button>
            <button
              type="button"
              onClick={async () => {
                await refreshSessions()
                await load({ showLoading: false, notify: true })
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
          <SettingsPanel
            settings={settings}
            petAssets={petAssets}
            previewPetId={previewPetId}
            codexPetCandidates={codexPetCandidates}
            hasScannedCodexPets={hasScannedCodexPets}
            isScanningCodexPets={isScanningCodexPets}
            importingPetSourcePath={importingPetSourcePath}
            petImportError={petImportError}
            storageSummary={storageSummary}
            isStorageLoading={isStorageLoading}
            isStorageCleaning={isStorageCleaning}
            storageMessage={storageMessage}
            onSettingsChange={(nextSettings) => {
              void updateSettings(nextSettings)
            }}
            onPetSizePresetChange={(preset) => {
              void updatePetSizePreset(preset)
            }}
            onPreviewPet={(petId) => {
              setPreviewPetId(petId)
            }}
            onApplyPetSelection={() => {
              void applyPreviewPet()
            }}
            onPreviewPetAnimation={playPetAction}
            onRefreshPetAssets={() => {
              void refreshPetAssets()
            }}
            onScanCodexPets={() => {
              void scanCodexPets()
            }}
            onImportCodexPet={(candidate) => {
              void importPetCandidate(candidate)
            }}
            onRefreshStorage={() => {
              void loadStorageSummary()
            }}
            onCleanStorage={(kind) => {
              void handleCleanStorage(kind)
            }}
            onOpenDataFolder={() => {
              void openDataFolder()
            }}
          />
        )}
      </section>
    </main>
  )
}

async function notifySessionChanges(
  previousSessions: SessionSnapshot[],
  nextSessions: SessionSnapshot[],
  doNotDisturb: boolean,
  notifiedSessionKeys: Set<string>,
  pendingSessionNotifications: Map<string, SessionNotification>,
) {
  if (!isTauriRuntime() || doNotDisturb) return

  const notifications = notificationsForSessionChanges(
    previousSessions,
    nextSessions,
    notifiedSessionKeys,
  )
  await deliverSessionNotifications({
    notifications,
    pendingNotifications: pendingSessionNotifications,
    notifiedKeys: notifiedSessionKeys,
    isPermissionGranted,
    requestPermission,
    sendNotification,
  })
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function applySettingsToPet(settings: AppSettings, windowKind: WindowKind) {
  if (windowKind === 'pet') {
    await Promise.all([
      applyPetScale(settings.petScale),
      applyPetAlwaysOnTop(settings.petAlwaysOnTop),
    ])
    return
  }

  const petWindow = await getPetWindow()
  if (!petWindow) return

  await Promise.all([
    applyPetScale(settings.petScale, petWindow),
    applyPetAlwaysOnTop(settings.petAlwaysOnTop, petWindow),
  ])
}

export default App
