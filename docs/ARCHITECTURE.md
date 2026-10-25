# Architecture

## Layout

```
prisma/            schema, migrations (with hand-written constraints), seed
src/app/           routes (App Router, React Server Components)
src/features/<f>/  {components, actions, server, queries, schemas}   f = auth, series, logs, progress, watchlist, lists, profile
src/components/    shared UI (ui/, layout/, media/)
src/lib/           db, logger, tmdb client, rate limiter, seo, messages/pt-BR, domain/ (pure rules)
e2e/               Playwright specs (flows + axe a11y audit)
```

- **Data access:** reads only through `queries`, writes only through Server Actions. Components never import Prisma.
- **Action pipeline:** authenticate → validate (Zod, shared with the client form) → authorize ownership → write
  (transaction when more than one table changes) → revalidate → return `ActionResult` (`src/lib/action-result.ts`).
  The mutation logic lives in `features/*/server/*` taking a plain `userId`, so it is tested against a real Postgres
  without a session; the action files only authenticate and delegate.
- **Domain rules** (`src/lib/domain`): rating math and star keyboard behaviour, progress percentage, São Paulo date
  handling, slugs, 7-day cache staleness. All unit tested.
- **Text:** code in English; all UI copy in `src/lib/messages/pt-BR.ts`.

## TMDB

Server-side only (`src/lib/tmdb/client.ts`): typed, 8 s timeout, one retry on 5xx/429. Series are cached lazily into
`Series/Season/Episode/Genre` the first time they are opened or used; a cached series older than 7 days is served
immediately and refreshed in the background (`after()`). If TMDB is down, cached series still render. Images are
requested straight from the TMDB CDN in the sizes we choose (w185/w342/w500/w780).

## Data model highlights

- Partial unique index: one `WATCHING` log per user and series (race-safe, backed by `ON CONFLICT DO NOTHING` in code).
- CHECK constraints: ratings in 0.5 steps, favorites position 1–4, lowercase usernames.
- `(listId, position)` unique constraint is DEFERRABLE so a reorder can swap positions in one transaction.
- Series cache rows use `onDelete: Restrict` (user actions never delete them); deleting a user cascades their data.
- Room for follows/likes/comments: new tables only, no change to existing ones.

## Security

- argon2id password hashes; generic login error; JWT session in an httpOnly, sameSite cookie (30 days).
- Every write checks ownership (`FORBIDDEN`/`NOT_FOUND` are indistinguishable for pages: private → 404).
- Rate limiting (DB-backed, atomic upsert): 5 failed logins / 10 min per IP+email → 10 min block; 60 searches / min per IP.
- Headers: CSP (baseline), HSTS (production), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
- User text is rendered as plain text (line breaks only); length limits enforced by Zod and, for ratings, by CHECKs.

## Accessibility

Automated: the axe WCAG 2.1 A/AA audit (`e2e/a11y.spec.ts`) scans 20+ pages and dialogs in the dark and light
themes at desktop and phone sizes, and must report zero violations.

Built in: semantic landmarks and a skip link, labels on every input, visible focus, ≥ 44 px tap targets, native
`<details>`/`<dialog>`, star rating as `role="slider"` with `aria-valuetext` ("4,5 de 5 estrelas") and keyboard
control, drag-and-drop with a keyboard sensor and pt-BR screen-reader announcements, contrast-checked theme tokens.

Manual checks still recommended before launch (not automatable): a real screen-reader pass (NVDA/VoiceOver) over the
log dialog and the list editor, and 200% zoom.

## Performance

Lighthouse mobile (production build, local): Performance 88–91, Accessibility 100, Best Practices 100, SEO 100 on
home and series pages. Measures taken: eager poster images above the fold, `preconnect` to the TMDB CDN, no
backdrop download on phones, log form loaded on demand, server-rendered (zero-JS) season list for visitors,
episode rows rendered only when a season is opened. See `docs/DECISIONS.md` for the remaining LCP gap.

## Testing

| Layer                         | Tool                                             | What it covers                                                                |
| ----------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Domain + schemas              | Vitest                                           | rating math, progress, dates (São Paulo), slugs, validation                   |
| Server logic + Server Actions | Vitest against a real Postgres (`serielog_test`) | every business rule, authorization, concurrency; actions with a faked session |
| Components                    | Vitest + Testing Library (jsdom)                 | star slider semantics/keyboard, optimistic episode toggles and rollback       |
| End to end                    | Playwright (desktop + Pixel 7)                   | full user journey, flows per feature, axe WCAG audit in both themes           |

At the end of Phase 8: 273 unit/integration/component tests (coverage: 94% statements, 85% branches, 99%
functions, 96% lines over `lib/domain`, actions and server logic; gate is 80%) and 36 E2E runs
(18 specs × desktop/mobile), all green. E2E starts from a clean test database (`e2e/global-setup.ts`).
