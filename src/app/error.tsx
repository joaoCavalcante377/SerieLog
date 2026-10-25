"use client";

import { messages } from "@/lib/messages/pt-BR";

export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  return (
    <section role="alert" className="py-24 text-center">
      <h1 className="text-3xl font-bold">{messages.errors.errorTitle}</h1>
      <p className="text-muted mt-3">{messages.errors.errorBody}</p>
      <button
        type="button"
        onClick={reset}
        className="bg-accent text-accent-foreground mt-6 inline-flex h-11 items-center rounded-md px-5 font-medium"
      >
        {messages.common.retry}
      </button>
    </section>
  );
}
