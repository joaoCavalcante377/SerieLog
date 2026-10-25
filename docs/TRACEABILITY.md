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
