import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { procesarGmailCallback } from "@/lib/oauth.functions";

export const Route = createFileRoute("/auth/gmail-callback")({
  component: GmailCallback,
});

/** Solo rutas internas (empiezan con "/" y no con "//") para no redirigir afuera. */
const esRutaInterna = (path: string | undefined | null): boolean =>
  Boolean(path && path.startsWith("/") && !path.startsWith("//"));

/**
 * El origen viaja embebido en el state ("<random>|<origin>") para sobrevivir a
 * diferencias de origen en sessionStorage (localhost vs 127.0.0.1 son orígenes
 * distintos). Se respeta solo si es una ruta interna.
 */
const origenDesdeState = (state: string | null): string | undefined => {
  const sep = state ? state.indexOf("|") : -1;
  const origin = state && sep !== -1 ? state.slice(sep + 1) : "";
  return esRutaInterna(origin) ? origin : undefined;
};

type Diag = {
  state: string | null;
  stateMatch: boolean;
  originFromState: string | undefined;
  originFromStorage: string | null;
  target: string;
};

function GmailCallback() {
  const [status, setStatus] = useState("Procesando conexión con Gmail…");
  const [diag, setDiag] = useState<Diag | null>(null);
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
      const originFromState = origenDesdeState(state);
      const originFromStorage = sessionStorage.getItem("gmail_oauth_origin");
      const origin = originFromState ?? originFromStorage;
      const backTo = esRutaInterna(origin) ? (origin as string) : "/perfil";

      const volverAlOrigen = (query: string) => {
        sessionStorage.removeItem("gmail_oauth_state");
        sessionStorage.removeItem("gmail_oauth_origin");
        const separator = backTo.includes("?") ? "&" : "?";
        const target = `${backTo}${separator}${query}`;
        console.log("[gmail-callback] target:", target, {
          state,
          stateMatch: state === savedState,
          originFromState,
          originFromStorage,
        });

        // Diagnóstico transitorio: si no resolvimos origen, NUNCA mandar ciego
        // a /perfil. Mostramos por qué y dejamos que el usuario decida.
        if (backTo === "/perfil") {
          setDiag({
            state,
            stateMatch: state === savedState,
            originFromState,
            originFromStorage,
            target,
          });
          return;
        }
        setStatus(`¡Listo! Volviendo a ${backTo}…`);
        setTimeout(() => window.location.replace(target), 800);
      };

      if (errorParam) {
        console.error("[gmail-callback] OAuth error:", errorParam);
        volverAlOrigen("error=gmail_fallo");
        return;
      }
      if (!code) {
        volverAlOrigen("error=sin_code");
        return;
      }
      // Validar state para prevenir CSRF
      if (!state || state !== savedState) {
        console.error("[gmail-callback] State mismatch");
        volverAlOrigen("error=state_invalido");
        return;
      }
      try {
        await procesarGmailCallback({ data: { code } });
        volverAlOrigen("gmail=conectado");
      } catch (err) {
        console.error("[gmail-callback] Error procesando tokens:", err);
        volverAlOrigen("error=gmail_procesamiento");
      }
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

        {diag ? (
          <div className="mx-auto mt-6 w-full max-w-md rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-left text-sm">
            <p className="font-medium text-amber-200">
              No se pudo resolver el origen de vuelta (diagnóstico)
            </p>
            <dl className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
              <p>
                state recibido: <span className="text-foreground">{diag.state ?? "(vacío)"}</span>
              </p>
              <p>
                state coincide: <span className="text-foreground">{String(diag.stateMatch)}</span>
              </p>
              <p>
                origen embebido en state:{" "}
                <span className="text-foreground">{diag.originFromState ?? "(vacío)"}</span>
              </p>
              <p>
                origen en sessionStorage:{" "}
                <span className="text-foreground">{diag.originFromStorage ?? "(vacío)"}</span>
              </p>
              <p>
                target: <span className="text-foreground break-all">{diag.target}</span>
              </p>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={diag.target}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
              >
                Continuar de todos modos
              </a>
              <a
                href="/postulaciones"
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Ir al historial
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
