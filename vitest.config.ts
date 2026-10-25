import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Integration tests always run against the separate test database, never the dev one.
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://serielog:serielog@localhost:5432/serielog_test?schema=public";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    env: { DATABASE_URL: testDatabaseUrl },
    globalSetup: ["./src/test/global-setup.ts"],
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/lib/domain/**", "src/features/**/actions/**", "src/features/**/server/**"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
