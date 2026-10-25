import { DEFAULT_TIMEZONE } from "@/config/site";

/** Today's calendar date (YYYY-MM-DD) in America/Sao_Paulo. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Parses a TMDB "YYYY-MM-DD" into a UTC-midnight Date (what Postgres DATE round-trips as). */
export function parseTmdbDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date-only comparison: an episode has aired when airDate <= today (São Paulo). Missing date = not aired. */
export function hasAired(airDate: Date | null | undefined, now: Date = new Date()): boolean {
  if (!airDate) return false;
  return airDate.toISOString().slice(0, 10) <= todayInSaoPaulo(now);
}

export const SYNC_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function isSyncStale(lastSyncedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - lastSyncedAt.getTime() > SYNC_TTL_MS;
}
