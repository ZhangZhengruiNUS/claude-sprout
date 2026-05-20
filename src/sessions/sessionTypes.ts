export type SessionStatus =
  | 'idle'
  | 'running'
  | 'tool_running'
  | 'waiting_permission'
  | 'waiting_input'
  | 'done'
  | 'error'
  | 'stale'
  | 'probably_closed'
  | 'closed'

export type SessionSnapshot = {
  session_id: string
  project_name: string
  cwd: string
  status: SessionStatus
  last_event: string
  notification_type?: string | null
  last_tool?: string | null
  context_used_percentage?: number | null
  last_heartbeat_at?: string | null
  updated_at: string
  ended_at?: string | null
  end_reason?: string | null
  source: 'claude-code-hook' | 'claude-code-statusline' | 'mock' | string
}

export type SessionEvent = {
  session_id: string
  event_name: string
  status: SessionStatus
  timestamp: string
  tool_name?: string | null
  notification_type?: string | null
}
