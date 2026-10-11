---
name: token-saver
description: Use at the start of any coding task to keep token use low: explore with outlines and search, read only needed code, answer briefly. Use whenever the user mentions running out of tokens, limits, or cost.
---

# Token Saver

Goal: finish the task with as few tokens as possible without lowering quality.

## Explore cheaply
1. If the `lean` MCP server is connected, use it:
   - `project_map` once (never list folders one by one)
   - `outline <file>` before reading any file
   - `read_symbol <file> <name>` or `read_lines` for just the part you need
   - `search` to find usages instead of opening files
   - `git_brief` instead of reading full diffs
2. Without it: Grep/Glob first, then Read with offset/limit around the match.
3. Never read: lock files, `node_modules`, `dist`/`build`, minified files, generated code, large data/JSON fixtures.
4. Never re-read a file you already have unless it changed.

## Act cheaply
- Make the smallest correct edit. Don't reprint files; show only changed lines.
- Run the single most relevant test, and pipe long output through `tail -n 40`.
- Batch independent tool calls together.

## Answer cheaply
- No preamble, no restating the task, no recap at the end. Lead with the result.
- One short paragraph or a short list. Code only where it changes something.
