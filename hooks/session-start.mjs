#!/usr/bin/env node
// SessionStart hook: injects the Adda language protocol into every new, resumed, cleared, or compacted session.
import { isEnabled, rules } from './state.mjs';

if (isEnabled()) process.stdout.write(rules());
