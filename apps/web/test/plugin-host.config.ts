import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "plugin-host.browser.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5190/src/plugins/fixture/index.html",
    browserName: "chromium",
    channel: "chrome",
    viewport: { width: 1360, height: 1050 },
    trace: "retain-on-failure",
  },
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: fileURLToPath(
          new URL(
            "../../../docs/evidence/wpf-p01/browser-results.json",
            import.meta.url,
          ),
        ),
      },
    ],
  ],
  outputDir: fileURLToPath(
    new URL("../../../docs/evidence/wpf-p01/test-results", import.meta.url),
  ),
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 5190 --strictPort",
    cwd: "..",
    url: "http://127.0.0.1:5190/src/plugins/fixture/index.html",
    reuseExistingServer: true,
  },
});
