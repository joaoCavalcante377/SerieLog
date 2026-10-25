import { describe, expect, it, vi } from "vitest";
import { createTmdbClient, TmdbError } from "./client";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

function setup(responses: Array<Response | Error>) {
  const fetchMock = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fetchMock.mockRejectedValueOnce(r);
    else fetchMock.mockResolvedValueOnce(r);
  }
  const sleep = vi.fn().mockResolvedValue(undefined);
  const client = createTmdbClient({ fetch: fetchMock, sleep, token: () => "tok" });
  return { client, fetchMock, sleep };
}

describe("tmdb client", () => {
  it("sends the bearer token and language, and returns typed JSON", async () => {
    const { client, fetchMock } = setup([json({ id: 1, name: "X" })]);
    const res = await client.getTv(1, "pt-BR");
    expect(res).toMatchObject({ id: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.themoviedb.org/3/tv/1?language=pt-BR");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("retries once on 5xx and succeeds", async () => {
    const { client, fetchMock, sleep } = setup([json({}, 503), json({ results: [] })]);
    await expect(client.searchTv("abc")).resolves.toEqual({ results: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("retries once on 429, honouring Retry-After (capped)", async () => {
    const { client, sleep } = setup([json({}, 429, { "retry-after": "1" }), json({ ok: 1 })]);
    await client.trending();
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("gives up after one retry with a TmdbError", async () => {
    const { client, fetchMock } = setup([json({}, 500), json({}, 500)]);
    await expect(client.trending()).rejects.toMatchObject({ kind: "http", status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry 4xx; 404 becomes not_found", async () => {
    const { client, fetchMock } = setup([json({}, 404)]);
    await expect(client.getTv(99999999)).rejects.toMatchObject({ kind: "not_found" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = setup([json({}, 401)]);
    await expect(second.client.trending()).rejects.toMatchObject({ kind: "http", status: 401 });
    expect(second.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps network failures and timeouts to TmdbError after a retry", async () => {
    const net = setup([new TypeError("fetch failed"), new TypeError("fetch failed")]);
    await expect(net.client.trending()).rejects.toMatchObject({ kind: "network" });

    const timeout = new DOMException("timed out", "TimeoutError");
    const t = setup([timeout, timeout]);
    const err = await t.client.trending().catch((e) => e);
    expect(err).toBeInstanceOf(TmdbError);
    expect(err.kind).toBe("timeout");
  });

  it("fails clearly when the token is missing", async () => {
    const client = createTmdbClient({ fetch: vi.fn(), token: () => undefined });
    await expect(client.trending()).rejects.toMatchObject({ kind: "config" });
  });

  it("discover builds filters and requires a vote floor for the rating sort", async () => {
    const { client, fetchMock } = setup([json({ results: [] })]);
    await client.discover({ genre: 18, year: 2020, sort: "rating", page: 2 });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      with_genres: "18",
      first_air_date_year: "2020",
      sort_by: "vote_average.desc",
      "vote_count.gte": "200",
      page: "2",
    });
  });
});
