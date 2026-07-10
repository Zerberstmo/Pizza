import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:5173" },
  webServer: { command: "bun run dev", url: "http://localhost:5173", reuseExistingServer: true },
  // System-Chrome nutzen (kein Playwright-Browser-Download im Environment möglich).
  projects: [{ name: "mobile", use: { ...devices["Pixel 5"], channel: "chrome" } }],
});
