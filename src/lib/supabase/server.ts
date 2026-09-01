// src/lib/supabase/server.ts
// Cliente de Supabase para el SERVIDOR (SSR y server functions)

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getRequest, setCookie } from "@tanstack/react-start/server";
import { getEnvVar } from "@/lib/server/env";

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

export function getSupabaseServerClient() {
  const request = getRequest();

  // FIX: Defensa contra request undefined (puede pasar en workers)
  if (!request) {
    throw new Error("No hay request disponible en el contexto del servidor");
  }

  const supabaseUrl = getEnvVar("VITE_SUPABASE_URL")?.trim();
  const supabaseAnonKey = getEnvVar("VITE_SUPABASE_ANON_KEY")?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. " +
        "Verificá que el archivo .env.local esté en la raíz del proyecto, " +
        "que tenga las variables correctas, y que hayas reiniciado el servidor con Ctrl+C y luego bun run dev.",
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("cookie"));
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value, options } of cookiesToSet) {
          const safeOptions = {
            ...options,
            path: options.path ?? "/",
          } as Parameters<typeof setCookie>[2];
          setCookie(name, value, safeOptions);
        }
      },
    },
  });
}
