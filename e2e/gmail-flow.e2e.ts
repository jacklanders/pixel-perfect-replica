import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getServiceClient,
  getAnyUserId,
  resetDailyUsage,
  createApplication,
  uploadFileAndSend,
} from "./helpers/gmail-utils";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const authFile = path.join(__dirname, ".auth", "user.json");
const hasAuth = fs.existsSync(authFile);

// En CI/sin sesión real el server corre con MOCK_AUTH=true (login
// determinístico) y no se necesita storageState; en local con Supabase real se
// usa e2e/.auth/user.json. El estado de OAuth se inyecta por sessionStorage tal
// como hace conectarGmail() en la UI.
const isMockAuth = process.env.MOCK_AUTH === "true";

// Con Supabase real (MOCK_AUTH=false) la sesión sale de e2e/.auth/user.json;
// con mock auth el server asigna el usuario determinístico y no hace falta.
if (!isMockAuth && hasAuth) {
  test.use({ storageState: authFile });
}

// Corre con MOCK_GMAIL=true (webServer en playwright.config): exchange de
// tokens y envío de la API real de Gmail se simulan del lado del servidor;
// el límite diario (RPC), el marcado "sent" y los adjuntos en Storage son reales.
test.describe("Flujo Gmail (mock)", () => {
  test.skip(
    !isMockAuth && !hasAuth,
    "Saltado: no existe e2e/.auth/user.json (y MOCK_AUTH no está activo).",
  );
  test.describe.configure({ mode: "serial" });

  test("Conectar Gmail: callback simulado vuelve a la postulación y activa enviar", async ({
    page,
  }) => {
    // Crear una postulación real por la UI y usar SU ruta como origen: el
    // callback debe volver a ella (con el botón "Enviar desde Gmail" activo),
    // no a /perfil.
    const detailUrl = await createApplication(page);
    const origin = new URL(detailUrl).pathname;

    // Como conectarGmail() en la UI: state con el origen embebido + fallback en sessionStorage.
    const state = `e2e_state_${Date.now()}|${origin}`;
    await page.goto("/postulaciones/nueva");
    await page.evaluate(
      ({ state, origin }) => {
        sessionStorage.setItem("gmail_oauth_state", state);
        sessionStorage.setItem("gmail_oauth_origin", origin);
      },
      { state, origin },
    );

    // Simular la vuelta de Google al callback con un code falso y el MISMO state.
    await page.goto(`/auth/gmail-callback?code=e2e-fake-code&state=${encodeURIComponent(state)}`);

    await expect(page).toHaveURL(new RegExp(origin.replace(/\//g, "\\/") + "\\?gmail=conectado"), {
      timeout: 15000,
    });
    await expect(page.getByRole("button", { name: "Enviar desde Gmail" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("button", { name: "Desconectar Gmail" })).toBeVisible();
  });

  test("Enviar postulación con Gmail mock → estado 'sent' sin errores de consola", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    const detailUrl = await createApplication(page);
    await page.goto(detailUrl);

    await uploadFileAndSend(page, "cv-postulacion-e2e.pdf");

    // Se marcó como enviada: toast + bloque "Mail enviado el..." + badge.
    await expect(page.getByText("Postulación enviada por Gmail")).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Mail enviado el /)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Enviada", { exact: true })).toBeVisible();

    // Sin errores de consola en el flujo completo (ignora ruido de favicon/recursos).
    const relevant = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("Failed to load resource"),
    );
    expect(relevant).toEqual([]);
  });

  test("Límite diario: con envío mock bloquea el tercer intento", async ({ page }) => {
    const service = getServiceClient();
    const userId = await getAnyUserId(service);
    if (!userId) throw new Error("E2E: no hay perfiles en la DB para resetear el límite diario");
    await resetDailyUsage(service, userId);

    // Intentos 1 y 2: se envían bien.
    for (let i = 0; i < 2; i++) {
      const url = await createApplication(page, `Ejecutivo de cuentas ${i + 1}`);
      await page.goto(url);
      await uploadFileAndSend(page, `cv-${i + 1}.pdf`);
      await expect(page.getByText(/Mail enviado el /)).toBeVisible({ timeout: 20000 });
    }

    // Intento 3: con 2 envíos usados, la UI bloquea el botón proactivamente
    // (limiteAlcanzado) y muestra el aviso. El RPC ya fue ejercitado en los
    // intentos 1 y 2 (allowed=true) y su bloqueo (allowed=false) se cubre en unit.
    const url3 = await createApplication(page, "Ejecutivo de cuentas 3");
    await page.goto(url3);
    await uploadFileAndSend(page, "cv-3.pdf");

    await expect(page).toHaveURL(/\/postulaciones\/[0-9a-f-]+/);
    await expect(page.getByText("Llegaste al límite gratuito de hoy")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("button", { name: "Enviar desde Gmail" })).toBeDisabled();
    await expect(page.getByText("Pendiente", { exact: true })).toBeVisible();
  });
});
