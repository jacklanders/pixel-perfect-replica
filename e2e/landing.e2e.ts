import { test, expect } from "@playwright/test";

// Smoke test de Hito 0: solo confirma que la app levanta y la landing renderiza.
// Los flujos críticos reales (login, CV, postulaciones, Gmail) se agregan con
// mocks de IA/Gmail a medida que cada hito los va habilitando (Hitos 1 a 4).
test("la landing carga y muestra el título de Jack", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Jack/i);
});
