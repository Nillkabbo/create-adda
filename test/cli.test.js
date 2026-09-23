import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { sandbox, read, exists } from './helpers.js';

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));

// stdin is a pipe, so the CLI always sees a non-TTY session here.
function run(args, box) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: box.cwd,
    env: { ...process.env, HOME: box.home, CODEX_HOME: join(box.home, '.codex'), NO_COLOR: '1' },
    encoding: 'utf8',
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('flags install claude at project scope without prompting', () => {
  const box = sandbox();
  const { code, stdout } = run(['--target', 'claude', '--scope', 'project', '--yes'], box);

  assert.equal(code, 0);
  assert.match(read(join(box.repo, 'CLAUDE.local.md')), /Talk to the developer in Banglish/);
  assert.match(stdout, /CLAUDE\.local\.md/);
  assert.match(stdout, /Done/);
});

test('non-interactive run without --target exits 1 with usage instead of hanging', () => {
  const box = sandbox();
  const { code, stderr } = run([], box);

  assert.equal(code, 1);
  assert.match(stderr, /No TTY detected/);
  assert.match(stderr, /Usage: create-banglish-agent/);
});

test('non-interactive run without --yes refuses to apply changes', () => {
  const box = sandbox();
  const { code, stderr } = run(['--target', 'claude'], box);

  assert.equal(code, 1);
  assert.match(stderr, /--yes/);
  assert.equal(exists(join(box.repo, 'CLAUDE.local.md')), false);
});

test('--print web writes only the prompt to stdout', () => {
  const box = sandbox();
  const { code, stdout } = run(['--print', 'web'], box);

  assert.equal(code, 0);
  assert.match(stdout, /^Role: software engineering peer collaborator\./);
  assert.doesNotMatch(stdout, /Planned|Done|create-banglish-agent/);
});

test('--remove uninstalls what a previous run installed', () => {
  const box = sandbox();
  run(['--target', 'claude,codex', '--scope', 'global', '--yes'], box);
  assert.ok(exists(join(box.home, '.codex', 'AGENTS.md')));

  const { code, stdout } = run(['--remove', '--target', 'claude,codex', '--scope', 'global', '--yes'], box);
  assert.equal(code, 0);
  assert.match(stdout, /Planned removal/);
  assert.equal(exists(join(box.home, '.claude', 'CLAUDE.md')), false);
  assert.equal(exists(join(box.home, '.codex', 'AGENTS.md')), false);
});

test('unknown targets are rejected', () => {
  const box = sandbox();
  const { code, stderr } = run(['--target', 'copilot', '--yes'], box);

  assert.equal(code, 1);
  assert.match(stderr, /Unknown target: copilot/);
});

test('project scope in the home directory fails with a pointer to --scope global', () => {
  const box = sandbox();
  const { code, stderr } = run(['--target', 'claude', '--yes'], { ...box, cwd: box.home });

  assert.equal(code, 1);
  assert.match(stderr, /--scope global/);
});

test('--help prints usage and exits 0', () => {
  const box = sandbox();
  const { code, stdout } = run(['--help'], box);

  assert.equal(code, 0);
  assert.match(stdout, /--target <ids>/);
});
