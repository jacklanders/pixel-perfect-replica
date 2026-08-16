import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de navegador contra el proyecto Supabase propio (externo, no Lovable Cloud).
 * Las claves son públicas: el límite real de acceso son las policies RLS.
 */
const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient = createClient(
  url ?? "https://supabase-sin-configurar.invalid",
  anonKey ?? "anon-key-sin-configurar",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "jack-auth",
    },
  },
);
