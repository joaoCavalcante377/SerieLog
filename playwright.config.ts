import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

// E2E runs against a production build and the separate test database (never the dev one).
const testDb =
  process.env.TEST_DATABASE_URL ??
  "postgresql://serielog:serielog@localhost:5432/serielog_test?schema=public";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      DATABASE_URL: testDb,
      AUTH_URL: `http://localhost:${PORT}`,
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
    },
  },
});
