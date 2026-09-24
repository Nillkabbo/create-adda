# Spec: `create-adda` v1

## Purpose

An `npx`-runnable CLI that installs a personal language rule into a developer's AI coding tools:
**talk to me in Banglish, write everything that ships in English.**

The rule is a personal communication layer. It is installed per developer (gitignored or global), never pushed onto teammates through shared, committed files.

## Targets

Targets live in a registry. Each target is one object describing its label, supported scopes, destination path, file format, and gitignore behaviour. Adding a target is a registry entry plus tests.

| Target | Project scope | Global scope |
|---|---|---|
| Claude Code | `<git-root>/CLAUDE.local.md`, marker block, gitignored | `~/.claude/CLAUDE.md`, marker block |
| Cursor | `<git-root>/.cursor/rules/adda.mdc` (owned file, `alwaysApply: true`), gitignored | print paste instructions for Settings → Rules → User Rules |
| Codex CLI | — | `$CODEX_HOME/AGENTS.md` (default `~/.codex/AGENTS.md`), marker block |
| Gemini CLI | — | `~/.gemini/GEMINI.md`, marker block |
| Web (ChatGPT / Claude.ai / Gems) | — | print prompt to stdout; `--out <path>` writes a file instead |

Claude Code also has a third scope, `plugin`, which is its default when the `claude` CLI is installed (see [ADR 0001](adr/0001-plugin-is-the-default-claude-code-delivery.md) and the plugin section below).

Excluded on purpose: `.cursorrules` (deprecated), project `AGENTS.md` / `GEMINI.md` / `.github/copilot-instructions.md` (shared, committed files).

## Rule content

One canonical source: `src/rules.md`. Each target wraps it:

- Marker-block targets: body between `<!-- adda:start -->` and `<!-- adda:end -->`.
- Cursor: `.mdc` frontmatter (`description`, `alwaysApply: true`) + body.
- Web: one-line role header + body.

The body covers:

- **Chat language**: Banglish (Bengali in Latin script), casual peer tone, technical terms kept in English. Never Bengali script unless asked.
- **Output language**: everything that leaves the chat is standard professional English: source code, identifiers, comments, commits, PR titles/bodies, docs, logs, error messages, file names, any file written to disk.
- **Code in chat**: English inside code/terminal blocks, Banglish explanation around them.
- **Escape hatch**: Banglish by default regardless of the developer's input language; switch to English only on explicit request, until asked to switch back.
- **Applicability and precedence**:
  - Applies to every reply shown to the developer, including while a skill, plugin, or slash command is active.
  - Skills/plugins decide content, format, and length; this rule decides chat language (a "terse" style plugin → terse Banglish).
  - Subagent prompts, subagent reports, and inter-agent messages stay English; translate only in the final reply to the developer.
  - Questions and options shown to the developer are chat → Banglish.

## File handling

- **Marker block upsert**: if the block exists, replace its contents; otherwise append it (separated by a blank line); if the file is missing, create it (and parent directories).
- **Owned files** (`adda.mdc`): written whole.
- **Re-running** the CLI is the update path: blocks and owned files are refreshed from the current `rules.md`.
- **`--remove`**: strip marker blocks (delete the file if nothing but whitespace remains), delete owned files, remove the gitignore block lines.
- **Project scope location**: walk up from `cwd` to the nearest `.git` root and write there. No git root → write to `cwd` and warn that `.gitignore` was skipped. Refuse project scope when the resolved directory is `$HOME`; suggest `--scope global`.
- **`.gitignore`**: only inside a git repo. Add a `# adda` section containing only the lines for chosen project-scope targets, never duplicating existing lines. Create `.gitignore` if missing. `--remove` deletes those lines and the section header.

## CLI flow

Interactive (TTY):

1. Multi-select targets. Pre-check tools whose config folder exists (`~/.claude`, `~/.cursor`, `~/.codex`, `~/.gemini`); Web unchecked. At least one required.
2. For each chosen target with more than one scope: select `Plugin` / `This project` / `Global (all projects)`. Plugin is Claude Code only and is disabled when the `claude` CLI is not on `PATH`. Global-only targets skip this. With `--remove`, this step is skipped and every scope is cleared.
3. Print a summary of planned actions (create / update block / write / delete / print, with paths).
4. One `Proceed? (Y/n)` confirm, then apply.

Flags:

| Flag | Meaning |
|---|---|
| `--target <ids>` | Comma-separated: `claude,cursor,codex,gemini,web` |
| `--scope project\|global\|plugin` | Scope for targets that support it (`plugin` is Claude Code only). Default: `plugin` for Claude when the `claude` CLI is on `PATH`, otherwise `project`; global-only targets always use `global` |
| `--yes`, `-y` | Skip the confirm |
| `--remove` | Uninstall instead of install. Without `--scope`, removes the target from every scope it can live in |
| `--print web` | Print the web prompt only; pipe-friendly, no banner |
| `--out <path>` | Web target writes to this file instead of stdout |
| `--help`, `-h` / `--version`, `-v` | Usage / version |

No TTY and no `--target` → exit with a usage error (code 1) instead of hanging. No TTY and no `--yes` → exit with a usage error instead of applying unconfirmed changes.

Environment variables: `ADDA_MARKETPLACE` (plugin marketplace source override), `CODEX_HOME` (Codex config directory), `NO_COLOR` (disable colors).

## Architecture

- `bin/cli.js`: thin shell. Parses args, prompts, prints the plan, confirms, applies.
- `src/rules.md`: canonical rule body.
- `src/blocks.js`: pure string functions (`upsertBlock`, `removeBlock`, `blockCreatedFile`, gitignore add/remove).
- `src/targets.js`: target registry and per-target rendering.
- `src/plan.js`:
  - `buildPlan(options, env)` builds a list of actions from choices and the environment (`cwd`, `home`, `codexHome`, `pluginInstalled`). It reads files but never writes. Action types: `write`, `delete`, `exec`, `print`.
  - `applyPlan(plan, { run })` executes the actions; `run` is an injectable command runner.
  - `isPluginInstalled()` asks `claude plugin list --json`. The `$HOME` guard also lives here.
- `src/paths.js`: git root lookup, executable lookup on `PATH` (Windows `PATHEXT` aware).
- `hooks/`, `commands/`: the Claude Code plugin runtime (see below).

## Stack

- ESM (`"type": "module"`), Node `>=20.17`.
- Single runtime dependency: `@inquirer/prompts`. Colors via `node:util` `styleText`.
- `"files": ["bin", "src"]`; MIT license; `package.json` is the version source.

## Testing

- `node:test`, no test dependencies. `npm test` → `node --test`.
- Unit tests on pure string functions and the planner.
- Integration tests run plan + apply in a temp directory with `HOME` / `CODEX_HOME` pointed at temp directories; never touch the real home directory.
- End-to-end test of the flag path (`--target … --scope … --yes`) by spawning `bin/cli.js`. The interactive prompt UI is not tested.

## Done criteria

- `npm test` passes.
- Local run via `npm link` in a scratch git repo works.
- `npm pack --dry-run` ships only `bin/`, `src/`, `README.md`, `LICENSE`, `package.json`.
- Publishing is done manually by the author.

## Claude Code plugin (v0.2.0)

The repo is also a Claude Code marketplace (`adda`) whose plugin (`adda`) lives at the repo root (`source: "./"`). The plugin hooks read `src/rules.md`, so the npm tool and the plugin share one rule source.

- `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`.
- `hooks/session-start.mjs` (SessionStart: startup, resume, clear, compact): when enabled, prints the rules as context; when disabled, prints nothing.
- `hooks/prompt-submit.mjs` (UserPromptSubmit): handles `/adda on|off|status`, persists `~/.claude/adda.json` (`{ "enabled": boolean }`, missing file = enabled), and injects immediate context: `on` re-injects the rules, `off` switches the session to English, `status` reports the state. Other prompts produce no output.
- `commands/adda.md`: `/adda` autocomplete; the model confirms the new state in one line.
- Hooks are `.mjs` and use only Node built-ins: the plugin checkout is sparse (no `package.json`, no `node_modules`).

### Installer integration

- Claude target gains a `plugin` scope, the default when `claude` is on `PATH`; `--scope plugin` on the command line.
- Install plans `exec` actions: `claude plugin marketplace add Nillkabbo/create-adda --sparse .claude-plugin`, then `claude plugin install adda@adda --scope user`. `ADDA_MARKETPLACE` overrides the source; a local directory source is added without `--sparse`, which only git sources support.
- Install then strips any Claude marker block from `<project>/CLAUDE.local.md` and `~/.claude/CLAUDE.md` (and the matching `.gitignore` line) to avoid duplicate rules. The cleanup runs after the commands, so a failed install leaves the existing rules in place.
- The reverse holds too: moving Claude to a block scope while the plugin is installed plans `claude plugin uninstall adda@adda`. The rules never load twice.
- Remove plans `claude plugin uninstall adda@adda`; the marketplace entry stays.
- `applyPlan` takes an injected command runner. A failing `exec` stops the run and prints the command to run by hand; completed file changes are not rolled back.
- After a plugin install, print a hint to restart Claude Code or run `/clear`.

### Releases

- `package.json` is the single version source. `scripts/sync-version.mjs` (run by the npm `version` lifecycle script) writes it into `.claude-plugin/plugin.json` and points the marketplace's plugin source at `{ source: "github", repo: "Nillkabbo/create-adda", ref: "v<version>" }`.
- The marketplace checkout is sparse (`.claude-plugin` only); the plugin code comes from the release tag, so pushes to `main` never reach plugin users.
- `test/release.test.js` fails when the manifests drift from `package.json`; CI also checks that a pushed `v*` tag matches it.

## Deferred

- More targets (Windsurf, etc.).

## Evaluation

`npm test` covers the code. Whether models actually follow the rule is measured separately by a live eval, `npm run eval`, which runs real models through `claude -p` (costs tokens, non-deterministic, never part of CI).

- Each run uses `--safe-mode` with the rule passed through `--append-system-prompt`, so the developer's own plugins, hooks, and `CLAUDE.md` cannot load the rule a second time.
- Scenarios (`eval/scenarios.mjs`): commit message, code comment, subagent prompt, file on disk (must be English), chat control, and Bengali-script input (chat must be Banglish in Latin letters). Every scenario also fails on Bengali script anywhere in the chat.
- Detection is deterministic: a Bengali-script regex plus whole-word marker lists in `test/fixtures/banglish-markers.json`. Edit the lists when a false positive shows up.
- `--rules <path|git:ref>` (repeatable) compares rule variants, `--model` and `--runs` set models and repetitions, `--drift` runs an 8-turn session and checks chat at turns 1, 4, and 8.
- A rule that is missing from the prompt fails the chat scenarios, so a pass means the rule was followed, not that it was ignored.
- Rule wording changes ship only when the eval shows no regression. Offline, `test/rules-lint.test.js` guards the word budget, Bengali-script use, and the example count.
