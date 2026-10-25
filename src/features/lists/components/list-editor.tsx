"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Poster } from "@/components/media/poster";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SortableList } from "@/components/ui/sortable-list";
import { SeriesPicker } from "@/features/series/components/series-picker";
import { seriesPath } from "@/lib/domain/slug";
import { messages } from "@/lib/messages/pt-BR";
import {
  addSeriesToListAction,
  deleteListAction,
  removeListItemAction,
  reorderListAction,
  updateListItemNoteAction,
} from "../actions/list-actions";
import { NOTE_MAX } from "../schemas/list";

const m = messages.lists;

export interface EditorItem {
  seriesId: string;
  tmdbId: number;
  name: string;
  year: number | null;
  posterPath: string | null;
  note: string | null;
}

interface Props {
  listId: string;
  username: string;
  isRanked: boolean;
  items: EditorItem[];
}

export function ListEditor({ listId, username, isRanked, items: serverItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(serverItems);
  const [seenServer, setSeenServer] = useState(serverItems);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  // The server re-rendered (after add/remove/refresh): adopt its order.
  if (serverItems !== seenServer) {
    setSeenServer(serverItems);
    setItems(serverItems);
  }

  async function onReorder(next: EditorItem[]) {
    const previous = items;
    setItems(next); // optimistic
    const result = await reorderListAction(
      listId,
      next.map((i) => i.seriesId),
    );
    if (!result.ok) {
      setItems(previous);
      toast.error(
        result.error.code === "CONFLICT" ? result.error.message : messages.common.saveFailed,
      );
      if (result.error.code === "CONFLICT") router.refresh();
      return;
    }
    toast.success(m.reorderSaved);
    router.refresh();
  }

  async function remove(item: EditorItem) {
    const previous = items;
    setItems((cur) => cur.filter((i) => i.seriesId !== item.seriesId));
    const result = await removeListItemAction(listId, item.seriesId);
    if (!result.ok) {
      setItems(previous);
      return void toast.error(messages.common.saveFailed);
    }
    router.refresh();
  }

  async function saveNote(item: EditorItem, note: string) {
    if ((item.note ?? "") === note.trim()) return;
    const result = await updateListItemNoteAction(listId, item.seriesId, note);
    if (!result.ok) {
      return void toast.error(result.error.fieldErrors?.note ?? messages.common.saveFailed);
    }
    setItems((cur) =>
      cur.map((i) => (i.seriesId === item.seriesId ? { ...i, note: note.trim() || null } : i)),
    );
  }

  async function add(tmdbId: number) {
    const result = await addSeriesToListAction(listId, tmdbId);
    if (!result.ok) return void toast.error(result.error.message);
    router.refresh();
  }

  async function deleteList() {
    setBusy(true);
    const result = await deleteListAction(listId);
    setBusy(false);
    if (!result.ok && result.error.code !== "NOT_FOUND") {
      return void toast.error(messages.common.saveFailed);
    }
    toast.success(m.deleted);
    router.push(`/${username}/listas`);
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="add-heading" className="space-y-3">
        <h2 id="add-heading" className="text-lg font-semibold">
          {m.addSeries}
        </h2>
        <SeriesPicker
          label={m.addSearchLabel}
          pickLabel={messages.common.add}
          pickedLabel={m.alreadyInList}
          pickedIds={new Set(items.map((i) => i.tmdbId))}
          onPick={(r) => add(r.tmdbId)}
        />
      </section>

      <section aria-labelledby="items-heading" className="space-y-3">
        <h2 id="items-heading" className="text-lg font-semibold">
          {m.seriesCount(items.length)}
        </h2>
        {items.length === 0 ? (
          <p className="text-muted">{m.empty}</p>
        ) : (
          <SortableList
            items={items}
            getId={(i) => i.seriesId}
            getLabel={(i) => i.name}
            handleLabel={m.dragHandle}
            onReorder={onReorder}
            renderItem={(item, index) => (
              <div className="flex gap-3">
                <div className="w-14 shrink-0">
                  <Poster path={item.posterPath} name={item.name} size="w185" sizes="56px" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={seriesPath(item.tmdbId, item.name)}
                      className="min-w-0 font-medium hover:underline"
                    >
                      {isRanked ? <span className="text-muted mr-2">#{index + 1}</span> : null}
                      {item.name}
                      {item.year ? (
                        <span className="text-muted ml-2 text-sm">{item.year}</span>
                      ) : null}
                    </Link>
                    <button
                      type="button"
                      aria-label={m.removeItem(item.name)}
                      onClick={() => remove(item)}
                      className="text-muted inline-flex h-11 w-11 shrink-0 items-center justify-center hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <textarea
                    aria-label={`${m.noteLabel}: ${item.name}`}
                    placeholder={m.notePlaceholder}
                    defaultValue={item.note ?? ""}
                    maxLength={NOTE_MAX}
                    rows={2}
                    onBlur={(e) => saveNote(item, e.target.value)}
                    className="bg-surface border-border w-full rounded-md border px-2 py-1 text-sm"
                  />
                </div>
              </div>
            )}
          />
        )}
      </section>

      <section className="border-border space-y-3 border-t pt-6">
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          {m.deleteList}
        </Button>
      </section>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={m.deleteTitle}>
        <p className="text-muted text-sm">{m.deleteBody}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={busy}>
            {messages.common.cancel}
          </Button>
          <Button variant="danger" onClick={deleteList} disabled={busy}>
            {messages.common.delete}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
