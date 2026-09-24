import { spawnSync } from 'node:child_process';
import { parseStream } from './stream.mjs';

// Runs one `claude -p` call with the rule appended to the system prompt and returns the parsed stream.
export function claude({ model, rules, prompt, cwd, tools, session }) {
  const args = [
    '-p',
    '--safe-mode',
    '--output-format', 'stream-json',
    '--verbose',
    '--model', model,
    '--append-system-prompt', rules,
    '--permission-mode', 'bypassPermissions',
    ...(tools === undefined ? [] : ['--tools', tools]),
    ...(session?.resume ? ['--resume', session.id] : session ? ['--session-id', session.id] : ['--no-session-persistence']),
  ];
  const result = spawnSync('claude', args, {
    cwd,
    input: prompt,
    encoding: 'utf8',
    timeout: 240_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) return { error: result.error.message };
  return parseStream(result.stdout ?? '');
}
