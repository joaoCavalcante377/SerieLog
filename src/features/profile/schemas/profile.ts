import { z } from "zod";
import { messages } from "@/lib/messages/pt-BR";
import { nameSchema, passwordSchema, usernameSchema } from "@/features/auth/schemas/auth";

const v = messages.validation;

const isHttpsUrl = (u: string) => z.url({ protocol: /^https$/ }).safeParse(u).success;

// Empty strings are valid for bio/image ("not set"); the server stores them as null.
export const updateProfileSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  bio: z.string().trim().max(160, v.bioTooLong),
  image: z
    .string()
    .trim()
    .refine((u) => u === "" || isHttpsUrl(u), v.imageInvalid),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, v.passwordRequired),
  newPassword: passwordSchema,
});

export const deleteAccountSchema = z.object({
  confirmUsername: z.string().trim().toLowerCase(),
});

export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type DeleteAccountInput = z.input<typeof deleteAccountSchema>;
