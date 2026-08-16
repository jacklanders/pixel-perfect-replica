import { createMiddleware } from "@tanstack/react-start";

/**
 * Adjunta el access token de Supabase a cada llamada a server functions.
 * El servidor revalida el token (ver requireSupabaseAuth); acá solo se transporta.
 */
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (typeof window === "undefined") return next();

    const { supabase, isSupabaseConfigured } = await import("./client");
    if (!isSupabaseConfigured) return next();

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return next();

    return next({ headers: { Authorization: `Bearer ${token}` } });
  },
);
