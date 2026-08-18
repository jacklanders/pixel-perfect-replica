import { createMiddleware } from "@tanstack/react-start";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Valida la sesión (cookies, no bearer token) y deja en contexto un cliente
 * Supabase que actúa como el usuario (RLS aplicada, nunca service_role).
 *
 * Antes esto leía un header `Authorization: Bearer <token>` (ver historial de
 * auth-attacher.ts, ya eliminado) — se unificó a cookies porque convivían dos
 * mecanismos de sesión distintos en el mismo repo (uno por función de servidor
 * vía bearer, otro por ruta vía cookies), y eso rompía el login de formas
 * inconsistentes según qué código corriera. El `context` de salida es el mismo
 * de antes (`supabase`, `userId`, `email`, `userMetadata`), así que
 * perfil.functions.ts / cv.functions.ts no necesitan cambios.
 */
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      throw new Response("Unauthorized", { status: 401 });
    }

    return next({
      context: {
        supabase,
        userId: data.user.id,
        email: data.user.email ?? "",
        userMetadata: (data.user.user_metadata ?? {}) as Record<string, unknown>,
      },
    });
  },
);
