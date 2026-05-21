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
    const root = await tempRoot('claude-sprout-hook-writers')
    try {
      const env = { CLAUDE_SPROUT_HOME: root }
      await runPowerShellScript(
        'hooks/windows/claude-sprout-hook.ps1',
        JSON.stringify({
          session_id: 'ps-session',
          hook_event_name: 'Stop',
          cwd: 'E:/Codex Project/claude-sprout',
          reason: 'complete',
        }),
        env,
      )
      await runPowerShellScript(
        'hooks/windows/claude-sprout-statusline.ps1',
        JSON.stringify({
          session_id: 'ps-session',
          workspace: { current_dir: 'E:/Codex Project/claude-sprout' },
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

  it('handles UTF-8 Claude payloads with CJK assistant text in PowerShell hooks', async () => {
    const root = await tempRoot('claude-sprout-hook-writers')
    try {
      const env = { CLAUDE_SPROUT_HOME: root }
      await runPowerShellScript(
        'hooks/windows/claude-sprout-hook.ps1',
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
    const root = await tempRoot('claude-sprout-hook-writers')
    try {
      const env = { CLAUDE_SPROUT_HOME: root }
      await runNodeScript(
        'hooks/node/claude-sprout-hook.js',
        JSON.stringify({
          session_id: 'node-session',
          hook_event_name: 'Stop',
          cwd: 'E:/Codex Project/claude-sprout',
          reason: 'complete',
        }),
        env,
      )
      await runNodeScript(
        'hooks/node/claude-sprout-statusline.js',
        JSON.stringify({
          session_id: 'node-session',
          workspace: { current_dir: 'E:/Codex Project/claude-sprout' },
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

  it('captures and preserves safe display names from Node hook payloads', async () => {
    const root = await tempRoot('claude-sprout-hook-writers')
    try {
      const env = { CLAUDE_SPROUT_HOME: root }
      await runNodeScript(
        'hooks/node/claude-sprout-statusline.js',
        JSON.stringify({
          session_id: 'node-named-session',
          session_title: 'Renamed release follow-up',
          workspace: { current_dir: 'E:/Codex Project/claude-sprout' },
        }),
        env,
      )
      await runNodeScript(
        'hooks/node/claude-sprout-hook.js',
        JSON.stringify({
          session_id: 'node-named-session',
          hook_event_name: 'PreToolUse',
          cwd: 'E:/Codex Project/claude-sprout',
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
    const root = await tempRoot('claude-sprout-hook-writers')
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
        'hooks/node/claude-sprout-statusline.js',
        JSON.stringify({
          session_id: 'node-summary-session',
          transcript_path: transcriptPath,
          workspace: { current_dir: 'E:/Codex Project/claude-sprout' },
        }),
        { CLAUDE_SPROUT_HOME: root },
      )

      const snapshot = await readSnapshot(root, 'node-summary-session')
      expect(snapshot.display_name).toBe('Renamed from slash command')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  it('captures and preserves safe display names from PowerShell hook payloads', async () => {
    const root = await tempRoot('claude-sprout-hook-writers')
    try {
      const env = { CLAUDE_SPROUT_HOME: root }
      await runPowerShellScript(
        'hooks/windows/claude-sprout-statusline.ps1',
        JSON.stringify({
          session_id: 'ps-named-session',
          session_title: 'Renamed Windows follow-up',
          workspace: { current_dir: 'E:/Codex Project/claude-sprout' },
        }),
        env,
      )
      await runPowerShellScript(
        'hooks/windows/claude-sprout-hook.ps1',
        JSON.stringify({
          session_id: 'ps-named-session',
          hook_event_name: 'PreToolUse',
          cwd: 'E:/Codex Project/claude-sprout',
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
    const root = await tempRoot('claude-sprout-hook-writers')
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
        'hooks/windows/claude-sprout-statusline.ps1',
        JSON.stringify({
          session_id: 'ps-summary-session',
          transcript_path: transcriptPath,
          workspace: { current_dir: 'E:/Codex Project/claude-sprout' },
        }),
        { CLAUDE_SPROUT_HOME: root },
      )

      const snapshot = await readSnapshot(root, 'ps-summary-session')
      expect(snapshot.display_name).toBe('Renamed PowerShell session')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)
})
