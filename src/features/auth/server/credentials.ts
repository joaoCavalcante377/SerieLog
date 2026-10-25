import argon2 from "argon2";
import { db } from "@/lib/db";
import { loginSchema } from "../schemas/auth";

/** Returns the user for valid email+password, otherwise null (never says which part was wrong). */
export async function verifyCredentials(raw: unknown) {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user?.passwordHash) return null;
  if (!(await argon2.verify(user.passwordHash, password))) return null;
  return { id: user.id, name: user.name, email: user.email, image: user.image };
}
