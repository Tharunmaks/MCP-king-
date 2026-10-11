# Project rules for Claude Code (token saver)
<!-- Put this file in your project root as CLAUDE.md. Claude Code reads it at the start of every session. -->

## Answer style
- Be brief. No preamble ("Great question", "I'll now..."), no closing recap, no restating my request.
- Show only changed code, never whole files back. Use short diffs or the edited function.
- Ask at most one question, only when truly blocked.

## Reading code (biggest token cost)
- If the `lean` MCP server is available: `project_map` once, then `outline` before opening a file, then `read_symbol` / `read_lines` for just the part you need. Use `search` instead of opening files to look around.
- Without it: use Grep/Glob first, then Read with offset/limit. Never read lock files, build output, minified or generated files, `node_modules`, `dist`, or large data files.
- Do not re-read a file you already read unless it changed.

## Working
- Make the smallest change that solves the task. Don't refactor unrelated code.
- Run only the relevant test file, not the whole suite, unless asked.
- Pipe long command output through `tail -n 40` or `grep` so logs don't flood the context.
- When a task is done, stop. Don't propose extra work unless asked.

## Session hygiene (for the human)
- `/clear` between unrelated tasks, `/compact` when a long task gets heavy.
- Disable MCP servers you aren't using: every connected server's tool list costs tokens on every message.
