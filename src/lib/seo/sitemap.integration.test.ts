import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createSeries, createUser, resetDb } from "@/test/db";
import { buildSitemapEntries } from "./sitemap";

beforeEach(resetDb);

describe("buildSitemapEntries", () => {
  it("lists static pages, cached series, public lists and profiles — but never private lists", async () => {
    const userId = await createUser();
    await createSeries(1396, "Breaking Bad");
    await db.seriesList.createMany({
      data: [
        { userId, title: "Pública", slug: "publica", isPublic: true },
        { userId, title: "Privada", slug: "privada", isPublic: false },
      ],
    });

    const urls = (await buildSitemapEntries("https://serielog.example/")).map((e) => e.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://serielog.example",
        "https://serielog.example/series",
        "https://serielog.example/listas",
        "https://serielog.example/sobre",
        "https://serielog.example/serie/1396-breaking-bad",
        "https://serielog.example/fulano/lista/publica",
        "https://serielog.example/fulano",
      ]),
    );
    expect(urls.some((u) => u.includes("privada"))).toBe(false);
    expect(urls.some((u) => u.includes("/diario") || u.includes("/watchlist"))).toBe(false);
  });

  it("skips users that have not chosen a username yet", async () => {
    await db.user.create({ data: { name: "Sem usuário", email: "s@x.com" } });
    const urls = (await buildSitemapEntries("https://x.test")).map((e) => e.url);
    // Only the four static pages: no "/null" profile for the user without a username.
    expect(urls).toEqual([
      "https://x.test",
      "https://x.test/series",
      "https://x.test/listas",
      "https://x.test/sobre",
    ]);
  });
});
