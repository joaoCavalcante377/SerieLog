import Link from "next/link";
import { SeriesGrid } from "@/components/media/series-card";
import { Button } from "@/components/ui/button";
import { seriesPath } from "@/lib/domain/slug";
import { formatYear } from "@/lib/format";
import { messages } from "@/lib/messages/pt-BR";
import { getWatchlistPage } from "../queries/watchlist";
import { buildWatchlistQuery, type WatchlistParams } from "../schemas/watchlist";

const w = messages.watchlist;
const fieldClass = "bg-surface border-border h-11 rounded-md border px-3";

interface Props {
  userId: string;
  params: WatchlistParams;
  /** Base path of the page, e.g. /watchlist or /ana/watchlist. */
  basePath: string;
  title: string;
  isOwner: boolean;
}

export async function WatchlistView({ userId, params, basePath, title, isOwner }: Props) {
  const { items, genres, total, totalPages } = await getWatchlistPage(userId, params);
  const link = (page: number) => `${basePath}${buildWatchlistQuery({ ...params, page })}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>

      {total > 0 || params.genre ? (
        <form method="get" action={basePath} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sort" className="text-sm font-medium">
              {w.sort}
            </label>
            <select id="sort" name="sort" defaultValue={params.sort} className={fieldClass}>
              <option value="added">{w.sortAdded}</option>
              <option value="year">{w.sortYear}</option>
              <option value="title">{w.sortTitle}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="genre" className="text-sm font-medium">
              {w.genre}
            </label>
            <select
              id="genre"
              name="genre"
              defaultValue={params.genre ?? ""}
              className={fieldClass}
            >
              <option value="">{messages.browse.allGenres}</option>
              {genres.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">{messages.diary.apply}</Button>
          <Link
            href={basePath}
            className="text-muted hover:text-foreground flex h-11 items-center px-2 text-sm"
          >
            {messages.diary.clear}
          </Link>
        </form>
      ) : null}

      {items.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted">{isOwner ? w.empty : w.emptyOther}</p>
          {isOwner && !params.genre ? (
            <Link
              href="/series"
              className="bg-accent text-accent-foreground mt-4 inline-flex h-11 items-center rounded-md px-5 font-medium"
            >
              {messages.diary.emptyCta}
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <SeriesGrid
            items={items.map(({ series }) => ({
              href: seriesPath(series.tmdbId, series.name),
              name: series.name,
              year: formatYear(series.firstAirDate),
              posterPath: series.posterPath,
            }))}
          />
          {totalPages > 1 ? (
            <nav
              aria-label={messages.browse.page}
              className="flex items-center justify-center gap-4 text-sm"
            >
              {params.page > 1 ? (
                <Link href={link(params.page - 1)} className="text-accent underline">
                  {messages.browse.prev}
                </Link>
              ) : null}
              <span className="text-muted">
                {messages.browse.page} {params.page} / {totalPages}
              </span>
              {params.page < totalPages ? (
                <Link href={link(params.page + 1)} className="text-accent underline">
                  {messages.browse.next}
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
