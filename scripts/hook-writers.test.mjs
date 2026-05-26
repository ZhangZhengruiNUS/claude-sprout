import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { describe, expect, it } from 'vitest'

async function tempRoot(name) {
  const root = join(tmpdir(), `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  await mkdir(root, { recursive: true })
  return root
}

async function readSnapshot(root, sessionId) {
  const raw = await readFile(join(root, 'sessions', `${sessionId}.json`), 'utf8')
  return JSON.parse(raw.replace(/^\uFEFF/, ''))
}

async function readSnapshotBytes(root, sessionId) {
  return readFile(join(root, 'sessions', `${sessionId}.json`))
}

async function writeSettings(root, settings) {
  await writeFile(join(root, 'settings.json'), JSON.stringify(settings))
}

async function runPowerShellScript(scriptPath, input, env) {
  await runWithStdin(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
    input,
    env,
  )
}

async function runNodeScript(scriptPath, input, env) {
  await runWithStdin('node', [scriptPath], input, env)
}

function runWithStdin(command, args, input, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited ${code}: ${stderr}`))
      }
    })
    child.stdin.end(input)
  })
}

describe('hook writers', () => {
  it('preserves ended_at across PowerShell statusline updates', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      const env = { AGENT_DESKTOP_COMPANION_HOME: root }
      await runPowerShellScript(
        'hooks/windows/agent-desktop-companion-hook.ps1',
        JSON.stringify({
          session_id: 'ps-session',
          hook_event_name: 'Stop',
          cwd: 'E:/Codex Project/agent-desktop-companion',
          reason: 'complete',
        }),
        env,
      )
      await runPowerShellScript(
        'hooks/windows/agent-desktop-companion-statusline.ps1',
        JSON.stringify({
          session_id: 'ps-session',
          workspace: { current_dir: 'E:/Codex Project/agent-desktop-companion' },
          context_window: { used_percentage: 10 },
        }),
        env,
      )

      const snapshot = await readSnapshot(root, 'ps-session')
      expect(snapshot.status).toBe('done')
      expect(snapshot.ended_at).toEqual(expect.any(String))
      expect(snapshot.end_reason).toBe('complete')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('keeps legacy PowerShell wrapper and CLAUDE_SPROUT_HOME compatibility', async () => {
    const root = await tempRoot('agent-desktop-companion-legacy-wrapper')
    try {
      const env = { CLAUDE_SPROUT_HOME: root }
      await runPowerShellScript(
        'hooks/windows/claude-sprout-hook.ps1',
        JSON.stringify({
          session_id: 'ps-legacy-wrapper',
          hook_event_name: 'UserPromptSubmit',
          cwd: 'E:/Codex Project/agent-desktop-companion',
        }),
        env,
      )

      const snapshot = await readSnapshot(root, 'ps-legacy-wrapper')
      expect(snapshot.status).toBe('running')
      expect(snapshot.project_name).toBe('agent-desktop-companion')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('handles UTF-8 Claude payloads with CJK assistant text in PowerShell hooks', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      const env = { AGENT_DESKTOP_COMPANION_HOME: root }
      await runPowerShellScript(
        'hooks/windows/agent-desktop-companion-hook.ps1',
        JSON.stringify({
          session_id: 'ps-cjk-session',
          hook_event_name: 'Stop',
          cwd: 'C:/Users/ASUS',
          last_assistant_message:
            '我是 Claude Code，Anthropic 的 CLI 编程助手。我可以帮你完成软件工程任务。',
          background_tasks: [],
          session_crons: [],
        }),
        env,
      )

      const snapshot = await readSnapshot(root, 'ps-cjk-session')
      expect(snapshot.status).toBe('done')
      expect(snapshot.project_name).toBe('ASUS')
      expect(snapshot.ended_at).toEqual(expect.any(String))

      const raw = await readSnapshotBytes(root, 'ps-cjk-session')
      expect([...raw.subarray(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('preserves ended_at across Node statusline updates', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      const env = { AGENT_DESKTOP_COMPANION_HOME: root }
      await runNodeScript(
        'hooks/node/agent-desktop-companion-hook.js',
        JSON.stringify({
          session_id: 'node-session',
          hook_event_name: 'Stop',
          cwd: 'E:/Codex Project/agent-desktop-companion',
          reason: 'complete',
        }),
        env,
      )
      await runNodeScript(
        'hooks/node/agent-desktop-companion-statusline.js',
        JSON.stringify({
          session_id: 'node-session',
          workspace: { current_dir: 'E:/Codex Project/agent-desktop-companion' },
          context_window: { used_percentage: 10 },
        }),
        env,
      )

      const snapshot = await readSnapshot(root, 'node-session')
      expect(snapshot.status).toBe('done')
      expect(snapshot.ended_at).toEqual(expect.any(String))
      expect(snapshot.end_reason).toBe('complete')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('keeps legacy Node wrapper and CLAUDE_SPROUT_HOME compatibility', async () => {
    const root = await tempRoot('agent-desktop-companion-node-legacy-wrapper')
    try {
      await runNodeScript(
        'hooks/node/claude-sprout-hook.js',
        JSON.stringify({
          session_id: 'node-legacy-wrapper',
          hook_event_name: 'UserPromptSubmit',
          cwd: 'E:/Codex Project/agent-desktop-companion',
        }),
        { CLAUDE_SPROUT_HOME: root },
      )

      const snapshot = await readSnapshot(root, 'node-legacy-wrapper')
      expect(snapshot.status).toBe('running')
      expect(snapshot.project_name).toBe('agent-desktop-companion')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('captures and preserves safe display names from Node hook payloads', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      const env = { AGENT_DESKTOP_COMPANION_HOME: root }
      await runNodeScript(
        'hooks/node/agent-desktop-companion-statusline.js',
        JSON.stringify({
          session_id: 'node-named-session',
          session_title: 'Renamed release follow-up',
          workspace: { current_dir: 'E:/Codex Project/agent-desktop-companion' },
        }),
        env,
      )
      await runNodeScript(
        'hooks/node/agent-desktop-companion-hook.js',
        JSON.stringify({
          session_id: 'node-named-session',
          hook_event_name: 'PreToolUse',
          cwd: 'E:/Codex Project/agent-desktop-companion',
          tool_name: 'Edit',
        }),
        env,
      )

      const snapshot = await readSnapshot(root, 'node-named-session')
      expect(snapshot.display_name).toBe('Renamed release follow-up')
      expect(snapshot.last_tool).toBe('Edit')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('uses Claude transcript summary metadata as a Node display name without assistant text', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      const transcriptPath = join(root, 'node-transcript.jsonl')
      await writeFile(
        transcriptPath,
        [
          JSON.stringify({ type: 'summary', summary: 'Renamed from slash command' }),
          JSON.stringify({ type: 'assistant', message: { content: 'assistant output not for cards' } }),
        ].join('\n'),
      )

      await runNodeScript(
        'hooks/node/agent-desktop-companion-statusline.js',
        JSON.stringify({
          session_id: 'node-summary-session',
          transcript_path: transcriptPath,
          workspace: { current_dir: 'E:/Codex Project/agent-desktop-companion' },
        }),
        { AGENT_DESKTOP_COMPANION_HOME: root },
      )

      const snapshot = await readSnapshot(root, 'node-summary-session')
      expect(snapshot.display_name).toBe('Renamed from slash command')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('does not capture Node conversation previews unless the setting is enabled', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      const transcriptPath = join(root, 'node-preview-off.jsonl')
      await writeFile(
        transcriptPath,
        JSON.stringify({
          type: 'assistant',
          message: { content: [{ type: 'text', text: 'Sensitive local output should stay out' }] },
        }),
      )

      await runNodeScript(
        'hooks/node/agent-desktop-companion-statusline.js',
        JSON.stringify({
          session_id: 'node-preview-off',
          transcript_path: transcriptPath,
          workspace: { current_dir: 'E:/Codex Project/agent-desktop-companion' },
        }),
        { AGENT_DESKTOP_COMPANION_HOME: root },
      )

      const snapshot = await readSnapshot(root, 'node-preview-off')
      expect(snapshot.conversation_preview).toBeNull()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('clears previous Node conversation preview after opt-out', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      await mkdir(join(root, 'sessions'), { recursive: true })
      await writeFile(
        join(root, 'sessions', 'node-preview-clear.json'),
        JSON.stringify({
          session_id: 'node-preview-clear',
          project_name: 'agent-desktop-companion',
          display_name: null,
          conversation_preview: 'Claude: old preview',
          cwd: 'E:/Codex Project/agent-desktop-companion',
          status: 'tool_running',
          last_event: 'PreToolUse',
          notification_type: null,
          last_tool: 'Edit',
          context_used_percentage: null,
          last_heartbeat_at: '2026-05-22T00:00:00Z',
          updated_at: '2026-05-22T00:00:00Z',
          ended_at: null,
          end_reason: null,
          source: 'test',
        }),
      )

      await runNodeScript(
        'hooks/node/agent-desktop-companion-statusline.js',
        JSON.stringify({
          session_id: 'node-preview-clear',
          workspace: { current_dir: 'E:/Codex Project/agent-desktop-companion' },
        }),
        { AGENT_DESKTOP_COMPANION_HOME: root },
      )

      const snapshot = await readSnapshot(root, 'node-preview-clear')
      expect(snapshot.conversation_preview).toBeNull()
      expect(snapshot.last_tool).toBe('Edit')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('skips Node tool result blocks when finding conversation previews', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      await writeSettings(root, { petConversationPreviewEnabled: true })
      const transcriptPath = join(root, 'node-preview-tools.jsonl')
      await writeFile(
        transcriptPath,
        [
          JSON.stringify({
            type: 'assistant',
            message: { content: [{ type: 'text', text: 'Visible assistant message' }] },
          }),
          JSON.stringify({
            type: 'assistant',
            message: { content: [{ type: 'tool_result', content: 'secret command output' }] },
          }),
        ].join('\n'),
      )

      await runNodeScript(
        'hooks/node/agent-desktop-companion-statusline.js',
        JSON.stringify({
          session_id: 'node-preview-tools',
          transcript_path: transcriptPath,
          workspace: { current_dir: 'E:/Codex Project/agent-desktop-companion' },
        }),
        { AGENT_DESKTOP_COMPANION_HOME: root },
      )

      const snapshot = await readSnapshot(root, 'node-preview-tools')
      expect(snapshot.conversation_preview).toBe('Claude: Visible assistant message')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)


  it('captures a truncated Node conversation preview when enabled', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      await writeSettings(root, { petConversationPreviewEnabled: true })
      const transcriptPath = join(root, 'node-preview-on.jsonl')
      await writeFile(
        transcriptPath,
        [
          JSON.stringify({ type: 'user', message: { content: 'Older user request' } }),
          JSON.stringify({
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'text',
                  text: 'Implemented the activity preview toggle and started the focused verification pass with a deliberately long line that should be clipped before it fills the pet card.',
                },
              ],
            },
          }),
        ].join('\n'),
      )

      await runNodeScript(
        'hooks/node/agent-desktop-companion-statusline.js',
        JSON.stringify({
          session_id: 'node-preview-on',
          transcript_path: transcriptPath,
          workspace: { current_dir: 'E:/Codex Project/agent-desktop-companion' },
        }),
        { AGENT_DESKTOP_COMPANION_HOME: root },
      )

      const snapshot = await readSnapshot(root, 'node-preview-on')
      expect(snapshot.conversation_preview).toBe(
        'Claude: Implemented the activity preview toggle and started the focused verification pass with a deliberately long line that should be clipped before it fills the pet card.',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('captures and preserves safe display names from PowerShell hook payloads', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      const env = { AGENT_DESKTOP_COMPANION_HOME: root }
      await runPowerShellScript(
        'hooks/windows/agent-desktop-companion-statusline.ps1',
        JSON.stringify({
          session_id: 'ps-named-session',
          session_title: 'Renamed Windows follow-up',
          workspace: { current_dir: 'E:/Codex Project/agent-desktop-companion' },
        }),
        env,
      )
      await runPowerShellScript(
        'hooks/windows/agent-desktop-companion-hook.ps1',
        JSON.stringify({
          session_id: 'ps-named-session',
          hook_event_name: 'PreToolUse',
          cwd: 'E:/Codex Project/agent-desktop-companion',
          tool_name: 'Bash',
        }),
        env,
      )

      const snapshot = await readSnapshot(root, 'ps-named-session')
      expect(snapshot.display_name).toBe('Renamed Windows follow-up')
      expect(snapshot.last_tool).toBe('Bash')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('uses Claude transcript summary metadata as a PowerShell display name', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      const transcriptPath = join(root, 'ps-transcript.jsonl')
      await writeFile(
        transcriptPath,
        [
          JSON.stringify({ type: 'summary', summary: 'Renamed PowerShell session' }),
          JSON.stringify({ type: 'user', message: { content: 'prompt text not for cards' } }),
        ].join('\n'),
      )

      await runPowerShellScript(
        'hooks/windows/agent-desktop-companion-statusline.ps1',
        JSON.stringify({
          session_id: 'ps-summary-session',
          transcript_path: transcriptPath,
          workspace: { current_dir: 'E:/Codex Project/agent-desktop-companion' },
        }),
        { AGENT_DESKTOP_COMPANION_HOME: root },
      )

      const snapshot = await readSnapshot(root, 'ps-summary-session')
      expect(snapshot.display_name).toBe('Renamed PowerShell session')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('captures a truncated PowerShell conversation preview when enabled', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      await writeSettings(root, { petConversationPreviewEnabled: true })
      const transcriptPath = join(root, 'ps-preview-on.jsonl')
      await writeFile(
        transcriptPath,
        [
          JSON.stringify({ type: 'assistant', message: { content: 'Older assistant reply' } }),
          JSON.stringify({
            type: 'user',
            message: { content: [{ type: 'text', text: 'Please run the final desktop smoke after this change.' }] },
          }),
        ].join('\n'),
      )

      await runPowerShellScript(
        'hooks/windows/agent-desktop-companion-statusline.ps1',
        JSON.stringify({
          session_id: 'ps-preview-on',
          transcript_path: transcriptPath,
          workspace: { current_dir: 'E:/Codex Project/agent-desktop-companion' },
        }),
        { AGENT_DESKTOP_COMPANION_HOME: root },
      )

      const snapshot = await readSnapshot(root, 'ps-preview-on')
      expect(snapshot.conversation_preview).toBe(
        'User: Please run the final desktop smoke after this change.',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('reads UTF-8 PowerShell conversation previews without mojibake', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      await writeSettings(root, { petConversationPreviewEnabled: true })
      const transcriptPath = join(root, 'ps-preview-cjk.jsonl')
      await writeFile(
        transcriptPath,
        JSON.stringify({
          type: 'user',
          message: { content: [{ type: 'text', text: '测试1：请继续检查悬停提示和窗口宽度。' }] },
        }),
        'utf8',
      )

      await runPowerShellScript(
        'hooks/windows/agent-desktop-companion-statusline.ps1',
        JSON.stringify({
          session_id: 'ps-preview-cjk',
          transcript_path: transcriptPath,
          workspace: { current_dir: 'E:/Codex Project/agent-desktop-companion' },
        }),
        { AGENT_DESKTOP_COMPANION_HOME: root },
      )

      const snapshot = await readSnapshot(root, 'ps-preview-cjk')
      expect(snapshot.conversation_preview).toBe('User: 测试1：请继续检查悬停提示和窗口宽度。')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('overwrites malformed previous PowerShell snapshots instead of failing hooks', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      await mkdir(join(root, 'sessions'), { recursive: true })
      await writeFile(
        join(root, 'sessions', 'ps-malformed-previous.json'),
        '{"session_id":"ps-malformed-previous","display_name":"broken","conversation_preview":"User: "quoted"}',
        'utf8',
      )

      await runPowerShellScript(
        'hooks/windows/agent-desktop-companion-hook.ps1',
        JSON.stringify({
          session_id: 'ps-malformed-previous',
          hook_event_name: 'Notification',
          notification_type: 'idle_prompt',
          cwd: 'C:/Users/ASUS',
        }),
        { AGENT_DESKTOP_COMPANION_HOME: root },
      )

      const snapshot = await readSnapshot(root, 'ps-malformed-previous')
      expect(snapshot.status).toBe('waiting_input')
      expect(snapshot.display_name).toBeNull()
      expect(snapshot.project_name).toBe('ASUS')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('overwrites malformed previous Node snapshots instead of failing hooks', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      await mkdir(join(root, 'sessions'), { recursive: true })
      await writeFile(
        join(root, 'sessions', 'node-malformed-previous.json'),
        '{"session_id":"node-malformed-previous","display_name":',
        'utf8',
      )

      await runNodeScript(
        'hooks/node/agent-desktop-companion-hook.js',
        JSON.stringify({
          session_id: 'node-malformed-previous',
          hook_event_name: 'Notification',
          notification_type: 'idle_prompt',
          cwd: 'C:/Users/ASUS',
        }),
        { AGENT_DESKTOP_COMPANION_HOME: root },
      )

      const snapshot = await readSnapshot(root, 'node-malformed-previous')
      expect(snapshot.status).toBe('waiting_input')
      expect(snapshot.display_name).toBeNull()
      expect(snapshot.project_name).toBe('ASUS')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('ignores malformed previous PowerShell snapshots in statusline updates', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      await mkdir(join(root, 'sessions'), { recursive: true })
      await writeFile(
        join(root, 'sessions', 'ps-statusline-malformed.json'),
        '{"session_id":"ps-statusline-malformed","status":"waiting_input","display_name":',
        'utf8',
      )

      await runPowerShellScript(
        'hooks/windows/agent-desktop-companion-statusline.ps1',
        JSON.stringify({
          session_id: 'ps-statusline-malformed',
          workspace: { current_dir: 'C:/Users/ASUS' },
        }),
        { AGENT_DESKTOP_COMPANION_HOME: root },
      )

      const snapshot = await readSnapshot(root, 'ps-statusline-malformed')
      expect(snapshot.status).toBe('idle')
      expect(snapshot.project_name).toBe('ASUS')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('ignores malformed previous Node snapshots in statusline updates', async () => {
    const root = await tempRoot('agent-desktop-companion-hook-writers')
    try {
      await mkdir(join(root, 'sessions'), { recursive: true })
      await writeFile(
        join(root, 'sessions', 'node-statusline-malformed.json'),
        '{"session_id":"node-statusline-malformed","status":"waiting_input","display_name":',
        'utf8',
      )

      await runNodeScript(
        'hooks/node/agent-desktop-companion-statusline.js',
        JSON.stringify({
          session_id: 'node-statusline-malformed',
          workspace: { current_dir: 'C:/Users/ASUS' },
        }),
        { AGENT_DESKTOP_COMPANION_HOME: root },
      )

      const snapshot = await readSnapshot(root, 'node-statusline-malformed')
      expect(snapshot.status).toBe('idle')
      expect(snapshot.project_name).toBe('ASUS')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)
})
