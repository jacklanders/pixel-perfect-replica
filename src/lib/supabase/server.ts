// src/lib/supabase/server.ts
// Cliente de Supabase para el SERVIDOR (SSR y server functions)

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getRequest, setCookie } from "@tanstack/react-start/server";

// DEBUG: Vamos a probar TODAS las formas de leer variables de entorno
// y ver cuál funciona en tu máquina
function getEnvVar(name: string): string | undefined {
  // Forma 1: process.env (Node.js)
  if (typeof process !== "undefined" && process.env && name in process.env) {
    const val = process.env[name];
    if (val) return val;
  }

  // Forma 2: import.meta.env (Vite)
  try {
    const viteEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
    if (viteEnv && name in viteEnv) {
      const val = viteEnv[name];
      if (val) return val;
    }
  } catch {
    // import.meta.env no disponible
  }

  return undefined;
}

// DEBUG: Log para ver qué estamos leyendo (sin mostrar la key completa por seguridad)
const supabaseUrl = getEnvVar("VITE_SUPABASE_URL")?.trim();
const supabaseAnonKey = getEnvVar("VITE_SUPABASE_ANON_KEY")?.trim();

const isDev =
  typeof process !== "undefined" && process.env && process.env["NODE_ENV"] !== "production";
if (isDev) {
  if (supabaseUrl) {
    console.log("[DEBUG] Supabase URL leída:", supabaseUrl);
  } else {
    console.error("[DEBUG] ERROR: No se pudo leer VITE_SUPABASE_URL");
  }

  if (supabaseAnonKey) {
    console.log(
      "[DEBUG] Supabase Key leída (primeros 20 chars):",
      supabaseAnonKey.substring(0, 20) + "...",
    );
  } else {
    console.error("[DEBUG] ERROR: No se pudo leer VITE_SUPABASE_ANON_KEY");
  }
}

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
