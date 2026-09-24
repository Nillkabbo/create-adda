import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { buildPlan, applyPlan } from '../src/plan.js';
import { sandbox, read, exists, write } from './helpers.js';

// Prefix shared by both start markers (plain and created-file).
const START = '<!-- adda:start';

function install(env, options) {
  const plan = buildPlan(options, env);
  applyPlan(plan);
  return plan;
}

test('claude project scope writes CLAUDE.local.md at the git root and gitignores it', () => {
  const { repo, cwd, env } = sandbox();
  install(env, { targets: ['claude'], scopes: { claude: 'project' } });

  const rules = read(join(repo, 'CLAUDE.local.md'));
  assert.ok(rules.startsWith(START));
  assert.match(rules, /Talk to the developer in Banglish/);
  assert.equal(exists(join(cwd, 'CLAUDE.local.md')), false);
  assert.equal(read(join(repo, '.gitignore')), '# adda\nCLAUDE.local.md\n');
});

test('claude global scope appends a block to ~/.claude/CLAUDE.md without losing user notes', () => {
  const { home, repo, env } = sandbox();
  write(join(home, '.claude', 'CLAUDE.md'), '# Server notes\n- ssh do-stage-server\n');
  install(env, { targets: ['claude'], scopes: { claude: 'global' } });

  const text = read(join(home, '.claude', 'CLAUDE.md'));
  assert.ok(text.startsWith('# Server notes\n- ssh do-stage-server\n\n' + START));
  assert.equal(exists(join(repo, 'CLAUDE.local.md')), false);
  assert.equal(exists(join(repo, '.gitignore')), false);
});

test('project scope outside a git repo writes to cwd, skips .gitignore, and warns', () => {
  const { root, home } = sandbox();
  const cwd = join(root, 'loose');
  write(join(cwd, 'placeholder'), '');
  const plan = install({ cwd, home, codexHome: join(home, '.codex') }, {
    targets: ['claude'],
    scopes: { claude: 'project' },
  });

  assert.ok(read(join(cwd, 'CLAUDE.local.md')).startsWith(START));
  assert.equal(exists(join(cwd, '.gitignore')), false);
  assert.deepEqual(plan.warnings, ['Not a git repo: .gitignore skipped.']);
});

test('project scope refuses to write into the home directory', () => {
  const { home } = sandbox();
  assert.throws(
    () => buildPlan({ targets: ['claude'], scopes: { claude: 'project' } }, { cwd: home, home }),
    /home directory.*--scope global/,
  );
});

test('cursor project scope writes an always-applied .mdc rule and gitignores it', () => {
  const { repo, env } = sandbox();
  install(env, { targets: ['claude', 'cursor'], scopes: { claude: 'project', cursor: 'project' } });

  const mdc = read(join(repo, '.cursor', 'rules', 'adda.mdc'));
  assert.ok(mdc.startsWith('---\ndescription: Banglish in chat, English in everything shipped\nalwaysApply: true\n---\n'));
  assert.match(mdc, /Talk to the developer in Banglish/);
  assert.equal(
    read(join(repo, '.gitignore')),
    '# adda\nCLAUDE.local.md\n.cursor/rules/adda.mdc\n',
  );
});

test('cursor global scope prints paste instructions instead of writing a file', () => {
  const { home, repo, env } = sandbox();
  const plan = install(env, { targets: ['cursor'], scopes: { cursor: 'global' } });

  assert.deepEqual(plan.actions.map((a) => a.type), ['print']);
  assert.match(plan.actions[0].content, /Cursor Settings → Rules → User Rules/);
  assert.match(plan.actions[0].content, /Talk to the developer in Banglish/);
  assert.equal(exists(join(repo, '.cursor')), false);
  assert.equal(exists(join(home, '.cursor')), false);
});

test('copilot project scope writes an always-applied instructions file and gitignores it', () => {
  const { repo, env } = sandbox();
  install(env, { targets: ['copilot'], scopes: { copilot: 'project' } });

  const file = read(join(repo, '.github', 'instructions', 'adda.instructions.md'));
  assert.ok(file.startsWith('---\nname: Adda\ndescription: Banglish in chat, English in everything shipped\napplyTo: "**"\n---\n'));
  assert.match(file, /Talk to the developer in Banglish/);
  assert.equal(exists(join(repo, '.github', 'copilot-instructions.md')), false);
  assert.equal(read(join(repo, '.gitignore')), '# adda\n.github/instructions/adda.instructions.md\n');
});

test('copilot global scope writes ~/.copilot/instructions and touches no project file', () => {
  const { home, repo, env } = sandbox();
  install(env, { targets: ['copilot'], scopes: { copilot: 'global' } });

  const file = read(join(home, '.copilot', 'instructions', 'adda.instructions.md'));
  assert.match(file, /applyTo: "\*\*"/);
  assert.match(file, /Talk to the developer in Banglish/);
  assert.equal(exists(join(repo, '.github')), false);
  assert.equal(exists(join(repo, '.gitignore')), false);
});

test('copilot remove deletes only its own files and keeps folders that hold other files', () => {
  const { home, repo, env } = sandbox();
  write(join(repo, '.github', 'workflows', 'test.yml'), 'name: test\n');
  write(join(home, '.copilot', 'config.json'), '{}\n');
  install(env, { targets: ['copilot'], scopes: { copilot: 'project' } });
  install(env, { targets: ['copilot'], scopes: { copilot: 'global' } });
  install(env, { targets: ['copilot'], scopes: { copilot: 'all' }, remove: true });

  assert.equal(exists(join(repo, '.github', 'instructions')), false);
  assert.equal(read(join(repo, '.github', 'workflows', 'test.yml')), 'name: test\n');
  assert.equal(exists(join(home, '.copilot', 'instructions')), false);
  assert.equal(read(join(home, '.copilot', 'config.json')), '{}\n');
  assert.equal(exists(join(repo, '.gitignore')), false);
});

test('codex and gemini are global-only, even when project scope is requested', () => {
  const { root, home, repo, env } = sandbox();
  const codexHome = join(root, 'custom-codex');
  write(join(home, '.gemini', 'GEMINI.md'), '# Gemini notes\n');
  install({ ...env, codexHome }, {
    targets: ['codex', 'gemini'],
    scopes: { codex: 'project', gemini: 'project' },
  });

  assert.ok(read(join(codexHome, 'AGENTS.md')).startsWith(START));
  assert.ok(read(join(home, '.gemini', 'GEMINI.md')).startsWith('# Gemini notes\n\n' + START));
  assert.equal(exists(join(repo, 'AGENTS.md')), false);
  assert.equal(exists(join(repo, '.gitignore')), false);
});

test('hermes appends a block to an existing SOUL.md without touching the persona', () => {
  const { home, repo, env } = sandbox();
  write(join(home, '.hermes', 'SOUL.md'), '# Personality\n\nDirect, no filler.\n');
  install(env, { targets: ['hermes'], scopes: { hermes: 'project' } }); // project is ignored: global-only

  const text = read(join(home, '.hermes', 'SOUL.md'));
  assert.ok(text.startsWith('# Personality\n\nDirect, no filler.\n\n' + START));
  assert.match(text, /Talk to the developer in Banglish/);
  assert.equal(exists(join(repo, 'SOUL.md')), false);
  assert.equal(exists(join(repo, '.gitignore')), false);
});

test('hermes honours HERMES_HOME over the default ~/.hermes', () => {
  const { root, home, env } = sandbox();
  const hermesHome = join(root, 'custom-hermes');
  write(join(hermesHome, 'SOUL.md'), '# Persona\n');
  install({ ...env, hermesHome }, { targets: ['hermes'] });

  assert.match(read(join(hermesHome, 'SOUL.md')), /Talk to the developer in Banglish/);
  assert.equal(exists(join(home, '.hermes')), false);
});

test('hermes refuses to install when SOUL.md does not exist yet', () => {
  const { home } = sandbox();
  assert.throws(
    () => buildPlan({ targets: ['hermes'] }, { cwd: home, home, codexHome: join(home, '.codex') }),
    /SOUL\.md not found\. Run Hermes once/,
  );
  assert.equal(exists(join(home, '.hermes')), false);
});

test('hermes install then remove restores a SOUL.md without a trailing newline byte for byte', () => {
  const { home, env } = sandbox();
  const persona = 'You are Hermes Agent, built by Nous Research. Be direct.';
  write(join(home, '.hermes', 'SOUL.md'), persona);
  install(env, { targets: ['hermes'] });
  install(env, { targets: ['hermes'], remove: true });

  assert.equal(read(join(home, '.hermes', 'SOUL.md')), persona);
});

test('hermes remove strips the block and keeps the persona', () => {
  const { home, env } = sandbox();
  write(join(home, '.hermes', 'SOUL.md'), '# Personality\n\nDirect, no filler.\n');
  const options = { targets: ['hermes'] };
  install(env, options);
  install(env, { ...options, remove: true });

  assert.equal(read(join(home, '.hermes', 'SOUL.md')), '# Personality\n\nDirect, no filler.\n');
});

test('web target prints a paste-ready prompt with a role header', () => {
  const { env } = sandbox();
  const plan = install(env, { targets: ['web'] });

  assert.deepEqual(plan.actions.map((a) => a.type), ['print']);
  assert.match(plan.actions[0].content, /^Role: software engineering peer collaborator\./);
  assert.match(plan.actions[0].content, /Talk to the developer in Banglish/);
});

test('web target with an out path writes the prompt to that file', () => {
  const { root, env } = sandbox();
  const out = join(root, 'prompts', 'banglish.md');
  const plan = install(env, { targets: ['web'], out });

  assert.deepEqual(plan.actions.map((a) => a.type), ['write']);
  assert.match(read(out), /^Role: software engineering peer collaborator\./);
});

test('re-running refreshes an outdated block without duplicating anything', () => {
  const { repo, env } = sandbox();
  write(
    join(repo, 'CLAUDE.local.md'),
    '# Mine\n\n<!-- adda:start -->\nOld rule text.\n<!-- adda:end -->\n',
  );
  const options = { targets: ['claude', 'cursor'], scopes: { claude: 'project', cursor: 'project' } };
  install(env, options);
  const firstClaude = read(join(repo, 'CLAUDE.local.md'));
  const firstIgnore = read(join(repo, '.gitignore'));
  install(env, options);

  assert.equal(read(join(repo, 'CLAUDE.local.md')), firstClaude);
  assert.equal(read(join(repo, '.gitignore')), firstIgnore);
  assert.doesNotMatch(firstClaude, /Old rule text/);
  assert.equal(firstClaude.split(START).length, 2);
  assert.ok(firstClaude.startsWith('# Mine\n\n'));
});

test('remove undoes a project install, deleting files that only held the rules', () => {
  const { repo, env } = sandbox();
  write(join(repo, '.gitignore'), 'node_modules/\n');
  const options = { targets: ['claude', 'cursor'], scopes: { claude: 'project', cursor: 'project' } };
  install(env, options);
  install(env, { ...options, remove: true });

  assert.equal(exists(join(repo, 'CLAUDE.local.md')), false);
  assert.equal(exists(join(repo, '.cursor', 'rules', 'adda.mdc')), false);
  assert.equal(read(join(repo, '.gitignore')), 'node_modules/\n');
});

test('remove strips only the block from shared global files', () => {
  const { home, env } = sandbox();
  write(join(home, '.claude', 'CLAUDE.md'), '# Server notes\n');
  const options = { targets: ['claude', 'codex'], scopes: { claude: 'global' } };
  install(env, options);
  install(env, { ...options, remove: true });

  assert.equal(read(join(home, '.claude', 'CLAUDE.md')), '# Server notes\n');
  assert.equal(exists(join(home, '.codex', 'AGENTS.md')), false);
});

test('remove plans nothing for files that were never installed', () => {
  const { env } = sandbox();
  const plan = buildPlan(
    { targets: ['claude', 'gemini', 'web'], scopes: { claude: 'project' }, remove: true },
    env,
  );
  assert.deepEqual(plan.actions, []);
});

test('remove for cursor global warns that User Rules must be cleared by hand', () => {
  const { env } = sandbox();
  const plan = buildPlan({ targets: ['cursor'], scopes: { cursor: 'global' }, remove: true }, env);
  assert.deepEqual(plan.warnings, [
    'Cursor (global): delete the Banglish rule from Cursor Settings → Rules → User Rules by hand.',
  ]);
});

test('remove leaves no empty .gitignore or empty .cursor folders behind', () => {
  const { repo, env } = sandbox();
  const options = { targets: ['claude', 'cursor'], scopes: { claude: 'project', cursor: 'project' } };
  install(env, options);
  install(env, { ...options, remove: true });

  assert.equal(exists(join(repo, '.gitignore')), false);
  assert.equal(exists(join(repo, '.cursor')), false);
});

test('remove keeps .cursor when it holds other rules', () => {
  const { repo, env } = sandbox();
  write(join(repo, '.cursor', 'rules', 'team.mdc'), 'team rule\n');
  const options = { targets: ['cursor'], scopes: { cursor: 'project' } };
  install(env, options);
  install(env, { ...options, remove: true });

  assert.equal(read(join(repo, '.cursor', 'rules', 'team.mdc')), 'team rule\n');
});

test('remove keeps a shared file that existed before install, even when it was empty', () => {
  const { home, env } = sandbox();
  write(join(home, '.gemini', 'GEMINI.md'), '');
  install(env, { targets: ['gemini'] });
  install(env, { targets: ['gemini'] }); // a re-run must not forget the file pre-existed
  install(env, { targets: ['gemini'], remove: true });

  assert.equal(read(join(home, '.gemini', 'GEMINI.md')), '');
});

test('project scope works when HOME points at a folder that does not exist', () => {
  const { root, repo, env } = sandbox();
  install({ ...env, home: join(root, 'missing-home') }, { targets: ['claude'], scopes: { claude: 'project' } });

  assert.ok(read(join(repo, 'CLAUDE.local.md')).startsWith(START));
});

test('global scope with a missing HOME fails with a clear message and writes nothing', () => {
  const { root, env } = sandbox();
  const home = join(root, 'missing-home');

  assert.throws(
    () => buildPlan({ targets: ['codex'] }, { ...env, home, codexHome: undefined }),
    /Home directory not found: .*missing-home.*HOME/,
  );
  assert.equal(exists(home), false);
});

test('installs write the rules with the personal preferences applied, for every target', () => {
  const { repo, home, env } = sandbox();
  const preferences = { script: 'bengali', tone: 'formal', custom: '- Keep replies short.' };
  const plan = install({ ...env, preferences }, {
    targets: ['claude', 'codex', 'web'],
    scopes: { claude: 'project' },
  });

  for (const text of [read(join(repo, 'CLAUDE.local.md')), read(join(home, '.codex', 'AGENTS.md')), plan.actions.find((a) => a.type === 'print').content]) {
    assert.match(text, /Talk to the developer in Bangla, written in Bengali script/);
    assert.match(text, /"apni"/);
    assert.match(text, /- Keep replies short\./);
  }
});
