import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DEFAULT_DELAY_MS = 2_500

export function smokeSessionFilePath(root, sessionId) {
  return join(root, 'sessions', `${sessionId}.json`)
}

export function createSessionSnapshot({
  sessionId,
  status,
  updatedAt = new Date().toISOString(),
  projectName = 'Claude Sprout Smoke',
  cwd = process.cwd(),
}) {
  return {
    session_id: sessionId,
    project_name: projectName,
    cwd,
    status,
    last_event: eventForStatus(status),
    notification_type: notificationTypeForStatus(status),
    last_tool: status === 'tool_running' ? 'SmokeTool' : null,
    context_used_percentage: 12,
    last_heartbeat_at: updatedAt,
    updated_at: updatedAt,
    ended_at: ['done', 'error', 'closed'].includes(status) ? updatedAt : null,
    end_reason: status === 'done' ? 'smoke_complete' : null,
    source: 'claude-sprout-smoke',
  }
}

export async function writeSessionSnapshot(root, snapshot) {
  await mkdir(join(root, 'sessions'), { recursive: true })
  await writeFile(smokeSessionFilePath(root, snapshot.session_id), `${JSON.stringify(snapshot, null, 2)}\n`)
}

export async function writeSmokeSettings(root, doNotDisturb) {
  await mkdir(root, { recursive: true })
  await writeFile(
    join(root, 'settings.json'),
    `${JSON.stringify(
      {
        doNotDisturb,
        petAlwaysOnTop: true,
        petLockPosition: false,
        petScale: 1,
        petSizePreset: 'medium',
        activePetId: null,
        petDisplayMode: 'minimal',
        petCompletionToastSeconds: 5,
        petActivityVisibleCount: 3,
        petConversationPreviewEnabled: false,
      },
      null,
      2,
    )}\n`,
  )
}

function eventForStatus(status) {
  return (
    {
      waiting_permission: 'PreToolUse',
      waiting_input: 'UserPromptSubmit',
      done: 'Stop',
      error: 'Error',
    }[status] ?? 'StatusLine'
  )
}

function notificationTypeForStatus(status) {
  return (
    {
      waiting_permission: 'permission_prompt',
      waiting_input: 'waiting_input',
      done: 'done',
      error: 'error',
    }[status] ?? null
  )
}

function parseArgs(argv) {
  const options = {
    delayMs: DEFAULT_DELAY_MS,
    launch: true,
    keepRunning: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--home') {
      options.home = resolve(argv[++index])
    } else if (arg === '--exe') {
      options.exe = resolve(argv[++index])
    } else if (arg === '--delay-ms') {
      options.delayMs = Number(argv[++index])
    } else if (arg === '--skip-launch') {
      options.launch = false
    } else if (arg === '--keep-running') {
      options.keepRunning = true
    } else if (arg === '--help') {
      options.help = true
    }
  }

  return options
}

function usage() {
  console.log(`Usage: node scripts/session-smoke.mjs [options]

Options:
  --home <path>       CLAUDE_SPROUT_HOME root. Defaults to a temp smoke folder.
  --exe <path>        Release exe path. Defaults to src-tauri/target/release/claude-sprout.exe.
  --delay-ms <ms>     Delay between snapshot transitions. Defaults to ${DEFAULT_DELAY_MS}.
  --skip-launch       Only write controlled session/settings files.
  --keep-running      Leave the launched app running after writing snapshots.
`)
}

function wait(ms) {
  return new Promise((resolveWait) => {
    setTimeout(resolveWait, ms)
  })
}

async function writeTransition(root, sessionId, status) {
  const snapshot = createSessionSnapshot({
    sessionId,
    status,
    updatedAt: new Date().toISOString(),
  })
  await writeSessionSnapshot(root, snapshot)
  console.log(`Wrote ${sessionId} -> ${status}`)
}

async function runSmoke(options) {
  const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
  const smokeRoot = options.home ?? join(tmpdir(), `claude-sprout-smoke-${Date.now()}`)
  const exe = options.exe ?? join(repoRoot, 'src-tauri', 'target', 'release', 'claude-sprout.exe')

  await mkdir(join(smokeRoot, 'sessions'), { recursive: true })
  await writeSmokeSettings(smokeRoot, false)

  let appProcess = null
  if (options.launch) {
    if (!existsSync(exe)) {
      throw new Error(`Release exe not found at ${exe}. Run npm run release:exe first.`)
    }
    appProcess = spawn(exe, [], {
      cwd: repoRoot,
      env: { ...process.env, CLAUDE_SPROUT_HOME: smokeRoot },
      windowsHide: true,
      stdio: 'ignore',
    })
    console.log(`Launched ${exe}`)
    await wait(options.delayMs)
  }

  console.log(`Smoke data root: ${smokeRoot}`)
  await writeTransition(smokeRoot, 'smoke-notify', 'running')
  await wait(options.delayMs)
  await writeTransition(smokeRoot, 'smoke-notify', 'waiting_permission')
  await wait(options.delayMs)
  await writeTransition(smokeRoot, 'smoke-notify', 'done')
  await wait(options.delayMs)

  await writeSmokeSettings(smokeRoot, true)
  await writeTransition(smokeRoot, 'smoke-dnd', 'running')
  await wait(options.delayMs)
  await writeTransition(smokeRoot, 'smoke-dnd', 'waiting_input')
  await wait(options.delayMs)

  if (appProcess && !options.keepRunning) {
    appProcess.kill()
  }

  console.log('Session smoke sequence written. Native notification visibility still requires desktop observation.')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    usage()
    return
  }
  await runSmoke(options)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
