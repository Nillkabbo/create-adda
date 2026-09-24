import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseNotes } from '../scripts/release-notes.mjs';

const base = { tag: 'v0.6.0', previousTag: 'v0.5.1', repo: 'Nillkabbo/create-adda', changedFiles: ['src/plan.js'] };

test('features and fixes are grouped, and everything else is left out', () => {
  const notes = releaseNotes({
    ...base,
    commits: [
      '0.6.0',
      'test(prefs): accept Windows path separators in refresh output',
      'feat(prefs): refresh installed rules when preferences change',
      'fix(plugin): resolve both marketplace paths against the same cwd',
      'docs: add a scripted demo GIF to the README',
      'chore(release): v0.5.1',
      'feat!: drop Node 18',
    ],
  });
  assert.equal(
    notes,
    '### New\n\n- Refresh installed rules when preferences change\n- Drop Node 18\n\n' +
      '### Fixes\n\n- Resolve both marketplace paths against the same cwd\n\n' +
      '**Full changelog**: https://github.com/Nillkabbo/create-adda/compare/v0.5.1...v0.6.0\n',
  );
});

test('a changed developer Rule opens the notes with how to refresh installed rules', () => {
  const notes = releaseNotes({ ...base, changedFiles: ['src/rules.md'], commits: ['fix: tighten the Rule'] });
  assert.ok(notes.startsWith('> [!IMPORTANT]\n> The Rule changed in this release.'));
  assert.match(notes, /`npx create-adda --prefs`/);
  assert.match(notes, /`claude plugin update adda@adda`/);
});

test('changed everyday texts get their own callout, with no link to the unlisted site', () => {
  const notes = releaseNotes({ ...base, changedFiles: ['src/profiles/everyday/base.md'], commits: ['fix: x'] });
  assert.match(notes, /> \[!NOTE\]\n> The everyday texts changed/);
  assert.doesNotMatch(notes, /github\.io/);
  assert.doesNotMatch(notes, /\[!IMPORTANT\]/);
});

test('a release with no user-facing commits still says so and links the changes', () => {
  const notes = releaseNotes({ ...base, commits: ['docs: typo', '0.6.1'] });
  assert.equal(
    notes,
    'Maintenance release: no new features or fixes.\n\n' +
      '**Full changelog**: https://github.com/Nillkabbo/create-adda/compare/v0.5.1...v0.6.0\n',
  );
});
