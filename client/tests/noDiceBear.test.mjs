import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../..', import.meta.url));
const files = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? files(path) : [path];
});

test('the app no longer uses DiceBear images or avatar seeds', () => {
  const sources = [...files(join(root, 'client/src')), ...files(join(root, 'server/src/main/java')), join(root, 'client/index.html')];
  const offenders = sources.filter(path => !/\.test\./.test(path) && /dicebear|avatarSeed|avatar_seed/i.test(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, []);
});
