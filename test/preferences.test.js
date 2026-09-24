import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRules } from '../src/preferences.mjs';

import { readFileSync } from 'node:fs';

const BASE = readFileSync(new URL('../src/rules.md', import.meta.url), 'utf8');

test('default preferences leave the rules untouched', () => {
  assert.equal(renderRules(BASE, {}), BASE);
  assert.equal(renderRules(BASE, { script: 'latin', tone: 'casual', custom: '  \n' }), BASE);
});

test('bengali script replaces the Latin-only chat section instead of fighting it', () => {
  const rules = renderRules(BASE, { script: 'bengali' });
  assert.doesNotMatch(rules, /Latin letters only/);
  assert.doesNotMatch(rules, /Talk to the developer in Banglish/);
  assert.match(rules, /Talk to the developer in Bangla, written in Bengali script/);
  assert.match(rules, /Latin-script Banglish/);
  assert.doesNotMatch(rules, /Fix ta ei commit message/, 'no Latin Banglish example left');
  assert.match(rules, /## Output language[\s\S]*professional English/);
  assert.match(rules, /## Precedence/);
});

test('formal tone replaces the casual peer tone and asks for "apni"', () => {
  const rules = renderRules(BASE, { tone: 'formal' });
  assert.doesNotMatch(rules, /casual peer tone/);
  assert.match(rules, /formal, respectful tone.*"apni"/);
  assert.match(rules, /Talk to the developer in Banglish/);
});

test('custom rules go last, verbatim, so they win over everything else', () => {
  const rules = renderRules(BASE, { tone: 'formal', custom: '- Keep every reply under five lines.\n' });
  assert.ok(rules.trimEnd().endsWith('- Keep every reply under five lines.'));
  assert.ok(rules.indexOf('formal, respectful tone') < rules.indexOf('Keep every reply'));
});
