"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Poster } from "@/components/media/poster";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SortableList } from "@/components/ui/sortable-list";
import { SeriesPicker } from "@/features/series/components/series-picker";
import { messages } from "@/lib/messages/pt-BR";
import {
  addFavoriteAction,
  removeFavoriteAction,
  reorderFavoritesAction,
} from "../actions/favorites-actions";

const m = messages.profile;
const MAX = 4;

export interface FavoriteItem {
  seriesId: string;
  tmdbId: number;
  name: string;
  posterPath: string | null;
}

/** Owner-only: opens a dialog to pick up to 4 series and drag them into order. */
export function FavoritesEditor({ favorites: serverFavorites }: { favorites: FavoriteItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(serverFavorites);
  const [seen, setSeen] = useState(serverFavorites);

  if (serverFavorites !== seen) {
    setSeen(serverFavorites);
    setItems(serverFavorites);
  }

  async function add(tmdbId: number) {
    const result = await addFavoriteAction(tmdbId);
    if (!result.ok) return void toast.error(result.error.message);
    toast.success(m.favoriteAdded);
    router.refresh();
  }

  async function remove(item: FavoriteItem) {
    const previous = items;
    setItems((cur) => cur.filter((i) => i.seriesId !== item.seriesId));
    const result = await removeFavoriteAction(item.seriesId);
    if (!result.ok) {
      setItems(previous);
      return void toast.error(messages.common.saveFailed);
    }
    router.refresh();
  }

  async function reorder(next: FavoriteItem[]) {
    const previous = items;
    setItems(next);
    const result = await reorderFavoritesAction(next.map((i) => i.seriesId));
    if (!result.ok) {
      setItems(previous);
      toast.error(result.error.message);
      router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" className="h-9 gap-2 px-3 text-sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" aria-hidden />
        {m.editFavorites}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={m.editFavorites}>
        <p className="text-muted text-sm">{m.favoritesHint}</p>
        {items.length > 0 ? (
          <SortableList
            items={items}
            getId={(i) => i.seriesId}
            getLabel={(i) => i.name}
            handleLabel={messages.lists.dragHandle}
            onReorder={reorder}
            renderItem={(item) => (
              <div className="flex items-center gap-3">
                <div className="w-10 shrink-0">
                  <Poster path={item.posterPath} name={item.name} size="w185" sizes="40px" />
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
                <button
                  type="button"
                  aria-label={m.removeFavorite(item.name)}
                  onClick={() => remove(item)}
                  className="text-muted inline-flex h-11 w-11 items-center justify-center hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            )}
          />
        ) : null}
        {items.length >= MAX ? (
          <p className="text-muted text-sm">{m.maxFavorites}</p>
        ) : (
          <SeriesPicker
            pickLabel={messages.common.add}
            pickedLabel={m.alreadyFavorite}
            pickedIds={new Set(items.map((i) => i.tmdbId))}
            onPick={(r) => add(r.tmdbId)}
          />
        )}
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {messages.common.close}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
