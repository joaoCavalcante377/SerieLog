import { Prisma } from "@prisma/client";
import argon2 from "argon2";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { messages } from "@/lib/messages/pt-BR";
import { fieldErrors } from "@/lib/zod";
import { signUpSchema } from "../schemas/auth";

/** Creates an account. Pure of session concerns so it can be tested against the DB directly. */
export async function registerUser(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("VALIDATION", messages.validation.invalidData, fieldErrors(parsed.error));
  }
  const { name, username, email, password } = parsed.data;

  const [byEmail, byUsername] = await Promise.all([
    db.user.findUnique({ where: { email }, select: { id: true } }),
    db.user.findUnique({ where: { username }, select: { id: true } }),
  ]);
  const taken: Record<string, string> = {};
  if (byEmail) taken.email = messages.auth.emailTaken;
  if (byUsername) taken.username = messages.auth.usernameTaken;
  if (Object.keys(taken).length) return fail("CONFLICT", messages.validation.invalidData, taken);

  try {
    const user = await db.user.create({
      data: { name, username, email, passwordHash: await argon2.hash(password) },
      select: { id: true },
    });
    return ok(user);
  } catch (e) {
    // Concurrent sign-ups can slip past the checks above; the unique constraints are the source of truth.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String(e.meta?.target ?? "");
      const field = target.includes("username") ? "username" : "email";
      return fail("CONFLICT", messages.validation.invalidData, {
        [field]: field === "email" ? messages.auth.emailTaken : messages.auth.usernameTaken,
      });
    }
    throw e;
  }
}
