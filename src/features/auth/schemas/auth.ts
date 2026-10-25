import { z } from "zod";
import { RESERVED_USERNAMES } from "@/config/site";
import { messages } from "@/lib/messages/pt-BR";

const v = messages.validation;

export const nameSchema = z.string().trim().min(1, v.nameRequired).max(60, v.nameTooLong);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, v.usernameFormat)
  .refine((u) => !(RESERVED_USERNAMES as readonly string[]).includes(u), v.usernameReserved);

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email(v.emailInvalid));

export const passwordSchema = z
  .string()
  .min(8, v.passwordTooShort)
  .regex(/[A-Za-z]/, v.passwordNeedsLetter)
  .regex(/\d/, v.passwordNeedsNumber);

export const signUpSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, v.passwordRequired),
});

export type SignUpInput = z.input<typeof signUpSchema>;
export type LoginInput = z.input<typeof loginSchema>;
