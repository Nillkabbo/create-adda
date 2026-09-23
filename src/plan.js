import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import {
  upsertBlock,
  removeBlock,
  blockCreatedFile,
  addGitignoreLines,
  removeGitignoreLines,
} from './blocks.js';
import { TARGETS, rulesBody } from './targets.js';
import { findGitRoot } from './paths.js';

const readOrEmpty = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');
// Compare real paths: cwd is already resolved, while $HOME may go through a symlink.
const samePath = (a, b) => realpathSync(a) === realpathSync(b);

function resolveProjectDir(env) {
  const gitRoot = findGitRoot(env.cwd);
  const dir = gitRoot ?? env.cwd;
  if (samePath(dir, env.home)) {
    throw new Error(
      `Refusing to write project files into your home directory (${dir}). ` +
        'Run inside a project, or use --scope global.',
    );
  }
  return { dir, gitRoot };
}

function installActions(spec, path, body, options, env) {
  if (spec.kind === 'print' && spec.writable && options.out) {
    return [{ type: 'write', path: resolve(env.cwd, options.out), content: spec.render(body) }];
  }
  if (spec.kind === 'print') return [{ type: 'print', title: spec.title, content: spec.render(body) }];
  const content =
    spec.kind === 'block'
      ? upsertBlock(readOrEmpty(path), body, { createdFile: !existsSync(path) })
      : spec.render(body);
  return [{ type: 'write', path, content }];
}

function removeActions(spec, path, root) {
  if (spec.kind === 'print' || !existsSync(path)) return [];
  // Owned files may sit in folders we created (.cursor/rules); prune them up to the root if empty.
  if (spec.kind === 'file') return [{ type: 'delete', path, pruneUpTo: root }];
  const text = readOrEmpty(path);
  const stripped = removeBlock(text);
  if (stripped === text) return [];
  if (!stripped && blockCreatedFile(text)) return [{ type: 'delete', path }];
  return [{ type: 'write', path, content: stripped }];
}

function gitignoreActions(project, entries, remove) {
  const path = join(project.gitRoot, '.gitignore');
  const text = readOrEmpty(path);
  const next = remove ? removeGitignoreLines(text, entries) : addGitignoreLines(text, entries);
  if (next === text) return [];
  return next ? [{ type: 'write', path, content: next }] : [{ type: 'delete', path }];
}

export function buildPlan(options, env) {
  const actions = [];
  const warnings = [];
  const ignore = [];
  // Targets without a project scope are always global.
  const scopeOf = (id) =>
    TARGETS[id].project ? options.scopes?.[id] ?? 'project' : 'global';
  const project = options.targets.some((id) => scopeOf(id) === 'project')
    ? resolveProjectDir(env)
    : null;
  const body = rulesBody();

  for (const id of options.targets) {
    const scope = scopeOf(id);
    const spec = TARGETS[id][scope];
    const root = scope === 'project' ? project.dir : env.home;
    const path = spec.path?.(scope === 'project' ? project.dir : env);
    actions.push(
      ...(options.remove
        ? removeActions(spec, path, root)
        : installActions(spec, path, body, options, env)),
    );
    if (spec.gitignore) ignore.push(spec.gitignore);
    if (options.remove && spec.removeHint) warnings.push(spec.removeHint);
  }

  if (ignore.length && project.gitRoot) {
    actions.push(...gitignoreActions(project, ignore, options.remove));
  } else if (ignore.length && !options.remove) {
    warnings.push('Not a git repo: .gitignore skipped.');
  }
  return { actions, warnings };
}

export function applyPlan(plan) {
  for (const action of plan.actions) {
    if (action.type === 'write') {
      mkdirSync(dirname(action.path), { recursive: true });
      writeFileSync(action.path, action.content);
    } else if (action.type === 'delete') {
      rmSync(action.path, { force: true });
      if (action.pruneUpTo) pruneEmptyDirs(dirname(action.path), action.pruneUpTo);
    }
  }
}

function pruneEmptyDirs(dir, root) {
  const stop = resolve(root);
  let current = resolve(dir);
  while (current.startsWith(stop + sep) && readdirSync(current).length === 0) {
    rmdirSync(current);
    current = dirname(current);
  }
}
