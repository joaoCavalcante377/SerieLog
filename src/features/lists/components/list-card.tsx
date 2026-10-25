import { Lock } from "lucide-react";
import Link from "next/link";
import { messages } from "@/lib/messages/pt-BR";
import { tmdbImageUrl } from "@/lib/tmdb/images";
import type { ListCard as ListCardData } from "../queries/lists";

const m = messages.lists;

/** Title, owner and a strip of up to four posters. Plain <img> avoids layout cost for tiny covers. */
export function ListCard({ list, showOwner = true }: { list: ListCardData; showOwner?: boolean }) {
  const href = `/${list.user.username}/lista/${list.slug}`;
  return (
    <Link
      href={href}
      className="bg-surface border-border hover:border-accent block space-y-3 rounded-lg border p-3 transition-colors"
    >
      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => {
          const item = list.items[i];
          const src = tmdbImageUrl(item?.series.posterPath, "w185");
          return (
            <div key={i} className="bg-surface-2 aspect-[2/3] overflow-hidden rounded">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : null}
            </div>
          );
        })}
      </div>
      <div>
        <p className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{list.title}</span>
          {list.isPublic ? null : (
            <Lock
              className="text-muted h-3.5 w-3.5 shrink-0"
              aria-label={messages.common.privateList}
            />
          )}
        </p>
        <p className="text-muted text-xs">
          {m.seriesCount(list._count.items)}
          {showOwner && list.user.username ? ` · ${m.byUser(`@${list.user.username}`)}` : ""}
        </p>
      </div>
    </Link>
  );
}

export function ListGrid({ lists, showOwner }: { lists: ListCardData[]; showOwner?: boolean }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lists.map((l) => (
        <li key={l.id}>
          <ListCard list={l} showOwner={showOwner} />
        </li>
      ))}
    </ul>
  );
}
