export const IMMUTABLE = 'public, max-age=31536000, immutable'

export function isMissingAsset(response) {
  if (response.status === 404) return true
  const type = response.headers.get('content-type') ?? ''
  return response.ok && type.startsWith('text/html')
}

export function notFound() {
  return new Response('Not found\n', {
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function onRequest({ request, env }) {
  const response = await env.ASSETS.fetch(request)
  if (isMissingAsset(response)) return notFound()
  if (!response.ok) return response
  const cached = new Response(response.body, response)
  cached.headers.set('Cache-Control', IMMUTABLE)
  return cached
}
