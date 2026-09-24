// On/off state for the Adda plugin, shared by the hooks. A missing or unreadable file means enabled.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { loadPreferences, renderRules } from '../src/preferences.mjs';

const statePath = () => join(homedir(), '.claude', 'adda.json');

export function isEnabled() {
  try {
    return JSON.parse(readFileSync(statePath(), 'utf8')).enabled !== false;
  } catch {
    return true;
  }
}

export function setEnabled(enabled) {
  const path = statePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ enabled }, null, 2)}\n`);
}

// The canonical rules with the developer's personal preferences (~/.config/adda) applied.
export function rules() {
  const base = readFileSync(new URL('../src/rules.md', import.meta.url), 'utf8');
  return renderRules(base, loadPreferences());
}
