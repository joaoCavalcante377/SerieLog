"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/messages/pt-BR";
import { tmdbImageUrl } from "@/lib/tmdb/images";
import type { SearchResultItem } from "../server/search";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; results: SearchResultItem[] }
  | { kind: "error" };

interface Props {
  /** Called when the user picks a series. Resolves when the pick has been handled. */
  onPick: (item: SearchResultItem) => Promise<void> | void;
  /** TMDB ids that are already chosen (shown as disabled). */
  pickedIds?: ReadonlySet<number>;
  pickLabel: string;
  pickedLabel: string;
  label?: string;
}

/** Search-as-you-type series chooser (TMDB, via /api/search), reused by lists and favorites. */
export function SeriesPicker({ onPick, pickedIds, pickLabel, pickedLabel, label }: Props) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [fetched, setFetched] = useState<State>({ kind: "idle" });
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setFetched({ kind: "loading" });
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { results: SearchResultItem[] };
        setFetched({ kind: "ok", results: data.results.slice(0, 8) });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setFetched({ kind: "error" });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const state: State = query.trim().length < MIN_CHARS ? { kind: "idle" } : fetched;

  async function pick(item: SearchResultItem) {
    setBusyId(item.tmdbId);
    try {
      await onPick(item);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label ?? messages.search.label}
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={messages.nav.searchPlaceholder}
          className="bg-surface border-border h-11 w-full rounded-md border px-3"
        />
      </div>
      <div aria-live="polite">
        {state.kind === "loading" ? (
          <p className="text-muted text-sm">{messages.search.searching}</p>
        ) : null}
        {state.kind === "error" ? (
          <p role="alert" className="text-danger text-sm">
            {messages.search.error}
          </p>
        ) : null}
        {state.kind === "ok" && state.results.length === 0 ? (
          <p className="text-muted text-sm">{messages.search.noResults}</p>
        ) : null}
      </div>
      {state.kind === "ok" && state.results.length > 0 ? (
        <ul className="divide-border border-border divide-y rounded-md border">
          {state.results.map((r) => {
            const thumb = tmdbImageUrl(r.posterPath, "w185");
            const picked = pickedIds?.has(r.tmdbId) ?? false;
            return (
              <li key={r.tmdbId} className="flex items-center gap-3 p-2">
                <span className="bg-surface-2 relative h-14 w-10 shrink-0 overflow-hidden rounded">
                  {thumb ? (
                    <Image
                      src={thumb}
                      alt=""
                      fill
                      sizes="40px"
                      unoptimized
                      className="object-cover"
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  {r.year ? <span className="text-muted text-xs">{r.year}</span> : null}
                </span>
                <Button
                  variant="secondary"
                  className="h-9 px-3 text-sm"
                  disabled={picked || busyId !== null}
                  onClick={() => pick(r)}
                  aria-label={`${picked ? pickedLabel : pickLabel}: ${r.name}`}
                >
                  {picked ? pickedLabel : pickLabel}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
