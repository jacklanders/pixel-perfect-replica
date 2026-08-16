import { createMiddleware } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Valida el bearer token del request y deja en contexto un cliente Supabase que
 * actúa como el usuario (RLS aplicada, nunca service_role).
 */
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");

    const authHeader = getRequestHeader("authorization");
    const token = authHeader?.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : undefined;

    if (!token) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
    const anonKey = process.env["SUPABASE_ANON_KEY"] ?? process.env["VITE_SUPABASE_ANON_KEY"];

    if (!url || !anonKey) {
      throw new Error("Faltan SUPABASE_URL / SUPABASE_ANON_KEY en el servidor.");
    }

    const supabase: SupabaseClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await supabase.auth.getUser(token);
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
