import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const exchangeCodeSchema = z.object({ code: z.string().min(1) });

export const exchangeCodeForSession = createServerFn({ method: "POST" })
  .validator(exchangeCodeSchema)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(data.code);
    return { ok: !error, message: error?.message };
  });

export const Route = createFileRoute("/auth/callback")({
  // Corre server-side en el primer request (justo lo que necesitamos: el
  // exchange de code por sesión tiene que pasar por el servidor para poder
  // setear las cookies de sesión en la respuesta).
  beforeLoad: async ({ search }) => {
    const rawCode = (search as Record<string, unknown>)["code"];
    const code = typeof rawCode === "string" ? rawCode : undefined;

    if (!code) {
      throw redirect({ to: "/login", search: { error: "sin_code" } });
    }

    const result = await exchangeCodeForSession({ data: { code } });

    if (!result.ok) {
      console.error("[auth] Google OAuth code exchange failed:", result.message);
      throw redirect({ to: "/login", search: { error: "auth_fallo" } });
    }

    throw redirect({ to: "/perfil" });
  },
  component: () => null,
});
