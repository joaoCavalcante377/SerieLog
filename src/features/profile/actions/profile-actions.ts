"use server";

import { revalidatePath } from "next/cache";
import { auth, signOut } from "@/auth";
import { fail, type ActionResult } from "@/lib/action-result";
import { messages } from "@/lib/messages/pt-BR";
import { changePassword, deleteAccount, updateProfile } from "../server/account";
import type {
  ChangePasswordInput,
  DeleteAccountInput,
  UpdateProfileInput,
} from "../schemas/profile";

async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function updateProfileAction(input: UpdateProfileInput): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail("UNAUTHENTICATED", messages.errors.unauthorized);
  const result = await updateProfile(userId, input);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function changePasswordAction(input: ChangePasswordInput): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail("UNAUTHENTICATED", messages.errors.unauthorized);
  return changePassword(userId, input);
}

export async function deleteAccountAction(input: DeleteAccountInput): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail("UNAUTHENTICATED", messages.errors.unauthorized);
  const result = await deleteAccount(userId, input);
  if (result.ok) await signOut({ redirectTo: "/" });
  return result;
}
