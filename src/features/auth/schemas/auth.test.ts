import { describe, expect, it } from "vitest";
import { signUpSchema, usernameSchema } from "./auth";

const base = { name: "Ana", username: "ana_01", email: "ANA@x.com", password: "senha1234" };

describe("signUpSchema", () => {
  it("normalizes email and username to lowercase", () => {
    const r = signUpSchema.parse({ ...base, username: "Ana_01" });
    expect(r.email).toBe("ana@x.com");
    expect(r.username).toBe("ana_01");
  });

  // AUTH-03
  it.each([
    ["short", "abc123"],
    ["no number", "somenteletras"],
    ["no letter", "12345678"],
  ])("AUTH-03 rejects password: %s", (_label, password) => {
    const r = signUpSchema.safeParse({ ...base, password });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["password"]);
  });

  it("AUTH-03 accepts a password with letters and numbers", () => {
    expect(signUpSchema.safeParse(base).success).toBe(true);
  });
});

describe("usernameSchema", () => {
  it.each(["ab", "a".repeat(21), "com espaço", "acentuaçao", "a-b-c"])("rejects %s", (u) => {
    expect(usernameSchema.safeParse(u).success).toBe(false);
  });

  it.each(["series", "ADMIN", "api", "diario", "_next"])("rejects reserved word %s", (u) => {
    expect(usernameSchema.safeParse(u).success).toBe(false);
  });
});
