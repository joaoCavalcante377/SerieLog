/** URL-safe slug: accents stripped, lowercase, hyphen-separated. */
export function slugify(input: string, fallback = "item", maxLength = 60): string {
  const slug = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || fallback;
}

/** Appends -2, -3… until the slug is not in `taken`. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function seriesPath(tmdbId: number, name: string): string {
  return `/serie/${tmdbId}-${slugify(name, "serie")}`;
}

/** Parses the `[tmdbId]-[slug]` route segment. The id is the source of truth; the slug is cosmetic. */
export function parseSeriesSegment(segment: string): { tmdbId: number; slug: string } | null {
  const match = /^(\d{1,9})(?:-(.*))?$/.exec(segment);
  if (!match) return null;
  return { tmdbId: Number(match[1]), slug: match[2] ?? "" };
}
