import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { buildPlan, applyPlan, buildRefreshPlan } from '../src/plan.js';
import { sandbox, read, exists, write } from './helpers.js';

const FORMAL = { script: 'latin', tone: 'formal', custom: '' };
const paths = (plan) => plan.actions.map((action) => action.path).sort();

function installAll(env) {
  write(join(env.home, '.gemini', 'GEMINI.md'), '# Gemini notes\n');
  applyPlan(buildPlan({ targets: ['codex', 'gemini'] }, env));
  applyPlan(buildPlan({ targets: ['cursor', 'copilot'], scopes: { cursor: 'project', copilot: 'project' } }, env));
  applyPlan(buildPlan({ targets: ['copilot'], scopes: { copilot: 'global' } }, env));
}

test('installs written with the current preferences are up to date', () => {
  const { env } = sandbox();
  installAll(env);
  assert.deepEqual(buildRefreshPlan(env).actions, []);
});

test('after a preference change every installed block and owned file is refreshed', () => {
  const { home, repo, env } = sandbox();
  installAll(env);
  const plan = buildRefreshPlan({ ...env, preferences: FORMAL });

  assert.deepEqual(paths(plan), [
    join(home, '.codex', 'AGENTS.md'),
    join(home, '.copilot', 'instructions', 'adda.instructions.md'),
    join(home, '.gemini', 'GEMINI.md'),
    join(repo, '.cursor', 'rules', 'adda.mdc'),
    join(repo, '.github', 'instructions', 'adda.instructions.md'),
  ]);
  applyPlan(plan);
  assert.match(read(join(home, '.codex', 'AGENTS.md')), /"apni"/);
  assert.ok(read(join(home, '.gemini', 'GEMINI.md')).startsWith('# Gemini notes\n\n<!-- adda:start'));
  assert.ok(read(join(repo, '.cursor', 'rules', 'adda.mdc')).startsWith('---\ndescription:'));
  assert.deepEqual(buildRefreshPlan({ ...env, preferences: FORMAL }).actions, []);
});

test('a refresh never installs into a tool that has no Adda rule yet', () => {
  const { home, repo, env } = sandbox();
  write(join(home, '.gemini', 'GEMINI.md'), '# Gemini notes\n');
  write(join(home, '.hermes', 'SOUL.md'), '# Persona\n');
  const plan = buildRefreshPlan({ ...env, preferences: FORMAL });

  assert.deepEqual(plan.actions, []);
  assert.equal(read(join(home, '.gemini', 'GEMINI.md')), '# Gemini notes\n');
  assert.equal(exists(join(repo, 'CLAUDE.local.md')), false);
});

test('a refresh run from the home directory checks only the global scope', () => {
  const { home, env } = sandbox();
  applyPlan(buildPlan({ targets: ['codex'] }, env));
  const plan = buildRefreshPlan({ ...env, cwd: home, preferences: FORMAL });
  assert.deepEqual(paths(plan), [join(home, '.codex', 'AGENTS.md')]);
});

test('a refresh names what it cannot check: other projects and pasted text', () => {
  const { env } = sandbox();
  const { warnings } = buildRefreshPlan(env);
  assert.ok(warnings.some((warning) => /other projects/.test(warning)));
  assert.ok(warnings.some((warning) => /Cursor User Rules.*Web AI/.test(warning)));
});
