import Link from "next/link";
import { auth } from "@/auth";
import { SeriesGrid } from "@/components/media/series-card";
import { summaryToCard } from "@/features/series/components/summary-to-card";
import { Shelf } from "@/features/series/components/shelf";
import { getProgressForSeries } from "@/features/progress/queries/progress";
import { getContinueWatching } from "@/features/series/queries/series";
import { seriesPath } from "@/lib/domain/slug";
import { formatYear } from "@/lib/format";
import { messages } from "@/lib/messages/pt-BR";
import { tmdb } from "@/lib/tmdb/client";

const h = messages.home;

async function GenreChips() {
  const genres = await tmdb.genres().catch(() => []);
  if (genres.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{h.genres}</h2>
      <ul className="flex flex-wrap gap-2">
        {genres.map((g) => (
          <li key={g.id}>
            <Link
              href={`/series?genre=${g.id}`}
              className="bg-surface-2 border-border hover:border-accent inline-flex h-11 items-center rounded-full border px-4 text-sm"
            >
              {g.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;
  const watching = userId ? await getContinueWatching(userId) : [];
  const progressBySeries = userId
    ? await getProgressForSeries(
        userId,
        watching.map((w) => w.series.id),
      )
    : {};

  return (
    <div className="space-y-10">
      {session?.user ? null : (
        <section className="py-8">
          <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">{h.heroTitle}</h1>
          <p className="text-muted mt-3 max-w-prose text-lg">{h.heroBody}</p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/cadastro"
              className="bg-accent text-accent-foreground inline-flex h-11 items-center rounded-md px-5 font-medium"
            >
              {messages.nav.signup}
            </Link>
            <Link
              href="/series"
              className="border-border inline-flex h-11 items-center rounded-md border px-5 font-medium"
            >
              {h.cta}
            </Link>
          </div>
        </section>
      )}

      {watching.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{h.continueWatching}</h2>
          <SeriesGrid
            items={watching.map(({ series }) => ({
              href: seriesPath(series.tmdbId, series.name),
              name: series.name,
              year: formatYear(series.firstAirDate),
              posterPath: series.posterPath,
              progress: progressBySeries[series.id] ?? 0,
            }))}
          />
        </section>
      ) : null}

      <Shelf
        title={h.trending}
        priorityCount={4}
        load={async () => (await tmdb.trending()).results.slice(0, 6).map(summaryToCard)}
      />
      <Shelf
        title={h.topRated}
        load={async () => (await tmdb.topRated()).results.slice(0, 6).map(summaryToCard)}
      />
      <GenreChips />
    </div>
  );
}
