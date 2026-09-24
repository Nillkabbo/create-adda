# Adda

A tool that makes AI coding assistants chat with developers in Banglish while everything they produce stays in English.

## Language

**Banglish**:
Bengali written in Latin script, in a casual peer tone, with technical terms kept in English. Never Bengali script.
_Avoid_: Bengali (implies Bengali script), Bangla-English mix

**Rule**:
The instruction text (Banglish in Chat, English in Output) that this tool delivers to a Target.
_Avoid_: Language Protocol, prompt, instructions

**Chat**:
Everything the assistant says to the developer directly: replies and questions shown in the conversation. Written in Banglish.
_Avoid_: Conversation language, reply language

**Output**:
Anything that leaves the chat: code, comments, commits, PRs, docs, logs, files on disk, and subagent prompts and reports. Written in standard professional English.
_Avoid_: Artifact, deliverable

**Block**:
The delimited section of a shared file that this tool owns; the rest of the file is never touched. A Block may record that the tool created its file, so removing the Block deletes the file too. A Block is identified by its markers alone, so a hand-written Block with the same markers is treated as the tool's own.
_Avoid_: Marker block, section, snippet

**Delivery**:
How the rule reaches a tool: as a Block in a shared file, as a File the tool owns entirely, as Print text the developer pastes by hand, or as a Plugin.
_Avoid_: Install method, kind, mode

**Target**:
A tool the rule is configured for: Claude Code, Cursor, Codex CLI, Gemini CLI, or Web AI.
_Avoid_: Tool, platform, client

**Scope**:
The value of `--scope`: `project` (one repo), `global` (every session), or `plugin` (Claude Code only). `plugin` is really a Delivery that the CLI flag exposes as a Scope.
_Avoid_: Level, location
