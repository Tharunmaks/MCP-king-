---
name: security-audit
description: Use when the user asks to check code for security problems or before deploying an app that handles users, payments or data.
---

# Security Audit

Check, in order, and report each finding with file:line, impact and fix:

1. **Secrets**: API keys, tokens or passwords in code, config or git history. Move to environment variables.
2. **Injection**: SQL built with string concatenation, shell commands with user input, `eval`, unsanitised HTML (XSS), template injection.
3. **Auth**: endpoints without authentication, missing authorisation (user A reading user B's data / IDOR), weak session or JWT handling.
4. **Input**: missing validation, path traversal in file access, unrestricted uploads, SSRF via user-provided URLs.
5. **Transport & headers**: HTTP instead of HTTPS, missing CSP/HSTS, permissive CORS with credentials.
6. **Dependencies**: run the ecosystem's audit (`npm audit`, `pip-audit`, `cargo audit`) and list high/critical issues.
7. **Data**: passwords not hashed with bcrypt/argon2, PII in logs.

Use the Semgrep or Snyk MCP server if connected for an automated pass, then verify each result manually.
