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

const ESTADO_OAUTH = "e2e_oauth_state_123";

// Corre con MOCK_GMAIL=true (webServer en playwright.config): exchange de
// tokens y envío de la API real de Gmail se simulan del lado del servidor;
// el límite diario (RPC), el marcado "sent" y los adjuntos en Storage son reales.
test.describe("Flujo Gmail (mock)", () => {
  test.skip(!hasAuth, "Saltado: no existe e2e/.auth/user.json. Generalo manualmente.");

  test.use({ storageState: authFile });
  test.describe.configure({ mode: "serial" });

  test("Conectar Gmail: callback simulado → estado conectado", async ({ page }) => {
    // Preparar el state en sessionStorage como hace conectarGmail() en la UI.
    await page.goto("/postulaciones/nueva");
    await page.evaluate(
      (state) => sessionStorage.setItem("gmail_oauth_state", state),
      ESTADO_OAUTH,
    );

    // Simular la vuelta de Google al callback con un code falso.
    await page.goto(`/auth/gmail-callback?code=e2e-fake-code&state=${ESTADO_OAUTH}`);

    // procesarGmailCallback con MOCK_GMAIL guarda tokens falsos y redirige al perfil.
    await expect(page).toHaveURL(/\/perfil\?gmail=conectado/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Tu perfil" }).first()).toBeVisible();

    // Verificar "estado conectado" en la UI de envío: sin botón de conectar,
    // con el de desconectar.
    const detailUrl = await createApplication(page);
    await page.goto(detailUrl);
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
