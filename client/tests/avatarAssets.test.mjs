import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { inflateSync } from 'node:zlib';
import ts from 'typescript';

const ROOT = new URL('../public/assets/arena/avatar-v1/', import.meta.url);
const read = path => readFileSync(new URL(path, ROOT));
const ATLASES = { baza: ['fighter.png', 'anchors.json'], bluza: ['hoodie/fighter.png', 'hoodie/anchors.json'], dres: ['track/fighter.png', 'track/anchors.json'] };
const RUN_ROW = 10;
const FINISHER_ROWS = [2, 3, 11, 12];
const TURN_ROWS = [15, 16];
const provenance = JSON.parse(read('provenance.json').toString());
const modelSource = readFileSync(new URL('../src/components/arena/avatar/avatarModel.ts', import.meta.url), 'utf8');
const model = await import('data:text/javascript,' + encodeURIComponent(ts.transpileModule(modelSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText));
const SIX_CELLS = [72, ...Array.from({ length: 8 }, (_, i) => 73 + i), 81, ...Array.from({ length: 8 }, (_, i) => 82 + i)];
const lightness = key => (Math.max(key >> 16, (key >> 8) & 255, key & 255) + Math.min(key >> 16, (key >> 8) & 255, key & 255)) / 510;

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
    assert.deepEqual([atlas.width, atlas.height], [576, 1088]);
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
    for (const cell of [...Array.from({ length: 8 }, (_, i) => 73 + i), ...Array.from({ length: 8 }, (_, i) => 82 + i), ...Array.from({ length: 8 }, (_, i) => 118 + i), ...Array.from({ length: 8 }, (_, i) => 127 + i)]) {
      const anchor = anchors.cells[cell], top = Math.floor(cell / 9) * 64, left = (cell % 9) * 64;
      assert.equal(anchor?.view, 'dance', `cell ${cell} has no dance head anchor`);
      assert.equal(atlas.pixels[((top + Math.round(anchor.y)) * 576 + left + Math.round(anchor.x)) * 4 + 3], 255, `cell ${cell} anchor is not on the head`);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const alpha = atlas.pixels[((top + y) * 576 + left + x) * 4 + 3];
        assert.ok(alpha === 0 || alpha === 255, `partial alpha in cell ${cell}`);
        if (alpha) assert.ok(x > 0 && y > 0 && x < 63 && y < 63, `cell ${cell} touches its border`);
      }
    }
    assert.ok(provenance.sixseven.outfits[outfit].animation.frames === 15);
    assert.ok(provenance.scuba.animation.frames === 16 && provenance.scuba.outfits[outfit]);
    for (const row of TURN_ROWS) for (let column = 0; column <= 4; column++) {
      const cell = row * 9 + column, anchor = anchors.cells[cell], top = row * 64, left = column * 64;
      assert.ok(anchor, `turn cell ${cell} has no head anchor`);
      assert.equal(atlas.pixels[((top + Math.round(anchor.y)) * 576 + left + Math.round(anchor.x)) * 4 + 3], 255, `turn cell ${cell} anchor is not on the head`);
      let opaque = 0, ground = 0;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const alpha = atlas.pixels[((top + y) * 576 + left + x) * 4 + 3];
        assert.ok(alpha === 0 || alpha === 255, `partial alpha in turn cell ${cell}`);
        if (alpha) { opaque++; ground = Math.max(ground, y); assert.ok(x > 0 && y > 0 && x < 63 && y < 63, `turn cell ${cell} touches its border`); }
      }
      assert.ok(opaque > 300, `turn cell ${cell} is empty`);
      assert.equal(ground, 54, `turn cell ${cell} does not stand on the side ground line`);
    }
    for (const [file, hash] of Object.entries(provenance.danceTurn.overlaysSha256)) assert.equal(createHash('sha256').update(read('dance/' + file)).digest('hex'), hash);
    for (let column = 1; column <= 8; column++) {
      const cell = 9 + column;
      assert.equal(anchors.cells[cell]?.angle, 0, `attack cell ${cell} has no head anchor`);
      let opaque = 0;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const alpha = atlas.pixels[((64 + y) * 576 + column * 64 + x) * 4 + 3];
        assert.ok(alpha === 0 || alpha === 255, `partial alpha in attack cell ${cell}`);
        if (alpha) { opaque++; assert.ok(x > 0 && y > 0 && x < 63 && y < 63, `attack cell ${cell} touches its border`); }
      }
      assert.ok(opaque > 300);
    }
    for (const row of FINISHER_ROWS) for (let column = 0; column <= 8; column++) {
      const cell = row * 9 + column, anchor = anchors.cells[cell];
      assert.ok(anchor && (column === 0 || (Number.isInteger(anchor.x) && Number.isInteger(anchor.y))), `finisher cell ${cell} has no whole-pixel head anchor`);
      assert.equal(atlas.pixels[((row * 64 + Math.round(anchor.y)) * 576 + column * 64 + Math.round(anchor.x)) * 4 + 3], 255, `finisher cell ${cell} anchor is not on the head`);
      let opaque = 0;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const alpha = atlas.pixels[((row * 64 + y) * 576 + column * 64 + x) * 4 + 3];
        assert.ok(alpha === 0 || alpha === 255, `partial alpha in finisher cell ${cell}`);
        if (alpha) { opaque++; assert.ok(x > 0 && y > 0 && x < 63 && y < 63, `finisher cell ${cell} touches its border`); }
      }
      assert.ok(opaque > 300, `finisher cell ${cell} is empty`);
    }
    for (const move of ['beam', 'combo']) assert.equal(provenance.finishers.moves[move].outfits[outfit].frameCount, 16);
    for (const cell of [37, 38, 39, 40, 46, 47, 48, 49, 50, 51, 52, 53]) assert.ok(Number.isInteger(anchors.cells[cell].x), `fall cell ${cell} keeps a whole-pixel head anchor`);
    assert.equal(provenance.attack.outfits[outfit].frameCount, 8);
    assert.equal(provenance.atlasSha256[atlasFile], createHash('sha256').update(file).digest('hex'));
    assert.ok(provenance.run.outfits[outfit].animation.seed > 0);
  });
}

test('battle effects and the arena background match their provenance', () => {
  const arena = new URL('../public/assets/arena/', import.meta.url);
  const file = path => readFileSync(new URL(path, arena));
  const effects = JSON.parse(file('effects/provenance.json').toString());
  for (const effect of effects.effects) assert.equal(effect.sha256, createHash('sha256').update(file('effects/' + effect.file)).digest('hex'));
  const stages = JSON.parse(file('stages/provenance.json').toString());
  const stage = stages.stages.find(entry => entry.file === 'server-room-arena.png');
  assert.equal(stage.sha256, createHash('sha256').update(file('stages/server-room-arena.png')).digest('hex'));
  assert.deepEqual([decode(file('stages/server-room-arena.png')).width, decode(file('stages/server-room-arena.png')).height], [400, 288]);
});

for (const [outfit, [atlasFile]] of Object.entries(ATLASES)) {
  test(`${outfit} Six-seven frames shade like the front view after recolouring`, () => {
    const atlas = decode(read(atlasFile)), front = decode(read(`front/${outfit}.png`));
    const atlasMap = model.buildColorMap(atlas.pixels, model.OUTFIT_SPECS[outfit]), frontMap = model.buildColorMap(front.pixels, model.OUTFIT_SPECS[outfit]);
    const frontRanges = new Map();
    for (const [key, entry] of frontMap) {
      const range = frontRanges.get(entry.material) ?? [1, 0];
      frontRanges.set(entry.material, [Math.min(range[0], lightness(key)), Math.max(range[1], lightness(key))]);
    }
    for (const cell of SIX_CELLS) {
      const top = Math.floor(cell / 9) * 64, left = (cell % 9) * 64;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const index = ((top + y) * 576 + left + x) * 4;
        if (!atlas.pixels[index + 3]) continue;
        const key = (atlas.pixels[index] << 16) | (atlas.pixels[index + 1] << 8) | atlas.pixels[index + 2], entry = atlasMap.get(key);
        if (entry.material === 'outline' || entry.material === 'keep' || !frontRanges.has(entry.material)) continue;
        const [low, high] = frontRanges.get(entry.material);
        if (frontMap.has(key)) assert.equal(entry.shade, frontMap.get(key).shade, `cell ${cell} pixel ${x},${y} shades differently from the front view`);
        else assert.ok(Math.abs(entry.shade - Math.min(3, Math.max(0, Math.round(((lightness(key) - low) / (high - low || 1)) * 3)))) <= 1, `cell ${cell} pixel ${x},${y} shades differently from the front view`);
      }
    }
  });
}
