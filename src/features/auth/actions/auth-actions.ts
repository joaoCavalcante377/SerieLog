"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn, signOut } from "@/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logger } from "@/lib/logger";
import { messages } from "@/lib/messages/pt-BR";
import { loginSchema, type LoginInput, type SignUpInput } from "../schemas/auth";
import { formatRetryAfter, clientIp } from "@/lib/rate-limit";
import { loginBlockStatus } from "../server/login";
import { registerUser } from "../server/register";

async function startSession(email: string, password: string): Promise<ActionResult> {
  try {
    await signIn("credentials", { email, password, redirect: false });
    return ok(undefined);
  } catch (e) {
    if (e instanceof AuthError) return fail("UNAUTHENTICATED", messages.auth.invalidCredentials);
    throw e;
  }
}

export async function signUpAction(input: SignUpInput): Promise<ActionResult> {
  const created = await registerUser(input);
  if (!created.ok) return created;
  const session = await startSession(input.email, input.password);
  if (!session.ok) logger.error("session start failed after sign-up", { userId: created.data.id });
  return session;
}

export async function loginAction(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail("UNAUTHENTICATED", messages.auth.invalidCredentials);
  const block = await loginBlockStatus(clientIp(await headers()), parsed.data.email);
  if (block.blocked) {
    return fail(
      "RATE_LIMITED",
      messages.auth.tooManyAttempts(formatRetryAfter(block.retryAfterMs)),
    );
  }
  return startSession(parsed.data.email, parsed.data.password);
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
