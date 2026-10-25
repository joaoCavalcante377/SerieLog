import { describe, expect, it } from "vitest";
import { parseEnv } from "./env-schema";

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  AUTH_SECRET: "x".repeat(32),
  AUTH_URL: "http://localhost:3000",
  TMDB_API_READ_TOKEN: "token",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("accepts a complete environment", () => {
    expect(parseEnv(valid).DATABASE_URL).toBe(valid.DATABASE_URL);
  });

  it("fails with a readable message listing the invalid keys", () => {
    expect(() =>
      parseEnv({ ...valid, AUTH_SECRET: "short", TMDB_API_READ_TOKEN: undefined }),
    ).toThrow(/AUTH_SECRET[\s\S]*TMDB_API_READ_TOKEN/);
  });
});
