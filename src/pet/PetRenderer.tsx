import type { CSSProperties, MouseEvent, PointerEvent } from 'react'
import { useEffect, useRef } from 'react'
import type { SessionStatus } from '../sessions/sessionTypes'
import { type PetAnimation, statusToPetAnimation } from './petStateMapper'
import type { PetDragOrigin, PetDragSession } from './petWindowControls'
import type { PetAsset } from './petAssetsApi'
import { petAnimationRenderKey } from './petAnimation'
import { dragDeltaToPetAnimation, type PetDragAnimation } from './petDragAnimation'
import { PET_DRAG_CANCEL_EVENTS } from './petDragLifecycle'

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
  onDragStateChange?: (isDragging: boolean) => void
  onDragDirectionChange?: (animation: PetDragAnimation | null) => void
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
  onDragStateChange,
  onDragDirectionChange,
}: Props) {
  const animation = action ?? statusToPetAnimation(status)
  const atlasAnimation = petAsset?.atlasProfile.animations[animation]
  const animationMode = atlasAnimation?.mode ?? builtInAnimationMode(animation)
  const useQuietIdle = animation === 'idle' && (action === null || action === undefined)
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
  const hitTargetWidth = petAsset
    ? Math.round(petAsset.atlasProfile.frameWidth * scale * 0.82)
    : Math.round(118 * scale)
  const hitTargetHeight = petAsset
    ? Math.round(petAsset.atlasProfile.frameHeight * scale * 0.9)
    : Math.round(132 * scale)
  const pointerStart = useRef<{ x: number; y: number; screenX: number; screenY: number } | null>(null)
  const previousDragScreenX = useRef<number | null>(null)
  const dragSession = useRef<PetDragSession | null>(null)
  const isDragging = useRef(false)
  const currentDragAnimation = useRef<PetDragAnimation | null>(null)
  const suppressNextClick = useRef(false)
  const dragCaptureTarget = useRef<HTMLButtonElement | null>(null)
  const dragPointerId = useRef<number | null>(null)
  const detachWindowDragListeners = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      detachWindowDragListeners.current?.()
    }
  }, [])

  function attachWindowDragListeners() {
    if (typeof window === 'undefined') return

    detachWindowDragListeners.current?.()
    const finish = () => finishPointerDrag()
    PET_DRAG_CANCEL_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, finish, true)
    })
    detachWindowDragListeners.current = () => {
      PET_DRAG_CANCEL_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, finish, true)
      })
    }
  }

  function finishPointerDrag(target?: HTMLButtonElement, pointerId?: number) {
    detachWindowDragListeners.current?.()
    detachWindowDragListeners.current = null

    const captureTarget = target ?? dragCaptureTarget.current
    const capturedPointerId = pointerId ?? dragPointerId.current
    if (
      captureTarget &&
      capturedPointerId !== null &&
      captureTarget.hasPointerCapture(capturedPointerId)
    ) {
      captureTarget.releasePointerCapture(capturedPointerId)
    }

    if (isDragging.current) {
      suppressNextClick.current = true
      onDragStateChange?.(false)
      void dragSession.current?.end?.()
    }
    currentDragAnimation.current = null
    onDragDirectionChange?.(null)
    pointerStart.current = null
    previousDragScreenX.current = null
    dragSession.current = null
    dragCaptureTarget.current = null
    dragPointerId.current = null
    isDragging.current = false
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!compact || !draggable || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragCaptureTarget.current = event.currentTarget
    dragPointerId.current = event.pointerId
    attachWindowDragListeners()
    const hitTargetRect = event.currentTarget
      .querySelector<HTMLElement>('.pet-hit-target')
      ?.getBoundingClientRect()
    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      screenX: event.screenX,
      screenY: event.screenY,
    }
    previousDragScreenX.current = event.screenX
    const dragSessionPromise = onDragStart?.({
      screenX: event.screenX,
      screenY: event.screenY,
      targetOffsetX: hitTargetRect ? event.clientX - hitTargetRect.left : undefined,
      targetOffsetY: hitTargetRect ? event.clientY - hitTargetRect.top : undefined,
      targetWidth: hitTargetRect?.width,
      targetHeight: hitTargetRect?.height,
    })
    void dragSessionPromise?.then((session) => {
      if (!pointerStart.current) return
      dragSession.current = session
      if (isDragging.current) {
        void dragSession.current?.start?.()
      }
    })
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!pointerStart.current || !compact) return
    const moved = Math.hypot(
      event.clientX - pointerStart.current.x,
      event.clientY - pointerStart.current.y,
    )
    if (moved < 6 && !isDragging.current) return
    if (!isDragging.current) {
      isDragging.current = true
      void dragSession.current?.start?.()
      onDragStateChange?.(true)
    }
    const dragAnimation = dragDeltaToPetAnimation(
      event.screenX - (previousDragScreenX.current ?? pointerStart.current.screenX),
    )
    previousDragScreenX.current = event.screenX
    if (dragAnimation && dragAnimation !== currentDragAnimation.current) {
      currentDragAnimation.current = dragAnimation
      onDragDirectionChange?.(dragAnimation)
    }
    void dragSession.current?.move(event.screenX, event.screenY)
  }

  function handlePointerEnd(event: PointerEvent<HTMLButtonElement>) {
    finishPointerDrag(event.currentTarget, event.pointerId)
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
      className={`pet-surface ${status}${petAsset ? ' imported-pet' : ''}${compact ? ' compact' : ''}${!draggable ? ' locked' : ''}`}
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
      onLostPointerCapture={handlePointerEnd}
      style={{ '--pet-scale': scale } as CSSProperties}
    >
      <div
        className="pet-hit-target"
        style={
          {
            '--pet-hit-target-width': `${hitTargetWidth}px`,
            '--pet-hit-target-height': `${hitTargetHeight}px`,
          } as CSSProperties
        }
      >
        {petAsset && atlasAnimation ? (
          <div
            key={animationKey}
            className={`sprite-pet ${atlasAnimation.mode}${useQuietIdle ? ' quiet-idle' : ''}`}
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
                ...(useQuietIdle ? { '--sprite-quiet-cycle': '5500ms' } : {}),
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
      </div>
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
