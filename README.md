# Adda

**Adda in Banglish, ship in English.**

*Adda* (আড্ডা) is the Bengali habit of long, relaxed conversation with friends. This tool makes your AI coding tools **talk to you like that, in Banglish**, while **everything they ship stays in English**: code, comments, commits, PRs, docs, and any file written to disk.

```bash
npx create-adda
```

![Installing Adda, then Claude Code explains a fix in Banglish and commits it in English](docs/demo.gif)

The interactive setup asks which tools to configure, where the rule should live, shows every planned change, and asks once before writing anything.

## What it installs

| Tool | Project scope | Global scope |
|---|---|---|
| Claude Code | `CLAUDE.local.md` at the git root (gitignored) | `~/.claude/CLAUDE.md`, or the **Adda plugin** (default when `claude` is installed) |
| Cursor | `.cursor/rules/adda.mdc` at the git root (gitignored) | Prints text to paste into Settings → Rules → User Rules |
| GitHub Copilot (VS Code) | `.github/instructions/adda.instructions.md` at the git root (gitignored) | `~/.copilot/instructions/adda.instructions.md` |
| Codex CLI | — | `$CODEX_HOME/AGENTS.md` (default `~/.codex/AGENTS.md`) |
| Gemini CLI | — | `~/.gemini/GEMINI.md` |
| Hermes Agent | — | `$HERMES_HOME/SOUL.md` (default `~/.hermes/SOUL.md`); run Hermes once first so it creates this file |
| Web AI (ChatGPT, Claude.ai, Gemini) | — | Prints a prompt to paste into custom instructions |

> **Cursor (limited):** the rule installs and Cursor loads it, but Cursor's Auto model (the only one on free plans) didn't follow it in our tests and kept replying in English. Named models on paid plans are untested.
>
> **GitHub Copilot (tested with GPT-4.1, the free-tier default):** Adda writes its own instructions file and never touches the shared `.github/copilot-instructions.md`. VS Code also loads `~/.claude/CLAUDE.md` and `CLAUDE.local.md` into Copilot Chat, so if you installed Claude Code at project or global scope, VS Code already has the rule and this target only adds a second copy of the same text. The Claude Code plugin writes no `CLAUDE.md` block, so plugin users need this target.
>
> **Web AI (ChatGPT tested):** ChatGPT followed the prompt when it was pasted as the first message of a chat: Banglish replies, English code, English on request. Pasting it into Custom Instructions (the intended setup) and the Claude.ai and Gemini web apps are untested.
>
> Claude Code, GitHub Copilot, Codex CLI, Gemini CLI, and Hermes Agent are tested live: they chat in Banglish while files and commits stay English.

The rule is personal. Project files are gitignored and never pushed onto teammates.

Shared files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, Hermes's `SOUL.md`) are never overwritten. The rule goes inside a marked block and the rest of the file is left untouched:

```markdown
<!-- adda:start -->
...
<!-- adda:end -->
```

Running the tool again refreshes the block to the latest rules. `--remove` takes it out and leaves the file exactly as it was before the install.

## Claude Code plugin

For Claude Code, the default is a plugin instead of a `CLAUDE.md` block. The plugin loads the rules into every session, including after `/clear` and context compaction, and adds a toggle:

| Command | Effect |
|---|---|
| `/adda off` | English from the next reply on, and in every new session |
| `/adda on` | Back to Banglish, immediately and in new sessions |
| `/adda status` | Show the current state |

The state lives in `~/.claude/adda.json`. Installing the plugin removes any Banglish block from `CLAUDE.local.md` and `~/.claude/CLAUDE.md` so the rules are never loaded twice.

Install it without the CLI:

```bash
claude plugin marketplace add Nillkabbo/create-adda
claude plugin install adda@adda --scope user
```

## The rule

- Chat in Banglish (Bengali in Latin script), technical terms kept in English, never Bengali script unless you choose it. Quoted Bengali-script text stays in quotes or code spans.
- Everything that leaves the chat is professional English.
- Banglish by default; switches to English only when you ask, until you ask to switch back.
- Works alongside skills and plugins: they decide content, format, and length; this rule decides chat language. Subagent and inter-agent messages stay in English.

Full text: [`src/rules.md`](src/rules.md).

## Your preferences

Adda's default is Banglish in Latin letters with a casual peer tone. You can change that once and every tool follows it:

```bash
npx create-adda --script bengali   # chat in Bangla script instead of Latin letters
npx create-adda --tone formal      # "apni" instead of "tumi"
npx create-adda --prefs            # show what is saved and where
```

Anything else goes in your own rule file, `~/.config/adda/custom.md` (or `$XDG_CONFIG_HOME/adda/custom.md`). For example:

```markdown
- Keep every reply under five lines.
- Call me "bhai".
```

Your preferences are added after Adda's rules and win wherever the two conflict. Shipped output (code, commits, docs) always stays English.

The Claude Code plugin reads them at the start of every session. For the other tools, re-run the install (for example `npx create-adda --target codex,gemini,hermes --yes`) to refresh their blocks. The interactive setup also asks for script and tone.

## Options

| Flag | Meaning |
|---|---|
| `--target <ids>` | Comma-separated: `claude`, `cursor`, `copilot`, `codex`, `gemini`, `hermes`, `web` |
| `--scope project\|global\|plugin` | Where the rule lives. `plugin` is Claude Code only. Default: `plugin` for Claude when `claude` is installed, otherwise `project` |
| `-y`, `--yes` | Skip the confirmation prompt |
| `--remove` | Uninstall from the chosen targets |
| `--print web` | Print only the web prompt, for piping |
| `--out <path>` | Write the web prompt to a file instead of printing it |
| `--script latin\|bengali` | Chat script, saved for later runs (default `latin`) |
| `--tone casual\|formal` | Chat tone, saved for later runs (default `casual`; `formal` uses "apni") |
| `--prefs` | Show your saved preferences and where they live |
| `-h`, `--help` / `-v`, `--version` | Usage / version |

Examples:

```bash
# Global setup for Claude Code, Codex, Gemini CLI, and Hermes Agent
npx create-adda --target claude,codex,gemini,hermes --scope global --yes

# Copy the web prompt to the clipboard (macOS)
npx create-adda --print web | pbcopy

# Undo a project install
npx create-adda --remove --target claude,cursor --scope project --yes

# Uninstall the Claude Code plugin
npx create-adda --remove --target claude --scope plugin --yes
```

`--remove` without `--scope` removes the rule from every place it can live: for Claude Code that is the project block, the global block, and the plugin.

Choosing a Claude Code scope moves the rule there: installing the plugin removes any Claude blocks, and installing a block uninstalls the plugin, so the rules never load twice.

Without a terminal (CI, scripts), `--target` and `--yes` are required.

## Development

```bash
npm test                   # node:test suite (also runs in CI on Linux, macOS, Windows)
claude --plugin-dir .      # try the Claude Code plugin from this checkout
```

### Releasing

`package.json` holds the only version number. Plugin users install the tagged release, never `main`.

```bash
npm version patch          # or minor/major: syncs the plugin manifests, commits, tags v<version>
git push --follow-tags     # CI checks the tag matches package.json
npm publish
```

If `src/rules.md` or `src/profiles/everyday/` changed since the last tag, `npm version` first runs that Rule's live eval (haiku, 3 runs per scenario, through your `claude` login) and stops if any scenario fails on most of its runs. For a flaky run, `ADDA_SKIP_EVAL=1 npm version patch` skips it.

## Requirements

Node.js 20.17 or newer, on macOS, Linux, or Windows.

## License

MIT
