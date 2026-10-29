import { constants } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const LIMITS = { deploys: 2, ms: 7 * 24 * 60 * 60 * 1000, files: 15000 }

const SAFE_PATH = /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)*$/

export function isSafePath(name) {
  return typeof name === 'string' && SAFE_PATH.test(name) && !name.split('/').some((part) => part === '.' || part === '..')
}

export async function listFiles(root, prefix = '') {
  let entries
  try {
    entries = await readdir(path.join(root, prefix), { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const files = []
  for (const entry of entries) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...(await listFiles(root, name)))
    else if (entry.isFile()) files.push(name)
  }
  return files.sort()
}

export function parseManifest(text) {
  const data = JSON.parse(text)
  if (!Number.isInteger(data?.deploy) || data.deploy < 0 || typeof data.files !== 'object' || data.files === null) {
    throw new Error('unexpected manifest format')
  }
  const files = new Map()
  for (const [name, entry] of Object.entries(data.files)) {
    if (isSafePath(name) && Number.isInteger(entry?.deploy) && Number.isFinite(entry?.liveAt)) {
      files.set(name, { deploy: entry.deploy, liveAt: entry.liveAt })
    }
  }
  return { deploy: data.deploy, files }
}

export function plan(previous, current, now, limits = LIMITS) {
  const deploy = previous.deploy + 1
  const files = new Map(current.map((name) => [name, { deploy, liveAt: now }]))
  const keep = [...previous.files]
    .filter(([name, entry]) => !files.has(name) && (deploy - entry.deploy <= limits.deploys || now - entry.liveAt <= limits.ms))
    .sort(([, a], [, b]) => b.liveAt - a.liveAt || b.deploy - a.deploy)
    .slice(0, Math.max(0, limits.files - current.length))
  for (const [name, entry] of keep) files.set(name, entry)
  return { deploy, keep: keep.map(([name]) => name).sort(), files }
}

async function copyInto(from, to, name, mode) {
  await mkdir(path.dirname(path.join(to, name)), { recursive: true })
  await copyFile(path.join(from, name), path.join(to, name), mode)
}

export async function retainStatic({ dist, cache, now = Date.now(), limits = LIMITS, log = console.log }) {
  const staticDir = path.join(dist, 'static')
  const cachedDir = path.join(cache, 'files')
  const manifestPath = path.join(cache, 'manifest.json')
  const current = await listFiles(staticDir)
  if (!current.length) throw new Error(`no build files in ${staticDir}`)
  let previous = { deploy: 0, files: new Map() }
  try {
    previous = parseManifest(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    log(error.code === 'ENOENT' ? 'No static files from previous deploys' : `Ignoring static files from previous deploys: ${error.message}`)
  }
  const cached = new Set(await listFiles(cachedDir))
  for (const name of previous.files.keys()) if (!cached.has(name)) previous.files.delete(name)
  const result = plan(previous, current, now, limits)
  for (const name of result.keep) await copyInto(cachedDir, staticDir, name, constants.COPYFILE_EXCL)
  await rm(cachedDir, { recursive: true, force: true })
  for (const name of result.files.keys()) await copyInto(staticDir, cachedDir, name)
  await writeFile(manifestPath, `${JSON.stringify({ deploy: result.deploy, files: Object.fromEntries(result.files) })}\n`)
  log(`Deploy ${result.deploy}: ${current.length} new build files, ${result.keep.length} kept from previous deploys`)
  return result
}

export async function main(argv = process.argv.slice(2), log = console.log) {
  if (argv.length !== 2) throw new Error('Usage: node build/retainStatic.mjs <dist> <cache>')
  return retainStatic({ dist: argv[0], cache: argv[1], log })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
