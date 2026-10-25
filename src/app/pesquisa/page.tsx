import type { Metadata } from "next";
import { SearchResults } from "@/features/series/components/search-results";
import { searchSeries } from "@/features/series/server/search";
import { messages } from "@/lib/messages/pt-BR";

export async function generateMetadata({
  searchParams,
}: PageProps<"/pesquisa">): Promise<Metadata> {
  const { q } = await searchParams;
  const term = typeof q === "string" ? q.trim() : "";
  return { title: term ? `${messages.search.resultsFor} "${term}"` : messages.search.label };
}

export default async function SearchPage({ searchParams }: PageProps<"/pesquisa">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const outcome = await searchSeries(query);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {query ? `${messages.search.resultsFor} “${query}”` : messages.search.label}
      </h1>
      {outcome.status === "too_short" ? (
        <p className="text-muted">{messages.search.promptMinChars}</p>
      ) : outcome.status === "error" ? (
        <p role="alert" className="text-danger">
          {messages.search.error}
        </p>
      ) : outcome.results.length === 0 ? (
        <div>
          <p className="font-medium">{messages.search.noResults}</p>
          <p className="text-muted">{messages.search.noResultsHint}</p>
        </div>
      ) : (
        <SearchResults
          // Remount when the query changes so pagination state resets.
          key={query}
          query={query}
          initial={outcome.results}
          initialPage={outcome.page}
          totalPages={outcome.totalPages}
        />
      )}
    </div>
  );
}
