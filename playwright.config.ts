import { defineConfig, devices } from "@playwright/test";

// Puerto confirmado en local: 8080 (visto en pantalla al correr `bun run dev`).
const PORT = process.env.PORT ?? "8080";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts", // 👈 ESTA LÍNEA ES NUEVA: le dice a Playwright que busque archivos .e2e.ts
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { MOCK_AI: "true" }, //
  },
});
