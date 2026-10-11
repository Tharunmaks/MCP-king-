---
name: test-writer
description: Use when the user asks for tests, better coverage, or a regression test for a bug.
---

# Test Writer

1. Detect the project's test framework and conventions from existing tests (file naming, helpers, fixtures). Match them exactly.
2. List the behaviours to cover: the happy path, edge cases (empty, zero, max, unicode, null), error paths, and the specific bug if any.
3. One behaviour per test, with a name that says what should happen ("returns 404 when the user is missing").
4. Arrange / act / assert. No logic in tests beyond setup. No sleeping; use fake timers.
5. Mock only at the boundaries (network, clock, filesystem). Don't mock the code under test.
6. Run the new tests and show they pass; for a regression test, show it failed before the fix.
