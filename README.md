# create-banglish-agent

Make your AI coding tools **talk to you in Banglish** while keeping **everything they ship in English**: code, comments, commits, PRs, docs, and any file written to disk.

```bash
npx create-banglish-agent
```

The interactive setup asks which tools to configure, where the rule should live, shows every planned change, and asks once before writing anything.

## What it installs

| Tool | Project scope | Global scope |
|---|---|---|
| Claude Code | `CLAUDE.local.md` at the git root (gitignored) | `~/.claude/CLAUDE.md` |
| Cursor | `.cursor/rules/banglish.mdc` at the git root (gitignored) | Prints text to paste into Settings → Rules → User Rules |
| Codex CLI | — | `$CODEX_HOME/AGENTS.md` (default `~/.codex/AGENTS.md`) |
| Gemini CLI | — | `~/.gemini/GEMINI.md` |
| Web AI (ChatGPT, Claude.ai, Gemini) | — | Prints a prompt to paste into custom instructions |

The rule is personal. Project files are gitignored and never pushed onto teammates.

Shared files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`) are never overwritten. The rule goes inside a marked block and the rest of the file is left untouched:

```markdown
<!-- banglish-agent:start -->
...
<!-- banglish-agent:end -->
```

Running the tool again refreshes the block to the latest rules. `--remove` takes it out.

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
| `--scope project\|global` | Scope for targets that support both (default `project`) |
| `-y`, `--yes` | Skip the confirmation prompt |
| `--remove` | Uninstall from the chosen targets |
| `--print web` | Print only the web prompt, for piping |
| `--out <path>` | Write the web prompt to a file instead of printing it |
| `-h`, `--help` / `-v`, `--version` | Usage / version |

Examples:

```bash
# Global setup for Claude Code, Codex, and Gemini CLI
npx create-banglish-agent --target claude,codex,gemini --scope global --yes

# Copy the web prompt to the clipboard (macOS)
npx create-banglish-agent --print web | pbcopy

# Undo a project install
npx create-banglish-agent --remove --target claude,cursor --yes
```

Without a terminal (CI, scripts), `--target` and `--yes` are required.

## Requirements

Node.js 20.17 or newer.

## License

MIT
