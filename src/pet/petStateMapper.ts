import type { SessionSnapshot, SessionStatus } from '../sessions/sessionTypes'

export type PetAnimation =
  | 'idle'
  | 'runningRight'
  | 'runningLeft'
  | 'waving'
  | 'jumping'
  | 'failed'
  | 'waiting'
  | 'running'
  | 'review'

const priority: SessionStatus[] = [
  'waiting_permission',
  'error',
  'tool_running',
  'running',
  'done',
  'waiting_input',
  'stale',
  'probably_closed',
  'idle',
  'closed',
]

const mapping: Record<SessionStatus, PetAnimation> = {
  idle: 'idle',
  running: 'running',
  tool_running: 'running',
  waiting_permission: 'waiting',
  waiting_input: 'idle',
  done: 'idle',
  error: 'failed',
  stale: 'idle',
  probably_closed: 'idle',
  closed: 'idle',
}

export function getHighestPriorityStatus(sessions: SessionSnapshot[]): SessionStatus {
  for (const status of priority) {
    if (sessions.some((session) => session.status === status)) {
      return status
    }
  }
  return 'idle'
}

export function statusToPetAnimation(status: SessionStatus): PetAnimation {
  return mapping[status]
}
