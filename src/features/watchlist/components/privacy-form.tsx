"use client";

import { useState } from "react";
import { toast } from "sonner";
import { messages } from "@/lib/messages/pt-BR";
import { setWatchlistPublicAction } from "../actions/watchlist-actions";

export function WatchlistPrivacyForm({ initialPublic }: { initialPublic: boolean }) {
  const [value, setValue] = useState(initialPublic);
  const [pending, setPending] = useState(false);

  async function onChange(next: boolean) {
    const previous = value;
    setValue(next);
    setPending(true);
    const result = await setWatchlistPublicAction(next);
    setPending(false);
    if (result.ok) return void toast.success(messages.watchlist.privacySaved);
    setValue(previous);
    toast.error(messages.common.saveFailed);
  }

  return (
    <div className="space-y-1">
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={value}
          disabled={pending}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby="privacy-hint"
        />
        {messages.watchlist.privacy}
      </label>
      <p id="privacy-hint" className="text-muted text-sm">
        {messages.watchlist.privacyHint}
      </p>
    </div>
  );
}
