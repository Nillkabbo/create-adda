import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upsertBlock, removeBlock } from '../src/blocks.js';

test('upsertBlock wraps the body in markers when the file is empty', () => {
  assert.equal(
    upsertBlock('', 'Talk in Banglish.'),
    '<!-- adda:start -->\nTalk in Banglish.\n<!-- adda:end -->\n',
  );
});

test('upsertBlock appends after existing content, separated by a blank line', () => {
  assert.equal(
    upsertBlock('# My notes\n- keep me\n', 'Talk in Banglish.'),
    '# My notes\n- keep me\n\n<!-- adda:start -->\nTalk in Banglish.\n<!-- adda:end -->\n',
  );
});

test('upsertBlock marks a block appended to a file without a trailing newline', () => {
  assert.equal(
    upsertBlock('# My notes', 'Rule.'),
    '# My notes\n\n<!-- adda:start no-eol -->\nRule.\n<!-- adda:end -->\n',
  );
});

test('upsertBlock replaces an existing block in place and keeps surrounding text', () => {
  const before =
    '# Top\n\n<!-- adda:start -->\nOld rule.\n<!-- adda:end -->\n\n# Bottom\n';
  assert.equal(
    upsertBlock(before, 'New rule.'),
    '# Top\n\n<!-- adda:start -->\nNew rule.\n<!-- adda:end -->\n\n# Bottom\n',
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
    '# Top\n\n<!-- adda:start -->\nRule.\n<!-- adda:end -->\n\n# Bottom\n';
  assert.equal(removeBlock(text), '# Top\n\n# Bottom\n');
});

test('removeBlock returns an empty string when only the block was in the file', () => {
  assert.equal(removeBlock(upsertBlock('', 'Rule.')), '');
});

test('removeBlock leaves text without a block unchanged', () => {
  assert.equal(removeBlock('# Nothing here\n'), '# Nothing here\n');
});

// Install then remove must give back the exact original file, whatever its trailing whitespace.
for (const [name, original] of [
  ['no trailing newline (a seeded Hermes SOUL.md)', '# Persona\n\nBe direct.'],
  ['one trailing newline', '# Notes\n- keep me\n'],
  ['several trailing blank lines', '# Notes\n\n\n'],
]) {
  test(`upsertBlock then removeBlock restores the file exactly: ${name}`, () => {
    const installed = upsertBlock(original, 'Rule.');
    assert.equal(removeBlock(installed), original);
    assert.equal(removeBlock(upsertBlock(installed, 'Updated rule.')), original);
  });
}

test('removeBlock still undoes installs made before the no-eol flag existed', () => {
  const legacy = '# Notes\n\n<!-- adda:start -->\nRule.\n<!-- adda:end -->\n';
  assert.equal(removeBlock(legacy), '# Notes\n');
});
