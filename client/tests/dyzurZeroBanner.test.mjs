import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { test } from 'node:test';

const ROOT = new URL('../public/assets/pixel/banners/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('dyzur-zero.json', ROOT), 'utf8'));

function png(name) {
  const data = readFileSync(new URL(name, ROOT));
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  assert.equal(data[24], 8);
  const channels = data[25] === 2 ? 3 : 4;
  const chunks = [];
  for (let at = 8; at < data.length;) {
    const size = data.readUInt32BE(at);
    if (data.toString('ascii', at + 4, at + 8) === 'IDAT') chunks.push(data.subarray(at + 8, at + 8 + size));
    at += size + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels + 1;
  for (let y = 0; y < height; y++) assert.equal(raw[y * stride], 0);
  return {
    width, height, channels,
    pixel(x, y) { return [...raw.subarray(y * stride + 1 + x * channels, y * stride + 1 + (x + 1) * channels)]; },
  };
}

test('blink masks completely cover every lit native pixel and leave the scene untouched', () => {
  const base = png('dyzur-zero.png');
  const spots = [
    { ...manifest.cursor, color: '#2fd0b0', off: '#0c262d', file: 'cursor' },
    ...manifest.leds.map((led, i) => ({ ...led, off: i < 3 ? '#0b111c' : '#26344f', file: `led-${i + 1}` })),
  ];
  for (const spot of spots) {
    const mask = png(`dyzur-zero-${spot.file}-off.png`);
    assert.deepEqual([mask.width, mask.height, mask.channels], [base.width, base.height, 4]);
    for (let y = 0; y < base.height; y++) {
      for (let x = 0; x < base.width; x++) {
        const inside = x >= spot.x && x < spot.x + spot.w && y >= spot.y && y < spot.y + spot.h;
        const pixel = mask.pixel(x, y);
        assert.equal(pixel[3], inside ? 255 : 0, `${spot.file}: ${x},${y}`);
        if (inside) {
          assert.deepEqual(base.pixel(x, y), [...Buffer.from(spot.color.slice(1), 'hex')]);
          assert.deepEqual(pixel.slice(0, 3), [...Buffer.from(spot.off.slice(1), 'hex')]);
        }
      }
    }
  }
});

test('the penguin blink closes both eyes without changing any other part of the scene', () => {
  const base = png('dyzur-zero.png');
  const closed = png('dyzur-zero-penguin-blink.png');
  const expected = new Map([
    ['157,73', [232, 237, 245]], ['162,73', [232, 237, 245]],
    ...[156, 157, 162, 163].map(x => [`${x},74`, [9, 14, 24]]),
  ]);
  assert.deepEqual([closed.width, closed.height, closed.channels], [base.width, base.height, 4]);
  for (let y = 0; y < base.height; y++) {
    for (let x = 0; x < base.width; x++) {
      const pixel = closed.pixel(x, y);
      const target = expected.get(`${x},${y}`);
      assert.equal(pixel[3], target ? 255 : 0, `${x},${y}`);
      if (target) assert.deepEqual(pixel.slice(0, 3), target);
    }
  }
});
