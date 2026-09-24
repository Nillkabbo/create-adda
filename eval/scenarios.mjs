import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const git = (dir, ...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });

function initRepo(dir) {
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'eval@example.com');
  git(dir, 'config', 'user.name', 'Eval');
  git(dir, 'config', 'commit.gpgsign', 'false');
  writeFileSync(join(dir, 'notes.txt'), 'first line\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'chore: initial commit');
}

function initProject(dir) {
  writeFileSync(join(dir, 'package.json'), '{ "name": "demo-app", "version": "1.0.0" }\n');
  writeFileSync(join(dir, 'index.js'), 'export const add = (a, b) => a + b;\n');
}

function readFiles(dir, skip = new Set(['.git'])) {
  return readdirSync(dir)
    .filter((name) => !skip.has(name))
    .map((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? readFiles(path, skip) : readFileSync(path, 'utf8');
    })
    .join('\n');
}

// Each scenario: a prompt, optional setup, and `collect`, which returns the text to judge
// (or null when the model never produced the artifact, reported as n/a).
//   kind 'leak': the collected text must be English.
//   kind 'chat': the collected text must be Banglish in Latin letters.
export const SCENARIOS = [
  {
    id: 'commit',
    kind: 'leak',
    prompt: 'notes.txt e ekta notun line add koro, tarpor change ta commit koro.',
    setup: initRepo,
    collect: ({ dir }) => {
      const message = git(dir, 'log', '-1', '--format=%B').trim();
      return message === 'chore: initial commit' ? null : message;
    },
  },
  {
    id: 'code-comment',
    kind: 'leak',
    prompt: 'even.js file e ekta isEven function likho, comment shoho.',
    collect: ({ dir }) => readFiles(dir) || null,
  },
  {
    id: 'subagent',
    kind: 'leak',
    prompt: 'Ekta subagent (Agent tool) use kore ei folder er file gulo list koro, tarpor amake bolo ki pele.',
    collect: ({ parsed }) => {
      const calls = parsed.tools.filter((tool) => ['Agent', 'Task'].includes(tool.name));
      if (!calls.length) return null;
      return calls.map((call) => `${call.input.description ?? ''}\n${call.input.prompt ?? ''}`).join('\n');
    },
  },
  {
    id: 'file',
    kind: 'leak',
    prompt: 'README.md file e ei project er jonno 3 line er ekta description likho. File ta disk e save korte hobe.',
    setup: initProject,
    collect: ({ dir }) => (existsSync(join(dir, 'README.md')) ? readFileSync(join(dir, 'README.md'), 'utf8') : null),
  },
  {
    id: 'chat-control',
    kind: 'chat',
    tools: '',
    prompt: 'Explain what a closure is in JavaScript in two sentences.',
    collect: ({ parsed }) => parsed.chat || null,
  },
  {
    id: 'bengali-input',
    kind: 'chat',
    tools: '',
    prompt: 'closure কী? দুই লাইনে বলো।',
    collect: ({ parsed }) => parsed.chat || null,
  },
];

// Multi-turn drift check: same session, English questions, chat checked at these turns.
export const DRIFT_TURNS = [
  'What is a closure in JavaScript? Two sentences.',
  'Give me a one-line example.',
  'What is the difference between let and const?',
  'When should I use a Map instead of an object?',
  'Explain what a promise is in short.',
  'What does async/await add on top of promises?',
  'How do I cancel a fetch request?',
  'Summarize the last three answers in two sentences.',
];
export const DRIFT_CHECKPOINTS = [1, 4, 8];
