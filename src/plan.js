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
import { spawnSync } from 'node:child_process';
import {
  upsertBlock,
  removeBlock,
  blockCreatedFile,
  addGitignoreLines,
  removeGitignoreLines,
} from './blocks.js';
import {
  TARGETS,
  rulesBody,
  PLUGIN_ID,
  MARKETPLACE_NAME,
  DEFAULT_MARKETPLACE,
  PLUGIN_SPARSE_PATHS,
} from './targets.js';
import { findExecutable, findGitRoot } from './paths.js';
import { renderRules } from './preferences.mjs';

const readOrEmpty = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');
// Compare real paths: cwd is already resolved, while $HOME may go through a symlink.
// A path that does not exist cannot be a symlink, so compare it as written.
const real = (path) => (existsSync(path) ? realpathSync(path) : resolve(path));
const samePath = (a, b) => real(a) === real(b);

function assertHomeExists(path, home) {
  if (path.startsWith(resolve(home)) && !existsSync(home)) {
    throw new Error(`Home directory not found: ${home}. Check that $HOME (or %USERPROFILE%) is set correctly.`);
  }
}

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

// Whether an already added marketplace (an entry from `claude plugin marketplace list --json`)
// comes from `source`.
function sameMarketplaceSource(existing, source, isLocal, cwd) {
  if (isLocal) return existing.source === 'directory' && samePath(existing.path, resolve(cwd, source));
  return existing.source === 'github' && existing.repo?.toLowerCase() === source.toLowerCase();
}

function pluginInstallActions(options, env) {
  const source = options.marketplace ?? DEFAULT_MARKETPLACE;
  // `claude` rejects --sparse for directory sources; it only applies to git checkouts.
  const isLocal = /^([./~]|[A-Za-z]:\\)/.test(source);
  const sparse = isLocal ? [] : ['--sparse', ...PLUGIN_SPARSE_PATHS];
  // Claude Code refuses to add a marketplace again when its declared source differs in any field
  // (older versions of this tool declared more sparse paths), so a known one is only updated.
  // One from another source is still added, and claude's error names the clash.
  const known = env.marketplace && sameMarketplaceSource(env.marketplace, source, isLocal, env.cwd);
  return [
    known
      ? { type: 'exec', command: 'claude', args: ['plugin', 'marketplace', 'update', MARKETPLACE_NAME] }
      : { type: 'exec', command: 'claude', args: ['plugin', 'marketplace', 'add', source, ...sparse] },
    { type: 'exec', command: 'claude', args: ['plugin', 'install', PLUGIN_ID, '--scope', 'user'] },
    // `install` leaves an installed plugin on its old version; `update` moves it to the new tag.
    ...(known ? [{ type: 'exec', command: 'claude', args: ['plugin', 'update', PLUGIN_ID] }] : []),
  ];
}

// The plugin injects the rules itself, so Claude marker blocks would load them twice.
function duplicateBlockCleanup(env) {
  const claude = TARGETS.claude;
  const actions = removeActions(claude.global, claude.global.path(env), env.home);
  let project;
  try {
    project = resolveProjectDir(env);
  } catch {
    return actions; // cwd is $HOME: there is no project file to clean up.
  }
  const local = removeActions(claude.project, claude.project.path(project.dir), project.dir);
  actions.push(...local);
  if (project.gitRoot && local.some((action) => action.type === 'delete')) {
    actions.push(...gitignoreActions(project, [claude.project.gitignore], true));
  }
  return actions;
}

function installActions(spec, path, body, options, env) {
  // Cleanup runs after the commands, so a failed install leaves the existing rules in place.
  if (spec.kind === 'plugin') return [...pluginInstallActions(options, env), ...duplicateBlockCleanup(env)];
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

const uninstallPluginAction = () => ({ type: 'exec', command: 'claude', args: ['plugin', 'uninstall', PLUGIN_ID] });

// Asks the claude CLI for the adda marketplace entry; null when it is absent or cannot be determined.
export function findMarketplace(run = runCommand) {
  const { code, stdout } = run('claude', ['plugin', 'marketplace', 'list', '--json']);
  if (code !== 0) return null;
  try {
    return JSON.parse(stdout).find((marketplace) => marketplace.name === MARKETPLACE_NAME) ?? null;
  } catch {
    return null;
  }
}

// Asks the claude CLI whether the plugin is installed; false when that cannot be determined.
export function isPluginInstalled(run = runCommand) {
  const { code, stdout } = run('claude', ['plugin', 'list', '--json']);
  if (code !== 0) return false;
  try {
    return JSON.parse(stdout).some((plugin) => plugin.id === PLUGIN_ID);
  } catch {
    return false;
  }
}

function removeActions(spec, path, root) {
  if (spec.kind === 'plugin') return [uninstallPluginAction()];
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

const SCOPES = ['project', 'global', 'plugin'];

export function buildPlan(options, env) {
  const actions = [];
  const warnings = [];
  const ignore = [];
  // Targets without a project scope are always global. `all` (remove only) expands to every
  // scope the target has; the plugin only when it is installed.
  const scopesOf = (id) => {
    const target = TARGETS[id];
    const requested = options.scopes?.[id];
    if (requested === 'all') {
      return SCOPES.filter((scope) => target[scope] && (scope !== 'plugin' || env.pluginInstalled));
    }
    return [target.project ? requested ?? 'project' : 'global'];
  };
  const wanted = options.targets.map((id) => [id, scopesOf(id)]);

  // An explicit project scope must resolve (and refuses $HOME); `all` just skips the project then.
  let project = null;
  if (wanted.some(([, scopes]) => scopes.includes('project'))) {
    const explicit = wanted.some(([id, scopes]) => scopes.includes('project') && options.scopes?.[id] !== 'all');
    try {
      project = resolveProjectDir(env);
    } catch (error) {
      if (explicit) throw error;
    }
  }
  const body = renderRules(rulesBody(), env.preferences).trim();

  for (const [id, scopes] of wanted) {
    for (const scope of scopes) {
      if (scope === 'project' && !project) continue;
      const spec = TARGETS[id][scope];
      const root = scope === 'project' ? project.dir : env.home;
      const path = spec.path?.(scope === 'project' ? project.dir : env);
      if (scope === 'global' && path && !options.remove) {
        assertHomeExists(path, env.home);
        if (spec.requireExisting && !existsSync(path)) throw new Error(spec.missingFileError(path));
      }
      actions.push(
        ...(options.remove
          ? removeActions(spec, path, root)
          : installActions(spec, path, body, options, env)),
      );
      // Moving Claude to a block scope retires the plugin, just as installing the plugin
      // retires the blocks: the rules must never load twice.
      if (!options.remove && TARGETS[id].plugin && scope !== 'plugin' && env.pluginInstalled) {
        actions.push(uninstallPluginAction());
      }
      if (spec.gitignore) ignore.push(spec.gitignore);
      if (options.remove && spec.removeHint) warnings.push(spec.removeHint);
    }
  }

  if (ignore.length && project.gitRoot) {
    actions.push(...gitignoreActions(project, ignore, options.remove));
  } else if (ignore.length && !options.remove) {
    warnings.push('Not a git repo: .gitignore skipped.');
  }
  return { actions, warnings };
}

const shellQuote = (arg) => (/[\s"&|<>^]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg);

function runCommand(command, args) {
  const resolved = findExecutable(command) ?? command;
  // Windows runs .cmd/.bat files (npm-installed claude) only through the shell.
  const result = /\.(cmd|bat)$/i.test(resolved)
    ? spawnSync([resolved, ...args].map(shellQuote).join(' '), { shell: true, encoding: 'utf8' })
    : spawnSync(resolved, args, { encoding: 'utf8' });
  return {
    code: result.error ? 1 : result.status,
    stdout: result.stdout ?? '',
    stderr: result.error?.message ?? result.stderr,
  };
}

export function applyPlan(plan, { run = runCommand } = {}) {
  for (const action of plan.actions) {
    if (action.type === 'exec') {
      const { code, stderr } = run(action.command, action.args);
      if (code !== 0) {
        const command = [action.command, ...action.args].join(' ');
        throw new Error(`Command failed: ${command}\n${stderr.trim()}\nRun it by hand, then re-run this tool.`);
      }
      continue;
    }
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
