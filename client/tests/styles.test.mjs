import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'vite'

test('production CSS includes Preflight, layout utilities and the Hackademy shadcn theme', async () => {
  const bundle = await build({
    logLevel: 'silent',
    build: { write: false, minify: false, cssMinify: false },
  })
  const css = bundle.output
    .filter(asset => asset.type === 'asset' && asset.fileName.endsWith('.css'))
    .map(asset => asset.source)
    .join('\n')

  assert.match(css, /box-sizing:\s*border-box/)
  assert.match(css, /h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{[^}]*font-size:\s*inherit/)
  assert.match(css, /\.flex\s*\{\s*display:\s*flex/)
  assert.match(css, /\.min-h-screen\s*\{\s*min-height:\s*100vh/)
  assert.match(css, /\.px-4\s*\{[^}]*padding-inline:/)
  assert.match(css, /\.bg-primary\s*\{[^}]*background-color:\s*var\(--primary\)/)
  assert.match(css, /--primary:\s*var\(--primary-blue\)/)
  assert.match(css, /--card:\s*var\(--bg-panel\)/)
  assert.match(css, /--muted-foreground:\s*var\(--text-gray\)/)
  assert.match(css, /\[data-theme=["']?light["']?\]/)
  assert.match(css, /\.dark\\:bg-input\\\/30:where\(\[data-theme=["']dark["']\],\s*\[data-theme=["']dark["']\]\s*\*\)\s*\{[^}]*background-color:\s*var\(--input\)/)
  assert.doesNotMatch(css, /prefers-color-scheme:\s*dark/)
  assert.doesNotMatch(css, /@tailwind\s+(base|components|utilities)/)
})
