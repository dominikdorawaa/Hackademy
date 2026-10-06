import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { build } from 'esbuild'

let CTFCard
let Leaderboard
let outputDir

before(async () => {
  outputDir = await mkdtemp(join('node_modules', '.hackademy-client-test-'))
  const result = await build({
    entryPoints: ['src/components/CTFCard.jsx', 'src/components/Leaderboard.jsx'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outExtension: { '.js': '.mjs' },
    packages: 'external',
    outdir: outputDir,
    write: false,
  })
  const modules = await Promise.all(result.outputFiles.map(async ({ path, text }) => {
    await writeFile(path, text)
    return [path, await import(pathToFileURL(path).href)]
  }))
  CTFCard = modules.find(([path]) => path.endsWith('CTFCard.mjs'))[1].default
  Leaderboard = modules.find(([path]) => path.endsWith('Leaderboard.mjs'))[1].default
})

after(async () => {
  if (outputDir) await rm(outputDir, { recursive: true, force: true })
})

const render = (Component, props) => renderToStaticMarkup(
  createElement(MemoryRouter, null, createElement(Component, props)),
)

test('locked challenge shows the VPN prerequisite and cannot offer Start', () => {
  const html = render(CTFCard, {
    challenge: { id: 1, title: 'VPN room', difficulty: 'MEDIUM', locked: true, requiresVpn: true },
  })
  assert.match(html, /Ukończ &quot;Tutorial VPN&quot;, aby odblokować/)
  assert.match(html, /Zablokowane/)
  assert.doesNotMatch(html, />Start</)
})

test('available challenge shows its difficulty and Start action', () => {
  const html = render(CTFCard, {
    challenge: { id: 2, title: 'Web room', difficulty: 'HARD', locked: false },
  })
  assert.match(html, /Trudny/)
  assert.match(html, />Start</)
  assert.doesNotMatch(html, /Zablokowane/)
})

test('leaderboard shows an empty state when there are no players', () => {
  const html = render(Leaderboard, { players: [], showTitle: false })
  assert.match(html, /Brak graczy w rankingu/)
})

test('leaderboard marks the current user and links to their profile', () => {
  const html = render(Leaderboard, {
    players: [{ username: 'Ada', points: 1250 }],
    currentUsername: 'Ada',
    showTitle: false,
  })
  assert.match(html, /highlight-me/)
  assert.match(html, /href="\/profile"/)
  assert.match(html, /<span>1[\s,.]?250<\/span>/)
})
