import type { SessionStatus } from '../sessions/sessionTypes'
import { statusToPetAnimation } from './petStateMapper'

type Props = {
  status: SessionStatus
  alertCount: number
}

export function PetRenderer({ status, alertCount }: Props) {
  const animation = statusToPetAnimation(status)

  return (
    <button type="button" className={`pet-surface ${status}`} aria-label="Open session panel">
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
      <div className="pet-caption">{status}</div>
    </button>
  )
}
