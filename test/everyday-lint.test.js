import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../src/profiles/everyday/${path}`, import.meta.url), 'utf8');
const words = (text) => text.trim().split(/\s+/).length;

const base = read('base.md');
const skills = { write: read('skills/write.md'), explain: read('skills/explain.md') };

test('everyday base rule stays under the word budget', () => {
  assert.ok(words(base) <= 350, `base.md has ${words(base)} words, budget is 350`);
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
  assert.match(base, /User: "amar bill/);
  assert.match(base, /User: "How do I/);
});

test('each everyday skill has an example', () => {
  for (const [name, text] of Object.entries(skills)) {
    assert.match(text, /Example/, `${name}.md has no example`);
  }
});
