import { hasAired } from "@/lib/domain/dates";
import { formatDate } from "@/lib/format";
import { messages } from "@/lib/messages/pt-BR";

const s = messages.series;

interface Props {
  seasons: {
    id: string;
    seasonNumber: number;
    name: string;
    episodes: {
      id: string;
      episodeNumber: number;
      name: string;
      airDate: Date | null;
      runtime: number | null;
    }[];
  }[];
}

/**
 * Read-only seasons for logged-out visitors: pure server HTML (no client JS, fully indexable).
 * Signed-in users get the interactive `SeasonsAccordion` instead.
 */
export function SeasonsList({ seasons }: Props) {
  const now = new Date();
  if (seasons.length === 0) return null;
  return (
    <section aria-labelledby="seasons-heading" className="space-y-3">
      <h2 id="seasons-heading" className="text-xl font-semibold">
        {s.seasons}
      </h2>
      <div className="space-y-2">
        {seasons.map((season) => (
          <details key={season.id} className="bg-surface border-border rounded-md border">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 font-medium">
              <span>{season.seasonNumber === 0 ? s.specials : season.name}</span>
              <span className="text-muted text-sm font-normal">
                {s.episodesCount(season.episodes.length)}
              </span>
            </summary>
            <ol className="border-border divide-border divide-y border-t">
              {season.episodes.map((ep) => (
                <li key={ep.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                  <span className="text-muted w-10 shrink-0 tabular-nums">
                    {s.episodeShort} {ep.episodeNumber}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{ep.name}</span>
                    <span className="text-muted text-xs">
                      {ep.airDate ? formatDate(ep.airDate) : null}
                      {ep.runtime ? ` · ${ep.runtime} min` : null}
                      {hasAired(ep.airDate, now) ? null : ` · ${s.notAired}`}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </section>
  );
}
