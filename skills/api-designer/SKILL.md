---
name: api-designer
description: Use when designing or reviewing a REST/HTTP or RPC API, endpoints, request/response shapes or error formats.
---

# API Designer

- Resources are plural nouns (`/users/{id}/orders`); verbs come from HTTP methods.
- Consistent JSON: camelCase or snake_case, never both. ISO 8601 dates in UTC. IDs as strings.
- Errors: one shape everywhere, e.g. `{ "error": { "code": "not_found", "message": "...", "details": {} } }` with the right status (400 validation, 401 unauthenticated, 403 forbidden, 404, 409 conflict, 422, 429, 500).
- Pagination: cursor-based (`?cursor=...&limit=50` → `nextCursor`) for anything that can grow.
- Idempotency keys for POSTs that create payments or orders.
- Validate every input at the boundary; reject unknown fields on writes.
- Version only when breaking (`/v2`), prefer additive changes.
- Document each endpoint with an example request and response (OpenAPI if the project uses it).
