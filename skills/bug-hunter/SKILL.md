---
name: bug-hunter
description: Use when the user reports a bug, error, crash, failing test or unexpected behaviour and wants the root cause fixed.
---

# Bug Hunter

1. **Reproduce first.** Find or write the smallest command/test that shows the failure. Record the exact error.
2. **Locate.** Search for the error text and the functions in the stack trace. Read only those functions (outline + read_symbol when the `lean` MCP is available).
3. **Hypothesise.** State the single most likely cause in one sentence and how you'll confirm it.
4. **Confirm** with a log line, a debugger print, or a failing test, not by guessing.
5. **Fix the root cause**, not the symptom. Keep the change minimal and in the project's style.
6. **Prove it.** Re-run the reproduction (now passing) plus the nearby tests. Add a regression test if the project has tests.
7. **Report** in 3 lines: cause, fix, how it was verified.

Never: silence errors with try/catch, delete or skip failing tests, or claim a fix you didn't run.
