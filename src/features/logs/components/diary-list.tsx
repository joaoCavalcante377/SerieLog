"use client";

import { EyeOff, MessageSquare, Pencil, Repeat, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Poster } from "@/components/media/poster";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StarRating } from "@/components/ui/star-rating";
import { seriesPath } from "@/lib/domain/slug";
import { messages } from "@/lib/messages/pt-BR";
import { deleteLogAction, loadDiaryPageAction, updateLogAction } from "../actions/log-actions";
import type { DiaryEntry } from "../queries/diary";
import type { DiaryFilters } from "../schemas/diary";
import type { LogFormInput } from "../schemas/log";
import { LogForm } from "./log-form";

const m = messages.logs;
const d = messages.diary;

const STATUS_LABEL = {
  WATCHING: m.statusWatching,
  COMPLETED: m.statusCompleted,
  DROPPED: m.statusDropped,
} as const;

const monthFormat = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const monthOf = (iso: string) => monthFormat.format(new Date(`${iso}T00:00:00Z`));
const dayOf = (iso: string) => iso.slice(8, 10);

interface Props {
  initialEntries: DiaryEntry[];
  initialHasMore: boolean;
  canEdit: boolean;
  filters: DiaryFilters;
  /** Set on a public diary (/[username]/diario); undefined for the owner's own page. */
  username?: string;
  today: string;
}

function toFormValues(e: DiaryEntry): LogFormInput {
  return {
    status: e.status,
    startedAt: e.startedAt ?? "",
    finishedAt: e.finishedAt ?? "",
    rating: e.rating,
    reviewText: e.reviewText ?? "",
    containsSpoilers: e.containsSpoilers,
    isRewatch: e.isRewatch,
  };
}

export function DiaryList({
  initialEntries,
  initialHasMore,
  canEdit,
  filters,
  username,
  today,
}: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [seenInitial, setSeenInitial] = useState(initialEntries);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [deleting, setDeleting] = useState<DiaryEntry | null>(null);
  const [busy, setBusy] = useState(false);

  // The server re-rendered (filters changed, or an edit was saved): start over from its data.
  if (initialEntries !== seenInitial) {
    setSeenInitial(initialEntries);
    setEntries(initialEntries);
    setHasMore(initialHasMore);
  }

  async function loadMore() {
    setLoading(true);
    const result = await loadDiaryPageAction({ username, filters, offset: entries.length });
    setLoading(false);
    if (!result.ok) return void toast.error(d.loadFailed);
    setEntries((prev) => {
      const seen = new Set(prev.map((e) => e.id));
      return [...prev, ...result.data.entries.filter((e) => !seen.has(e.id))];
    });
    setHasMore(result.data.hasMore);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const result = await deleteLogAction(deleting.id);
    setBusy(false);
    // NOT_FOUND means it was already deleted elsewhere: the list should drop it either way.
    if (result.ok || result.error.code === "NOT_FOUND") {
      setEntries((prev) => prev.filter((e) => e.id !== deleting.id));
      toast.success(m.deleted);
      router.refresh();
    } else {
      toast.error(result.error.message);
    }
    setDeleting(null);
  }

  const groupByMonth = filters.sort === "date";
  const rows = entries.map((e, i) => {
    const month = monthOf(e.diaryDate);
    const prev = i > 0 ? monthOf(entries[i - 1].diaryDate) : null;
    return { e, month, showHeader: groupByMonth && month !== prev };
  });

  return (
    <div className="space-y-4">
      <ul className="divide-border divide-y">
        {rows.map(({ e, month, showHeader }) => {
          return (
            <li key={e.id} className="py-3">
              {showHeader ? (
                <h2 className="text-muted -mt-1 mb-3 text-sm font-semibold tracking-wide capitalize">
                  {month}
                </h2>
              ) : null}
              <div className="flex items-center gap-3">
                <time
                  dateTime={e.diaryDate}
                  className="text-muted w-8 shrink-0 text-center text-lg tabular-nums"
                >
                  {dayOf(e.diaryDate)}
                </time>
                <div className="w-12 shrink-0">
                  <Poster path={e.posterPath} name={e.seriesName} size="w185" sizes="48px" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={seriesPath(e.seriesTmdbId, e.seriesName)}
                    className="block truncate font-medium hover:underline"
                  >
                    {e.seriesName}
                  </Link>
                  <p className="text-muted text-xs">
                    {e.seriesYear ? `${e.seriesYear} · ` : ""}
                    {STATUS_LABEL[e.status]}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StarRating value={e.rating} readOnly size="sm" />
                    {e.isRewatch ? (
                      <span title={d.rewatch} className="text-muted">
                        <Repeat className="h-4 w-4" aria-hidden />
                        <span className="sr-only">{d.rewatch}</span>
                      </span>
                    ) : null}
                    {e.reviewText ? (
                      <span title={d.hasReview} className="text-muted">
                        <MessageSquare className="h-4 w-4" aria-hidden />
                        <span className="sr-only">{d.hasReview}</span>
                      </span>
                    ) : null}
                    {e.containsSpoilers ? (
                      <span title={d.spoilers} className="text-muted">
                        <EyeOff className="h-4 w-4" aria-hidden />
                        <span className="sr-only">{d.spoilers}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
                {canEdit ? (
                  <div className="flex shrink-0">
                    <button
                      type="button"
                      aria-label={`${messages.common.edit}: ${e.seriesName}`}
                      onClick={() => setEditing(e)}
                      className="text-muted hover:text-foreground inline-flex h-11 w-11 items-center justify-center"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`${messages.common.delete}: ${e.seriesName}`}
                      onClick={() => setDeleting(e)}
                      className="text-muted inline-flex h-11 w-11 items-center justify-center hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {hasMore ? (
        <div className="text-center">
          <Button variant="secondary" onClick={loadMore} disabled={loading}>
            {loading ? messages.common.loading : messages.common.loadMore}
          </Button>
        </div>
      ) : null}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={m.edit}>
        {editing ? (
          <LogForm
            defaults={toFormValues(editing)}
            today={today}
            onSubmit={(values) => updateLogAction(editing.id, values)}
            onDone={() => {
              setEditing(null);
              toast.success(m.saved);
              router.refresh();
            }}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Dialog>

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title={m.deleteTitle}>
        <p className="text-muted text-sm">{m.deleteBody}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)} disabled={busy}>
            {messages.common.cancel}
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={busy}>
            {messages.common.delete}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
