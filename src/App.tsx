import {
  Bell,
  EyeOff,
  FolderOpen,
  LayoutList,
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
import { FloatingPetAssistant } from './pet/FloatingPetAssistant'
import { builtInPetAsset } from './pet/builtInPetAsset'
import type { PetDragAnimation } from './pet/petDragAnimation'
import { resolvePetWindowAction } from './pet/petActionPriority'
import {
  nextPetDisplayMode,
  petDisplayModeMenuLabel,
  petDisplayModeMenuTitle,
} from './pet/petDisplayModeMenu'
import {
  nextPetEventActions,
  rememberPetEventAction,
  type PetEventAction,
} from './pet/petEventActions'
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
import { petWindowSizeForDisplay } from './pet/petWindowLayout'
import { shouldDismissPetContextMenu } from './pet/petContextMenu'
import type { PetAnimation } from './pet/petStateMapper'
import { getHighestPriorityStatus } from './pet/petStateMapper'
import {
  buildPetAssistantView,
  PET_ASSISTANT_MESSAGE_STATUSES,
  petAssistantMessageKey,
} from './pet/petAssistantViewModel'
import { SessionPanel } from './sessions/SessionPanel'
import { getDataRoot, loadSessions, refreshSessions, showSessionPanel } from './sessions/sessionApi'
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
import { isTauriRuntime } from './tauriRuntime'
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

function App() {
  const [sessions, setSessions] = useState<SessionSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sessionLoadError, setSessionLoadError] = useState<string | null>(null)
  const [dataRoot, setDataRoot] = useState('%USERPROFILE%\\.claude-sprout')
  const [settings, setSettings] = useState(loadAppSettings)
  const [activeTab, setActiveTab] = useState<'sessions' | 'settings'>('sessions')
  const [windowKind] = useState<WindowKind>(resolveInitialWindowKind)
  const [petAction, setPetAction] = useState<PetAnimation | null>(null)
  const [petDragAnimation, setPetDragAnimation] = useState<PetDragAnimation | null>(null)
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
  const [isPetDragging, setIsPetDragging] = useState(false)
  const [acknowledgedPetMessageKeys, setAcknowledgedPetMessageKeys] = useState<Set<string>>(
    () => new Set(),
  )
  const [petActivityPage, setPetActivityPage] = useState(0)
  const [petAssistantTick, setPetAssistantTick] = useState(() => Date.now())
  const settingsRef = useRef(settings)
  const petAssetsRef = useRef<PetAsset[]>([])
  const sessionsRef = useRef<SessionSnapshot[]>([])
  const notifiedSessionKeysRef = useRef(new Set<string>())
  const pendingSessionNotificationsRef = useRef(new Map<string, SessionNotification>())
  const loadSequenceRef = useRef(0)
  const storageLoadSequenceRef = useRef(0)
  const petMessageFirstSeenAtRef = useRef(new Map<string, number>())
  const petContextMenuRef = useRef<HTMLDivElement | null>(null)
  const playedPetEventActionKeysRef = useRef(new Set<string>())
  const petEventActionQueueRef = useRef<PetEventAction[]>([])
  const isPlayingQueuedPetEventActionRef = useRef(false)
  const petActionClearTimerRef = useRef<number | null>(null)

  async function load(options: { showLoading?: boolean; notify?: boolean } = {}) {
    const sequence = loadSequenceRef.current + 1
    loadSequenceRef.current = sequence
    if (options.showLoading ?? true) {
      setIsLoading(true)
    }
    let nextSessions: SessionSnapshot[]
    try {
      nextSessions = await loadSessions()
    } catch (error) {
      if (sequence !== loadSequenceRef.current) {
        return
      }
      setSessionLoadError(`Session load failed: ${errorMessage(error)}`)
      if (options.showLoading ?? true) {
        setIsLoading(false)
      }
      return
    }
    if (sequence !== loadSequenceRef.current) {
      return
    }
    setSessionLoadError(null)
    if (options.notify) {
      void notifySessionChanges(
        sessionsRef.current,
        nextSessions,
        settingsRef.current.doNotDisturb,
        notifiedSessionKeysRef.current,
        pendingSessionNotificationsRef.current,
      )
    }
    if (windowKind === 'pet') {
      const eventActions = nextPetEventActions(
        sessionsRef.current,
        nextSessions,
        playedPetEventActionKeysRef.current,
      )
      if (eventActions.length > 0) {
        for (const eventAction of eventActions) {
          rememberPetEventAction(playedPetEventActionKeysRef.current, eventAction.key)
        }
        enqueuePetEventActions(eventActions)
      }
    }
    sessionsRef.current = nextSessions
    setSessions(nextSessions)
    if (options.showLoading ?? true) {
      setIsLoading(false)
    }
  }

  async function reloadSessions(options: { showLoading?: boolean; notify?: boolean } = {}) {
    try {
      await refreshSessions()
    } catch (error) {
      setSessionLoadError(`Session refresh failed: ${errorMessage(error)}`)
      return
    }

    await load(options)
  }

  useEffect(() => {
    // Session data is an external Tauri-backed store; initial load belongs in this subscription effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    const id = window.setInterval(() => {
      void load({ showLoading: false, notify: windowKind === 'panel' })
    }, 30_000)
    return () => window.clearInterval(id)
    // Session polling is keyed by window kind; `load` intentionally reads current refs/state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowKind])

  useEffect(() => {
    void refreshPetAssets()
  }, [])

  useEffect(() => {
    let isMounted = true
    void getDataRoot()
      .then((root) => {
        if (isMounted) {
          setDataRoot(root)
        }
      })
      .catch((error) => {
        if (isMounted) {
          setSessionLoadError(`Data root lookup failed: ${errorMessage(error)}`)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const topStatus = useMemo(() => getHighestPriorityStatus(sessions), [sessions])
  const activeCount = sessions.filter((session) => !['closed'].includes(session.status)).length
  const waitingCount = sessions.filter((session) => session.status === 'waiting_permission').length
  const petAssistantView = useMemo(
    () =>
      buildPetAssistantView({
        sessions,
        displayMode: settings.petDisplayMode,
        visibleCount: settings.petActivityVisibleCount,
        acknowledgedMessageKeys: acknowledgedPetMessageKeys,
        now: new Date(petAssistantTick),
        completionToastSeconds: settings.petCompletionToastSeconds,
        messageFirstSeenAt: petMessageFirstSeenAtRef.current,
        conversationPreviewEnabled: settings.petConversationPreviewEnabled,
      }),
    [
      acknowledgedPetMessageKeys,
      petAssistantTick,
      sessions,
      settings.petActivityVisibleCount,
      settings.petCompletionToastSeconds,
      settings.petConversationPreviewEnabled,
      settings.petDisplayMode,
    ],
  )
  const activityCardCount = petAssistantView.activityCards.length
  const activePetAsset = petAssetForId(settings.activePetId, petAssets)

  useEffect(() => {
    document.documentElement.dataset.window = windowKind
  }, [windowKind])

  useEffect(() => {
    if (windowKind !== 'pet') return
    const id = window.setInterval(() => setPetAssistantTick(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [windowKind])

  useEffect(
    () => () => {
      if (petActionClearTimerRef.current !== null) {
        window.clearTimeout(petActionClearTimerRef.current)
      }
      petEventActionQueueRef.current = []
      isPlayingQueuedPetEventActionRef.current = false
    },
    [],
  )

  useEffect(() => {
    const currentKeys = new Set<string>()
    const now = Date.now()
    for (const session of sessions) {
      if (!PET_ASSISTANT_MESSAGE_STATUSES.has(session.status)) continue
      const key = petAssistantMessageKey(session)
      currentKeys.add(key)
      if (!petMessageFirstSeenAtRef.current.has(key)) {
        petMessageFirstSeenAtRef.current.set(key, now)
      }
    }

    for (const key of petMessageFirstSeenAtRef.current.keys()) {
      if (!currentKeys.has(key)) {
        petMessageFirstSeenAtRef.current.delete(key)
      }
    }
  }, [sessions])

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
    petAssetsRef.current = petAssets
  }, [petAssets])

  useEffect(() => {
    void applySettingsToPet(settings, windowKind, activityCardCount, activePetAsset)
  }, [activityCardCount, activePetAsset, settings, windowKind])

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
      const nextActivePetAsset = petAssetForId(event.payload.activePetId, petAssetsRef.current)
      void applySettingsToPet(
        event.payload,
        windowKind,
        countOpenSessions(sessionsRef.current),
        nextActivePetAsset,
      )
    }).then((handler) => {
      unlisten = handler
    })

    return () => {
      isMounted = false
      unlisten?.()
    }
  }, [windowKind])

  useEffect(() => {
    if (windowKind !== 'pet' || !petMenuPosition) return

    function closeMenuOnOutsidePointer(event: PointerEvent) {
      if (shouldDismissPetContextMenu(event.target, petContextMenuRef.current)) {
        setPetMenuPosition(null)
      }
    }

    function closeMenuOnWindowBlur() {
      setPetMenuPosition(null)
    }

    window.addEventListener('pointerdown', closeMenuOnOutsidePointer, true)
    window.addEventListener('blur', closeMenuOnWindowBlur)
    return () => {
      window.removeEventListener('pointerdown', closeMenuOnOutsidePointer, true)
      window.removeEventListener('blur', closeMenuOnWindowBlur)
    }
  }, [petMenuPosition, windowKind])

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
    // Session-change subscription is keyed by window kind; `load` intentionally reads current refs/state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowKind])

  function enqueuePetEventActions(actions: PetEventAction[]) {
    petEventActionQueueRef.current.push(...actions)
    if (
      !isPlayingQueuedPetEventActionRef.current &&
      petActionClearTimerRef.current === null
    ) {
      playNextQueuedPetEventAction()
    }
  }

  function playNextQueuedPetEventAction() {
    const nextAction = petEventActionQueueRef.current.shift()
    if (!nextAction) {
      isPlayingQueuedPetEventActionRef.current = false
      return
    }

    isPlayingQueuedPetEventActionRef.current = true
    playPetAction(nextAction.animation, nextAction.durationMs, {
      preserveEventQueue: true,
      onComplete: playNextQueuedPetEventAction,
    })
  }

  function playPetAction(
    action: PetAnimation,
    durationMs = 950,
    options: { preserveEventQueue?: boolean; onComplete?: () => void } = {},
  ) {
    if (!options.preserveEventQueue) {
      petEventActionQueueRef.current = []
      isPlayingQueuedPetEventActionRef.current = false
    }
    setPetMenuPosition(null)
    setPetActionReplayKey((current) => current + 1)
    setPetAction(action)
    if (petActionClearTimerRef.current !== null) {
      window.clearTimeout(petActionClearTimerRef.current)
    }
    petActionClearTimerRef.current = window.setTimeout(() => {
      setPetAction(null)
      petActionClearTimerRef.current = null
      options.onComplete?.()
      if (
        !isPlayingQueuedPetEventActionRef.current &&
        petEventActionQueueRef.current.length > 0
      ) {
        playNextQueuedPetEventAction()
      }
    }, durationMs)
  }

  async function resizePet(delta: number) {
    setPetMenuPosition(null)
    await updateSettings(settingsWithPetScale(settings, settings.petScale + delta * 0.1))
  }

  async function togglePetDisplayMode() {
    setPetMenuPosition(null)
    await updateSettingsFromLatest((currentSettings) => ({
      ...currentSettings,
      petDisplayMode: nextPetDisplayMode(currentSettings.petDisplayMode),
    }))
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
    const nextActivePetAsset = petAssetForId(savedSettings.activePetId, petAssetsRef.current)
    await applySettingsToPet(
      savedSettings,
      windowKind,
      countOpenSessions(sessionsRef.current),
      nextActivePetAsset,
    )

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
    const nextPetAssets = await listPetAssets()
    petAssetsRef.current = nextPetAssets
    setPetAssets(nextPetAssets)
    return nextPetAssets
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

  const previewPetAsset =
    windowKind === 'panel'
      ? petAssetForId(previewPetId, petAssets)
      : activePetAsset

  if (windowKind === 'pet') {
    return (
      <main
        className={`floating-pet-shell ${settings.petDisplayMode}${activePetAsset ? ' imported-pet-active' : ''}${isPetDragging ? ' dragging' : ''}`}
        style={{
          ...petMessageBoxOpacityStyle(settings.petMessageBoxOpacity),
          ...importedPetFrameStyle(activePetAsset),
        }}
      >
        <PetRenderer
          status={topStatus}
          alertCount={waitingCount}
          compact
          draggable={!settings.petLockPosition}
          scale={settings.petDisplayMode === 'activity' ? settings.petScale * 0.78 : settings.petScale}
          action={resolvePetWindowAction(activePetAsset !== null, petAction, petDragAnimation)}
          actionReplayKey={petActionReplayKey}
          petAsset={activePetAsset}
          showAlertBubble={false}
          onClick={() => {
            setPetMenuPosition(null)
            void showSessionPanel()
          }}
          onDoubleClick={() => playPetAction('waving')}
          onContextMenu={(position) => {
            setPetMenuPosition(position)
          }}
          onWheel={(delta) => {
            void resizePet(delta)
          }}
          onDragStart={(origin) =>
            beginPetDrag(
              origin,
              importedPetDragWindowResize(settings, activityCardCount, activePetAsset),
            )
          }
          onDragStateChange={(dragging) => {
            setIsPetDragging(dragging)
            if (dragging) {
              setPetMenuPosition(null)
            }
            if (!dragging) {
              setPetDragAnimation(null)
            }
          }}
          onDragDirectionChange={setPetDragAnimation}
        />
        <FloatingPetAssistant
          view={petAssistantView}
          activityPage={petActivityPage}
          onActivityPageChange={setPetActivityPage}
          onOpenPanel={() => {
            setPetMenuPosition(null)
            void showSessionPanel()
          }}
          onAcknowledgeMessage={(key) => {
            setAcknowledgedPetMessageKeys((current) => new Set(current).add(key))
          }}
        />
        {petMenuPosition ? (
          <div
            ref={petContextMenuRef}
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
              title={petDisplayModeMenuTitle(settings.petDisplayMode)}
              onClick={() => {
                void togglePetDisplayMode()
              }}
            >
              <LayoutList size={14} />
              {petDisplayModeMenuLabel(settings.petDisplayMode)}
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
                await reloadSessions({ showLoading: false, notify: true })
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
            <span title={dataRoot}>{dataRoot}</span>
          </div>
        </div>

        {activeTab === 'sessions' ? (
          <SessionPanel
            sessions={sessions}
            isLoading={isLoading}
            loadError={sessionLoadError}
            onRefresh={() => reloadSessions({ showLoading: true, notify: true })}
          />
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

async function applySettingsToPet(
  settings: AppSettings,
  windowKind: WindowKind,
  activityCardCount = settings.petActivityVisibleCount,
  activePetAsset: PetAsset | null = null,
) {
  const layoutSettings = {
    ...settings,
    petActivityVisibleCount: effectiveActivityVisibleCount(settings, activityCardCount),
    petFrameSize: activePetAsset
      ? {
          width: activePetAsset.atlasProfile.frameWidth,
          height: activePetAsset.atlasProfile.frameHeight,
        }
      : null,
  }

  if (windowKind === 'pet') {
    await Promise.all([
      applyPetScale(settings.petScale, undefined, layoutSettings),
      applyPetAlwaysOnTop(settings.petAlwaysOnTop),
    ])
    return
  }

  const petWindow = await getPetWindow()
  if (!petWindow) return

  await Promise.all([
    applyPetScale(settings.petScale, petWindow, layoutSettings),
    applyPetAlwaysOnTop(settings.petAlwaysOnTop, petWindow),
  ])
}

function effectiveActivityVisibleCount(settings: AppSettings, activityCardCount: number) {
  if (settings.petDisplayMode !== 'activity') return settings.petActivityVisibleCount
  return Math.min(settings.petActivityVisibleCount, Math.max(0, activityCardCount))
}

function importedPetDragWindowResize(
  settings: AppSettings,
  activityCardCount: number,
  activePetAsset: PetAsset | null,
) {
  if (!activePetAsset) return null

  const petFrameSize = {
    width: activePetAsset.atlasProfile.frameWidth,
    height: activePetAsset.atlasProfile.frameHeight,
  }

  return {
    dragSize: petWindowSizeForDisplay({
      scale: settings.petScale,
      displayMode: 'minimal',
      visibleCount: 0,
      petFrameSize,
    }),
    restoreSize: petWindowSizeForDisplay({
      scale: settings.petScale,
      displayMode: settings.petDisplayMode,
      visibleCount: effectiveActivityVisibleCount(settings, activityCardCount),
      activityWidth: settings.petActivityWindowWidth,
      petFrameSize,
    }),
  }
}

function countOpenSessions(sessions: SessionSnapshot[]) {
  return sessions.filter((session) => session.status !== 'closed').length
}

function petAssetForId(petId: string | null, petAssets: PetAsset[]) {
  if (!petId) return builtInPetAsset
  return petAssets.find((petAsset) => petAsset.id === petId) ?? builtInPetAsset
}

function petMessageBoxOpacityStyle(opacityPercent: number): CSSProperties {
  const opacity = Math.min(0.95, Math.max(0.25, opacityPercent / 100))

  return {
    '--pet-glass-strong-alpha': opacity.toFixed(2),
    '--pet-glass-soft-alpha': Math.max(0.12, opacity * 0.62).toFixed(2),
    '--pet-card-fill-alpha': Math.max(0.03, opacity * 0.1).toFixed(2),
    '--pet-card-fill-hover-alpha': Math.max(0.05, opacity * 0.15).toFixed(2),
    '--pet-tone-intervention-alpha': Math.max(0.07, opacity * 0.26).toFixed(2),
    '--pet-tone-failed-alpha': Math.max(0.06, opacity * 0.21).toFixed(2),
    '--pet-tone-active-alpha': Math.max(0.05, opacity * 0.19).toFixed(2),
  } as CSSProperties
}

function importedPetFrameStyle(activePetAsset: PetAsset | null): CSSProperties {
  if (!activePetAsset) return {}

  return {
    '--pet-imported-frame-width': `${activePetAsset.atlasProfile.frameWidth}px`,
    '--pet-imported-frame-height': `${activePetAsset.atlasProfile.frameHeight}px`,
  } as CSSProperties
}

export default App
