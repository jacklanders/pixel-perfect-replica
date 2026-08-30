import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const authFile = path.join(__dirname, ".auth", "user.json");
const hasAuth = fs.existsSync(authFile);

test.describe("Páginas públicas", () => {
  test("landing carga sin errores", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Jack/i })).toBeVisible();
  });

  test("login carga sin errores", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /Continuar con Google/i })).toBeVisible();
  });
});

test.describe("Flujo de postulaciones (autenticado)", () => {
  test.skip(!hasAuth, "Saltado: no existe e2e/.auth/user.json. Generalo manualmente.");

  test.use({ storageState: authFile });

  test("cargar aviso, extraer datos y generar postulación", async ({ page }) => {
    await page.goto("/postulaciones/nueva");
    await expect(page.getByRole("heading", { name: "Cargar aviso" })).toBeVisible();

    await page.fill(
      'textarea[id="aviso"]',
      "Buscamos Ejecutivo de cuentas para Naranja X, Corrientes. Requisitos: 3+ años experiencia. Mail: seleccion@naranjax.com",
    );

    await page.click('button:has-text("Extraer datos con Jack")');

    // Esperar que Jack complete la extracción
    await expect(page.locator("input#puesto")).toHaveValue(/Ejecutivo/i, { timeout: 15000 });

    // Seleccionar el primer CV disponible
    const cvBtn = page.locator('button:has-text("Mi CV")').first();
    if (await cvBtn.isVisible().catch(() => false)) {
      await cvBtn.click();
    }

    await page.click('button:has-text("Generar postulación")');

    // Redirección al detalle
    await expect(page).toHaveURL(/\/postulaciones\/[a-f0-9-]+/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Ejecutivo|Vacante sin título/ })).toBeVisible();
  });

  test("historial de postulaciones carga", async ({ page }) => {
    await page.goto("/postulaciones");
    await expect(page.getByRole("heading", { name: "Postulaciones" })).toBeVisible();
  });

  test("detalle de postulación muestra datos y permite descartar", async ({ page }) => {
    await page.goto("/postulaciones");
    await page.waitForSelector('a[href^="/postulaciones/"]', { timeout: 10000 });

    const link = page.locator('a[href^="/postulaciones/"]').first();
    await link.click();

    await expect(page.getByRole("heading", { name: /Vacante|Postulación/ })).toBeVisible();

    const descartar = page.getByRole("button", { name: "Descartar" });
    if (await descartar.isVisible().catch(() => false)) {
      await descartar.click();
      await expect(page.getByText("Postulación descartada")).toBeVisible({ timeout: 5000 });
    }
  });
});
