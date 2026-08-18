import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Falla rápido y claro en dev en vez de un error de red confuso más adelante.
  console.error(
    "[supabase] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env.local y completá los valores de `supabase start`.",
  );
}

/**
 * Cliente de Supabase para código que corre en el navegador. Usa cookies (no
 * localStorage) para la sesión, vía @supabase/ssr — así el server client
 * (src/lib/supabase/server.ts) ve la misma sesión en cada request SSR, sin
 * duplicar el manejo de tokens entre cliente y servidor.
 */
export function getSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
