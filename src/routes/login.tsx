import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { JackMark } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const Route = createFileRoute("/login")({
  // El guard de _authenticated/route.tsx redirige acá con ?redirect=<url>; se
  // reenvía a /auth/callback para que después del login se vuelva a esa ruta.
  validateSearch: (search: Record<string, unknown>): { redirect?: string; error?: string } => {
    const result: { redirect?: string; error?: string } = {};
    if (typeof search["redirect"] === "string") result.redirect = search["redirect"];
    if (typeof search["error"] === "string") result.error = search["error"];
    return result;
  },
  head: () => ({
    meta: [
      { title: "Ingresar a Jack" },
      {
        name: "description",
        content: "Entrá a Jack con tu cuenta de Google para trabajar en tu CV.",
      },
      { property: "og:title", content: "Ingresar a Jack" },
      {
        property: "og:description",
        content: "Accedé a tu perfil y a tu CV asistido por IA.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { redirect, error: errorParam } = Route.useSearch();

  const errorMostrado =
    error ??
    (errorParam === "auth_fallo"
      ? "El login no se pudo completar. Probá de nuevo."
      : errorParam === "sin_code"
        ? "No se recibió el código de Google. Probá de nuevo."
        : null);

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    // Solo rutas internas: evitar open redirect a dominios externos.
    const safeRedirect =
      redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : undefined;
    const redirectTo = `${window.location.origin}/auth/callback${
      safeRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : ""
    }`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (authError) {
      setError("No se pudo iniciar el login con Google. Probá de nuevo.");
      setLoading(false);
    }
    // Si no hay error, el navegador ya está siendo redirigido a Google.
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="surface-hero relative hidden flex-col justify-between p-10 md:flex">
        <div className="grid-paper absolute inset-0 opacity-30" aria-hidden="true" />
        <Link to="/" className="relative">
          <JackMark />
        </Link>
        <p className="relative max-w-sm font-display text-3xl leading-tight font-bold">
          “Contame qué hacés y armamos juntos un CV que se entienda en 10 segundos.”
        </p>
        <p className="relative text-sm opacity-70">Jack · asistente de CV</p>
      </div>

      <div className="flex items-center justify-center px-5 py-16">
        <div className="w-full max-w-sm">
          <div className="md:hidden">
            <Link to="/">
              <JackMark />
            </Link>
          </div>
          <h1 className="mt-8 font-display text-2xl font-bold md:mt-0">Ingresar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Usá tu cuenta de Google: es la casilla desde la que después enviás postulaciones.
          </p>

          <Button
            variant="outline"
            className="mt-7 w-full"
            size="lg"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? "Redirigiendo a Google…" : "Continuar con Google"}
          </Button>

          {errorMostrado ? <p className="mt-4 text-sm text-destructive">{errorMostrado}</p> : null}

          <p className="mt-6 text-xs text-muted-foreground">
            Solo pedimos tu identidad de Google. El envío de mails desde tu Gmail se habilita
            aparte, más adelante, con tu confirmación explícita.
          </p>
        </div>
      </div>
    </div>
  );
}
