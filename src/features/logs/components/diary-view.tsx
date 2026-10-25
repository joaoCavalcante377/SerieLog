import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { todayInSaoPaulo } from "@/lib/domain/dates";
import { RATING_STEPS } from "@/lib/domain/rating";
import { formatRating } from "@/lib/format";
import { messages } from "@/lib/messages/pt-BR";
import { loadDiaryFor } from "../server/diary-access";
import type { DiaryFilters } from "../schemas/diary";
import { DiaryList } from "./diary-list";

const d = messages.diary;
const fieldClass = "bg-surface border-border h-11 rounded-md border px-3";

const STATUS_OPTIONS = [
  ["WATCHING", messages.logs.statusWatching],
  ["COMPLETED", messages.logs.statusCompleted],
  ["DROPPED", messages.logs.statusDropped],
] as const;

interface Props {
  /** Public view of someone else's diary; omit for the signed-in user's own. */
  username?: string;
  viewerId: string | null;
  filters: DiaryFilters;
  action: string;
  title: string;
}

export async function DiaryView({ username, viewerId, filters, action, title }: Props) {
  const result = await loadDiaryFor(username, viewerId, filters, 0);
  if (!result.ok) notFound();
  const { entries, hasMore, canEdit } = result.data;
  const hasFilters = Boolean(filters.year || filters.rating || filters.status);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>

      <form method="get" action={action} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="year" className="text-sm font-medium">
            {d.year}
          </label>
          <input
            id="year"
            name="year"
            type="number"
            inputMode="numeric"
            min={1900}
            max={2100}
            defaultValue={filters.year ?? ""}
            className={`${fieldClass} w-28`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rating" className="text-sm font-medium">
            {d.rating}
          </label>
          <select
            id="rating"
            name="rating"
            defaultValue={filters.rating ?? ""}
            className={fieldClass}
          >
            <option value="">{d.all}</option>
            {[...RATING_STEPS].reverse().map((r) => (
              <option key={r} value={r}>
                {formatRating(r)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            {d.status}
          </label>
          <select
            id="status"
            name="status"
            defaultValue={filters.status ?? ""}
            className={fieldClass}
          >
            <option value="">{d.all}</option>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sort" className="text-sm font-medium">
            {d.sort}
          </label>
          <select id="sort" name="sort" defaultValue={filters.sort} className={fieldClass}>
            <option value="date">{d.sortDate}</option>
            <option value="rating">{d.sortRating}</option>
          </select>
        </div>
        <Button type="submit">{d.apply}</Button>
        <Link
          href={action}
          className="text-muted hover:text-foreground flex h-11 items-center px-2 text-sm"
        >
          {d.clear}
        </Link>
      </form>

      {entries.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted">
            {hasFilters ? d.emptyFiltered : canEdit ? d.empty : d.emptyOther}
          </p>
          {!hasFilters && canEdit ? (
            <Link
              href="/series"
              className="bg-accent text-accent-foreground mt-4 inline-flex h-11 items-center rounded-md px-5 font-medium"
            >
              {d.emptyCta}
            </Link>
          ) : null}
        </div>
      ) : (
        <DiaryList
          initialEntries={entries}
          initialHasMore={hasMore}
          canEdit={canEdit}
          filters={filters}
          username={username}
          today={todayInSaoPaulo()}
        />
      )}
    </div>
  );
}
