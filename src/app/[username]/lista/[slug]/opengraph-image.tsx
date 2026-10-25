import { ImageResponse } from "next/og";
import { getListView } from "@/features/lists/queries/lists";
import { SITE_NAME } from "@/config/site";
import { messages } from "@/lib/messages/pt-BR";
import { tmdbImageUrl } from "@/lib/tmdb/images";

export const alt = "Lista de séries";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Share card: list title, owner and up to four posters. Private lists only get the generic card. */
export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;
  const view = await getListView(username, slug, null);
  const title = view?.list.title ?? messages.lists.title;
  const subtitle = view
    ? `${messages.lists.byUser(view.owner.name)} · ${messages.lists.seriesCount(view.list.items.length)}`
    : SITE_NAME;
  const posters = (view?.list.items ?? [])
    .slice(0, 4)
    .map((i) => tmdbImageUrl(i.series.posterPath, "w342"))
    .filter((u): u is string => Boolean(u));

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0c0e12",
        color: "#ecedef",
        padding: 56,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 28, color: "#ff5c93", fontWeight: 700 }}>{SITE_NAME}</div>
        <div style={{ fontSize: 64, fontWeight: 700, marginTop: 16, lineHeight: 1.1 }}>
          {title.length > 60 ? `${title.slice(0, 57)}…` : title}
        </div>
        <div style={{ fontSize: 30, color: "#9aa1ad", marginTop: 12 }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", gap: 20 }}>
        {posters.map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            width={150}
            height={225}
            style={{ borderRadius: 8, objectFit: "cover" }}
          />
        ))}
      </div>
    </div>,
    size,
  );
}
