import { Star } from "lucide-react";
import { formatRating } from "@/lib/format";
import { messages } from "@/lib/messages/pt-BR";
import type { RatingSummary } from "@/lib/domain/rating";

export function RatingSummaryPanel({ summary }: { summary: RatingSummary }) {
  const s = messages.series;
  if (summary.total === 0) {
    return (
      <section aria-labelledby="community-rating" className="space-y-1">
        <h2 id="community-rating" className="text-lg font-semibold">
          {s.communityRating}
        </h2>
        <p className="text-muted">{s.noRatings}</p>
      </section>
    );
  }

  const max = Math.max(...summary.histogram.map((b) => b.count), 1);
  return (
    <section aria-labelledby="community-rating" className="space-y-3">
      <h2 id="community-rating" className="text-lg font-semibold">
        {s.communityRating}
      </h2>
      <div className="flex items-end gap-6">
        <p className="flex items-center gap-2 text-4xl font-bold">
          <Star className="text-star h-7 w-7 fill-current" aria-hidden />
          <span aria-label={`${formatRating(summary.average ?? 0)} de 5 estrelas`}>
            {formatRating(summary.average ?? 0)}
          </span>
        </p>
        <p className="text-muted text-sm">{s.ratingsCount(summary.total)}</p>
      </div>
      <ul className="flex h-20 items-end gap-1" aria-label="Distribuição das avaliações">
        {summary.histogram.map((b) => (
          <li
            key={b.rating}
            className="flex h-full flex-1 flex-col justify-end"
            title={`${formatRating(b.rating)}: ${b.count}`}
          >
            <span className="sr-only">{`${formatRating(b.rating)} estrelas: ${b.count}`}</span>
            <div
              aria-hidden
              className="bg-accent rounded-t"
              style={{ height: `${b.count === 0 ? 2 : Math.max(8, (b.count / max) * 100)}%` }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
