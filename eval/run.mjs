#!/usr/bin/env node
// Live eval: runs real models through `claude -p` and checks the language of what they produce.
// Not part of `npm test` (costs tokens, non-deterministic). Run with `npm run eval`.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chatVerdict, hasBengaliScript, leakVerdict } from './detect.mjs';
import { claude } from './claude.mjs';
import { unverified } from './verdict.mjs';
import { DRIFT_CHECKPOINTS, DRIFT_TURNS, SCENARIOS } from './scenarios.mjs';
import { EVERYDAY_SCENARIOS } from './scenarios-everyday.mjs';

const USAGE = `Usage: npm run eval -- [options]

Options:
  --suite <name>     developer (default) or everyday
  --rules <src>      Rule to test; repeat to compare. developer: a file path or git:<ref>
                     (src/rules.md at that ref), default src/rules.md. everyday: a profile
                     directory or git:<ref> (src/profiles/everyday at that ref), default
                     src/profiles/everyday
  --model <list>     Comma-separated models (default: haiku,sonnet)
  --runs <n>         Runs per scenario (default: 3)
  --scenario <ids>   Comma-separated scenario ids (default: all)
  --drift            Run the multi-turn drift check instead of the leak scenarios
  --dry-run          Print the plan and call count, run nothing
  -h, --help         Show this help
`;

const { values: flags } = parseArgs({
  options: {
    suite: { type: 'string', default: 'developer' },
    rules: { type: 'string', multiple: true },
    model: { type: 'string', default: 'haiku,sonnet' },
    runs: { type: 'string', default: '3' },
    scenario: { type: 'string' },
    drift: { type: 'boolean' },
    'dry-run': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});
if (flags.help) {
  process.stdout.write(USAGE);
  process.exit(0);
}
if (!['developer', 'everyday'].includes(flags.suite)) {
  console.error(`--suite must be "developer" or "everyday", got "${flags.suite}".`);
  process.exit(1);
}
const everyday = flags.suite === 'everyday';
if (everyday && flags.drift) {
  console.error('--drift only supports the developer suite.');
  process.exit(1);
}

const markers = JSON.parse(
  readFileSync(new URL('../test/fixtures/banglish-markers.json', import.meta.url), 'utf8'),
);
const runs = Number.parseInt(flags.runs, 10);
const models = flags.model.split(',').map((m) => m.trim()).filter(Boolean);
const defaultSource = everyday ? 'src/profiles/everyday' : 'src/rules.md';
const variants = (flags.rules?.length ? flags.rules : [defaultSource]).map((source) => ({
  label: source,
  text: everyday ? loadProfile(source) : loadRules(source),
}));
const wanted = flags.scenario?.split(',').map((id) => id.trim());
const scenarios = (everyday ? EVERYDAY_SCENARIOS : SCENARIOS).filter((s) => !wanted || wanted.includes(s.id));

function loadRules(source) {
  if (source.startsWith('git:')) {
    return execFileSync('git', ['show', `${source.slice(4)}:src/rules.md`], { encoding: 'utf8' }).trim();
  }
  return readFileSync(source, 'utf8').trim();
}

// The everyday Rule is a base text plus Skill texts; a scenario picks which Skills to add.
function loadProfile(source) {
  const read = (file) =>
    source.startsWith('git:')
      ? execFileSync('git', ['show', `${source.slice(4)}:src/profiles/everyday/${file}`], { encoding: 'utf8' }).trim()
      : readFileSync(join(source, file), 'utf8').trim();
  return { base: read('base.md'), skills: { write: read('skills/write.md'), explain: read('skills/explain.md') } };
}

const rulesText = (variant, scenario) =>
  typeof variant.text === 'string'
    ? variant.text
    : [variant.text.base, ...(scenario.skills ?? []).map((name) => variant.text.skills[name])].join('\n\n');

function judge(kind, text) {
  if (text === null) return { status: 'na', detail: 'artifact not produced' };
  const verdict = kind === 'chat' ? chatVerdict(text, markers) : leakVerdict(text, markers);
  const detail = verdict.bengali
    ? 'bengali script'
    : kind === 'chat'
      ? `${verdict.hits.length} chat markers (need 3): ${verdict.hits.join(',')}`
      : verdict.hits.join(',');
  return { status: verdict.ok ? 'pass' : 'fail', detail };
}

function runScenario(scenario, model, rules) {
  const dir = mkdtempSync(join(tmpdir(), 'adda-eval-'));
  try {
    if (scenario.check) {
      const parsed = claude({ model, rules, prompt: scenario.prompt, cwd: dir, tools: '' });
      if (parsed.error || parsed.isError) return { status: 'error', detail: parsed.error ?? 'claude reported an error' };
      const verdict = scenario.check(parsed.chat, markers);
      return { status: verdict.ok ? 'pass' : 'fail', detail: verdict.detail, reply: parsed.chat };
    }
    scenario.setup?.(dir);
    const parsed = claude({ model, rules, prompt: scenario.prompt, cwd: dir, tools: scenario.tools });
    if (parsed.error || parsed.isError) return { status: 'error', detail: parsed.error ?? 'claude reported an error' };
    const verdict = judge(scenario.kind, scenario.collect({ dir, parsed }));
    // The rule bans Bengali script in chat outright, whatever the scenario checks.
    if (verdict.status !== 'fail' && hasBengaliScript(parsed.chat)) {
      return { status: 'fail', detail: 'bengali script in chat' };
    }
    return verdict;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runDrift(model, rules) {
  const dir = mkdtempSync(join(tmpdir(), 'adda-eval-'));
  const session = { id: randomUUID(), resume: false };
  const checkpoints = {};
  try {
    for (const [index, prompt] of DRIFT_TURNS.entries()) {
      const turn = index + 1;
      const parsed = claude({ model, rules, prompt, cwd: dir, tools: '', session });
      session.resume = true;
      if (parsed.error || parsed.isError) {
        for (const checkpoint of DRIFT_CHECKPOINTS.filter((c) => c >= turn)) {
          checkpoints[checkpoint] = { status: 'error', detail: parsed.error ?? 'claude reported an error' };
        }
        break;
      }
      if (DRIFT_CHECKPOINTS.includes(turn)) checkpoints[turn] = judge('chat', parsed.chat);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return checkpoints;
}

const rows = flags.drift ? DRIFT_CHECKPOINTS.map((turn) => ({ id: `turn ${turn}`, turn })) : scenarios;
const calls = flags.drift
  ? variants.length * models.length * runs * DRIFT_TURNS.length
  : variants.length * models.length * runs * scenarios.length;
console.log(`Plan: ${variants.length} rule variant(s) x ${models.length} model(s) x ${runs} run(s) x ${flags.drift ? `${DRIFT_TURNS.length} turns` : `${scenarios.length} scenario(s)`} = ${calls} claude call(s)`);
if (flags['dry-run']) process.exit(0);

// results[column][rowId] = [{ status, detail }]
const results = {};
for (const variant of variants) {
  for (const model of models) {
    const column = `${variant.label} / ${model}`;
    results[column] = Object.fromEntries(rows.map((row) => [row.id, []]));
    for (let run = 1; run <= runs; run++) {
      process.stderr.write(`[${column}] run ${run}/${runs}\n`);
      if (flags.drift) {
        const checkpoints = runDrift(model, variant.text);
        for (const row of rows) results[column][row.id].push(checkpoints[row.turn] ?? { status: 'error', detail: 'missing' });
      } else {
        for (const scenario of scenarios) results[column][scenario.id].push(runScenario(scenario, model, rulesText(variant, scenario)));
      }
    }
  }
}

const tally = (list) => {
  const count = (status) => list.filter((r) => r.status === status).length;
  const extras = ['na', 'error'].map((s) => (count(s) ? ` ${count(s)}${s}` : '')).join('');
  return `${count('pass')}/${list.length}${extras}`;
};
const columns = Object.keys(results);
console.log(`\n${'scenario'.padEnd(26)}${columns.map((c) => c.padEnd(34)).join('')}`);
for (const row of rows) {
  console.log(row.id.padEnd(26) + columns.map((c) => tally(results[c][row.id]).padEnd(34)).join(''));
}
const failures = columns.flatMap((c) =>
  rows.flatMap((row) => results[c][row.id].filter((r) => r.status === 'fail').map((r) => `  ${c} / ${row.id}: ${r.detail}`)),
);
if (failures.length) console.log(`\nFailures:\n${[...new Set(failures)].join('\n')}`);

const outDir = new URL('./results/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const file = new URL(`${flags.drift ? 'drift' : everyday ? 'everyday' : 'leak'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, outDir);
writeFileSync(file, `${JSON.stringify(results, null, 2)}\n`);
console.log(`\nSaved ${file.pathname}`);

// Exits non-zero unless every scenario passed on most runs, so the release gate can stop.
const problems = unverified(results);
if (problems.length) {
  console.log(`\nNot verified (a scenario must pass on most runs):\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exitCode = 1;
}
