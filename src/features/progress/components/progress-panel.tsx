"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/messages/pt-BR";
import { markSeriesAction, resumeWatchingAction } from "../actions/progress-actions";
import { useCompletionPrompt } from "./completion-prompt";

const p = messages.progress;

interface Props {
  seriesId: string;
  watchedAired: number;
  totalAired: number;
  percent: number;
  /** The user's latest log is COMPLETED but aired episodes are unwatched (new episodes arrived). */
  hasNewEpisodes: boolean;
}

export function ProgressPanel({
  seriesId,
  watchedAired,
  totalAired,
  percent,
  hasNewEpisodes,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const promptCompletion = useCompletionPrompt();

  function markAll(watched: boolean) {
    setError(false);
    startTransition(async () => {
      const result = await markSeriesAction(seriesId, watched);
      if (!result.ok) {
        setError(true);
        return void toast.error(messages.common.saveFailed);
      }
      router.refresh();
      if (result.data.promptCompletion) promptCompletion();
    });
  }

  function resume() {
    startTransition(async () => {
      const result = await resumeWatchingAction(seriesId);
      if (!result.ok) return void toast.error(messages.common.saveFailed);
      toast.success(p.resumed);
      router.refresh();
    });
  }

  if (totalAired === 0) return null;
  return (
    <div className="space-y-2" aria-label={p.title} role="group">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{p.title}</span>
        <span className="text-muted">
          {p.watchedOf(watchedAired, totalAired)} · {p.percent(percent)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={p.title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="bg-surface-2 h-2 overflow-hidden rounded-full"
      >
        <div className="bg-accent h-full" style={{ width: `${percent}%` }} />
      </div>

      {hasNewEpisodes ? (
        <div className="bg-surface-2 border-border flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
          <span className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
            {p.newEpisodes}
          </span>
          <span className="text-muted flex-1">{p.newEpisodesBody}</span>
          <Button variant="secondary" onClick={resume} disabled={pending}>
            {p.resume}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {percent < 100 ? (
          <Button variant="secondary" onClick={() => markAll(true)} disabled={pending}>
            {p.markSeries}
          </Button>
        ) : null}
        {watchedAired > 0 ? (
          <Button variant="secondary" onClick={() => markAll(false)} disabled={pending}>
            {p.unmarkSeries}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-500">
          {messages.common.saveFailed}
        </p>
      ) : null}
    </div>
  );
}
