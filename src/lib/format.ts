import { DEFAULT_LOCALE } from "@/config/site";

const decimal = new Intl.NumberFormat(DEFAULT_LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 4.5 → "4,5" */
export const formatRating = (value: number) => decimal.format(value);

/** Date-only values are stored as UTC midnight, so format them in UTC to avoid off-by-one days. */
export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat(DEFAULT_LOCALE, { dateStyle: "medium", timeZone: "UTC" }).format(date);

export const formatYear = (date: Date | null | undefined) =>
  date ? String(date.getUTCFullYear()) : null;
