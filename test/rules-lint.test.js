import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasBengaliScript } from '../eval/detect.mjs';

const rules = readFileSync(new URL('../src/rules.md', import.meta.url), 'utf8');
const lines = rules.split('\n');

test('rules stay under the word budget', () => {
  const words = rules.trim().split(/\s+/).length;
  assert.ok(words <= 350, `rules.md has ${words} words, budget is 350`);
});

test('Bengali script appears only in the two lines that explain it', () => {
  const bengali = lines.filter(hasBengaliScript);
  assert.ok(bengali.length <= 2, `Bengali script on ${bengali.length} lines:\n${bengali.join('\n')}`);
});

test('rules keep at least three Banglish examples', () => {
  const examples = lines.filter((line) => /^- (Developer:|Question to the developer:|"ei )/.test(line));
  assert.ok(examples.length >= 3, `found ${examples.length} example lines`);
});

test('rules keep the anchor phrase every target and test relies on', () => {
  assert.match(rules, /Talk to the developer in Banglish/);
});
