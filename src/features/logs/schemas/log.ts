import { z } from "zod";
import { todayInSaoPaulo } from "@/lib/domain/dates";
import { isValidRating } from "@/lib/domain/rating";
import { messages } from "@/lib/messages/pt-BR";

const v = messages.logs.validation;

export const LOG_STATUSES = ["WATCHING", "COMPLETED", "DROPPED"] as const;
export const REVIEW_MAX = 5000;

/** "" → undefined; otherwise a YYYY-MM-DD string. */
const optionalDate = z
  .string()
  .optional()
  .transform((s) => (s?.trim() ? s.trim() : undefined))
  .pipe(z.iso.date(v.dateInvalid).optional());

const logFields = {
  status: z.enum(LOG_STATUSES),
  startedAt: optionalDate,
  finishedAt: optionalDate,
  rating: z
    .number()
    .refine(isValidRating, v.ratingInvalid)
    .nullable()
    .optional()
    .transform((r) => r ?? null),
  reviewText: z.string().max(REVIEW_MAX, v.reviewTooLong),
  containsSpoilers: z.boolean(),
  isRewatch: z.boolean(),
};

type Dates = { status: string; startedAt?: string; finishedAt?: string };

function checkDates(data: Dates, ctx: z.RefinementCtx) {
  const today = todayInSaoPaulo();
  if (data.status === "COMPLETED" && !data.finishedAt) {
    ctx.addIssue({ code: "custom", path: ["finishedAt"], message: v.finishRequired });
  }
  if (data.startedAt && data.startedAt > today) {
    ctx.addIssue({ code: "custom", path: ["startedAt"], message: v.startInFuture });
  }
  if (data.finishedAt && data.finishedAt > today) {
    ctx.addIssue({ code: "custom", path: ["finishedAt"], message: v.finishInFuture });
  }
  if (data.startedAt && data.finishedAt && data.finishedAt < data.startedAt) {
    ctx.addIssue({ code: "custom", path: ["finishedAt"], message: v.finishBeforeStart });
  }
}

/** Shared by the client form and the server: one source of truth for log validation. */
export const logSchema = z.object(logFields).superRefine(checkDates);

export const createLogSchema = z
  .object({ seriesId: z.string().min(1), ...logFields })
  .superRefine(checkDates);

export const rateSeriesSchema = z.object({
  seriesId: z.string().min(1),
  rating: z.number().refine(isValidRating, v.ratingInvalid).nullable(),
});

export type LogFormInput = z.input<typeof logSchema>;
export type LogFormOutput = z.output<typeof logSchema>;
export type CreateLogInput = z.input<typeof createLogSchema>;
