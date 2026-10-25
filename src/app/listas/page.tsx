import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { ListGrid } from "@/features/lists/components/list-card";
import { getPopularLists } from "@/features/lists/queries/lists";
import { messages } from "@/lib/messages/pt-BR";

export const metadata: Metadata = {
  title: messages.lists.popular,
  description: messages.lists.popular,
};

export default async function ListsPage({ searchParams }: PageProps<"/listas">) {
  const { page: rawPage } = await searchParams;
  const page = Math.min(Math.max(1, Number(typeof rawPage === "string" ? rawPage : 1) || 1), 1000);
  const [{ lists, totalPages }, session] = await Promise.all([getPopularLists(page), auth()]);
  const m = messages.lists;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{m.popular}</h1>
        <Link
          href={session?.user ? "/listas/nova" : "/entrar?callbackUrl=/listas/nova"}
          className="bg-accent text-accent-foreground inline-flex h-11 items-center rounded-md px-5 font-medium"
        >
          {m.newList}
        </Link>
      </div>

      {lists.length === 0 ? (
        <p className="text-muted">{m.noLists}</p>
      ) : (
        <>
          <ListGrid lists={lists} />
          {totalPages > 1 ? (
            <nav
              aria-label={messages.browse.page}
              className="flex items-center justify-center gap-4 text-sm"
            >
              {page > 1 ? (
                <Link href={`/listas?page=${page - 1}`} className="text-accent underline">
                  {messages.browse.prev}
                </Link>
              ) : null}
              <span className="text-muted">
                {messages.browse.page} {page} / {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={`/listas?page=${page + 1}`} className="text-accent underline">
                  {messages.browse.next}
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
