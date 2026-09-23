import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

// Isolated sandbox: a fake home, a fake CODEX_HOME, and a git repo with a nested cwd.
export function sandbox() {
  const root = mkdtempSync(join(tmpdir(), 'banglish-agent-'));
  const home = join(root, 'home');
  const repo = join(root, 'repo');
  const cwd = join(repo, 'src', 'components');
  mkdirSync(home, { recursive: true });
  mkdirSync(join(repo, '.git'), { recursive: true });
  mkdirSync(cwd, { recursive: true });
  const env = { cwd, home, codexHome: join(home, '.codex') };
  return { root, home, repo, cwd, env };
}

export const read = (path) => readFileSync(path, 'utf8');
export const exists = (path) => existsSync(path);
export function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
