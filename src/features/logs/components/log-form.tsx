"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ui/star-rating";
import { TextField } from "@/components/ui/text-field";
import { applyServerErrors } from "@/lib/form-errors";
import { messages } from "@/lib/messages/pt-BR";
import type { ActionResult } from "@/lib/action-result";
import {
  LOG_STATUSES,
  REVIEW_MAX,
  logSchema,
  type LogFormInput,
  type LogFormOutput,
} from "../schemas/log";

const m = messages.logs;

const STATUS_LABEL: Record<(typeof LOG_STATUSES)[number], string> = {
  WATCHING: m.statusWatching,
  COMPLETED: m.statusCompleted,
  DROPPED: m.statusDropped,
};

interface LogFormProps {
  defaults: LogFormInput;
  /** Latest allowed date (today in São Paulo), provided by the server to avoid clock skew. */
  today: string;
  onSubmit: (values: LogFormOutput) => Promise<ActionResult<unknown>>;
  onDone: () => void;
  onCancel: () => void;
}

export function LogForm({ defaults, today, onSubmit, onDone, onCancel }: LogFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LogFormInput, unknown, LogFormOutput>({
    resolver: zodResolver(logSchema),
    defaultValues: defaults,
  });

  const status = useWatch({ control, name: "status" });
  const reviewLength = (useWatch({ control, name: "reviewText" }) ?? "").length;

  async function submit(values: LogFormOutput) {
    const result = await onSubmit(values);
    if (result.ok) return onDone();
    if (!applyServerErrors(setError, result)) {
      setError("root", { message: result.error.message });
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="log-status" className="text-sm font-medium">
          {m.status}
        </label>
        <select
          id="log-status"
          className="bg-surface border-border h-11 w-full rounded-md border px-3"
          {...register("status")}
        >
          {LOG_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={m.startedAt}
          type="date"
          max={today}
          error={errors.startedAt?.message}
          {...register("startedAt")}
        />
        {status !== "WATCHING" ? (
          <TextField
            label={m.finishedAt}
            type="date"
            max={today}
            error={errors.finishedAt?.message}
            {...register("finishedAt")}
          />
        ) : null}
      </div>

      <div className="space-y-1">
        <p id="log-rating-label" className="text-sm font-medium">
          {m.rating}
        </p>
        <Controller
          control={control}
          name="rating"
          render={({ field }) => (
            <StarRating label={m.rating} value={field.value ?? null} onChange={field.onChange} />
          )}
        />
        {errors.rating ? (
          <p role="alert" className="text-danger text-sm">
            {errors.rating.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="log-review" className="text-sm font-medium">
          {m.review}
        </label>
        <textarea
          id="log-review"
          rows={5}
          placeholder={m.reviewPlaceholder}
          aria-invalid={errors.reviewText ? true : undefined}
          aria-describedby={errors.reviewText ? "log-review-error" : undefined}
          className="bg-surface border-border w-full rounded-md border px-3 py-2"
          {...register("reviewText")}
        />
        <p className={`text-xs ${reviewLength > REVIEW_MAX ? "text-danger" : "text-muted"}`}>
          {m.reviewCount(reviewLength, REVIEW_MAX)}
        </p>
        {errors.reviewText ? (
          <p id="log-review-error" role="alert" className="text-danger text-sm">
            {errors.reviewText.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" {...register("containsSpoilers")} />
          {m.spoilers}
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" {...register("isRewatch")} />
          {m.rewatch}
        </label>
        {status === "COMPLETED" ? (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" {...register("markAllWatched")} />
            {messages.progress.markAllCheckbox}
          </label>
        ) : null}
      </div>

      {errors.root ? (
        <p role="alert" className="text-danger text-sm">
          {errors.root.message}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          {messages.common.cancel}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {messages.common.save}
        </Button>
      </div>
    </form>
  );
}
