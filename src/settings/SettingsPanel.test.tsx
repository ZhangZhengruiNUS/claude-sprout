import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import '../i18n/i18n'
import { builtInPetAsset } from '../pet/builtInPetAsset'
import { DEFAULT_APP_SETTINGS } from './appSettings'
import { SettingsPanel } from './SettingsPanel'

function renderSettingsPanel() {
  return renderToStaticMarkup(
    <SettingsPanel
      settings={DEFAULT_APP_SETTINGS}
      petAssets={[builtInPetAsset]}
      previewPetId={null}
      codexPetCandidates={[]}
      hasScannedCodexPets={false}
      isScanningCodexPets={false}
      importingPetSourcePath={null}
      petImportError={null}
      storageSummary={null}
      isStorageLoading={false}
      isStorageCleaning={false}
      storageMessage={null}
      onSettingsChange={vi.fn()}
      onPetSizePresetChange={vi.fn()}
      onPreviewPet={vi.fn()}
      onApplyPetSelection={vi.fn()}
      onPreviewPetAnimation={vi.fn()}
      onRefreshPetAssets={vi.fn()}
      onScanCodexPets={vi.fn()}
      onImportCodexPet={vi.fn()}
      onRefreshStorage={vi.fn()}
      onCleanStorage={vi.fn()}
      onOpenDataFolder={vi.fn()}
    />,
  )
}

describe('SettingsPanel', () => {
  it('describes do not disturb as native-notification-only suppression', () => {
    const html = renderSettingsPanel()

    expect(html).toContain('Suppress Windows system notifications only')
    expect(html).toContain('pet cards, Board, and session state stay visible')
  })

  it('renders theme selection alongside language settings', () => {
    const html = renderSettingsPanel()

    expect(html).toContain('Theme')
    expect(html).toContain('Follow Windows by default')
    expect(html).toContain('Light')
    expect(html).toContain('Dark')
  })
})
