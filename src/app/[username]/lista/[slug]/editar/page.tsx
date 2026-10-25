import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListEditor } from "@/features/lists/components/list-editor";
import { ListForm } from "@/features/lists/components/list-form";
import { getListView } from "@/features/lists/queries/lists";
import { requireUserId } from "@/lib/auth-guard";
import { messages } from "@/lib/messages/pt-BR";

const m = messages.lists;

export const metadata: Metadata = { title: m.editTitle, robots: { index: false } };

export default async function EditListPage({
  params,
}: PageProps<"/[username]/lista/[slug]/editar">) {
  const { username, slug } = await params;
  const userId = await requireUserId(`/${username}/lista/${slug}/editar`);
  const view = await getListView(username, slug, userId);
  // Not found, or someone else's list: indistinguishable on purpose.
  if (!view || !view.isOwner) notFound();
  const { list } = view;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{m.editTitle}</h1>
        <Link href={`/${username}/lista/${list.slug}`} className="text-accent text-sm underline">
          {m.viewList}
        </Link>
      </div>
      <ListForm
        mode="edit"
        listId={list.id}
        defaults={{
          title: list.title,
          description: list.description ?? "",
          isPublic: list.isPublic,
          isRanked: list.isRanked,
        }}
      />
      <ListEditor
        listId={list.id}
        username={username}
        isRanked={list.isRanked}
        items={list.items.map((i) => ({
          seriesId: i.series.id,
          tmdbId: i.series.tmdbId,
          name: i.series.name,
          year: i.series.firstAirDate?.getUTCFullYear() ?? null,
          posterPath: i.series.posterPath,
          note: i.note,
        }))}
      />
    </div>
  );
}
