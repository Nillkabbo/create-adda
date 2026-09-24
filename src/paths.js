import { accessSync, constants, existsSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';

export function findGitRoot(start) {
  let dir = resolve(start);
  while (true) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function onPath(command, pathEnv = process.env.PATH ?? '') {
  return pathEnv
    .split(delimiter)
    .filter(Boolean)
    .some((dir) => {
      try {
        accessSync(join(dir, command), constants.X_OK);
        return true;
      } catch {
        return false;
      }
    });
}
