#!/usr/bin/env node
// Copies the package.json version into the Claude plugin manifests. Runs from `npm version`,
// which then commits these files and creates the matching `v<version>` tag.
import { readFileSync, writeFileSync } from 'node:fs';

const REPO = 'Nillkabbo/create-adda';
const path = (file) => new URL(`../${file}`, import.meta.url);
const read = (file) => JSON.parse(readFileSync(path(file), 'utf8'));
const write = (file, data) => writeFileSync(path(file), `${JSON.stringify(data, null, 2)}\n`);

const { version } = read('package.json');

const plugin = read('.claude-plugin/plugin.json');
plugin.version = version;
write('.claude-plugin/plugin.json', plugin);

// Plugin users get the tagged release, never whatever is on main.
const marketplace = read('.claude-plugin/marketplace.json');
marketplace.plugins[0].source = { source: 'github', repo: REPO, ref: `v${version}` };
write('.claude-plugin/marketplace.json', marketplace);

console.log(`Plugin manifests synced to ${version} (ref v${version}).`);
