import { Suspense } from "react";
import {
  SeriesGrid,
  SeriesGridSkeleton,
  type SeriesCardData,
} from "@/components/media/series-card";
import { logger } from "@/lib/logger";
import { messages } from "@/lib/messages/pt-BR";

interface ShelfProps {
  title: string;
  /** Leading posters to load eagerly (the first shelf is above the fold). */
  priorityCount?: number;
  load: () => Promise<SeriesCardData[]>;
}

async function ShelfItems({ load, priorityCount }: Pick<ShelfProps, "load" | "priorityCount">) {
  const items = await load().catch((e) => {
    logger.warn("home shelf failed", { error: String(e) });
    return null;
  });
  if (!items) return <p className="text-muted text-sm">{messages.home.sectionError}</p>;
  return <SeriesGrid items={items} priorityCount={priorityCount} />;
}

/** A titled row of posters that streams in behind a skeleton and degrades to a message if TMDB is down. */
export function Shelf({ title, load, priorityCount }: ShelfProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <Suspense fallback={<SeriesGridSkeleton />}>
        <ShelfItems load={load} priorityCount={priorityCount} />
      </Suspense>
    </section>
  );
}
