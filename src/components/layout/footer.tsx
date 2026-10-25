import Image from "next/image";
import Link from "next/link";
import { messages } from "@/lib/messages/pt-BR";

export function Footer() {
  return (
    <footer className="border-border border-t">
      <div className="text-muted mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer">
            <Image src="/tmdb-logo.svg" alt="TMDB" width={74} height={53} unoptimized />
          </a>
          <p className="max-w-xl">{messages.footer.tmdbNotice}</p>
        </div>
        <Link href="/sobre" className="hover:text-foreground">
          {messages.nav.about}
        </Link>
      </div>
    </footer>
  );
}
