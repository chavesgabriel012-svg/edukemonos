import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests against a local Supabase stack (`supabase start`) and `next dev`.
 * See e2e/README.md for how to run them.
 */
export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
    trace: "retain-on-failure",
  },
});
