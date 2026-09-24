# Adda

A tool that makes AI assistants talk to Bangla speakers in a language they find natural. For developers, that means chatting in Banglish while everything shipped stays English. For everyday users, it means helping with daily needs in natural Bangla.

## Language

**Banglish**:
Bengali written in Latin script, in a casual peer tone, with technical terms kept in English. Never Bengali script.
_Avoid_: Bengali (implies Bengali script), Bangla-English mix

**Bangla**:
Bengali written in Bengali script.
_Avoid_: Bengali script text, Bengali (ambiguous about script)

**Rule**:
The instruction text that tells an assistant which language to use in Chat and in Output. Each Rule belongs to one Profile and is delivered to a Target.
_Avoid_: Language Protocol, prompt, instructions

**Profile**:
Who a Rule serves and how the two languages behave. The `developer` Profile chats in Banglish and writes Output in English. The `everyday` Profile mirrors the user's script in Chat and writes Output in the Recipient's language.
_Avoid_: Mode, persona, audience

**Chat**:
Everything the assistant says to the user directly: replies and questions shown in the conversation. In the developer Profile it is Banglish; in the everyday Profile it mirrors the script the user writes in.
_Avoid_: Conversation language, reply language

**Output**:
Anything that leaves the chat: for developers, code, comments, commits, PRs, docs, logs, files on disk, and subagent prompts and reports, in standard professional English; for everyday users, documents written for a Recipient, in the Recipient's language.
_Avoid_: Artifact, deliverable

**Recipient**:
The person or organisation that will read a document the assistant writes for the user, such as a school, an employer, or a customer. Their language decides the language of the Output.
_Avoid_: Audience, addressee

**Skill**:
A task-specific instruction text a user adds on top of the base Rule only when needed, such as writing a letter or explaining an official document. A platform feature such as a Claude Skill may deliver a Skill, but is not the same thing.
_Avoid_: Prompt template, command, agent

**Block**:
The delimited section of a shared file that this tool owns; the rest of the file is never touched. A Block may record that the tool created its file, so removing the Block deletes the file too. A Block is identified by its markers alone, so a hand-written Block with the same markers is treated as the tool's own.
_Avoid_: Marker block, section, snippet

**Delivery**:
How the rule reaches a tool: as a Block in a shared file, as a File the tool owns entirely, as Print text the user pastes by hand, or as a Plugin.
_Avoid_: Install method, kind, mode

**Target**:
A tool the rule is configured for: Claude Code, Cursor, GitHub Copilot, Codex CLI, Gemini CLI, Hermes Agent, or Web AI.
_Avoid_: Tool, platform, client

**Scope**:
The value of `--scope`: `project` (one repo), `global` (every session), or `plugin` (Claude Code only). `plugin` is really a Delivery that the CLI flag exposes as a Scope.
_Avoid_: Level, location
