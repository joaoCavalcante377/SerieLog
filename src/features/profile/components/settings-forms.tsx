"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { applyServerErrors } from "@/lib/form-errors";
import { messages } from "@/lib/messages/pt-BR";
import {
  changePasswordAction,
  deleteAccountAction,
  updateProfileAction,
} from "../actions/profile-actions";
import {
  changePasswordSchema,
  deleteAccountSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type DeleteAccountInput,
  type UpdateProfileInput,
} from "../schemas/profile";

const s = messages.settings;

export function ProfileForm({ defaults }: { defaults: UpdateProfileInput }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: UpdateProfileInput) {
    const result = await updateProfileAction(values);
    if (result.ok) {
      toast.success(s.profileSaved);
      router.refresh();
    } else if (!applyServerErrors(setError, result)) {
      toast.error(result.error.message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <TextField label={messages.auth.name} error={errors.name?.message} {...register("name")} />
      <TextField
        label={messages.auth.username}
        autoCapitalize="none"
        error={errors.username?.message}
        {...register("username")}
      />
      <div className="space-y-1.5">
        <label htmlFor="bio" className="text-sm font-medium">
          {s.bio}
        </label>
        <textarea
          id="bio"
          rows={3}
          aria-invalid={errors.bio ? true : undefined}
          aria-describedby={errors.bio ? "bio-error" : undefined}
          className="bg-surface border-border w-full rounded-md border px-3 py-2"
          {...register("bio")}
        />
        {errors.bio ? (
          <p id="bio-error" role="alert" className="text-danger text-sm">
            {errors.bio.message}
          </p>
        ) : null}
      </div>
      <TextField
        label={s.avatarUrl}
        type="url"
        inputMode="url"
        error={errors.image?.message}
        {...register("image")}
      />
      <Button type="submit" disabled={isSubmitting}>
        {messages.common.save}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  async function onSubmit(values: ChangePasswordInput) {
    const result = await changePasswordAction(values);
    if (result.ok) {
      toast.success(s.passwordChanged);
      reset();
    } else if (!applyServerErrors(setError, result)) {
      toast.error(result.error.message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <TextField
        label={s.currentPassword}
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />
      <TextField
        label={s.newPassword}
        type="password"
        autoComplete="new-password"
        hint={messages.auth.passwordHint}
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />
      <Button type="submit" disabled={isSubmitting}>
        {messages.common.save}
      </Button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [pending, setPending] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DeleteAccountInput>({ resolver: zodResolver(deleteAccountSchema) });

  async function onSubmit(values: DeleteAccountInput) {
    setPending(true);
    // On success the action signs out and redirects, so this only returns on failure.
    const result = await deleteAccountAction(values);
    setPending(false);
    if (!result.ok && !applyServerErrors(setError, result)) toast.error(result.error.message);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <p className="text-muted text-sm">{s.dangerWarning}</p>
      <TextField
        label={s.confirmUsername}
        autoCapitalize="none"
        error={errors.confirmUsername?.message}
        {...register("confirmUsername")}
      />
      <Button type="submit" variant="danger" disabled={pending}>
        {s.deleteAccount}
      </Button>
    </form>
  );
}
