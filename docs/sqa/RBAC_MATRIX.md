# Access-control matrix (expected policy)

This is the specification that `apps/api/test/rbac.int-spec.ts` (RBAC-001) checks,
derived from the `@Roles(...)` declarations and their evident intent. Every cell was
exercised through the real guard chain: ✅ = must be allowed, ⛔ = must return 403.
Result on `team-dev` (2026-10-06): **120/120 cells behave as specified**; every endpoint
returns 401 to anonymous callers (RBAC-002).

| Endpoint | OWNER | ADMIN | SECURITY_ANALYST | DEVOPS_ENGINEER | DEVELOPER | VIEWER |
|---|---|---|---|---|---|---|
| `GET /servers`, `GET /servers/:id/metrics` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /servers`, `POST /servers/:id/regenerate-key` | ✅ | ✅ | ⛔ | ✅ | ⛔ | ⛔ |
| `GET /rules` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /rules`, `PATCH /rules/:id`, `PATCH /rules/:id/toggle`, `DELETE /rules/:id` | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| `GET /incidents`, `GET /incidents/dashboard-summary` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PATCH /incidents/:id/status` | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| `GET /organizations/me`, `GET /organizations/members` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PATCH /organizations/settings`, `PATCH /organizations/members/:id/role` | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| `POST /organizations/invitations`, `GET /organizations/invitations` | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| `GET /protected` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /admin-only` | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |

`team-dev` has no `PATCH` or `DELETE /servers/:id` (cycle 1 tested them on `develop`);
TENANT-011 and TENANT-012 still confirm that such requests change nothing.

The web UI follows the same policy since DEF-42 was fixed: rule and incident controls are
shown only to OWNER, ADMIN and SECURITY_ANALYST; other roles see the data read-only.

Not in the matrix, but covered elsewhere:

- `GET /servers/:id/anomaly-score` — any role, own organization's servers only (TENANT-018, 026).
- `POST /rag/query` — any role; read-only question answering.
- `POST /rag/reindex` — any role, including VIEWER. **Open policy question** for the
  team: re-embedding every incident is expensive; should it be restricted?
- `/agent/*` — agent API key, not user roles (see ingestion tests).
- `/auth/*` (incl. `forgot-password`, `reset-password`) and `GET /` — public by design.

## Rules the matrix alone cannot express (role hierarchy)

These are business rules on top of the guard: which *target* roles a caller may assign.
All failed in cycle 1 (DEF-03); all pass on `team-dev` (fixed in `46a6a49`):

| Rule | Test |
|---|---|
| Only an OWNER may grant the OWNER role | RBAC-011, 012 (positive control RBAC-017) |
| An ADMIN may not change an OWNER's role | RBAC-013 |
| Invitations cannot grant a role above the inviter's authority | RBAC-014 (positive control RBAC-019) |
| An organization must always keep at least one OWNER | RBAC-015 (positive control RBAC-018) |
| The check uses the caller's current role, not a stale token | RBAC-021 |
| ADMINs still manage non-owner roles | RBAC-020 |
