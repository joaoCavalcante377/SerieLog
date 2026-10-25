import type { Metadata } from "next";
import { ListForm } from "@/features/lists/components/list-form";
import { requireUserId } from "@/lib/auth-guard";
import { messages } from "@/lib/messages/pt-BR";

export const metadata: Metadata = { title: messages.lists.createTitle };

export default async function NewListPage() {
  await requireUserId("/listas/nova");
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">{messages.lists.createTitle}</h1>
      <ListForm mode="create" />
    </div>
  );
}
