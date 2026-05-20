import type { SessionStatus } from '../sessions/sessionTypes'
import { statusToPetAnimation } from './petStateMapper'

type Props = {
  status: SessionStatus
  alertCount: number
  compact?: boolean
  onClick?: () => void
}

export function PetRenderer({ status, alertCount, compact = false, onClick }: Props) {
  const animation = statusToPetAnimation(status)

  return (
    <button
      type="button"
      className={`pet-surface ${status}${compact ? ' compact' : ''}`}
      aria-label="Open session panel"
      onClick={onClick}
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
      {!compact ? <div className="pet-caption">{status}</div> : null}
    </button>
  )
}
