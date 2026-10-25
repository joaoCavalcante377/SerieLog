import Link from "next/link";
import { Star } from "lucide-react";
import { formatRating } from "@/lib/format";
import { messages } from "@/lib/messages/pt-BR";

interface Review {
  id: string;
  rating: { toString(): string } | null;
  reviewText: string | null;
  containsSpoilers: boolean;
  user: { name: string; username: string | null };
}

/** Reviews are rendered as plain text (line breaks only). Spoilers are collapsed behind a <details>. */
export function ReviewsList({ reviews }: { reviews: Review[] }) {
  const s = messages.series;
  return (
    <section aria-labelledby="reviews-heading" className="space-y-3">
      <h2 id="reviews-heading" className="text-xl font-semibold">
        {s.reviews}
      </h2>
      {reviews.length === 0 ? (
        <p className="text-muted">{s.noReviews}</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="bg-surface border-border space-y-2 rounded-md border p-4">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                {r.user.username ? (
                  <Link href={`/${r.user.username}`} className="font-medium hover:underline">
                    {s.byUser(r.user.name)}
                  </Link>
                ) : (
                  <span className="font-medium">{s.byUser(r.user.name)}</span>
                )}
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
                    {s.showSpoilers}
                  </summary>
                  <p className="whitespace-pre-line">{r.reviewText}</p>
                </details>
              ) : (
                <p className="whitespace-pre-line">{r.reviewText}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
