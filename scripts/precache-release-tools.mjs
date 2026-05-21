import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { copyFile, cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import { get } from 'node:https'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { pipeline } from 'node:stream/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { releaseToolConstants } from './release-doctor.mjs'

const execFileAsync = promisify(execFile)

export const releaseToolTargetNames = ['nsis', 'wix']

export function resolveReleaseToolTargets({ target = 'all' } = {}) {
  if (target === 'all') return [...releaseToolTargetNames]
  if (target === 'msi') return ['wix']
  if (releaseToolTargetNames.includes(target)) return [target]
  throw new Error(`Unsupported target "${target}". Expected nsis, wix, msi, or all.`)
}

export function buildPrecachePlan({ repoRoot = process.cwd(), targets = releaseToolTargetNames } = {}) {
  const toolRoot = join(repoRoot, 'src-tauri', 'target', '.tauri')
  const nsisRoot = join(toolRoot, 'NSIS')
  const wixRoot = join(toolRoot, releaseToolConstants.wix.cacheName)
  const plan = []

  if (targets.includes('nsis')) {
    plan.push({
      name: 'nsis',
      type: 'zip',
      url: releaseToolConstants.nsis.archiveUrl,
      archiveSha1: releaseToolConstants.nsis.archiveSha1,
      cacheRoot: nsisRoot,
      downloadName: 'nsis.zip',
    })
    plan.push({
      name: 'nsis-tauri-utils',
      type: 'file',
      url: releaseToolConstants.nsis.utilsDllUrl,
      fileSha1: releaseToolConstants.nsis.utilsDllSha1,
      destination: join(nsisRoot, 'Plugins', 'x86-unicode', 'additional', 'nsis_tauri_utils.dll'),
      downloadName: 'nsis_tauri_utils.dll',
    })
  }

  if (targets.includes('wix')) {
    plan.push({
      name: 'wix',
      type: 'zip',
      url: releaseToolConstants.wix.archiveUrl,
      archiveSha256: releaseToolConstants.wix.archiveSha256,
      cacheRoot: wixRoot,
      downloadName: 'wix314-binaries.zip',
    })
  }

  return plan
}

async function downloadFile(url, destination) {
  await mkdir(dirname(destination), { recursive: true })
  await pipeline(await openDownload(url), createWriteStream(destination))
}

function openDownload(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = get(
      url,
      {
        headers: {
          'User-Agent': 'claude-sprout-release-tool-precache',
        },
      },
      (response) => {
        const status = response.statusCode ?? 0
        if ([301, 302, 303, 307, 308].includes(status)) {
          response.resume()
          if (!response.headers.location) {
            reject(new Error(`Redirect from ${url} did not include a Location header.`))
            return
          }
          if (redirects >= 5) {
            reject(new Error(`Too many redirects while downloading ${url}.`))
            return
          }
          resolve(openDownload(new URL(response.headers.location, url).toString(), redirects + 1))
          return
        }

        if (status < 200 || status >= 300) {
          response.resume()
          reject(new Error(`Download failed for ${url}: HTTP ${status}`))
          return
        }

        resolve(response)
      },
    )
    request.on('error', reject)
  })
}

async function verifyDownloadedFile(path, entry) {
  if (entry.archiveSha1 || entry.fileSha1) {
    const expected = entry.archiveSha1 ?? entry.fileSha1
    const actual = await hashFile(path, 'sha1')
    if (actual !== expected.toUpperCase()) {
      throw new Error(`${entry.name} SHA1 mismatch: expected ${expected}, got ${actual}`)
    }
  }
  if (entry.archiveSha256) {
    const actual = await hashFile(path, 'sha256')
    if (actual !== entry.archiveSha256.toUpperCase()) {
      throw new Error(`${entry.name} SHA256 mismatch: expected ${entry.archiveSha256}, got ${actual}`)
    }
  }
}

async function hashFile(path, algorithm) {
  const hash = createHash(algorithm)
  hash.update(await readFile(path))
  return hash.digest('hex').toUpperCase()
}

async function extractZip(archivePath, destination) {
  const extractRoot = join(tmpdir(), `claude-sprout-release-tools-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  await rm(extractRoot, { recursive: true, force: true })
  await mkdir(extractRoot, { recursive: true })
  try {
    await extractZipWithTar(archivePath, extractRoot)
  } catch {
    await extractZipWithPowerShell(archivePath, extractRoot)
  }

  const payloadRoot = await findPayloadRoot(extractRoot)
  await rm(destination, { recursive: true, force: true })
  await mkdir(destination, { recursive: true })
  await cp(payloadRoot, destination, { recursive: true, force: true })
  await rm(extractRoot, { recursive: true, force: true })
}

async function extractZipWithTar(archivePath, destination) {
  await execFileAsync('tar.exe', ['-xf', archivePath, '-C', destination], { windowsHide: true })
}

async function extractZipWithPowerShell(archivePath, destination) {
  await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      'Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force',
      archivePath,
      destination,
    ],
    { windowsHide: true },
  )
}

async function findPayloadRoot(extractRoot) {
  const entries = await readdir(extractRoot)
  if (entries.length !== 1) return extractRoot

  const onlyEntry = join(extractRoot, entries[0])
  const info = await stat(onlyEntry)
  return info.isDirectory() ? onlyEntry : extractRoot
}

async function applyPlanEntry(entry, downloadRoot) {
  const downloadPath = join(downloadRoot, entry.downloadName)
  console.log(`Downloading ${entry.name}`)
  console.log(`  ${entry.url}`)
  await downloadFile(entry.url, downloadPath)
  await verifyDownloadedFile(downloadPath, entry)

  if (entry.type === 'zip') {
    console.log(`  extracting to ${entry.cacheRoot}`)
    await extractZip(downloadPath, entry.cacheRoot)
  } else {
    console.log(`  copying to ${entry.destination}`)
    await mkdir(dirname(entry.destination), { recursive: true })
    await copyFile(downloadPath, entry.destination)
  }
}

function parseArgs(argv) {
  const options = { target: 'all' }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--target') {
      options.target = argv[++index]
    } else if (arg === '--download-dir') {
      options.downloadDir = argv[++index]
    } else if (arg === '--help') {
      options.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return options
}

function usage() {
  console.log(`Usage: node scripts/precache-release-tools.mjs [--target nsis|wix|msi|all] [--download-dir path]

Downloads Tauri Windows installer tools with Node's HTTPS stack, verifies hashes,
then writes the local Tauri tool cache under src-tauri/target/.tauri.
Use this when the normal Tauri/PowerShell download path fails in a Windows
SChannel-restricted environment.`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    usage()
    return
  }

  const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
  const targets = resolveReleaseToolTargets(options)
  const plan = buildPrecachePlan({ repoRoot, targets })
  const downloadRoot = options.downloadDir ?? join(repoRoot, 'src-tauri', 'target', '.tauri', 'downloads')
  await mkdir(downloadRoot, { recursive: true })

  for (const entry of plan) {
    await applyPlanEntry(entry, downloadRoot)
  }

  console.log('Release tool pre-cache complete. Run npm run release:doctor -- --target all to verify.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
