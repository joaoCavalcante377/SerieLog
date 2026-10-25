"use client";

import { useState } from "react";
import { SeriesGrid } from "@/components/media/series-card";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/messages/pt-BR";
import type { SearchResultItem } from "../server/search";

interface Props {
  query: string;
  initial: SearchResultItem[];
  initialPage: number;
  totalPages: number;
}

/** Full-page search results with "load more" pagination (deduplicated by TMDB id). */
export function SearchResults({ query, initial, initialPage, totalPages }: Props) {
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&page=${page + 1}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { results: SearchResultItem[]; page: number };
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.tmdbId));
        return [...prev, ...data.results.filter((r) => !seen.has(r.tmdbId))];
      });
      setPage(data.page);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <SeriesGrid
        items={items.map((r) => ({
          href: r.href,
          name: r.name,
          year: r.year,
          posterPath: r.posterPath,
        }))}
      />
      {failed ? (
        <p role="alert" className="text-danger text-sm">
          {messages.search.error}
        </p>
      ) : null}
      {page < totalPages ? (
        <div className="text-center">
          <Button variant="secondary" onClick={loadMore} disabled={loading}>
            {loading ? messages.common.loading : messages.common.loadMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
