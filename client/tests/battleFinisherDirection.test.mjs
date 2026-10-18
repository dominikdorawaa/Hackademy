import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../src/pages/ArenaBattlePage.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const block = start => {
  const from = css.indexOf(start);
  if (from < 0) return '';
  const open = css.indexOf('{', from);
  let depth = 0;
  for (let index = open; index < css.length; index++) {
    if (css[index] === '{') depth++;
    if (css[index] === '}' && --depth === 0) return css.slice(open + 1, index);
  }
  return '';
};
const rule = selector => block(`\n${selector} {`);
const keyframes = name => block(`@keyframes ${name} {`);

test('the rival beam is mirrored in place so it still reaches the left fighter', () => {
  const beam = rule('.from-rival .battle-finish-beam');
  assert.match(beam, /scale: -1 1;/);
  assert.match(beam, /transform-origin: center;/);
  assert.match(beam, /animation-name: battle-finish-beam-rival;/);
  const frames = keyframes('battle-finish-beam-rival');
  assert.match(frames, /0% \{[^}]*clip-path: inset\(0 100% 0 0\)/);
  assert.doesNotMatch(frames, /scaleX/);
});

test('the losing fighter is pushed away from the winner on both sides', () => {
  assert.match(rule('.battle-fighter.is-me'), /--away: -1;/);
  assert.match(rule('.battle-fighter.is-rival'), /--away: 1;/);
  for (const name of ['battle-knockback', 'battle-glitch']) {
    const shifts = [...keyframes(name).matchAll(/translate: (calc\(.*?\)\)|0) /g)].map(match => match[1]).filter(value => value !== '0');
    assert.ok(shifts.length > 0, `${name} has no horizontal movement`);
    for (const shift of shifts) assert.match(shift, /var\(--away\)/, `${name} moves ${shift} regardless of side`);
  }
});
