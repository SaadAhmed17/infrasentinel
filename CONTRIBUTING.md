# Contributing to InfraSentinel

## Branch Strategy

- `main` — protected, always deployable. Never push directly.
- `develop` — default working branch. Feature branches merge here first.
- Feature branches: `feat/short-description`, `fix/short-description`, `chore/short-description`

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: add server metrics chart`
- `fix: resolve CORS error on signup`
- `chore: update dependencies`
- `docs: update README`

## Workflow

1. Branch off `develop`: `git checkout -b feat/your-feature develop`
2. Commit with conventional messages
3. Push and open a PR into `develop`
4. At least one teammate reviews before merging
5. CI (lint + build) must pass before merge is allowed

## Code Style

- Backend: NestJS module pattern (Controller → Service → Prisma). Business logic stays in services, never in controllers.
- Frontend: Components in `src/components`, pages in `src/app`. Use the existing `apiClient` wrapper for all API calls — no raw `fetch()`.
- Run `pnpm lint` before pushing — CI will block merges on lint failures.

## Environment Setup

See each app's `.env.example` for required variables. Never commit real `.env` files.