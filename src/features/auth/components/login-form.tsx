"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { messages } from "@/lib/messages/pt-BR";
import { safeCallbackUrl } from "@/lib/redirects";
import { loginAction } from "../actions/auth-actions";
import { loginSchema, type LoginInput } from "../schemas/auth";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const target = safeCallbackUrl(callbackUrl);

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    const result = await loginAction(values);
    if (!result.ok) return setFormError(result.error.message);
    router.push(target);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <TextField
        label={messages.auth.email}
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        label={messages.auth.password}
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      {formError ? (
        <p role="alert" className="text-sm text-red-500">
          {formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {messages.auth.loginSubmit}
      </Button>
      <p className="text-muted text-center text-sm">
        {messages.auth.noAccount}{" "}
        <Link
          href={
            target === "/" ? "/cadastro" : `/cadastro?callbackUrl=${encodeURIComponent(target)}`
          }
          className="text-accent underline"
        >
          {messages.nav.signup}
        </Link>
      </p>
    </form>
  );
}
