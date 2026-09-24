#!/usr/bin/env node
// Generates replies for the golden prompts so a Bangla speaker can review them.
// Output goes to eval/golden/output/<model>.md (not committed). `--hero` also captures the
// with/without pair the site shows, into eval/golden/hero.json (committed).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { claude } from './claude.mjs';
import { GOLDEN_PROMPTS, HERO_PROMPT } from './golden/prompts.mjs';

const { values: flags } = parseArgs({
  options: { model: { type: 'string', default: 'sonnet' }, hero: { type: 'boolean' }, dir: { type: 'string', default: 'src/profiles/everyday' } },
});

const read = (file) => readFileSync(join(flags.dir, file), 'utf8').trim();
const base = read('base.md');
const skills = { write: read('skills/write.md'), explain: read('skills/explain.md') };
const rulesFor = (skillNames = []) => [base, ...skillNames.map((name) => skills[name])].join('\n\n');

function ask(rules, prompt) {
  const cwd = mkdtempSync(join(tmpdir(), 'adda-golden-'));
  try {
    const parsed = claude({ model: flags.model, rules, prompt, cwd, tools: '' });
    return parsed.error || parsed.isError ? `(error: ${parsed.error ?? 'claude reported an error'})` : parsed.chat.trim();
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

const sections = GOLDEN_PROMPTS.map((item) => {
  process.stderr.write(`[${flags.model}] ${item.id}\n`);
  const reply = ask(rulesFor(item.skills), item.prompt);
  return `## ${item.id}\n\nWhat to check: ${item.check}\n\nUser:\n\n${item.prompt}\n\nReply:\n\n${reply}\n`;
});

const outDir = new URL('./golden/output/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const file = new URL(`${flags.model}.md`, outDir);
writeFileSync(file, `# Golden review: everyday profile, ${flags.model}\n\n${sections.join('\n')}`);
console.log(`Saved ${file.pathname}`);

if (flags.hero) {
  process.stderr.write('[hero] without and with the rule\n');
  const hero = {
    model: flags.model,
    prompt: HERO_PROMPT,
    without: ask('Answer helpfully.', HERO_PROMPT),
    with: ask(rulesFor(), HERO_PROMPT),
  };
  const heroFile = new URL('./golden/hero.json', import.meta.url);
  writeFileSync(heroFile, `${JSON.stringify(hero, null, 2)}\n`);
  console.log(`Saved ${heroFile.pathname}`);
}
