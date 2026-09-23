import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addGitignoreLines, removeGitignoreLines } from '../src/blocks.js';

test('addGitignoreLines creates a labelled section in an empty file', () => {
  assert.equal(
    addGitignoreLines('', ['CLAUDE.local.md']),
    '# banglish-agent\nCLAUDE.local.md\n',
  );
});

test('addGitignoreLines appends the section after existing entries', () => {
  assert.equal(
    addGitignoreLines('node_modules/\n', ['CLAUDE.local.md', '.cursor/rules/banglish.mdc']),
    'node_modules/\n\n# banglish-agent\nCLAUDE.local.md\n.cursor/rules/banglish.mdc\n',
  );
});

test('addGitignoreLines skips lines that are already ignored anywhere in the file', () => {
  assert.equal(
    addGitignoreLines('CLAUDE.local.md\n', ['CLAUDE.local.md']),
    'CLAUDE.local.md\n',
  );
});

test('addGitignoreLines adds new lines into the existing section on re-run', () => {
  const first = addGitignoreLines('node_modules/\n', ['CLAUDE.local.md']);
  assert.equal(
    addGitignoreLines(first, ['CLAUDE.local.md', '.cursor/rules/banglish.mdc']),
    'node_modules/\n\n# banglish-agent\nCLAUDE.local.md\n.cursor/rules/banglish.mdc\n',
  );
});

test('removeGitignoreLines drops the whole section and its separator when it empties', () => {
  const text = addGitignoreLines('node_modules/\n', ['CLAUDE.local.md', '.cursor/rules/banglish.mdc']);
  assert.equal(
    removeGitignoreLines(text, ['CLAUDE.local.md', '.cursor/rules/banglish.mdc']),
    'node_modules/\n',
  );
});

test('removeGitignoreLines keeps the section when other entries remain', () => {
  const text = addGitignoreLines('', ['CLAUDE.local.md', '.cursor/rules/banglish.mdc']);
  assert.equal(
    removeGitignoreLines(text, ['CLAUDE.local.md']),
    '# banglish-agent\n.cursor/rules/banglish.mdc\n',
  );
});

test('removeGitignoreLines does not touch matching lines the user wrote outside the section', () => {
  assert.equal(
    removeGitignoreLines('CLAUDE.local.md\n', ['CLAUDE.local.md']),
    'CLAUDE.local.md\n',
  );
});

test('removeGitignoreLines leaves no leading blank line when the section was first', () => {
  assert.equal(
    removeGitignoreLines('# banglish-agent\nCLAUDE.local.md\n\ndist/\n', ['CLAUDE.local.md']),
    'dist/\n',
  );
});
