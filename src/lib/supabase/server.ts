// PENDIENTE DE VERIFICAR EN LOCAL: este archivo es la pieza más riesgosa del
// Hito 1. No se pudo correr `bun run dev` + un login real de Google en el
// sandbox donde se armó este patch (sin bun, sin credenciales de Google, sin
// proyecto Supabase real). El patrón de abajo (getAll/setAll de cookies vía
// @supabase/ssr, usando getWebRequest/setCookie de @tanstack/react-start/server)
// es el documentado por Supabase para frameworks SSR "custom", pero los nombres
// exactos exportados pueden variar entre versiones de @tanstack/react-start.
// Antes de confiar en esto: `bun run dev`, ir a /login, tocar "Continuar con
// Google", confirmar que vuelve autenticado a /perfil y que un refresh de
// página mantiene la sesión (eso confirma que las cookies se están seteando
// bien en la respuesta, no solo leyendo).
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getWebRequest, setCookie } from "@tanstack/react-start/server";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string;

function parseCookieHeader(header: string | null): { name: string; value: string }[] {
  if (!header) return [];
  return header
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const eqIdx = pair.indexOf("=");
      const name = eqIdx === -1 ? pair : pair.slice(0, eqIdx);
      const value = eqIdx === -1 ? "" : pair.slice(eqIdx + 1);
      return { name, value: decodeURIComponent(value) };
    });
}

/**
 * Cliente de Supabase para usar SOLO dentro de server functions
 * (`createServerFn`) o loaders/beforeLoad que corren en el servidor. Lee la
 * sesión de las cookies del request entrante y, si Supabase refresca el
 * token, reescribe esas cookies en la respuesta — así el usuario no se
 * desloguea solo porque el access token expiró a mitad de sesión.
 *
 * Corre como el usuario autenticado (rol `authenticated` de Postgres), NO como
 * service_role: todo lo que se consulte acá respeta RLS. Para lo que sí
 * necesita bypassear RLS (ej. leer oauth_connections en Hito 4) usar un
 * cliente aparte con la service role key, nunca este.
 */
export function getSupabaseServerClient() {
  const request = getWebRequest();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request?.headers.get("cookie") ?? null);
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(name, value, options);
        }
      },
    },
  });
}
