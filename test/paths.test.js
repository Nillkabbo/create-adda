import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync } from 'node:fs';
import { join } from 'node:path';
import { findExecutable } from '../src/paths.js';
import { sandbox, write } from './helpers.js';

// POSIX PATH semantics (":" separators, execute bits) only exist on a POSIX host.
const posixOnly = { skip: process.platform === 'win32' && 'POSIX-only' };

test('finds an executable on a POSIX PATH', posixOnly, () => {
  const { root } = sandbox();
  write(join(root, 'bin', 'claude'), '#!/bin/sh\n');
  chmodSync(join(root, 'bin', 'claude'), 0o755);

  assert.equal(
    findExecutable('claude', { pathEnv: `/nowhere:${join(root, 'bin')}`, platform: 'linux' }),
    join(root, 'bin', 'claude'),
  );
});

test('ignores a non-executable file on POSIX', posixOnly, () => {
  const { root } = sandbox();
  write(join(root, 'bin', 'claude'), 'not a program\n');
  chmodSync(join(root, 'bin', 'claude'), 0o644);

  assert.equal(findExecutable('claude', { pathEnv: join(root, 'bin'), platform: 'linux' }), null);
});

test('on Windows, finds claude.cmd through PATHEXT', () => {
  const { root } = sandbox();
  write(join(root, 'bin', 'claude.cmd'), '@echo off\r\n');

  assert.equal(
    findExecutable('claude', { pathEnv: join(root, 'bin'), platform: 'win32', pathExt: '.EXE;.CMD' }),
    join(root, 'bin', 'claude.cmd'),
  );
});

test('on Windows, prefers PATHEXT order and falls back to the default list', () => {
  const { root } = sandbox();
  write(join(root, 'bin', 'claude.exe'), '');
  write(join(root, 'bin', 'claude.cmd'), '');

  assert.equal(
    findExecutable('claude', { pathEnv: join(root, 'bin'), platform: 'win32', pathExt: '' }),
    join(root, 'bin', 'claude.exe'),
  );
});
