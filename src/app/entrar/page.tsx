import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/features/auth/components/login-form";
import { messages } from "@/lib/messages/pt-BR";
import { safeCallbackUrl } from "@/lib/redirects";

export const metadata: Metadata = { title: messages.auth.loginTitle };

export default async function LoginPage({ searchParams }: PageProps<"/entrar">) {
  const { callbackUrl } = await searchParams;
  const target = safeCallbackUrl(typeof callbackUrl === "string" ? callbackUrl : undefined);
  if ((await auth())?.user) redirect(target);

  return (
    <section className="mx-auto max-w-sm py-8">
      <h1 className="mb-6 text-2xl font-bold">{messages.auth.loginTitle}</h1>
      <LoginForm callbackUrl={target} />
    </section>
  );
}
