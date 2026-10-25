import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "@/test/db";
import { verifyCredentials } from "./credentials";
import { registerUser } from "./register";

const valid = {
  name: "Ana",
  username: "ana",
  email: "a@x.com",
  password: "senha1234",
};

beforeEach(resetDb);

describe("registerUser", () => {
  it("AUTH-01 creates the account with a hashed password", async () => {
    const result = await registerUser(valid);
    expect(result.ok).toBe(true);
    const user = await db.user.findUniqueOrThrow({ where: { email: "a@x.com" } });
    expect(user.username).toBe("ana");
    expect(user.passwordHash).toMatch(/^\$argon2/);
    expect(user.passwordHash).not.toContain(valid.password);
  });

  it("AUTH-02 rejects a duplicate email on the email field", async () => {
    await registerUser(valid);
    const result = await registerUser({ ...valid, username: "outra", email: "A@X.com" });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", fieldErrors: { email: "Este e-mail já está em uso" } },
    });
    expect(await db.user.count()).toBe(1);
  });

  it("AUTH-02 rejects a duplicate username, case-insensitively", async () => {
    await registerUser(valid);
    const result = await registerUser({ ...valid, username: "ANA", email: "b@x.com" });
    expect(result).toMatchObject({
      ok: false,
      error: { fieldErrors: { username: "Este nome de usuário já está em uso" } },
    });
    expect(await db.user.count()).toBe(1);
  });

  it("AUTH-02 only one of two concurrent sign-ups wins", async () => {
    const results = await Promise.all([registerUser(valid), registerUser(valid)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.user.count()).toBe(1);
  });

  it("AUTH-03 rejects a weak password and creates nothing", async () => {
    const result = await registerUser({ ...valid, password: "curta1" });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await db.user.count()).toBe(0);
  });
});

describe("verifyCredentials", () => {
  it("returns the user for correct credentials (case-insensitive email)", async () => {
    await registerUser(valid);
    const user = await verifyCredentials({ email: "A@X.com", password: valid.password });
    expect(user?.email).toBe("a@x.com");
  });

  it("AUTH-04 returns null for wrong password and for unknown email alike", async () => {
    await registerUser(valid);
    expect(await verifyCredentials({ email: "a@x.com", password: "errada123" })).toBeNull();
    expect(await verifyCredentials({ email: "nao@x.com", password: valid.password })).toBeNull();
    expect(await verifyCredentials({ email: "", password: "" })).toBeNull();
  });

  it("returns null for accounts without a password", async () => {
    const id = await createUser();
    await db.user.update({ where: { id }, data: { passwordHash: null } });
    expect(
      await verifyCredentials({ email: "fulano@example.com", password: "senha1234" }),
    ).toBeNull();
  });
});
