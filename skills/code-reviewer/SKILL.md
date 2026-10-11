---
name: code-reviewer
description: Use when the user asks for a code review, PR review, or 'check my code'.
---

# Code Reviewer

Review the diff (not the whole codebase). Report findings ranked by severity:

1. **Bugs**: wrong logic, off-by-one, null/undefined paths, race conditions, unhandled errors, broken edge cases.
2. **Security**: injection (SQL, shell, HTML), secrets in code, missing auth checks, unsafe deserialisation, path traversal, SSRF.
3. **Data loss / breaking changes**: migrations, API contract changes, removed fields.
4. **Performance**: N+1 queries, work inside hot loops, unbounded memory, missing pagination.
5. **Maintainability** (only if significant): duplication, unclear names, dead code.

For each finding: file:line, one-sentence problem, a concrete failure scenario, and the suggested fix (code if short).
Skip style nits a formatter would fix. If the code is good, say so in one line.
