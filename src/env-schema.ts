import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must have at least 32 characters"),
  AUTH_URL: z.string().url(),
  TMDB_API_READ_TOKEN: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(
      `Invalid environment variables:\n${lines.join("\n")}\nSee .env.example for the expected values.`,
    );
  }
  return result.data;
}
