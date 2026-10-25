/**
 * Progress = watched aired episodes / total aired episodes, as a whole percentage.
 * Specials (season 0) must be excluded by the caller's counts; see SPECIALS_SEASON.
 */
export const SPECIALS_SEASON = 0;

export function progressPercent(watchedAired: number, totalAired: number): number {
  if (totalAired <= 0) return 0;
  const clamped = Math.min(Math.max(watchedAired, 0), totalAired);
  return Math.floor((clamped / totalAired) * 100);
}

export function isFullyWatched(watchedAired: number, totalAired: number): boolean {
  return totalAired > 0 && watchedAired >= totalAired;
}

export interface ProgressSummary {
  watchedAired: number;
  totalAired: number;
  percent: number;
  complete: boolean;
}

export function summarizeProgress(watchedAired: number, totalAired: number): ProgressSummary {
  return {
    watchedAired,
    totalAired,
    percent: progressPercent(watchedAired, totalAired),
    complete: isFullyWatched(watchedAired, totalAired),
  };
}
