import type { CSSProperties, PointerEvent } from 'react'
import { useRef } from 'react'
import type { SessionStatus } from '../sessions/sessionTypes'
import { type PetAnimation, statusToPetAnimation } from './petStateMapper'

type Props = {
  status: SessionStatus
  alertCount: number
  compact?: boolean
  scale?: number
  action?: PetAnimation | null
  onClick?: () => void
  onDoubleClick?: () => void
  onContextMenu?: () => void
  onWheel?: (delta: number) => void
  onDragStart?: () => void
}

export function PetRenderer({
  status,
  alertCount,
  compact = false,
  scale = 1,
  action,
  onClick,
  onDoubleClick,
  onContextMenu,
  onWheel,
  onDragStart,
}: Props) {
  const animation = action ?? statusToPetAnimation(status)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!compact || event.button !== 0) return
    pointerStart.current = { x: event.clientX, y: event.clientY }
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!pointerStart.current || !compact) return
    const moved = Math.hypot(
      event.clientX - pointerStart.current.x,
      event.clientY - pointerStart.current.y,
    )
    if (moved < 6) return
    pointerStart.current = null
    onDragStart?.()
  }

  return (
    <button
      type="button"
      className={`pet-surface ${status}${compact ? ' compact' : ''}`}
      aria-label="Open session panel"
      onClick={onClick}
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
      {!compact ? <div className="pet-caption">{status}</div> : <div className="pet-hint">wheel / double-click</div>}
    </button>
  )
}
