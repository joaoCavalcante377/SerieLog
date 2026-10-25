import { hasAired } from "@/lib/domain/dates";
import { formatDate } from "@/lib/format";
import { messages } from "@/lib/messages/pt-BR";

interface EpisodeRow {
  id: string;
  episodeNumber: number;
  name: string;
  airDate: Date | null;
  runtime: number | null;
}

interface SeasonRow {
  id: string;
  seasonNumber: number;
  name: string;
  episodeCount: number;
  episodes: EpisodeRow[];
}

/** Native <details> accordion: keyboard accessible and works without JS. Season 0 = specials. */
export function SeasonsAccordion({ seasons }: { seasons: SeasonRow[] }) {
  const s = messages.series;
  const now = new Date();

  if (seasons.length === 0) return null;
  return (
    <section aria-labelledby="seasons-heading" className="space-y-3">
      <h2 id="seasons-heading" className="text-xl font-semibold">
        {s.seasons}
      </h2>
      <div className="space-y-2">
        {seasons.map((season) => (
          <details key={season.id} className="bg-surface border-border group rounded-md border">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 font-medium">
              <span>{season.seasonNumber === 0 ? s.specials : season.name}</span>
              <span className="text-muted text-sm font-normal">
                {s.episodesCount(season.episodes.length)}
              </span>
            </summary>
            <ol className="border-border divide-border divide-y border-t">
              {season.episodes.map((ep) => {
                const aired = hasAired(ep.airDate, now);
                return (
                  <li key={ep.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                    <span className="text-muted w-10 shrink-0 tabular-nums">
                      {s.episodeShort} {ep.episodeNumber}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block">{ep.name}</span>
                      <span className="text-muted text-xs">
                        {ep.airDate ? formatDate(ep.airDate) : null}
                        {ep.runtime ? ` · ${ep.runtime} min` : null}
                        {aired ? null : ` · ${s.notAired}`}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </details>
        ))}
      </div>
    </section>
  );
}
