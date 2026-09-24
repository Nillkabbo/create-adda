import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EVERYDAY_SCENARIOS } from '../eval/scenarios-everyday.mjs';
import { GOLDEN_PROMPTS } from '../eval/golden/prompts.mjs';

const read = (path) => readFileSync(new URL(`../src/profiles/everyday/${path}`, import.meta.url), 'utf8');
const words = (text) => text.trim().split(/\s+/).length;

const base = read('base.md');
const skills = { write: read('skills/write.md'), explain: read('skills/explain.md') };

test('everyday base rule stays under the word budget', () => {
  assert.ok(words(base) <= 350, `base.md has ${words(base)} words, budget is 350`);
});

test('everyday base rule fits ChatGPT free Custom Instructions (1,500 characters)', () => {
  const length = [...base.trim()].length;
  assert.ok(length <= 1480, `base.md has ${length} characters, limit is 1480 (ChatGPT free allows 1500)`);
});

test('each everyday skill stays under the word budget', () => {
  for (const [name, text] of Object.entries(skills)) {
    assert.ok(words(text) <= 250, `${name}.md has ${words(text)} words, budget is 250`);
  }
});

test('everyday base rule keeps its anchor phrase and the safety rules', () => {
  assert.match(base, /Talk to the user in natural Bangla/);
  assert.match(base, /Never ask for an OTP, PIN, password/);
  assert.match(base, /no legal advice/);
});

test('everyday base rule keeps a Bangla, a Banglish, and an English-input example', () => {
  assert.match(base, /User: "[^"]*[ঀ-৿]/);
  assert.match(base, /User: "amar wifi/);
  assert.match(base, /User: "How do I/);
});

test('each everyday skill has an example', () => {
  for (const [name, text] of Object.entries(skills)) {
    assert.match(text, /Example/, `${name}.md has no example`);
  }
});

// A prompt that also appears as an example in the rule would only test that the model can copy it.
test('eval and golden prompts are held out from every example in the rule texts', () => {
  const texts = [base, ...Object.values(skills)].join('\n');
  const prompts = [...EVERYDAY_SCENARIOS, ...GOLDEN_PROMPTS].map((item) => item.prompt);
  for (const prompt of prompts) {
    const longestQuoted = prompt.split('"').reduce((a, b) => (b.length > a.length ? b : a), '');
    for (const probe of [prompt, longestQuoted.length >= 15 ? longestQuoted : prompt]) {
      assert.ok(!texts.includes(probe), `prompt is also an example in the rules: ${probe}`);
    }
  }
});
