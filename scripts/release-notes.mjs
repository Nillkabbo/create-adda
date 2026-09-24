#!/usr/bin/env node
// Prints the GitHub Release notes for a tag, built from the Conventional Commit subjects since the
// previous tag. A changed Rule opens the notes with how to refresh it, because block and file
// installs keep the old Rule until the user runs create-adda again.
// Usage: node scripts/release-notes.mjs v0.6.0
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SECTIONS = [
  ['feat', 'New'],
  ['fix', 'Fixes'],
];

const RULE_CALLOUT = [
  '> [!IMPORTANT]',
  '> The Rule changed in this release. Refresh the rules already installed with `npx create-adda --prefs`.',
  '> Claude Code plugin users: `claude plugin update adda@adda`, then restart Claude Code.',
].join('\n');

// No link to the everyday site while it is unlisted (#7).
const EVERYDAY_CALLOUT = [
  '> [!NOTE]',
  '> The everyday texts changed in this release. Copy them again into your AI\'s custom instructions.',
].join('\n');

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

export function releaseNotes({ tag, previousTag, repo, commits, changedFiles }) {
  const parts = [];
  if (changedFiles.includes('src/rules.md')) parts.push(RULE_CALLOUT);
  if (changedFiles.some((file) => file.startsWith('src/profiles/everyday/'))) parts.push(EVERYDAY_CALLOUT);

  const grouped = new Map(SECTIONS.map(([type]) => [type, []]));
  for (const subject of commits) {
    const match = subject.match(/^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/);
    if (match && grouped.has(match[1])) grouped.get(match[1]).push(capitalize(match[2]));
  }
  for (const [type, title] of SECTIONS) {
    const items = grouped.get(type);
    if (items.length) parts.push(`### ${title}\n\n${items.map((item) => `- ${item}`).join('\n')}`);
  }
  if (!SECTIONS.some(([type]) => grouped.get(type).length)) {
    parts.push('Maintenance release: no new features or fixes.');
  }
  parts.push(`**Full changelog**: https://github.com/${repo}/compare/${previousTag}...${tag}`);
  return `${parts.join('\n\n')}\n`;
}

function main(tag) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const previousTag = git('describe', '--tags', '--abbrev=0', '--match', 'v*', `${tag}^`);
  const lines = (text) => text.split('\n').filter(Boolean);
  process.stdout.write(
    releaseNotes({
      tag,
      previousTag,
      repo: 'Nillkabbo/create-adda',
      commits: lines(git('log', '--format=%s', `${previousTag}..${tag}`)),
      changedFiles: lines(git('diff', '--name-only', previousTag, tag)),
    }),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) {
    console.error('Usage: node scripts/release-notes.mjs <tag>');
    process.exit(1);
  }
  main(process.argv[2]);
}
