# Architecture

- **Next.js App Router** with React Server Components; TypeScript strict.
- **Feature folders:** `src/features/<feature>/{components,actions,queries,schemas,types}`. Shared UI in `src/components`, pure helpers in `src/lib`, business rules in `src/lib/domain` (unit tested).
- **Data access:** reads only via `queries`, writes only via Server Actions. Components never import Prisma.
- **Server Action pipeline:** authenticate → validate (Zod) → authorize ownership → write (transaction if multi-table) → revalidate → return `ActionResult` (`src/lib/action-result.ts`).
- **TMDB:** server-side only, lazily cached into Postgres (`Series`/`Season`/`Episode`), re-synced after 7 days in the background.
- **i18n:** code in English, all UI copy in `src/lib/messages/pt-BR.ts`.
- **Config:** `src/config/site.ts` (site name, locale, reserved usernames), `src/env.ts` (validated env).

Layout (Phase 1): `src/app` (routes), `src/components/layout` (header, footer, theme toggle), `src/lib` (db, logger, action-result, messages), `prisma/` (schema + migrations).
