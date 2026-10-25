import type { Metadata } from "next";
import { SITE_NAME } from "@/config/site";
import { messages } from "@/lib/messages/pt-BR";

export const metadata: Metadata = { title: messages.nav.about };

export default function AboutPage() {
  return (
    <article className="max-w-prose space-y-4">
      <h1 className="text-3xl font-bold">
        {messages.about.title} {SITE_NAME}
      </h1>
      <p>{messages.about.description}</p>
      <h2 className="pt-4 text-xl font-semibold">{messages.about.tmdbTitle}</h2>
      <p>{messages.footer.tmdbNotice}</p>
      <p>
        <a
          href="https://www.themoviedb.org"
          rel="noopener noreferrer"
          target="_blank"
          className="text-accent font-medium underline"
        >
          themoviedb.org
        </a>
      </p>
    </article>
  );
}
