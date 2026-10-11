# AGENTS.md: rules for AI coding agents
<!-- Read by Codex CLI, Cursor, Jules, Amp, Kimi CLI, OpenCode, Zed, Windsurf and others. Put it in the project root. -->

## Output
- Short answers. No preamble, no recap. Show only changed lines or functions, never whole files.

## Context budget
- Prefer the `lean` MCP tools when present: project_map → outline → read_symbol/read_lines; search instead of browsing.
- Otherwise search first, then read only the needed line ranges. Skip lock files, generated code, build output and vendored dependencies.
- Never read the same file twice unless it changed. Truncate long command output (tail/grep).

## Changes
- Smallest change that solves the task. Keep the existing style, naming and comment density.
- Run the narrowest relevant tests and the linter before saying you are done. Report failures honestly.
- Never commit secrets. Never run destructive commands (rm -rf, force push, DROP) without asking.

## UI work
- If the `design` MCP is available: design_rules first, palette for colours, type_scale for sizes, audit_css at the end.
- Mobile first (check 360px), 44px tap targets, visible focus styles, WCAG AA contrast, dark mode.
