/**
 * Helpers para E2E de Gmail (BLOQUE 7).
 *
 * Los tests E2E corren en el proceso de Playwright (no en el dev server), así
 * que leemos .env.local directo para armar un cliente Supabase service_role y
 * poder preparar/resetear estado (ej: contador diario) sin tocar la UI.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

export function loadEnvVars(): Record<string, string> {
  for (const file of [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
  ]) {
    if (!fs.existsSync(file)) continue;
    const out: Record<string, string> = {};
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const value = m[2]!.replace(/^["']|["']$/g, "");
      if (value) out[m[1]!] = value;
    }
    if (Object.keys(out).length) return out;
  }
  return {};
}

export function getServiceClient(): SupabaseClient {
  const env = loadEnvVars();
  const url = env["VITE_SUPABASE_URL"];
  const key = env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    throw new Error("E2E: faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function getAnyUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("user_id").limit(1).maybeSingle();
  return data?.user_id ?? null;
}

/** Pone el contador diario del usuario en 0 (límite de 2 envíos/día). */
export async function resetDailyUsage(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase.from("daily_usage").upsert(
    {
      user_id: userId,
      usage_date: new Date().toISOString().slice(0, 10),
      application_generations: 0,
    },
    { onConflict: "user_id,usage_date" },
  );
}

/** PDF mínimo para setInputFiles (validador solo mira extensión, mime y tamaño). */
export function cvPdfBuffer(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n% e2e cv\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF",
  );
}

/** Crea una postulación nueva por la UI (Jack en modo MOCK_AI) y devuelve la URL del detalle. */
export async function createApplication(
  page: Page,
  roleWord = "Ejecutivo de cuentas",
): Promise<string> {
  await page.goto("/postulaciones/nueva");
  await page.getByRole("heading", { name: "Cargar aviso" }).waitFor({ timeout: 10000 });

  const aviso = `Buscamos ${roleWord} para ${["Naranja X", "Mercado Libre", "Ripley"][Math.floor(Math.random() * 3)]}, Corrientes. Requisitos: 3+ años experiencia. Mail: seleccion${Date.now()}@empresa.com`;
  await page.fill('textarea[id="aviso"]', aviso);

  await page.click('button:has-text("Extraer datos con Jack")');
  await expect(page.locator("input#puesto")).toHaveValue(/Ejecutivo/i, {
    timeout: 20000,
  });

  const cvBtn = page.locator('button:has-text("Mi CV")').first();
  if (await cvBtn.isVisible().catch(() => false)) await cvBtn.click();

  await page.click('button:has-text("Generar postulación")');
  await page.waitForURL(/\/postulaciones\/[0-9a-f-]+/, { timeout: 20000 });
  return page.url();
}

/** En el detalle: modo "Subir archivo", adjunta el PDF y clickea "Enviar desde Gmail". */
export async function uploadFileAndSend(page: Page, fileName = "cv-e2e.pdf"): Promise<void> {
  await page.click('button:has-text("Subir archivo")');
  await page.setInputFiles('input[type="file"]', {
    name: fileName,
    mimeType: "application/pdf",
    buffer: cvPdfBuffer(),
  });
  await page.getByText("Adjuntando:", { exact: false }).waitFor({ timeout: 15000 });
  await page.click('button:has-text("Enviar desde Gmail")');
}
