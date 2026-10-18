import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const ROOT = new URL('../public/assets/arena/leagues/', import.meta.url);

test('league icons are 32x32 RGBA images that match their provenance', () => {
  const provenance = JSON.parse(readFileSync(new URL('provenance.json', ROOT), 'utf8'));
  assert.deepEqual(provenance.icons.map(icon => icon.file), ['script-kiddie.png', 'skaner.png', 'exploit.png', 'root.png', 'zero-day.png']);
  for (const icon of provenance.icons) {
    const file = readFileSync(new URL(icon.file, ROOT));
    assert.equal(createHash('sha256').update(file).digest('hex'), icon.sha256, icon.file);
    assert.deepEqual([file.readUInt32BE(16), file.readUInt32BE(20), file[24], file[25]], [32, 32, 8, 6], icon.file);
  }
});
