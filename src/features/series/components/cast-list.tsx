import Image from "next/image";
import { messages } from "@/lib/messages/pt-BR";
import { tmdbImageUrl } from "@/lib/tmdb/images";
import type { TmdbCastMember } from "@/lib/tmdb/types";

export function CastList({ cast }: { cast: TmdbCastMember[] }) {
  if (cast.length === 0) return null;
  return (
    <section aria-labelledby="cast-heading" className="space-y-3">
      <h2 id="cast-heading" className="text-xl font-semibold">
        {messages.series.cast}
      </h2>
      <ul className="flex gap-4 overflow-x-auto pb-2">
        {cast.map((m) => {
          const photo = tmdbImageUrl(m.profile_path, "w185");
          return (
            <li key={m.id} className="w-24 shrink-0 text-center">
              <div className="bg-surface-2 border-border relative mx-auto aspect-[2/3] w-24 overflow-hidden rounded-md border">
                {photo ? (
                  <Image src={photo} alt="" fill sizes="96px" className="object-cover" />
                ) : null}
              </div>
              <p className="mt-1.5 text-sm leading-tight font-medium">{m.name}</p>
              <p className="text-muted text-xs leading-tight">{m.character}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
