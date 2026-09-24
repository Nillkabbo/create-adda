import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { buildPlan, applyPlan } from '../src/plan.js';
import { sandbox, read, exists, write } from './helpers.js';

// Records commands instead of running them; `fail` makes a matching command exit non-zero.
function fakeRunner({ fail } = {}) {
  const calls = [];
  const run = (command, args) => {
    calls.push([command, ...args].join(' '));
    return fail && args.includes(fail) ? { code: 1, stderr: `${fail} exploded` } : { code: 0, stderr: '' };
  };
  return { calls, run };
}

const PLUGIN = { targets: ['claude'], scopes: { claude: 'plugin' } };

test('plugin scope adds the marketplace and installs the plugin for the user', () => {
  const { env } = sandbox();
  const runner = fakeRunner();
  applyPlan(buildPlan(PLUGIN, env), { run: runner.run });

  assert.deepEqual(runner.calls, [
    'claude plugin marketplace add Nillkabbo/create-adda --sparse .claude-plugin src hooks commands',
    'claude plugin install adda@adda --scope user',
  ]);
});

test('a failing plugin command stops the run and names the command to retry by hand', () => {
  const { env } = sandbox();
  const runner = fakeRunner({ fail: 'marketplace' });

  assert.throws(
    () => applyPlan(buildPlan(PLUGIN, env), { run: runner.run }),
    (error) =>
      /marketplace exploded/.test(error.message) &&
      error.message.includes('claude plugin marketplace add Nillkabbo/create-adda'),
  );
  assert.equal(runner.calls.length, 1);
});

test('plugin install removes existing Claude blocks so the rules are not loaded twice', () => {
  const { home, repo, env } = sandbox();
  write(join(repo, '.gitignore'), 'node_modules/\n');
  write(join(home, '.claude', 'CLAUDE.md'), '# Server notes\n');
  applyPlan(buildPlan({ targets: ['claude'], scopes: { claude: 'project' } }, env));
  applyPlan(buildPlan({ targets: ['claude'], scopes: { claude: 'global' } }, env));

  applyPlan(buildPlan(PLUGIN, env), { run: fakeRunner().run });

  assert.equal(exists(join(repo, 'CLAUDE.local.md')), false);
  assert.equal(read(join(repo, '.gitignore')), 'node_modules/\n');
  assert.equal(read(join(home, '.claude', 'CLAUDE.md')), '# Server notes\n');
});

test('plugin scope works from the home directory, where project scope is refused', () => {
  const { home } = sandbox();
  const plan = buildPlan(PLUGIN, { cwd: home, home });
  assert.deepEqual(plan.actions.map((a) => a.type), ['exec', 'exec']);
});

test('removing the plugin scope uninstalls the plugin and keeps the marketplace', () => {
  const { env } = sandbox();
  const runner = fakeRunner();
  applyPlan(buildPlan({ ...PLUGIN, remove: true }, env), { run: runner.run });

  assert.deepEqual(runner.calls, ['claude plugin uninstall adda@adda']);
});

test('a local directory marketplace is added without --sparse, which only git sources support', () => {
  const { env } = sandbox();
  const runner = fakeRunner();
  applyPlan(buildPlan({ ...PLUGIN, marketplace: '/work/create-adda' }, env), { run: runner.run });

  assert.equal(runner.calls[0], 'claude plugin marketplace add /work/create-adda');
});

test('a Claude block install uninstalls an installed plugin, so the rules are not loaded twice', () => {
  const { repo, env } = sandbox();
  const runner = fakeRunner();
  applyPlan(buildPlan({ targets: ['claude'], scopes: { claude: 'project' } }, { ...env, pluginInstalled: true }), {
    run: runner.run,
  });

  assert.ok(exists(join(repo, 'CLAUDE.local.md')));
  assert.deepEqual(runner.calls, ['claude plugin uninstall adda@adda']);
});

test('a Claude block install leaves the plugin alone when it is not installed', () => {
  const { env } = sandbox();
  const plan = buildPlan({ targets: ['claude'], scopes: { claude: 'global' } }, { ...env, pluginInstalled: false });
  assert.deepEqual(plan.actions.map((a) => a.type), ['write']);
});

test('removing Claude at every scope clears both blocks, the gitignore line, and the plugin', () => {
  const { home, repo, env } = sandbox();
  write(join(home, '.claude', 'CLAUDE.md'), '# Server notes\n');
  applyPlan(buildPlan({ targets: ['claude'], scopes: { claude: 'project' } }, env));
  applyPlan(buildPlan({ targets: ['claude'], scopes: { claude: 'global' } }, env));
  const runner = fakeRunner();

  applyPlan(buildPlan({ targets: ['claude'], scopes: { claude: 'all' }, remove: true }, { ...env, pluginInstalled: true }), {
    run: runner.run,
  });

  assert.equal(exists(join(repo, 'CLAUDE.local.md')), false);
  assert.equal(exists(join(repo, '.gitignore')), false);
  assert.equal(read(join(home, '.claude', 'CLAUDE.md')), '# Server notes\n');
  assert.deepEqual(runner.calls, ['claude plugin uninstall adda@adda']);
});

test('removing at every scope from the home directory skips the project and keeps going', () => {
  const { home } = sandbox();
  write(join(home, '.claude', 'CLAUDE.md'), '<!-- adda:start -->\nRule.\n<!-- adda:end -->\n# Notes\n');
  const plan = buildPlan(
    { targets: ['claude', 'cursor'], scopes: { claude: 'all', cursor: 'all' }, remove: true },
    { cwd: home, home, pluginInstalled: false },
  );
  applyPlan(plan);

  assert.equal(read(join(home, '.claude', 'CLAUDE.md')), '# Notes\n');
  assert.deepEqual(plan.warnings, [
    'Cursor (global): delete the Banglish rule from Cursor Settings → Rules → User Rules by hand.',
  ]);
});
