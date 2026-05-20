import type { SessionSnapshot, SessionStatus } from '../sessions/sessionTypes'

export type PetAnimation =
  | 'idle'
  | 'wave'
  | 'run'
  | 'failed'
  | 'review'
  | 'jump'
  | 'extra1'
  | 'extra2'

const priority: SessionStatus[] = [
  'waiting_permission',
  'error',
  'waiting_input',
  'tool_running',
  'running',
  'done',
  'stale',
  'probably_closed',
  'idle',
  'closed',
]

const mapping: Record<SessionStatus, PetAnimation> = {
  idle: 'idle',
  running: 'run',
  tool_running: 'run',
  waiting_permission: 'jump',
  waiting_input: 'wave',
  done: 'review',
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
