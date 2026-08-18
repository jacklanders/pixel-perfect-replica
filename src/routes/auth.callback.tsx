import { createFileRoute, redirect } from "@tanstack/react-router";
import { exchangeCodeForSession } from "@/lib/server/auth";

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
      throw redirect({ to: "/login", search: { error: "auth_fallo" } });
    }

    throw redirect({ to: "/perfil" });
  },
  component: () => null,
});
