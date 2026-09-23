import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function findGitRoot(start) {
  let dir = resolve(start);
  while (true) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
