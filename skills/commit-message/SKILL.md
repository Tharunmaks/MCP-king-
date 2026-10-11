---
name: commit-message
description: Use when writing a git commit message or PR description from staged changes.
---

# Commit Message

1. Read `git diff --staged --stat` then the diff of the important files only.
2. Subject: imperative, <= 60 chars, no trailing period, says what changes for the user ("Fix login redirect loop on Safari").
3. Body (wrap at 72): why the change was needed, what changed at a high level, anything reviewers must know (migrations, flags, breaking changes).
4. Follow the repo's convention if it uses one (Conventional Commits `feat:`/`fix:`, ticket prefixes).
5. Never invent changes that aren't in the diff.
