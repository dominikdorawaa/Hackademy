import assert from 'node:assert/strict'
import { test } from 'node:test'
import { IMMUTABLE, isMissingAsset, onRequest } from '../functions/static/[[path]].js'

function assets(response) {
  const requests = []
  return {
    requests,
    env: {
      ASSETS: {
        fetch: async (request) => {
          requests.push(request)
          return response
        },
      },
    },
  }
}

const request = new Request('https://hackademy.app/static/SettingsPage-BcpDi7tS.js')

test('serves an existing build file with a long immutable cache', async () => {
  const { env, requests } = assets(
    new Response('export default 1', {
      headers: { 'Content-Type': 'application/javascript', ETag: '"abc"', 'Cache-Control': 'public, max-age=0, must-revalidate' },
    }),
  )
  const response = await onRequest({ request, env })
  assert.equal(requests[0], request)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), IMMUTABLE)
  assert.equal(response.headers.get('content-type'), 'application/javascript')
  assert.equal(response.headers.get('etag'), '"abc"')
  assert.equal(await response.text(), 'export default 1')
})

test('answers 404 without the app page when the SPA fallback returns index.html', async () => {
  const { env } = assets(
    new Response('<!doctype html><div id="root"></div>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': IMMUTABLE },
    }),
  )
  const response = await onRequest({ request, env })
  assert.equal(response.status, 404)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8')
  assert.doesNotMatch(await response.text(), /<html|root/i)
})

test('answers 404 with no-store when the asset server reports a missing file', async () => {
  const { env } = assets(new Response('missing', { status: 404, headers: { 'Cache-Control': IMMUTABLE } }))
  const response = await onRequest({ request, env })
  assert.equal(response.status, 404)
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('passes other responses through unchanged', async () => {
  const notModified = new Response(null, { status: 304, headers: { ETag: '"abc"' } })
  const { env } = assets(notModified)
  assert.equal(await onRequest({ request, env }), notModified)
})

test('treats only HTML success responses and 404 as missing files', () => {
  assert.equal(isMissingAsset(new Response('', { headers: { 'Content-Type': 'text/css' } })), false)
  assert.equal(isMissingAsset(new Response('')), false)
  assert.equal(isMissingAsset(new Response('', { status: 500, headers: { 'Content-Type': 'text/html' } })), false)
  assert.equal(isMissingAsset(new Response('', { headers: { 'Content-Type': 'text/html' } })), true)
})
