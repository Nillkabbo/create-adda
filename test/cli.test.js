import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { delimiter, dirname, join } from 'node:path';
import { chmodSync } from 'node:fs';
import { sandbox, read, exists, write } from './helpers.js';

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));

// A stand-in `claude` that logs its arguments. FAKE_CLAUDE_EXIT makes it fail,
// FAKE_CLAUDE_PLUGINS is what `claude plugin list --json` prints, and FAKE_CLAUDE_MARKETPLACES
// is what `claude plugin marketplace list --json` prints. On Windows it is reached
// through a .cmd shim, like the real npm-installed claude.
function fakeClaude(box) {
  const bin = join(box.root, 'bin');
  write(
    join(bin, 'fake-claude.mjs'),
    `import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2).join(' ');
appendFileSync(process.env.FAKE_CLAUDE_LOG, 'claude ' + args + '\\n');
if (args === 'plugin list --json') process.stdout.write(process.env.FAKE_CLAUDE_PLUGINS ?? '[]');
if (args === 'plugin marketplace list --json') process.stdout.write(process.env.FAKE_CLAUDE_MARKETPLACES ?? '[]');
if (process.env.FAKE_CLAUDE_EXIT) process.stderr.write('boom');
process.exit(Number(process.env.FAKE_CLAUDE_EXIT ?? 0));
`,
  );
  write(join(bin, 'claude'), `#!/usr/bin/env node\nimport('./fake-claude.mjs');\n`);
  chmodSync(join(bin, 'claude'), 0o755);
  write(join(bin, 'claude.cmd'), '@node "%~dp0fake-claude.mjs" %*\r\n');
  return bin;
}

// stdin is a pipe, so the CLI always sees a non-TTY session here. PATH holds only node (and the
// fake claude when `withClaude` is set), so tests can never reach a real `claude` binary.
// HOME and USERPROFILE both point at the sandbox: os.homedir() reads USERPROFILE on Windows.
function run(args, box, { withClaude = false, env = {} } = {}) {
  const path = [withClaude && fakeClaude(box), dirname(process.execPath)].filter(Boolean).join(delimiter);
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: box.cwd,
    env: {
      // Windows needs these to run the .cmd shim through cmd.exe, as it would on a real machine.
      ...Object.fromEntries(
        ['SystemRoot', 'ComSpec', 'PATHEXT'].filter((key) => process.env[key]).map((key) => [key, process.env[key]]),
      ),
      HOME: box.home,
      USERPROFILE: box.home,
      CODEX_HOME: join(box.home, '.codex'),
      HERMES_HOME: join(box.home, '.hermes'),
      PATH: path,
      NO_COLOR: '1',
      FAKE_CLAUDE_LOG: join(box.root, 'claude.log'),
      ...env,
    },
    encoding: 'utf8',
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

const claudeLog = (box) => (exists(join(box.root, 'claude.log')) ? read(join(box.root, 'claude.log')) : '');

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
  assert.match(stderr, /Usage: create-adda/);
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
  assert.doesNotMatch(stdout, /Planned|Done|create-adda/);
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

test('copilot installs at both scopes and --remove takes both out', () => {
  const box = sandbox();
  const project = join(box.repo, '.github', 'instructions', 'adda.instructions.md');
  const global = join(box.home, '.copilot', 'instructions', 'adda.instructions.md');
  assert.equal(run(['--target', 'copilot', '--scope', 'project', '--yes'], box).code, 0);
  assert.equal(run(['--target', 'copilot', '--scope', 'global', '--yes'], box).code, 0);
  assert.match(read(project), /Talk to the developer in Banglish/);
  assert.match(read(global), /Talk to the developer in Banglish/);

  const { code } = run(['--remove', '--target', 'copilot', '--yes'], box);
  assert.equal(code, 0);
  assert.equal(exists(project), false);
  assert.equal(exists(global), false);
  assert.equal(exists(join(box.home, '.copilot')), false);
});

test('hermes installs into an existing SOUL.md and removes cleanly', () => {
  const box = sandbox();
  write(join(box.home, '.hermes', 'SOUL.md'), '# Personality\n\nDirect, no filler.\n');

  const install = run(['--target', 'hermes', '--scope', 'global', '--yes'], box);
  assert.equal(install.code, 0);
  const text = read(join(box.home, '.hermes', 'SOUL.md'));
  assert.ok(text.startsWith('# Personality'));
  assert.match(text, /Talk to the developer in Banglish/);

  const remove = run(['--remove', '--target', 'hermes', '--scope', 'global', '--yes'], box);
  assert.equal(remove.code, 0);
  assert.equal(read(join(box.home, '.hermes', 'SOUL.md')), '# Personality\n\nDirect, no filler.\n');
});

test('hermes without a seeded SOUL.md fails with a pointer to run Hermes first', () => {
  const box = sandbox();
  const { code, stderr } = run(['--target', 'hermes', '--scope', 'global', '--yes'], box);

  assert.equal(code, 1);
  assert.match(stderr, /SOUL\.md not found\. Run Hermes once/);
  assert.equal(exists(join(box.home, '.hermes')), false);
});

test('unknown targets are rejected', () => {
  const box = sandbox();
  const { code, stderr } = run(['--target', 'windsurf', '--yes'], box);

  assert.equal(code, 1);
  assert.match(stderr, /Unknown target: windsurf/);
});

test('project scope in the home directory fails with a pointer to --scope global', () => {
  const box = sandbox();
  const { code, stderr } = run(['--target', 'claude', '--scope', 'project', '--yes'], { ...box, cwd: box.home });

  assert.equal(code, 1);
  assert.match(stderr, /--scope global/);
});

test('--help prints usage and exits 0', () => {
  const box = sandbox();
  const { code, stdout } = run(['--help'], box);

  assert.equal(code, 0);
  assert.match(stdout, /--target <ids>/);
});

test('claude defaults to the plugin when the claude CLI is on PATH', () => {
  const box = sandbox();
  const { code, stdout } = run(['--target', 'claude', '--yes'], box, { withClaude: true });

  assert.equal(code, 0);
  assert.equal(
    claudeLog(box),
    'claude plugin marketplace list --json\n' +
      'claude plugin marketplace add Nillkabbo/create-adda --sparse .claude-plugin\n' +
      'claude plugin install adda@adda --scope user\n',
  );
  assert.match(stdout, /run\s+claude plugin install adda@adda/);
  assert.match(stdout, /Restart Claude Code/);
  assert.equal(exists(join(box.repo, 'CLAUDE.local.md')), false);
});

test('re-running the plugin install updates the marketplace an older version added', () => {
  const box = sandbox();
  const { code } = run(['--target', 'claude', '--yes'], box, {
    withClaude: true,
    env: { FAKE_CLAUDE_MARKETPLACES: JSON.stringify([{ name: 'adda', source: 'github', repo: 'Nillkabbo/create-adda' }]) },
  });

  assert.equal(code, 0);
  assert.equal(
    claudeLog(box),
    'claude plugin marketplace list --json\n' +
      'claude plugin marketplace update adda\n' +
      'claude plugin install adda@adda --scope user\n' +
      'claude plugin update adda@adda\n',
  );
});

test('claude falls back to project scope when the claude CLI is missing', () => {
  const box = sandbox();
  const { code } = run(['--target', 'claude', '--yes'], box);

  assert.equal(code, 0);
  assert.ok(exists(join(box.repo, 'CLAUDE.local.md')));
});

test('--scope plugin without the claude CLI is an error', () => {
  const box = sandbox();
  const { code, stderr } = run(['--target', 'claude', '--scope', 'plugin', '--yes'], box);

  assert.equal(code, 1);
  assert.match(stderr, /claude CLI not found/);
});

test('--scope plugin --remove uninstalls the plugin', () => {
  const box = sandbox();
  const { code } = run(['--remove', '--target', 'claude', '--scope', 'plugin', '--yes'], box, { withClaude: true });

  assert.equal(code, 0);
  assert.equal(claudeLog(box), 'claude plugin uninstall adda@adda\n');
});

test('ADDA_MARKETPLACE points the install at another marketplace source', () => {
  const box = sandbox();
  run(['--target', 'claude', '--scope', 'plugin', '--yes'], box, {
    withClaude: true,
    env: { ADDA_MARKETPLACE: '/tmp/local-checkout' },
  });

  assert.match(claudeLog(box), /^claude plugin marketplace add \/tmp\/local-checkout\n/m);
});

test('a failing claude command exits 1 and tells the user to run it by hand', () => {
  const box = sandbox();
  const { code, stderr } = run(['--target', 'claude', '--scope', 'plugin', '--yes'], box, {
    withClaude: true,
    env: { FAKE_CLAUDE_EXIT: '1' },
  });

  assert.equal(code, 1);
  assert.match(stderr, /Command failed: claude plugin marketplace add/);
  assert.match(stderr, /Run it by hand/);
});

test('switching Claude to project scope uninstalls the installed plugin', () => {
  const box = sandbox();
  const { code } = run(['--target', 'claude', '--scope', 'project', '--yes'], box, {
    withClaude: true,
    env: { FAKE_CLAUDE_PLUGINS: '[{"id":"adda@adda","enabled":true},{"id":"other@x","enabled":true}]' },
  });

  assert.equal(code, 0);
  assert.equal(claudeLog(box), 'claude plugin list --json\nclaude plugin uninstall adda@adda\n');
  assert.ok(exists(join(box.repo, 'CLAUDE.local.md')));
});

test('--remove without --scope removes Claude from every scope', () => {
  const box = sandbox();
  run(['--target', 'claude', '--scope', 'project', '--yes'], box);
  run(['--target', 'claude', '--scope', 'global', '--yes'], box);
  const { code } = run(['--remove', '--target', 'claude', '--yes'], box, {
    withClaude: true,
    env: { FAKE_CLAUDE_PLUGINS: '[{"id":"adda@adda","enabled":true}]' },
  });

  assert.equal(code, 0);
  assert.equal(exists(join(box.repo, 'CLAUDE.local.md')), false);
  assert.equal(exists(join(box.home, '.claude', 'CLAUDE.md')), false);
  assert.equal(claudeLog(box), 'claude plugin list --json\nclaude plugin uninstall adda@adda\n');
});

test('--script and --tone are saved and applied, and later runs reuse them', () => {
  const box = sandbox();
  const first = run(['--target', 'claude', '--scope', 'project', '--script', 'bengali', '--tone', 'formal', '--yes'], box);
  assert.equal(first.code, 0);
  assert.deepEqual(JSON.parse(read(join(box.home, '.config', 'adda', 'config.json'))), { script: 'bengali', tone: 'formal' });
  assert.match(read(join(box.repo, 'CLAUDE.local.md')), /Talk to the developer in Bangla, written in Bengali script/);

  run(['--target', 'codex', '--yes'], box);
  assert.match(read(join(box.home, '.codex', 'AGENTS.md')), /"apni"/);
});

test('preference flags without --target save, and report nothing to refresh on a clean machine', () => {
  const box = sandbox();
  const { code, stdout } = run(['--tone', 'formal'], box);

  assert.equal(code, 0);
  assert.match(stdout, /tone: formal/);
  assert.match(stdout, /Every installed rule here is up to date/);
  assert.equal(exists(join(box.repo, 'CLAUDE.local.md')), false);
});

test('a preference change lists out-of-date rules and needs --yes to refresh them', () => {
  const box = sandbox();
  run(['--target', 'codex', '--yes'], box);
  const before = read(join(box.home, '.codex', 'AGENTS.md'));

  const listed = run(['--tone', 'formal'], box);
  assert.equal(listed.code, 0);
  assert.match(listed.stdout, /Out-of-date rules:\n\s+update ~\/\.codex\/AGENTS\.md/);
  assert.match(listed.stdout, /Pass --yes to refresh them/);
  assert.equal(read(join(box.home, '.codex', 'AGENTS.md')), before);

  const refreshed = run(['--tone', 'formal', '--yes'], box);
  assert.equal(refreshed.code, 0);
  assert.match(read(join(box.home, '.codex', 'AGENTS.md')), /"apni"/);
});

test('--prefs refreshes rules after custom.md was edited by hand', () => {
  const box = sandbox();
  run(['--target', 'codex', '--yes'], box);
  write(join(box.home, '.config', 'adda', 'custom.md'), '- Call me "bhai".\n');

  const { code, stdout } = run(['--prefs', '--yes'], box);
  assert.equal(code, 0);
  assert.match(stdout, /update ~\/\.codex\/AGENTS\.md/);
  assert.match(read(join(box.home, '.codex', 'AGENTS.md')), /Call me "bhai"/);
});

test('--prefs shows the saved preferences and where they live', () => {
  const box = sandbox();
  write(join(box.home, '.config', 'adda', 'custom.md'), '- Keep replies short.\n');
  const { code, stdout } = run(['--prefs'], box);

  assert.equal(code, 0);
  assert.match(stdout, /script: latin/);
  assert.match(stdout, /tone: casual/);
  assert.match(stdout, /custom\.md/);
  assert.match(stdout, /Keep replies short/);
  assert.match(stdout, /after editing it, run npx create-adda --prefs/);
});

test('an unknown --script value is rejected', () => {
  const box = sandbox();
  const { code, stderr } = run(['--script', 'klingon', '--target', 'claude', '--yes'], box);

  assert.equal(code, 1);
  assert.match(stderr, /--script must be one of: latin, bengali/);
});
