import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const ROOT = new URL('../public/assets/mascot/', import.meta.url);

test('the penguin mascot sheets match their provenance and frame layout', () => {
  const provenance = JSON.parse(readFileSync(new URL('provenance.json', ROOT), 'utf8'));
  const source = readFileSync(new URL('../src/components/mascot/Mascot.tsx', import.meta.url), 'utf8');
  assert.equal(provenance.base.endpoint, 'create-image-pixflux');
  assert.deepEqual(provenance.sprites.map(sprite => sprite.file), ['penguin-idle.png', 'penguin-talk.png', 'penguin-wave.png', 'penguin-walk-front.png', 'penguin-walk-side.png', 'penguin-walk-back.png', 'penguin-calm.png', 'penguin-dance-groove.png', 'penguin-dance-sixseven.png', 'penguin-dance-scuba.png']);
  for (const sprite of provenance.sprites) {
    const file = readFileSync(new URL(sprite.file, ROOT));
    assert.equal(createHash('sha256').update(file).digest('hex'), sprite.sha256, sprite.file);
    assert.deepEqual([file.readUInt32BE(16), file.readUInt32BE(20), file[24], file[25]], [sprite.frameWidth * sprite.frames, sprite.frameHeight, 8, 6], sprite.file);
    assert.equal(sprite.animation.endpoint, 'animate-with-text-v3');
    assert.ok(source.includes(`width: ${sprite.frameWidth}, height: ${sprite.frameHeight}`) && (sprite.frames === 8 || source.includes(`sheet('${sprite.file.slice(8, -4)}', ${sprite.frames})`)), `${sprite.file} is registered with its real size`);
  }
});
