# SerieLog

A social diary for TV series, a "Letterboxd for series": log what you watch, rate it, write reviews, track
progress episode by episode and curate lists. Interface in Brazilian Portuguese.

Stack: Next.js (App Router) · TypeScript strict · PostgreSQL + Prisma · Auth.js (email + password) · Tailwind ·
Zod · TMDB API · Vitest · Playwright.

## Setup (5 steps)

1. `pnpm install`
2. `cp .env.example .env` and fill it in (see the table below; a free TMDB read token is required).
3. `pnpm db:up` — starts Postgres in Docker and also creates the `serielog_test` database.
4. `pnpm db:migrate`
5. `pnpm dev` → http://localhost:3000

Optional: `pnpm db:seed` loads demo data (3 users, 15 series from TMDB, logs, lists, watchlists). Demo
accounts `ana@demo.serielog.test`, `bruno@demo.serielog.test` and `carla@demo.serielog.test` all use the
password `demo1234` (local development only). The seed is idempotent.

## Environment variables

All are validated at startup by `src/env.ts` (the app refuses to boot with a readable message otherwise).

| Variable               | Purpose                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string                                                  |
| `AUTH_SECRET`          | Auth.js secret, ≥ 32 characters (`npx auth secret`)                           |
| `AUTH_URL`             | Public base URL of the app                                                    |
| `TMDB_API_READ_TOKEN`  | TMDB v4 "API Read Access Token" (server-side only, never sent to the browser) |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL (metadata, sitemap, robots)                                |

Optional: `TEST_DATABASE_URL` (defaults to the local `serielog_test` database), `SKIP_ENV_VALIDATION=1` (tooling only).

## Scripts

| Script                          | What it does                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `build` / `start`  | Next.js                                                                                                 |
| `pnpm lint` / `typecheck`       | ESLint / `tsc --noEmit`                                                                                 |
| `pnpm test`                     | Vitest: unit, component and integration tests (real test Postgres)                                      |
| `pnpm test:coverage`            | Same, with the 80% coverage gate on domain, actions and server code                                     |
| `pnpm test:e2e`                 | Playwright (desktop + mobile, includes the axe a11y audit). Needs `pnpm build` first and the TMDB token |
| `pnpm db:up`                    | Start Postgres (Docker)                                                                                 |
| `pnpm db:migrate` / `db:deploy` | Prisma migrate dev / deploy                                                                             |
| `pnpm db:seed`                  | Demo data                                                                                               |
| `pnpm format`                   | Prettier                                                                                                |

Integration tests and E2E always use the separate `serielog_test` database, never the dev one.

## Deploy (Vercel + managed Postgres)

Not deployed from this repo. To deploy: create a Postgres database, set the five variables above in the
project settings (`AUTH_URL` and `NEXT_PUBLIC_SITE_URL` = your public URL), run `pnpm db:deploy` against it
(e.g. in the build command or a release step) and deploy. `postinstall` runs `prisma generate`.
Behind Vercel the client IP comes from `x-forwarded-for`, which the rate limiter uses.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how it is organised, request flow, security, accessibility
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — every non-obvious decision, with the reason
- [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md) — each acceptance scenario mapped to its tests

TMDB attribution: this product uses the TMDB API but is not endorsed or certified by TMDB (shown in the footer
and on `/sobre`).
