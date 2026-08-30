import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Procesando login…");

  useEffect(() => {
    const handleAuth = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        console.error("[auth] OAuth error:", error);
        navigate({ to: "/login", search: { error: "auth_fallo" } });
        return;
      }

      if (!code) {
        navigate({ to: "/login", search: { error: "sin_code" } });
        return;
      }

      // El cliente SSR de Supabase puede haber ya intercambiado el código automáticamente.
      // Verificamos si ya hay sesión antes de intentar el exchange manual.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        navigate({ to: "/perfil" });
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error("[auth] Exchange failed:", exchangeError.message);
        setStatus("Error al procesar el login. Redirigiendo…");
        setTimeout(() => {
          navigate({ to: "/login", search: { error: "auth_fallo" } });
        }, 2000);
      } else {
        setStatus("¡Listo! Redirigiendo…");
        setTimeout(() => {
          navigate({ to: "/perfil" });
        }, 500);
      }
    };

    handleAuth();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <span className="text-xl font-bold text-primary">J</span>
        </div>
        <h1 className="text-xl font-semibold mb-2">Jack</h1>
        <p className="text-muted-foreground text-sm">{status}</p>
      </div>
    </div>
  );
}
