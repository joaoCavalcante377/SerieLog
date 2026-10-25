import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { WatchlistView } from "@/features/watchlist/components/watchlist-view";
import { resolveWatchlistAccess } from "@/features/watchlist/queries/watchlist";
import { parseWatchlistParams } from "@/features/watchlist/schemas/watchlist";
import { messages } from "@/lib/messages/pt-BR";

export async function generateMetadata({
  params,
}: PageProps<"/[username]/watchlist">): Promise<Metadata> {
  const { username } = await params;
  return { title: messages.watchlist.ofUser(`@${username}`) };
}

export default async function PublicWatchlistPage({
  params,
  searchParams,
}: PageProps<"/[username]/watchlist">) {
  const { username } = await params;
  const viewerId = (await auth())?.user?.id ?? null;
  const access = await resolveWatchlistAccess(username, viewerId);

  if (access.status === "not_found") notFound();
  if (access.status === "private") {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">{messages.watchlist.ofUser(`@${username}`)}</h1>
        <p className="text-muted mt-3">{messages.watchlist.private}</p>
      </div>
    );
  }
  return (
    <WatchlistView
      userId={access.userId}
      params={parseWatchlistParams(await searchParams)}
      basePath={`/${username}/watchlist`}
      title={messages.watchlist.ofUser(`@${username}`)}
      isOwner={access.isOwner}
    />
  );
}
