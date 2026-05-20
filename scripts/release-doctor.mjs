import { access, readFile, stat } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { createHash } from 'node:crypto'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const NSIS_DLL_SHA1 = '75197FEE3C6A814FE035788D1C34EAD39349B860'
const WIX_ZIP_SHA256 = '6ac824e1642d6f7277d0ed7ea09411a508f6116ba6fae0aa5f2c7daa2ff43d31'
const NSIS_REQUIRED_FILES = [
  'makensis.exe',
  'Bin/makensis.exe',
  'Stubs/lzma-x86-unicode',
  'Stubs/lzma_solid-x86-unicode',
  'Plugins/x86-unicode/additional/nsis_tauri_utils.dll',
  'Include/MUI2.nsh',
  'Include/FileFunc.nsh',
  'Include/x64.nsh',
  'Include/nsDialogs.nsh',
  'Include/WinMessages.nsh',
]

export const releaseToolConstants = {
  nsis: {
    version: '3.11',
    archiveUrl:
      'https://github.com/tauri-apps/binary-releases/releases/download/nsis-3.11/nsis-3.11.zip',
    archiveSha1: 'EF7FF767E5CBD9EDD22ADD3A32C9B8F4500BB10D',
    utilsDllUrl:
      'https://github.com/tauri-apps/nsis-tauri-utils/releases/download/nsis_tauri_utils-v0.5.3/nsis_tauri_utils.dll',
    utilsDllSha1: NSIS_DLL_SHA1,
  },
  wix: {
    cacheName: 'WixTools314',
    archiveUrl: 'https://github.com/wixtoolset/wix3/releases/download/wix3141rtm/wix314-binaries.zip',
    archiveSha256: WIX_ZIP_SHA256,
  },
}

export async function inspectReleaseTools({
  repoRoot = process.cwd(),
  envPath = process.env.PATH ?? '',
} = {}) {
  const nsisCacheRoot = join(repoRoot, 'src-tauri', 'target', '.tauri', 'NSIS')
  const wixCacheRoot = join(repoRoot, 'src-tauri', 'target', '.tauri', 'WixTools314')

  const [nsisFiles, wixTools, pathTools] = await Promise.all([
    Promise.all(
      NSIS_REQUIRED_FILES.map((name) =>
        inspectFile(join(nsisCacheRoot, name), name, {
          sha1: name.endsWith('nsis_tauri_utils.dll') ? NSIS_DLL_SHA1 : undefined,
        }),
      ),
    ),
    inspectWixTools(wixCacheRoot),
    inspectPathTools(envPath, ['makensis', 'candle', 'light', 'wix']),
  ])

  return {
    nsis: {
      cacheRoot: nsisCacheRoot,
      archiveUrl: releaseToolConstants.nsis.archiveUrl,
      archiveSha1: releaseToolConstants.nsis.archiveSha1,
      utilsDllUrl: releaseToolConstants.nsis.utilsDllUrl,
      requiredFiles: nsisFiles,
    },
    wix: {
      cacheRoot: wixCacheRoot,
      archiveUrl: releaseToolConstants.wix.archiveUrl,
      archiveSha256: WIX_ZIP_SHA256,
      requiredFiles: wixTools,
    },
    pathTools,
  }
}

async function inspectFile(path, name, hashes = {}) {
  try {
    const file = await stat(path)
    if (!file.isFile()) {
      return { name, path, status: 'not-file' }
    }

    const result = { name, path, status: 'present', size: file.size }
    if (hashes.sha1) {
      result.expectedSha1 = hashes.sha1
      result.sha1 = await hashFile(path, 'sha1')
      if (result.sha1.toUpperCase() !== hashes.sha1.toUpperCase()) {
        result.status = 'hash-mismatch'
      }
    }
    return result
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { name, path, status: 'missing' }
    }
    return { name, path, status: 'error', error: error.message }
  }
}

async function inspectWixTools(cacheRoot) {
  const names = ['candle.exe', 'light.exe']
  return Promise.all(names.map((name) => inspectFile(join(cacheRoot, name), name)))
}

async function inspectPathTools(envPath, names) {
  const directories = envPath.split(delimiter).filter(Boolean)
  const entries = await Promise.all(
    names.map(async (name) => [name, await findExecutableOnPath(name, directories)]),
  )
  return Object.fromEntries(entries)
}

async function findExecutableOnPath(name, directories) {
  const candidates = executableNames(name)
  const found = []
  for (const directory of directories) {
    for (const candidate of candidates) {
      const path = join(directory, candidate)
      try {
        await access(path, fsConstants.X_OK)
        found.push(path)
      } catch {
        // Continue searching all PATH entries.
      }
    }
  }
  return found
}

function executableNames(name) {
  if (process.platform !== 'win32') return [name]
  return name.endsWith('.exe') ? [name] : [name, `${name}.exe`, `${name}.cmd`, `${name}.bat`]
}

async function hashFile(path, algorithm) {
  const hash = createHash(algorithm)
  hash.update(await readFile(path))
  return hash.digest('hex').toUpperCase()
}

function statusIcon(status) {
  return status === 'present' ? 'OK' : 'WARN'
}

function printFileGroup(title, files) {
  console.log(`\n${title}`)
  for (const file of files) {
    const detail = file.status === 'hash-mismatch' ? ` sha1=${file.sha1}` : ''
    console.log(`  ${statusIcon(file.status)} ${file.name}: ${file.status}${detail}`)
    console.log(`      ${file.path}`)
  }
}

export function hasBlockingReleaseToolWarnings(report, target = 'nsis') {
  const requiredFiles =
    {
      nsis: report.nsis.requiredFiles,
      msi: report.wix.requiredFiles,
      all: [...report.nsis.requiredFiles, ...report.wix.requiredFiles],
    }[target] ?? report.nsis.requiredFiles

  return requiredFiles.some((file) => file.status !== 'present')
}

function parseArgs(argv) {
  const options = { target: 'nsis' }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--target') {
      options.target = argv[++index]
    } else if (arg === '--help') {
      options.help = true
    }
  }
  return options
}

function usage() {
  console.log(`Usage: node scripts/release-doctor.mjs [--target nsis|msi|all]

Checks the local Tauri installer tool cache under src-tauri/target/.tauri.
The default target is nsis because it is Claude Sprout's default installer path.`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    usage()
    return
  }

  const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
  const report = await inspectReleaseTools({ repoRoot })

  console.log('Claude Sprout release doctor')
  console.log(`NSIS cache: ${report.nsis.cacheRoot}`)
  console.log(`WiX cache: ${report.wix.cacheRoot}`)
  printFileGroup('NSIS local cache', report.nsis.requiredFiles)
  printFileGroup('WiX local cache', report.wix.requiredFiles)

  console.log('\nPATH tools')
  for (const [name, values] of Object.entries(report.pathTools)) {
    console.log(`  ${values.length > 0 ? 'OK' : 'WARN'} ${name}: ${values.length > 0 ? values.join('; ') : 'not found'}`)
  }

  console.log('\nDownload references')
  console.log(`  NSIS: ${report.nsis.archiveUrl}`)
  console.log(`  NSIS SHA1: ${report.nsis.archiveSha1}`)
  console.log(`  nsis_tauri_utils.dll: ${report.nsis.utilsDllUrl}`)
  console.log(`  nsis_tauri_utils.dll SHA1: ${releaseToolConstants.nsis.utilsDllSha1}`)
  console.log(`  WiX: ${report.wix.archiveUrl}`)
  console.log(`  WiX SHA256: ${report.wix.archiveSha256}`)

  if (hasBlockingReleaseToolWarnings(report, options.target)) {
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
