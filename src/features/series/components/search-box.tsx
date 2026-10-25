"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { messages } from "@/lib/messages/pt-BR";
import { tmdbImageUrl } from "@/lib/tmdb/images";
import type { SearchResultItem } from "../server/search";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;
const MAX_RESULTS = 8;

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; results: SearchResultItem[] }
  | { kind: "error" };

export function SearchBox() {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [fetched, setState] = useState<State>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    // Short queries never hit the network.
    if (q.length < MIN_CHARS) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState({ kind: "loading" });
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { results: SearchResultItem[] };
        setState({ kind: "ok", results: data.results.slice(0, MAX_RESULTS) });
        setActive(-1);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({ kind: "error" });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Derived, not stored: a short query always shows nothing, whatever the last fetch returned.
  const state: State = query.trim().length < MIN_CHARS ? { kind: "idle" } : fetched;
  const results = state.kind === "ok" ? state.results : [];
  const showPanel = open && state.kind !== "idle";

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      setOpen(false);
      if (active >= 0 && results[active]) router.push(results[active].href);
      else if (query.trim().length >= MIN_CHARS) {
        router.push(`/pesquisa?q=${encodeURIComponent(query.trim())}`);
      }
    }
  }

  return (
    <div ref={rootRef} className="relative w-full max-w-xs">
      <input
        type="search"
        role="combobox"
        aria-label={messages.search.label}
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        placeholder={messages.nav.searchPlaceholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="bg-surface border-border h-10 w-full rounded-md border px-3 text-sm"
      />
      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          aria-label={messages.search.label}
          className="bg-surface border-border absolute top-11 right-0 left-0 z-50 max-h-96 overflow-auto rounded-md border shadow-lg"
        >
          {state.kind === "loading" ? (
            <p className="text-muted p-3 text-sm">{messages.search.searching}</p>
          ) : null}
          {state.kind === "error" ? (
            <p role="alert" className="text-danger p-3 text-sm">
              {messages.search.error}
            </p>
          ) : null}
          {state.kind === "ok" && results.length === 0 ? (
            <div className="p-3 text-sm">
              <p className="font-medium">{messages.search.noResults}</p>
              <p className="text-muted">{messages.search.noResultsHint}</p>
            </div>
          ) : null}
          {results.map((r, i) => {
            const thumb = tmdbImageUrl(r.posterPath, "w185");
            return (
              <Link
                key={r.tmdbId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                href={r.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 ${i === active ? "bg-surface-2" : "hover:bg-surface-2"}`}
              >
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
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  {r.year ? <span className="text-muted text-xs">{r.year}</span> : null}
                </span>
              </Link>
            );
          })}
          {results.length > 0 ? (
            <Link
              href={`/pesquisa?q=${encodeURIComponent(query.trim())}`}
              onClick={() => setOpen(false)}
              className="text-accent border-border block border-t px-3 py-2 text-sm"
            >
              {messages.search.seeAll}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
