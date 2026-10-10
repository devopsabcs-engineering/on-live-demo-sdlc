import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    viewport: { width: 1280, height: 720 },
    baseURL: "http://127.0.0.1:4173/ai-sdlc-labs-pinch/",
    locale: "en-US",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/ai-sdlc-labs-pinch/",
    reuseExistingServer: !process.env["CI"],
    timeout: 30_000,
  },
});
