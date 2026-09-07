import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { procesarGmailCallback } from "@/lib/oauth.functions";

export const Route = createFileRoute("/auth/gmail-callback")({
  component: GmailCallback,
});

function GmailCallback() {
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

      // El origen viaja embebido en el state ("<random>|<origin>") para
      // sobrevivir a diferencias de origen en sessionStorage (localhost vs
      // 127.0.0.1 son orígenes distintos). Solo rutas internas (empiezan con
      // un "/" y no con "//") para no redirigir a URLs externas.
      const sep = state ? state.indexOf("|") : -1;
      const stateStr = state ?? "";
      const stateOrigin = stateStr === "" ? "" : stateStr.slice(sep + 1);
      const originFromState =
        stateOrigin && stateOrigin.startsWith("/") && !stateOrigin.startsWith("//")
          ? stateOrigin
          : undefined;

      if (errorParam) {
        console.error("[gmail-callback] OAuth error:", errorParam);
        volverAlOrigen("error=gmail_fallo", originFromState);
        return;
      }

      if (!code) {
        volverAlOrigen("error=sin_code", originFromState);
        return;
      }

      // Validar state para prevenir CSRF
      if (!state || state !== savedState) {
        console.error("[gmail-callback] State mismatch");
        volverAlOrigen("error=state_invalido", originFromState);
        return;
      }

      sessionStorage.removeItem("gmail_oauth_state");

      try {
        await procesarGmailCallback({ data: { code } });
        setStatus("¡Gmail conectado! Volviendo a la postulación…");
        setTimeout(() => volverAlOrigen("gmail=conectado", originFromState), 800);
      } catch (err) {
        console.error("[gmail-callback] Error procesando tokens:", err);
        volverAlOrigen("error=gmail_procesamiento", originFromState);
      }
    };

    // Lleva a quien inició la conexión (generalmente la postulación) de vuelta,
    // en vez de aterrizar siempre en /perfil. Con recarga completa para que
    // `verificarEstadoGmail` se re-ejecute y el botón muestre "Enviar desde Gmail".
    const volverAlOrigen = (query: string, originFromState?: string) => {
      const stored = sessionStorage.getItem("gmail_oauth_origin");
      sessionStorage.removeItem("gmail_oauth_origin");
      const candidate = originFromState ?? stored;
      const backTo =
        candidate && candidate.startsWith("/") && !candidate.startsWith("//")
          ? candidate
          : "/perfil";
      const separator = backTo.includes("?") ? "&" : "?";
      window.location.replace(`${backTo}${separator}${query}`);
    };

    void handleCallback();
  }, []);

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
