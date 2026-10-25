import { Prisma } from "@prisma/client";
import argon2 from "argon2";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { messages } from "@/lib/messages/pt-BR";
import { fieldErrors } from "@/lib/zod";
import { changePasswordSchema, deleteAccountSchema, updateProfileSchema } from "../schemas/profile";

/** Account mutations for an already-authenticated user id (authentication happens in the action layer). */

export async function updateProfile(userId: string, raw: unknown): Promise<ActionResult> {
  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("VALIDATION", messages.validation.invalidData, fieldErrors(parsed.error));
  }
  const { name, username, bio, image } = parsed.data;

  const owner = await db.user.findUnique({ where: { username }, select: { id: true } });
  if (owner && owner.id !== userId) {
    return fail("CONFLICT", messages.validation.invalidData, {
      username: messages.auth.usernameTaken,
    });
  }

  try {
    await db.user.update({
      where: { id: userId },
      data: { name, username, bio: bio || null, image: image || null },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return fail("CONFLICT", messages.validation.invalidData, {
          username: messages.auth.usernameTaken,
        });
      }
      if (e.code === "P2025") return fail("NOT_FOUND", messages.errors.unauthorized);
    }
    throw e;
  }
  return ok(undefined);
}

export async function changePassword(userId: string, raw: unknown): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("VALIDATION", messages.validation.invalidData, fieldErrors(parsed.error));
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) return fail("NOT_FOUND", messages.errors.unauthorized);
  if (!user.passwordHash) return fail("FORBIDDEN", messages.settings.noPasswordAccount);

  if (!(await argon2.verify(user.passwordHash, parsed.data.currentPassword))) {
    return fail("VALIDATION", messages.validation.invalidData, {
      currentPassword: messages.settings.currentPasswordWrong,
    });
  }
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await argon2.hash(parsed.data.newPassword) },
  });
  return ok(undefined);
}

/** Hard-deletes the user; foreign keys cascade to all of their data. Series cache rows are untouched. */
export async function deleteAccount(userId: string, raw: unknown): Promise<ActionResult> {
  const parsed = deleteAccountSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("VALIDATION", messages.validation.invalidData, fieldErrors(parsed.error));
  }
  const user = await db.user.findUnique({ where: { id: userId }, select: { username: true } });
  if (!user) return fail("NOT_FOUND", messages.errors.unauthorized);
  if (user.username !== parsed.data.confirmUsername) {
    return fail("VALIDATION", messages.validation.invalidData, {
      confirmUsername: messages.settings.confirmMismatch,
    });
  }
  await db.user.delete({ where: { id: userId } });
  return ok(undefined);
}
