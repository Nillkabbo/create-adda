#!/usr/bin/env node
// UserPromptSubmit hook: handles `/adda on|off|status` and injects the switch into the current session.
import { isEnabled, rules, setEnabled } from './state.mjs';

const OFF =
  'Adda is OFF (turned off by the developer with /adda off). ' +
  'From now on, reply in English and ignore the earlier Banglish language protocol.';
const ON = 'Adda is ON (turned on by the developer with /adda on). Follow it from now on:';

// `/adda <arg>` or the namespaced `/adda:adda <arg>`; a bare command means status.
const COMMAND = /^\/adda(?::adda)?(?:\s+(\S+))?$/i;

function respond(arg) {
  switch (arg) {
    case 'off':
      setEnabled(false);
      return OFF;
    case 'on':
      setEnabled(true);
      return `${ON}\n\n${rules()}`;
    case 'status':
      return `Adda status: ${isEnabled() ? 'ON' : 'OFF'}.`;
    default:
      return '';
  }
}

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  try {
    const match = String(JSON.parse(input).prompt ?? '').trim().match(COMMAND);
    if (match) process.stdout.write(respond((match[1] ?? 'status').toLowerCase()));
  } catch {
    // Never block the prompt over a hook problem.
  }
});
