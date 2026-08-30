/**
 * Cliente Supabase con service_role para operaciones server-only.
 * Nunca importar desde código que corre en el browser.
 */

import { createClient } from "@supabase/supabase-js";

export function getEnv(key: string): string | undefined {
  try {
    return process.env[key];
  } catch {
    return undefined;
  }
}

export function getServiceClient() {
  const url = getEnv("VITE_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
