import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

/**
 * Middleware de admin: requiere sesión (requireSupabaseAuth) y que el usuario
 * tenga rol 'admin' en user_roles. La verificación usa la función SQL
 * `has_role` (security definer), el mismo mecanismo que el resto del código
 * para no depender de grants por tabla.
 */
export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data: esAdmin, error } = await context.supabase.rpc("has_role", {
      p_user_id: context.userId,
      p_role: "admin",
    });

    if (error || !esAdmin) {
      throw new Response("Forbidden", { status: 403 });
    }

    return next({ context });
  });
