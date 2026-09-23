import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upsertBlock, removeBlock } from '../src/blocks.js';

test('upsertBlock wraps the body in markers when the file is empty', () => {
  assert.equal(
    upsertBlock('', 'Talk in Banglish.'),
    '<!-- banglish-agent:start -->\nTalk in Banglish.\n<!-- banglish-agent:end -->\n',
  );
});

test('upsertBlock appends after existing content, separated by a blank line', () => {
  assert.equal(
    upsertBlock('# My notes\n- keep me\n', 'Talk in Banglish.'),
    '# My notes\n- keep me\n\n<!-- banglish-agent:start -->\nTalk in Banglish.\n<!-- banglish-agent:end -->\n',
  );
});

test('upsertBlock adds a missing trailing newline before appending', () => {
  assert.equal(
    upsertBlock('# My notes', 'Rule.'),
    '# My notes\n\n<!-- banglish-agent:start -->\nRule.\n<!-- banglish-agent:end -->\n',
  );
});

test('upsertBlock replaces an existing block in place and keeps surrounding text', () => {
  const before =
    '# Top\n\n<!-- banglish-agent:start -->\nOld rule.\n<!-- banglish-agent:end -->\n\n# Bottom\n';
  assert.equal(
    upsertBlock(before, 'New rule.'),
    '# Top\n\n<!-- banglish-agent:start -->\nNew rule.\n<!-- banglish-agent:end -->\n\n# Bottom\n',
  );
});

test('upsertBlock is idempotent', () => {
  const once = upsertBlock('# Notes\n', 'Rule.');
  assert.equal(upsertBlock(once, 'Rule.'), once);
});

test('removeBlock strips the block and its separating blank line, keeping user text', () => {
  const text = upsertBlock('# My notes\n- keep me\n', 'Rule.');
  assert.equal(removeBlock(text), '# My notes\n- keep me\n');
});

test('removeBlock keeps text on both sides of a block in the middle', () => {
  const text =
    '# Top\n\n<!-- banglish-agent:start -->\nRule.\n<!-- banglish-agent:end -->\n\n# Bottom\n';
  assert.equal(removeBlock(text), '# Top\n\n# Bottom\n');
});

test('removeBlock returns an empty string when only the block was in the file', () => {
  assert.equal(removeBlock(upsertBlock('', 'Rule.')), '');
});

test('removeBlock leaves text without a block unchanged', () => {
  assert.equal(removeBlock('# Nothing here\n'), '# Nothing here\n');
});
