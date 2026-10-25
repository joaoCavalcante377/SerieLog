import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { buildLoginRedirect } from "./redirects";

/** For protected pages: returns the session user id or redirects to /entrar?callbackUrl=<path>. */
export async function requireUserId(path: string): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect(buildLoginRedirect(path));
  return session.user.id;
}
