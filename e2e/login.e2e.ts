import { test, expect } from "@playwright/test";

// En modo MOCK_AUTH (default del webServer en playwright.config) el guard de
// rutas considera la sesión autenticada, así que los tests de session real solo
// tienen sentido con MOCK_AUTH=false (Supabase real y sin sesión).
const conAuthReal = process.env.MOCK_AUTH === "false";

// Test de UI: valida que /login renderiza correctamente y expone la entrada
// de autenticación. No certifica el login real con Google/Supabase.
test("la pantalla de login muestra el título y el botón de Google", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/Ingresar|Jack/i);
  await expect(page.getByRole("button", { name: /Continuar con Google/i })).toBeVisible();
});

// Este test usa `test.skip` DENTRO del cuerpo (Playwright no admite usarlo como
// wrapper `(...)(title, fn)`): se ejecuta solo con MOCK_AUTH=false.
test("la ruta protegida redirige a /login cuando no hay sesión", async ({ page }) => {
  test.skip(!conAuthReal, "Saltado: correr con MOCK_AUTH=false y Supabase real para ejecutarlo");
  await page.goto("/perfil");
  await page.waitForURL("/login**");
  expect(page.url()).toContain("/login");
});
