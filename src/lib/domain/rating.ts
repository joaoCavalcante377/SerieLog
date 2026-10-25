export const RATING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

export function isValidRating(value: number): boolean {
  return Number.isFinite(value) && value >= 0.5 && value <= 5 && Number.isInteger(value * 2);
}

/** Average rounded to 1 decimal, or null when there are no ratings. */
export function averageRating(ratings: readonly number[]): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((a, b) => a + b, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

export interface RatingBucket {
  rating: number;
  count: number;
}

/** Count per half-star bucket, always returning all 10 buckets (0.5 … 5.0). */
export function ratingHistogram(ratings: readonly number[]): RatingBucket[] {
  const counts = new Map<number, number>(RATING_STEPS.map((r) => [r, 0]));
  for (const r of ratings) {
    if (counts.has(r)) counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  return RATING_STEPS.map((rating) => ({ rating, count: counts.get(rating) ?? 0 }));
}

export interface RatingSummary {
  average: number | null;
  total: number;
  histogram: RatingBucket[];
}

/** Builds a summary from pre-aggregated (rating → count) rows, e.g. a SQL GROUP BY. */
export function summarizeRatingCounts(rows: readonly RatingBucket[]): RatingSummary {
  const total = rows.reduce((a, r) => a + r.count, 0);
  const sum = rows.reduce((a, r) => a + r.rating * r.count, 0);
  const byRating = new Map(rows.map((r) => [r.rating, r.count]));
  return {
    average: total === 0 ? null : Math.round((sum / total) * 10) / 10,
    total,
    histogram: RATING_STEPS.map((rating) => ({ rating, count: byRating.get(rating) ?? 0 })),
  };
}

/**
 * Star click behaviour: clicking star N sets N; clicking it again steps down to N-0.5;
 * clicking once more toggles back to N. (Half-star precision without tiny tap targets.)
 */
export function nextRatingOnStarClick(current: number | null, star: number): number {
  if (current === star) return star - 0.5;
  return star;
}

/** Keyboard handling for the star slider. Returns undefined when the key is not handled. */
export function applyRatingKey(
  current: number | null,
  key: string,
  clearable: boolean,
): number | null | undefined {
  const value = current ?? 0;
  const floor = clearable ? null : 0.5;
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return Math.min(5, value + 0.5);
    case "ArrowLeft":
    case "ArrowDown": {
      const next = value - 0.5;
      return next < 0.5 ? floor : next;
    }
    case "Home":
      return floor;
    case "End":
      return 5;
    default:
      return undefined;
  }
}
