#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { parseArgs, styleText } from 'node:util';
import { TARGETS } from '../src/targets.js';
import { buildPlan, applyPlan, isPluginInstalled } from '../src/plan.js';
import { onPath } from '../src/paths.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const TARGET_IDS = Object.keys(TARGETS);

const USAGE = `Usage: create-adda [options]

Adda in Banglish, ship in English: your AI tools chat in Banglish, everything they ship stays English.
Run with no options for the interactive setup.

Options:
  --target <ids>          Comma-separated targets: ${TARGET_IDS.join(', ')}
  --scope <scope>         project, global, or plugin (Claude Code only). Default: plugin for
                          Claude when the claude CLI is installed, otherwise project
  -y, --yes               Skip the confirmation prompt
  --remove                Uninstall the rule from the chosen targets
  --print web             Print the web prompt only (pipe-friendly)
  --out <path>            Write the web prompt to a file instead of printing it
  -h, --help              Show this help
  -v, --version           Show the version
`;

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (format, text) => (useColor ? styleText(format, text) : text);

class UsageError extends Error {}

function parse(argv) {
  try {
    return parseArgs({
      args: argv,
      options: {
        target: { type: 'string' },
        scope: { type: 'string' },
        yes: { type: 'boolean', short: 'y' },
        remove: { type: 'boolean' },
        print: { type: 'string' },
        out: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    }).values;
  } catch (error) {
    throw new UsageError(error.message);
  }
}

function parseTargets(value) {
  const ids = value.split(',').map((id) => id.trim()).filter(Boolean);
  const unknown = ids.filter((id) => !TARGETS[id]);
  if (unknown.length) throw new UsageError(`Unknown target: ${unknown.join(', ')}`);
  if (!ids.length) throw new UsageError('--target needs at least one target.');
  return [...new Set(ids)];
}

const SCOPE_LABELS = {
  plugin: 'Plugin (recommended: auto-loads every session, toggle with /adda on|off)',
  project: 'This project (gitignored, only you)',
  global: 'Global (all your projects)',
};

function parseScope(value) {
  if (!SCOPE_LABELS[value]) {
    throw new UsageError(`--scope must be "project", "global", or "plugin", got "${value}".`);
  }
  return value;
}

const scopesOf = (id) => Object.keys(SCOPE_LABELS).filter((scope) => TARGETS[id][scope]);

// A requested scope the target lacks falls back to the target's own default (plugin → project).
function scopeFor(id, requested, hasClaude) {
  if (requested && TARGETS[id][requested]) return requested;
  if (requested && requested !== 'plugin') return requested;
  if (!requested && TARGETS[id].plugin && hasClaude) return 'plugin';
  return TARGETS[id].project ? 'project' : 'global';
}

async function promptChoices(env, hasClaude, remove) {
  const { checkbox, select } = await import('@inquirer/prompts');
  const targets = await checkbox({
    message: remove ? 'Remove Adda from which AI tools?' : 'Which AI tools should talk to you in Banglish?',
    choices: TARGET_IDS.map((id) => ({
      name: TARGETS[id].label,
      value: id,
      checked: Boolean(TARGETS[id].detect && existsSync(TARGETS[id].detect(env))),
    })),
    required: true,
  });
  const scopes = {};
  for (const id of targets) {
    const available = scopesOf(id);
    // Interactive removal clears every scope, like --remove without --scope.
    if (remove) scopes[id] = 'all';
    if (remove || available.length < 2) continue;
    scopes[id] = await select({
      message: `${TARGETS[id].label}: where should the rule live?`,
      default: scopeFor(id, undefined, hasClaude),
      choices: available.map((scope) => ({
        name: SCOPE_LABELS[scope],
        value: scope,
        disabled: scope === 'plugin' && !hasClaude ? '(claude CLI not found)' : false,
      })),
    });
  }
  return { targets, scopes };
}

// Show paths relative to cwd when inside it, else with ~ for home.
function display(path, env) {
  const rel = relative(env.cwd, path);
  if (!rel.startsWith('..')) return rel;
  return path.startsWith(env.home + sep) ? `~${path.slice(env.home.length)}` : path;
}

function describe(action, env) {
  if (action.type === 'print') return `${paint('cyan', 'print ')} ${action.title}`;
  if (action.type === 'exec') return `${paint('cyan', 'run   ')} ${[action.command, ...action.args].join(' ')}`;
  const where = display(action.path, env);
  if (action.type === 'delete') return `${paint('red', 'delete')} ${where}`;
  return existsSync(action.path)
    ? `${paint('yellow', 'update')} ${where}`
    : `${paint('green', 'create')} ${where}`;
}

function printBox(title, content) {
  const rule = '─'.repeat(60);
  console.log(`\n${paint('bold', title)}\n${rule}\n${content.trimEnd()}\n${rule}`);
}

async function main() {
  const flags = parse(process.argv.slice(2));
  if (flags.help) return void process.stdout.write(USAGE);
  if (flags.version) return void console.log(pkg.version);

  const home = homedir();
  const env = {
    cwd: process.cwd(),
    home,
    codexHome: process.env.CODEX_HOME || join(home, '.codex'),
    hermesHome: process.env.HERMES_HOME || join(home, '.hermes'),
  };

  if (flags.print !== undefined) {
    if (flags.print !== 'web') throw new UsageError('--print only supports "web".');
    const [action] = buildPlan({ targets: ['web'] }, env).actions;
    return void process.stdout.write(action.content);
  }

  const interactive = process.stdin.isTTY && process.stdout.isTTY;
  const hasClaude = onPath('claude');
  let choices;
  if (flags.target) {
    const targets = parseTargets(flags.target);
    const scope = flags.scope ? parseScope(flags.scope) : undefined;
    // Removing without --scope removes the target from every scope it can live in.
    const scopeOf = (id) => (flags.remove && !scope ? 'all' : scopeFor(id, scope, hasClaude));
    choices = { targets, scopes: Object.fromEntries(targets.map((id) => [id, scopeOf(id)])) };
  } else if (interactive) {
    console.log(paint('bold', `\ncreate-adda v${pkg.version}`));
    console.log('Adda in Banglish, ship in English.\n');
    choices = await promptChoices(env, hasClaude, flags.remove);
  } else {
    throw new UsageError('No TTY detected: pass --target (and --yes) to run non-interactively.');
  }
  if (Object.values(choices.scopes).includes('plugin') && !hasClaude) {
    throw new Error('claude CLI not found on PATH. Install Claude Code, or use --scope project or global.');
  }

  // Only ask claude when the answer can change the plan: Claude at a non-plugin scope.
  const pluginInstalled =
    hasClaude && choices.targets.includes('claude') && choices.scopes.claude !== 'plugin' && isPluginInstalled();
  const plan = buildPlan(
    {
      ...choices,
      remove: flags.remove,
      out: flags.out,
      marketplace: process.env.ADDA_MARKETPLACE || undefined,
    },
    { ...env, pluginInstalled },
  );
  if (!plan.actions.length) {
    plan.warnings.forEach((warning) => console.log(paint('yellow', `! ${warning}`)));
    return void console.log('Nothing to do.');
  }

  console.log(paint('bold', flags.remove ? '\nPlanned removal:' : '\nPlanned changes:'));
  plan.actions.forEach((action) => console.log(`  ${describe(action, env)}`));

  if (!flags.yes) {
    if (!interactive) throw new UsageError('Pass --yes to confirm in a non-interactive session.');
    const { confirm } = await import('@inquirer/prompts');
    if (!(await confirm({ message: 'Proceed?', default: true }))) return void console.log('Cancelled.');
  }

  applyPlan(plan);
  plan.actions
    .filter((action) => action.type === 'print')
    .forEach((action) => printBox(action.title, action.content));
  plan.warnings.forEach((warning) => console.log(paint('yellow', `! ${warning}`)));
  if (plan.actions.some((action) => action.type === 'exec' && action.args[1] === 'install')) {
    console.log(paint('bold', '\nRestart Claude Code (or run /clear) to activate the Adda plugin.'));
  }
  console.log(paint('green', '\nDone.'));
}

main().catch((error) => {
  if (error.name === 'ExitPromptError') process.exit(130);
  console.error(paint('red', `Error: ${error.message}`));
  if (error instanceof UsageError) console.error(`\n${USAGE}`);
  process.exit(1);
});
