import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { LIMITS, isSafePath, listFiles, main, parseManifest, plan, retainStatic } from '../build/retainStatic.mjs'

const DAY = 24 * 60 * 60 * 1000
let root
let dist
let cache
const logs = []
const log = (line) => logs.push(line)

async function put(dir, files) {
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true })
    await writeFile(path.join(dir, name), content)
  }
}

async function build(files) {
  await rm(dist, { recursive: true, force: true })
  await put(path.join(dist, 'static'), files)
}

const read = (dir, name) => readFile(path.join(dir, name), 'utf8')
const manifest = async () => JSON.parse(await read(cache, 'manifest.json'))

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'retain-static-'))
  dist = path.join(root, 'dist')
  cache = path.join(root, 'cache')
  logs.length = 0
})

afterEach(() => rm(root, { recursive: true, force: true }))

test('the first deploy only records its own files', async () => {
  await build({ 'index-a.js': 'a', 'ukos/v1/kernel.bin': 'k' })
  const result = await retainStatic({ dist, cache, now: 1000, log })
  assert.deepEqual(result.keep, [])
  assert.deepEqual(await listFiles(path.join(dist, 'static')), ['index-a.js', 'ukos/v1/kernel.bin'])
  assert.deepEqual(await manifest(), {
    deploy: 1,
    files: { 'index-a.js': { deploy: 1, liveAt: 1000 }, 'ukos/v1/kernel.bin': { deploy: 1, liveAt: 1000 } },
  })
  assert.equal(await read(path.join(cache, 'files'), 'ukos/v1/kernel.bin'), 'k')
  assert.deepEqual(logs, ['No static files from previous deploys', 'Deploy 1: 2 new build files, 0 kept from previous deploys'])
})

test('the next deploy keeps previous files without overwriting new ones', async () => {
  await build({ 'index-a.js': 'old a', 'shared-s.css': 'old s', 'ukos/v1/kernel.bin': 'k1' })
  await retainStatic({ dist, cache, now: 1000, log })
  await build({ 'index-b.js': 'b', 'shared-s.css': 'new s', 'ukos/v2/kernel.bin': 'k2' })
  const result = await retainStatic({ dist, cache, now: 2000, log })
  assert.deepEqual(result.keep, ['index-a.js', 'ukos/v1/kernel.bin'])
  const staticDir = path.join(dist, 'static')
  assert.deepEqual(await listFiles(staticDir), ['index-a.js', 'index-b.js', 'shared-s.css', 'ukos/v1/kernel.bin', 'ukos/v2/kernel.bin'])
  assert.equal(await read(staticDir, 'index-a.js'), 'old a')
  assert.equal(await read(staticDir, 'shared-s.css'), 'new s')
  const saved = await manifest()
  assert.equal(saved.deploy, 2)
  assert.deepEqual(saved.files['index-a.js'], { deploy: 1, liveAt: 1000 })
  assert.deepEqual(saved.files['shared-s.css'], { deploy: 2, liveAt: 2000 })
  assert.deepEqual(await listFiles(path.join(cache, 'files')), await listFiles(staticDir))
})

test('files expire after two more deploys and seven days', async () => {
  await build({ 'old.js': 'o' })
  await retainStatic({ dist, cache, now: 0, log })
  for (const [index, now] of [1, 2].map((n) => [n, n * 8 * DAY])) {
    await build({ [`next-${index}.js`]: 'n' })
    const result = await retainStatic({ dist, cache, now, log })
    assert.ok(result.keep.includes('old.js'))
  }
  await build({ 'next-3.js': 'n' })
  const result = await retainStatic({ dist, cache, now: 24 * DAY, log })
  assert.deepEqual(result.keep, ['next-1.js', 'next-2.js'])
  assert.deepEqual(await listFiles(path.join(cache, 'files')), ['next-1.js', 'next-2.js', 'next-3.js'])
})

test('a corrupt manifest or missing cached copy only drops the old files', async () => {
  await build({ 'index-b.js': 'b' })
  await put(cache, { 'manifest.json': '{not json' })
  const broken = await retainStatic({ dist, cache, now: 10, log })
  assert.deepEqual(broken.keep, [])
  assert.match(logs[0], /^Ignoring static files from previous deploys: /)

  await put(cache, { 'manifest.json': JSON.stringify({ deploy: 4, files: { 'gone.js': { deploy: 4, liveAt: 9 } } }) })
  const missing = await retainStatic({ dist, cache, now: 10, log })
  assert.equal(missing.deploy, 5)
  assert.deepEqual(missing.keep, [])
})

test('refuses to run without a build and through the command line without arguments', async () => {
  await assert.rejects(retainStatic({ dist, cache, log }), /no build files/)
  await assert.rejects(main([], log), /Usage/)
  await build({ 'index-a.js': 'a' })
  const result = await main([dist, cache], log)
  assert.equal(result.deploy, 1)
})

test('parseManifest rejects unexpected shapes and skips unsafe paths', () => {
  assert.throws(() => parseManifest('[]'), /unexpected manifest format/)
  assert.throws(() => parseManifest('{"deploy":-1,"files":{}}'), /unexpected manifest format/)
  assert.throws(() => parseManifest('{"deploy":1,"files":null}'), /unexpected manifest format/)
  const parsed = parseManifest(
    JSON.stringify({
      deploy: 3,
      files: {
        'ok.js': { deploy: 2, liveAt: 5 },
        '../escape.js': { deploy: 2, liveAt: 5 },
        'a/./b.js': { deploy: 2, liveAt: 5 },
        '/abs.js': { deploy: 2, liveAt: 5 },
        'bad-entry.js': { deploy: 'x', liveAt: 5 },
        'no-time.js': { deploy: 2 },
      },
    }),
  )
  assert.deepEqual([...parsed.files.keys()], ['ok.js'])
})

test('isSafePath accepts nested build paths only', () => {
  assert.equal(isSafePath('ukos/8f211f39effb2d99/v86.wasm'), true)
  assert.equal(isSafePath('..'), false)
  assert.equal(isSafePath('a//b'), false)
  assert.equal(isSafePath('a\\b'), false)
  assert.equal(isSafePath(7), false)
})

test('plan keeps the most recently live files within the file limit', () => {
  const previous = {
    deploy: 5,
    files: new Map([
      ['older.js', { deploy: 4, liveAt: 100 }],
      ['newer.js', { deploy: 5, liveAt: 200 }],
      ['same-time.js', { deploy: 4, liveAt: 200 }],
    ]),
  }
  const limits = { ...LIMITS, files: 3 }
  const result = plan(previous, ['current.js'], 300, limits)
  assert.equal(result.deploy, 6)
  assert.deepEqual(result.keep, ['newer.js', 'same-time.js'])
  assert.deepEqual(plan(previous, ['a.js', 'b.js', 'c.js', 'd.js'], 300, limits).keep, [])
})

test('listFiles returns an empty list for a missing directory and rethrows other errors', async () => {
  assert.deepEqual(await listFiles(path.join(root, 'missing')), [])
  await put(root, { 'file.txt': 'x' })
  await assert.rejects(listFiles(path.join(root, 'file.txt')), { code: 'ENOTDIR' })
})
