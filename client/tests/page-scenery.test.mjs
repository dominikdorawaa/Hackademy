import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const directory = new URL('../public/assets/scenery/', import.meta.url);
const scenes = ['home', 'dashboard', 'learn', 'path', 'ctf', 'ukos', 'arena', 'battle', 'avatar', 'ranking', 'profile', 'friends', 'settings', 'auth', 'onboarding', 'legal', 'notfound', 'admin'];

test('ships verified lossless backgrounds for every section and theme within the generation limit', () => {
  const provenance = JSON.parse(readFileSync(new URL('provenance.json', directory), 'utf8'));
  assert.equal(provenance.provider, 'PixelLab');
  assert.equal(provenance.generationLimit, 150);
  assert.ok(provenance.generationsUsed <= 150);
  assert.equal(provenance.selectedImages, scenes.length * 2);
  assert.equal(provenance.images.length, scenes.length * 2);
  assert.equal(new Set(provenance.images.map(asset => asset.file)).size, scenes.length * 2);
  let totalBytes = 0;
  for (const scene of scenes) for (const theme of ['dark', 'light']) {
    const asset = provenance.images.find(image => image.scene === scene && image.theme === theme);
    assert.ok(asset, `${scene}-${theme}`);
    const bytes = readFileSync(new URL(`${scene}-${theme}.webp`, directory));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.equal(bytes.toString('ascii', 12, 16), 'VP8L');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.equal(bytes.length, asset.bytes);
    assert.equal(asset.width / asset.height, 2);
    assert.ok(asset.prompt.length > 100);
    totalBytes += bytes.length;
  }
  assert.ok(totalBytes < 1_500_000);
  assert.ok(provenance.generationsUsed >= provenance.images.reduce((sum, image) => sum + image.usage.generations, 0));
});
