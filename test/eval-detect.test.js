import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chatVerdict, hasBengaliScript, leakVerdict, scriptShare } from '../eval/detect.mjs';
import { parseStream } from '../eval/stream.mjs';

const markers = JSON.parse(readFileSync(new URL('./fixtures/banglish-markers.json', import.meta.url), 'utf8'));

test('hasBengaliScript spots Bengali characters and ignores Latin text', () => {
  assert.equal(hasBengaliScript('fix: handle null user'), false);
  assert.equal(hasBengaliScript('fix: এই bug'), true);
});

test('leakVerdict passes plain English output', () => {
  assert.equal(leakVerdict('fix: handle null user in session lookup', markers).ok, true);
});

test('leakVerdict flags Banglish marker words and lists them', () => {
  const verdict = leakVerdict('bug ta fix korlam, ekhon kaj hobe', markers);
  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.hits.sort(), ['ekhon', 'hobe', 'korlam']);
});

test('leakVerdict flags Bengali script even without marker words', () => {
  const verdict = leakVerdict('// ফাংশন', markers);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.bengali, true);
});

test('leakVerdict matches whole words only', () => {
  assert.equal(leakVerdict('const korboTest = nairobi;', markers).ok, true);
});

test('chatVerdict accepts Banglish in Latin letters', () => {
  const text = 'Closure holo ekta function ja tar outer scope er variable mone rakhe, tai kaj kore.';
  assert.equal(chatVerdict(text, markers).ok, true);
});

test('chatVerdict rejects an English reply', () => {
  assert.equal(chatVerdict('A closure is a function that remembers its scope.', markers).ok, false);
});

test('chatVerdict rejects Bengali script even with enough markers', () => {
  assert.equal(chatVerdict('ei ta holo কিছু ekta kaj', markers).ok, false);
});

test('parseStream collects assistant text and tool calls', () => {
  const stdout = [
    JSON.stringify({ type: 'system', session_id: 's1' }),
    JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Hello' }, { type: 'tool_use', name: 'Agent', input: { prompt: 'list files' } }] },
    }),
    'not json',
    JSON.stringify({ type: 'result', is_error: false, result: 'Hello' }),
  ].join('\n');
  const parsed = parseStream(stdout);
  assert.equal(parsed.chat, 'Hello');
  assert.deepEqual(parsed.tools, [{ name: 'Agent', input: { prompt: 'list files' } }]);
  assert.equal(parsed.sessionId, 's1');
  assert.equal(parsed.isError, false);
});

test('parseStream flags output with no result event as an error', () => {
  assert.equal(parseStream('').isError, true);
});

test('scriptShare is 1 for Bangla script, 0 for Latin text, and 0 for no letters', () => {
  assert.equal(scriptShare('আমার নাম'), 1);
  assert.equal(scriptShare('my name'), 0);
  assert.equal(scriptShare('12 34'), 0);
});

test('scriptShare counts a Bangla sentence with a few English words as mostly Bangla', () => {
  assert.ok(scriptShare('আপনার account এর টাকা আটকে আছে') > 0.7);
});
