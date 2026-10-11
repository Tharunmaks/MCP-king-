---
name: refactor-safely
description: Use when the user asks to refactor, clean up, restructure or modernise code without changing behaviour.
---

# Refactor Safely

1. Make sure tests cover the code you'll touch. If not, add characterisation tests first that pin current behaviour.
2. Refactor in small steps (rename, extract function, move, inline), running tests after each step.
3. Never mix behaviour changes with refactoring in the same step. If you find a bug, note it and fix it separately.
4. Keep public APIs stable unless asked; if you must change one, update every caller (search for usages).
5. Delete dead code you've proven unused (search for references first).
6. Finish with: what changed structurally, test results, and anything risky for reviewers.
