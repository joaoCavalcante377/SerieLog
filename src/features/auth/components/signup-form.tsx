"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { applyServerErrors } from "@/lib/form-errors";
import { messages } from "@/lib/messages/pt-BR";
import { safeCallbackUrl } from "@/lib/redirects";
import { signUpAction } from "../actions/auth-actions";
import { signUpSchema, type SignUpInput } from "../schemas/auth";

export function SignUpForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema) });

  async function onSubmit(values: SignUpInput) {
    setFormError(null);
    const result = await signUpAction(values);
    if (!result.ok) {
      if (!applyServerErrors(setError, result)) setFormError(result.error.message);
      return;
    }
    router.push(safeCallbackUrl(callbackUrl));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <TextField
        label={messages.auth.name}
        autoComplete="name"
        error={errors.name?.message}
        {...register("name")}
      />
      <TextField
        label={messages.auth.username}
        autoComplete="username"
        autoCapitalize="none"
        error={errors.username?.message}
        {...register("username")}
      />
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
        autoComplete="new-password"
        hint={messages.auth.passwordHint}
        error={errors.password?.message}
        {...register("password")}
      />
      {formError ? (
        <p role="alert" className="text-sm text-red-500">
          {formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {messages.auth.signupSubmit}
      </Button>
      <p className="text-muted text-center text-sm">
        {messages.auth.hasAccount}{" "}
        <Link href="/entrar" className="text-accent underline">
          {messages.nav.login}
        </Link>
      </p>
    </form>
  );
}
