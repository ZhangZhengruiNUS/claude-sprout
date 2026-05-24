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
      petAssets={[
        builtInPetAsset,
        {
          ...builtInPetAsset,
          id: 'handoff',
          name: 'Handoff',
          description: 'Imported helper',
          spritesheetPath: 'C:/pets/handoff/spritesheet.webp',
        },
      ]}
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
      onRemovePet={vi.fn()}
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

  it('keeps pet appearance compact behind a manager entry', () => {
    const html = renderSettingsPanel()

    expect(html).toContain('Manage pets')
    expect(html).toContain('Claude Sprout')
    expect(html).not.toContain('Handoff</button>')
  })

  it('sizes segmented controls from their option counts', () => {
    const html = renderSettingsPanel()

    expect(html).toContain('aria-label="Pet mode" style="--segment-count:2"')
    expect(html).toContain('aria-label="Language" style="--segment-count:3"')
    expect(html).toContain('aria-label="Pet size" style="--segment-count:3"')
  })
})
