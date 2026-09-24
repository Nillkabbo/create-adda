#!/usr/bin/env node
// UserPromptSubmit hook: handles `/banglish on|off|status` and injects the switch into the current session.
import { isEnabled, rules, setEnabled } from './state.mjs';

const OFF =
  'Banglish protocol is OFF (turned off by the developer with /banglish off). ' +
  'From now on, reply in English and ignore the earlier Banglish language protocol.';
const ON = 'Banglish protocol is ON (turned on by the developer with /banglish on). Follow it from now on:';

// `/banglish <arg>` or the namespaced `/banglish:banglish <arg>`; a bare command means status.
const COMMAND = /^\/banglish(?::banglish)?(?:\s+(\S+))?$/i;

function respond(arg) {
  switch (arg) {
    case 'off':
      setEnabled(false);
      return OFF;
    case 'on':
      setEnabled(true);
      return `${ON}\n\n${rules()}`;
    case 'status':
      return `Banglish protocol status: ${isEnabled() ? 'ON' : 'OFF'}.`;
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
