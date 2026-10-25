"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { messages } from "@/lib/messages/pt-BR";
import { completeSeriesAction } from "../actions/progress-actions";

const p = messages.progress;

const PromptContext = createContext<() => void>(() => {});

/** Lets any progress control ask "Marcar série como concluída?" — the series is never completed silently. */
export function useCompletionPrompt() {
  return useContext(PromptContext);
}

export function CompletionPromptProvider({
  seriesId,
  children,
}: {
  seriesId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const show = useCallback(() => setOpen(true), []);

  async function confirm() {
    setBusy(true);
    const result = await completeSeriesAction(seriesId);
    setBusy(false);
    setOpen(false);
    if (!result.ok) return void toast.error(messages.common.saveFailed);
    toast.success(p.completed);
    router.refresh();
  }

  return (
    <PromptContext.Provider value={show}>
      {children}
      <Dialog open={open} onClose={() => setOpen(false)} title={p.completePromptTitle}>
        <p className="text-muted text-sm">{p.completePromptBody}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
            {p.completeNo}
          </Button>
          <Button onClick={confirm} disabled={busy}>
            {p.completeYes}
          </Button>
        </div>
      </Dialog>
    </PromptContext.Provider>
  );
}
