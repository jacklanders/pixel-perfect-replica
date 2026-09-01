/**
 * Cliente Supabase con service_role para operaciones server-only.
 * Nunca importar desde código que corre en el browser.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getEnv(key: string): string | undefined {
  try {
    return process.env[key];
  } catch {
    return undefined;
  }
}

// En producción el cliente service_role se crea una sola vez por worker/proceso
// (el env no cambia en runtime). Cachearlo evita recrear un cliente por
// operación, que desperdicia memoria y puede abrir conexiones innecesarias.
let serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const url = getEnv("VITE_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  serviceClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return serviceClient;
}
