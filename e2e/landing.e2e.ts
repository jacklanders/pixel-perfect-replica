import { test, expect } from "@playwright/test";

// Smoke test de Hito 0: solo confirma que la app levanta y la landing renderiza.
// Los flujos críticos reales (login, CV, postulaciones, Gmail) se agregan con
// mocks de IA/Gmail a medida que cada hito los va habilitando (Hitos 1 a 4).
test("la landing carga y muestra el título de Jack", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Jack/i);
});

test("la landing muestra el rebranding y las herramientas declaradas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("PostulaYa! JACK · Prototipo Fase 1")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Tu CV, trabajado");
  await expect(page.getByText("Hecha con las herramientas favoritas de los devs")).toBeVisible();
  await expect(page.getByText("Gemini AI")).toBeVisible();
  await expect(page.getByText("Claude AI")).toBeVisible();
  await expect(page.getByText("ChatGPT AI")).toBeVisible();
  await expect(page.getByText("VS Code")).toBeVisible();
  await expect(page.getByText("Cursor")).toBeVisible();
});
