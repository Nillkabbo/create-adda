import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { suitesFor } from '../scripts/eval-gate.mjs';

const GATE = fileURLToPath(new URL('../scripts/eval-gate.mjs', import.meta.url));

test('a developer rule change runs the developer suite only', () => {
  assert.deepEqual(suitesFor(['src/rules.md', 'README.md']), ['developer']);
});

test('an everyday rule or skill change runs the everyday suite only', () => {
  assert.deepEqual(suitesFor(['src/profiles/everyday/skills/write.md']), ['everyday']);
});

test('changes to both rules run both suites', () => {
  assert.deepEqual(suitesFor(['src/profiles/everyday/base.md', 'src/rules.md']), ['developer', 'everyday']);
});

test('a release without rule changes runs no eval', () => {
  assert.deepEqual(suitesFor(['src/plan.js', 'README.md', 'docs/demo.gif']), []);
});

test('ADDA_SKIP_EVAL skips the gate and says so', () => {
  const { status, stdout } = spawnSync(process.execPath, [GATE], {
    env: { ...process.env, ADDA_SKIP_EVAL: '1' },
    encoding: 'utf8',
  });
  assert.equal(status, 0);
  assert.match(stdout, /ADDA_SKIP_EVAL is set: skipping the eval gate/);
});
