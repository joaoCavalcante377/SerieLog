"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StarRating } from "@/components/ui/star-rating";
import { useCompletionPrompt } from "@/features/progress/components/completion-prompt";
import {
  markSeasonAction,
  rateSeasonAction,
  toggleEpisodeAction,
} from "@/features/progress/actions/progress-actions";
import { hasAired } from "@/lib/domain/dates";
import { formatDate } from "@/lib/format";
import { messages } from "@/lib/messages/pt-BR";

const s = messages.series;
const p = messages.progress;

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
  episodes: EpisodeRow[];
}

interface SeasonRatingValue {
  rating: number;
  reviewText: string | null;
}

interface Props {
  seasons: SeasonRow[];
  /** null when logged out: the list is read-only. */
  user: {
    watchedEpisodeIds: string[];
    seasonRatings: Record<string, SeasonRatingValue>;
  } | null;
}

const withIds = (set: Set<string>, ids: string[], present: boolean) => {
  const next = new Set(set);
  for (const id of ids) {
    if (present) next.add(id);
    else next.delete(id);
  }
  return next;
};

/** Interactive seasons for signed-in users (native <details>, keyboard accessible). Season 0 = specials. */
export function SeasonsAccordion({ seasons, user }: Props) {
  const router = useRouter();
  const promptCompletion = useCompletionPrompt();
  const now = new Date();

  const [watched, setWatched] = useState(() => new Set(user?.watchedEpisodeIds));
  const [seenIds, setSeenIds] = useState(user?.watchedEpisodeIds);
  const [ratings, setRatings] = useState(user?.seasonRatings ?? {});
  const [seenRatings, setSeenRatings] = useState(user?.seasonRatings);
  const [rating, setRating] = useState<SeasonRow | null>(null);
  // Episode rows are only rendered once a season has been opened: big series have 100+ episodes and
  // rendering/hydrating them all up front blocks the main thread.
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());

  // The server re-rendered (e.g. after router.refresh): adopt its data.
  if (user && user.watchedEpisodeIds !== seenIds) {
    setSeenIds(user.watchedEpisodeIds);
    setWatched(new Set(user.watchedEpisodeIds));
  }
  if (user && user.seasonRatings !== seenRatings) {
    setSeenRatings(user.seasonRatings);
    setRatings(user.seasonRatings);
  }

  async function toggleEpisode(episodeId: string, next: boolean) {
    setWatched((cur) => withIds(cur, [episodeId], next));
    const result = await toggleEpisodeAction(episodeId, next);
    if (!result.ok) {
      // Roll back just this episode and tell the user (LOG-13).
      setWatched((cur) => withIds(cur, [episodeId], !next));
      toast.error(messages.common.saveFailed);
      return;
    }
    router.refresh();
    if (result.data.promptCompletion) promptCompletion();
  }

  async function markSeason(season: SeasonRow, next: boolean) {
    const ids = season.episodes.filter((e) => !next || hasAired(e.airDate, now)).map((e) => e.id);
    const before = watched;
    setWatched((cur) => withIds(cur, ids, next));
    const result = await markSeasonAction(season.id, next);
    if (!result.ok) {
      setWatched(before);
      toast.error(messages.common.saveFailed);
      return;
    }
    router.refresh();
    if (result.data.promptCompletion) promptCompletion();
  }

  if (seasons.length === 0) return null;
  return (
    <section aria-labelledby="seasons-heading" className="space-y-3">
      <h2 id="seasons-heading" className="text-xl font-semibold">
        {s.seasons}
      </h2>
      <div className="space-y-2">
        {seasons.map((season) => {
          const airedIds = season.episodes.filter((e) => hasAired(e.airDate, now)).map((e) => e.id);
          const watchedAired = airedIds.filter((id) => watched.has(id)).length;
          const allWatched = airedIds.length > 0 && watchedAired === airedIds.length;
          const myRating = ratings[season.id];
          const seasonLabel = season.seasonNumber === 0 ? s.specials : season.name;

          return (
            <details
              key={season.id}
              className="bg-surface border-border group rounded-md border"
              onToggle={(e) => {
                if (e.currentTarget.open) setOpened((cur) => new Set(cur).add(season.id));
              }}
            >
              <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-x-3 px-4 py-2 font-medium">
                <span>{seasonLabel}</span>
                <span className="text-muted flex items-center gap-3 text-sm font-normal">
                  {myRating ? <StarRating value={myRating.rating} readOnly size="sm" /> : null}
                  {user && airedIds.length > 0
                    ? p.watchedCount(watchedAired, airedIds.length)
                    : s.episodesCount(season.episodes.length)}
                </span>
              </summary>

              {user ? (
                <div className="border-border flex flex-wrap items-center gap-2 border-t px-4 py-2">
                  <Button
                    variant="secondary"
                    className="h-9 px-3 text-sm"
                    disabled={airedIds.length === 0}
                    onClick={() => markSeason(season, !allWatched)}
                  >
                    {allWatched ? p.unmarkSeason : p.markSeason}
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-9 px-3 text-sm"
                    onClick={() => setRating(season)}
                  >
                    {p.seasonRatingAction}
                  </Button>
                </div>
              ) : null}

              {opened.has(season.id) ? (
                <ol className="border-border divide-border divide-y border-t">
                  {season.episodes.map((ep) => {
                    const aired = hasAired(ep.airDate, now);
                    const label = `${season.seasonNumber === 0 ? s.specials : `T${season.seasonNumber}`} ${s.episodeShort} ${ep.episodeNumber}`;
                    return (
                      <li key={ep.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                        {user ? (
                          <span
                            title={aired ? undefined : p.notAiredHint}
                            className="-my-2 -ml-3 flex h-11 w-11 shrink-0 items-center justify-center"
                          >
                            <input
                              type="checkbox"
                              className="h-5 w-5"
                              checked={watched.has(ep.id)}
                              disabled={!aired}
                              aria-label={p.markEpisode(`${label}: ${ep.name}`)}
                              onChange={(e) => toggleEpisode(ep.id, e.target.checked)}
                            />
                          </span>
                        ) : null}
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
              ) : null}
            </details>
          );
        })}
      </div>

      <Dialog open={rating !== null} onClose={() => setRating(null)} title={p.seasonRating}>
        {rating ? (
          <SeasonRatingForm
            key={rating.id}
            season={rating}
            current={ratings[rating.id]}
            onSaved={(value) => {
              setRatings((cur) => {
                const next = { ...cur };
                if (value) next[rating.id] = value;
                else delete next[rating.id];
                return next;
              });
              setRating(null);
              router.refresh();
            }}
            onCancel={() => setRating(null)}
          />
        ) : null}
      </Dialog>
    </section>
  );
}

function SeasonRatingForm({
  season,
  current,
  onSaved,
  onCancel,
}: {
  season: SeasonRow;
  current: SeasonRatingValue | undefined;
  onSaved: (value: SeasonRatingValue | null) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<number | null>(current?.rating ?? null);
  const [review, setReview] = useState(current?.reviewText ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await rateSeasonAction(season.id, value, review);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.fieldErrors?.reviewText ?? messages.common.saveFailed);
      return;
    }
    toast.success(p.seasonRatingSaved);
    onSaved(value === null ? null : { rating: value, reviewText: review.trim() || null });
  }

  return (
    <div className="space-y-4">
      <p className="text-muted text-sm">{season.seasonNumber === 0 ? s.specials : season.name}</p>
      <StarRating label={p.seasonRating} value={value} onChange={setValue} />
      <div className="space-y-1.5">
        <label htmlFor="season-review" className="text-sm font-medium">
          {p.seasonReview}
        </label>
        <textarea
          id="season-review"
          rows={3}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          className="bg-surface border-border w-full rounded-md border px-3 py-2"
        />
        <p className={`text-xs ${review.length > 1000 ? "text-danger" : "text-muted"}`}>
          {messages.logs.reviewCount(review.length, 1000)}
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {messages.common.cancel}
        </Button>
        <Button onClick={save} disabled={busy}>
          {messages.common.save}
        </Button>
      </div>
    </div>
  );
}
