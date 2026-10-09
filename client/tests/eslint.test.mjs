import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: fileURLToPath(new URL('..', import.meta.url)) });

test('TypeScript source files are linted and React hook errors are reported in TSX', async () => {
  const [typedModule] = await eslint.lintText("export const title: string = 'typed';", {
    filePath: 'src/lint-fixture.ts',
  });
  assert.equal(typedModule.errorCount, 0);
  assert.equal(typedModule.warningCount, 0);

  const [component] = await eslint.lintText(`
import { useState } from 'react';
type Props = { enabled: boolean };
export default function Test({ enabled }: Props) {
  if (enabled) useState(0);
  return <span>{enabled}</span>;
}
`, { filePath: 'src/lint-fixture.tsx' });
  assert.equal(component.fatalErrorCount, 0);
  assert.ok(component.messages.some(message => message.ruleId === 'react-hooks/rules-of-hooks' && message.severity === 2));
});
