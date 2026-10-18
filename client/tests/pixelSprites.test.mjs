import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const ROOT = new URL('../public/assets/pixel/', import.meta.url);

test('pixel sprite sheets match their provenance and frame layout', () => {
  const provenance = JSON.parse(readFileSync(new URL('provenance.json', ROOT), 'utf8'));
  const source = readFileSync(new URL('../src/components/PixelSprite.tsx', import.meta.url), 'utf8');
  assert.equal(provenance.sprites.length, 6);
  for (const sprite of provenance.sprites) {
    const file = readFileSync(new URL(sprite.file, ROOT));
    assert.equal(createHash('sha256').update(file).digest('hex'), sprite.sha256, sprite.file);
    assert.deepEqual([file.readUInt32BE(16), file.readUInt32BE(20), file[24], file[25]], [sprite.frameWidth * sprite.frames, sprite.frameHeight, 8, 6], sprite.file);
    assert.ok(source.includes(`src: '/assets/pixel/${sprite.file}', frames: ${sprite.frames}, width: ${sprite.frameWidth}, height: ${sprite.frameHeight}`), `${sprite.file} is registered with its real size`);
  }
});
