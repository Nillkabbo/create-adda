# Plugin is the default Delivery for Claude Code

For Claude Code, the default Delivery is the Plugin rather than a Block in `CLAUDE.md`. A Plugin re-injects the Rule after `/clear` and context compaction and adds an `/adda on|off|status` toggle; a Block gives neither. The cost is that installing needs the `claude` CLI, and plugin users get the tagged release, never `main`.

Installing the Plugin removes any Claude Block, and choosing a Block uninstalls the Plugin, so the Rule is never loaded twice.
