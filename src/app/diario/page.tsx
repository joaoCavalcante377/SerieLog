import type { Metadata } from "next";
import { requireUserId } from "@/lib/auth-guard";
import { messages } from "@/lib/messages/pt-BR";

export const metadata: Metadata = { title: messages.diary.title };

// Protected route. The diary content itself is built in Phase 4.
export default async function DiaryPage() {
  await requireUserId("/diario");
  return <h1 className="text-2xl font-bold">{messages.diary.title}</h1>;
}
