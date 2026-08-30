import { test as setup, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const authFile = path.join(__dirname, ".auth", "user.json");

/**
 * Setup de autenticación para Playwright.
 *
 * Instrucciones manuales (una sola vez):
 * 1. Levantá todo: supabase start && bun run dev
 * 2. Andá a http://localhost:3000/login e iniciá sesión con Google
 * 3. Corré: npx playwright codegen --save-storage=e2e/.auth/user.json http://localhost:3000
 * 4. O copiá las cookies de sesión de Supabase desde DevTools > Application > Cookies
 *
 * Para CI, inyectar cookies de test vía SUPABASE_SERVICE_ROLE_KEY (no incluir en repo).
 */
setup("authenticate", async ({ page }) => {
  // Si ya existe el archivo, no hace falta correr de nuevo
  // Playwright lo maneja automáticamente con storageState
  await page.goto("/perfil");
  await expect(page).toHaveURL(/\/perfil/, { timeout: 10000 });
});
