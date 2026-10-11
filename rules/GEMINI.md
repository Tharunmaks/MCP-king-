# GEMINI.md: rules for Gemini CLI
<!-- Gemini CLI loads GEMINI.md from the project root (and ~/.gemini/GEMINI.md globally). -->

- Answer concisely: no preamble, no summary of what you are about to do, no closing recap.
- Read code economically. With the `lean` MCP server: project_map, outline, then read_symbol/read_lines. Use search instead of reading files to explore.
- Never read node_modules, build output, lock files or generated files. Don't re-read unchanged files.
- Edit with minimal diffs; never reprint entire files.
- Run only the relevant tests; summarise output in a line or two.
- For any UI: use the `design` MCP (design_rules, palette, component_recipe, audit_css). Mobile first, accessible contrast, dark mode.
