import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/**
 * Devuelve el usuario autenticado (o null) leyendo la cookie de sesión del
 * request. Se llama tanto desde `beforeLoad` de rutas protegidas como desde
 * el header para decidir qué mostrar.
 */
export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  },
);

const exchangeCodeSchema = z.object({ code: z.string().min(1) });

/**
 * Intercambia el `code` del callback de OAuth (PKCE) por una sesión real,
 * seteando las cookies correspondientes. Debe correr en el servidor: el
 * `code_verifier` de PKCE vive en una cookie que este mismo cliente ya sabe
 * leer/escribir vía src/lib/supabase/server.ts.
 */
export const exchangeCodeForSession = createServerFn({ method: "POST" })
  .validator(exchangeCodeSchema)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(data.code);
    return { ok: !error };
  });
