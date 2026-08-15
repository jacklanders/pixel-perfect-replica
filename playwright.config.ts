import { defineConfig, devices } from "@playwright/test";

// PENDIENTE DE VERIFICAR: no se pudo correr `bun run dev` en el sandbox de esta
// sesión (solo hay node/npm, no bun) para confirmar el puerto real que usa el
// preset de Lovable (@lovable.dev/vite-tanstack-config hace detección de
// sandbox/puerto). Puerto de placeholder = 3000; correr `bun run dev` local y
// ajustar PORT/baseURL/webServer.url si el puerto real es otro antes de confiar
// en `bun run test:e2e`.
const PORT = process.env.PORT ?? "3000";

export default defineConfig({
  testDir: "./e2e",
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
  },
});
