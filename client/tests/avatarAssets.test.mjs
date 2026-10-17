import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { inflateSync } from 'node:zlib';

const ROOT = new URL('../public/assets/arena/avatar-v1/', import.meta.url);
const read = path => readFileSync(new URL(path, ROOT));
const ATLASES = { baza: ['fighter.png', 'anchors.json'], bluza: ['hoodie/fighter.png', 'hoodie/anchors.json'], dres: ['track/fighter.png', 'track/anchors.json'] };
const RUN_ROW = 10;
const provenance = JSON.parse(read('provenance.json').toString());

function decode(file) {
  let offset = 8, width = 0, height = 0;
  const data = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset), type = file.toString('ascii', offset + 4, offset + 8), body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); assert.deepEqual([body[8], body[9]], [8, 6]); }
    if (type === 'IDAT') data.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data)), stride = width * 4, pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0, up = y ? pixels[(y - 1) * stride + x] : 0, corner = x >= 4 && y ? pixels[(y - 1) * stride + x - 4] : 0;
      const guess = left + up - corner;
      const paeth = Math.abs(guess - left) <= Math.abs(guess - up) && Math.abs(guess - left) <= Math.abs(guess - corner) ? left : Math.abs(guess - up) <= Math.abs(guess - corner) ? up : corner;
      pixels[y * stride + x] = (raw[y * (stride + 1) + 1 + x] + [0, left, up, (left + up) >> 1, paeth][filter]) & 255;
    }
  }
  return { width, height, pixels };
}

for (const [outfit, [atlasFile, anchorFile]] of Object.entries(ATLASES)) {
  test(`${outfit} running and Six-seven frames are whole, anchored and listed in provenance`, () => {
    const file = read(atlasFile), atlas = decode(file), anchors = JSON.parse(read(anchorFile).toString());
    assert.deepEqual([atlas.width, atlas.height], [576, 704]);
    for (let column = 1; column <= 8; column++) {
      const cell = RUN_ROW * 9 + column, top = RUN_ROW * 64, left = column * 64;
      assert.equal(anchors.cells[cell]?.angle, 0);
      let opaque = 0, edge = 0;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const alpha = atlas.pixels[((top + y) * 576 + left + x) * 4 + 3];
        assert.ok(alpha === 0 || alpha === 255, `partial alpha in cell ${cell}`);
        if (alpha) { opaque++; if (x === 0 || y === 0 || x === 63 || y === 63) edge++; }
      }
      assert.ok(opaque > 300, `cell ${cell} is empty`);
      assert.equal(edge, 0, `cell ${cell} touches its border`);
    }
    for (const cell of [...Array.from({ length: 8 }, (_, i) => 73 + i), ...Array.from({ length: 8 }, (_, i) => 82 + i)]) {
      const anchor = anchors.cells[cell], top = Math.floor(cell / 9) * 64, left = (cell % 9) * 64;
      assert.equal(anchor?.view, 'front', `cell ${cell} has no front head anchor`);
      assert.equal(atlas.pixels[((top + Math.round(anchor.y)) * 576 + left + Math.round(anchor.x)) * 4 + 3], 255, `cell ${cell} anchor is not on the head`);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const alpha = atlas.pixels[((top + y) * 576 + left + x) * 4 + 3];
        assert.ok(alpha === 0 || alpha === 255, `partial alpha in cell ${cell}`);
        if (alpha) assert.ok(x > 0 && y > 0 && x < 63 && y < 63, `cell ${cell} touches its border`);
      }
    }
    assert.ok(provenance.sixseven.outfits[outfit].animation.frames === 15);
    assert.equal(provenance.atlasSha256[atlasFile], createHash('sha256').update(file).digest('hex'));
    assert.ok(provenance.run.outfits[outfit].animation.seed > 0);
  });
}
