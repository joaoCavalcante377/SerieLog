"use client";

import { Bookmark, BookmarkCheck, PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StarRating } from "@/components/ui/star-rating";
import {
  addToWatchlistAction,
  removeFromWatchlistAction,
} from "@/features/watchlist/actions/watchlist-actions";
import { buildLoginRedirect } from "@/lib/redirects";
import { messages } from "@/lib/messages/pt-BR";
import { createLogAction, rateSeriesAction } from "../actions/log-actions";
import type { LogFormInput } from "../schemas/log";
import { LogForm } from "./log-form";

const m = messages.logs;
const w = messages.watchlist;

const STATUS_LABEL = {
  WATCHING: m.statusWatching,
  COMPLETED: m.statusCompleted,
  DROPPED: m.statusDropped,
} as const;

interface Props {
  seriesId: string;
  /** Canonical path of this page, used to return after login. */
  returnPath: string;
  today: string;
  /** null when logged out. */
  state: {
    onWatchlist: boolean;
    status: keyof typeof STATUS_LABEL | null;
    rating: number | null;
  } | null;
  /** Action queued before the login redirect (e.g. "watchlist"). */
  pendingAction?: string;
}

const EMPTY_LOG: LogFormInput = {
  status: "COMPLETED",
  startedAt: "",
  finishedAt: "",
  rating: null,
  reviewText: "",
  containsSpoilers: false,
  isRewatch: false,
};

export function SeriesActions({ seriesId, returnPath, today, state, pendingAction }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [logOpen, setLogOpen] = useState(false);
  const [onWatchlist, setOnWatchlist] = useOptimistic(state?.onWatchlist ?? false);
  const [rating, setRating] = useOptimistic(state?.rating ?? null);
  const ranPending = useRef(false);

  /** Logged-out visitors are sent to /entrar and come back with the action still queued. */
  function requireLogin(action: string): boolean {
    if (state) return false;
    router.push(buildLoginRedirect(`${returnPath}?acao=${action}`));
    return true;
  }

  function toggleWatchlist() {
    if (requireLogin("watchlist")) return;
    const next = !onWatchlist;
    startTransition(async () => {
      setOnWatchlist(next);
      const result = next
        ? await addToWatchlistAction(seriesId)
        : await removeFromWatchlistAction(seriesId);
      if (!result.ok) return void toast.error(messages.common.saveFailed);
      toast.success(next ? w.added : w.removed);
      router.refresh();
    });
  }

  function changeRating(value: number | null) {
    startTransition(async () => {
      setRating(value);
      const result = await rateSeriesAction(seriesId, value);
      if (!result.ok) return void toast.error(messages.common.saveFailed);
      router.refresh();
    });
  }

  // SER-05: finish the action the visitor asked for before logging in.
  useEffect(() => {
    if (!state || pendingAction !== "watchlist" || ranPending.current) return;
    ranPending.current = true;
    void addToWatchlistAction(seriesId).then((result) => {
      if (result.ok) toast.success(w.added);
      router.replace(returnPath);
      router.refresh();
    });
  }, [state, pendingAction, seriesId, returnPath, router]);

  return (
    <section
      aria-label="Ações"
      className="bg-surface border-border space-y-4 rounded-lg border p-4"
    >
      <div className="flex flex-wrap gap-2">
        <Button
          variant={onWatchlist ? "secondary" : "primary"}
          onClick={toggleWatchlist}
          aria-pressed={state ? onWatchlist : undefined}
          className="gap-2"
        >
          {onWatchlist ? (
            <BookmarkCheck className="h-4 w-4" aria-hidden />
          ) : (
            <Bookmark className="h-4 w-4" aria-hidden />
          )}
          {onWatchlist ? w.inList : w.add}
        </Button>
        <Button
          variant="secondary"
          className="gap-2"
          onClick={() => (requireLogin("registrar") ? undefined : setLogOpen(true))}
        >
          <PenLine className="h-4 w-4" aria-hidden />
          {m.register}
        </Button>
      </div>

      {state ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">{m.yourRating}</p>
          <StarRating label={m.yourRating} value={rating} onChange={changeRating} />
          {state.status ? (
            <p className="text-muted text-sm">
              {m.currentStatus}: {STATUS_LABEL[state.status]}
            </p>
          ) : null}
        </div>
      ) : null}

      <Dialog open={logOpen} onClose={() => setLogOpen(false)} title={m.register}>
        <LogForm
          defaults={{ ...EMPTY_LOG, finishedAt: today, rating }}
          today={today}
          onSubmit={(values) => createLogAction({ ...values, seriesId })}
          onDone={() => {
            setLogOpen(false);
            toast.success(m.saved);
            router.refresh();
          }}
          onCancel={() => setLogOpen(false)}
        />
      </Dialog>
    </section>
  );
}
