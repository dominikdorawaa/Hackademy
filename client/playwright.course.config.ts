import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

export default defineConfig({
  testDir: "./course-tests",
  globalSetup: "./course-tests/global-setup.ts",
  outputDir: "./test-results-course",
  timeout: 180000,
  expect: { timeout: 15000 },
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1440, height: 1000 },
    headless: true,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 0.0.0.0 --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
