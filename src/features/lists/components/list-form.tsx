"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { applyServerErrors } from "@/lib/form-errors";
import { messages } from "@/lib/messages/pt-BR";
import { createListAction, updateListAction } from "../actions/list-actions";
import { listSchema, type ListInput } from "../schemas/list";

const m = messages.lists;

type Props =
  { mode: "create"; defaults?: ListInput } | { mode: "edit"; listId: string; defaults: ListInput };

const EMPTY: ListInput = { title: "", description: "", isPublic: true, isRanked: false };

export function ListForm(props: Props) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ListInput>({
    resolver: zodResolver(listSchema),
    defaultValues: props.defaults ?? EMPTY,
  });

  async function onSubmit(values: ListInput) {
    if (props.mode === "create") {
      const result = await createListAction(values);
      if (!result.ok) {
        if (!applyServerErrors(setError, result)) toast.error(result.error.message);
        return;
      }
      toast.success(m.created);
      router.push(`/${result.data.username}/lista/${result.data.slug}/editar`);
      return;
    }
    const result = await updateListAction(props.listId, values);
    if (!result.ok) {
      if (!applyServerErrors(setError, result)) toast.error(result.error.message);
      return;
    }
    toast.success(m.saved);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <TextField label={m.titleLabel} error={errors.title?.message} {...register("title")} />
      <div className="space-y-1.5">
        <label htmlFor="list-description" className="text-sm font-medium">
          {m.descriptionLabel}
        </label>
        <textarea
          id="list-description"
          rows={3}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? "list-description-error" : undefined}
          className="bg-surface border-border w-full rounded-md border px-3 py-2"
          {...register("description")}
        />
        {errors.description ? (
          <p id="list-description-error" role="alert" className="text-danger text-sm">
            {errors.description.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-1">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" {...register("isPublic")} />
          {m.isPublic}
        </label>
        <p className="text-muted text-xs">{m.isPublicHint}</p>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" {...register("isRanked")} />
          {m.isRanked}
        </label>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {props.mode === "create" ? m.create : messages.common.save}
      </Button>
    </form>
  );
}
