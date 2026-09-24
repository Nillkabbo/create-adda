#!/usr/bin/env node
// Runs from `npm version` (preversion): if a Rule changed since the last release tag, the live
// eval for that Rule must pass before the version is bumped. Releases are the only way a Rule
// reaches users (the plugin pins the tag), so this is where a regression is caught.
// Each scenario must pass on most of its 3 runs (eval/verdict.mjs), so one noisy reply does not
// block a release. Runs on the maintainer's `claude` login. ADDA_SKIP_EVAL=1 skips it.
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

export function suitesFor(files) {
  const suites = [];
  if (files.includes('src/rules.md')) suites.push('developer');
  if (files.some((file) => file.startsWith('src/profiles/everyday/'))) suites.push('everyday');
  return suites;
}

// Everyday users are on the web apps' default models, and haiku mixes scripts in Banglish
// replies whatever the wording (#11), so the everyday suite is gated on sonnet.
const MODELS = { developer: 'haiku', everyday: 'sonnet' };

export function evalArgs(suite) {
  return ['--suite', suite, '--model', MODELS[suite], '--runs', '3'];
}

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

function changedSinceLastTag() {
  let tag;
  try {
    tag = git('describe', '--tags', '--abbrev=0', '--match', 'v*');
  } catch {
    return { tag: null, files: ['src/rules.md', 'src/profiles/everyday/'] }; // No release yet: check everything.
  }
  return { tag, files: git('diff', '--name-only', tag, 'HEAD').split('\n').filter(Boolean) };
}

function main() {
  if (process.env.ADDA_SKIP_EVAL) {
    console.log('ADDA_SKIP_EVAL is set: skipping the eval gate.');
    return 0;
  }
  const { tag, files } = changedSinceLastTag();
  const suites = suitesFor(files);
  if (!suites.length) {
    console.log(`Eval gate: no Rule changed since ${tag}, nothing to check.`);
    return 0;
  }
  for (const suite of suites) {
    console.log(`Eval gate: ${suite} Rule changed since ${tag ?? 'the start'}, running the ${suite} eval on ${MODELS[suite]}.`);
    const { status } = spawnSync(
      process.execPath,
      ['eval/run.mjs', ...evalArgs(suite)],
      { cwd: root, stdio: 'inherit' },
    );
    if (status !== 0) {
      console.error(
        `\nEval gate: the ${suite} eval did not pass, so the version was not bumped.\n` +
          'Fix the Rule, or if the failure is a flaky run, retry with ADDA_SKIP_EVAL=1 npm version <bump>.',
      );
      return 1;
    }
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
