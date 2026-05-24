import {
  EyeOff,
  LayoutList,
  PanelTopOpen,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppSettings } from '../settings/appSettings'
import type { PetContextMenuAction } from './petContextMenuActions'

type Props = {
  settings: AppSettings
  onAction: (action: PetContextMenuAction) => void
  menuRef?: (node: HTMLDivElement | null) => void
  style?: CSSProperties
  windowMenu?: boolean
}

export function PetContextMenu({
  settings,
  onAction,
  menuRef,
  style,
  windowMenu = false,
}: Props) {
  const { t } = useTranslation()

  return (
    <div
      ref={menuRef}
      className={`pet-context-menu${windowMenu ? ' window-menu' : ''}`}
      style={style}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        title={t('petMenu.openTitle')}
        onClick={() => onAction('open')}
      >
        <PanelTopOpen size={14} />
        {t('petMenu.open')}
      </button>
      <button
        type="button"
        title={t('petMenu.hideTitle')}
        onClick={() => onAction('hide')}
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
        onClick={() => onAction('toggleDisplayMode')}
      >
        <LayoutList size={14} />
        {t(settings.petDisplayMode === 'activity' ? 'petMenu.minimal' : 'petMenu.activity')}
      </button>
      <button
        type="button"
        title={t('petMenu.largerTitle')}
        onClick={() => onAction('larger')}
      >
        <ZoomIn size={14} />
        {t('petMenu.larger')}
      </button>
      <button
        type="button"
        title={t('petMenu.smallerTitle')}
        onClick={() => onAction('smaller')}
      >
        <ZoomOut size={14} />
        {t('petMenu.smaller')}
      </button>
    </div>
  )
}
