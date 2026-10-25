# SerieLog

A social diary for TV series (a "Letterboxd for series"). Next.js App Router, Prisma/PostgreSQL, Auth.js, TMDB.

## Setup

1. `pnpm install`
2. `cp .env.example .env` and fill in the values (see table below).
3. `pnpm db:up` (starts Postgres via Docker; also creates the `serielog_test` database).
4. `pnpm db:migrate`
5. `pnpm dev` → http://localhost:3000

## Environment variables

| Variable               | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string                   |
| `AUTH_SECRET`          | Auth.js secret, ≥ 32 chars (`npx auth secret`) |
| `AUTH_URL`             | Public base URL of the app                     |
| `TMDB_API_READ_TOKEN`  | TMDB v4 read access token (server-side only)   |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL (metadata, sitemap)         |

All are validated at startup by `src/env.ts` (set `SKIP_ENV_VALIDATION=1` only for tooling).

## Scripts

| Script                          | What it does                |
| ------------------------------- | --------------------------- |
| `pnpm dev` / `build` / `start`  | Next.js                     |
| `pnpm lint` / `typecheck`       | ESLint / `tsc --noEmit`     |
| `pnpm test` / `test:coverage`   | Vitest                      |
| `pnpm test:e2e`                 | Playwright                  |
| `pnpm db:migrate` / `db:deploy` | Prisma migrate dev / deploy |
| `pnpm db:seed`                  | Demo data (Phase 8)         |

Docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DECISIONS.md`](docs/DECISIONS.md), [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md).
