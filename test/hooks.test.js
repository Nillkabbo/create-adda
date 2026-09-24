import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { sandbox, read, write, exists } from './helpers.js';

const hook = (name) => fileURLToPath(new URL(`../hooks/${name}.mjs`, import.meta.url));
const statePath = (home) => join(home, '.claude', 'adda.json');

// Runs a hook the way Claude Code does: JSON event on stdin, context on stdout.
// XDG_CONFIG_HOME is pinned inside the sandbox so a developer's real preferences never leak in.
function runHook(name, event, home) {
  const result = spawnSync(process.execPath, [hook(name)], {
    input: JSON.stringify(event),
    env: { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: join(home, '.config') },
    encoding: 'utf8',
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('session start injects the rules when no state file exists', () => {
  const { home } = sandbox();
  const { code, stdout } = runHook('session-start', { hook_event_name: 'SessionStart', source: 'startup' }, home);

  assert.equal(code, 0);
  assert.match(stdout, /Talk to the developer in Banglish/);
});

test('session start stays silent when Banglish is turned off', () => {
  const { home } = sandbox();
  write(statePath(home), '{ "enabled": false }\n');
  const { code, stdout } = runHook('session-start', { hook_event_name: 'SessionStart', source: 'startup' }, home);

  assert.equal(code, 0);
  assert.equal(stdout, '');
});

test('session start treats a corrupt state file as enabled', () => {
  const { home } = sandbox();
  write(statePath(home), 'not json');
  const { code, stdout } = runHook('session-start', { hook_event_name: 'SessionStart', source: 'compact' }, home);

  assert.equal(code, 0);
  assert.match(stdout, /Talk to the developer in Banglish/);
});

const prompt = (text) => ({ hook_event_name: 'UserPromptSubmit', prompt: text });

test('/adda off persists the off state and switches the current session to English', () => {
  const { home } = sandbox();
  const { code, stdout } = runHook('prompt-submit', prompt('/adda off'), home);

  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(read(statePath(home))), { enabled: false });
  assert.match(stdout, /Adda is OFF/);
  assert.match(stdout, /reply in English/);
});

test('/adda on persists the on state and re-injects the full rules', () => {
  const { home } = sandbox();
  write(statePath(home), '{ "enabled": false }\n');
  const { stdout } = runHook('prompt-submit', prompt('/adda on'), home);

  assert.deepEqual(JSON.parse(read(statePath(home))), { enabled: true });
  assert.match(stdout, /Adda is ON/);
  assert.match(stdout, /Talk to the developer in Banglish/);
});

test('/adda status reports the state without changing it', () => {
  const { home } = sandbox();
  write(statePath(home), '{ "enabled": false }\n');
  const { stdout } = runHook('prompt-submit', prompt('/adda status'), home);

  assert.match(stdout, /Adda status: OFF/);
  assert.deepEqual(JSON.parse(read(statePath(home))), { enabled: false });
});

test('the namespaced plugin command form works the same way', () => {
  const { home } = sandbox();
  runHook('prompt-submit', prompt('  /adda:adda OFF  '), home);

  assert.deepEqual(JSON.parse(read(statePath(home))), { enabled: false });
});

test('ordinary prompts, bad input, and unknown arguments produce no output and no state', () => {
  const { home } = sandbox();
  for (const event of [prompt('ei function ta fix koro'), prompt('/adda maybe'), prompt('/addaify'), {}]) {
    const { code, stdout } = runHook('prompt-submit', event, home);
    assert.equal(code, 0);
    assert.equal(stdout, '');
  }
  assert.equal(exists(statePath(home)), false);
});

test('session start applies the personal preferences to the injected rules', () => {
  const { home } = sandbox();
  write(join(home, '.config', 'adda', 'config.json'), '{ "script": "bengali" }\n');
  write(join(home, '.config', 'adda', 'custom.md'), '- Keep replies short.\n');
  const { stdout } = runHook('session-start', { hook_event_name: 'SessionStart', source: 'startup' }, home);

  assert.match(stdout, /Talk to the developer in Bangla, written in Bengali script/);
  assert.match(stdout, /- Keep replies short\./);
});

test('/adda on re-injects the rules with the personal preferences applied', () => {
  const { home } = sandbox();
  write(join(home, '.config', 'adda', 'config.json'), '{ "tone": "formal" }\n');
  const { stdout } = runHook('prompt-submit', prompt('/adda on'), home);

  assert.match(stdout, /"apni"/);
});
