import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { build } from 'esbuild'

let Leaderboard
let outputDir

before(async () => {
  outputDir = await mkdtemp(join('node_modules', '.hackademy-client-test-'))
  const result = await build({
    entryPoints: ['src/components/Leaderboard.tsx'],
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
  Leaderboard = modules.find(([path]) => path.endsWith('Leaderboard.mjs'))[1].default
})

after(async () => {
  if (outputDir) await rm(outputDir, { recursive: true, force: true })
})

const render = (Component, props) => renderToStaticMarkup(
  createElement(MemoryRouter, null, createElement(Component, props)),
)

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
  assert.match(html, /<small>XP<\/small>/)
})
