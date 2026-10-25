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
  load: () => Promise<SeriesCardData[]>;
}

async function ShelfItems({ load }: Pick<ShelfProps, "load">) {
  const items = await load().catch((e) => {
    logger.warn("home shelf failed", { error: String(e) });
    return null;
  });
  if (!items) return <p className="text-muted text-sm">{messages.home.sectionError}</p>;
  return <SeriesGrid items={items} />;
}

/** A titled row of posters that streams in behind a skeleton and degrades to a message if TMDB is down. */
export function Shelf({ title, load }: ShelfProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <Suspense fallback={<SeriesGridSkeleton />}>
        <ShelfItems load={load} />
      </Suspense>
    </section>
  );
}
