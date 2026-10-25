# Traceability

Maps each Gherkin scenario ID to its automated test. Filled in per phase.

| Scenario | Test file                                                            | Status                                                                              |
| -------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| AUTH-01  | `src/features/auth/server/auth.integration.test.ts`                  | Account + hashed password covered; auto-login smoke-tested manually, E2E in Phase 8 |
| AUTH-02  | `src/features/auth/server/auth.integration.test.ts`                  | Covered (email, username case-insensitive, concurrent)                              |
| AUTH-03  | `src/features/auth/schemas/auth.test.ts`, `auth.integration.test.ts` | Covered                                                                             |
| AUTH-04  | `src/features/auth/server/auth.integration.test.ts`                  | Covered at credential level; no-session confirmed by smoke test                     |
| AUTH-05  | `src/lib/redirects.test.ts`                                          | Redirect target covered; full flow smoke-tested, E2E in Phase 8                     |
| AUTH-06  | —                                                                    | Deferred: Google login removed from scope for now                                   |
| AUTH-07  | —                                                                    | Deferred to Phase 8 (rate limiting)                                                 |
| PRO-04   | `src/features/profile/server/account.integration.test.ts`            | Covered                                                                             |
| PRO-05   | `src/features/profile/server/account.integration.test.ts`            | Covered                                                                             |
| PRO-06   | `src/features/profile/server/account.integration.test.ts`            | Covered (cascade delete, wrong confirmation)                                        |

## Phase 3 — Discovery and series page

| Scenario | Test file                                                                                 | Status                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| DISC-01  | `src/features/series/server/search.test.ts`                                               | Result mapping covered; 300ms debounce + dropdown UI (`search-box.tsx`) verified only by API smoke test — E2E in Phase 8 |
| DISC-02  | `src/features/series/server/search.test.ts`                                               | Empty result covered; message rendered by `search-box.tsx` / `/pesquisa`                                                 |
| DISC-03  | `src/features/series/server/search.test.ts`                                               | Server never calls TMDB under 2 chars; the client also skips the request (derived in `search-box.tsx`)                   |
| DISC-04  | `src/features/series/server/search.test.ts`                                               | Error outcome covered; `/api/search` returns 502                                                                         |
| DISC-05  | `src/features/series/schemas/browse.test.ts`                                              | URL round-trip covered; live `/series?genre=…` smoke-tested                                                              |
| DISC-06  | `src/features/series/server/sync.integration.test.ts`                                     | Covered (fallback stored + flagged; "(em inglês)" rendered on the page)                                                  |
| SER-01   | `src/features/series/server/sync.integration.test.ts`                                     | Covered; also smoke-tested against live TMDB (series, seasons, episodes stored)                                          |
| SER-02   | `src/features/series/server/sync.integration.test.ts`                                     | Covered                                                                                                                  |
| SER-03   | `src/features/series/server/sync.integration.test.ts`                                     | Covered                                                                                                                  |
| SER-04   | `src/features/series/queries/series.integration.test.ts`, `src/lib/domain/domain.test.ts` | Covered                                                                                                                  |
| SER-05   | —                                                                                         | Needs the action panel (Phase 4)                                                                                         |
| SER-06   | `src/features/series/server/sync.integration.test.ts`                                     | Not-found handling covered; live `/serie/99999999` returns HTTP 404                                                      |

Also covered: TMDB client retries/timeouts (`src/lib/tmdb/client.test.ts`), date/rating/slug domain rules (`src/lib/domain/domain.test.ts`).

## Phase 4 — Watchlist, logging, rating, diary

| Scenario | Test file                                                                             | Status                                                                      |
| -------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| SER-05   | `e2e/log-flow.spec.ts`                                                                | Covered end to end (logged-out click → sign-up → back on the series, added) |
| WAT-01   | `src/features/watchlist/server/watchlist.integration.test.ts`                         | Covered; button state in E2E                                                |
| WAT-02   | `src/features/watchlist/server/watchlist.integration.test.ts`                         | Covered (sequential and concurrent)                                         |
| WAT-03   | `src/features/watchlist/server/watchlist.integration.test.ts`                         | Covered (sort by added/year/title, genre filter)                            |
| WAT-04   | `src/features/watchlist/server/watchlist.integration.test.ts`, `e2e/log-flow.spec.ts` | Covered                                                                     |
| LOG-01   | `src/features/logs/server/logs.integration.test.ts`, `e2e/log-flow.spec.ts`           | Covered (diary + community average)                                         |
| LOG-02   | `src/components/ui/star-rating.test.tsx`, `logs.integration.test.ts`                  | Covered (4th star twice → 3.5; rating-only save)                            |
| LOG-03   | `src/features/logs/server/logs.integration.test.ts`                                   | Covered (before start, future)                                              |
| LOG-04   | `src/features/logs/server/logs.integration.test.ts`                                   | Covered (5000 ok, 5001 rejected)                                            |
| LOG-09   | `src/features/logs/server/logs.integration.test.ts`                                   | Covered                                                                     |
| LOG-10   | `src/features/logs/server/logs.integration.test.ts`                                   | Covered (sequential and concurrent; partial unique index)                   |
| LOG-11   | `src/features/logs/server/logs.integration.test.ts`                                   | Log-creation half covered; "mark an episode" half arrives with Phase 5      |
| LOG-12   | `src/features/logs/server/logs.integration.test.ts`                                   | Covered (FORBIDDEN on edit and delete)                                      |
| DIA-01   | `src/features/logs/queries/diary.integration.test.ts`                                 | Ordering covered; month headers are rendered in `diary-list.tsx`            |
| DIA-02   | `diary.integration.test.ts`, `e2e/log-flow.spec.ts`                                   | Covered (empty state + "Buscar séries" CTA)                                 |
| DIA-03   | `src/features/logs/queries/diary.integration.test.ts`                                 | Covered; filters live in the URL (GET form)                                 |
| DIA-04   | `logs.integration.test.ts`, `e2e/log-flow.spec.ts`                                    | Covered (confirm deletes, cancel keeps, average recalculated)               |
| DIA-05   | `src/features/logs/queries/diary.integration.test.ts`                                 | Covered (45 logs → 20/20/5, no duplicates)                                  |

Also covered: star slider semantics and keyboard (`src/components/ui/star-rating.test.tsx`), AUTH-05 full flow (`e2e/log-flow.spec.ts`).

## Phase 5 — Episode progress

| Scenario | Test file                                                                                   | Status                                                                         |
| -------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| LOG-05   | `src/features/progress/server/progress.integration.test.ts`, `e2e/progress-flow.spec.ts`    | Covered (active log dated today, continue-watching row with progress bar)      |
| LOG-06   | `progress.integration.test.ts`, `seasons-accordion.test.tsx`, `e2e/progress-flow.spec.ts`   | Covered (aired only, shared timestamp, progress updates)                       |
| LOG-07   | `progress.integration.test.ts`, `src/features/series/components/seasons-accordion.test.tsx` | Covered (server rejects; checkbox disabled with "Ainda não foi ao ar" tooltip) |
| LOG-08   | `progress.integration.test.ts`, `e2e/progress-flow.spec.ts`                                 | Covered (prompt, "Agora não" keeps WATCHING, "Sim" completes with today)       |
| LOG-11   | `progress.integration.test.ts`                                                              | Episode half covered (log-creation half in Phase 4)                            |
| LOG-13   | `src/features/series/components/seasons-accordion.test.tsx`                                 | Covered (optimistic check, rollback + "Não foi possível salvar")               |
| LOG-14   | `progress.integration.test.ts`, `e2e/progress-flow.spec.ts`                                 | Covered (rate, change, clear, 1000-char review; shown on season header)        |
| LOG-15   | `progress.integration.test.ts`, `src/lib/domain/progress.test.ts`                           | Covered (specials listed, not counted)                                         |

Also covered: offering "mark all episodes" when completing via the log form, "Novos episódios" + `resumeWatching`, rule 6 (logs and watches are independent), numbering gaps, undated episodes, concurrent double clicks.
