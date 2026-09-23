#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { parseArgs, styleText } from 'node:util';
import { TARGETS } from '../src/targets.js';
import { buildPlan, applyPlan } from '../src/plan.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const TARGET_IDS = Object.keys(TARGETS);

const USAGE = `Usage: create-banglish-agent [options]

Install a "Banglish in chat, English in everything shipped" rule into your AI tools.
Run with no options for the interactive setup.

Options:
  --target <ids>          Comma-separated targets: ${TARGET_IDS.join(', ')}
  --scope project|global  Scope for targets that support both (default: project)
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

function parseScope(value) {
  if (value !== 'project' && value !== 'global') {
    throw new UsageError(`--scope must be "project" or "global", got "${value}".`);
  }
  return value;
}

async function promptChoices(env) {
  const { checkbox, select } = await import('@inquirer/prompts');
  const targets = await checkbox({
    message: 'Which AI tools should talk to you in Banglish?',
    choices: TARGET_IDS.map((id) => ({
      name: TARGETS[id].label,
      value: id,
      checked: Boolean(TARGETS[id].detect && existsSync(TARGETS[id].detect(env))),
    })),
    required: true,
  });
  const scopes = {};
  for (const id of targets) {
    if (!TARGETS[id].project || !TARGETS[id].global) continue;
    scopes[id] = await select({
      message: `${TARGETS[id].label}: where should the rule live?`,
      choices: [
        { name: 'This project (gitignored, only you)', value: 'project' },
        { name: 'Global (all your projects)', value: 'global' },
      ],
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
  const env = { cwd: process.cwd(), home, codexHome: process.env.CODEX_HOME || join(home, '.codex') };

  if (flags.print !== undefined) {
    if (flags.print !== 'web') throw new UsageError('--print only supports "web".');
    const [action] = buildPlan({ targets: ['web'] }, env).actions;
    return void process.stdout.write(action.content);
  }

  const interactive = process.stdin.isTTY && process.stdout.isTTY;
  let choices;
  if (flags.target) {
    const targets = parseTargets(flags.target);
    const scope = flags.scope ? parseScope(flags.scope) : 'project';
    choices = { targets, scopes: Object.fromEntries(targets.map((id) => [id, scope])) };
  } else if (interactive) {
    console.log(paint('bold', `\ncreate-banglish-agent v${pkg.version}`));
    console.log('Banglish in chat, English in everything shipped.\n');
    choices = await promptChoices(env);
  } else {
    throw new UsageError('No TTY detected: pass --target (and --yes) to run non-interactively.');
  }

  const plan = buildPlan({ ...choices, remove: flags.remove, out: flags.out }, env);
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
  console.log(paint('green', '\nDone.'));
}

main().catch((error) => {
  if (error.name === 'ExitPromptError') process.exit(130);
  console.error(paint('red', `Error: ${error.message}`));
  if (error instanceof UsageError) console.error(`\n${USAGE}`);
  process.exit(1);
});
