import { accessSync, constants, existsSync } from 'node:fs';
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

const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';

// Resolves a command on PATH like the shell would. On Windows, commands come with an extension
// from PATHEXT (claude.exe from the native installer, claude.cmd from npm) and every file counts.
export function findExecutable(
  command,
  { pathEnv = process.env.PATH ?? '', platform = process.platform, pathExt = process.env.PATHEXT } = {},
) {
  const windows = platform === 'win32';
  const extensions = windows ? (pathExt || DEFAULT_PATHEXT).split(';').filter(Boolean) : [''];
  const mode = windows ? constants.F_OK : constants.X_OK;
  for (const dir of pathEnv.split(windows ? ';' : ':').filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = join(dir, command + extension.toLowerCase());
      try {
        accessSync(candidate, mode);
        return candidate;
      } catch {
        // Not here; keep looking.
      }
    }
  }
  return null;
}

export const onPath = (command) => findExecutable(command) !== null;
