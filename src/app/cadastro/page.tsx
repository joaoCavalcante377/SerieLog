import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignUpForm } from "@/features/auth/components/signup-form";
import { messages } from "@/lib/messages/pt-BR";
import { safeCallbackUrl } from "@/lib/redirects";

export const metadata: Metadata = { title: messages.auth.signupTitle };

export default async function SignUpPage({ searchParams }: PageProps<"/cadastro">) {
  const { callbackUrl } = await searchParams;
  const target = safeCallbackUrl(typeof callbackUrl === "string" ? callbackUrl : undefined);
  if ((await auth())?.user) redirect(target);

  return (
    <section className="mx-auto max-w-sm py-8">
      <h1 className="mb-6 text-2xl font-bold">{messages.auth.signupTitle}</h1>
      <SignUpForm callbackUrl={target} />
    </section>
  );
}
