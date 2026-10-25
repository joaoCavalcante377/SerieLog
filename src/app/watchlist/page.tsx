import type { Metadata } from "next";
import { WatchlistView } from "@/features/watchlist/components/watchlist-view";
import { parseWatchlistParams } from "@/features/watchlist/schemas/watchlist";
import { requireUserId } from "@/lib/auth-guard";
import { messages } from "@/lib/messages/pt-BR";

export const metadata: Metadata = { title: messages.watchlist.title };

export default async function WatchlistPage({ searchParams }: PageProps<"/watchlist">) {
  const userId = await requireUserId("/watchlist");
  return (
    <WatchlistView
      userId={userId}
      params={parseWatchlistParams(await searchParams)}
      basePath="/watchlist"
      title={messages.watchlist.title}
      isOwner
    />
  );
}
