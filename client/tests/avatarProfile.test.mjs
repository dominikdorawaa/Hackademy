import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { inflateSync } from 'node:zlib';

const ROOT = new URL('../public/assets/arena/avatar-v1/profile/', import.meta.url);
const read = path => readFileSync(new URL(path, ROOT));
const provenance = JSON.parse(read('provenance.json').toString());

function alphaOf(file) {
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
  return { width, height, alpha: (x, y) => pixels[(y * width + x) * 4 + 3] };
}

for (const outfit of ['baza', 'bluza', 'dres']) {
  test(`${outfit} profile pose is a whole 64x64 sprite with a head anchor and provenance`, () => {
    const file = read(`${outfit}.png`), image = alphaOf(file), anchors = JSON.parse(read(`anchors-${outfit}.json`).toString());
    assert.deepEqual([image.width, image.height], [64, 64]);
    let opaque = 0;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const alpha = image.alpha(x, y);
      assert.ok(alpha === 0 || alpha === 255);
      if (alpha) { opaque++; assert.ok(x > 0 && y > 0 && x < 63 && y < 63, 'sprite touches the border'); }
    }
    assert.ok(opaque > 300);
    assert.equal(anchors.cells[0].angle, 0);
    assert.ok(image.alpha(Math.round(anchors.cells[0].x), Math.round(anchors.cells[0].y)) === 255, 'anchor is not on the head');
    assert.equal(provenance.outfits[outfit].sha256, createHash('sha256').update(file).digest('hex'));
  });
}
