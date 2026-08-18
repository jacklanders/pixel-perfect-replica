import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

export function assertSupabaseConfig(
  url: string | undefined,
  anonKey: string | undefined,
): asserts url is string {
  if (!url || !url.trim()) {
    throw new Error(
      "Faltan VITE_SUPABASE_URL. Copiá .env.example a .env.local y completá el valor real de Supabase.",
    );
  }

  if (!anonKey || !anonKey.trim()) {
    throw new Error(
      "Faltan VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env.local y completá el valor real de Supabase.",
    );
  }
}

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

if (!isSupabaseConfigured) {
  // Falla rápido y claro en dev en vez de un error de red confuso más adelante.
  console.error(
    "[supabase] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env.local y completá los valores de `supabase start`.",
  );
}

const browserClient = createBrowserClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key",
);

export const supabase = browserClient;

/**
 * Cliente de Supabase para código que corre en el navegador. Usa cookies (no
 * localStorage) para la sesión, vía @supabase/ssr — así el server client
 * (src/lib/supabase/server.ts) ve la misma sesión en cada request SSR, sin
 * duplicar el manejo de tokens entre cliente y servidor.
 */
export function getSupabaseBrowserClient() {
  return browserClient;
}
