import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test",
  testMatch: "*.browser.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5175",
    browserName: "chromium",
    channel: "chrome",
    viewport: { width: 1440, height: 1050 },
    trace: "retain-on-failure",
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "../../docs/evidence/w01/thread-revision/browser-results.json" }],
  ],
  webServer: [
    {
      command: "FLOW_FIXTURE_PORT=4318 pnpm fixture",
      url: "http://127.0.0.1:4318/api/health",
      reuseExistingServer: false,
    },
    {
      command:
        "FLOW_CENTER_URL=http://127.0.0.1:4318 VITE_FLOW_FIXTURE=true pnpm dev --port 5175",
      url: "http://127.0.0.1:5175",
      reuseExistingServer: false,
    },
  ],
});
