import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { JackMark } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const Route = createFileRoute("/login")({
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

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
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

          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

          <p className="mt-6 text-xs text-muted-foreground">
            Solo pedimos tu identidad de Google. El envío de mails desde tu Gmail se habilita
            aparte, más adelante, con tu confirmación explícita.
          </p>
        </div>
      </div>
    </div>
  );
}
