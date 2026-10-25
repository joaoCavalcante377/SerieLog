import { parseEnv, type Env } from "./env-schema";

// Skipped only for tooling that does not need runtime config (e.g. `next build` in CI without secrets).
export const env: Env =
  process.env.SKIP_ENV_VALIDATION === "1" ? (process.env as unknown as Env) : parseEnv(process.env);
