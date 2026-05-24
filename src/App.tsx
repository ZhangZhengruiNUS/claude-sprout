import {
  Bell,
  EyeOff,
  FolderOpen,
  LayoutList,
  PanelTopOpen,
  PawPrint,
  Settings,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
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
import {
  isBuiltInPetSelectionId,
  normalizePetSelectionId,
} from './pet/builtInPetIdentity'
import type { PetDragAnimation } from './pet/petDragAnimation'
import { resolvePetWindowAction } from './pet/petActionPriority'
import {
  nextPetDisplayMode,
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
  beginPetContextMenu,
  beginPetDrag,
  getPetWindow,
  hideCurrentPetWindow,
  type PetContextMenuSession,
} from './pet/petWindowControls'
import {
  importedActivityHudTop,
  minimalHudBottomOffset,
  petWindowSizeForDisplay,
} from './pet/petWindowLayout'
import { shouldDismissPetContextMenu } from './pet/petContextMenu'
import type { PetAnimation } from './pet/petStateMapper'
import { getHighestPriorityStatus } from './pet/petStateMapper'
import {
  buildPetAssistantView,
  petAssistantMessageKeysForSessions,
  petAssistantMessageKey,
  prunePetAssistantMessageKeys,
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
import { applyAppTheme } from './settings/appTheme'
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
import { applyAppLanguage } from './i18n/i18n'
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
  const { t } = useTranslation()
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
  const [previewPetId, setPreviewPetId] = useState<string | null>(
    normalizePetSelectionId(settings.activePetId),
  )
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
  const petContextMenuSessionRef = useRef<PetContextMenuSession | null>(null)
  const petContextMenuOpenSequenceRef = useRef(0)
  const playedPetEventActionKeysRef = useRef(new Set<string>())
  const petEventActionQueueRef = useRef<PetEventAction[]>([])
  const isPlayingQueuedPetEventActionRef = useRef(false)
  const petActionClearTimerRef = useRef<number | null>(null)

  const closePetContextMenu = useCallback(() => {
    petContextMenuOpenSequenceRef.current += 1
    setPetMenuPosition(null)
    const session = petContextMenuSessionRef.current
    petContextMenuSessionRef.current = null
    return session?.end() ?? Promise.resolve()
  }, [])

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
      setSessionLoadError(t('errors.sessionLoadFailed', { message: errorMessage(error) }))
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
    const currentMessageKeys = petAssistantMessageKeysForSessions(nextSessions)
    setAcknowledgedPetMessageKeys((current) => {
      const next = prunePetAssistantMessageKeys(current, currentMessageKeys)
      return next.size === current.size ? current : next
    })
    setSessions(nextSessions)
    if (options.showLoading ?? true) {
      setIsLoading(false)
    }
  }

  async function reloadSessions(options: { showLoading?: boolean; notify?: boolean } = {}) {
    try {
      await refreshSessions()
    } catch (error) {
      setSessionLoadError(t('errors.sessionRefreshFailed', { message: errorMessage(error) }))
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
          setSessionLoadError(t('errors.dataRootFailed', { message: errorMessage(error) }))
        }
      })

    return () => {
      isMounted = false
    }
  }, [t])

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
        translate: (key, options) => t(key, options),
      }),
    [
      acknowledgedPetMessageKeys,
      petAssistantTick,
      sessions,
      settings.petActivityVisibleCount,
      settings.petCompletionToastSeconds,
      settings.petConversationPreviewEnabled,
      settings.petDisplayMode,
      t,
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
    const currentKeys = petAssistantMessageKeysForSessions(sessions)
    const now = Date.now()
    for (const session of sessions) {
      if (!currentKeys.has(petAssistantMessageKey(session))) continue
      const key = petAssistantMessageKey(session)
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
    let isMounted = true
    void loadPersistedAppSettings().then((persistedSettings) => {
      if (!isMounted) return
      // Settings are owned by the app-data store; the sync load only seeds first paint.
      setSettings(persistedSettings)
      setPreviewPetId(normalizePetSelectionId(persistedSettings.activePetId))
    })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    void applyAppLanguage(settings.language)
  }, [settings.language])

  useEffect(() => {
    applyAppTheme(settings.theme)

    if (settings.theme !== 'system' || typeof window.matchMedia !== 'function') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = () => {
      applyAppTheme(settings.theme)
    }

    media.addEventListener('change', handleSystemThemeChange)
    return () => media.removeEventListener('change', handleSystemThemeChange)
  }, [settings.theme])

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
        normalizePetSelectionId(currentPreviewPetId) === normalizePetSelectionId(previousAppliedPetId)
          ? normalizePetSelectionId(event.payload.activePetId)
          : currentPreviewPetId,
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
        void closePetContextMenu()
      }
    }

    function closeMenuOnWindowBlur() {
      void closePetContextMenu()
    }

    window.addEventListener('pointerdown', closeMenuOnOutsidePointer, true)
    window.addEventListener('blur', closeMenuOnWindowBlur)
    return () => {
      window.removeEventListener('pointerdown', closeMenuOnOutsidePointer, true)
      window.removeEventListener('blur', closeMenuOnWindowBlur)
    }
  }, [closePetContextMenu, petMenuPosition, windowKind])

  useEffect(() => {
    if (windowKind !== 'panel' || activeTab !== 'settings') return
    void loadStorageSummary()
    // Storage refresh is keyed by the visible Settings tab; the loader intentionally reads current translation state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    void closePetContextMenu()
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

  async function openPetContextMenu(position: { x: number; y: number }) {
    await closePetContextMenu()
    const sequence = petContextMenuOpenSequenceRef.current + 1
    petContextMenuOpenSequenceRef.current = sequence
    const session = await beginPetContextMenu(
      position,
      petWindowSizeForCurrentSettings(settings, activityCardCount, activePetAsset),
    )
    if (sequence !== petContextMenuOpenSequenceRef.current) {
      await session.end()
      return
    }

    petContextMenuSessionRef.current = session
    setPetMenuPosition(session.position)
  }

  async function resizePet(delta: number) {
    await closePetContextMenu()
    await updateSettings(settingsWithPetScale(settings, settings.petScale + delta * 0.1))
  }

  async function togglePetDisplayMode() {
    await closePetContextMenu()
    await updateSettingsFromLatest((currentSettings) => ({
      ...currentSettings,
      petDisplayMode: nextPetDisplayMode(currentSettings.petDisplayMode),
    }))
  }

  async function hidePet() {
    await closePetContextMenu()
    await hideCurrentPetWindow()
  }

  async function updateSettings(nextSettings: AppSettings) {
    const normalizedNextSettings = {
      ...nextSettings,
      activePetId: normalizePetSelectionId(nextSettings.activePetId),
    }
    settingsRef.current = normalizedNextSettings
    const savedSettings = await savePersistedAppSettings(normalizedNextSettings)
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
      activePetId: normalizePetSelectionId(previewPetId),
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
      setStorageMessage(t('errors.storageSummaryFailed', { message: errorMessage(error) }))
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
        t('storage.deleted', {
          count: result.deletedFileCount,
          bytes: formatBytes(result.deletedBytes),
        }),
      )
      if (kind === 'safe_sessions') {
        await load({ showLoading: false })
      }
    } catch (error) {
      setStorageMessage(t('errors.storageCleanupFailed', { message: errorMessage(error) }))
    } finally {
      setIsStorageCleaning(false)
    }
  }

  const previewPetAsset =
    windowKind === 'panel'
      ? petAssetForId(previewPetId, petAssets)
      : activePetAsset

  if (windowKind === 'pet') {
    const petRenderScale = settings.petDisplayMode === 'activity' ? settings.petScale * 0.78 : settings.petScale

    return (
      <main
        className={`floating-pet-shell ${settings.petDisplayMode}${activePetAsset ? ' imported-pet-active' : ''}${isPetDragging ? ' dragging' : ''}`}
        style={{
          ...petMessageBoxOpacityStyle(settings.petMessageBoxOpacity),
          ...importedPetFrameStyle(activePetAsset, settings),
        }}
      >
        <PetRenderer
          status={topStatus}
          alertCount={waitingCount}
          compact
          draggable={!settings.petLockPosition}
          scale={petRenderScale}
          action={resolvePetWindowAction(activePetAsset !== null, petAction, petDragAnimation)}
          actionReplayKey={petActionReplayKey}
          petAsset={activePetAsset}
          showAlertBubble={false}
          onClick={() => {
            void closePetContextMenu()
            void showSessionPanel()
          }}
          onDoubleClick={() => playPetAction('waving')}
          onContextMenu={(position) => {
            void openPetContextMenu(position)
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
              void closePetContextMenu()
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
            void closePetContextMenu()
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
              title={t('petMenu.openTitle')}
              onClick={() => {
                void closePetContextMenu()
                void showSessionPanel()
              }}
            >
              <PanelTopOpen size={14} />
              {t('petMenu.open')}
            </button>
            <button
              type="button"
              title={t('petMenu.hideTitle')}
              onClick={() => {
                void hidePet()
              }}
            >
              <EyeOff size={14} />
              {t('petMenu.hide')}
            </button>
            <button
              type="button"
              title={t(
                settings.petDisplayMode === 'activity'
                  ? 'petMenu.switchToMinimal'
                  : 'petMenu.switchToActivity',
              )}
              onClick={() => {
                void togglePetDisplayMode()
              }}
            >
              <LayoutList size={14} />
              {t(settings.petDisplayMode === 'activity' ? 'petMenu.minimal' : 'petMenu.activity')}
            </button>
            <button
              type="button"
              title={t('petMenu.largerTitle')}
              onClick={() => {
                void resizePet(1)
              }}
            >
              <ZoomIn size={14} />
              {t('petMenu.larger')}
            </button>
            <button
              type="button"
              title={t('petMenu.smallerTitle')}
              onClick={() => {
                void resizePet(-1)
              }}
            >
              <ZoomOut size={14} />
              {t('petMenu.smaller')}
            </button>
          </div>
        ) : null}
      </main>
    )
  }

  return (
    <main className="app-shell">
      <aside className="pet-rail" aria-label={t('app.petPreviewLabel')}>
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
          <button
            type="button"
            className={activeTab === 'sessions' ? 'active' : ''}
            onClick={() => setActiveTab('sessions')}
          >
            <Bell size={16} />
            {t('app.sessionsTab')}
          </button>
          <button
            type="button"
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={16} />
            {t('app.settingsTab')}
          </button>
        </div>
      </aside>

      <section className="content-panel">
        <div className="status-strip">
          <div>
            <span className="metric">{activeCount}</span>
            <span>{t('app.trackedSessions')}</span>
          </div>
          <div>
            <span className={`status-dot ${topStatus}`} />
            <span>{t('app.highestPriority', { status: t(`status.${topStatus}`) })}</span>
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
            conversationPreviewEnabled={settings.petConversationPreviewEnabled}
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

function petWindowSizeForCurrentSettings(
  settings: AppSettings,
  activityCardCount: number,
  activePetAsset: PetAsset | null,
) {
  return petWindowSizeForDisplay({
    scale: settings.petScale,
    displayMode: settings.petDisplayMode,
    visibleCount: effectiveActivityVisibleCount(settings, activityCardCount),
    activityWidth: settings.petActivityWindowWidth,
    petFrameSize: activePetAsset
      ? {
          width: activePetAsset.atlasProfile.frameWidth,
          height: activePetAsset.atlasProfile.frameHeight,
        }
      : null,
  })
}

function countOpenSessions(sessions: SessionSnapshot[]) {
  return sessions.filter((session) => session.status !== 'closed').length
}

function petAssetForId(petId: string | null, petAssets: PetAsset[]) {
  if (isBuiltInPetSelectionId(petId)) return builtInPetAsset
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

function importedPetFrameStyle(activePetAsset: PetAsset | null, settings: AppSettings): CSSProperties {
  if (!activePetAsset) return {}

  return {
    '--pet-imported-frame-width': `${activePetAsset.atlasProfile.frameWidth}px`,
    '--pet-imported-frame-height': `${activePetAsset.atlasProfile.frameHeight}px`,
    '--pet-activity-hud-top': `${importedActivityHudTop(
      activePetAsset.atlasProfile.frameHeight,
      settings.petScale,
    )}px`,
    '--pet-minimal-hud-bottom': `${minimalHudBottomOffset(
      activePetAsset.atlasProfile.frameHeight,
      settings.petScale,
    )}px`,
  } as CSSProperties
}

export default App
