import { test, expect } from "@playwright/test";

// Test de UI: valida que /login renderiza correctamente y expone la entrada
// de autenticación. No certifica el login real con Google/Supabase.
test("la pantalla de login muestra el título y el botón de Google", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/Ingresar|Jack/i);
  await expect(page.getByRole("button", { name: /Continuar con Google/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ingresar con email/i })).toBeVisible();
});

test("la ruta protegida redirige a /login cuando no hay sesión", async ({ page }) => {
  await page.goto("/perfil");
  await page.waitForURL("/login**");
  expect(page.url()).toContain("/login");
});
