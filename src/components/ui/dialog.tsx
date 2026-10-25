"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Modal built on the native <dialog>: focus is trapped and Esc closes it without extra JS. */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        // Clicking the backdrop (the dialog element itself) closes it.
        if (e.target === ref.current) onClose();
      }}
      className="bg-surface text-foreground border-border m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border p-0 shadow-xl backdrop:bg-black/60"
    >
      {open ? (
        <div className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
