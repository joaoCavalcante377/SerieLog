"use client";

import { ListPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { messages } from "@/lib/messages/pt-BR";
import { setSeriesInListAction } from "../actions/list-actions";

const m = messages.lists;

interface Props {
  seriesId: string;
  lists: { id: string; title: string; itemCount: number; hasSeries: boolean }[];
}

/** "Adicionar à lista": one checkbox per list of mine; toggling adds/removes the series. */
export function AddToListMenu({ seriesId, lists }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(() =>
    Object.fromEntries(lists.map((l) => [l.id, l.hasSeries])),
  );

  async function toggle(list: Props["lists"][number], present: boolean) {
    setState((cur) => ({ ...cur, [list.id]: present }));
    const result = await setSeriesInListAction(list.id, seriesId, present);
    if (!result.ok) {
      setState((cur) => ({ ...cur, [list.id]: !present }));
      // "already in list" etc. carry a specific message; anything else is generic.
      return void toast.error(
        result.error.code === "CONFLICT" ? result.error.message : messages.common.saveFailed,
      );
    }
    toast.success(present ? m.addedToList(list.title) : m.removedFromList(list.title));
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" className="gap-2" onClick={() => setOpen(true)}>
        <ListPlus className="h-4 w-4" aria-hidden />
        {m.addToList}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={m.addToList}>
        {lists.length === 0 ? (
          <p className="text-muted text-sm">{m.addToListEmpty}</p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-md border">
            {lists.map((l) => (
              <li key={l.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={state[l.id] ?? false}
                    onChange={(e) => toggle(l, e.target.checked)}
                  />
                  <span className="flex-1 truncate">{l.title}</span>
                  <span className="text-muted text-xs">{m.seriesCount(l.itemCount)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between gap-2">
          <Link href="/listas/nova" className="text-accent text-sm underline">
            {m.newList}
          </Link>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {messages.common.close}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
