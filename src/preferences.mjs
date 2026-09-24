// Personal preferences layered on top of the canonical rules. Shared by the CLI and the
// Claude Code plugin hooks, so it uses only Node built-ins.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const CHOICES = { script: ['latin', 'bengali'], tone: ['casual', 'formal'] };
export const DEFAULTS = { script: 'latin', tone: 'casual', custom: '' };

// $XDG_CONFIG_HOME/adda, else ~/.config/adda on every platform.
export function configDir(env = process.env, home = homedir()) {
  return join(env.XDG_CONFIG_HOME || join(home, '.config'), 'adda');
}

const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

// A missing or broken config means defaults: preferences must never stop the rules loading.
export function loadPreferences(dir = configDir()) {
  let saved = {};
  try {
    saved = JSON.parse(read(join(dir, 'config.json')) || '{}');
  } catch {
    saved = {};
  }
  const pick = (key) => (CHOICES[key].includes(saved[key]) ? saved[key] : DEFAULTS[key]);
  return { script: pick('script'), tone: pick('tone'), custom: read(join(dir, 'custom.md')) };
}

export function savePreferences(dir, changes) {
  const path = join(dir, 'config.json');
  let saved = {};
  try {
    saved = JSON.parse(read(path) || '{}');
  } catch {
    saved = {};
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...saved, ...changes }, null, 2)}\n`);
}

const TONES = {
  casual: 'casual peer tone',
  formal: 'formal, respectful tone (address the developer as "apni", never "tumi" or "tui")',
};

// Chosen script replaces the Latin-only chat section outright: an appended override lost to
// the base rule's "Latin letters only" in live tests.
const bengaliChat = (tone) => `## Chat language
- Talk to the developer in Bangla, written in Bengali script (বাংলা), ${tone}.
  Keep technical terms in English.
- Write every sentence of your own in Bengali script, even when the developer writes English or
  Latin-script Banglish. Quoted text stays as it was, inside quotes or a code span.
- Bangla is the default. Switch to English only on an explicit request ("english e bolo",
  "reply in English"), and stay until asked to switch back.

Examples:
- "এই function টা null return করছে, তাই crash হচ্ছে।"
- Developer: "why is this test flaky?" → "Test টা flaky, কারণ দুটো async call-এর order-এর কোনো guarantee নেই। \`await\` add করলে fix হবে।"
- Question to the developer: "কোন approach-এ যাব: A নাকি B?"
`;

function replaceSection(text, heading, replacement) {
  const start = text.indexOf(`${heading}\n`);
  if (start === -1) return text;
  const next = text.indexOf('\n## ', start + heading.length);
  const end = next === -1 ? text.length : next + 1;
  return text.slice(0, start) + replacement + (next === -1 ? '' : '\n') + text.slice(end);
}

export function renderRules(base, prefs = {}) {
  let rules = base;
  const tone = TONES[prefs.tone] ?? TONES.casual;
  if (prefs.script === 'bengali') {
    // Rename Banglish in the other sections first, so the new chat section keeps its own wording.
    rules = replaceSection(rules.replaceAll('Banglish', 'Bangla'), '## Chat language', bengaliChat(tone))
      .replace('"Fix ta ei commit message e jabe:"', '"Fix টা এই commit message-এ যাবে:"');
  } else if (prefs.tone === 'formal') {
    rules = rules.replace(TONES.casual, tone);
  }
  const custom = (prefs.custom ?? '').trim();
  if (!custom) return rules;
  const section = ['## Your preferences', 'These override anything above that conflicts with them.', custom];
  return `${rules.trimEnd()}\n\n${section.join('\n')}\n`;
}
