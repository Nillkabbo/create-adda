import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RULES = readFileSync(new URL('./rules.md', import.meta.url), 'utf8');

export function rulesBody() {
  return RULES.trim();
}

const cursorMdc = (body) =>
  `---\ndescription: Banglish in chat, English in everything shipped\nalwaysApply: true\n---\n\n${body}\n`;

export const PLUGIN_ID = 'adda@adda';
export const DEFAULT_MARKETPLACE = 'Nillkabbo/create-adda';
// The marketplace checkout only needs its catalog; the plugin itself comes from a release tag.
export const PLUGIN_SPARSE_PATHS = ['.claude-plugin'];

// Each scope is one of:
//   block: marker block upserted into a shared file
//   file:  a file this tool owns entirely
//   print: text shown to the user to paste somewhere by hand
//   plugin: the Claude Code plugin from this repo, installed via the `claude` CLI
export const TARGETS = {
  claude: {
    label: 'Claude Code',
    detect: (env) => join(env.home, '.claude'),
    project: { kind: 'block', path: (dir) => join(dir, 'CLAUDE.local.md'), gitignore: 'CLAUDE.local.md' },
    global: { kind: 'block', path: (env) => join(env.home, '.claude', 'CLAUDE.md') },
    plugin: { kind: 'plugin' },
  },
  cursor: {
    label: 'Cursor',
    detect: (env) => join(env.home, '.cursor'),
    project: {
      kind: 'file',
      path: (dir) => join(dir, '.cursor', 'rules', 'adda.mdc'),
      gitignore: '.cursor/rules/adda.mdc',
      render: cursorMdc,
    },
    global: {
      kind: 'print',
      title: 'Cursor (global)',
      removeHint: 'Cursor (global): delete the Banglish rule from Cursor Settings → Rules → User Rules by hand.',
      render: (body) => `Paste into Cursor Settings → Rules → User Rules:\n\n${body}\n`,
    },
  },
  codex: {
    label: 'Codex CLI',
    detect: (env) => env.codexHome ?? join(env.home, '.codex'),
    global: {
      kind: 'block',
      path: (env) => join(env.codexHome ?? join(env.home, '.codex'), 'AGENTS.md'),
    },
  },
  gemini: {
    label: 'Gemini CLI',
    detect: (env) => join(env.home, '.gemini'),
    global: { kind: 'block', path: (env) => join(env.home, '.gemini', 'GEMINI.md') },
  },
  web: {
    label: 'Web AI (ChatGPT, Claude.ai, Gemini)',
    global: {
      kind: 'print',
      title: 'Web AI prompt',
      // `--out <path>` turns this print into a file write.
      writable: true,
      render: (body) => `Role: software engineering peer collaborator.\n\n${body}\n`,
    },
  },
};
