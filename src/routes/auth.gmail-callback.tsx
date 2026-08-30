import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { procesarGmailCallback } from "@/lib/oauth.functions";

export const Route = createFileRoute("/auth/gmail-callback")({
  component: GmailCallback,
});

function GmailCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Procesando conexión con Gmail…");
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const handleCallback = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const errorParam = url.searchParams.get("error");
      const state = url.searchParams.get("state");
      const savedState = sessionStorage.getItem("gmail_oauth_state");

      if (errorParam) {
        console.error("[gmail-callback] OAuth error:", errorParam);
        navigate({ to: "/perfil", search: { error: "gmail_fallo" } });
        return;
      }

      if (!code) {
        navigate({ to: "/perfil", search: { error: "sin_code" } });
        return;
      }

      // Validar state para prevenir CSRF
      if (!state || state !== savedState) {
        console.error("[gmail-callback] State mismatch");
        navigate({ to: "/perfil", search: { error: "state_invalido" } });
        return;
      }

      sessionStorage.removeItem("gmail_oauth_state");

      try {
        await procesarGmailCallback({ data: { code } });
        setStatus("¡Gmail conectado! Redirigiendo…");
        setTimeout(() => navigate({ to: "/perfil", search: { gmail: "conectado" } }), 800);
      } catch (err) {
        console.error("[gmail-callback] Error procesando tokens:", err);
        navigate({ to: "/perfil", search: { error: "gmail_procesamiento" } });
      }
    };

    void handleCallback();
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
