import { test, expect } from "@playwright/test";

const isMockAuth = process.env.MOCK_AUTH === "true";

// Test de UI: valida que /login renderiza correctamente y expone la entrada
// de autenticación. No certifica el login real con Google/Supabase.
test("la pantalla de login muestra el título y el botón de Google", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/Ingresar|Jack/i);
  await expect(page.getByRole("button", { name: /Continuar con Google/i })).toBeVisible();
});

// En modo MOCK_AUTH el guard de rutas considera la sesión autenticada (identidad
// determinística de test), así que /perfil NO redirige a /login. Este test solo
// aplica sin MOCK_AUTH (con Supabase local real y sin sesión).
test.skip(isMockAuth, "Redirección sin sesión (solo aplica con Supabase real, sin MOCK_AUTH)")(
  "la ruta protegida redirige a /login cuando no hay sesión",
  async ({ page }) => {
    await page.goto("/perfil");
    await page.waitForURL("/login**");
    expect(page.url()).toContain("/login");
  },
);
