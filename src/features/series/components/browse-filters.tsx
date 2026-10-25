import Link from "next/link";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/messages/pt-BR";
import type { TmdbGenre } from "@/lib/tmdb/types";
import type { BrowseParams } from "../schemas/browse";

const fieldClass = "bg-surface border-border h-11 rounded-md border px-3";

/** Plain GET form: filters live in the URL (shareable, survives reload) and work without JS. */
export function BrowseFilters({ params, genres }: { params: BrowseParams; genres: TmdbGenre[] }) {
  const b = messages.browse;
  return (
    <form method="get" action="/series" className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="genre" className="text-sm font-medium">
          {b.genre}
        </label>
        <select id="genre" name="genre" defaultValue={params.genre ?? ""} className={fieldClass}>
          <option value="">{b.allGenres}</option>
          {genres.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="year" className="text-sm font-medium">
          {b.year}
        </label>
        <input
          id="year"
          name="year"
          type="number"
          inputMode="numeric"
          min={1900}
          max={2100}
          defaultValue={params.year ?? ""}
          className={`${fieldClass} w-28`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="sort" className="text-sm font-medium">
          {b.sort}
        </label>
        <select id="sort" name="sort" defaultValue={params.sort} className={fieldClass}>
          <option value="popularity">{b.sortPopularity}</option>
          <option value="rating">{b.sortRating}</option>
          <option value="date">{b.sortDate}</option>
        </select>
      </div>
      <Button type="submit">{b.apply}</Button>
      <Link
        href="/series"
        className="text-muted hover:text-foreground flex h-11 items-center px-2 text-sm"
      >
        {b.clear}
      </Link>
    </form>
  );
}
