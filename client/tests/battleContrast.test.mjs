import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../src/pages/ArenaBattlePage.css', import.meta.url), 'utf8');
const token = name => css.match(new RegExp(`--${name}:\s*([^;]+);`))[1].trim();
const channel = value => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const hex = value => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test('battle result headings stay readable on the glass panel in both themes', () => {
  const [, r, g, b, alpha] = token('battle-glass').match(/rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/).map(Number);
  const brightest = [r, g, b].map(c => c * alpha + 255 * (1 - alpha));
  for (const name of ['battle-ok', 'battle-bad']) {
    const value = token(name);
    assert.match(value, /^#[0-9a-f]{6}$/i, `${name} must not follow the page theme`);
    assert.ok(contrast(hex(value), brightest) >= 3, `${name} contrast ${contrast(hex(value), brightest).toFixed(2)}`);
  }
});
