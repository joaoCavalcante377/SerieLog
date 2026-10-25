import { describe, expect, it } from "vitest";
import { buildLoginRedirect, safeCallbackUrl } from "./redirects";

describe("buildLoginRedirect", () => {
  it("AUTH-05 sends protected paths to /entrar with the callbackUrl", () => {
    expect(buildLoginRedirect("/diario")).toBe("/entrar?callbackUrl=/diario");
    expect(buildLoginRedirect("/a?b=1&c=2")).toBe("/entrar?callbackUrl=/a%3Fb%3D1%26c%3D2");
  });
});

describe("safeCallbackUrl", () => {
  it("keeps same-site relative paths", () => {
    expect(safeCallbackUrl("/diario")).toBe("/diario");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "diario", "", undefined])(
    "falls back for %s",
    (value) => {
      expect(safeCallbackUrl(value)).toBe("/");
    },
  );
});
