import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unverified } from '../eval/verdict.mjs';

const run = (...statuses) => statuses.map((status) => ({ status, detail: '' }));

test('a scenario passes when most of its runs pass, so one noisy run does not fail it', () => {
  assert.deepEqual(unverified({ 'rules / haiku': { chat: run('pass', 'fail', 'pass') } }), []);
});

test('a scenario fails when most of its runs fail', () => {
  assert.deepEqual(unverified({ 'rules / haiku': { chat: run('fail', 'pass', 'fail') } }), [
    'rules / haiku / chat: 1/3 passed',
  ]);
});

test('a tie is not a majority', () => {
  assert.deepEqual(unverified({ 'rules / haiku': { chat: run('pass', 'fail') } }), ['rules / haiku / chat: 1/2 passed']);
});

test('any error fails the scenario, since the run could not be checked at all', () => {
  assert.deepEqual(unverified({ 'rules / haiku': { chat: run('pass', 'pass', 'error') } }), [
    'rules / haiku / chat: a run errored',
  ]);
});

test('every column and scenario is checked', () => {
  const results = {
    'rules / haiku': { chat: run('pass', 'pass', 'pass'), commit: run('fail', 'fail', 'pass') },
    'rules / sonnet': { chat: run('na', 'na', 'pass'), commit: run('pass', 'pass', 'pass') },
  };
  assert.deepEqual(unverified(results), ['rules / haiku / commit: 1/3 passed', 'rules / sonnet / chat: 1/3 passed']);
});
