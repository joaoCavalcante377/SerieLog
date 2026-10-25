import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Poster } from "@/components/media/poster";
import { getListView } from "@/features/lists/queries/lists";
import { seriesPath } from "@/lib/domain/slug";
import { formatYear } from "@/lib/format";
import { messages } from "@/lib/messages/pt-BR";

const m = messages.lists;

export async function generateMetadata({
  params,
}: PageProps<"/[username]/lista/[slug]">): Promise<Metadata> {
  const { username, slug } = await params;
  // Metadata is for the public: private lists never leak their title.
  const view = await getListView(username, slug, null);
  if (!view) return { title: m.title };
  const description = view.list.description?.slice(0, 160) ?? m.seriesCount(view.list.items.length);
  return {
    title: view.list.title,
    description,
    openGraph: { title: view.list.title, description, type: "website" },
  };
}

export default async function ListPage({ params }: PageProps<"/[username]/lista/[slug]">) {
  const { username, slug } = await params;
  const viewerId = (await auth())?.user?.id ?? null;
  const view = await getListView(username, slug, viewerId);
  if (!view) notFound(); // missing and private-to-others look the same on purpose
  const { list, owner, isOwner } = view;

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold tracking-tight [overflow-wrap:anywhere]">
          {list.title}
          {list.isPublic ? null : (
            <Lock className="text-muted h-5 w-5" aria-label="Lista privada" />
          )}
        </h1>
        <p className="text-muted text-sm">
          {owner.username ? (
            <Link href={`/${owner.username}`} className="hover:underline">
              {m.byUser(owner.name)}
            </Link>
          ) : (
            m.byUser(owner.name)
          )}
          {" · "}
          {m.seriesCount(list.items.length)}
        </p>
        {list.description ? (
          <p className="max-w-prose leading-relaxed whitespace-pre-line">{list.description}</p>
        ) : null}
        {isOwner ? (
          <Link
            href={`/${username}/lista/${slug}/editar`}
            className="bg-surface-2 border-border inline-flex h-11 items-center rounded-md border px-4 text-sm font-medium"
          >
            {m.edit}
          </Link>
        ) : null}
      </header>

      {list.items.length === 0 ? (
        <p className="text-muted">{m.empty}</p>
      ) : (
        <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {list.items.map((item, i) => (
            <li key={item.id} className="min-w-0">
              <Link href={seriesPath(item.series.tmdbId, item.series.name)} className="group block">
                <div className="relative">
                  <Poster
                    path={item.series.posterPath}
                    name={item.series.name}
                    className="group-hover:border-accent transition-colors"
                  />
                  {list.isRanked ? (
                    <span className="bg-background/85 absolute top-1 left-1 rounded px-1.5 py-0.5 text-sm font-bold tabular-nums">
                      {i + 1}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 truncate text-sm font-medium" title={item.series.name}>
                  {item.series.name}
                </p>
                <p className="text-muted text-xs">{formatYear(item.series.firstAirDate)}</p>
              </Link>
              {item.note ? (
                <p className="text-muted mt-1 text-xs whitespace-pre-line">{item.note}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
