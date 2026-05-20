import type { CSSProperties, MouseEvent, PointerEvent } from 'react'
import { useRef } from 'react'
import type { SessionStatus } from '../sessions/sessionTypes'
import { type PetAnimation, statusToPetAnimation } from './petStateMapper'
import type { PetDragOrigin, PetDragSession } from './petWindowControls'

type Props = {
  status: SessionStatus
  alertCount: number
  compact?: boolean
  draggable?: boolean
  scale?: number
  action?: PetAnimation | null
  onClick?: () => void
  onDoubleClick?: () => void
  onContextMenu?: () => void
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
  onClick,
  onDoubleClick,
  onContextMenu,
  onWheel,
  onDragStart,
}: Props) {
  const animation = action ?? statusToPetAnimation(status)
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
        onContextMenu?.()
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
      <div className={`sprout-pet ${animation}`}>
        <div className="sprout-leaf" />
        <div className="sprout-face">
          <span />
          <span />
        </div>
      </div>
      {status === 'waiting_permission' ? (
        <div className="alert-bubble">Permission needed{alertCount > 1 ? ` x${alertCount}` : ''}</div>
      ) : null}
      {!compact ? (
        <div className="pet-caption">{status}</div>
      ) : (
        <div className="pet-hint">{draggable ? 'drag / wheel / double-click' : 'locked / wheel / double-click'}</div>
      )}
    </button>
  )
}
