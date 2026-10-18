import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const ROOT = new URL('../public/assets/arena/emotes/', import.meta.url);

test('quick chat emotes match their provenance and frame layout', () => {
  const provenance = JSON.parse(readFileSync(new URL('provenance.json', ROOT), 'utf8'));
  const source = readFileSync(new URL('../src/components/arena/battle/quickChat.ts', import.meta.url), 'utf8');
  assert.deepEqual(provenance.emotes.map(emote => emote.file), ['ez.png', 'gg.png', 'laugh.png', 'shock.png']);
  for (const emote of provenance.emotes) {
    const file = readFileSync(new URL(emote.file, ROOT));
    assert.equal(createHash('sha256').update(file).digest('hex'), emote.sha256, emote.file);
    assert.deepEqual([file.readUInt32BE(16), file.readUInt32BE(20), file[24], file[25]], [emote.frameWidth * emote.frames, emote.frameHeight, 8, 6], emote.file);
    assert.equal(emote.animation.endpoint, 'animate-with-text-v3');
    assert.ok(source.includes(`src: \`\${EMOTES}${emote.file}\`, frames: ${emote.frames}, width: ${emote.frameWidth}, height: ${emote.frameHeight}`), `${emote.file} is registered with its real size`);
  }
});
