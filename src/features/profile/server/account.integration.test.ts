import { beforeEach, describe, expect, it } from "vitest";
import { verifyCredentials } from "@/features/auth/server/credentials";
import { db } from "@/lib/db";
import { createUser, resetDb } from "@/test/db";
import { changePassword, deleteAccount, updateProfile } from "./account";

beforeEach(resetDb);

const profile = (over: Record<string, string> = {}) => ({
  name: "Fulano",
  username: "fulano",
  bio: "",
  image: "",
  ...over,
});

describe("updateProfile", () => {
  it("PRO-04 saves a bio of up to 160 characters", async () => {
    const id = await createUser();
    const result = await updateProfile(id, profile({ bio: "b".repeat(160) }));
    expect(result.ok).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id } })).bio).toHaveLength(160);
  });

  it("PRO-04 rejects a bio over 160 characters", async () => {
    const id = await createUser();
    const result = await updateProfile(id, profile({ bio: "b".repeat(161) }));
    expect(result).toMatchObject({
      ok: false,
      error: { fieldErrors: { bio: "A bio deve ter no máximo 160 caracteres" } },
    });
    expect((await db.user.findUniqueOrThrow({ where: { id } })).bio).toBeNull();
  });

  it("PRO-05 rejects a username owned by someone else, in any casing", async () => {
    const id = await createUser();
    await createUser({ username: "ciclano", email: "c@x.com" });
    const result = await updateProfile(id, profile({ username: "CicLano" }));
    expect(result).toMatchObject({
      ok: false,
      error: { fieldErrors: { username: "Este nome de usuário já está em uso" } },
    });
  });

  it("allows keeping the same username and changing casing of own name", async () => {
    const id = await createUser();
    const result = await updateProfile(id, profile({ username: "FULANO", name: "Novo Nome" }));
    expect(result.ok).toBe(true);
    const user = await db.user.findUniqueOrThrow({ where: { id } });
    expect(user).toMatchObject({ username: "fulano", name: "Novo Nome" });
  });

  it("rejects non-https avatar URLs", async () => {
    const id = await createUser();
    const result = await updateProfile(id, profile({ image: "http://x.com/a.png" }));
    expect(result.ok).toBe(false);
  });
});

describe("changePassword", () => {
  it("changes the password when the current one is correct", async () => {
    const id = await createUser();
    const result = await changePassword(id, {
      currentPassword: "senha1234",
      newPassword: "novasenha99",
    });
    expect(result.ok).toBe(true);
    expect(
      await verifyCredentials({ email: "fulano@example.com", password: "novasenha99" }),
    ).not.toBeNull();
    expect(
      await verifyCredentials({ email: "fulano@example.com", password: "senha1234" }),
    ).toBeNull();
  });

  it("rejects a wrong current password", async () => {
    const id = await createUser();
    const result = await changePassword(id, {
      currentPassword: "errada123",
      newPassword: "novasenha99",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { fieldErrors: { currentPassword: "Senha atual incorreta" } },
    });
  });
});

describe("deleteAccount", () => {
  it("PRO-06 deletes the user and their data when the username matches", async () => {
    const id = await createUser();
    const other = await createUser({ username: "outro", email: "o@x.com" });
    const result = await deleteAccount(id, { confirmUsername: "FULANO" });
    expect(result.ok).toBe(true);
    expect(await db.user.findUnique({ where: { id } })).toBeNull();
    expect(await db.user.findUnique({ where: { id: other } })).not.toBeNull();
  });

  it("PRO-06 does nothing when the confirmation does not match", async () => {
    const id = await createUser();
    const result = await deleteAccount(id, { confirmUsername: "errado" });
    expect(result.ok).toBe(false);
    expect(await db.user.findUnique({ where: { id } })).not.toBeNull();
  });
});
