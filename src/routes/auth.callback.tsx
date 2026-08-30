import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { FUNNEL, trackEvent } from "@/lib/observability";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Procesando login…");
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const handleAuth = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const errorParam = url.searchParams.get("error");

      if (errorParam) {
        console.error("[auth] OAuth error:", errorParam);
        navigate({ to: "/login", search: { error: "auth_fallo" } });
        return;
      }

      if (!code) {
        navigate({ to: "/login", search: { error: "sin_code" } });
        return;
      }

      // 1. Si ya hay sesión (intercambio automático), redirigir directo
      const {
        data: { session: existingSession },
      } = await supabase.auth.getSession();

      if (existingSession) {
        trackEvent(FUNNEL.loginOk);
        navigate({ to: "/perfil" });
        return;
      }

      // 2. Intercambiar código por sesión
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (!exchangeError) {
        trackEvent(FUNNEL.loginOk);
        setStatus("¡Listo! Redirigiendo…");
        setTimeout(() => navigate({ to: "/perfil" }), 300);
        return;
      }

      // 3. Si falló, verificar una última vez (race condition / otro tab)
      const {
        data: { session: sessionAfter },
      } = await supabase.auth.getSession();

      if (sessionAfter) {
        trackEvent(FUNNEL.loginOk);
        navigate({ to: "/perfil" });
        return;
      }

      // 4. Solo si definitivamente no hay sesión, mostrar error
      console.error("[auth] Exchange failed:", exchangeError.message);
      setStatus("Error al procesar el login. Redirigiendo…");
      setTimeout(() => navigate({ to: "/login", search: { error: "auth_fallo" } }), 2000);
    };

    void handleAuth();
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
