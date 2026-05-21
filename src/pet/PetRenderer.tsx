import type { CSSProperties, MouseEvent, PointerEvent } from 'react'
import { useRef } from 'react'
import type { SessionStatus } from '../sessions/sessionTypes'
import { type PetAnimation, statusToPetAnimation } from './petStateMapper'
import type { PetDragOrigin, PetDragSession } from './petWindowControls'
import type { PetAsset } from './petAssetsApi'
import { petAnimationRenderKey } from './petAnimation'

type Props = {
  status: SessionStatus
  alertCount: number
  compact?: boolean
  draggable?: boolean
  scale?: number
  action?: PetAnimation | null
  actionReplayKey?: number
  petAsset?: PetAsset | null
  showAlertBubble?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
  onContextMenu?: (position: { x: number; y: number }) => void
  onWheel?: (delta: number) => void
  onDragStart?: (origin: PetDragOrigin) => Promise<PetDragSession | null>
}

export function PetRenderer({
  status,
  alertCount,
  compact = false,
  draggable = true,
  scale = 1,
  action,
  actionReplayKey = 0,
  petAsset,
  showAlertBubble = true,
  onClick,
  onDoubleClick,
  onContextMenu,
  onWheel,
  onDragStart,
}: Props) {
  const animation = action ?? statusToPetAnimation(status)
  const atlasAnimation = petAsset?.atlasProfile.animations[animation]
  const animationMode = atlasAnimation?.mode ?? builtInAnimationMode(animation)
  const animationKey = petAnimationRenderKey({
    animation,
    mode: animationMode,
    actionActive: action !== null && action !== undefined,
    actionReplayKey,
    petAssetId: petAsset?.id ?? 'built-in',
    status,
    alertCount,
  })
  const spriteDuration =
    atlasAnimation && petAsset ? atlasAnimation.durationMs : null
  const spriteSheetWidth =
    atlasAnimation && petAsset ? petAsset.atlasProfile.frameWidth * petAsset.atlasProfile.cols : null
  const spriteSheetHeight = petAsset ? petAsset.atlasProfile.frameHeight * petAsset.atlasProfile.rows : null
  const spriteRowOffset =
    atlasAnimation && petAsset ? atlasAnimation.row * petAsset.atlasProfile.frameHeight * -1 : null
  const spriteEndOffset =
    atlasAnimation && petAsset ? petAsset.atlasProfile.frameWidth * atlasAnimation.frameCount * -1 : null
  const spriteHoldOffset =
    atlasAnimation && petAsset
      ? petAsset.atlasProfile.frameWidth * Math.max(0, atlasAnimation.frameCount - 1) * -1
      : null
  const spriteOnceSteps = atlasAnimation ? Math.max(1, atlasAnimation.frameCount - 1) : null
  const pointerStart = useRef<{ x: number; y: number; screenX: number; screenY: number } | null>(null)
  const dragSession = useRef<PetDragSession | null>(null)
  const isDragging = useRef(false)
  const suppressNextClick = useRef(false)

  async function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!compact || !draggable || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      screenX: event.screenX,
      screenY: event.screenY,
    }
    dragSession.current =
      (await onDragStart?.({ screenX: event.screenX, screenY: event.screenY })) ?? null
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!pointerStart.current || !compact) return
    const moved = Math.hypot(
      event.clientX - pointerStart.current.x,
      event.clientY - pointerStart.current.y,
    )
    if (moved < 6 && !isDragging.current) return
    isDragging.current = true
    void dragSession.current?.move(event.screenX, event.screenY)
  }

  function handlePointerEnd(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (isDragging.current) {
      suppressNextClick.current = true
    }
    pointerStart.current = null
    dragSession.current = null
    isDragging.current = false
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (suppressNextClick.current) {
      event.preventDefault()
      suppressNextClick.current = false
      return
    }
    onClick?.()
  }

  return (
    <button
      type="button"
      className={`pet-surface ${status}${compact ? ' compact' : ''}${!draggable ? ' locked' : ''}`}
      aria-label="Open session panel"
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu?.({ x: event.clientX, y: event.clientY })
      }}
      onWheel={(event) => {
        if (!compact) return
        event.preventDefault()
        onWheel?.(event.deltaY < 0 ? 1 : -1)
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      style={{ '--pet-scale': scale } as CSSProperties}
    >
      {petAsset && atlasAnimation ? (
        <div
          key={animationKey}
          className={`sprite-pet ${atlasAnimation.mode}`}
          style={
            {
              '--sprite-url': `url("${petAsset.imageSrc}")`,
              '--sprite-frames': atlasAnimation.frameCount,
              '--sprite-frame-width': `${petAsset.atlasProfile.frameWidth}px`,
              '--sprite-frame-height': `${petAsset.atlasProfile.frameHeight}px`,
              '--sprite-sheet-width': `${spriteSheetWidth}px`,
              '--sprite-sheet-height': `${spriteSheetHeight}px`,
              '--sprite-row-offset': `${spriteRowOffset}px`,
              '--sprite-end-offset': `${spriteEndOffset}px`,
              '--sprite-hold-offset': `${spriteHoldOffset}px`,
              '--sprite-once-steps': spriteOnceSteps,
              '--sprite-duration': `${spriteDuration}ms`,
            } as CSSProperties
          }
        />
      ) : (
        <div key={animationKey} className={`sprout-pet ${animation}`}>
          <div className="sprout-leaf" />
          <div className="sprout-face">
            <span />
            <span />
          </div>
        </div>
      )}
      {showAlertBubble && status === 'waiting_permission' ? (
        <div className="alert-bubble">Permission needed{alertCount > 1 ? ` x${alertCount}` : ''}</div>
      ) : null}
      {!compact ? <div className="pet-caption">{status}</div> : null}
    </button>
  )
}

function builtInAnimationMode(animation: PetAnimation) {
  return ['jumping', 'waving', 'failed'].includes(animation) ? 'once' : 'loop'
}
