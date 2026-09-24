import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const { version } = json('package.json');

test('the plugin manifest carries the package version', () => {
  assert.equal(json('.claude-plugin/plugin.json').version, version);
});

test('the marketplace installs the plugin from the release tag, not from main', () => {
  const [plugin] = json('.claude-plugin/marketplace.json').plugins;
  assert.deepEqual(plugin.source, { source: 'github', repo: 'Nillkabbo/create-adda', ref: `v${version}` });
});
