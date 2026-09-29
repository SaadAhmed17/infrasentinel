# Access-control matrix (expected policy)

This is the specification that `apps/api/test/rbac.int-spec.ts` (RBAC-001) checks,
derived from the `@Roles(...)` declarations and their evident intent. Every cell was
exercised through the real guard chain: ✅ = must be allowed, ⛔ = must return 403.
Result: **126/126 cells behave as specified**; every endpoint returns 401 to anonymous
callers (RBAC-002).

| Endpoint | OWNER | ADMIN | SECURITY_ANALYST | DEVOPS_ENGINEER | DEVELOPER | VIEWER |
|---|---|---|---|---|---|---|
| `GET /servers`, `GET /servers/:id/metrics` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /servers`, `PATCH /servers/:id`, `DELETE /servers/:id` | ✅ | ✅ | ⛔ | ✅ | ⛔ | ⛔ |
| `GET /rules` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /rules`, `PATCH /rules/:id`, `PATCH /rules/:id/toggle`, `DELETE /rules/:id` | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| `GET /incidents`, `GET /incidents/dashboard-summary` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PATCH /incidents/:id/status` | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| `GET /organizations/me`, `GET /organizations/members` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PATCH /organizations/settings`, `PATCH /organizations/members/:id/role` | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| `POST /organizations/invitations`, `GET /organizations/invitations` | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| `GET /protected` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /admin-only` | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |

Not in the matrix, but covered elsewhere:

- `GET /servers/:id/anomaly-score` — any role (object-level check missing: DEF-08).
- `POST /rag/query` — any role; read-only question answering.
- `POST /rag/reindex` — any role, including VIEWER. **Open policy question** for the
  team: re-embedding every incident is expensive; should it be restricted?
- `/agent/*` — agent API key, not user roles (see ingestion tests).
- `/auth/*` and `GET /` — public by design.

## Rules the matrix alone cannot express (role hierarchy)

These are business rules on top of the guard: which *target* roles a caller may assign.
All currently fail (DEF-03):

| Rule | Test |
|---|---|
| Only an OWNER may grant the OWNER role | RBAC-011, 012 |
| An ADMIN may not change an OWNER's role | RBAC-013 |
| Invitations cannot grant a role above the inviter's authority | RBAC-014 |
| An organization must always keep at least one OWNER | RBAC-015 |
