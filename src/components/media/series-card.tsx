import Link from "next/link";
import { Poster } from "./poster";

export interface SeriesCardData {
  href: string;
  name: string;
  year: number | string | null;
  posterPath: string | null;
}

export function SeriesCard({ href, name, year, posterPath }: SeriesCardData) {
  return (
    <Link href={href} className="group block min-w-0">
      <Poster
        path={posterPath}
        name={name}
        className="group-hover:border-accent transition-colors"
      />
      <p className="mt-2 truncate text-sm font-medium" title={name}>
        {name}
      </p>
      {year ? <p className="text-muted text-xs">{year}</p> : null}
    </Link>
  );
}

export function SeriesGrid({ items }: { items: SeriesCardData[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((item) => (
        <li key={item.href} className="min-w-0">
          <SeriesCard {...item} />
        </li>
      ))}
    </ul>
  );
}

export function SeriesGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      aria-hidden
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="bg-surface-2 aspect-[2/3] animate-pulse rounded-md" />
          <div className="bg-surface-2 mt-2 h-4 w-3/4 animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}
