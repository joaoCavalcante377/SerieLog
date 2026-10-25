import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ListGrid } from "@/features/lists/components/list-card";
import { getUserLists } from "@/features/lists/queries/lists";
import { db } from "@/lib/db";
import { messages } from "@/lib/messages/pt-BR";

export async function generateMetadata({
  params,
}: PageProps<"/[username]/listas">): Promise<Metadata> {
  const { username } = await params;
  return { title: messages.lists.ofUser(`@${username}`) };
}

export default async function UserListsPage({ params }: PageProps<"/[username]/listas">) {
  const { username } = await params;
  const user = await db.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true },
  });
  if (!user) notFound();

  const viewerId = (await auth())?.user?.id ?? null;
  const lists = await getUserLists(user.id, viewerId);
  const isOwner = viewerId === user.id;
  const m = messages.lists;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{m.ofUser(`@${username}`)}</h1>
        {isOwner ? (
          <Link
            href="/listas/nova"
            className="bg-accent text-accent-foreground inline-flex h-11 items-center rounded-md px-5 font-medium"
          >
            {m.newList}
          </Link>
        ) : null}
      </div>
      {lists.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted">{m.noLists}</p>
          {isOwner ? (
            <Link
              href="/listas/nova"
              className="bg-accent text-accent-foreground mt-4 inline-flex h-11 items-center rounded-md px-5 font-medium"
            >
              {m.noListsCta}
            </Link>
          ) : null}
        </div>
      ) : (
        <ListGrid lists={lists} showOwner={false} />
      )}
    </div>
  );
}
