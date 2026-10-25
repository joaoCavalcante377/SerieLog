import type { Metadata } from "next";
import Link from "next/link";
import { SeriesGrid } from "@/components/media/series-card";
import { BrowseFilters } from "@/features/series/components/browse-filters";
import { summaryToCard } from "@/features/series/components/summary-to-card";
import { buildBrowseQuery, parseBrowseParams } from "@/features/series/schemas/browse";
import { logger } from "@/lib/logger";
import { messages } from "@/lib/messages/pt-BR";
import { tmdb } from "@/lib/tmdb/client";

export const metadata: Metadata = { title: messages.browse.title };

export default async function BrowsePage({ searchParams }: PageProps<"/series">) {
  const params = parseBrowseParams(await searchParams);
  const b = messages.browse;

  const [genres, results] = await Promise.all([
    tmdb.genres().catch(() => []),
    tmdb.discover(params).catch((e) => {
      logger.warn("browse failed", { error: String(e) });
      return null;
    }),
  ]);

  // TMDB caps discover pagination at 500 pages.
  const totalPages = results ? Math.min(results.total_pages, 500) : 1;
  const pageLink = (page: number) => `/series${buildBrowseQuery({ ...params, page })}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{b.title}</h1>
      <BrowseFilters params={params} genres={genres} />
      {!results ? (
        <p role="alert" className="text-danger">
          {b.loadError}
        </p>
      ) : results.results.length === 0 ? (
        <p className="text-muted">{b.empty}</p>
      ) : (
        <>
          <SeriesGrid items={results.results.map(summaryToCard)} />
          <nav aria-label={b.page} className="flex items-center justify-center gap-4 text-sm">
            {params.page > 1 ? (
              <Link href={pageLink(params.page - 1)} className="text-accent underline">
                {b.prev}
              </Link>
            ) : null}
            <span className="text-muted">
              {b.page} {params.page} / {totalPages}
            </span>
            {params.page < totalPages ? (
              <Link href={pageLink(params.page + 1)} className="text-accent underline">
                {b.next}
              </Link>
            ) : null}
          </nav>
        </>
      )}
    </div>
  );
}
