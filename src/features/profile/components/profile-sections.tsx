import { Star } from "lucide-react";
import Link from "next/link";
import { Poster } from "@/components/media/poster";
import { StarRating } from "@/components/ui/star-rating";
import type { DiaryEntry } from "@/features/logs/queries/diary";
import { seriesPath } from "@/lib/domain/slug";
import { formatRating } from "@/lib/format";
import { messages } from "@/lib/messages/pt-BR";
import type { ProfileCounters } from "../queries/profile";

const m = messages.profile;

export function Counters({ counters }: { counters: ProfileCounters }) {
  const items = [
    [m.seriesWatched, counters.seriesWatched],
    [m.thisYear, counters.thisYear],
    [m.lists, counters.lists],
  ] as const;
  return (
    <dl className="grid grid-cols-3 gap-3">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="bg-surface border-border flex flex-col-reverse rounded-lg border p-3 text-center"
        >
          <dt className="text-muted text-xs">{label}</dt>
          <dd className="text-2xl font-bold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface FavoriteCard {
  position: number;
  series: { tmdbId: number; name: string; posterPath: string | null };
}

export function FavoritesRow({ favorites }: { favorites: FavoriteCard[] }) {
  if (favorites.length === 0) return <p className="text-muted text-sm">{m.favoritesEmpty}</p>;
  return (
    <ol className="grid grid-cols-4 gap-3">
      {favorites.map((f) => (
        <li key={f.position} className="min-w-0">
          <Link href={seriesPath(f.series.tmdbId, f.series.name)} className="group block">
            <Poster
              path={f.series.posterPath}
              name={f.series.name}
              className="group-hover:border-accent transition-colors"
              sizes="(min-width: 640px) 160px, 22vw"
            />
            <p className="mt-1.5 truncate text-xs font-medium" title={f.series.name}>
              {f.series.name}
            </p>
          </Link>
        </li>
      ))}
    </ol>
  );
}

const monthDay = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

export function RecentDiary({ entries }: { entries: DiaryEntry[] }) {
  if (entries.length === 0) return <p className="text-muted text-sm">{m.noActivity}</p>;
  return (
    <ul className="divide-border divide-y">
      {entries.map((e) => (
        <li key={e.id} className="flex items-center gap-3 py-2">
          <time dateTime={e.diaryDate} className="text-muted w-14 shrink-0 text-xs">
            {monthDay.format(new Date(`${e.diaryDate}T00:00:00Z`))}
          </time>
          <div className="w-9 shrink-0">
            <Poster path={e.posterPath} name={e.seriesName} size="w185" sizes="36px" />
          </div>
          <Link
            href={seriesPath(e.seriesTmdbId, e.seriesName)}
            className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
          >
            {e.seriesName}
          </Link>
          <StarRating value={e.rating} readOnly size="sm" />
        </li>
      ))}
    </ul>
  );
}

interface ReviewRow {
  id: string;
  rating: { toString(): string } | null;
  reviewText: string | null;
  containsSpoilers: boolean;
  series: { tmdbId: number; name: string };
}

/** Plain-text reviews (line breaks only); spoilers stay collapsed. */
export function RecentReviews({ reviews }: { reviews: ReviewRow[] }) {
  if (reviews.length === 0) return <p className="text-muted text-sm">{m.noActivity}</p>;
  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <li key={r.id} className="bg-surface border-border space-y-2 rounded-md border p-3">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href={seriesPath(r.series.tmdbId, r.series.name)}
              className="font-medium hover:underline"
            >
              {r.series.name}
            </Link>
            {r.rating ? (
              <span className="text-star inline-flex items-center gap-1">
                <Star className="h-4 w-4 fill-current" aria-hidden />
                {formatRating(Number(r.rating))}
              </span>
            ) : null}
          </p>
          {r.containsSpoilers ? (
            <details>
              <summary className="text-accent min-h-11 cursor-pointer text-sm">
                {messages.series.showSpoilers}
              </summary>
              <p className="whitespace-pre-line">{r.reviewText}</p>
            </details>
          ) : (
            <p className="whitespace-pre-line">{r.reviewText}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function TopGenres({ genres }: { genres: { id: number; name: string; count: number }[] }) {
  if (genres.length === 0) return <p className="text-muted text-sm">{m.noActivity}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {genres.map((g) => (
        <li key={g.id}>
          <Link
            href={`/series?genre=${g.id}`}
            className="bg-surface-2 border-border hover:border-accent inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm"
          >
            {g.name}
            <span className="text-muted text-xs">{g.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
