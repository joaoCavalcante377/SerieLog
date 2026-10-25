import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { after } from "next/server";
import { Poster } from "@/components/media/poster";
import { CastList } from "@/features/series/components/cast-list";
import { RatingSummaryPanel } from "@/features/series/components/rating-summary";
import { ReviewsList } from "@/features/series/components/reviews-list";
import { SeasonsAccordion } from "@/features/series/components/seasons-accordion";
import {
  getCast,
  getRatingSummary,
  getRecentReviews,
  getSeasonsWithEpisodes,
  getSeriesGenres,
} from "@/features/series/queries/series";
import { getOrSyncSeries } from "@/features/series/server/sync";
import { parseSeriesSegment, seriesPath, slugify } from "@/lib/domain/slug";
import { formatYear } from "@/lib/format";
import { messages } from "@/lib/messages/pt-BR";
import { tmdbImageUrl } from "@/lib/tmdb/images";

const s = messages.series;

// Memoized per request: generateMetadata and the page share one lookup.
const loadSeries = cache(async (idslug: string) => {
  const parsed = parseSeriesSegment(idslug);
  if (!parsed) notFound();
  const series = await getOrSyncSeries(parsed.tmdbId, { schedule: (task) => after(task) });
  if (!series) notFound();
  return { series, parsed };
});

export async function generateMetadata({
  params,
}: PageProps<"/serie/[idslug]">): Promise<Metadata> {
  const { idslug } = await params;
  const { series } = await loadSeries(idslug);
  const poster = tmdbImageUrl(series.posterPath, "w500");
  const description = series.overview?.slice(0, 160) ?? s.noOverview;
  return {
    title: series.name,
    description,
    openGraph: {
      title: series.name,
      description,
      type: "video.tv_show",
      images: poster ? [{ url: poster }] : undefined,
    },
  };
}

function yearRange(first: Date | null, last: Date | null, status: string): string | null {
  const start = formatYear(first);
  if (!start) return null;
  const end = formatYear(last);
  if (status === "Ended" || status === "Canceled")
    return end && end !== start ? `${start}–${end}` : start;
  return `${start}–`;
}

export default async function SeriesPage({ params }: PageProps<"/serie/[idslug]">) {
  const { idslug } = await params;
  const { series, parsed } = await loadSeries(idslug);

  // The id is the source of truth: redirect any other slug to the canonical URL.
  if (parsed.slug !== slugify(series.name, "serie")) {
    permanentRedirect(seriesPath(series.tmdbId, series.name));
  }

  const [genres, seasons, ratings, reviews, cast] = await Promise.all([
    getSeriesGenres(series.id),
    getSeasonsWithEpisodes(series.id),
    getRatingSummary(series.id),
    getRecentReviews(series.id),
    getCast(series.tmdbId),
  ]);

  const backdrop = tmdbImageUrl(series.backdropPath, "w780");
  const years = yearRange(series.firstAirDate, series.lastAirDate, series.status);

  return (
    <article className="space-y-10">
      <header className="relative -mx-4 -mt-6 overflow-hidden">
        {backdrop ? (
          <div className="absolute inset-0">
            <Image
              src={backdrop}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-30"
            />
            <div className="from-background absolute inset-0 bg-gradient-to-t to-transparent" />
          </div>
        ) : null}
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-10 pb-6 sm:flex-row">
          <div className="w-40 shrink-0 sm:w-56">
            <Poster
              path={series.posterPath}
              name={series.name}
              size="w500"
              sizes="(min-width: 640px) 224px, 160px"
              priority
            />
          </div>
          <div className="min-w-0 space-y-3">
            <h1 className="text-3xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
              {series.name}
              {years ? <span className="text-muted ml-3 text-xl font-normal">{years}</span> : null}
            </h1>
            {series.originalName !== series.name ? (
              <p className="text-muted">{series.originalName}</p>
            ) : null}
            <p className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>{s.statuses[series.status] ?? series.status}</span>
              <span>{s.seasonsCount(series.numberOfSeasons)}</span>
              <span>{s.episodesCount(series.numberOfEpisodes)}</span>
              {series.episodeRunTime ? <span>{s.runtime(series.episodeRunTime)}</span> : null}
            </p>
            {genres.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {genres.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/series?genre=${g.id}`}
                      className="bg-surface-2 border-border inline-flex rounded-full border px-3 py-1 text-xs"
                    >
                      {g.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="max-w-prose leading-relaxed">
              {series.overview ?? s.noOverview}
              {series.overview && series.overviewIsFallback ? (
                <span className="text-muted ml-1 text-sm">{s.inEnglish}</span>
              ) : null}
            </p>
          </div>
        </div>
      </header>

      <RatingSummaryPanel summary={ratings} />
      <CastList cast={cast} />
      <SeasonsAccordion seasons={seasons} />
      <ReviewsList reviews={reviews} />
    </article>
  );
}
