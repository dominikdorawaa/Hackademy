import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import viteConfig from '../vite.config.js'

test('Cloudflare Pages serves the SPA for every route', async () => {
  const rules = (await readFile('public/_redirects', 'utf8')).trim().split('\n')
  assert.deepEqual(rules, ['/* /index.html 200'])
})

test('only hashed build files get a long immutable cache', async () => {
  const headers = (await readFile('public/_headers', 'utf8')).replace(/\r\n/g, '\n')
  assert.equal(headers, '/static/*\n  Cache-Control: public, max-age=31536000, immutable\n')
  assert.equal(viteConfig.build.assetsDir, 'static')
})

test('public files never share the hashed build directory', async () => {
  await assert.rejects(readFile('public/static'), { code: 'ENOENT' })
})
