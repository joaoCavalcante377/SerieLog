import type { Metadata } from "next";
import { auth } from "@/auth";
import { DiaryView } from "@/features/logs/components/diary-view";
import { parseDiaryFilters } from "@/features/logs/schemas/diary";
import { messages } from "@/lib/messages/pt-BR";

export async function generateMetadata({
  params,
}: PageProps<"/[username]/diario">): Promise<Metadata> {
  const { username } = await params;
  return { title: messages.diary.ofUser(`@${username}`) };
}

export default async function PublicDiaryPage({
  params,
  searchParams,
}: PageProps<"/[username]/diario">) {
  const { username } = await params;
  const viewerId = (await auth())?.user?.id ?? null;
  return (
    <DiaryView
      username={username}
      viewerId={viewerId}
      filters={parseDiaryFilters(await searchParams)}
      action={`/${username}/diario`}
      title={messages.diary.ofUser(`@${username}`)}
    />
  );
}
