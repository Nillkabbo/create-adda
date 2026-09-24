# Adda

**Adda in Banglish, ship in English.**

*Adda* (আড্ডা) is the Bengali habit of long, relaxed conversation with friends. This tool makes your AI coding tools **talk to you like that, in Banglish**, while **everything they ship stays in English**: code, comments, commits, PRs, docs, and any file written to disk.

```bash
npx create-adda
```

The interactive setup asks which tools to configure, where the rule should live, shows every planned change, and asks once before writing anything.

## What it installs

| Tool | Project scope | Global scope |
|---|---|---|
| Claude Code | `CLAUDE.local.md` at the git root (gitignored) | `~/.claude/CLAUDE.md`, or the **Adda plugin** (default when `claude` is installed) |
| Cursor | `.cursor/rules/adda.mdc` at the git root (gitignored) | Prints text to paste into Settings → Rules → User Rules |
| Codex CLI | — | `$CODEX_HOME/AGENTS.md` (default `~/.codex/AGENTS.md`) |
| Gemini CLI | — | `~/.gemini/GEMINI.md` |
| Web AI (ChatGPT, Claude.ai, Gemini) | — | Prints a prompt to paste into custom instructions |

The rule is personal. Project files are gitignored and never pushed onto teammates.

Shared files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`) are never overwritten. The rule goes inside a marked block and the rest of the file is left untouched:

```markdown
<!-- adda:start -->
...
<!-- adda:end -->
```

Running the tool again refreshes the block to the latest rules. `--remove` takes it out.

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

- Chat in Banglish (Bengali in Latin script), technical terms kept in English, never Bengali script.
- Everything that leaves the chat is professional English.
- Banglish by default; switches to English only when you ask, until you ask to switch back.
- Works alongside skills and plugins: they decide content, format, and length; this rule decides chat language. Subagent and inter-agent messages stay in English.

Full text: [`src/rules.md`](src/rules.md).

## Options

| Flag | Meaning |
|---|---|
| `--target <ids>` | Comma-separated: `claude`, `cursor`, `codex`, `gemini`, `web` |
| `--scope project\|global\|plugin` | Where the rule lives. `plugin` is Claude Code only. Default: `plugin` for Claude when `claude` is installed, otherwise `project` |
| `-y`, `--yes` | Skip the confirmation prompt |
| `--remove` | Uninstall from the chosen targets |
| `--print web` | Print only the web prompt, for piping |
| `--out <path>` | Write the web prompt to a file instead of printing it |
| `-h`, `--help` / `-v`, `--version` | Usage / version |

Examples:

```bash
# Global setup for Claude Code, Codex, and Gemini CLI
npx create-adda --target claude,codex,gemini --scope global --yes

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

## Requirements

Node.js 20.17 or newer, on macOS, Linux, or Windows.

## License

MIT
