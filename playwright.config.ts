import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/webgl",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 30_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4179",
    headless: true,
    trace: "off",
  },
  webServer: {
    command: "pnpm --filter @modeling-kit/webgl-smoke dev:smoke",
    url: "http://127.0.0.1:4179",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
