import type { Metadata } from "next";
import { DiaryView } from "@/features/logs/components/diary-view";
import { parseDiaryFilters } from "@/features/logs/schemas/diary";
import { requireUserId } from "@/lib/auth-guard";
import { messages } from "@/lib/messages/pt-BR";

export const metadata: Metadata = { title: messages.diary.title };

export default async function DiaryPage({ searchParams }: PageProps<"/diario">) {
  const userId = await requireUserId("/diario");
  const filters = parseDiaryFilters(await searchParams);
  return (
    <DiaryView viewerId={userId} filters={filters} action="/diario" title={messages.diary.title} />
  );
}
