import type { SessionStatus } from '../sessions/sessionTypes'
import type { PetAnimation } from './petStateMapper'

type PetAnimationRenderKeyInput = {
  animation: PetAnimation
  mode: 'loop' | 'once'
  actionActive: boolean
  actionReplayKey: number
  petAssetId: string
  status: SessionStatus
  alertCount: number
}

export function petAnimationRenderKey({
  animation,
  mode,
  actionActive,
  actionReplayKey,
  petAssetId,
  status,
  alertCount,
}: PetAnimationRenderKeyInput) {
  if (mode === 'loop') return animation

  const replaySource = actionActive ? `action-${actionReplayKey}` : `status-${status}-${alertCount}`
  return `${petAssetId}-${animation}-${replaySource}`
}
